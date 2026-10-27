// Live table recorder (Method A). A module-level singleton rather than component state, so a multi-hour
// recording keeps going while the GM navigates around the app. Audio is flushed to IndexedDB every few
// seconds; if the tab crashes, the chunks can be recovered into a recording on next launch.

import {
  appendRecordingChunk,
  readRecordingChunks,
  clearRecordingChunks,
  saveRecording,
  requestPersistentStorage,
  StoredRecording,
} from "./localAudioStore";

export type LiveRecorderPhase = "idle" | "starting" | "recording" | "paused" | "finalizing";

export interface LiveRecorderState {
  phase: LiveRecorderPhase;
  sessionId?: string;
  recordingId?: string;
  mimeType?: string;
  fileExtension?: string;
  startedAt?: number;
  elapsedSec: number;
  level: number;
  bytesWritten: number;
  error?: string;
  deviceLabel?: string;
}

const CHUNK_INTERVAL_MS = 5000;

// m4a first (what iOS/Safari and recent Chrome produce, and what the GM asked for), then Opus fallbacks.
const MIME_CANDIDATES: Array<{ mime: string; ext: string }> = [
  { mime: "audio/mp4;codecs=mp4a.40.2", ext: "m4a" },
  { mime: "audio/mp4", ext: "m4a" },
  { mime: "audio/webm;codecs=opus", ext: "webm" },
  { mime: "audio/webm", ext: "webm" },
  { mime: "audio/ogg;codecs=opus", ext: "ogg" },
];

export function pickRecordingFormat(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const c of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(c.mime)) return c;
    } catch {
      // continue
    }
  }
  return { mime: "", ext: "webm" };
}

export function extensionForMime(mime: string): string {
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

/** Raw-ish capture: browser voice processing is tuned for one person on a call and eats quieter voices across a table. */
export function tableMicConstraints(deviceId?: string): MediaTrackConstraints {
  return {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 48000,
  };
}

export async function listAudioInputs(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "audioinput");
}

/** Attaches an analyser to a stream and reports a smoothed 0..1 input level until the returned stop() is called. */
export function startLevelMeter(stream: MediaStream, onLevel: (level: number) => void): () => void {
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return () => {};
  const ctx: AudioContext = new Ctx();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  let raf = 0;
  let smoothed = 0;
  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    smoothed = Math.max(rms * 4, smoothed * 0.85);
    onLevel(Math.min(1, smoothed));
    raf = requestAnimationFrame(tick);
  };
  tick();
  return () => {
    cancelAnimationFrame(raf);
    source.disconnect();
    ctx.close().catch(() => {});
  };
}

type Listener = (s: LiveRecorderState) => void;

class LiveRecorder {
  private state: LiveRecorderState = { phase: "idle", elapsedSec: 0, level: 0, bytesWritten: 0 };
  private listeners = new Set<Listener>();
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private stopMeter: (() => void) | null = null;
  private timer: number | null = null;
  private seq = 0;
  private pendingWrites: Promise<void>[] = [];
  private wakeLock: any = null;
  private accumulatedMs = 0;
  private segmentStartedAt = 0;

  getState(): LiveRecorderState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<LiveRecorderState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  isActive(): boolean {
    return this.state.phase === "recording" || this.state.phase === "paused" || this.state.phase === "starting";
  }

  async start(sessionId: string, deviceId?: string): Promise<void> {
    if (this.isActive()) throw new Error("A recording is already in progress.");
    const format = pickRecordingFormat();
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser cannot record audio. Try Chrome, Safari, or Firefox on a recent version.");
    }
    this.set({ phase: "starting", error: undefined, sessionId, elapsedSec: 0, bytesWritten: 0, level: 0 });
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: tableMicConstraints(deviceId) });
    } catch (e: any) {
      this.set({ phase: "idle", error: e?.name === "NotAllowedError" ? "Microphone permission was denied." : e?.message || "Could not open the microphone." });
      throw e;
    }
    await requestPersistentStorage();

    const recordingId = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const recorder = format.mime ? new MediaRecorder(this.stream, { mimeType: format.mime, audioBitsPerSecond: 96000 }) : new MediaRecorder(this.stream);
    const mimeType = recorder.mimeType || format.mime || "audio/webm";
    this.recorder = recorder;
    this.seq = 0;
    this.pendingWrites = [];

    recorder.ondataavailable = (ev) => {
      if (!ev.data || ev.data.size === 0) return;
      const seq = this.seq++;
      const write = appendRecordingChunk(recordingId, seq, ev.data)
        .then(() => this.set({ bytesWritten: this.state.bytesWritten + ev.data.size }))
        .catch((err) => this.set({ error: `Could not save audio to this device: ${err?.message || err}. Free up storage space.` }));
      this.pendingWrites.push(write);
    };

    this.stopMeter = startLevelMeter(this.stream, (level) => {
      if (Math.abs(level - this.state.level) > 0.02) this.set({ level });
    });

    recorder.start(CHUNK_INTERVAL_MS);
    this.accumulatedMs = 0;
    this.segmentStartedAt = Date.now();
    this.timer = window.setInterval(() => this.set({ elapsedSec: this.elapsed() }), 500);
    window.addEventListener("beforeunload", this.onBeforeUnload);
    document.addEventListener("visibilitychange", this.onVisibility);
    await this.acquireWakeLock();

    const track = this.stream.getAudioTracks()[0];
    this.set({
      phase: "recording",
      recordingId,
      mimeType,
      fileExtension: extensionForMime(mimeType),
      startedAt: Date.now(),
      deviceLabel: track?.label || "Microphone",
    });
  }

  private elapsed(): number {
    const running = this.state.phase === "recording" ? Date.now() - this.segmentStartedAt : 0;
    return Math.floor((this.accumulatedMs + running) / 1000);
  }

  pause() {
    if (this.recorder?.state === "recording") {
      this.recorder.pause();
      this.accumulatedMs += Date.now() - this.segmentStartedAt;
      this.set({ phase: "paused", level: 0 });
    }
  }

  resume() {
    if (this.recorder?.state === "paused") {
      this.recorder.resume();
      this.segmentStartedAt = Date.now();
      this.set({ phase: "recording" });
    }
  }

  /** Stops capture and assembles the on-device recording file. */
  async stop(): Promise<{ recording: StoredRecording; durationSec: number }> {
    const recorder = this.recorder;
    const { recordingId, sessionId, mimeType, fileExtension, startedAt } = this.state;
    if (!recorder || !recordingId || !sessionId) throw new Error("Nothing is being recorded.");
    const durationSec = this.elapsed();
    this.set({ phase: "finalizing", elapsedSec: durationSec });

    await new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });
    await Promise.all(this.pendingWrites);
    this.teardown();

    const chunks = await readRecordingChunks(recordingId);
    const stamp = new Date(startedAt || Date.now());
    const fileName = `Session_${stamp.toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${fileExtension || "webm"}`;
    const recording: StoredRecording = {
      id: recordingId,
      sessionId,
      fileName,
      mimeType: (mimeType || "audio/webm").split(";")[0],
      blob: new Blob(chunks, { type: (mimeType || "audio/webm").split(";")[0] }),
      createdAt: new Date().toISOString(),
    };
    await saveRecording(recording);
    await clearRecordingChunks(recordingId);
    this.set({ phase: "idle", level: 0, recordingId: undefined, sessionId: undefined });
    return { recording, durationSec };
  }

  /** Abandons the current take without saving it. */
  async discard(): Promise<void> {
    const { recordingId } = this.state;
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.ondataavailable = null;
      this.recorder.stop();
    }
    await Promise.all(this.pendingWrites);
    this.teardown();
    if (recordingId) await clearRecordingChunks(recordingId);
    this.set({ phase: "idle", level: 0, elapsedSec: 0, recordingId: undefined, sessionId: undefined });
  }

  private teardown() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    this.stopMeter?.();
    this.stopMeter = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    window.removeEventListener("beforeunload", this.onBeforeUnload);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.wakeLock?.release?.().catch?.(() => {});
    this.wakeLock = null;
  }

  private async acquireWakeLock() {
    try {
      this.wakeLock = await (navigator as any).wakeLock?.request?.("screen");
    } catch {
      this.wakeLock = null;
    }
  }

  // The OS drops screen wake locks when the page is hidden; re-acquire on return.
  private onVisibility = () => {
    if (document.visibilityState === "visible" && this.isActive()) this.acquireWakeLock();
  };

  private onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (this.isActive()) {
      e.preventDefault();
      e.returnValue = "A session recording is in progress.";
    }
  };
}

export const liveRecorder = new LiveRecorder();

/** Rebuilds a recording from chunks left behind by a crashed or closed tab. */
export async function recoverOrphanedRecording(recordingId: string, sessionId: string, mimeType = "audio/webm"): Promise<StoredRecording | null> {
  const chunks = await readRecordingChunks(recordingId);
  if (chunks.length === 0) return null;
  const type = chunks[0].type || mimeType;
  const recording: StoredRecording = {
    id: recordingId,
    sessionId,
    fileName: `Recovered_${recordingId}.${extensionForMime(type)}`,
    mimeType: type.split(";")[0],
    blob: new Blob(chunks, { type: type.split(";")[0] }),
    createdAt: new Date().toISOString(),
  };
  await saveRecording(recording);
  await clearRecordingChunks(recordingId);
  return recording;
}
