import { DriveAudioFile, SessionAudioItem } from "../types";
import { formatBytes } from "./googleDriveService";

/**
 * Extracts sequence number or date/time from filename
 */
export function extractChronologicalInfoFromFilename(filename: string): {
  timestamp?: number;
  sequence?: number;
  source: "filename_time" | "filename_sequence" | null;
  label?: string;
} {
  const cleanName = filename.toLowerCase();

  // 1. Detect sequence / part patterns (e.g. part 1, part_02, pt1, track-2, seg-3, #1)
  const partMatch = cleanName.match(/(?:part|pt|seg|segment|act|track|clip|chunk)[_-\s]*(\d+)/i) ||
                    cleanName.match(/[-_\s](\d{1,3})\.(?:mp3|wav|m4a|ogg|webm|flac|aac|opus)/i);
  if (partMatch && partMatch[1]) {
    const seq = parseInt(partMatch[1], 10);
    return {
      sequence: seq,
      source: "filename_sequence",
      label: `Part ${seq}`,
    };
  }

  // 2. Detect ISO-like full datetime in filename (e.g. 2026-09-17_19-30-00 or 20260917_193000)
  const isoMatch = cleanName.match(/(20\d{2})[-_]?([01]\d)[-_]?([0-3]\d)[-_T\s]([0-2]\d)[-_:.]?([0-5]\d)(?:[-_:.]?([0-5]\d))?/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const hour = parseInt(isoMatch[4], 10);
    const min = parseInt(isoMatch[5], 10);
    const sec = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;
    const date = new Date(year, month, day, hour, min, sec);
    if (!isNaN(date.getTime())) {
      return {
        timestamp: date.getTime(),
        source: "filename_time",
        label: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      };
    }
  }

  // 3. Detect time of day in filename (e.g. 19-30-00, 19_45, 07-30pm)
  const timeMatch = cleanName.match(/(?:at[-_\s]*)?([0-2]?\d)[-_:.]?([0-5]\d)(?:[-_:.]?([0-5]\d))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const min = parseInt(timeMatch[2], 10);
    const sec = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    const ampm = timeMatch[4]?.toLowerCase();
    if (hour <= 23 && min <= 59) {
      if (ampm === "pm" && hour < 12) hour += 12;
      if (ampm === "am" && hour === 12) hour = 0;
      const today = new Date();
      today.setHours(hour, min, sec, 0);
      return {
        timestamp: today.getTime(),
        source: "filename_time",
        label: today.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      };
    }
  }

  return { source: null };
}

/**
 * Creates a SessionAudioItem from a local File
 */
export async function createSessionAudioItemFromFile(file: File, index: number): Promise<SessionAudioItem> {
  const filenameInfo = extractChronologicalInfoFromFilename(file.name);
  let timestamp = file.lastModified || Date.now();
  let timestampSource: SessionAudioItem["timestampSource"] = "metadata";
  let timestampLabel = new Date(timestamp).toLocaleTimeString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  if (filenameInfo.source === "filename_time" && filenameInfo.timestamp) {
    timestamp = filenameInfo.timestamp;
    timestampSource = "filename_time";
    timestampLabel = `${filenameInfo.label} (Filename)`;
  } else if (filenameInfo.source === "filename_sequence" && filenameInfo.sequence !== undefined) {
    timestampSource = "filename_sequence";
    timestampLabel = `${filenameInfo.label} (Filename Seq)`;
    // Synthesize a relative timestamp offset based on sequence number
    timestamp = (file.lastModified || Date.now()) + filenameInfo.sequence * 1000;
  }

  // Duration estimation
  const estSeconds = Math.max(15, Math.round(file.size / 10000));
  const estDurationStr = formatDuration(estSeconds);

  return {
    id: `local-${file.name}-${file.lastModified}-${Math.random().toString(36).substring(2, 7)}`,
    source: "local",
    name: file.name,
    blob: file,
    sizeBytes: file.size,
    sizeStr: formatBytes(file.size),
    timestamp,
    timestampLabel,
    timestampSource,
    estimatedDurationSeconds: estSeconds,
    estimatedDurationStr: estDurationStr,
    order: index + 1,
    status: "pending",
  };
}

/**
 * Creates a SessionAudioItem from a Google Drive File
 */
export function createSessionAudioItemFromDriveFile(driveFile: DriveAudioFile, index: number): SessionAudioItem {
  const filenameInfo = extractChronologicalInfoFromFilename(driveFile.name);
  const rawModified = driveFile.modifiedTime ? new Date(driveFile.modifiedTime).getTime() : Date.now();
  let timestamp = rawModified;
  let timestampSource: SessionAudioItem["timestampSource"] = "metadata";
  let timestampLabel = new Date(timestamp).toLocaleTimeString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  if (filenameInfo.source === "filename_time" && filenameInfo.timestamp) {
    timestamp = filenameInfo.timestamp;
    timestampSource = "filename_time";
    timestampLabel = `${filenameInfo.label} (Filename)`;
  } else if (filenameInfo.source === "filename_sequence" && filenameInfo.sequence !== undefined) {
    timestampSource = "filename_sequence";
    timestampLabel = `${filenameInfo.label} (Filename Seq)`;
    timestamp = rawModified + filenameInfo.sequence * 1000;
  }

  const sizeBytes = driveFile.sizeBytes || 1000000;
  const estSeconds = Math.max(15, Math.round(sizeBytes / 10000));
  const estDurationStr = formatDuration(estSeconds);

  return {
    id: `drive-${driveFile.id}`,
    source: "google_drive",
    name: driveFile.name,
    driveFile,
    sizeBytes,
    sizeStr: driveFile.size || formatBytes(sizeBytes),
    timestamp,
    timestampLabel,
    timestampSource,
    estimatedDurationSeconds: estSeconds,
    estimatedDurationStr: estDurationStr,
    order: index + 1,
    status: "pending",
  };
}

/**
 * Formats duration in seconds to "Xm Ys" or "Xh Ym"
 */
export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs > 0 ? `${secs}s` : ""}`.trim();
  }
  return `${secs}s`;
}

/**
 * Formats seconds into HH:MM:SS
 */
export function formatTimeCode(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Recalculates chronological order, session time offsets and ranges across all items
 */
export function recalculateTimeline(items: SessionAudioItem[]): SessionAudioItem[] {
  let runningSeconds = 0;
  return items.map((item, idx) => {
    const startStr = formatTimeCode(runningSeconds);
    const endSeconds = runningSeconds + item.estimatedDurationSeconds;
    const endStr = formatTimeCode(endSeconds);
    runningSeconds = endSeconds;

    return {
      ...item,
      order: idx + 1,
      sessionTimeRange: `${startStr} - ${endStr}`,
    };
  });
}

/**
 * Automatically sorts a list of audio items chronologically by their detected timestamps
 */
export function sortItemsChronologically(items: SessionAudioItem[]): SessionAudioItem[] {
  const sorted = [...items].sort((a, b) => {
    // If sequence numbers exist in filename, prioritize that
    const aInfo = extractChronologicalInfoFromFilename(a.name);
    const bInfo = extractChronologicalInfoFromFilename(b.name);
    if (aInfo.sequence !== undefined && bInfo.sequence !== undefined) {
      if (aInfo.sequence !== bInfo.sequence) {
        return aInfo.sequence - bInfo.sequence;
      }
    }
    // Otherwise sort by epoch timestamp ascending
    return a.timestamp - b.timestamp;
  });

  return recalculateTimeline(sorted);
}
