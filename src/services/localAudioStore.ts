// On-device storage for session audio. Recordings can run to hundreds of MB, far beyond localStorage, so they
// live in IndexedDB. Session metadata and transcripts stay in the regular session store (localStorage/Firestore).

import { TranscriptLine } from "../types";

const DB_NAME = "sagascribe_audio_v1";
const DB_VERSION = 1;

const RECORDINGS = "recordings";
const RECORDING_CHUNKS = "recordingChunks";
const CLIPS = "clips";
const SEGMENTS = "segments";
const TRANSCRIPTS = "transcripts";

export interface StoredRecording {
  id: string;
  sessionId: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
  createdAt: string;
}

export interface StoredClip {
  id: string;
  audioBase64: string;
  mimeType: string;
  createdAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser does not support on-device audio storage (IndexedDB)."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(RECORDINGS)) db.createObjectStore(RECORDINGS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(RECORDING_CHUNKS)) {
        const store = db.createObjectStore(RECORDING_CHUNKS, { keyPath: ["recordingId", "seq"] });
        store.createIndex("byRecording", "recordingId");
      }
      if (!db.objectStoreNames.contains(CLIPS)) db.createObjectStore(CLIPS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(SEGMENTS)) db.createObjectStore(SEGMENTS);
      if (!db.objectStoreNames.contains(TRANSCRIPTS)) db.createObjectStore(TRANSCRIPTS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error || new Error("Could not open on-device audio storage."));
    };
  });
  return dbPromise;
}

function tx<T>(storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        const req = run(store);
        let result: T;
        if (req) req.onsuccess = () => (result = req.result);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error("Storage transaction aborted (device storage may be full)."));
      })
  );
}

// --- Recordings --------------------------------------------------------------------------------------------

export function saveRecording(rec: StoredRecording): Promise<void> {
  return tx(RECORDINGS, "readwrite", (s) => s.put(rec)).then(() => undefined);
}

export function getRecording(id: string): Promise<StoredRecording | undefined> {
  return tx<StoredRecording | undefined>(RECORDINGS, "readonly", (s) => s.get(id));
}

export function deleteRecording(id: string): Promise<void> {
  return tx(RECORDINGS, "readwrite", (s) => s.delete(id)).then(() => undefined);
}

// --- Crash-safe live capture: chunks are appended as they arrive and assembled on stop -------------------

export function appendRecordingChunk(recordingId: string, seq: number, blob: Blob): Promise<void> {
  return tx(RECORDING_CHUNKS, "readwrite", (s) => s.put({ recordingId, seq, blob })).then(() => undefined);
}

export async function readRecordingChunks(recordingId: string): Promise<Blob[]> {
  const rows = await tx<Array<{ seq: number; blob: Blob }>>(RECORDING_CHUNKS, "readonly", (s) =>
    s.index("byRecording").getAll(IDBKeyRange.only(recordingId))
  );
  return (rows || []).sort((a, b) => a.seq - b.seq).map((r) => r.blob);
}

export async function clearRecordingChunks(recordingId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(RECORDING_CHUNKS, "readwrite");
    const range = IDBKeyRange.bound([recordingId, 0], [recordingId, Number.MAX_SAFE_INTEGER]);
    t.objectStore(RECORDING_CHUNKS).delete(range);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

/** Recording ids that have chunks but were never finalized (tab closed or crashed mid-session). */
export async function listOrphanedRecordingIds(): Promise<string[]> {
  const keys = await tx<IDBValidKey[]>(RECORDING_CHUNKS, "readonly", (s) => s.getAllKeys());
  const ids = new Set<string>();
  for (const k of keys || []) {
    if (Array.isArray(k) && typeof k[0] === "string") ids.add(k[0]);
  }
  return [...ids];
}

// --- Voice clips (enrollment + learned references) ---------------------------------------------------------

export function saveClip(clip: StoredClip): Promise<void> {
  return tx(CLIPS, "readwrite", (s) => s.put(clip)).then(() => undefined);
}

export function getClip(id: string): Promise<StoredClip | undefined> {
  return tx<StoredClip | undefined>(CLIPS, "readonly", (s) => s.get(id));
}

export function deleteClip(id: string): Promise<void> {
  return tx(CLIPS, "readwrite", (s) => s.delete(id)).then(() => undefined);
}

// --- Normalized segment cache ------------------------------------------------------------------------------

export function saveSegment(jobId: string, index: number, blob: Blob): Promise<void> {
  return tx(SEGMENTS, "readwrite", (s) => s.put(blob, `${jobId}:${index}`)).then(() => undefined);
}

export function getSegment(jobId: string, index: number): Promise<Blob | undefined> {
  return tx<Blob | undefined>(SEGMENTS, "readonly", (s) => s.get(`${jobId}:${index}`));
}

export async function deleteSegments(jobId: string, count: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(SEGMENTS, "readwrite");
    for (let i = 0; i < count; i++) t.objectStore(SEGMENTS).delete(`${jobId}:${i}`);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// --- Transcripts too large for the cloud session document --------------------------------------------------

export function saveLocalTranscript(sessionId: string, lines: TranscriptLine[]): Promise<void> {
  return tx(TRANSCRIPTS, "readwrite", (s) => s.put(lines, sessionId)).then(() => undefined);
}

export function getLocalTranscript(sessionId: string): Promise<TranscriptLine[] | undefined> {
  return tx<TranscriptLine[] | undefined>(TRANSCRIPTS, "readonly", (s) => s.get(sessionId));
}

// --- Helpers -----------------------------------------------------------------------------------------------

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/** Ask the browser not to evict our recordings under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
