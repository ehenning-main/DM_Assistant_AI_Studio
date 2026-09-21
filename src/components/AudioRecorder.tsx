import React, { useState, useRef } from "react";
import {
  Mic,
  Square,
  Play,
  Pause,
  Loader2,
  Sparkles,
  AlertCircle,
  Volume2,
  Upload,
  FileAudio,
  CheckCircle2,
  Users,
  Trash2,
  ArrowRight,
  Clock,
  HardDrive,
  StopCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  ListOrdered,
  Plus,
  Calendar,
  X
} from "lucide-react";
import {
  AudioSessionAnalysis,
  DriveAudioFile,
  AudioChunkProgress,
  AudioSpeaker,
  AudioInGameMoment,
  AudioOutOfCharacterMoment,
  SessionAudioItem
} from "../types";
import { GoogleDriveAudioPicker } from "./GoogleDriveAudioPicker";
import { downloadDriveByteRange, formatBytes } from "../services/googleDriveService";
import {
  createSessionAudioItemFromFile,
  createSessionAudioItemFromDriveFile,
  sortItemsChronologically,
  recalculateTimeline,
  formatDuration
} from "../services/audioChronologyService";
import { getGoogleAccessToken } from "../firebase";

interface AudioRecorderProps {
  onTranscriptionComplete: (text: string) => void;
  currentTranscription?: string;
  onAudioUpload?: (base64Data: string) => void;
  audioSessionNotes?: AudioSessionAnalysis;
  onAudioAnalysisComplete?: (analysis: AudioSessionAnalysis, rawText: string) => void;
  characterRoster?: Array<{ name: string; playerName?: string; classType?: string; role?: string }>;
  dmName?: string;
  sessionTitle?: string;
  sessionDate?: string;
  onViewSeparateAudioNotes?: () => void;
}

// Slice size for large multi-hour audio files (~15MB chunks)
const CHUNK_SIZE_BYTES = 15 * 1024 * 1024;
const ESTIMATED_MINUTES_PER_CHUNK = 25;

export function AudioRecorder({
  onTranscriptionComplete,
  currentTranscription,
  audioSessionNotes,
  onAudioAnalysisComplete,
  characterRoster,
  dmName = "Dungeon Master (DM)",
  sessionTitle = "Campaign Session",
  sessionDate = "",
  onViewSeparateAudioNotes,
}: AudioRecorderProps) {
  // Playlist / Queue of audio files to process in chronological order
  const [audioQueue, setAudioQueue] = useState<SessionAudioItem[]>([]);

  // Live mic recording state
  const [isRecording, setIsRecording] = useState(false);
  const [micBlob, setMicBlob] = useState<Blob | null>(null);

  // Modals & Drive
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);

  // Audio preview playback
  const [previewingAudioUrl, setPreviewingAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Transcription Engine States
  const [transcribing, setTranscribing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>("");
  const [currentProcessingFileIndex, setCurrentProcessingFileIndex] = useState<number>(0);
  const [chunkProgress, setChunkProgress] = useState<AudioChunkProgress | null>(null);
  const [showLiveTranscript, setShowLiveTranscript] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const abortControllerRef = useRef<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Starts capturing live microphone audio
  async function startRecording() {
    setPermissionError(null);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: "audio/webm" };

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const compiledBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setMicBlob(compiledBlob);

        // Add to audio queue with current timestamp
        const now = Date.now();
        const estSecs = Math.max(15, Math.round(compiledBlob.size / 10000));
        const newItem: SessionAudioItem = {
          id: `live-mic-${now}`,
          source: "live_mic",
          name: `Live_Table_Mic_${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }).replace(/\s+/g, "")}.webm`,
          blob: compiledBlob,
          sizeBytes: compiledBlob.size,
          sizeStr: formatBytes(compiledBlob.size),
          timestamp: now,
          timestampLabel: `${new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} (Live)`,
          timestampSource: "metadata",
          estimatedDurationSeconds: estSecs,
          estimatedDurationStr: formatDuration(estSecs),
          order: audioQueue.length + 1,
          status: "pending",
        };

        const updated = sortItemsChronologically([...audioQueue, newItem]);
        setAudioQueue(updated);

        // Stop mic tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (error: any) {
      console.warn("Unable to capture microphone stream:", error);
      setPermissionError(
        "Microphone not permitted in this frame. You can drag & drop or upload multiple recorded audio files, import from Google Drive, or use the simulation presets below!"
      );
    }
  }

  // Stops live mic recording
  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  // Handles multiple local audio files selected or dropped
  async function handleAudioFilesSelected(files: FileList | File[]) {
    if (!files || files.length === 0) return;
    setPermissionError(null);

    const validFiles: File[] = [];
    const validExts = [".mp3", ".wav", ".m4a", ".ogg", ".webm", ".flac", ".aac", ".opus", ".mp4"];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const hasValidExt = validExts.some((ext) => file.name.toLowerCase().endsWith(ext));
      if (file.type.startsWith("audio/") || file.type.startsWith("video/") || hasValidExt) {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      setPermissionError("Please select valid audio files (.mp3, .wav, .m4a, .ogg, .webm, .flac, .aac).");
      return;
    }

    // Convert to SessionAudioItems with detected timestamps
    const newItems = await Promise.all(
      validFiles.map((file, idx) => createSessionAudioItemFromFile(file, audioQueue.length + idx))
    );

    // Merge and automatically sort chronologically by detected timestamps
    const combined = sortItemsChronologically([...audioQueue, ...newItems]);
    setAudioQueue(combined);
  }

  // Handles Google Drive multi-file selection
  function handleSelectDriveFiles(driveFiles: DriveAudioFile[]) {
    setPermissionError(null);
    if (!driveFiles || driveFiles.length === 0) return;

    // Filter out duplicates that might already be in queue
    const existingDriveIds = new Set(
      audioQueue.filter((item) => item.driveFile).map((item) => item.driveFile!.id)
    );
    const newDriveFiles = driveFiles.filter((df) => !existingDriveIds.has(df.id));

    if (newDriveFiles.length === 0) return;

    const newItems = newDriveFiles.map((df, idx) =>
      createSessionAudioItemFromDriveFile(df, audioQueue.length + idx)
    );

    const combined = sortItemsChronologically([...audioQueue, ...newItems]);
    setAudioQueue(combined);
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAudioFilesSelected(e.dataTransfer.files);
    }
  };

  // Reordering helpers
  function moveItem(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= audioQueue.length) return;

    const copy = [...audioQueue];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    setAudioQueue(recalculateTimeline(copy));
  }

  function removeItem(id: string) {
    const filtered = audioQueue.filter((item) => item.id !== id);
    setAudioQueue(recalculateTimeline(filtered));
  }

  function clearAllQueue() {
    setAudioQueue([]);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    setPreviewingAudioUrl(null);
    setIsPlaying(false);
  }

  function autoSortQueue() {
    const sorted = sortItemsChronologically(audioQueue);
    setAudioQueue(sorted);
  }

  // Audio preview playback
  function handlePlayPreview(item: SessionAudioItem) {
    if (previewingAudioUrl && isPlaying) {
      audioPlayerRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    if (item.blob) {
      const url = URL.createObjectURL(item.blob);
      setPreviewingAudioUrl(url);
      setIsPlaying(true);
      setTimeout(() => {
        audioPlayerRef.current?.play();
      }, 50);
    }
  }

  // Blob to base64 helper
  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        const base64Data = res.split(",")[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Stop / Cancel multi-file processing early
  function handleCancelProcessing() {
    abortControllerRef.current = true;
    setProcessingStage("Cancelling remaining files and finalizing completed transcript...");
  }

  /**
   * Chronological Multi-File Processing Engine:
   * 1. Evaluates all queued files in strict chronological order (#1 -> #2 -> #3)
   * 2. Calculates continuous session timecodes (e.g. File 1: 00:00:00 - 00:45:00, File 2: 00:45:00 - 01:30:00)
   * 3. Slices large individual files (>25MB) into acts if needed
   * 4. Propagates speaker voices & ongoing narrative context across files for seamless character attribution
   */
  async function startProcessingChronologicalQueue() {
    if (audioQueue.length === 0) return;

    abortControllerRef.current = false;
    setTranscribing(true);
    setPermissionError(null);
    setChunkProgress(null);

    const totalFiles = audioQueue.length;
    let accumulatedTranscript = "";
    const accumulatedSpeakers: AudioSpeaker[] = [];
    const accumulatedInGameMoments: AudioInGameMoment[] = [];
    const accumulatedOOCMoments: AudioOutOfCharacterMoment[] = [];
    let runningNarrativeRecap = "";

    // Calculate total session seconds
    let runningSessionSecondsOffset = 0;
    const totalSessionSeconds = audioQueue.reduce((acc, item) => acc + item.estimatedDurationSeconds, 0);

    try {
      const driveToken = await getGoogleAccessToken();

      for (let fileIdx = 0; fileIdx < totalFiles; fileIdx++) {
        if (abortControllerRef.current) break;

        setCurrentProcessingFileIndex(fileIdx);
        const item = audioQueue[fileIdx];

        // Mark item as processing
        setAudioQueue((prev) =>
          prev.map((it, idx) => (idx === fileIdx ? { ...it, status: "processing" } : it))
        );

        const isDrive = item.source === "google_drive" && item.driveFile;
        const totalFileBytes = item.sizeBytes;
        const isMultiChunk = totalFileBytes > 25 * 1024 * 1024;
        const totalChunksForFile = isMultiChunk ? Math.ceil(totalFileBytes / CHUNK_SIZE_BYTES) : 1;

        setProcessingStage(
          `[File ${fileIdx + 1}/${totalFiles}] "${item.name}" • Session Time ${item.sessionTimeRange?.split(" - ")[0] || "00:00:00"}`
        );

        // Process file in chunks (or single chunk if <= 25MB)
        for (let chunkIdx = 0; chunkIdx < totalChunksForFile; chunkIdx++) {
          if (abortControllerRef.current) break;

          const startByte = chunkIdx * CHUNK_SIZE_BYTES;
          const endByte = Math.min(totalFileBytes - 1, (chunkIdx + 1) * CHUNK_SIZE_BYTES - 1);

          // Calculate time offset in session minutes
          const chunkSecondsOffset = runningSessionSecondsOffset + (chunkIdx * ESTIMATED_MINUTES_PER_CHUNK * 60);
          const chunkMinutesOffset = Math.round(chunkSecondsOffset / 60);

          const pct = Math.round(
            ((runningSessionSecondsOffset + ((chunkIdx + 1) * ESTIMATED_MINUTES_PER_CHUNK * 60)) /
              Math.max(1, totalSessionSeconds)) *
              100
          );

          const timeRangeLabel = item.sessionTimeRange || `${chunkMinutesOffset}m`;

          setChunkProgress({
            currentChunk: chunkIdx + 1,
            totalChunks: totalChunksForFile,
            timeRangeLabel: `File ${fileIdx + 1}/${totalFiles} • ${item.name}`,
            percentage: Math.min(99, pct),
            stageMessage: `Analyzing File ${fileIdx + 1} of ${totalFiles} (Act ${chunkIdx + 1}/${totalChunksForFile})`,
            isComplete: false,
            partialTranscript: accumulatedTranscript,
          });

          // Fetch audio bytes
          let base64ChunkData = "";
          let chunkMime = "audio/mpeg";

          if (isDrive && item.driveFile) {
            setProcessingStage(`Streaming Act from Google Drive: "${item.name}" (${formatBytes(endByte - startByte)})...`);

            try {
              const proxyRes = await fetch("/api/drive/audio-chunk-proxy", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${driveToken}`,
                },
                body: JSON.stringify({
                  fileId: item.driveFile.id,
                  startByte,
                  endByte,
                  mimeType: item.driveFile.mimeType,
                }),
              });

              if (proxyRes.ok) {
                const pData = await proxyRes.json();
                base64ChunkData = pData.base64Data;
                chunkMime = pData.mimeType || "audio/mpeg";
              } else {
                throw new Error("Proxy error");
              }
            } catch {
              const chunkBlob = await downloadDriveByteRange(item.driveFile.id, startByte, endByte, item.driveFile.mimeType);
              base64ChunkData = await blobToBase64(chunkBlob);
              chunkMime = chunkBlob.type || "audio/mpeg";
            }
          } else if (item.blob) {
            const chunkBlob = isMultiChunk ? item.blob.slice(startByte, endByte + 1, item.blob.type) : item.blob;
            base64ChunkData = await blobToBase64(chunkBlob);
            chunkMime = item.blob.type || "audio/webm";
          } else {
            throw new Error(`Audio data not found for ${item.name}`);
          }

          // Send to Gemini with speaker memory and chronological context
          setProcessingStage(`Transcribing & Voice-Matching: "${item.name}" (Session Time: ${timeRangeLabel})...`);

          const res = await fetch("/api/process-session-audio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audioData: base64ChunkData,
              mimeType: chunkMime,
              characterRoster: characterRoster || [],
              dmName: dmName || "Dungeon Master (DM)",
              sessionTitle,
              sessionDate,
              chunkIndex: chunkIdx,
              totalChunks: totalChunksForFile,
              timeOffsetMinutes: chunkMinutesOffset,
              previousSpeakers: accumulatedSpeakers,
              previousNarrativeContext: runningNarrativeRecap,
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `Failed to process ${item.name}` }));
            throw new Error(err.error || `Processing failed for ${item.name}`);
          }

          const data = await res.json();

          // Append to transcript with chronological file header
          if (data.transcript) {
            const fileHeader =
              chunkIdx === 0
                ? `\n\n--- 🎬 [RECORDING #${fileIdx + 1}/${totalFiles}: ${item.name}] (${item.sessionTimeRange || timeRangeLabel}) ---\n`
                : isMultiChunk
                ? `\n\n--- ⏱️ [Act ${chunkIdx + 1} continued] ---\n`
                : "";
            accumulatedTranscript += `${fileHeader}${data.transcript}`;
          }

          // Accumulate voice profiles
          if (Array.isArray(data.speakers)) {
            data.speakers.forEach((newSpk: AudioSpeaker) => {
              const existing = accumulatedSpeakers.find((s) => s.label === newSpk.label || s.id === newSpk.id);
              if (!existing) {
                accumulatedSpeakers.push(newSpk);
              }
            });
          }

          if (Array.isArray(data.inGameMoments)) {
            accumulatedInGameMoments.push(...data.inGameMoments);
          }

          if (Array.isArray(data.outOfCharacterMoments)) {
            accumulatedOOCMoments.push(...data.outOfCharacterMoments);
          }

          if (data.chunkNarrativeSummary) {
            runningNarrativeRecap = data.chunkNarrativeSummary;
          }

          // Update live preview
          setChunkProgress((prev) =>
            prev
              ? {
                  ...prev,
                  partialTranscript: accumulatedTranscript,
                }
              : null
          );
        }

        // Advance running session time offset
        runningSessionSecondsOffset += item.estimatedDurationSeconds;

        // Mark item as completed
        setAudioQueue((prev) =>
          prev.map((it, idx) => (idx === fileIdx ? { ...it, status: "completed" } : it))
        );
      }

      // Final Master Assembly
      setProcessingStage("Synthesizing unified chronological campaign notes across all files...");

      const totalDurationStr = formatDuration(totalSessionSeconds);
      const finalAnalysis: AudioSessionAnalysis = {
        transcript: accumulatedTranscript.trim(),
        speakers: accumulatedSpeakers.length > 0 ? accumulatedSpeakers : [{ id: "dm", label: dmName, role: "DM", voiceCharacteristics: "Lead storyteller" }],
        inGameMoments: accumulatedInGameMoments,
        outOfCharacterMoments: accumulatedOOCMoments,
        fileName: totalFiles === 1 ? audioQueue[0].name : `${totalFiles} Session Recordings (Chronological)`,
        fileNames: audioQueue.map((f) => f.name),
        fileCount: totalFiles,
        fileDuration: totalDurationStr,
        processedAt: new Date().toISOString(),
        chunkCount: totalFiles,
        sourceType: totalFiles > 1 ? "multi_file" : audioQueue[0]?.source === "google_drive" ? "google_drive" : "local_upload",
        overallAudioNotesMarkdown: `### 🎙️ Chronological Session Chronicle: Ground Truth
**Sequential Recordings Processed:** ${totalFiles} (${totalDurationStr} session duration)
**Chronological Order:**
${audioQueue.map((f, i) => `${i + 1}. **${f.name}** [${f.sessionTimeRange || "00:00:00"}] (Recorded: ${f.timestampLabel})`).join("\n")}

**Party Voices Identified:** ${accumulatedSpeakers.map((s) => s.label).join(", ") || dmName}
**In-Game Key Moments:** ${accumulatedInGameMoments.length}
**Table Discussions / OOC Moments:** ${accumulatedOOCMoments.length}`,
      };

      if (onAudioAnalysisComplete) {
        onAudioAnalysisComplete(finalAnalysis, accumulatedTranscript.trim());
      } else {
        onTranscriptionComplete(accumulatedTranscript.trim());
      }
    } catch (e: any) {
      console.error("Multi-file audio analysis error:", e);
      setPermissionError(`Audio Scribe Error: ${e.message}`);
    } finally {
      setTranscribing(false);
      setProcessingStage("");
      setChunkProgress((prev) => (prev ? { ...prev, isComplete: true, percentage: 100 } : null));
    }
  }

  // Preset multi-part simulation generator for testing multi-file chronological flows
  async function simulateMultiFileSession() {
    setTranscribing(true);
    setPermissionError(null);
    setProcessingStage("Generating 3 simulated sequential audio recordings with timestamps...");

    // Create 3 audio clips with staggered timestamps (e.g. 7:30 PM, 8:15 PM, 9:00 PM)
    const baseDate = new Date();
    baseDate.setHours(19, 30, 0, 0);

    const part1Time = new Date(baseDate.getTime()).getTime();
    const part2Time = new Date(baseDate.getTime() + 45 * 60 * 1000).getTime();
    const part3Time = new Date(baseDate.getTime() + 90 * 60 * 1000).getTime();

    // Synthesize short test audio blob
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const dest = audioCtx.createMediaStreamDestination();
      osc.connect(dest);
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.start();

      const rec = new MediaRecorder(dest.stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (ev) => chunks.push(ev.data);
      rec.start();

      setTimeout(async () => {
        rec.stop();
        osc.stop();
        rec.onstop = async () => {
          const fakeBlob = new Blob(chunks, { type: "audio/webm" });

          const part1: SessionAudioItem = {
            id: `sim-part-1`,
            source: "simulation",
            name: "Session14_Part1_CryptEntrance.webm",
            blob: fakeBlob,
            sizeBytes: 15000000,
            sizeStr: "15.0 MB",
            timestamp: part1Time,
            timestampLabel: "7:30 PM (Part 1)",
            timestampSource: "filename_sequence",
            estimatedDurationSeconds: 2700, // 45m
            estimatedDurationStr: "45m",
            order: 1,
            sessionTimeRange: "00:00:00 - 00:45:00",
            status: "pending",
          };

          const part2: SessionAudioItem = {
            id: `sim-part-2`,
            source: "simulation",
            name: "Session14_Part2_TombBattle.webm",
            blob: fakeBlob,
            sizeBytes: 16500000,
            sizeStr: "16.5 MB",
            timestamp: part2Time,
            timestampLabel: "8:15 PM (Part 2)",
            timestampSource: "filename_sequence",
            estimatedDurationSeconds: 2700, // 45m
            estimatedDurationStr: "45m",
            order: 2,
            sessionTimeRange: "00:45:00 - 01:30:00",
            status: "pending",
          };

          const part3: SessionAudioItem = {
            id: `sim-part-3`,
            source: "simulation",
            name: "Session14_Part3_LootAndLevelUp.webm",
            blob: fakeBlob,
            sizeBytes: 12000000,
            sizeStr: "12.0 MB",
            timestamp: part3Time,
            timestampLabel: "9:00 PM (Part 3)",
            timestampSource: "filename_sequence",
            estimatedDurationSeconds: 1800, // 30m
            estimatedDurationStr: "30m",
            order: 3,
            sessionTimeRange: "01:30:00 - 02:00:00",
            status: "pending",
          };

          const simQueue = [part1, part2, part3];
          setAudioQueue(simQueue);
          setTranscribing(false);
          setProcessingStage("");
        };
      }, 300);
    } catch {
      setTranscribing(false);
      setProcessingStage("");
    }
  }

  // Single preset simulation
  async function simulateSingleGameAudio(choice: number) {
    setTranscribing(true);
    setPermissionError(null);
    setProcessingStage("Generating sample audio clip...");

    let sampleTitle = "Crypt Skirmish";
    if (choice === 2) sampleTitle = "Archive Infiltration";
    if (choice === 3) sampleTitle = "Dockside Ambush";

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const dest = audioCtx.createMediaStreamDestination();
      osc.connect(dest);
      osc.frequency.setValueAtTime(340, audioCtx.currentTime);
      osc.start();

      const rec = new MediaRecorder(dest.stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (ev) => chunks.push(ev.data);
      rec.start();

      setTimeout(() => {
        rec.stop();
        osc.stop();
        rec.onstop = () => {
          const fakeAudioBlob = new Blob(chunks, { type: "audio/webm" });
          const now = Date.now();
          const newItem: SessionAudioItem = {
            id: `sim-${now}`,
            source: "simulation",
            name: `Simulation_${sampleTitle.replace(/\s+/g, "_")}.webm`,
            blob: fakeAudioBlob,
            sizeBytes: fakeAudioBlob.size,
            sizeStr: formatBytes(fakeAudioBlob.size),
            timestamp: now,
            timestampLabel: `${new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (Sim)`,
            timestampSource: "metadata",
            estimatedDurationSeconds: 1800,
            estimatedDurationStr: "30m",
            order: audioQueue.length + 1,
            status: "pending",
          };

          const combined = sortItemsChronologically([...audioQueue, newItem]);
          setAudioQueue(combined);
          setTranscribing(false);
          setProcessingStage("");
        };
      }, 300);
    } catch {
      setTranscribing(false);
      setProcessingStage("");
    }
  }

  const totalDurationSeconds = audioQueue.reduce((acc, item) => acc + item.estimatedDurationSeconds, 0);
  const totalDurationStr = formatDuration(totalDurationSeconds);
  const totalBytes = audioQueue.reduce((acc, item) => acc + item.sizeBytes, 0);

  return (
    <div
      className="space-y-4 p-5 bg-zinc-900 border border-zinc-800 rounded-lg parchment-glow"
      id="audio-panel-root"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-red-500 animate-pulse" />
          <h3 className="font-fantasy font-semibold text-zinc-100 tracking-wider text-base">
            ORATOR'S TOMB (Multi-File Session Audio)
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
            <Clock className="w-3 h-3" /> Timestamp Ordered
          </span>
          <span className="font-mono text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
            <Layers className="w-3 h-3" /> Multi-File Support
          </span>
        </div>
      </div>

      {permissionError && (
        <div className="flex gap-2 items-start p-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{permissionError}</p>
        </div>
      )}

      {/* Dual Audio Import Inputs (Google Drive & Multi-File Drag-and-Drop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Option 1: Google Drive Import (Multi-File Selection) */}
        <div
          id="btn-open-drive-picker"
          onClick={() => setIsDrivePickerOpen(true)}
          className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 border-stone-800 hover:border-amber-500/60 bg-stone-950/40 hover:bg-stone-950/80"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <HardDrive className="w-5 h-5" />
          </div>

          <div>
            <p className="font-sans font-medium text-xs sm:text-sm text-stone-200 flex items-center justify-center gap-1.5">
              <span>Import from Google Drive</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                Multi-Select
              </span>
            </p>
            <p className="text-stone-400 text-[11px] font-sans mt-0.5">
              Select multiple session parts (.mp3, .m4a, .wav) from Drive
            </p>
          </div>
        </div>

        {/* Option 2: Local Multi-File Upload & Drag-and-Drop */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
            isDragging
              ? "border-red-500 bg-red-950/20"
              : "border-zinc-800 hover:border-red-500/60 bg-zinc-950/40 hover:bg-zinc-950/80"
          }`}
          id="audio-dropzone"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac,.aac,.opus,.mp4"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleAudioFilesSelected(e.target.files);
              }
            }}
            className="hidden"
            id="audio-file-input"
          />

          <div className="w-10 h-10 rounded-xl bg-red-950/50 border border-red-500/30 flex items-center justify-center text-red-400">
            <Upload className="w-5 h-5" />
          </div>

          <div>
            <p className="font-sans font-medium text-xs sm:text-sm text-zinc-200">
              Upload Local Audio Files
            </p>
            <p className="text-zinc-500 text-[11px] font-sans mt-0.5">
              Select or drag multiple files (Part 1, Part 2, etc.)
            </p>
          </div>
        </div>
      </div>

      {/* Live Mic Quick Capture Strip */}
      <div className="flex flex-wrap gap-2.5 items-center justify-between py-2 bg-zinc-950/40 p-3 rounded-lg border border-zinc-850">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Mic className="w-3.5 h-3.5 text-zinc-500" />
          <span>Need live table recording? Capture takes directly in browser:</span>
        </div>

        <div>
          {!isRecording ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                startRecording();
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-sans font-semibold text-xs rounded transition shadow cursor-pointer active:scale-95"
              id="btn-voice-start"
              disabled={transcribing}
            >
              <Mic className="w-3.5 h-3.5" /> Record Live Take
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                stopRecording();
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white font-sans font-semibold text-xs rounded animate-pulse transition cursor-pointer"
              id="btn-voice-stop"
            >
              <Square className="w-3.5 h-3.5 text-red-400 fill-red-400" /> Stop & Add to Session
            </button>
          )}
        </div>
      </div>

      {/* Audio Queue / Playlist Component */}
      {audioQueue.length > 0 && (
        <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3" id="audio-queue-container">
          {/* Header of the Queue */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-850 pb-2.5">
            <div className="flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-semibold text-zinc-200 tracking-wide uppercase font-sans">
                Chronological Session Playlist ({audioQueue.length} {audioQueue.length === 1 ? "File" : "Files"})
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                Total Est: {totalDurationStr} • {formatBytes(totalBytes)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={autoSortQueue}
                className="px-2.5 py-1 text-[11px] bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/60 rounded flex items-center gap-1 transition cursor-pointer"
                title="Sort all files chronologically by detected file modified date or filename timestamps"
                id="btn-auto-sort-chronological"
              >
                <Clock className="w-3 h-3" />
                Auto-Sort by Timestamps
              </button>
              <button
                onClick={clearAllQueue}
                className="px-2 py-1 text-[11px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 border border-zinc-800 rounded flex items-center gap-1 transition cursor-pointer"
                title="Clear all audio files from queue"
                id="btn-clear-audio-queue"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            </div>
          </div>

          <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
            The files below are ordered chronologically based on recording timestamps. Voice profiles and ongoing story context will seamlessly flow from file to file during transcription.
          </p>

          {/* List of Files in Chronological Order */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {audioQueue.map((item, index) => {
              const isCurrentlyProcessing = transcribing && currentProcessingFileIndex === index;
              const isCompleted = item.status === "completed";

              return (
                <div
                  key={item.id}
                  id={`queue-item-${item.id}`}
                  className={`p-3 rounded-lg border flex flex-wrap items-center justify-between gap-3 transition-all ${
                    isCurrentlyProcessing
                      ? "bg-red-950/30 border-red-500/70 shadow-sm"
                      : isCompleted
                      ? "bg-emerald-950/20 border-emerald-800/50"
                      : "bg-zinc-900/70 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {/* Left: Sequence index, File Info, Timestamps */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Sequence Badge */}
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                        isCompleted
                          ? "bg-emerald-500 text-stone-950"
                          : isCurrentlyProcessing
                          ? "bg-red-500 text-stone-950 animate-pulse"
                          : "bg-zinc-800 text-amber-400 border border-zinc-700"
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : `#${item.order}`}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-200 truncate max-w-xs md:max-w-md" title={item.name}>
                          {item.name}
                        </span>
                        {item.source === "google_drive" && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60 font-mono">
                            Drive
                          </span>
                        )}
                        {item.source === "live_mic" && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-950/80 text-red-400 border border-red-800/60 font-mono">
                            Mic Take
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                        <span className="font-mono text-zinc-300">{item.sizeStr}</span>
                        <span>•</span>
                        {/* Detected Timestamp pill */}
                        <span className="flex items-center gap-1 text-amber-400/90 font-mono" title={`Timestamp source: ${item.timestampSource}`}>
                          <Clock className="w-3 h-3 text-amber-400" />
                          {item.timestampLabel}
                        </span>
                        <span>•</span>
                        {/* Continuous timeline range */}
                        <span className="text-blue-400 font-mono font-semibold" title="Assigned chronological campaign session offset">
                          Timeline: {item.sessionTimeRange || `~${item.estimatedDurationStr}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Reorder controls & Playback */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.blob && (
                      <button
                        onClick={() => handlePlayPreview(item)}
                        className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-red-400 rounded transition border border-zinc-700 cursor-pointer"
                        title="Preview audio clip"
                      >
                        {previewingAudioUrl && isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      </button>
                    )}

                    {/* Move Up */}
                    <button
                      onClick={() => moveItem(index, "up")}
                      disabled={index === 0 || transcribing}
                      className="p-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-300 rounded transition border border-zinc-700 cursor-pointer"
                      title="Move earlier in chronological order"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>

                    {/* Move Down */}
                    <button
                      onClick={() => moveItem(index, "down")}
                      disabled={index === audioQueue.length - 1 || transcribing}
                      className="p-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-300 rounded transition border border-zinc-700 cursor-pointer"
                      title="Move later in chronological order"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>

                    {/* Remove */}
                    <button
                      onClick={() => removeItem(item.id)}
                      disabled={transcribing}
                      className="p-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-400 hover:text-red-400 rounded transition border border-zinc-700 cursor-pointer"
                      title="Remove from session playlist"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Master Action Trigger */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-850">
            <div className="text-xs text-zinc-400 flex items-center gap-2 font-sans">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>
                Ready to transcribe <strong>{audioQueue.length} files</strong> in timeline sequence.
              </span>
            </div>

            <button
              onClick={startProcessingChronologicalQueue}
              disabled={transcribing}
              id="btn-process-chronological-queue"
              className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-400 text-zinc-950 font-sans font-bold text-xs rounded-lg transition shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {transcribing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing Session Sequence...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-zinc-950" />
                  Process & Transcribe Chronological Session ({audioQueue.length} {audioQueue.length === 1 ? "File" : "Files"})
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Multi-File Progress Dashboard */}
      {transcribing && (
        <div className="p-4 bg-zinc-950 border border-red-500/40 rounded-lg space-y-3 shadow-lg" id="transcription-progress-panel">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-400 text-xs font-semibold">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {chunkProgress
                  ? `Chronological Scribe: File ${currentProcessingFileIndex + 1} of ${audioQueue.length}`
                  : "AI Audio Scribe Pipeline in Progress"}
              </span>
            </div>
            <button
              onClick={handleCancelProcessing}
              className="text-[11px] px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 flex items-center gap-1 transition cursor-pointer"
              title="Stop remaining files and finalize notes transcribed so far"
            >
              <StopCircle className="w-3 h-3 text-red-400" />
              Stop & Keep Progress
            </button>
          </div>

          {/* Progress Bar */}
          {chunkProgress && (
            <div className="space-y-1.5">
              <div className="w-full h-2 bg-stone-900 rounded-full overflow-hidden border border-stone-800">
                <div
                  className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${Math.max(5, chunkProgress.percentage)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-stone-400">
                <span>{chunkProgress.timeRangeLabel}</span>
                <span>{chunkProgress.percentage}% Complete</span>
              </div>
            </div>
          )}

          <p className="text-[11px] text-zinc-300 font-sans">
            {processingStage || "Forensic voice diarization and speaker role attribution in progress..."}
          </p>

          {/* Live Streaming Transcript Accordion */}
          {chunkProgress && chunkProgress.partialTranscript && (
            <div className="border border-stone-850 rounded-lg bg-stone-900/60 overflow-hidden text-xs">
              <button
                onClick={() => setShowLiveTranscript(!showLiveTranscript)}
                className="w-full px-3 py-1.5 flex items-center justify-between text-stone-400 hover:text-stone-200 bg-stone-950/40 text-[11px]"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Chronological Verbatim Transcript Stream
                </span>
                {showLiveTranscript ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showLiveTranscript && (
                <div className="p-3 max-h-44 overflow-y-auto font-mono text-[11px] text-stone-300 leading-relaxed whitespace-pre-wrap">
                  {chunkProgress.partialTranscript}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Voice Matching Roster Preview */}
      <div className="bg-zinc-950/80 p-3.5 border border-zinc-850 rounded-lg space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-zinc-300 font-sans text-xs font-semibold">
            <Users className="w-3.5 h-3.5 text-red-500" />
            <span>Voice Continuity Across Audio Files</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            DM + {characterRoster?.length || 0} Party Heroes
          </span>
        </div>
        <p className="text-zinc-500 text-[11px] font-sans">
          Speaker identities detected in earlier files are remembered and matched across all subsequent session clips:
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span className="px-2 py-0.5 bg-red-950/40 border border-red-500/30 rounded text-[10px] text-red-300 font-medium">
            👑 {dmName}
          </span>
          {characterRoster && characterRoster.length > 0 ? (
            characterRoster.map((hero, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 font-medium"
              >
                ⚔️ {hero.name} {hero.playerName ? `(${hero.playerName})` : ""}
              </span>
            ))
          ) : (
            <span className="text-[10px] text-zinc-600 italic">
              Party heroes will auto-detect from campaign roster.
            </span>
          )}
        </div>
      </div>

      {/* Processed Results Quick Summary Card */}
      {audioSessionNotes && (
        <div className="p-3.5 bg-zinc-950 border border-red-500/30 rounded-lg space-y-3 shadow-md" id="audio-processed-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Chronological Session Audio Unified
                {audioSessionNotes.fileCount && audioSessionNotes.fileCount > 1 && (
                  <span className="ml-2 font-mono text-[10px] text-emerald-300">
                    ({audioSessionNotes.fileCount} Files Combined)
                  </span>
                )}
              </span>
            </div>
            {onViewSeparateAudioNotes && (
              <button
                onClick={onViewSeparateAudioNotes}
                className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold transition cursor-pointer"
                id="btn-view-audio-notes-tab"
              >
                <span>View Full Audio Notes Tab</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-zinc-900/60 border border-zinc-800 rounded">
              <span className="block text-xs font-bold text-zinc-200">
                {audioSessionNotes.speakers?.length || 0}
              </span>
              <span className="text-[10px] text-zinc-500">Voices Matched</span>
            </div>
            <div className="p-2 bg-zinc-900/60 border border-zinc-800 rounded">
              <span className="block text-xs font-bold text-red-400">
                {audioSessionNotes.inGameMoments?.length || 0}
              </span>
              <span className="text-[10px] text-zinc-500">In-Game Beats</span>
            </div>
            <div className="p-2 bg-zinc-900/60 border border-zinc-800 rounded">
              <span className="block text-xs font-bold text-amber-400">
                {audioSessionNotes.outOfCharacterMoments?.length || 0}
              </span>
              <span className="text-[10px] text-zinc-500">OOC Moments</span>
            </div>
          </div>

          {/* Quick Highlight Preview */}
          {audioSessionNotes.inGameMoments && audioSessionNotes.inGameMoments.length > 0 && (
            <div className="text-[11px] text-zinc-400 bg-zinc-900/40 p-2 rounded border border-zinc-850 space-y-1 font-sans">
              <span className="font-semibold text-zinc-300 block text-[10px] uppercase tracking-wide">
                Top In-Game Highlight:
              </span>
              <p className="line-clamp-2 italic">
                "{audioSessionNotes.inGameMoments[0].title}: {audioSessionNotes.inGameMoments[0].description}"
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tome of Echoes: Preset Multi-File & Single-File Simulations */}
      <div className="bg-zinc-950/60 p-3.5 border border-zinc-800/80 rounded">
        <div className="flex items-center gap-2 text-zinc-400 font-sans text-xs mb-2 font-semibold uppercase tracking-wider">
          <Volume2 className="w-4 h-4 text-red-500" />
          <span>Tome of Echoes (Test Multi-File Chronology & Voice Matching)</span>
        </div>
        <p className="text-zinc-500 text-[11px] mb-2.5">
          Want to test how multiple audio files are ordered and transcribed? Click the multi-file test preset to populate 3 sequential clips with timestamps:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <button
            onClick={simulateMultiFileSession}
            disabled={transcribing}
            className="p-2.5 text-left bg-amber-950/40 hover:bg-amber-900/60 rounded border border-amber-800/60 hover:border-amber-500 transition text-zinc-300 text-xs font-sans cursor-pointer disabled:opacity-50"
            id="simulator-audio-multi"
          >
            ⚡ <span className="font-semibold block text-[11px] text-amber-300">3-Part Session Skirmish</span>
            <span className="text-[10px] text-zinc-400">Loads Part 1, 2, 3 with timestamps (7:30, 8:15, 9:00 PM)</span>
          </button>
          <button
            onClick={() => simulateSingleGameAudio(1)}
            disabled={transcribing}
            className="p-2 text-left bg-zinc-900/70 hover:bg-zinc-800 rounded border border-zinc-800 hover:border-red-500/50 transition text-zinc-300 text-xs font-sans cursor-pointer disabled:opacity-50"
            id="simulator-audio-1"
          >
            ⚔️ <span className="font-semibold block text-[11px] text-red-400">Add Crypt Clip</span>
            <span className="text-[10px] text-zinc-500">DM + Balasar radiant combat clip</span>
          </button>
          <button
            onClick={() => simulateSingleGameAudio(2)}
            disabled={transcribing}
            className="p-2 text-left bg-zinc-900/70 hover:bg-zinc-800 rounded border border-zinc-800 hover:border-red-500/50 transition text-zinc-300 text-xs font-sans cursor-pointer disabled:opacity-50"
            id="simulator-audio-2"
          >
            🌲 <span className="font-semibold block text-[11px] text-red-400">Add Archive Clip</span>
            <span className="text-[10px] text-zinc-500">Elara archmage dialogue clip</span>
          </button>
          <button
            onClick={() => simulateSingleGameAudio(3)}
            disabled={transcribing}
            className="p-2 text-left bg-zinc-900/70 hover:bg-zinc-800 rounded border border-zinc-800 hover:border-red-500/50 transition text-zinc-300 text-xs font-sans cursor-pointer disabled:opacity-50"
            id="simulator-audio-3"
          >
            ⚓ <span className="font-semibold block text-[11px] text-red-400">Add Ambush Clip</span>
            <span className="text-[10px] text-zinc-500">Thunderwave & pirate ballista clip</span>
          </button>
        </div>
      </div>

      {/* Transcript Fallback / Last transcribed snippet */}
      {currentTranscription && !audioSessionNotes && (
        <div className="space-y-1.5 p-3.5 bg-zinc-950 border border-zinc-850 rounded">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-semibold block">
            Last Transcribed Log
          </span>
          <p className="text-zinc-300 text-xs italic font-sans leading-relaxed">
            "{currentTranscription}"
          </p>
        </div>
      )}

      {/* Hidden Audio Player for Previews */}
      {previewingAudioUrl && (
        <audio
          ref={audioPlayerRef}
          src={previewingAudioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}

      {/* Google Drive Audio Picker Modal */}
      <GoogleDriveAudioPicker
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        onSelectDriveFiles={handleSelectDriveFiles}
        alreadySelectedFileIds={audioQueue.filter((it) => it.driveFile).map((it) => it.driveFile!.id)}
      />
    </div>
  );
}
