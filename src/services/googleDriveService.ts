import { DriveAudioFile } from "../types";
import { getGoogleAccessToken, requestDriveAccessToken } from "../firebase";

// Helper to format bytes to human-readable size
export function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes) || bytes <= 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Estimate audio duration based on file size and format (typical voice bitrate 64-128 kbps)
export function estimateAudioDuration(bytes?: number): string {
  if (!bytes || bytes <= 0) return "~Unknown duration";
  // Assuming average 64-96 kbps for voice recordings
  const avgBytesPerSecond = 10000; // ~80 kbps
  const totalSeconds = Math.round(bytes / avgBytesPerSecond);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `~${hours}h ${minutes}m`;
  }
  return `~${Math.max(1, minutes)}m`;
}

/**
 * Searches Google Drive for audio files matching common voice recording formats
 */
export async function searchDriveAudioFiles(
  searchQuery = "",
  pageToken = ""
): Promise<{ files: DriveAudioFile[]; nextPageToken?: string }> {
  let token = await getGoogleAccessToken();
  if (!token) {
    // Attempt pop-up request
    token = await requestDriveAccessToken();
  }

  if (!token) {
    throw new Error("No Google Drive authorization token available. Please connect Google Drive first.");
  }

  // Build query for audio types, video containers (common for stream recordings), or known extensions
  const audioQueryParts = [
    "mimeType contains 'audio/'",
    "mimeType = 'video/mp4'",
    "mimeType = 'video/webm'",
    "name contains '.mp3'",
    "name contains '.wav'",
    "name contains '.m4a'",
    "name contains '.ogg'",
    "name contains '.webm'",
    "name contains '.flac'",
    "name contains '.aac'",
    "name contains '.opus'",
  ];

  let q = `(${audioQueryParts.join(" or ")}) and trashed = false`;
  if (searchQuery.trim()) {
    const cleanSearch = searchQuery.trim().replace(/'/g, "\\'");
    q += ` and name contains '${cleanSearch}'`;
  }

  const params = new URLSearchParams({
    q,
    pageSize: "40",
    fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime, iconLink, thumbnailLink)",
    orderBy: "modifiedTime desc",
  });

  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      // Token might be expired, clear cached token
      throw new Error("Google Drive session expired. Please reconnect your Google Drive account.");
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to search Google Drive (${res.status})`);
  }

  const data = await res.json();
  const rawFiles = data.files || [];

  const files: DriveAudioFile[] = rawFiles.map((f: any) => {
    const sizeBytes = f.size ? parseInt(f.size, 10) : undefined;
    return {
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      sizeBytes,
      size: formatBytes(sizeBytes),
      modifiedTime: f.modifiedTime,
      iconLink: f.iconLink,
      thumbnailLink: f.thumbnailLink,
    };
  });

  return {
    files,
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Downloads a complete audio file from Google Drive as a Blob with stream progress tracking
 */
export async function downloadDriveAudioFile(
  fileId: string,
  onProgress?: (percent: number, loadedBytes: number, totalBytes: number) => void
): Promise<{ blob: Blob; mimeType: string }> {
  let token = await getGoogleAccessToken();
  if (!token) {
    token = await requestDriveAccessToken();
  }
  if (!token) {
    throw new Error("Missing Google Drive authorization token.");
  }

  // First fetch metadata to get size and mimeType
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  let expectedSize = 0;
  let fileMime = "audio/mpeg";
  if (metaRes.ok) {
    const meta = await metaRes.json();
    expectedSize = meta.size ? parseInt(meta.size, 10) : 0;
    if (meta.mimeType) {
      fileMime = meta.mimeType;
    }
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Google Drive download failed with HTTP status ${res.status}`);
  }

  const contentLengthHeader = res.headers.get("Content-Length");
  const total = contentLengthHeader ? parseInt(contentLengthHeader, 10) : expectedSize;

  if (!res.body) {
    const blob = await res.blob();
    return { blob, mimeType: fileMime };
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      if (onProgress && total > 0) {
        const pct = Math.min(100, Math.round((loaded / total) * 100));
        onProgress(pct, loaded, total);
      }
    }
  }

  const blob = new Blob(chunks, { type: fileMime });
  return { blob, mimeType: fileMime };
}

/**
 * Downloads a byte-range chunk directly from Google Drive.
 * This is ideal for large files (up to 6 hours) so we only pull slices as needed!
 */
export async function downloadDriveByteRange(
  fileId: string,
  startByte: number,
  endByte: number,
  mimeType = "audio/mpeg"
): Promise<Blob> {
  let token = await getGoogleAccessToken();
  if (!token) {
    token = await requestDriveAccessToken();
  }
  if (!token) {
    throw new Error("Missing Google Drive authorization token.");
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Range: `bytes=${startByte}-${endByte}`,
    },
  });

  if (!res.ok && res.status !== 206) {
    throw new Error(`Failed to fetch byte range ${startByte}-${endByte} from Google Drive (${res.status})`);
  }

  return await res.blob();
}
