import React, { useEffect, useRef, useState } from "react";
import { Mic, Square, Play, RotateCcw, Check, X, Loader2, ChevronRight } from "lucide-react";
import { CampaignPlayer } from "../../types";
import { pickRecordingFormat, startLevelMeter, tableMicConstraints } from "../../services/liveRecorder";
import { blobToBase64, saveClip } from "../../services/localAudioStore";
import { transcodeClip } from "../../services/captureApi";

// Short, varied passages: a mix of narration, in-character speech and table talk gives the voiceprint
// the same range of delivery the transcriber will hear during play.
const ENROLLMENT_SENTENCES = [
  "The torchlight flickers across the ancient stone door, and a cold draft carries the smell of damp earth.",
  "I draw my sword, step in front of the others, and shout: stand back, I'll handle this!",
  "Wait, do I get advantage on that roll, or was that only for the first attack this round?",
  "Twelve gold pieces, a silver ring, and a map marked with three red circles near the northern pass.",
  "Let's take a short rest before we open the vault. I want my spell slots back first.",
];

const MIN_SECONDS = 8;
const MAX_SECONDS = 60;

interface Props {
  players: CampaignPlayer[];
  deviceId?: string;
  onEnrolled: (playerId: string, enrollment: NonNullable<CampaignPlayer["enrollment"]>) => Promise<void> | void;
  onClose: () => void;
}

type Phase = "ready" | "recording" | "review" | "saving";

export function VoiceEnrollmentModal({ players, deviceId, onEnrolled, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [take, setTake] = useState<Blob | null>(null);
  const [takeUrl, setTakeUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopMeterRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedRef = useRef(0);

  const player = players[index];

  useEffect(() => () => cleanup(), []);
  useEffect(() => () => {
    if (takeUrl) URL.revokeObjectURL(takeUrl);
  }, [takeUrl]);

  function cleanup() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    stopMeterRef.current?.();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    recorderRef.current = null;
    streamRef.current = null;
  }

  async function startTake() {
    setError(null);
    try {
      const format = pickRecordingFormat();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: tableMicConstraints(deviceId) });
      streamRef.current = stream;
      const rec = format?.mime ? new MediaRecorder(stream, { mimeType: format.mime }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: (rec.mimeType || "audio/webm").split(";")[0] });
        setTake(blob);
        setTakeUrl(URL.createObjectURL(blob));
        setPhase("review");
      };
      recorderRef.current = rec;
      stopMeterRef.current = startLevelMeter(stream, setLevel);
      rec.start();
      startedRef.current = Date.now();
      setSeconds(0);
      setPhase("recording");
      timerRef.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - startedRef.current) / 1000);
        setSeconds(s);
        if (s >= MAX_SECONDS) stopTake();
      }, 250);
    } catch (e: any) {
      setError(e?.name === "NotAllowedError" ? "Microphone permission was denied. Allow microphone access and try again." : e?.message || "Could not open the microphone.");
      cleanup();
    }
  }

  function stopTake() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    stopMeterRef.current?.();
    stopMeterRef.current = null;
    setLevel(0);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  function retake() {
    setTake(null);
    setTakeUrl(null);
    setPhase("ready");
  }

  async function acceptTake() {
    if (!take || !player) return;
    if (seconds < MIN_SECONDS) {
      setError(`Please read for at least ${MIN_SECONDS} seconds so the voice can be recognized reliably.`);
      return;
    }
    setPhase("saving");
    setError(null);
    try {
      const { audioBase64, mimeType } = await transcodeClip(await blobToBase64(take));
      const clipId = `enroll_${player.id}`;
      await saveClip({ id: clipId, audioBase64, mimeType, createdAt: new Date().toISOString() });
      await onEnrolled(player.id, { clipId, recordedAt: new Date().toISOString(), durationSec: seconds });
      if (index + 1 < players.length) {
        setIndex(index + 1);
        retake();
      } else {
        onClose();
      }
    } catch (e: any) {
      setError(`Could not save this voice sample: ${e?.message || e}`);
      setPhase("review");
    }
  }

  if (!player) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-lg bg-zinc-950 border border-zinc-800 rounded-t-2xl sm:rounded-xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-850">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">
              Voice enrollment · {index + 1} of {players.length}
            </p>
            <h3 className="font-fantasy text-lg font-bold text-zinc-100">
              {player.role === "GM" ? `${player.name} (Game Master)` : player.name}
              {player.characterName && <span className="text-red-400 text-sm font-sans font-normal"> · {player.characterName}</span>}
            </h3>
          </div>
          <button onClick={() => { cleanup(); onClose(); }} className="p-2 text-zinc-500 hover:text-zinc-200 cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-zinc-400">
            Hand the device to <strong className="text-zinc-200">{player.name}</strong>. Hold it about where it will sit during the game,
            then read these lines aloud in a normal speaking voice.
          </p>

          <ol className="space-y-2.5 bg-zinc-900/60 border border-zinc-850 rounded-lg p-4">
            {ENROLLMENT_SENTENCES.map((s, i) => (
              <li key={i} className="text-[15px] leading-relaxed text-zinc-200 flex gap-2">
                <span className="text-red-500 font-mono text-xs pt-1">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-zinc-900 rounded overflow-hidden" aria-hidden>
              <div className="h-full bg-red-500 transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
            <span className="font-mono text-sm text-zinc-300 w-12 text-right">0:{String(seconds).padStart(2, "0")}</span>
          </div>

          {error && <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded p-2.5">{error}</p>}

          {phase === "ready" && (
            <button onClick={startTake} className="w-full py-4 rounded-lg bg-red-500 hover:bg-red-600 text-zinc-950 font-bold text-base flex items-center justify-center gap-2 cursor-pointer">
              <Mic className="w-5 h-5" /> Start reading
            </button>
          )}
          {phase === "recording" && (
            <button onClick={stopTake} className="w-full py-4 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-base flex items-center justify-center gap-2 cursor-pointer">
              <Square className="w-5 h-5" /> Done {seconds < MIN_SECONDS && <span className="text-xs font-normal">(keep going: {MIN_SECONDS - seconds}s)</span>}
            </button>
          )}
          {(phase === "review" || phase === "saving") && (
            <div className="space-y-3">
              {takeUrl && <audio src={takeUrl} controls className="w-full" />}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={retake} disabled={phase === "saving"} className="py-3 rounded-lg border border-zinc-700 text-zinc-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                  <RotateCcw className="w-4 h-4" /> Re-record
                </button>
                <button onClick={acceptTake} disabled={phase === "saving"} className="py-3 rounded-lg bg-red-500 hover:bg-red-600 text-zinc-950 font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
                  {phase === "saving" ? <Loader2 className="w-4 h-4 animate-spin" /> : index + 1 < players.length ? <ChevronRight className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  {index + 1 < players.length ? "Save & next" : "Save"}
                </button>
              </div>
            </div>
          )}

          {players.length > 1 && phase === "ready" && (
            <button onClick={() => (index + 1 < players.length ? setIndex(index + 1) : onClose())} className="w-full text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer flex items-center justify-center gap-1">
              <Play className="w-3 h-3" /> Skip {player.name} for now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
