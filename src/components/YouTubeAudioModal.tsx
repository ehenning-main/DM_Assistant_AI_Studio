import React, { useState, useEffect, useRef } from "react";
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
  FileAudio,
  Upload,
  Square,
  Key,
  ChevronDown,
  ChevronUp,
  Mic,
  Volume2,
  ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SessionAudioItem } from "../types";
import {
  YouTubeVideoInfo,
  YouTubeExtractedAudio,
  YouTubeExtractionError,
  parseYouTubeVideoId,
  fetchYouTubeInfo,
  extractYouTubeAudio,
  createSessionAudioItemFromYouTube,
  createExtractedAudioFromBlob,
  SAMPLE_YOUTUBE_PRESETS
} from "../services/youtubeService";
import { formatDuration } from "../services/audioChronologyService";

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

  // State for YouTube and alternate capture workflows
  const [isBotCheckError, setIsBotCheckError] = useState(false);
  const [cookiesInput, setCookiesInput] = useState("");
  const [showCookiesSection, setShowCookiesSection] = useState(false);

  // Tab Audio Recording state & live audio feedback
  const [isTabRecording, setIsTabRecording] = useState(false);
  const [tabRecordingSeconds, setTabRecordingSeconds] = useState(0);
  const [tabRecordingTarget, setTabRecordingTarget] = useState<"transcribe" | "queue">("transcribe");
  const [audioVolume, setAudioVolume] = useState(0); // 0 to 100 level
  const tabMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const tabRecordedChunksRef = useRef<Blob[]>([]);
  const tabStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileTarget, setFileTarget] = useState<"transcribe" | "queue">("transcribe");

  // Timer for active tab recording
  useEffect(() => {
    let interval: any;
    if (isTabRecording) {
      interval = setInterval(() => {
        setTabRecordingSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTabRecording]);

  // Synchronize browser tab title with red recording light so user sees it even on other tabs
  useEffect(() => {
    const originalTitle = document.title;
    if (isTabRecording) {
      document.title = `🔴 REC [${formatDuration(tabRecordingSeconds)}] • Capturing Tab Audio...`;
    }
    return () => {
      document.title = originalTitle;
    };
  }, [isTabRecording, tabRecordingSeconds]);

  // Helper to cleanup AudioContext and animation loop
  function cleanupAudioContext() {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (_e) {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioVolume(0);
  }

  // Reset & cleanup on modal close
  useEffect(() => {
    if (!isOpen) {
      setUrlInput("");
      setVideoInfo(null);
      setErrorMsg(null);
      setSuccessMsg(null);
      setShowEmbedPreview(false);
      setIsExtracting(false);
      setIsBotCheckError(false);
      setCookiesInput("");
      setShowCookiesSection(false);

      cleanupAudioContext();
      if (tabStreamRef.current) {
        tabStreamRef.current.getTracks().forEach((t) => t.stop());
        tabStreamRef.current = null;
      }
      setIsTabRecording(false);
      setTabRecordingSeconds(0);
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
    setIsBotCheckError(false);
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
    setIsBotCheckError(false);
    setSuccessMsg(null);
    setExtractProgressMessage("Extracting and processing audio track from YouTube video...");

    try {
      const extracted = await extractYouTubeAudio(
        videoInfo.url,
        timeRange.trim() || undefined,
        cookiesInput.trim() || undefined
      );
      setExtractProgressMessage("Preparing audio track for session queue...");
      
      const item = createSessionAudioItemFromYouTube(videoInfo, extracted, queueLength);
      onAddTrackToQueue(item);
      
      setSuccessMsg(`✓ Added "${videoInfo.title}" to chronological session queue!`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error("Audio extraction error:", err);
      if (err.isBotCheck) {
        setIsBotCheckError(true);
        setErrorMsg("YouTube requires bot verification for cloud server downloads of this video. Use Tab Audio Capture or File Upload below to proceed immediately.");
      } else {
        setErrorMsg(err.message || "Failed to extract audio track from this YouTube video.");
      }
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
    setIsBotCheckError(false);
    setSuccessMsg(null);
    setExtractProgressMessage("Extracting audio stream for immediate Gemini session transcription...");

    try {
      const extracted = await extractYouTubeAudio(
        videoInfo.url,
        timeRange.trim() || undefined,
        cookiesInput.trim() || undefined
      );
      setExtractProgressMessage("Audio extracted! Starting AI voice matching and diarization...");
      await onDirectTranscribe(extracted);
      onClose();
    } catch (err: any) {
      console.error("Transcribe error:", err);
      if (err.isBotCheck) {
        setIsBotCheckError(true);
        setErrorMsg("YouTube requires bot verification for cloud server downloads of this video. Use Tab Audio Capture or File Upload below to proceed immediately.");
      } else {
        setErrorMsg(err.message || "Failed to extract audio for transcription.");
      }
    } finally {
      setIsExtracting(false);
      setExtractProgressMessage("");
    }
  }

  // Start Tab Audio Capture (works in Chrome / Edge / modern browsers directly from open tab)
  async function startTabAudioCapture(target: "transcribe" | "queue") {
    try {
      setErrorMsg(null);
      setIsBotCheckError(false);
      setTabRecordingTarget(target);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setErrorMsg("Your browser does not support Tab Audio Capture. Please upload the downloaded file instead.");
        return;
      }

      // Prompt screen/tab picker with audio enabled
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        setErrorMsg("No audio track detected. Please make sure to check 'Share tab audio' in your browser's prompt.");
        return;
      }

      tabStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      tabMediaRecorderRef.current = mediaRecorder;
      tabRecordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          tabRecordedChunksRef.current.push(e.data);
        }
      };

      // Set up AudioContext & AnalyserNode for live visual audio feedback (equalizer & levels)
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          const audioCtx = new AudioCtxClass();
          audioContextRef.current = audioCtx;
          if (audioCtx.state === "suspended") {
            audioCtx.resume();
          }
          const audioStreamOnly = new MediaStream(audioTracks);
          const source = audioCtx.createMediaStreamSource(audioStreamOnly);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.5;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const checkLevels = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const vol = Math.min(100, Math.round((avg / 128) * 100));
            setAudioVolume(vol);
            animFrameRef.current = requestAnimationFrame(checkLevels);
          };
          checkLevels();
        }
      } catch (audioErr) {
        console.warn("AudioContext setup note:", audioErr);
      }

      // Listen for stream ending (e.g. user clicks "Stop sharing" in browser banner)
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (tabMediaRecorderRef.current && tabMediaRecorderRef.current.state !== "inactive") {
          stopTabAudioCapture(target);
        }
      });

      mediaRecorder.start(1000);
      setIsTabRecording(true);
      setTabRecordingSeconds(0);
    } catch (err: any) {
      if (err.name !== "NotAllowedError") {
        setErrorMsg(err.message || "Unable to start tab audio recording.");
      }
    }
  }

  // Cancel Tab Audio Capture
  function cancelTabAudioCapture() {
    cleanupAudioContext();
    if (tabStreamRef.current) {
      tabStreamRef.current.getTracks().forEach((t) => t.stop());
      tabStreamRef.current = null;
    }
    if (tabMediaRecorderRef.current && tabMediaRecorderRef.current.state !== "inactive") {
      try {
        tabMediaRecorderRef.current.stop();
      } catch (_e) {}
    }
    setIsTabRecording(false);
    setTabRecordingSeconds(0);
    tabRecordedChunksRef.current = [];
  }

  // Stop Tab Audio Capture and dispatch
  async function stopTabAudioCapture(target?: "transcribe" | "queue") {
    const finalTarget = target || tabRecordingTarget;
    cleanupAudioContext();
    if (!tabMediaRecorderRef.current || tabMediaRecorderRef.current.state === "inactive") return;

    setIsExtracting(true);
    setExtractProgressMessage("Finalizing audio stream recorded from browser tab...");

    const recorder = tabMediaRecorderRef.current;
    recorder.onstop = async () => {
      try {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(tabRecordedChunksRef.current, { type: mimeType });

        if (tabStreamRef.current) {
          tabStreamRef.current.getTracks().forEach((t) => t.stop());
          tabStreamRef.current = null;
        }
        setIsTabRecording(false);

        const sessionTitle = videoInfo?.title ? `[Tab Audio] ${videoInfo.title}` : "YouTube Tab Capture";
        const extracted = await createExtractedAudioFromBlob(
          blob,
          sessionTitle,
          videoInfo?.videoId || "tab-audio"
        );

        if (finalTarget === "transcribe" && onDirectTranscribe) {
          setExtractProgressMessage("Captured audio ready! Starting Gemini speaker diarization...");
          await onDirectTranscribe(extracted);
          onClose();
        } else {
          const item = createSessionAudioItemFromYouTube(
            videoInfo || {
              videoId: "tab-audio",
              url: urlInput || "https://youtube.com",
              title: sessionTitle,
              channel: "Browser Tab Capture",
              thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
              durationSeconds: tabRecordingSeconds,
              durationFormatted: formatDuration(tabRecordingSeconds),
              hasCaptions: false,
              embedUrl: "",
            },
            extracted,
            queueLength
          );
          onAddTrackToQueue(item);
          setSuccessMsg("✓ Tab audio successfully added to session queue!");
          setTimeout(() => onClose(), 1200);
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to process recorded tab audio.");
      } finally {
        setIsExtracting(false);
        setExtractProgressMessage("");
      }
    };

    recorder.stop();
  }

  // Handle local audio or video file upload fallback
  function triggerFileUpload(target: "transcribe" | "queue") {
    setFileTarget(target);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setErrorMsg(null);
    setIsBotCheckError(false);
    setExtractProgressMessage(`Reading "${file.name}"...`);

    try {
      const title = file.name.replace(/\.[^/.]+$/, "");
      const extracted = await createExtractedAudioFromBlob(
        file,
        title,
        videoInfo?.videoId || "uploaded-audio"
      );

      if (fileTarget === "transcribe" && onDirectTranscribe) {
        setExtractProgressMessage("Audio processed! Starting Gemini transcription & diarization...");
        await onDirectTranscribe(extracted);
        onClose();
      } else {
        const item = createSessionAudioItemFromYouTube(
          videoInfo || {
            videoId: "uploaded-audio",
            url: urlInput || "https://youtube.com",
            title,
            channel: "Local Upload",
            thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            durationSeconds: extracted.durationSeconds,
            durationFormatted: extracted.durationFormatted,
            hasCaptions: false,
            embedUrl: "",
          },
          extracted,
          queueLength
        );
        onAddTrackToQueue(item);
        setSuccessMsg(`✓ Added "${title}" to session queue!`);
        setTimeout(() => onClose(), 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process local file.");
    } finally {
      setIsExtracting(false);
      setExtractProgressMessage("");
      if (fileInputRef.current) fileInputRef.current.value = "";
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
            <div className="flex items-center gap-2.5">
              {isTabRecording && (
                <div
                  className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-950 border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.7)] animate-pulse"
                  id="tab-recording-header-badge"
                >
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 shadow-[0_0_8px_#ef4444]"></span>
                  </span>
                  <span className="text-[11px] font-mono font-extrabold text-red-200 tracking-wider">
                    REC {formatDuration(tabRecordingSeconds)}
                  </span>
                </div>
              )}
              <button
                onClick={onClose}
                disabled={isTabRecording}
                className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition cursor-pointer disabled:opacity-40"
                id="btn-close-youtube-modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
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

                {/* Embed player toggle and quick actions */}
                <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-850/80">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowEmbedPreview(!showEmbedPreview)}
                      className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold transition cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{showEmbedPreview ? "Hide Preview Player" : "Listen / Preview Video Player"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => startTabAudioCapture("transcribe")}
                      disabled={isTabRecording || isExtracting}
                      className="text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1 font-semibold transition cursor-pointer px-2 py-0.5 rounded bg-amber-950/40 border border-amber-700/50 hover:bg-amber-900/40"
                      title="Directly capture and record audio from this YouTube tab"
                    >
                      <Radio className="w-3 h-3 text-red-400 animate-pulse" />
                      <span>Capture Tab Audio</span>
                    </button>
                  </div>

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

            {/* Hidden File Input for fallback uploads */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="audio/*,video/*"
              className="hidden"
            />

            {/* Active Tab Recording Studio Console */}
            {isTabRecording && (
              <div
                className="p-4 bg-gradient-to-b from-red-950/70 via-red-950/40 to-zinc-950 border-2 border-red-500 rounded-xl space-y-3.5 shadow-[0_0_30px_rgba(239,68,68,0.35)] relative overflow-hidden"
                id="active-tab-recording-console"
              >
                {/* Glowing top line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 animate-pulse" />

                {/* Header: Recording Beacon & Timer */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    {/* Concentric Pulsing Red Recording Lamp */}
                    <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-red-950/90 border border-red-500 shadow-[0_0_20px_#ef4444] shrink-0">
                      <span className="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-red-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 shadow-[0_0_10px_#ef4444]"></span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-black text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                          <span>●</span> REC LIVE TAB AUDIO
                        </span>
                        <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase rounded bg-red-900/60 text-red-200 border border-red-700/50">
                          ON AIR
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-300 font-medium truncate max-w-xs sm:max-w-md">
                        {videoInfo?.title ? `Target: "${videoInfo.title}"` : "Target: Active Browser Tab"}
                      </div>
                    </div>
                  </div>

                  {/* Digital Clock Display */}
                  <div className="flex items-baseline gap-1 bg-black/80 px-3 py-1.5 rounded-lg border border-red-600/50 shadow-inner">
                    <Clock className="w-3.5 h-3.5 text-red-400 self-center" />
                    <span className="text-lg font-mono font-extrabold text-red-400 tracking-wider">
                      {formatDuration(tabRecordingSeconds)}
                    </span>
                  </div>
                </div>

                {/* Animated Audio Equalizer Visualizer */}
                <div className="p-3 bg-black/70 border border-red-950 rounded-lg flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      {audioVolume > 2 ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>Audio Signal Streaming Live</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                          <span>Listening for sound... (Make sure video is playing)</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-tight">
                      Capturing digital sound direct from your open YouTube tab. Zero bot detection, lossless quality.
                    </p>
                  </div>

                  {/* 10-Bar Frequency Waveform Equalizer */}
                  <div className="flex items-end gap-1 h-9 px-2.5 py-1 bg-zinc-950/90 rounded border border-red-500/30 shrink-0">
                    {[0.25, 0.65, 0.95, 0.45, 0.85, 1.0, 0.55, 0.9, 0.35, 0.75].map((factor, idx) => {
                      // Height responds to audio decibels with minimum baseline
                      const isSounding = audioVolume > 2;
                      const dynamicH = isSounding
                        ? Math.max(18, Math.min(100, Math.round(audioVolume * factor * 1.6)))
                        : Math.max(10, Math.round(15 + Math.sin(tabRecordingSeconds * 3 + idx) * 8));
                      const isHigh = dynamicH > 65;
                      const isMid = dynamicH > 35;

                      return (
                        <div
                          key={idx}
                          className="w-1.5 rounded-full transition-all duration-75"
                          style={{
                            height: `${dynamicH}%`,
                            backgroundColor: isHigh ? "#ef4444" : isMid ? "#f59e0b" : "#22c55e",
                            boxShadow: isHigh ? "0 0 8px rgba(239,68,68,0.8)" : "none",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Control Action Buttons */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-red-900/30">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => stopTabAudioCapture("transcribe")}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-zinc-950 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-950/80 transition"
                      id="btn-stop-tab-transcribe"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop & Transcribe Now</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => stopTabAudioCapture("queue")}
                      className="px-3.5 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer border border-zinc-700 transition"
                      id="btn-stop-tab-queue"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Stop & Add to Queue</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={cancelTabAudioCapture}
                    className="text-xs text-zinc-400 hover:text-zinc-200 transition cursor-pointer px-2 py-1"
                  >
                    Cancel Capture
                  </button>
                </div>
              </div>
            )}

            {/* YouTube Bot Verification Workaround Card */}
            {(isBotCheckError || (!videoInfo && urlInput.includes("youtu"))) && !isTabRecording && (
              <div className="p-3.5 bg-amber-950/30 border border-amber-600/40 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Direct In-Browser Alternatives (100% Bot-Proof)</span>
                  </div>
                  <span className="text-[10px] text-amber-500/80 font-mono">Bypasses Cloud Blocks</span>
                </div>

                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Certain videos require human sign-in when downloaded from cloud servers. You can capture or import the session directly without any blocks:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => startTabAudioCapture("transcribe")}
                    disabled={isExtracting}
                    className="p-3 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/50 text-left transition flex items-center gap-2.5 cursor-pointer group"
                    id="btn-capture-tab-audio"
                  >
                    <div className="w-7 h-7 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Radio className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-amber-200">Capture Tab Audio</div>
                      <div className="text-[10px] text-zinc-400">Play in tab & record live stream</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerFileUpload("transcribe")}
                    disabled={isExtracting}
                    className="p-3 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-750 text-left transition flex items-center gap-2.5 cursor-pointer group"
                    id="btn-upload-local-file"
                  >
                    <div className="w-7 h-7 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Upload className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-zinc-200">Upload Media File</div>
                      <div className="text-[10px] text-zinc-400">Drop local .mp3, .m4a, or .mp4</div>
                    </div>
                  </button>
                </div>

                {/* Collapsible cookies input */}
                <div className="pt-1.5 border-t border-amber-900/40">
                  <button
                    type="button"
                    onClick={() => setShowCookiesSection(!showCookiesSection)}
                    className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-mono transition cursor-pointer"
                  >
                    <Key className="w-3 h-3" />
                    <span>{showCookiesSection ? "Hide Cookie Authentication" : "Advanced: Supply YouTube Cookies (Netscape format)"}</span>
                    {showCookiesSection ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {showCookiesSection && (
                    <div className="mt-2 space-y-1.5">
                      <textarea
                        value={cookiesInput}
                        onChange={(e) => setCookiesInput(e.target.value)}
                        placeholder="Paste Netscape cookie string (e.g. from 'Get cookies.txt' browser extension)..."
                        rows={3}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-[10px] font-mono text-zinc-300 focus:outline-none focus:border-amber-500"
                      />
                      <p className="text-[9px] text-zinc-500">
                        Paste cookies exported from your signed-in browser session to authenticate server downloads.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && !isBotCheckError && (
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
                  Downloading audio track and preparing speaker attribution...
                </p>
              </div>
            )}
          </div>

          {/* Footer Action Buttons */}
          <div className="border-t border-zinc-850 px-5 py-3.5 bg-zinc-900/60 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isExtracting || isTabRecording}
                className="px-3.5 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-semibold transition cursor-pointer border border-zinc-750 disabled:opacity-50"
              >
                Cancel
              </button>

              {!isTabRecording && (
                <button
                  type="button"
                  onClick={() => startTabAudioCapture("transcribe")}
                  disabled={isExtracting}
                  className="px-3 py-2 bg-red-950/70 hover:bg-red-900/80 text-red-300 border border-red-700/60 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  id="btn-footer-capture-tab"
                  title="Capture live audio stream directly from an open browser tab"
                >
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                  <Radio className="w-3.5 h-3.5 text-red-400" />
                  <span>Capture Tab Audio</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Option A: Add to queue */}
              <button
                type="button"
                onClick={handleAddQueue}
                disabled={!videoInfo || isExtracting || isLoadingInfo || isTabRecording}
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
                  disabled={!videoInfo || isExtracting || isLoadingInfo || isTabRecording}
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
