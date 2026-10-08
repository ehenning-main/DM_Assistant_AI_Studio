import React, { useEffect, useRef, useState } from "react";
import { Mic, Video, Upload, ChevronLeft, Loader2, AlertTriangle, CheckCircle2, X, HardDrive, Link2 } from "lucide-react";
import { Campaign, CampaignPlayer, CaptureMethod, DriveAudioFile } from "../../types";
import { TablePlayersPanel } from "./TablePlayersPanel";
import { listAudioInputs } from "../../services/liveRecorder";
import { detectMeetingPlatform, getBotConfig } from "../../services/captureApi";
import { isRealFirebase } from "../../firebase";
import { GoogleDriveAudioPicker } from "../GoogleDriveAudioPicker";

export interface WizardDetails {
  title: string;
  date: string;
  /** Pre-assigned id, when on-device data (a recording) must reference the session before it's saved. */
  sessionId?: string;
}

interface Props {
  campaign: Campaign;
  defaultTitle: string;
  onUpdatePlayers: (players: CampaignPlayer[]) => Promise<void>;
  onStartLive: (details: WizardDetails, deviceId?: string) => Promise<void>;
  onStartOnline: (details: WizardDetails, meetingUrl: string) => Promise<void>;
  onStartUpload: (details: WizardDetails, source: { file: File } | { driveFile: DriveAudioFile }) => Promise<void>;
  onClose: () => void;
}

const ACCEPTED_UPLOAD = "audio/*,video/*,.m4a,.mp3,.mp4,.wav,.ogg,.webm,.flac,.aac,.mov,.mkv";

export function NewCaptureWizard({ campaign, defaultTitle, onUpdatePlayers, onStartLive, onStartOnline, onStartUpload, onClose }: Props) {
  const [method, setMethod] = useState<CaptureMethod | null>(null);
  const [title, setTitle] = useState(defaultTitle);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  // Online
  const [meetingUrl, setMeetingUrl] = useState("");
  const [botEnabled, setBotEnabled] = useState<boolean | null>(null);
  // Upload
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);

  const players = campaign.players || [];
  const enrolled = players.filter((p) => p.enrollment);
  const platform = detectMeetingPlatform(meetingUrl);
  const details: WizardDetails = { title: title.trim() || defaultTitle, date };

  useEffect(() => {
    if (method === "live") {
      listAudioInputs().then(setDevices).catch(() => setDevices([]));
    }
    if (method === "online" && botEnabled === null) {
      getBotConfig().then((c) => setBotEnabled(c.enabled));
    }
  }, [method, botEnabled]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const methodCards: Array<{ id: CaptureMethod; icon: React.ReactNode; title: string; body: string }> = [
    { id: "live", icon: <Mic className="w-6 h-6" />, title: "Live Session", body: "Everyone at one table. Record with this device's mic or an external mic." },
    { id: "online", icon: <Video className="w-6 h-6" />, title: "Online Session", body: "Google Meet or Zoom. A silent Saga Scribe bot joins the call and records it." },
    { id: "upload", icon: <Upload className="w-6 h-6" />, title: "Upload Session", body: "Already recorded? Upload audio or video (.m4a, .mp3, .mp4…) to process it." },
  ];

  return (
    <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-2xl bg-zinc-950 border border-zinc-800 rounded-t-2xl sm:rounded-xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-850 sticky top-0 bg-zinc-950 z-10">
          {method && (
            <button onClick={() => { setMethod(null); setError(null); }} className="p-1.5 -ml-1.5 text-zinc-400 hover:text-zinc-100 cursor-pointer" aria-label="Back">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className="font-fantasy font-bold text-lg text-zinc-100 flex-1">
            {method ? methodCards.find((m) => m.id === method)!.title : "Capture a session"}
          </h2>
          <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-zinc-200 cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-red-500" aria-label="Session title" placeholder="Session title" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2.5 text-sm text-zinc-100" aria-label="Session date" />
          </div>

          {!method && (
            <div className="grid gap-3">
              <p className="text-sm text-zinc-400">Where is the audio coming from?</p>
              {methodCards.map((m) => (
                <button key={m.id} onClick={() => setMethod(m.id)} className="text-left p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:border-red-500 hover:bg-zinc-900 transition flex gap-4 items-start cursor-pointer">
                  <span className="w-11 h-11 rounded-full bg-red-950/60 text-red-400 flex items-center justify-center shrink-0">{m.icon}</span>
                  <span>
                    <span className="block font-bold text-zinc-100">{m.title}</span>
                    <span className="block text-sm text-zinc-400 mt-0.5">{m.body}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {method === "live" && (
            <div className="space-y-4">
              <TablePlayersPanel campaign={campaign} onUpdatePlayers={onUpdatePlayers} deviceId={deviceId || undefined} compact />
              {players.length === 0 ? (
                <Notice tone="warn">Add the GM and players, then enroll their voices so the transcript can name who said what.</Notice>
              ) : enrolled.length < players.length ? (
                <Notice tone="warn">
                  {players.length - enrolled.length} of {players.length} voices aren't enrolled.
                  {enrolled.length === 0 ? " Without enrollment you'll name speakers by hand after the session." : " Their lines will show as unrecognized voices you can name afterwards."}
                </Notice>
              ) : (
                <Notice tone="ok">All {players.length} voices enrolled. Speakers will be identified automatically.</Notice>
              )}
              {devices.length > 1 && (
                <label className="block text-sm text-zinc-300">
                  Microphone
                  <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2.5 text-sm text-zinc-100">
                    <option value="">Default microphone</option>
                    {devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>)}
                  </select>
                </label>
              )}
              <p className="text-xs text-zinc-500">Place the device in the middle of the table. The screen stays awake while recording, and audio is saved on this device as you go.</p>
              <button onClick={() => run(() => onStartLive(details, deviceId || undefined))} disabled={busy} className="w-full py-5 rounded-xl bg-red-500 hover:bg-red-600 text-zinc-950 font-bold text-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-lg">
                {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <Mic className="w-6 h-6" />} Start Recording
              </button>
            </div>
          )}

          {method === "online" && (
            <div className="space-y-4">
              {botEnabled === false && (
                <Notice tone="warn">
                  Online sessions need a meeting-bot service. Ask whoever hosts this app to set <code className="text-amber-200">RECALL_API_KEY</code>. Until then, record with Zoom/Meet and use Upload Session.
                </Notice>
              )}
              <label className="block text-sm text-zinc-300">
                Meeting invitation link
                <div className="mt-1 relative">
                  <Link2 className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    inputMode="url"
                    placeholder="https://meet.google.com/abc-defg-hij or https://zoom.us/j/…"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded pl-9 pr-3 py-3 text-sm text-zinc-100 focus:outline-none focus:border-red-500"
                  />
                </div>
              </label>
              {meetingUrl && (
                platform ? <Notice tone="ok">{platform === "zoom" ? "Zoom" : "Google Meet"} link detected.</Notice> : <Notice tone="warn">That doesn't look like a Google Meet or Zoom meeting link.</Notice>
              )}
              <p className="text-xs text-zinc-500">
                “SagaScribe-Recorder” will ask to join; admit it from the waiting room. It stays silent, records the call audio, and starts processing automatically when it's removed or everyone else leaves.
              </p>
              <button onClick={() => run(() => onStartOnline(details, meetingUrl.trim()))} disabled={busy || !platform || botEnabled === false} className="w-full py-4 rounded-xl bg-red-500 hover:bg-red-600 text-zinc-950 font-bold text-base flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Video className="w-5 h-5" />} Send Saga Scribe Bot
              </button>
            </div>
          )}

          {method === "upload" && (
            <div className="space-y-4">
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_UPLOAD}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) run(() => onStartUpload(details, { file }));
                }}
              />
              <button onClick={() => fileRef.current?.click()} disabled={busy} className="w-full py-8 rounded-xl border-2 border-dashed border-zinc-700 hover:border-red-500 text-zinc-300 flex flex-col items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
                {busy ? <Loader2 className="w-7 h-7 animate-spin" /> : <Upload className="w-7 h-7" />}
                <span className="font-semibold">Choose an audio or video file</span>
                <span className="text-xs text-zinc-500">From this device, or iCloud / Files / Drive via your phone's file picker</span>
              </button>
              {isRealFirebase && (
                <button onClick={() => setDrivePickerOpen(true)} disabled={busy} className="w-full py-3 rounded-lg border border-zinc-700 text-sm text-zinc-200 flex items-center justify-center gap-2 cursor-pointer hover:border-zinc-500">
                  <HardDrive className="w-4 h-4" /> Pick from Google Drive
                </button>
              )}
              <p className="text-xs text-zinc-500">Video files are fine: only the audio track is used. You'll match speakers to players once the transcript is ready.</p>
              <GoogleDriveAudioPicker
                isOpen={drivePickerOpen}
                onClose={() => setDrivePickerOpen(false)}
                onSelectDriveFiles={(files) => {
                  setDrivePickerOpen(false);
                  if (files[0]) run(() => onStartUpload(details, { driveFile: files[0] }));
                }}
              />
            </div>
          )}

          {error && <Notice tone="error">{error}</Notice>}
        </div>
      </div>
    </div>
  );
}

function Notice({ tone, children }: { tone: "ok" | "warn" | "error"; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-950/30 border-emerald-900/60 text-emerald-200"
      : tone === "warn"
      ? "bg-amber-950/30 border-amber-900/60 text-amber-200"
      : "bg-red-950/40 border-red-900/60 text-red-200";
  const Icon = tone === "ok" ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`p-3 rounded-lg border text-sm flex gap-2 ${cls}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
