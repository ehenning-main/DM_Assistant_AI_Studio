import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Download, Cloud, Loader2, FileAudio, FileText, Check } from "lucide-react";
import { CampaignPlayer, CloudBackupRecord, Session, SessionCapture, TranscriptLine } from "../../types";
import { buildSpeakerNameMap, formatClock, formatTranscriptMarkdown, formatTranscriptText } from "../../services/transcriptFormat";
import { getRecording } from "../../services/localAudioStore";
import { CloudProvider, downloadBlob, isDriveAvailable, isDropboxAvailable, safeFileName, uploadToCloud } from "../../services/cloudExport";

interface Props {
  session: Session;
  capture: SessionCapture;
  lines: TranscriptLine[];
  players: CampaignPlayer[];
  onBackupRecorded: (record: CloudBackupRecord) => Promise<void>;
}

const SPEAKER_COLORS = ["text-red-400", "text-sky-300", "text-amber-300", "text-emerald-300", "text-fuchsia-300", "text-orange-300", "text-teal-300", "text-indigo-300"];

export function TranscriptView({ session, capture, lines, players, onBackupRecorded }: Props) {
  const names = useMemo(() => buildSpeakerNameMap(capture, players), [capture, players]);
  const colorFor = useMemo(() => {
    const keys = [...new Set(lines.map((l) => l.s))];
    return (key: string) => {
      const p = players.find((x) => x.id === (capture.speakers.find((s) => s.key === key)?.playerId ?? key));
      if (p?.role === "GM") return "text-red-400";
      return SPEAKER_COLORS[1 + (keys.indexOf(key) % (SPEAKER_COLORS.length - 1))];
    };
  }, [lines, players, capture.speakers]);

  const [query, setQuery] = useState("");
  const [hideOoc, setHideOoc] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingAvailable, setRecordingAvailable] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    if (capture.recordingId) {
      getRecording(capture.recordingId)
        .then((rec) => {
          if (cancelled || !rec) return;
          url = URL.createObjectURL(rec.blob);
          setAudioUrl(url);
          setRecordingAvailable(true);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [capture.recordingId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lines.filter((l) => (!hideOoc || !l.o) && (!q || l.x.toLowerCase().includes(q) || (names.get(l.s) || "").toLowerCase().includes(q)));
  }, [lines, query, hideOoc, names]);

  function seek(t: number) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, t - 0.5);
    audioRef.current.play().catch(() => {});
  }

  const baseName = safeFileName(`${session.date} ${session.title}`);

  function transcriptBlob(format: "txt" | "md"): Blob {
    const text = format === "md" ? formatTranscriptMarkdown(session.title, session.date, capture, players, lines) : formatTranscriptText(capture, players, lines);
    return new Blob([text], { type: format === "md" ? "text/markdown" : "text/plain" });
  }

  async function backup(provider: CloudProvider, kind: "audio" | "transcript") {
    setBusy(`${provider}:${kind}`);
    setMessage(null);
    try {
      let blob: Blob;
      let fileName: string;
      if (kind === "audio") {
        const rec = capture.recordingId ? await getRecording(capture.recordingId) : undefined;
        if (!rec) throw new Error("The original audio isn't stored on this device.");
        blob = rec.blob;
        fileName = `${baseName}.${rec.fileName.split(".").pop() || "m4a"}`;
      } else {
        blob = transcriptBlob("md");
        fileName = `${baseName} - transcript.md`;
      }
      const location = await uploadToCloud(provider, blob, fileName, (f) => setBusy(`${provider}:${kind}:${Math.round(f * 100)}`));
      await onBackupRecorded({ provider, kind, location, at: new Date().toISOString() });
      setMessage(`Saved ${kind} to ${provider === "google_drive" ? "Google Drive" : "Dropbox"}.`);
    } catch (e: any) {
      setMessage(`Backup failed: ${e?.message || e}`);
    } finally {
      setBusy(null);
    }
  }

  const providers: Array<{ id: CloudProvider; label: string }> = [
    ...(isDriveAvailable() ? [{ id: "google_drive" as const, label: "Google Drive" }] : []),
    ...(isDropboxAvailable() ? [{ id: "dropbox" as const, label: "Dropbox" }] : []),
  ];
  const backedUp = (provider: CloudProvider, kind: "audio" | "transcript") => (capture.backups || []).some((b) => b.provider === provider && b.kind === kind);

  return (
    <div className="space-y-3">
      {audioUrl && (
        <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur py-2">
          <audio ref={audioRef} src={audioUrl} controls preload="metadata" className="w-full" />
        </div>
      )}

      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search transcript or speaker…" className="w-full bg-zinc-950 border border-zinc-800 rounded pl-8 pr-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-red-500" />
        </div>
        <label className="text-xs text-zinc-400 flex items-center gap-1.5 cursor-pointer select-none">
          <input type="checkbox" checked={hideOoc} onChange={(e) => setHideOoc(e.target.checked)} /> Hide table talk
        </label>
      </div>

      <div className="bg-zinc-950 border border-zinc-850 rounded-lg max-h-[60vh] overflow-y-auto divide-y divide-zinc-900">
        {filtered.length === 0 && <p className="p-4 text-sm text-zinc-500 italic">No lines match.</p>}
        {filtered.map((l, i) => (
          <div key={i} className={`px-3 py-2 flex gap-3 ${l.o ? "opacity-70" : ""}`}>
            <button onClick={() => seek(l.t)} disabled={!audioUrl} className="font-mono text-[11px] text-zinc-500 hover:text-red-400 pt-0.5 shrink-0 w-14 text-left disabled:hover:text-zinc-500 cursor-pointer disabled:cursor-default" aria-label={`Play from ${formatClock(l.t)}`}>
              {formatClock(l.t)}
            </button>
            <p className="text-sm text-zinc-200 leading-relaxed min-w-0">
              <span className={`font-bold ${colorFor(l.s)}`}>{names.get(l.s)}</span>
              {l.o && <span className="text-[10px] uppercase text-zinc-500 ml-1">ooc</span>}
              <span className="text-zinc-500">: </span>
              “{l.x}”
            </p>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 space-y-2">
        <p className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Export &amp; backup</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => downloadBlob(transcriptBlob("txt"), `${baseName} - transcript.txt`)} className="px-3 py-2 rounded border border-zinc-700 text-xs text-zinc-200 flex items-center gap-1.5 cursor-pointer hover:border-zinc-500">
            <Download className="w-3.5 h-3.5" /> Transcript .txt
          </button>
          <button onClick={() => downloadBlob(transcriptBlob("md"), `${baseName} - transcript.md`)} className="px-3 py-2 rounded border border-zinc-700 text-xs text-zinc-200 flex items-center gap-1.5 cursor-pointer hover:border-zinc-500">
            <Download className="w-3.5 h-3.5" /> Transcript .md
          </button>
          {recordingAvailable && (
            <button
              onClick={async () => {
                const rec = capture.recordingId ? await getRecording(capture.recordingId) : undefined;
                if (rec) downloadBlob(rec.blob, `${baseName}.${rec.fileName.split(".").pop()}`);
              }}
              className="px-3 py-2 rounded border border-zinc-700 text-xs text-zinc-200 flex items-center gap-1.5 cursor-pointer hover:border-zinc-500"
            >
              <Download className="w-3.5 h-3.5" /> Audio file
            </button>
          )}
        </div>
        {providers.length > 0 ? (
          <div className="flex gap-2 flex-wrap">
            {providers.map((p) =>
              (["transcript", "audio"] as const)
                .filter((kind) => kind === "transcript" || recordingAvailable)
                .map((kind) => {
                  const key = `${p.id}:${kind}`;
                  const active = busy?.startsWith(key);
                  const pct = active ? busy!.split(":")[2] : undefined;
                  return (
                    <button key={key} onClick={() => backup(p.id, kind)} disabled={!!busy} className="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-100 flex items-center gap-1.5 cursor-pointer disabled:opacity-60">
                      {active ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : backedUp(p.id, kind) ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Cloud className="w-3.5 h-3.5" />}
                      {kind === "audio" ? <FileAudio className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                      {kind === "audio" ? "Audio" : "Transcript"} → {p.label}
                      {pct ? ` ${pct}%` : ""}
                    </button>
                  );
                })
            )}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">Sign in with Google to back up to Drive. Dropbox backup turns on when the app has a Dropbox key configured.</p>
        )}
        {message && <p className="text-xs text-zinc-300">{message}</p>}
      </div>
    </div>
  );
}
