// Backup of session audio and transcripts to the GM's cloud storage (Google Drive, Dropbox) or a local download.

import { getGoogleAccessToken, isRealFirebase, logInWithGoogle } from "../firebase";

export type CloudProvider = "google_drive" | "dropbox";

const DRIVE_FOLDER_NAME = "SagaScribe Sessions";
const DRIVE_CHUNK = 8 * 1024 * 1024; // must be a multiple of 256 KiB

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "session";
}

// --- Google Drive ------------------------------------------------------------------------------------------

export function isDriveAvailable(): boolean {
  return isRealFirebase;
}

async function driveToken(forcePrompt = false): Promise<string> {
  if (!forcePrompt) {
    const cached = await getGoogleAccessToken();
    if (cached) return cached;
  }
  const { accessToken } = await logInWithGoogle();
  if (!accessToken) throw new Error("Google Drive access was not granted.");
  return accessToken;
}

async function driveFetch(url: string, init: RequestInit, token: string): Promise<Response> {
  return fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
}

async function ensureDriveFolder(token: string): Promise<string> {
  const q = encodeURIComponent(`name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const found = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive`, {}, token);
  if (found.status === 401 || found.status === 403) throw Object.assign(new Error("auth"), { status: found.status });
  const list = await found.json();
  if (list.files?.[0]?.id) return list.files[0].id;
  const created = await driveFetch(
    "https://www.googleapis.com/drive/v3/files?fields=id",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
    },
    token
  );
  if (!created.ok) throw Object.assign(new Error(`Could not create Drive folder (${created.status})`), { status: created.status });
  return (await created.json()).id;
}

async function driveResumableUpload(token: string, blob: Blob, fileName: string, folderId: string, onProgress?: (f: number) => void): Promise<string> {
  const init = await driveFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": blob.type || "application/octet-stream",
        "X-Upload-Content-Length": String(blob.size),
      },
      body: JSON.stringify({ name: fileName, parents: [folderId] }),
    },
    token
  );
  if (!init.ok) throw Object.assign(new Error(`Drive upload could not start (${init.status})`), { status: init.status });
  const sessionUrl = init.headers.get("Location");
  if (!sessionUrl) throw new Error("Drive did not return an upload session.");

  let offset = 0;
  while (offset < blob.size || blob.size === 0) {
    const end = Math.min(blob.size, offset + DRIVE_CHUNK);
    const res = await fetch(sessionUrl, {
      method: "PUT",
      headers: { "Content-Range": blob.size === 0 ? "bytes */0" : `bytes ${offset}-${end - 1}/${blob.size}` },
      body: blob.slice(offset, end),
    });
    if (res.status === 308) {
      const range = res.headers.get("Range");
      offset = range ? Number(range.split("-")[1]) + 1 : end;
      onProgress?.(offset / blob.size);
      continue;
    }
    if (!res.ok) throw new Error(`Drive upload failed (${res.status})`);
    onProgress?.(1);
    const body = await res.json();
    return body.webViewLink || `https://drive.google.com/file/d/${body.id}/view`;
  }
  throw new Error("Drive upload ended unexpectedly.");
}

export async function uploadToDrive(blob: Blob, fileName: string, onProgress?: (f: number) => void): Promise<string> {
  let token = await driveToken();
  let folderId: string;
  try {
    folderId = await ensureDriveFolder(token);
  } catch (e: any) {
    if (e?.status !== 401 && e?.status !== 403) throw e;
    // Older sign-ins only granted read access; ask again for the drive.file scope.
    token = await driveToken(true);
    folderId = await ensureDriveFolder(token);
  }
  return driveResumableUpload(token, blob, fileName, folderId, onProgress);
}

// --- Dropbox (OAuth PKCE, no server secret needed) --------------------------------------------------------

const DROPBOX_TOKEN_KEY = "sagascribe_dropbox_token_v1";
const DROPBOX_SIMPLE_LIMIT = 140 * 1024 * 1024;
const DROPBOX_CHUNK = 8 * 1024 * 1024;

export function dropboxAppKey(): string | undefined {
  return (import.meta as any).env?.VITE_DROPBOX_APP_KEY || undefined;
}

export function isDropboxAvailable(): boolean {
  return !!dropboxAppKey();
}

function base64Url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function dropboxAuthorize(): Promise<string> {
  const appKey = dropboxAppKey();
  if (!appKey) throw new Error("Dropbox is not configured (set VITE_DROPBOX_APP_KEY).");
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const state = base64Url(crypto.getRandomValues(new Uint8Array(16)));
  const redirectUri = `${window.location.origin}/dropbox-callback.html`;
  const url =
    `https://www.dropbox.com/oauth2/authorize?client_id=${encodeURIComponent(appKey)}&response_type=code` +
    `&code_challenge=${challenge}&code_challenge_method=S256&token_access_type=online` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  const popup = window.open(url, "dropbox-auth", "width=520,height=720");
  if (!popup) throw new Error("Allow pop-ups to connect Dropbox.");

  const code = await new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", onMsg);
      reject(new Error("Dropbox sign-in timed out."));
    }, 5 * 60 * 1000);
    function onMsg(ev: MessageEvent) {
      if (ev.origin !== window.location.origin || ev.data?.type !== "dropbox-oauth") return;
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMsg);
      if (ev.data.state !== state) reject(new Error("Dropbox sign-in state mismatch."));
      else if (ev.data.error || !ev.data.code) reject(new Error(ev.data.error || "Dropbox sign-in was cancelled."));
      else resolve(ev.data.code);
    }
    window.addEventListener("message", onMsg);
  });

  const tokenRes = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, grant_type: "authorization_code", client_id: appKey, redirect_uri: redirectUri, code_verifier: verifier }),
  });
  const tok = await tokenRes.json();
  if (!tokenRes.ok || !tok.access_token) throw new Error(tok.error_description || "Dropbox token exchange failed.");
  try {
    sessionStorage.setItem(DROPBOX_TOKEN_KEY, JSON.stringify({ token: tok.access_token, exp: Date.now() + (tok.expires_in || 3600) * 1000 - 60_000 }));
  } catch {
    // storage unavailable; token is used for this upload only
  }
  return tok.access_token;
}

async function dropboxToken(): Promise<string> {
  try {
    const raw = sessionStorage.getItem(DROPBOX_TOKEN_KEY);
    if (raw) {
      const { token, exp } = JSON.parse(raw);
      if (token && exp > Date.now()) return token;
    }
  } catch {
    // fall through
  }
  return dropboxAuthorize();
}

function dropboxArg(obj: unknown): string {
  // Dropbox-API-Arg must be ASCII; escape everything else.
  return JSON.stringify(obj).replace(/[\u007f-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

export async function uploadToDropbox(blob: Blob, fileName: string, onProgress?: (f: number) => void): Promise<string> {
  const token = await dropboxToken();
  const path = `/SagaScribe Sessions/${fileName}`;
  const commit = { path, mode: "add", autorename: true, mute: false };
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" };

  if (blob.size <= DROPBOX_SIMPLE_LIMIT) {
    const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: { ...auth, "Dropbox-API-Arg": dropboxArg(commit) },
      body: blob,
    });
    if (!res.ok) {
      if (res.status === 401) sessionStorage.removeItem(DROPBOX_TOKEN_KEY);
      throw new Error(`Dropbox upload failed (${res.status})`);
    }
    onProgress?.(1);
    return (await res.json()).path_display || path;
  }

  const start = await fetch("https://content.dropboxapi.com/2/files/upload_session/start", {
    method: "POST",
    headers: { ...auth, "Dropbox-API-Arg": dropboxArg({ close: false }) },
    body: blob.slice(0, DROPBOX_CHUNK),
  });
  if (!start.ok) throw new Error(`Dropbox upload failed (${start.status})`);
  const { session_id } = await start.json();
  let offset = Math.min(DROPBOX_CHUNK, blob.size);
  onProgress?.(offset / blob.size);
  while (offset < blob.size) {
    const end = Math.min(blob.size, offset + DROPBOX_CHUNK);
    const res = await fetch("https://content.dropboxapi.com/2/files/upload_session/append_v2", {
      method: "POST",
      headers: { ...auth, "Dropbox-API-Arg": dropboxArg({ cursor: { session_id, offset }, close: false }) },
      body: blob.slice(offset, end),
    });
    if (!res.ok) throw new Error(`Dropbox upload failed (${res.status})`);
    offset = end;
    onProgress?.(offset / blob.size);
  }
  const fin = await fetch("https://content.dropboxapi.com/2/files/upload_session/finish", {
    method: "POST",
    headers: { ...auth, "Dropbox-API-Arg": dropboxArg({ cursor: { session_id, offset }, commit }) },
    body: new Blob([]),
  });
  if (!fin.ok) throw new Error(`Dropbox upload failed (${fin.status})`);
  return (await fin.json()).path_display || path;
}

export async function uploadToCloud(provider: CloudProvider, blob: Blob, fileName: string, onProgress?: (f: number) => void): Promise<string> {
  return provider === "google_drive" ? uploadToDrive(blob, fileName, onProgress) : uploadToDropbox(blob, fileName, onProgress);
}
