import React, { useEffect, useMemo, useState } from "react";
import { Plus, Mic, Video, Upload, ChevronLeft, Circle, CheckCircle2, AlertTriangle, Tags, Loader2 } from "lucide-react";
import { Campaign, CampaignPlayer, DriveAudioFile, Session, SessionCapture } from "../../types";
import { liveRecorder, extensionForMime } from "../../services/liveRecorder";
import { CaptureContext, processRecording, captureRunner } from "../../services/capturePipeline";
import { dispatchBot } from "../../services/captureApi";
import { saveRecording, requestPersistentStorage } from "../../services/localAudioStore";
import { downloadDriveAudioFile } from "../../services/googleDriveService";
import { formatClock } from "../../services/transcriptFormat";
import { NewCaptureWizard, WizardDetails } from "./NewCaptureWizard";
import { CaptureSessionDetail, useLiveRecorder } from "./CaptureSessionDetail";
import { TablePlayersPanel } from "./TablePlayersPanel";

interface Props {
  campaign: Campaign;
  sessions: Session[];
  ctx: CaptureContext;
  createSession: (details: WizardDetails, capture: SessionCapture) => Promise<Session>;
  onUpdatePlayers: (players: CampaignPlayer[]) => Promise<void>;
  onOpenInChronicle: (sessionId: string) => void;
}

const METHOD_ICON = { live: Mic, online: Video, upload: Upload } as const;

function emptyCapture(method: SessionCapture["method"], diarization: SessionCapture["diarization"], status: SessionCapture["status"]): SessionCapture {
  return { method, diarization, status, startedAt: new Date().toISOString(), speakers: [], lines: [] };
}

export function SessionCaptureHub({ campaign, sessions, ctx, createSession, onUpdatePlayers, onOpenInChronicle }: Props) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const live = useLiveRecorder();

  const captured = useMemo(
    () => sessions.filter((s) => s.capture).sort((a, b) => String(b.capture!.startedAt).localeCompare(String(a.capture!.startedAt))),
    [sessions]
  );
  const selected = selectedId ? sessions.find((s) => s.id === selectedId && s.capture) : undefined;

  // Jump straight to the live recording when returning to this tab mid-session.
  useEffect(() => {
    if (live.sessionId && live.phase !== "idle" && sessions.some((s) => s.id === live.sessionId)) setSelectedId(live.sessionId);
  }, [live.sessionId]);

  const defaultTitle = `Session ${sessions.length + 1}`;

  async function startLive(details: WizardDetails, deviceId?: string) {
    const enrolledCount = (campaign.players || []).filter((p) => p.enrollment).length;
    const sessionId = `session-${Date.now()}`;
    await liveRecorder.start(sessionId, deviceId);
    const st = liveRecorder.getState();
    try {
      const capture: SessionCapture = {
        ...emptyCapture("live", enrolledCount > 0 ? "enrolled" : "anonymous", "recording"),
        recordingId: st.recordingId,
        recordingMimeType: st.mimeType,
      };
      const session = await createSession({ ...details, sessionId }, capture);
      setWizardOpen(false);
      setSelectedId(session.id);
    } catch (e) {
      await liveRecorder.discard();
      throw e;
    }
  }

  async function startOnline(details: WizardDetails, meetingUrl: string) {
    const bot = await dispatchBot(meetingUrl);
    const capture: SessionCapture = {
      ...emptyCapture("online", "anonymous", bot.phase === "recording" ? "bot_recording" : "bot_joining"),
      bot: { provider: "recall", botId: bot.botId, meetingUrl, platform: bot.platform || "google_meet", phase: bot.phase, providerStatus: bot.providerStatus },
    };
    const session = await createSession(details, capture);
    setWizardOpen(false);
    setSelectedId(session.id);
  }

  async function startUpload(details: WizardDetails, source: { file: File } | { driveFile: DriveAudioFile }) {
    await requestPersistentStorage();
    let blob: Blob;
    let fileName: string;
    if ("file" in source) {
      blob = source.file;
      fileName = source.file.name;
    } else {
      const res = await downloadDriveAudioFile(source.driveFile.id);
      blob = res.blob;
      fileName = source.driveFile.name || `drive-recording.${extensionForMime(res.mimeType)}`;
    }
    const sessionId = `session-${Date.now()}`;
    const recordingId = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // Keep the original on-device so it can be played back with the transcript, re-processed, or backed up.
    await saveRecording({ id: recordingId, sessionId, fileName, mimeType: blob.type || "application/octet-stream", blob, createdAt: new Date().toISOString() });
    const capture: SessionCapture = {
      ...emptyCapture("upload", "anonymous", "uploading"),
      recordingId,
      recordingFileName: fileName,
      recordingMimeType: blob.type,
      recordingBytes: blob.size,
    };
    const session = await createSession({ ...details, sessionId }, capture);
    setWizardOpen(false);
    setSelectedId(session.id);
    processRecording(ctx, session.id).catch(() => {});
  }

  if (selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedId(null)} className="text-sm text-zinc-400 hover:text-zinc-100 flex items-center gap-1 cursor-pointer">
          <ChevronLeft className="w-4 h-4" /> All recordings
        </button>
        <CaptureSessionDetail session={selected} campaign={campaign} ctx={ctx} onUpdatePlayers={onUpdatePlayers} onOpenInChronicle={onOpenInChronicle} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="font-fantasy text-xl font-bold text-zinc-100">Session capture</h2>
          <p className="text-sm text-zinc-500">Record at the table, send a bot to an online game, or upload a recording. Get a transcript that knows who said what.</p>
        </div>
        <button
          onClick={() => setWizardOpen(true)}
          disabled={liveRecorder.isActive()}
          className="px-4 py-3 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-50 text-zinc-950 font-bold text-sm flex items-center gap-2 cursor-pointer shadow"
        >
          <Plus className="w-4 h-4" /> New session
        </button>
      </div>

      {live.phase !== "idle" && live.sessionId && (
        <button onClick={() => setSelectedId(live.sessionId!)} className="w-full p-4 rounded-lg bg-red-950/40 border border-red-800 flex items-center gap-3 text-left cursor-pointer">
          <Circle className="w-3 h-3 fill-red-500 text-red-500 animate-pulse" />
          <span className="font-semibold text-red-200">Recording in progress</span>
          <span className="ml-auto font-mono text-red-200">{formatClock(live.elapsedSec)}</span>
        </button>
      )}

      <TablePlayersPanel campaign={campaign} onUpdatePlayers={onUpdatePlayers} />

      <div className="space-y-2">
        <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Recordings &amp; transcripts</h3>
        {captured.length === 0 && (
          <p className="p-6 text-center text-sm text-zinc-500 border border-dashed border-zinc-800 rounded-lg">No captured sessions yet. Tap “New session” to start.</p>
        )}
        <ul className="space-y-2">
          {captured.map((s) => {
            const c = s.capture!;
            const Icon = METHOD_ICON[c.method];
            const running = captureRunner.isRunning(s.id) || (live.sessionId === s.id && live.phase !== "idle");
            return (
              <li key={s.id}>
                <button onClick={() => setSelectedId(s.id)} className="w-full p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-zinc-600 flex items-center gap-3 text-left cursor-pointer">
                  <span className="w-10 h-10 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-zinc-100 truncate">{s.title}</span>
                    <span className="block text-xs text-zinc-500">
                      {s.date}
                      {c.durationSec ? ` · ${formatClock(c.durationSec)}` : ""}
                      {c.lines.length ? ` · ${c.lines.length} lines` : ""}
                    </span>
                  </span>
                  <StatusPill capture={c} running={running} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {wizardOpen && (
        <NewCaptureWizard
          campaign={campaign}
          defaultTitle={defaultTitle}
          onUpdatePlayers={onUpdatePlayers}
          onStartLive={startLive}
          onStartOnline={startOnline}
          onStartUpload={startUpload}
          onClose={() => setWizardOpen(false)}
        />
      )}
    </div>
  );
}

function StatusPill({ capture, running }: { capture: SessionCapture; running: boolean }) {
  if (capture.status === "complete") return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" aria-label="Transcript ready" />;
  if (capture.status === "needs_tagging")
    return (
      <span className="px-2 py-1 rounded-full bg-purple-950 text-purple-300 text-[11px] font-semibold flex items-center gap-1 shrink-0">
        <Tags className="w-3 h-3" /> Name speakers
      </span>
    );
  if (capture.status === "error") return <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" aria-label="Needs attention" />;
  if (running || capture.status.startsWith("bot_")) return <Loader2 className="w-5 h-5 text-zinc-400 animate-spin shrink-0" aria-label="In progress" />;
  return <span className="text-[11px] text-amber-300 shrink-0">Paused</span>;
}

