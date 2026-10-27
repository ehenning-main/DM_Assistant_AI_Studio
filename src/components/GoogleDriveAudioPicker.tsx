import React, { useState, useEffect } from "react";
import {
  FolderOpen,
  Search,
  Loader2,
  RefreshCw,
  FileAudio,
  CheckCircle2,
  AlertCircle,
  Clock,
  HardDrive,
  X,
  ShieldCheck,
  Music,
  Plus,
  CheckSquare,
  Square
} from "lucide-react";
import { DriveAudioFile } from "../types";
import {
  searchDriveAudioFiles,
  estimateAudioDuration
} from "../services/googleDriveService";
import { getGoogleAccessToken, logInWithGoogle } from "../firebase";

interface GoogleDriveAudioPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDriveFiles: (files: DriveAudioFile[]) => void;
  alreadySelectedFileIds?: string[];
}

export function GoogleDriveAudioPicker({
  isOpen,
  onClose,
  onSelectDriveFiles,
  alreadySelectedFileIds = [],
}: GoogleDriveAudioPickerProps) {
  const [files, setFiles] = useState<DriveAudioFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [, setNextPageToken] = useState<string | undefined>(undefined);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [checkedFileIds, setCheckedFileIds] = useState<Set<string>>(new Set());

  // Check auth on open
  useEffect(() => {
    if (!isOpen) return;
    setCheckedFileIds(new Set());
    checkAuthAndLoad();
  }, [isOpen]);

  async function checkAuthAndLoad() {
    setAuthChecking(true);
    setError(null);
    try {
      const token = await getGoogleAccessToken();
      if (token) {
        setIsAuthenticated(true);
        loadFiles(token);
      } else {
        setIsAuthenticated(false);
      }
    } catch (e: any) {
      console.warn("Drive auth check error:", e);
      setIsAuthenticated(false);
    } finally {
      setAuthChecking(false);
    }
  }

  async function handleConnectDrive() {
    setError(null);
    setLoading(true);
    try {
      const res = await logInWithGoogle();
      if (res.accessToken) {
        setIsAuthenticated(true);
        await loadFiles(res.accessToken);
      } else {
        setError("Could not obtain Google Drive access token. Please check permissions.");
      }
    } catch (e: any) {
      console.error("Failed to connect Drive:", e);
      setError(e.message || "Failed to authenticate with Google Drive.");
    } finally {
      setLoading(false);
    }
  }

  async function loadFiles(_token?: string, query = searchQuery) {
    setLoading(true);
    setError(null);
    try {
      const result = await searchDriveAudioFiles(query);
      setFiles(result.files);
      setNextPageToken(result.nextPageToken);
    } catch (e: any) {
      console.error("Load drive files error:", e);
      if (e.message?.includes("expired") || e.message?.includes("401")) {
        setIsAuthenticated(false);
      }
      setError(e.message || "Failed to retrieve audio files from Google Drive.");
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadFiles(undefined, searchQuery);
  }

  function toggleCheckbox(fileId: string) {
    const next = new Set(checkedFileIds);
    if (next.has(fileId)) {
      next.delete(fileId);
    } else {
      next.add(fileId);
    }
    setCheckedFileIds(next);
  }

  function selectAll() {
    const allIds = files.map((f) => f.id);
    setCheckedFileIds(new Set(allIds));
  }

  function deselectAll() {
    setCheckedFileIds(new Set());
  }

  function handleConfirmSelection() {
    const selected = files.filter((f) => checkedFileIds.has(f.id));
    if (selected.length > 0) {
      onSelectDriveFiles(selected);
      onClose();
    }
  }

  function handleSingleAdd(file: DriveAudioFile) {
    onSelectDriveFiles([file]);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div
      id="google-drive-audio-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="google-drive-audio-card"
        className="relative w-full max-w-3xl max-h-[88vh] flex flex-col bg-stone-900 border border-amber-900/50 rounded-2xl shadow-2xl overflow-hidden text-stone-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-stone-950/80 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-amber-200 flex items-center gap-2">
                Google Drive Audio Library
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-sans font-medium">
                  Multi-File Ready
                </span>
              </h3>
              <p className="text-xs text-stone-400">
                Select one or several recordings. The system uses file timestamps to automatically assemble them in chronological order.
              </p>
            </div>
          </div>
          <button
            id="close-drive-modal-btn"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Auth Banner if not authenticated */}
          {!isAuthenticated && !authChecking && (
            <div
              id="drive-connect-prompt"
              className="p-6 rounded-xl bg-stone-950/60 border border-amber-800/40 text-center space-y-4"
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <FolderOpen className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-serif text-lg font-bold text-stone-200">Connect Your Google Drive</h4>
                <p className="text-sm text-stone-400 max-w-md mx-auto mt-1">
                  Authorize read-only access to select audio files directly from your Drive for automatic chronological transcription and speaker diarization.
                </p>
              </div>
              <button
                id="connect-drive-oauth-btn"
                onClick={handleConnectDrive}
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Authorize Google Drive Access
              </button>
            </div>
          )}

          {/* Connected State Controls */}
          {isAuthenticated && (
            <>
              {/* Search bar & Refresh */}
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input
                    id="drive-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search recordings in Drive (e.g., 'Part 1', 'Session 14', '.mp3')..."
                    className="w-full pl-10 pr-4 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500/60 transition-colors"
                  />
                </div>
                <button
                  id="drive-search-btn"
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-medium rounded-xl border border-stone-700 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Search
                </button>
                <button
                  id="drive-refresh-btn"
                  type="button"
                  onClick={() => loadFiles()}
                  disabled={loading}
                  title="Refresh Drive Files"
                  className="p-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl border border-stone-700 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </form>

              {/* Multi-selection Action Toolbar */}
              <div className="flex items-center justify-between py-1 px-1 text-xs text-stone-400">
                <div className="flex items-center gap-3">
                  <span>Found {files.length} audio recordings in Google Drive</span>
                  {files.length > 0 && (
                    <>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={checkedFileIds.size === files.length ? deselectAll : selectAll}
                        className="text-amber-400 hover:text-amber-300 underline cursor-pointer"
                      >
                        {checkedFileIds.size === files.length ? "Deselect All" : "Select All"}
                      </button>
                    </>
                  )}
                </div>

                {checkedFileIds.size > 0 && (
                  <span className="text-amber-300 font-semibold">
                    {checkedFileIds.size} file{checkedFileIds.size > 1 ? "s" : ""} selected
                  </span>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-800/50 text-red-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Files List */}
              <div className="space-y-2">
                {loading && files.length === 0 ? (
                  <div className="py-16 text-center text-stone-500 space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500/60" />
                    <p className="text-sm">Scanning Google Drive for session recordings...</p>
                  </div>
                ) : files.length === 0 ? (
                  <div className="py-14 text-center border border-dashed border-stone-800 rounded-xl space-y-2">
                    <FileAudio className="w-10 h-10 mx-auto text-stone-600" />
                    <p className="text-sm font-medium text-stone-300">No matching audio files found</p>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto">
                      Place your session recordings (.mp3, .wav, .m4a, .webm, .ogg) in Google Drive and click search or refresh.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                    {files.map((file) => {
                      const isChecked = checkedFileIds.has(file.id);
                      const isAlreadyInQueue = alreadySelectedFileIds.includes(file.id);
                      const estimatedTime = estimateAudioDuration(file.sizeBytes);
                      const formattedDate = file.modifiedTime
                        ? new Date(file.modifiedTime).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Unknown date";

                      return (
                        <div
                          key={file.id}
                          id={`drive-file-${file.id}`}
                          onClick={() => toggleCheckbox(file.id)}
                          className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                            isChecked
                              ? "bg-amber-950/40 border-amber-600/70 shadow-sm"
                              : isAlreadyInQueue
                              ? "bg-stone-900/40 border-emerald-800/40 opacity-80"
                              : "bg-stone-950/40 hover:bg-stone-800/60 border-stone-800/80"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCheckbox(file.id);
                              }}
                              className="text-stone-400 hover:text-amber-400"
                            >
                              {isChecked ? (
                                <CheckSquare className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                              ) : (
                                <Square className="w-5 h-5" />
                              )}
                            </button>

                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                isChecked
                                  ? "bg-amber-500 text-stone-950 font-bold"
                                  : "bg-stone-800 text-amber-400 border border-stone-700"
                              }`}
                            >
                              <Music className="w-4 h-4" />
                            </div>

                            <div className="min-w-0">
                              <h4 className="text-sm font-medium text-stone-200 truncate" title={file.name}>
                                {file.name}
                              </h4>
                              <div className="flex items-center flex-wrap gap-2 text-xs text-stone-400 mt-0.5">
                                <span className="font-mono text-stone-300">{file.size}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-amber-400/90 font-mono">
                                  <Clock className="w-3 h-3" />
                                  {formattedDate}
                                </span>
                                <span>•</span>
                                <span className="text-stone-300">Est. {estimatedTime}</span>
                                {isAlreadyInQueue && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px]">
                                    In Queue
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              id={`select-drive-file-${file.id}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSingleAdd(file);
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-amber-600 hover:text-stone-950 text-stone-200 border border-stone-700 flex items-center gap-1 transition-all active:scale-95"
                              title="Add file directly"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer with Batch Add */}
        <div className="px-6 py-3.5 bg-stone-950/90 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Read-only Drive access • Automatic timestamp sorting</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {checkedFileIds.size > 0 && (
              <button
                id="btn-add-selected-drive-files"
                onClick={handleConfirmSelection}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Add {checkedFileIds.size} Selected {checkedFileIds.size === 1 ? "File" : "Files"} to Queue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
