import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";

// Every capture source (on-device mic, meeting bot, uploaded audio/video) is funneled through ffmpeg into
// the same shape: mono 16 kHz MP3 split into fixed-length segments. That keeps Gemini requests small,
// strips video tracks from uploads, and avoids byte-slicing container formats like .m4a/.mp4 which
// don't survive being cut at arbitrary offsets.

export const SEGMENT_SECONDS = 15 * 60;
const OUTPUT_BITRATE = "32k";
const OUTPUT_SAMPLE_RATE = "16000";

export const CAPTURE_TMP_ROOT = path.join(os.tmpdir(), "sagascribe-capture");

let resolvedFfmpeg: string | null = null;
export function ffmpegPath(): string {
  if (resolvedFfmpeg) return resolvedFfmpeg;
  if (process.env.FFMPEG_PATH) {
    resolvedFfmpeg = process.env.FFMPEG_PATH;
    return resolvedFfmpeg;
  }
  try {
    // ffmpeg-static ships a prebuilt binary so the server works on hosts without a system ffmpeg.
    const req = createRequire(import.meta.url ?? __filename);
    const bundled = req("ffmpeg-static") as string | null;
    if (bundled && fs.existsSync(bundled)) {
      resolvedFfmpeg = bundled;
      return resolvedFfmpeg;
    }
  } catch {
    // fall through to PATH lookup
  }
  resolvedFfmpeg = "ffmpeg";
  return resolvedFfmpeg;
}

function runFfmpeg(args: string[]): Promise<{ stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), ["-hide_banner", "-nostdin", ...args]);
    const out: Buffer[] = [];
    let err = "";
    proc.stdout.on("data", (d) => out.push(d));
    proc.stderr.on("data", (d) => {
      err += d.toString();
      if (err.length > 200_000) err = err.slice(-100_000);
    });
    proc.on("error", (e) => reject(new Error(`ffmpeg failed to start (${e.message}). Install ffmpeg or set FFMPEG_PATH.`)));
    proc.on("close", (code) => {
      if (code === 0) resolve({ stdout: Buffer.concat(out), stderr: err });
      else reject(new Error(`ffmpeg exited with code ${code}: ${err.split("\n").slice(-6).join(" ").trim()}`));
    });
  });
}

export interface NormalizedSegment {
  index: number;
  fileName: string;
  startSec: number;
  endSec: number;
  sizeBytes: number;
}

export interface NormalizedManifest {
  durationSec: number;
  segmentSeconds: number;
  mimeType: "audio/mpeg";
  segments: NormalizedSegment[];
}

/**
 * Converts any audio or video file into mono MP3 segments inside `outDir` and writes manifest.json.
 * Video streams are dropped (-vn), so .mp4 recordings from Zoom/Meet work the same as audio files.
 */
export async function normalizeToSegments(inputPath: string, outDir: string, segmentSeconds = SEGMENT_SECONDS): Promise<NormalizedManifest> {
  fs.mkdirSync(outDir, { recursive: true });
  const listPath = path.join(outDir, "segments.csv");
  await runFfmpeg([
    "-y",
    "-i", inputPath,
    "-vn",
    "-ac", "1",
    "-ar", OUTPUT_SAMPLE_RATE,
    "-c:a", "libmp3lame",
    "-b:a", OUTPUT_BITRATE,
    "-f", "segment",
    "-segment_time", String(segmentSeconds),
    "-reset_timestamps", "1",
    "-segment_list", listPath,
    "-segment_list_type", "csv",
    path.join(outDir, "seg_%03d.mp3"),
  ]);

  const rows = fs.readFileSync(listPath, "utf8").trim().split(/\r?\n/).filter(Boolean);
  const segments: NormalizedSegment[] = rows.map((row, index) => {
    const [fileName, start, end] = row.split(",");
    const filePath = path.join(outDir, fileName);
    return {
      index,
      fileName,
      startSec: Number(start) || 0,
      endSec: Number(end) || 0,
      sizeBytes: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0,
    };
  }).filter((s) => s.sizeBytes > 0);

  if (segments.length === 0) {
    throw new Error("No audio track could be extracted from this file.");
  }

  const manifest: NormalizedManifest = {
    durationSec: Math.round(segments[segments.length - 1].endSec),
    segmentSeconds,
    mimeType: "audio/mpeg",
    segments,
  };
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest));
  return manifest;
}

/**
 * Transcodes (and optionally trims) a short in-memory clip (e.g. a voice-enrollment recording) to mono MP3.
 * The input goes through a temp file rather than stdin: MP4/M4A recordings (Safari, iOS) keep their index
 * at the end of the file and can't be demuxed from a non-seekable pipe.
 */
export async function transcodeClip(input: Buffer, opts: { startSec?: number; durationSec?: number } = {}): Promise<Buffer> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sagascribe-clip-"));
  const inPath = path.join(dir, "in");
  try {
    fs.writeFileSync(inPath, input);
    const args = ["-y"];
    if (opts.startSec && opts.startSec > 0) args.push("-ss", String(opts.startSec));
    args.push("-i", inPath);
    if (opts.durationSec && opts.durationSec > 0) args.push("-t", String(opts.durationSec));
    args.push("-vn", "-ac", "1", "-ar", OUTPUT_SAMPLE_RATE, "-c:a", "libmp3lame", "-b:a", OUTPUT_BITRATE, "-f", "mp3", "pipe:1");
    const { stdout } = await runFfmpeg(args);
    if (stdout.length < 1000) throw new Error("Clip contained no decodable audio.");
    return stdout;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Removes capture working directories older than `maxAgeMs` so abandoned uploads don't fill the disk. */
export function sweepStaleCaptureDirs(maxAgeMs = 6 * 60 * 60 * 1000) {
  if (!fs.existsSync(CAPTURE_TMP_ROOT)) return;
  const now = Date.now();
  for (const name of fs.readdirSync(CAPTURE_TMP_ROOT)) {
    const dir = path.join(CAPTURE_TMP_ROOT, name);
    try {
      if (now - fs.statSync(dir).mtimeMs > maxAgeMs) fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore races with concurrent cleanup
    }
  }
}
