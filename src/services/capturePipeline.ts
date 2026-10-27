// Orchestrates capture jobs end to end and keeps them running independently of which view is on screen.
//
//   live   : on-device recording (IndexedDB) -> chunked upload -> normalize -> enrolled transcription
//   upload : picked file (kept on-device)     -> chunked upload -> normalize -> anonymous transcription
//   online : meeting bot recording            -> server ingest  -> normalize -> anonymous transcription

import { Campaign, Session, SessionCapture } from "../types";
import { getBotStatus, ingestBotRecording, uploadAndNormalize, releaseJob, NormalizedManifest } from "./captureApi";
import { processCapture, ProcessProgress } from "./captureProcessor";
import { deleteSegments, getLocalTranscript, getRecording } from "./localAudioStore";

export interface CaptureContext {
  getSession: (sessionId: string) => Session | undefined;
  getCampaign: (campaignId: string) => Campaign | undefined;
  saveCapture: (sessionId: string, capture: SessionCapture) => Promise<void>;
}

/** Sessions loaded from storage carry no lines when the transcript lives on-device; put them back. */
export async function hydrateCaptureLines(sessionId: string, capture: SessionCapture): Promise<SessionCapture> {
  if (!capture.linesStoredLocally || capture.lines.length > 0) return capture;
  const lines = await getLocalTranscript(sessionId).catch(() => undefined);
  return lines ? { ...capture, lines } : capture;
}

export interface RunnerJobState {
  sessionId: string;
  running: boolean;
  stage: string;
  fraction: number;
  error?: string;
}

type Listener = (jobs: Map<string, RunnerJobState>) => void;

class CaptureRunner {
  private jobs = new Map<string, RunnerJobState>();
  private controllers = new Map<string, AbortController>();
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.jobs);
    return () => this.listeners.delete(fn);
  }

  get(sessionId: string): RunnerJobState | undefined {
    return this.jobs.get(sessionId);
  }

  isRunning(sessionId: string): boolean {
    return !!this.jobs.get(sessionId)?.running;
  }

  private update(sessionId: string, patch: Partial<RunnerJobState>) {
    const prev = this.jobs.get(sessionId) || { sessionId, running: false, stage: "", fraction: 0 };
    this.jobs = new Map(this.jobs).set(sessionId, { ...prev, ...patch });
    this.listeners.forEach((l) => l(this.jobs));
  }

  cancel(sessionId: string) {
    this.controllers.get(sessionId)?.abort();
  }

  run(sessionId: string, task: (signal: AbortSignal, report: (stage: string, fraction: number) => void) => Promise<void>): Promise<void> {
    if (this.isRunning(sessionId)) return Promise.resolve();
    const controller = new AbortController();
    this.controllers.set(sessionId, controller);
    this.update(sessionId, { running: true, stage: "Starting…", fraction: 0, error: undefined });
    return task(controller.signal, (stage, fraction) => this.update(sessionId, { stage, fraction }))
      .then(() => this.update(sessionId, { running: false, stage: "", fraction: 1 }))
      .catch((e: any) => {
        const paused = e?.name === "AbortError";
        this.update(sessionId, { running: false, stage: "", error: paused ? undefined : e?.message || String(e) });
        if (!paused) throw e;
      })
      .finally(() => this.controllers.delete(sessionId));
  }
}

export const captureRunner = new CaptureRunner();

function progressReporter(report: (stage: string, fraction: number) => void) {
  return (p: ProcessProgress) => report(p.stage, p.segmentCount ? p.segmentIndex / p.segmentCount : 0);
}

async function transcribeManifest(
  ctx: CaptureContext,
  sessionId: string,
  jobId: string,
  manifest: NormalizedManifest,
  signal: AbortSignal,
  report: (stage: string, fraction: number) => void
) {
  const session = ctx.getSession(sessionId);
  const campaign = session ? ctx.getCampaign(session.campaignId) : undefined;
  if (!session?.capture || !campaign) throw new Error("Session or campaign not found.");
  const final = await processCapture({
    sessionId,
    campaign,
    capture: await hydrateCaptureLines(sessionId, session.capture),
    jobId,
    manifest,
    signal,
    onProgress: progressReporter(report),
    onUpdate: (c) => ctx.saveCapture(sessionId, c),
  });
  // Server copy and on-device segment cache are no longer needed once every segment is transcribed.
  releaseJob(jobId);
  deleteSegments(jobId, final.segmentCount || manifest.segments.length).catch(() => {});
}

async function fail(ctx: CaptureContext, sessionId: string, error: any) {
  if (error?.name === "AbortError") return;
  const capture = ctx.getSession(sessionId)?.capture;
  if (capture) await ctx.saveCapture(sessionId, { ...capture, status: "error", error: error?.message || String(error) });
}

/** Uploads the on-device recording, then transcribes it. Used for live sessions and file uploads. */
export function processRecording(ctx: CaptureContext, sessionId: string): Promise<void> {
  return captureRunner.run(sessionId, async (signal, report) => {
    try {
      const capture = ctx.getSession(sessionId)?.capture;
      if (!capture?.recordingId) throw new Error("No recording is attached to this session.");
      const rec = await getRecording(capture.recordingId);
      if (!rec) throw new Error("The recording isn't on this device. Open the session on the device that recorded it.");

      await ctx.saveCapture(sessionId, { ...capture, status: "uploading", error: undefined });
      const { jobId, manifest } = await uploadAndNormalize(
        rec.blob,
        rec.fileName,
        (f, stage) => report(stage === "uploading" ? `Uploading audio… ${Math.round(f * 100)}%` : "Extracting audio track…", stage === "uploading" ? f * 0.15 : 0.15),
        signal
      );
      const latest = ctx.getSession(sessionId)!.capture!;
      // A fresh job restarts segment numbering; keep nothing from a previous partial run.
      await ctx.saveCapture(sessionId, { ...latest, jobId, segmentsDone: 0, lines: [], speakers: [], linesStoredLocally: false });
      await transcribeManifest(ctx, sessionId, jobId, manifest, signal, report);
    } catch (e) {
      await fail(ctx, sessionId, e);
      throw e;
    }
  });
}

/** Imports the meeting bot's recording once the call has ended, then transcribes it. */
export function processBotRecording(ctx: CaptureContext, sessionId: string): Promise<void> {
  return captureRunner.run(sessionId, async (signal, report) => {
    try {
      const capture = ctx.getSession(sessionId)?.capture;
      if (!capture?.bot) throw new Error("No meeting bot is attached to this session.");
      report("Downloading the call recording…", 0.05);
      const { jobId, manifest, participants } = await ingestBotRecording(capture.bot.botId);
      const latest = ctx.getSession(sessionId)!.capture!;
      await ctx.saveCapture(sessionId, {
        ...latest,
        jobId,
        segmentsDone: 0,
        lines: [],
        linesStoredLocally: false,
        speakers: [],
        bot: { ...latest.bot!, participants: participants || latest.bot!.participants },
      });
      await transcribeManifest(ctx, sessionId, jobId, manifest, signal, report);
    } catch (e) {
      await fail(ctx, sessionId, e);
      throw e;
    }
  });
}

/** Continues a transcription that was interrupted (reload, network loss), falling back to a full re-run. */
export function resumeProcessing(ctx: CaptureContext, sessionId: string): Promise<void> {
  const capture = ctx.getSession(sessionId)?.capture;
  if (!capture) return Promise.resolve();
  const restart = () => (capture.method === "online" ? processBotRecording(ctx, sessionId) : processRecording(ctx, sessionId));
  if (!capture.jobId || !capture.segmentCount || (capture.segmentsDone || 0) >= capture.segmentCount) return restart();

  return fetch(`/api/capture/jobs/${capture.jobId}/manifest`)
    .then(async (res) => {
      if (!res.ok) return restart();
      const { manifest } = await res.json();
      return captureRunner.run(sessionId, async (signal, report) => {
        try {
          await transcribeManifest(ctx, sessionId, capture.jobId!, manifest, signal, report);
        } catch (e) {
          await fail(ctx, sessionId, e);
          throw e;
        }
      });
    })
    .catch(() => restart());
}

// --- Meeting bot status polling ----------------------------------------------------------------------------

const pollers = new Map<string, number>();

/**
 * Polls the bot until the call ends, mirrors its phase onto the session, and kicks off processing
 * automatically once the recording is available (bot kicked, or last one left in the call).
 */
export function watchBot(ctx: CaptureContext, sessionId: string): () => void {
  if (pollers.has(sessionId)) return () => stopWatchingBot(sessionId);
  const tick = async () => {
    const capture = ctx.getSession(sessionId)?.capture;
    if (!capture?.bot || !["bot_joining", "bot_recording", "bot_finalizing"].includes(capture.status)) {
      stopWatchingBot(sessionId);
      return;
    }
    try {
      const st = await getBotStatus(capture.bot.botId);
      const status: SessionCapture["status"] =
        st.phase === "failed" ? "error" : st.phase === "recording" ? "bot_recording" : st.phase === "joining" ? "bot_joining" : "bot_finalizing";
      const bot = { ...capture.bot, phase: st.phase, providerStatus: st.providerStatus, endReason: st.endReason, participants: st.participants || capture.bot.participants };
      const changed = status !== capture.status || bot.providerStatus !== capture.bot.providerStatus || (bot.participants?.length || 0) !== (capture.bot.participants?.length || 0);
      if (changed) {
        await ctx.saveCapture(sessionId, {
          ...capture,
          status,
          bot,
          error: st.phase === "failed" ? `The recording bot failed: ${st.message || st.endReason || st.providerStatus}` : undefined,
        });
      }
      if (st.phase === "ready" && st.audioReady) {
        stopWatchingBot(sessionId);
        processBotRecording(ctx, sessionId).catch(() => {});
      } else if (st.phase === "failed") {
        stopWatchingBot(sessionId);
      }
    } catch {
      // transient network error; try again next tick
    }
  };
  tick();
  pollers.set(sessionId, window.setInterval(tick, 15_000));
  return () => stopWatchingBot(sessionId);
}

export function stopWatchingBot(sessionId: string) {
  const id = pollers.get(sessionId);
  if (id) window.clearInterval(id);
  pollers.delete(sessionId);
}
