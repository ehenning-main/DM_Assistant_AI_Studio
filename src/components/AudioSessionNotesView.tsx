import React, { useState } from "react";
import {
  Mic,
  Users,
  Shield,
  Search,
  Copy,
  Check,
  Sword,
  Sparkles,
  Dice5,
  BookOpen,
  Filter,
  MessageSquare,
  Clock,
  Volume2,
  FileAudio
} from "lucide-react";
import { AudioSessionAnalysis, AudioSpeaker, AudioInGameMoment, AudioOutOfCharacterMoment } from "../types";

interface AudioSessionNotesViewProps {
  audioNotes?: AudioSessionAnalysis;
  audioTranscription?: string;
  onUpdateAudioNotes?: (updated: AudioSessionAnalysis) => void;
  onSwitchToAudioUpload?: () => void;
}

export function AudioSessionNotesView({
  audioNotes,
  audioTranscription,
  onUpdateAudioNotes,
  onSwitchToAudioUpload,
}: AudioSessionNotesViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"in_game" | "ooc" | "speakers" | "transcript">("in_game");
  const [speakerFilter, setSpeakerFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // If no audio notes are processed yet
  if (!audioNotes && !audioTranscription) {
    return (
      <div className="p-8 bg-zinc-950 border border-zinc-850 rounded-lg text-center space-y-4" id="audio-notes-empty-state">
        <div className="w-12 h-12 rounded-full bg-red-950/40 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
          <FileAudio className="w-6 h-6" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h4 className="font-fantasy font-semibold text-zinc-100 text-base">
            No Audio Session Notes Processed Yet
          </h4>
          <p className="text-zinc-400 text-xs leading-relaxed font-sans">
            Upload your session audio recording (MP3, WAV, M4A, WebM) or record live in the <strong>Orator's Tomb</strong> to automatically evaluate voices, match character speakers to the DM, extract full transcripts, and separate in-game from out-of-character key moments.
          </p>
        </div>
        {onSwitchToAudioUpload && (
          <button
            onClick={onSwitchToAudioUpload}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded transition shadow cursor-pointer inline-flex items-center gap-1.5"
            id="btn-goto-audio-upload"
          >
            <Mic className="w-4 h-4" /> Open Audio Upload & Recorder
          </button>
        )}
      </div>
    );
  }

  // Handle copying transcript to clipboard
  const handleCopyTranscript = () => {
    const textToCopy = audioNotes?.transcript || audioTranscription || "";
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Parse lines of transcript for filtering and search
  const rawTranscript = audioNotes?.transcript || audioTranscription || "";
  const transcriptLines = rawTranscript
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const filteredLines = transcriptLines.filter((line) => {
    const matchesSearch = searchQuery === "" || line.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpeaker = speakerFilter === "all" || line.toLowerCase().includes(speakerFilter.toLowerCase());
    return matchesSearch && matchesSpeaker;
  });

  const speakers = audioNotes?.speakers || [];
  const inGameMoments = audioNotes?.inGameMoments || [];
  const outOfCharacterMoments = audioNotes?.outOfCharacterMoments || [];

  return (
    <div className="space-y-4" id="audio-session-notes-container">
      {/* Top Header & Metadata Bar */}
      <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-red-950/60 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-fantasy font-semibold text-zinc-100 text-sm tracking-wide">
                AUDIO SESSION INTELLIGENCE
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30">
                Voice Attributed
              </span>
              {audioNotes?.sourceType === "google_drive" && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60 flex items-center gap-1">
                  Google Drive
                </span>
              )}
              {audioNotes?.fileCount && audioNotes.fileCount > 1 ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/80 text-blue-400 border border-blue-800/60">
                  {audioNotes.fileCount} Files Chronologically Unified
                </span>
              ) : audioNotes?.chunkCount && audioNotes.chunkCount > 1 ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  {audioNotes.chunkCount} Acts Unified
                </span>
              ) : null}
            </div>
            <p className="text-zinc-400 text-xs font-sans">
              {audioNotes?.fileNames && audioNotes.fileNames.length > 1
                ? `${audioNotes.fileNames.length} Files: ${audioNotes.fileNames.join(" ➔ ")}`
                : audioNotes?.fileName
                ? `File: ${audioNotes.fileName}`
                : "Audio Recording"}{" "}
              • {speakers.length} Matched Voices • {inGameMoments.length} In-Game Beats • {outOfCharacterMoments.length} OOC Moments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyTranscript}
            className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded text-xs transition flex items-center gap-1.5 cursor-pointer"
            id="btn-copy-audio-transcript"
            title="Copy full verbatim transcript"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied!" : "Copy Transcript"}</span>
          </button>
          {onSwitchToAudioUpload && (
            <button
              onClick={onSwitchToAudioUpload}
              className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-red-400 rounded text-xs transition flex items-center gap-1.5 cursor-pointer"
              id="btn-re-record-audio"
            >
              <Volume2 className="w-3.5 h-3.5 text-red-500" />
              <span>Audio Controls</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-zinc-800 bg-zinc-950/80 rounded-t px-2 pt-1 gap-1 text-xs">
        <button
          onClick={() => setActiveSubTab("in_game")}
          className={`px-3 py-2 border-b-2 font-medium transition flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === "in_game"
              ? "border-red-500 text-red-400 font-semibold bg-zinc-900/40"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
          id="btn-audio-subtab-ingame"
        >
          <Sword className="w-3.5 h-3.5" />
          <span>In-Game Key Moments ({inGameMoments.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("ooc")}
          className={`px-3 py-2 border-b-2 font-medium transition flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === "ooc"
              ? "border-amber-500 text-amber-400 font-semibold bg-zinc-900/40"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
          id="btn-audio-subtab-ooc"
        >
          <Dice5 className="w-3.5 h-3.5" />
          <span>Out-of-Character Moments ({outOfCharacterMoments.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("speakers")}
          className={`px-3 py-2 border-b-2 font-medium transition flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === "speakers"
              ? "border-purple-500 text-purple-400 font-semibold bg-zinc-900/40"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
          id="btn-audio-subtab-speakers"
        >
          <Users className="w-3.5 h-3.5" />
          <span>Voice Attribution ({speakers.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("transcript")}
          className={`px-3 py-2 border-b-2 font-medium transition flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === "transcript"
              ? "border-cyan-500 text-cyan-400 font-semibold bg-zinc-900/40"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
          id="btn-audio-subtab-transcript"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Full Transcript</span>
        </button>
      </div>

      {/* Sub-Tab 1: In-Game Moments */}
      {activeSubTab === "in_game" && (
        <div className="space-y-3 animate-fadeIn" id="audio-ingame-moments-view">
          <p className="text-zinc-400 text-xs font-sans">
            Key story, tactical, and narrative occurrences extracted directly from in-character spoken dialogue and narration.
          </p>
          {inGameMoments.length === 0 ? (
            <div className="p-5 bg-zinc-950 border border-zinc-850 rounded text-center text-xs text-zinc-500">
              No specific in-game moments categorized yet. Check the Full Transcript tab to inspect spoken lines.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {inGameMoments.map((moment, idx) => (
                <div
                  key={idx}
                  className="bg-zinc-950 border border-zinc-850 hover:border-red-500/40 rounded-lg p-3.5 space-y-2 transition shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold ${
                        moment.category === "combat" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                        moment.category === "loot" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                        moment.category === "roleplay" ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" :
                        "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      }`}>
                        {moment.category || "In-Game"}
                      </span>
                      <h5 className="font-sans font-semibold text-zinc-200 text-xs leading-snug">
                        {moment.title}
                      </h5>
                    </div>
                    {moment.timestamp && (
                      <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" /> {moment.timestamp}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-400 text-xs font-sans leading-relaxed">
                    {moment.description}
                  </p>
                  {moment.speakersInvolved && moment.speakersInvolved.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-zinc-900">
                      <span className="text-[10px] font-mono text-zinc-500">Involved:</span>
                      {moment.speakersInvolved.map((spk, sIdx) => (
                        <span
                          key={sIdx}
                          className="text-[10px] px-1.5 py-0.5 bg-zinc-900 text-zinc-300 rounded border border-zinc-800"
                        >
                          {spk}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 2: Out-of-Character Moments */}
      {activeSubTab === "ooc" && (
        <div className="space-y-3 animate-fadeIn" id="audio-ooc-moments-view">
          <p className="text-zinc-400 text-xs font-sans">
            Real table conversations captured in the audio: rules questions, DM adjudications, player humor, and tactical meta-discussion.
          </p>
          {outOfCharacterMoments.length === 0 ? (
            <div className="p-5 bg-zinc-950 border border-zinc-850 rounded text-center text-xs text-zinc-500">
              No out-of-character moments specifically cataloged.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {outOfCharacterMoments.map((moment, idx) => (
                <div
                  key={idx}
                  className="bg-zinc-950 border border-zinc-850 hover:border-amber-500/40 rounded-lg p-3.5 space-y-2 transition shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold ${
                        moment.category === "rules" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                        moment.category === "banter" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                        moment.category === "strategy" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" :
                        "bg-zinc-800 text-zinc-300 border border-zinc-700"
                      }`}>
                        {moment.category || "OOC"}
                      </span>
                      <h5 className="font-sans font-semibold text-zinc-200 text-xs leading-snug">
                        {moment.title}
                      </h5>
                    </div>
                    {moment.timestamp && (
                      <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" /> {moment.timestamp}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-400 text-xs font-sans leading-relaxed">
                    {moment.description}
                  </p>
                  {moment.speakersInvolved && moment.speakersInvolved.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-zinc-900">
                      <span className="text-[10px] font-mono text-zinc-500">Participants:</span>
                      {moment.speakersInvolved.map((spk, sIdx) => (
                        <span
                          key={sIdx}
                          className="text-[10px] px-1.5 py-0.5 bg-zinc-900 text-amber-200/90 rounded border border-zinc-800"
                        >
                          {spk}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 3: Voice & Speaker Attribution */}
      {activeSubTab === "speakers" && (
        <div className="space-y-3 animate-fadeIn" id="audio-speakers-view">
          <p className="text-zinc-400 text-xs font-sans">
            Acoustic evaluation results: matched voices across the Dungeon Master and party characters based on cadence, vocal pitch, and roleplay actions.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {speakers.map((spk, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-zinc-950 border border-zinc-850 rounded-lg space-y-2 hover:border-purple-500/40 transition"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                    spk.role === "DM"
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : spk.role === "Player"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                  }`}>
                    {spk.role}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">ID: {spk.id}</span>
                </div>
                <div>
                  <h5 className="font-fantasy font-semibold text-zinc-200 text-sm">
                    {spk.label}
                  </h5>
                  {spk.characterName && (
                    <p className="text-zinc-400 text-[11px]">
                      Character: <strong className="text-zinc-300">{spk.characterName}</strong> {spk.playerName ? `(Player: ${spk.playerName})` : ""}
                    </p>
                  )}
                </div>
                {spk.voiceCharacteristics && (
                  <div className="bg-zinc-900/60 p-2 rounded text-[11px] text-zinc-400 font-sans italic border border-zinc-850">
                    "{spk.voiceCharacteristics}"
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-Tab 4: Full Verbatim Transcript */}
      {activeSubTab === "transcript" && (
        <div className="space-y-3 animate-fadeIn" id="audio-transcript-view">
          {/* Transcript controls: Search and speaker filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dialogue, dice rolls, spell names..."
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-cyan-500 font-sans"
                id="input-search-transcript"
              />
            </div>

            <div className="flex items-center gap-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-zinc-500" />
              <select
                value={speakerFilter}
                onChange={(e) => setSpeakerFilter(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-cyan-500"
                id="select-speaker-filter"
              >
                <option value="all">All Speakers</option>
                {speakers.map((s, idx) => (
                  <option key={idx} value={s.label}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Transcript lines container */}
          <div className="max-h-[420px] overflow-y-auto space-y-2 p-3 bg-zinc-950 border border-zinc-850 rounded font-sans text-xs">
            {filteredLines.length === 0 ? (
              <p className="text-zinc-500 text-center py-6 italic">
                {rawTranscript ? "No lines match current search/filter." : "No transcript recorded yet."}
              </p>
            ) : (
              filteredLines.map((line, idx) => {
                const isDmLine = line.toLowerCase().includes("[dm") || line.toLowerCase().includes("dungeon master");
                const isOocLine = line.toLowerCase().includes("ooc") || line.toLowerCase().includes("out-of-character");

                return (
                  <div
                    key={idx}
                    className={`p-2 rounded border transition text-zinc-300 leading-relaxed ${
                      isDmLine
                        ? "bg-red-950/15 border-red-900/30 text-red-100/90"
                        : isOocLine
                        ? "bg-amber-950/15 border-amber-900/30 text-amber-100/90"
                        : "bg-zinc-900/40 border-zinc-850 text-zinc-200"
                    }`}
                  >
                    <span className="font-mono text-[10px] text-zinc-500 mr-2 select-none">
                      #{idx + 1}
                    </span>
                    {line}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
