import React, { useEffect, useState } from "react";
import { Loader2, Pause, Play, Square, Trash2, RefreshCw, AlertTriangle, Bot, Users, BookOpen, Tags, LifeBuoy } from "lucide-react";
import { Campaign, CampaignPlayer, CloudBackupRecord, Session, SessionCapture, TranscriptLine } from "../../types";
import { liveRecorder, LiveRecorderState, recoverOrphanedRecording } from "../../services/liveRecorder";
import { CaptureContext, captureRunner, processRecording, resumeProcessing, RunnerJobState, watchBot } from "../../services/capturePipeline";
import { rememberSpeakerAssignments } from "../../services/captureProcessor";
import { removeBot } from "../../services/captureApi";
import { getLocalTranscript } from "../../services/localAudioStore";
import { formatClock } from "../../services/transcriptFormat";
import { SpeakerTaggingPanel } from "./SpeakerTaggingPanel";
import { TranscriptView } from "./TranscriptView";

interface Props {
  session: Session;
  campaign: Campaign;
  ctx: CaptureContext;
  onUpdatePlayers: (players: CampaignPlayer[]) => Promise<void>;
  onOpenInChronicle: (sessionId: string) => void;
}

const STATUS_TEXT: Record<SessionCapture["status"], string> = {
  recording: "Recording",
  bot_joining: "Bot is joining the call",
  bot_recording: "Bot is recording the call",
  bot_finalizing: "Call ended, preparing recording",
  uploading: "Uploading audio",
  transcribing: "Transcribing",
  needs_tagging: "Name the speakers",
  complete: "Transcript ready",
  error: "Needs attention",
};

export function useLiveRecorder(): LiveRecorderState {
  const [s, setS] = useState(liveRecorder.getState());
  useEffect(() => liveRecorder.subscribe(setS), []);
  return s;
}

export function useRunnerJob(sessionId: string): RunnerJobState | undefined {
  const [job, setJob] = useState(captureRunner.get(sessionId));
  useEffect(() => captureRunner.subscribe((jobs) => setJob(jobs.get(sessionId))), [sessionId]);
  return job;
}

export function CaptureSessionDetail({ session, campaign, ctx, onUpdatePlayers, onOpenInChronicle }: Props) {
  const capture = session.capture!;
  const players = campaign.players || [];
  const live = useLiveRecorder();
  const job = useRunnerJob(session.id);
  const [lines, setLines] = useState<TranscriptLine[]>(capture.lines);
  const [editingSpeakers, setEditingSpeakers] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);

  const isThisLive = live.sessionId === session.id && live.phase !== "idle";
  const running = !!job?.running;

  useEffect(() => {
    if (capture.linesStoredLocally) {
      getLocalTranscript(session.id).then((l) => setLines(l || [])).catch(() => setLines([]));
    } else {
      setLines(capture.lines);
    }
  }, [session.id, capture.lines, capture.linesStoredLocally]);

  // Keep following the meeting bot while this session is waiting on the call.
  useEffect(() => {
    if (capture.bot && ["bot_joining", "bot_recording", "bot_finalizing"].includes(capture.status)) {
      return watchBot(ctx, session.id);
    }
  }, [capture.bot?.botId, capture.status, session.id]);

  async function stopLive() {
    setStopping(true);
    setActionError(null);
    try {
      const { recording, durationSec } = await liveRecorder.stop();
      await ctx.saveCapture(session.id, {
        ...capture,
        status: "uploading",
        recordingId: recording.id,
        recordingFileName: recording.fileName,
        recordingMimeType: recording.mimeType,
        recordingBytes: recording.blob.size,
        durationSec,
      });
      processRecording(ctx, session.id).catch(() => {});
    } catch (e: any) {
      setActionError(e?.message || String(e));
    } finally {
      setStopping(false);
    }
  }

  async function discardLive() {
    if (!window.confirm("Discard this recording? The audio captured so far will be deleted.")) return;
    await liveRecorder.discard();
    await ctx.saveCapture(session.id, { ...capture, status: "error", error: "Recording was discarded." });
  }

  async function recoverInterrupted() {
    setActionError(null);
    try {
      if (!capture.recordingId) throw new Error("No recording id on this session.");
      const rec = await recoverOrphanedRecording(capture.recordingId, session.id, capture.recordingMimeType);
      if (!rec) throw new Error("No audio from the interrupted recording was found on this device.");
      await ctx.saveCapture(session.id, {
        ...capture,
        status: "uploading",
        recordingFileName: rec.fileName,
        recordingMimeType: rec.mimeType,
        recordingBytes: rec.blob.size,
      });
      processRecording(ctx, session.id).catch(() => {});
    } catch (e: any) {
      setActionError(e?.message || String(e));
    }
  }

  async function endBot() {
    if (!capture.bot) return;
    setActionError(null);
    try {
      await removeBot(capture.bot.botId);
    } catch (e: any) {
      setActionError(e?.message || String(e));
    }
  }

  async function applyAssignments(assignments: Record<string, string | null>) {
    const latest = ctx.getSession(session.id)?.capture || capture;
    const speakers = latest.speakers.map((s) => (s.key in assignments ? { ...s, playerId: assignments[s.key] } : s));
    const updated: SessionCapture = { ...latest, speakers, status: "complete" };
    await ctx.saveCapture(session.id, updated);
    const learned = await rememberSpeakerAssignments(session.id, { ...updated, lines }, players);
    await onUpdatePlayers(learned);
    setEditingSpeakers(false);
  }

  async function recordBackup(record: CloudBackupRecord) {
    const latest = ctx.getSession(session.id)?.capture || capture;
    await ctx.saveCapture(session.id, { ...latest, backups: [...(latest.backups || []), record] });
  }

  const interrupted =
    !running && !isThisLive && (capture.status === "uploading" || capture.status === "transcribing" || capture.status === "recording");
  const progress = job?.running ? job.fraction : capture.segmentCount ? (capture.segmentsDone || 0) / capture.segmentCount : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="font-fantasy text-xl font-bold text-zinc-100 truncate">{session.title}</h2>
          <p className="text-xs text-zinc-500">
            {session.date} · {capture.method === "live" ? "Live table" : capture.method === "online" ? `Online (${capture.bot?.platform === "zoom" ? "Zoom" : "Google Meet"})` : "Upload"}
            {capture.durationSec ? ` · ${formatClock(capture.durationSec)}` : ""}
            {capture.diarization === "enrolled" ? " · voice-enrolled" : ""}
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${capture.status === "complete" ? "bg-emerald-950 text-emerald-300" : capture.status === "error" ? "bg-red-950 text-red-300" : capture.status === "needs_tagging" ? "bg-purple-950 text-purple-300" : "bg-zinc-800 text-zinc-300"}`}>
          {STATUS_TEXT[capture.status]}
        </span>
      </div>

      {isThisLive && (
        <div className="p-5 rounded-xl bg-zinc-900 border border-red-900/60 space-y-4">
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${live.phase === "recording" ? "bg-red-500 animate-pulse" : "bg-zinc-500"}`} />
            <span className="font-mono text-4xl font-bold text-zinc-100 tabular-nums">{formatClock(live.elapsedSec)}</span>
            <span className="ml-auto text-xs text-zinc-500 truncate max-w-[40%]">{live.deviceLabel}</span>
          </div>
          <div className="h-3 bg-zinc-950 rounded overflow-hidden" aria-label="Input level">
            <div className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 transition-[width] duration-75" style={{ width: `${Math.round(live.level * 100)}%` }} />
          </div>
          <p className="text-xs text-zinc-500">{live.bytesWritten < 1024 * 1024 ? `${Math.round(live.bytesWritten / 1024)} KB` : `${(live.bytesWritten / 1024 / 1024).toFixed(1)} MB`} saved on this device · {live.fileExtension?.toUpperCase()}</p>
          {live.error && <p className="text-sm text-red-400">{live.error}</p>}
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            {live.phase === "paused" ? (
              <button onClick={() => liveRecorder.resume()} className="py-4 rounded-lg border border-zinc-700 text-zinc-100 font-semibold flex items-center justify-center gap-2 cursor-pointer">
                <Play className="w-5 h-5" /> Resume
              </button>
            ) : (
              <button onClick={() => liveRecorder.pause()} disabled={live.phase !== "recording"} className="py-4 rounded-lg border border-zinc-700 text-zinc-100 font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                <Pause className="w-5 h-5" /> Break
              </button>
            )}
            <button onClick={stopLive} disabled={stopping || live.phase === "finalizing"} className="py-4 rounded-lg bg-red-500 hover:bg-red-600 text-zinc-950 font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
              {stopping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5" />} End session &amp; transcribe
            </button>
          </div>
          <button onClick={discardLive} className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1 cursor-pointer">
            <Trash2 className="w-3 h-3" /> Discard recording
          </button>
        </div>
      )}

      {capture.status === "recording" && !isThisLive && (
        <div className="p-4 rounded-lg bg-amber-950/30 border border-amber-900/60 text-sm text-amber-200 space-y-2">
          <p className="flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> This recording was interrupted (the app was closed or reloaded while recording).</p>
          <button onClick={recoverInterrupted} className="px-3 py-2 rounded bg-amber-500 text-zinc-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer">
            <LifeBuoy className="w-3.5 h-3.5" /> Recover audio &amp; transcribe
          </button>
        </div>
      )}

      {capture.bot && ["bot_joining", "bot_recording", "bot_finalizing"].includes(capture.status) && (
        <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 space-y-3">
          <div className="flex items-center gap-2 text-zinc-200">
            <Bot className="w-5 h-5 text-red-400" />
            <span className="font-semibold">{STATUS_TEXT[capture.status]}</span>
            {capture.status !== "bot_finalizing" && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
          </div>
          {capture.status === "bot_joining" && <p className="text-sm text-zinc-400">Admit “SagaScribe-Recorder” from the meeting's waiting room.</p>}
          {capture.status === "bot_recording" && <p className="text-sm text-zinc-400">Play as normal. Processing starts automatically when you remove the bot or everyone leaves the call.</p>}
          {!!capture.bot.participants?.length && (
            <p className="text-xs text-zinc-500 flex items-center gap-1"><Users className="w-3 h-3" /> In call: {capture.bot.participants.join(", ")}</p>
          )}
          {capture.status !== "bot_finalizing" && (
            <button onClick={endBot} className="px-3 py-2 rounded border border-zinc-700 text-xs text-zinc-200 hover:border-red-500 cursor-pointer">End recording now</button>
          )}
        </div>
      )}

      {(running || ((capture.status === "uploading" || capture.status === "transcribing") && !interrupted)) && (
        <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="flex items-center gap-2 text-sm text-zinc-200">
            <Loader2 className="w-4 h-4 animate-spin text-red-400" />
            <span className="flex-1">{job?.stage || STATUS_TEXT[capture.status]}</span>
            {running && (
              <button onClick={() => captureRunner.cancel(session.id)} className="text-xs text-zinc-500 hover:text-zinc-200 cursor-pointer">Pause</button>
            )}
          </div>
          <div className="h-2 bg-zinc-950 rounded overflow-hidden">
            <div className="h-full bg-red-500 transition-all" style={{ width: `${Math.max(3, Math.round(progress * 100))}%` }} />
          </div>
          <p className="text-xs text-zinc-500">You can keep using the app. Keep this tab open until processing finishes.</p>
        </div>
      )}

      {(interrupted && capture.status !== "recording") || capture.status === "error" ? (
        <div className="p-4 rounded-lg bg-red-950/30 border border-red-900/60 text-sm text-red-200 space-y-2">
          <p className="flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{capture.error || job?.error || "Processing was interrupted."}</p>
          {(capture.recordingId || capture.bot) && (
            <button onClick={() => resumeProcessing(ctx, session.id).catch(() => {})} className="px-3 py-2 rounded bg-red-500 text-zinc-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" /> {capture.segmentsDone ? `Resume (${capture.segmentsDone}/${capture.segmentCount} parts done)` : "Retry"}
            </button>
          )}
        </div>
      ) : null}

      {actionError && <p className="text-sm text-red-400">{actionError}</p>}

      {capture.status === "needs_tagging" && !running && (
        <SpeakerTaggingPanel sessionId={session.id} capture={capture} lines={lines} players={players} onConfirm={applyAssignments} confirmLabel="Apply names & remember" />
      )}

      {capture.status === "complete" && editingSpeakers && (
        <SpeakerTaggingPanel sessionId={session.id} capture={capture} lines={lines} players={players} onConfirm={applyAssignments} onCancel={() => setEditingSpeakers(false)} />
      )}

      {capture.status === "complete" && !editingSpeakers && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setEditingSpeakers(true)} className="px-3 py-2 rounded border border-zinc-700 text-xs text-zinc-200 flex items-center gap-1.5 cursor-pointer hover:border-purple-500">
            <Tags className="w-3.5 h-3.5" /> Fix speaker names
          </button>
          <button onClick={() => onOpenInChronicle(session.id)} className="px-3 py-2 rounded border border-zinc-700 text-xs text-zinc-200 flex items-center gap-1.5 cursor-pointer hover:border-red-500">
            <BookOpen className="w-3.5 h-3.5" /> Open in Chronicle (summaries, notes)
          </button>
        </div>
      )}

      {lines.length > 0 && (
        <TranscriptView session={session} capture={capture} lines={lines} players={players} onBackupRecorded={recordBackup} />
      )}
    </div>
  );
}
