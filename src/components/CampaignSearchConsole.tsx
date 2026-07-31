import React, { useState } from "react";
import { Search, Sparkles, Loader2, BookOpen, User, ArrowRight, History, X, ChevronDown, ChevronUp, Compass, Scroll, Shield, Wand2 } from "lucide-react";
import { Session, HeroCharacter } from "../types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { motion, AnimatePresence } from "motion/react";

interface CampaignSearchConsoleProps {
  campaignName: string;
  campaignSetting?: string;
  campaignDescription?: string;
  sessions: Session[];
  campaignHeroes?: HeroCharacter[];
  onSelectSession: (sessionId: string) => void;
  onEstablishCanon?: (sessionId: string, decreeText: string) => Promise<void>;
}

interface QueryResult {
  query: string;
  answer: string;
  matchingSessions: Array<{ id: string; title: string; date: string }>;
  matchingCharacters: Array<{ name: string; role?: string }>;
  timestamp: string;
}

export function CampaignSearchConsole({
  campaignName,
  campaignSetting,
  campaignDescription,
  sessions,
  campaignHeroes = [],
  onSelectSession,
  onEstablishCanon,
}: CampaignSearchConsoleProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<QueryResult | null>(null);
  const [history, setHistory] = useState<QueryResult[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Canon Decree state
  const [canonSessionId, setCanonSessionId] = useState<string>("");
  const [canonDecreeText, setCanonDecreeText] = useState<string>("");
  const [isSavingCanon, setIsSavingCanon] = useState(false);
  const [canonSavedSuccess, setCanonSavedSuccess] = useState<string | null>(null);

  const presetQuestions = [
    "What magic items & relics has the party found?",
    "Who are all recurring NPCs and what are their roles?",
    "Summarize major plot developments and events so far",
    "What mysteries, clues, or unfulfilled quests remain?",
    "Where is the party currently located?",
  ];

  async function handleSearch(searchPrompt?: string) {
    const textToSearch = searchPrompt || query;
    if (!textToSearch.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setIsExpanded(true);

    try {
      const res = await fetch("/api/query-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: textToSearch.trim(),
          campaignName,
          campaignSetting,
          campaignDescription,
          campaignHeroes,
          sessions,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to search campaign archives.");
      }

      const data = await res.json();

      const newRes: QueryResult = {
        query: textToSearch.trim(),
        answer: data.answer || "No information found.",
        matchingSessions: data.matchingSessions || [],
        matchingCharacters: data.matchingCharacters || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setCurrentResult(newRes);
      setHistory((prev) => [newRes, ...prev.filter((h) => h.query !== newRes.query)].slice(0, 10));
    } catch (err: any) {
      console.error("Campaign query error:", err);
      setSearchError(err.message || "Failed to process search.");
    } finally {
      setIsSearching(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl parchment-glow overflow-hidden shadow-xl transition-all">
      {/* Search Header Bar */}
      <div className="p-4 sm:p-5 bg-zinc-950/80 border-b border-zinc-800/80 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-fantasy font-bold text-zinc-100 text-sm sm:text-base tracking-wide flex items-center gap-2 uppercase">
                Campaign Archives Oracle <Sparkles className="w-4 h-4 text-red-400 animate-pulse" />
              </h3>
              <p className="text-[11px] font-sans text-zinc-400">
                Ask any open question across all session notes, summaries, player journals, PC rosters & NPC lore.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentResult && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 rounded text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
                id="btn-toggle-search-results"
              >
                <span>{isExpanded ? "Collapse Results" : "Show Results"}</span>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-red-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
              </button>
            )}
          </div>
        </div>

        {/* Input Field & Submit Button */}
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 'Where did the party find the Flame Tongue?', 'Who is Lord Vane?', 'Summarize Chapter 2'..."
              className="w-full bg-zinc-900/90 border border-zinc-750 focus:border-red-500 rounded-lg py-2.5 pl-10 pr-10 text-zinc-100 text-xs sm:text-sm font-sans placeholder:text-zinc-500 focus:outline-none transition shadow-inner"
              id="input-campaign-search-query"
            />
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
                id="btn-clear-search-query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => handleSearch()}
            disabled={isSearching || !query.trim()}
            className="px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-sans font-bold text-xs sm:text-sm rounded-lg transition active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md"
            id="btn-submit-campaign-search"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Searching...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 fill-zinc-950" />
                <span>Ask Oracle</span>
              </>
            )}
          </button>
        </div>

        {/* Preset Quick Question Chips */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1">
            <Compass className="w-3 h-3 text-red-400" /> Quick Queries:
          </span>
          {presetQuestions.map((pq, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQuery(pq);
                handleSearch(pq);
              }}
              disabled={isSearching}
              className="px-2.5 py-1 bg-zinc-950 hover:bg-zinc-850 hover:border-red-500/50 border border-zinc-800/80 rounded-md text-[11px] font-sans text-zinc-300 transition text-left cursor-pointer flex items-center gap-1"
            >
              <span>{pq}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading Bar */}
      {isSearching && (
        <div className="p-6 bg-zinc-950/50 text-center space-y-3 border-b border-zinc-800/50">
          <div className="flex justify-center items-center gap-2 text-red-400 font-fantasy">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm uppercase tracking-wider font-bold">
              Consulting Campaign Chronicles & Archives...
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-sans max-w-md mx-auto">
            Cross-referencing all session notes, player journals, PC magic items, and NPC statblocks for "{query}"...
          </p>
        </div>
      )}

      {/* Search Error */}
      {searchError && (
        <div className="p-4 bg-red-950/30 border-b border-red-500/30 text-red-300 text-xs font-sans flex items-center justify-between gap-2">
          <span>⚠️ {searchError}</span>
          <button onClick={() => setSearchError(null)} className="text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Results View */}
      <AnimatePresence>
        {isExpanded && currentResult && !isSearching && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-5 space-y-5 bg-zinc-900/60"
          >
            {/* Query Title & Timestamp */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Scroll className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-xs font-mono text-zinc-400">QueryResult for:</span>
                <span className="font-fantasy font-bold text-sm text-red-300">"{currentResult.query}"</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">{currentResult.timestamp}</span>
            </div>

            {/* AI Generated Oracle Answer */}
            <div className="bg-zinc-950/80 p-5 rounded-lg border border-zinc-800/80 shadow-inner">
              <MarkdownRenderer content={currentResult.answer} />
            </div>

            {/* Interactive Canonical Truth Resolver Widget */}
            {onEstablishCanon && (
              <div className="bg-zinc-950 p-4 border border-amber-500/30 rounded-lg space-y-3 shadow-md" id="canon-truth-resolver-box">
                <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span className="font-fantasy font-bold text-xs uppercase text-amber-300 tracking-wide">
                      Establish Official Campaign Canon
                    </span>
                  </div>
                  <span className="text-[10px] font-sans text-zinc-400 italic">
                    Appends permanent DM decree to session notes
                  </span>
                </div>

                {canonSavedSuccess && (
                  <div className="p-2 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-sans rounded flex items-center justify-between">
                    <span>{canonSavedSuccess}</span>
                    <button onClick={() => setCanonSavedSuccess(null)} className="text-zinc-400 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Session Target Selector */}
                  <div className="space-y-1 md:col-span-1">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">
                      Target Chapter / Session:
                    </label>
                    <select
                      value={canonSessionId || (currentResult.matchingSessions[0]?.id || sessions[0]?.id || "")}
                      onChange={(e) => setCanonSessionId(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-750 text-zinc-200 text-xs font-sans rounded p-2 focus:outline-none focus:border-amber-500"
                      id="select-canon-session-target"
                    >
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} ({s.date || "Chapter"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Decree Ruling Text */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">
                      Canonical Ruling / Decree Text:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={canonDecreeText}
                        onChange={(e) => setCanonDecreeText(e.target.value)}
                        placeholder="e.g. 'DM Ruling: Party received 200 GP as per DM log; player note of 2000 GP is non-canonical.'"
                        className="w-full bg-zinc-900 border border-zinc-750 text-zinc-200 text-xs font-sans rounded py-2 pl-3 pr-20 focus:outline-none focus:border-amber-500 placeholder:text-zinc-600"
                        id="input-canon-decree-text"
                      />
                      <button
                        onClick={async () => {
                          const targetId = canonSessionId || currentResult.matchingSessions[0]?.id || sessions[0]?.id;
                          if (!targetId || !canonDecreeText.trim()) return;
                          setIsSavingCanon(true);
                          try {
                            await onEstablishCanon(targetId, canonDecreeText.trim());
                            setCanonSavedSuccess("📜 Canonical decree saved and appended to Session Chapter notes!");
                            setCanonDecreeText("");
                          } catch (err: any) {
                            alert(`Failed to save canon decree: ${err.message}`);
                          } finally {
                            setIsSavingCanon(false);
                          }
                        }}
                        disabled={isSavingCanon || !canonDecreeText.trim()}
                        className="absolute right-1 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-bold text-[11px] rounded transition flex items-center gap-1 cursor-pointer"
                        id="btn-save-canon-decree"
                      >
                        {isSavingCanon ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save Decree"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Decree Template Shortcuts */}
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-sans pt-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Quick Decree:</span>
                  <button
                    onClick={() => setCanonDecreeText("CANON RULING: The DM Scribe Log record is official canon going forward.")}
                    className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-300 rounded text-[10px]"
                  >
                    Rule for DM Log
                  </button>
                  <button
                    onClick={() => setCanonDecreeText("CANON RULING: The Player Journal entry is accepted as official canon.")}
                    className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-300 rounded text-[10px]"
                  >
                    Rule for Player Note
                  </button>
                </div>
              </div>
            )}

            {/* Matched Session Badges & Matched Characters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Matched Sessions */}
              {currentResult.matchingSessions.length > 0 && (
                <div className="p-3.5 bg-zinc-950 border border-zinc-800/80 rounded-lg space-y-2">
                  <span className="text-[11px] font-mono font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-red-500" />
                    Matching Chapters ({currentResult.matchingSessions.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {currentResult.matchingSessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => onSelectSession(s.id)}
                        className="px-2.5 py-1 bg-zinc-900 hover:bg-red-950/50 border border-zinc-800 hover:border-red-500/50 rounded text-xs font-sans text-zinc-200 transition flex items-center gap-1.5 cursor-pointer text-left"
                        title="Click to switch active workspace to this session chapter"
                      >
                        <span className="font-semibold text-red-300">{s.title}</span>
                        {s.date && <span className="text-[10px] text-zinc-500">({s.date})</span>}
                        <ArrowRight className="w-3 h-3 text-red-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Matched Characters */}
              {currentResult.matchingCharacters.length > 0 && (
                <div className="p-3.5 bg-zinc-950 border border-zinc-800/80 rounded-lg space-y-2">
                  <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-500" />
                    Relevant Characters ({currentResult.matchingCharacters.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {currentResult.matchingCharacters.map((c, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs font-sans text-amber-200 flex items-center gap-1.5"
                      >
                        <span className="font-bold">{c.name}</span>
                        {c.role && <span className="text-[10px] text-zinc-400 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-850">{c.role}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Query History Bar */}
            {history.length > 1 && (
              <div className="pt-3 border-t border-zinc-850 flex items-center gap-2 overflow-x-auto text-xs">
                <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1 shrink-0">
                  <History className="w-3 h-3 text-zinc-400" /> Recent:
                </span>
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(h.query);
                      setCurrentResult(h);
                      setIsExpanded(true);
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-sans transition shrink-0 cursor-pointer border ${
                      currentResult.query === h.query
                        ? "bg-red-950/60 text-red-200 border-red-500/40 font-bold"
                        : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    "{h.query}"
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
