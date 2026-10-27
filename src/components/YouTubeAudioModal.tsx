import React, { useState, useEffect } from "react";
import {
  Youtube,
  Play,
  Pause,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  Sparkles,
  Film,
  Music,
  Plus,
  ArrowRight,
  ClipboardPaste,
  Subtitles,
  Clock,
  User,
  Radio,
  FileAudio
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SessionAudioItem } from "../types";
import {
  YouTubeVideoInfo,
  YouTubeExtractedAudio,
  parseYouTubeVideoId,
  fetchYouTubeInfo,
  extractYouTubeAudio,
  createSessionAudioItemFromYouTube,
  SAMPLE_YOUTUBE_PRESETS
} from "../services/youtubeService";

interface YouTubeAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTrackToQueue: (item: SessionAudioItem) => void;
  onDirectTranscribe?: (extracted: YouTubeExtractedAudio) => Promise<void>;
  queueLength: number;
}

export function YouTubeAudioModal({
  isOpen,
  onClose,
  onAddTrackToQueue,
  onDirectTranscribe,
  queueLength,
}: YouTubeAudioModalProps) {
  const [urlInput, setUrlInput] = useState("");
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgressMessage, setExtractProgressMessage] = useState("");
  const [videoInfo, setVideoInfo] = useState<YouTubeVideoInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showEmbedPreview, setShowEmbedPreview] = useState(false);
  const [timeRange, setTimeRange] = useState("");

  // Auto-probe when URL input changes and has 11-char ID
  useEffect(() => {
    if (!isOpen) {
      setUrlInput("");
      setVideoInfo(null);
      setErrorMsg(null);
      setSuccessMsg(null);
      setShowEmbedPreview(false);
      setIsExtracting(false);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    const trimmed = urlInput.trim();
    const id = parseYouTubeVideoId(trimmed);
    if (id) {
      handleProbeVideo(trimmed);
    } else {
      setVideoInfo(null);
      if (trimmed.length > 5 && !trimmed.includes("youtu")) {
        setErrorMsg("Please enter a valid YouTube video link (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...)");
      } else {
        setErrorMsg(null);
      }
    }
  }, [urlInput]);

  async function handleProbeVideo(urlToProbe: string) {
    setIsLoadingInfo(true);
    setErrorMsg(null);
    try {
      const info = await fetchYouTubeInfo(urlToProbe);
      setVideoInfo(info);
    } catch (err: any) {
      console.warn("YouTube probe note:", err);
      setErrorMsg(err.message || "Could not retrieve YouTube video metadata.");
    } finally {
      setIsLoadingInfo(false);
    }
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text.trim());
      }
    } catch {
      setErrorMsg("Unable to access clipboard. Please paste manually into the field.");
    }
  }

  function handleSelectPreset(presetUrl: string) {
    setUrlInput(presetUrl);
  }

  // Handle adding extracted audio to the playlist queue
  async function handleAddQueue() {
    if (!videoInfo) return;
    setIsExtracting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setExtractProgressMessage("Extracting and processing audio track from YouTube video...");

    try {
      const extracted = await extractYouTubeAudio(videoInfo.url, timeRange.trim() || undefined);
      setExtractProgressMessage("Preparing audio track for session queue...");
      
      const item = createSessionAudioItemFromYouTube(videoInfo, extracted, queueLength);
      onAddTrackToQueue(item);
      
      setSuccessMsg(`✓ Added "${videoInfo.title}" to chronological session queue!`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error("Audio extraction error:", err);
      setErrorMsg(err.message || "Failed to extract audio track from this YouTube video.");
    } finally {
      setIsExtracting(false);
      setExtractProgressMessage("");
    }
  }

  // Handle direct transcription
  async function handleImmediateTranscribe() {
    if (!videoInfo || !onDirectTranscribe) return;
    setIsExtracting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setExtractProgressMessage("Extracting audio stream for immediate Gemini session transcription...");

    try {
      const extracted = await extractYouTubeAudio(videoInfo.url, timeRange.trim() || undefined);
      setExtractProgressMessage("Audio extracted! Starting AI voice matching and diarization...");
      await onDirectTranscribe(extracted);
      onClose();
    } catch (err: any) {
      console.error("Transcribe error:", err);
      setErrorMsg(err.message || "Failed to extract audio for transcription.");
    } finally {
      setIsExtracting(false);
      setExtractProgressMessage("");
    }
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
        onClick={onClose}
        id="youtube-audio-modal-overlay"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-[0_25px_60px_rgba(0,0,0,0.85)] relative overflow-hidden"
          id="youtube-audio-modal-content"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-850 px-5 py-4 bg-zinc-900/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-600/15 border border-red-500/30 rounded-lg text-red-500 flex items-center justify-center shadow-inner">
                <Youtube className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-fantasy font-extrabold text-zinc-100 text-base tracking-wider uppercase flex items-center gap-2">
                  YouTube Audio Track Import
                </h3>
                <p className="text-zinc-400 text-xs font-sans">
                  Use actual-play YouTube videos, podcasts, or session recordings as audio tracks
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition cursor-pointer"
              id="btn-close-youtube-modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
            {/* URL Input Bar */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono flex items-center justify-between">
                <span>YouTube Video URL or ID</span>
                <span className="text-[10px] text-zinc-500 font-sans normal-case">
                  Supports watch links, shorts, and embeds
                </span>
              </label>

              <div className="relative flex items-center">
                <div className="absolute left-3 text-red-500 pointer-events-none">
                  <Youtube className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 rounded-lg pl-9 pr-24 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition font-sans"
                  id="input-youtube-url"
                  disabled={isExtracting}
                />
                <div className="absolute right-1.5 flex items-center gap-1">
                  {urlInput && (
                    <button
                      type="button"
                      onClick={() => setUrlInput("")}
                      className="p-1 text-zinc-500 hover:text-zinc-300 text-xs rounded hover:bg-zinc-800 transition cursor-pointer"
                      title="Clear URL"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-zinc-100 rounded text-[11px] font-sans flex items-center gap-1 transition cursor-pointer border border-zinc-700/60"
                    title="Paste from clipboard"
                  >
                    <ClipboardPaste className="w-3 h-3" />
                    <span>Paste</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Test Session Presets */}
            <div className="space-y-1.5">
              <div className="text-[11px] text-zinc-400 font-medium flex items-center justify-between">
                <span>Or test with a sample RPG actual-play recording:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SAMPLE_YOUTUBE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.url)}
                    className="text-left p-2.5 rounded-lg border border-zinc-850 hover:border-red-500/40 bg-zinc-900/40 hover:bg-zinc-900 transition flex items-center gap-2.5 cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded bg-red-950/60 border border-red-500/30 flex items-center justify-center text-red-400 group-hover:scale-105 transition-transform shrink-0">
                      <Play className="w-3 h-3 fill-current ml-0.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-zinc-200 group-hover:text-red-300 transition-colors truncate">
                        {preset.title}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate">
                        {preset.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Loading Indicator for Metadata Probe */}
            {isLoadingInfo && (
              <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg flex items-center justify-center gap-2 text-xs text-zinc-400">
                <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
                <span>Reading YouTube scrolls and probe metadata...</span>
              </div>
            )}

            {/* Video Preview Card */}
            {videoInfo && !isLoadingInfo && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 bg-zinc-900/90 border border-zinc-800 rounded-lg space-y-3 relative overflow-hidden"
                id="youtube-video-preview-card"
              >
                <div className="flex gap-3 items-start">
                  {/* Thumbnail with duration badge */}
                  <div className="relative w-28 sm:w-32 aspect-video rounded-md overflow-hidden bg-black shrink-0 border border-zinc-800 group">
                    <img
                      src={videoInfo.thumbnail}
                      alt={videoInfo.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-white rounded text-[9px] font-mono font-bold flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5 text-red-400" />
                      {videoInfo.durationFormatted}
                    </div>
                  </div>

                  {/* Info Details */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-red-950/80 text-red-400 border border-red-800/60 font-semibold uppercase tracking-wider">
                        YouTube Source
                      </span>
                      {videoInfo.hasCaptions && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-semibold flex items-center gap-1">
                          <Subtitles className="w-2.5 h-2.5" />
                          CC Captions Ready
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs sm:text-sm font-bold text-zinc-100 line-clamp-2 leading-snug">
                      {videoInfo.title}
                    </h4>

                    <p className="text-[11px] text-zinc-400 flex items-center gap-1">
                      <User className="w-3 h-3 text-zinc-500" />
                      <span>{videoInfo.channel}</span>
                    </p>
                  </div>
                </div>

                {/* Captions snippet preview if available */}
                {videoInfo.hasCaptions && videoInfo.captionSnippet && (
                  <div className="p-2 bg-zinc-950 border border-zinc-850 rounded text-[11px] text-zinc-400 italic font-sans flex items-start gap-1.5">
                    <Subtitles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">
                      &ldquo;{videoInfo.captionSnippet}&rdquo;
                    </span>
                  </div>
                )}

                {/* Embed player toggle */}
                <div className="pt-1 flex items-center justify-between border-t border-zinc-850/80">
                  <button
                    type="button"
                    onClick={() => setShowEmbedPreview(!showEmbedPreview)}
                    className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold transition cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{showEmbedPreview ? "Hide Preview Player" : "Listen / Preview Video Player"}</span>
                  </button>

                  <a
                    href={videoInfo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open on YouTube</span>
                  </a>
                </div>

                {/* Embedded Iframe Player */}
                {showEmbedPreview && (
                  <div className="aspect-video w-full rounded-md overflow-hidden bg-black border border-zinc-800 mt-2">
                    <iframe
                      src={videoInfo.embedUrl}
                      title={videoInfo.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
              </motion.div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-lg text-red-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Extraction Notice</p>
                  <p className="text-[11px] text-zinc-300">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-900/60 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Extraction Progress Overlay */}
            {isExtracting && (
              <div className="p-4 bg-red-950/20 border border-red-500/30 rounded-lg text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-red-400 text-xs font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{extractProgressMessage || "Processing YouTube audio stream..."}</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Downloading pristine MP3 track and preparing speaker attribution...
                </p>
              </div>
            )}
          </div>

          {/* Footer Action Buttons */}
          <div className="border-t border-zinc-850 px-5 py-3.5 bg-zinc-900/60 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isExtracting}
              className="px-3.5 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-semibold transition cursor-pointer border border-zinc-750 disabled:opacity-50"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Option A: Add to queue */}
              <button
                type="button"
                onClick={handleAddQueue}
                disabled={!videoInfo || isExtracting || isLoadingInfo}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                id="btn-add-youtube-to-queue"
              >
                {isExtracting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>Add Audio Track to Queue</span>
              </button>

              {/* Option B: Direct transcribe */}
              {onDirectTranscribe && (
                <button
                  type="button"
                  onClick={handleImmediateTranscribe}
                  disabled={!videoInfo || isExtracting || isLoadingInfo}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-zinc-950 font-bold rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed shadow-red-950/40"
                  id="btn-direct-transcribe-youtube"
                >
                  {isExtracting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-950" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-zinc-950 fill-current" />
                  )}
                  <span>Transcribe Session Now</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
