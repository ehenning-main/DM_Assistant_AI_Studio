import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Sword,
  Wand2,
  Calendar,
  Plus,
  Trash2,
  Save,
  Loader2,
  Lock,
  Globe,
  User,
  LogOut,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Scroll,
  Dices,
  Edit,
  Compass
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { Session, HighlightItem, CharacterItem } from "./types";
import { isRealFirebase, auth, logInWithGoogle, logOutUser } from "./firebase";
import { fetchAllSessions, createNewSession, updateExistingSession, removeSession } from "./storage";

// Modular sub-components
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import { AudioRecorder } from "./components/AudioRecorder";
import { HighlightSection } from "./components/HighlightSection";
import { VideoSection } from "./components/VideoSection";
import { CharacterTracker } from "./components/CharacterTracker";

export default function App() {
  // Authentication & Isomorphic engine states
  const [user, setUser] = useState<{ uid: string; email: string | null; displayName: string | null } | null>(null);
  const [authLoading, setAuthLoading] = useState(isRealFirebase);
  const [isGuestMode, setIsGuestMode] = useState(false);

  // Campaign session collections
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Editor notepad controllers
  const [notes, setNotes] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [audioTranscription, setAudioTranscription] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  // Creation forms states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().substring(0, 10));

  // AI Summary state
  const [summarizing, setSummarizing] = useState(false);

  // Monitor Google Authentication state if Firebase is active
  useEffect(() => {
    if (isRealFirebase && auth) {
      const unsubscribe = auth.onAuthStateChanged((firebaseUser: any) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
          });
          setIsGuestMode(false);
        } else {
          setUser(null);
        }
        setAuthLoading(false);
      });
      return () => unsubscribe();
    } else {
      setAuthLoading(false);
    }
  }, []);

  // Sync sessions based on active DM login user ID
  const activeUserId = user ? user.uid : isGuestMode ? "local_guest_dm" : "";

  useEffect(() => {
    if (activeUserId) {
      loadSessions();
    } else {
      setSessions([]);
      setSelectedSession(null);
    }
  }, [activeUserId]);

  async function loadSessions(selectId?: string) {
    setSessionsLoading(true);
    try {
      const list = await fetchAllSessions(activeUserId);
      setSessions(list);
      
      if (list.length > 0) {
        // Select specified or first session by default
        const target = selectId ? list.find((s) => s.id === selectId) : list[0];
        const nextActive = target || list[0];
        setSelectedSession(nextActive);
        
        setSessionTitle(nextActive.title);
        setSessionDate(nextActive.date);
        setNotes(nextActive.notes);
        setAudioTranscription(nextActive.audioTranscription || "");
      } else {
        setSelectedSession(null);
      }
    } catch (e) {
      console.error("Sessions retrieval anomaly:", e);
    } finally {
      setSessionsLoading(false);
    }
  }

  // Handle log out or exit guest mode
  function triggerLogout() {
    if (isRealFirebase) {
      logOutUser().catch(console.error);
    }
    setUser(null);
    setIsGuestMode(false);
    setSelectedSession(null);
  }

  // Action: Launch a new game session chapter
  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !activeUserId) return;

    const newId = "session-" + Date.now();
    const newSessionItem: Session = {
      id: newId,
      userId: activeUserId,
      title: newTitle.trim(),
      date: newDate,
      notes: "## 📒 DM RAW LOGS\n\n- The adventure begins...\n- Write combat logs or encounter details here.",
      highlights: [],
      characters: [],
      videoStatus: "idle",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSessionsLoading(true);
    try {
      await createNewSession(newSessionItem);
      setNewTitle("");
      setShowCreateModal(false);
      await loadSessions(newId);
    } catch (e) {
      console.error("Save anomaly:", e);
    } finally {
      setSessionsLoading(false);
    }
  }

  // Action: Saves written notes or transcription changes
  async function saveSessionChanges() {
    if (!selectedSession || !activeUserId) return;
    setNotesSaving(true);

    const updated: Session = {
      ...selectedSession,
      title: sessionTitle,
      date: sessionDate,
      notes: notes,
      audioTranscription: audioTranscription,
      updatedAt: new Date().toISOString(),
    };

    try {
      await updateExistingSession(updated);
      setSelectedSession(updated);
      
      // Update local listing reference
      setSessions((prev) =>
        prev.map((s) => (s.id === selectedSession.id ? updated : s))
      );
    } catch (error) {
      console.error(error);
    } finally {
      setNotesSaving(false);
    }
  }

  // Action: Delete full session chapter
  async function handleDeleteSession(id: string) {
    if (!id || !activeUserId) return;
    const accept = confirm("Are you sure you want to permanently delete this session from your chronicles? This cannot be undone.");
    if (!accept) return;

    try {
      await removeSession(id, activeUserId);
      await loadSessions();
    } catch (e) {
      console.error("Deletion failure:", e);
    }
  }

  // Quick notepad Templates injector for DMs
  function injectTemplate(templateName: string) {
    let str = "";
    if (templateName === "combat") {
      str = "\n\n### ⚔️ COMBAT INITIATIVE TRACKER\n- **Monsters**: Goblins (HP 8, AC 12)\n- **Initiative Order**:\n  1. Rogue Balasar (Roll: 18)\n  2. Goblins (Roll: 12)\n  3. Fighter Galahad (Roll: 9)\n- **Skirmish Ledger**:\n  - Round 1: Rogue sneak attacks Goblin #1 for 12 piercing damage. Defeated.";
    } else if (templateName === "npc") {
      str = "\n\n### 👥 IMPROVISED NPC JOURNAL\n- **Name**: Barnaby the Brewer\n- **Role**: Town shopkeeper ally\n- **Disposition**: Friendly but highly paranoid\n- **Bio/Secrets**: Reveals goblins steal grain sacks. Offers 5% tavern discount.";
    } else {
      str = "\n\n### 🪙 LOOT & REWARDS LEDGER\n- **Magic Items Found**: Boots of Elvenkind (requires attunement)\n- **Gemstones Key**: Sapphire gem worth 100 gold pieces\n- **Coin Sacks**: 80 silver pieces, 30 gold coins.";
    }
    setNotes((prev) => prev + str);
  }

  // Action: Triggers cloud Generative Summary API
  async function generateAISummary() {
    if (!selectedSession) return;
    setSummarizing(true);

    try {
      const res = await fetch("/api/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: sessionTitle,
          date: sessionDate,
          notes: notes,
          audioTranscription: audioTranscription,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to parse summary.");
      }

      const data = await res.json();
      
      const updated: Session = {
        ...selectedSession,
        summary: data.summary,
      };

      await updateExistingSession(updated);
      setSelectedSession(updated);
      
      setSessions((prev) =>
        prev.map((s) => (s.id === selectedSession.id ? updated : s))
      );
    } catch (e: any) {
      alert(`Arcane summaries bottleneck: ${e.message}`);
    } finally {
      setSummarizing(false);
    }
  }

  // Callback: Handles dynamic video payload tracking
  function handleVideoUpdate(fields: {
    videoUrl?: string;
    videoStatus?: "idle" | "generating" | "done" | "error";
    videoOperationName?: string;
  }) {
    if (!selectedSession) return;
    const updated: Session = {
      ...selectedSession,
      ...fields,
    };
    updateExistingSession(updated).then(() => {
      setSelectedSession(updated);
      setSessions((prev) =>
        prev.map((s) => (s.id === selectedSession.id ? updated : s))
      );
    });
  }

  // Render Authentication Portal if not logged in
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-100 font-fantasy">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
          <span className="text-sm tracking-widest text-zinc-400">UNROLLING ARCANE PARCHMENTS...</span>
        </div>
      </div>
    );
  }

  if (!activeUserId) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 selection:bg-amber-600 selection:text-black">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-lg p-8 shadow-2xl space-y-6 text-center shadow-amber-950/20 relative overflow-hidden"
          id="auth-canvas"
        >
          {/* Subtle design patterns in corners */}
          <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-amber-500/20" />
          <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-amber-500/20" />

          <div className="space-y-2">
            <div className="inline-flex p-3 bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20 mb-1">
              <Scroll className="w-10 h-10 animate-pulse" />
            </div>
            <h1 className="font-fantasy font-extrabold text-2xl tracking-wider text-amber-400 uppercase">
              DUNGEON MASTER
            </h1>
            <h2 className="font-fantasy font-medium text-xs tracking-widest text-zinc-400 uppercase">
              Campaign Chronicle & Scribe Gate
            </h2>
          </div>

          <p className="text-zinc-400 text-xs sm:text-sm font-sans leading-relaxed">
            Record session soundtracks, catalog improvisational NPCs, paint gorgeous concept highlights, and auto-synthesize summaries using high-performance Gemini intelligence.
          </p>

          <div className="space-y-3 pt-3">
            {isRealFirebase ? (
              <button
                onClick={() => logInWithGoogle().catch((e) => alert(e.message))}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-sans font-bold text-sm rounded shadow-lg hover:shadow-amber-500/10 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
                id="btn-login-google"
              >
                <Globe className="w-4.5 h-4.5" /> Sign In with Google
              </button>
            ) : (
              <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded text-amber-300 text-[11px] font-sans flex items-center gap-2 text-left leading-normal">
                <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
                <span>Cloud persistent mode is currently idle. Enter using guest portal; you can securely enable cloud databases anytime after setup.</span>
              </div>
            )}

            <button
              onClick={() => setIsGuestMode(true)}
              className="w-full py-2.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 hover:text-amber-400 font-sans font-semibold text-xs rounded transition uppercase tracking-wide border border-zinc-800 cursor-pointer"
              id="btn-login-guest"
            >
              Enter Guest Portal (Local state)
            </button>
          </div>

          <div className="border-t border-zinc-850 pt-4">
            <span className="text-[10px] text-zinc-500 font-mono flex items-center justify-center gap-1">
              <Dices className="w-3.5 h-3.5" /> ROLL 20 TO RESOLVE INITIATIVE
            </span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-zinc-950">
      {/* Header element */}
      <header className="bg-zinc-900/90 backdrop-blur border-b border-zinc-800 py-4 px-4 sm:px-6 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-6 h-6 text-amber-400 animate-pulse" />
          <div>
            <h1 className="font-fantasy font-black tracking-widest text-zinc-100 text-sm sm:text-base md:text-lg flex items-center gap-1.5 uppercase">
              DUNGEON MASTER <span className="text-amber-400">ASSISTANT</span>
            </h1>
            <span className="text-[10px] font-mono text-zinc-400 tracking-wide block sm:inline">
              Campaign Book of Memories
            </span>
          </div>
        </div>

        {/* Sync Indicator panel info */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs select-none">
            {isRealFirebase ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-emerald-400 font-mono text-[10px]">CLOUD SYNC INTACT</span>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-amber-500 font-mono text-[10px]">LOCAL ENGINE FALLBACK</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-medium hidden sm:inline">
              DM {user?.displayName || "Guest Master"}
            </span>
            <button
              onClick={triggerLogout}
              className="p-1.5 hover:bg-red-950/40 text-zinc-400 hover:text-red-500 rounded transition border border-zinc-800"
              title="Leave Assistant Gate"
              id="btn-header-logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Persistence Notification Alert Banner */}
      {!isRealFirebase && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-xs text-amber-300 flex items-center justify-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            Currently in local mode. To back up campaign logs permanently in a secure cloud database, ask me in the chat to <strong>"initialize Firebase"</strong>!
          </span>
        </div>
      )}

      {/* Main Grid split */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left column sidebar lists */}
        <aside className="w-full lg:w-72 bg-zinc-950/50 border-r border-b lg:border-b-0 border-zinc-800 flex flex-col shrink-0">
          <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/10">
            <div className="flex items-center gap-1.5">
              <Scroll className="w-4 h-4 text-amber-500" />
              <span className="text-xs uppercase font-fantasy tracking-wider font-semibold text-zinc-300">
                CAMPAIGN CHAPTERS
              </span>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-1.5 bg-amber-500/15 text-amber-400 hover:bg-amber-500 hover:text-zinc-950 rounded transition border border-amber-500/30"
              id="btn-sidebar-plus-char"
              title="Add Campaign Session"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Chapters listing */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 max-h-[300px] lg:max-h-none">
            {sessionsLoading && sessions.length === 0 ? (
              <div className="flex items-center justify-center p-4 text-xs text-zinc-500 font-sans">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Unsealing codex...
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500 italic font-sans leading-normal">
                No session chapters created yet. Click the "+" button above to start your legend!
              </div>
            ) : (
              sessions.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedSession(item);
                    setSessionTitle(item.title);
                    setSessionDate(item.date);
                    setNotes(item.notes);
                    setAudioTranscription(item.audioTranscription || "");
                  }}
                  className={`group w-full p-3.5 text-left rounded border transition flex items-center justify-between cursor-pointer ${
                    selectedSession?.id === item.id
                      ? "bg-amber-500/10 border-amber-500/40 text-amber-400 parchment-glow"
                      : "bg-zinc-900/40 border-zinc-850 hover:bg-zinc-900 hover:border-zinc-700 text-zinc-300"
                  }`}
                  id={`side-session-${item.id}`}
                >
                  <div className="space-y-1 min-w-0 pr-2">
                    <h3 className="font-fantasy font-bold text-xs md:text-sm truncate tracking-wide">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                      <Calendar className="w-3 h-3 text-zinc-650" />
                      <span>{item.date}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(item.id);
                      }}
                      className="p-1 hover:bg-red-950/40 text-zinc-600 hover:text-red-400 rounded transition opacity-0 group-hover:opacity-100"
                      title="Annihilate Session Logs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-amber-500" />
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Right column main detail panels scroll container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <AnimatePresence mode="wait">
            {!selectedSession ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-center p-8 bg-zinc-900/10 border border-zinc-850 rounded-lg min-h-[400px]"
                id="empty-welcome-panel"
              >
                <div className="inline-flex p-3 bg-zinc-900 border border-zinc-800 rounded-full mb-3 text-amber-500 max-w-max mx-auto shadow-md">
                  <Compass className="w-10 h-10 animate-spin-slow text-amber-500" />
                </div>
                <h2 className="font-fantasy font-bold text-lg text-zinc-200 uppercase tracking-widest">
                  Ready to Scribe, DM?
                </h2>
                <p className="text-zinc-500 text-xs sm:text-sm mt-1 max-w-[420px] font-sans leading-normal">
                  No active session chapter selected. Pick an existing campaign from the sidebar or click the "+" button to unscroll a new chronicle page!
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-sans font-bold text-xs rounded transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                  id="btn-empty-add-character"
                >
                  <Plus className="w-4 h-4" /> Begin New Session Chapter
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={selectedSession.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
                id="active-session-stage"
              >
                {/* Meta details Header banner */}
                <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 parchment-glow">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-amber-500 tracking-widest uppercase font-bold flex items-center gap-1">
                      <Scroll className="w-3.5 h-3.5" /> ACTIVE STORY LEDGER
                    </span>
                    <input
                      type="text"
                      value={sessionTitle}
                      onChange={(e) => setSessionTitle(e.target.value)}
                      className="font-fantasy font-extrabold text-xl sm:text-2xl text-zinc-100 tracking-wide bg-transparent border-b border-transparent focus:border-amber-500 focus:outline-none focus:bg-zinc-950/20 px-1 transition"
                    />
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                      <input
                        type="date"
                        value={sessionDate}
                        onChange={(e) => setSessionDate(e.target.value)}
                        className="bg-zinc-950/80 text-zinc-400 text-xs py-0.5 px-1.5 border border-zinc-800 rounded focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={saveSessionChanges}
                      disabled={notesSaving}
                      className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-sans font-bold text-xs sm:text-sm rounded transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                      id="btn-save-meta-ledger"
                    >
                      {notesSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 fill-zinc-955" /> Save Spellbook
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Subsections: Notes notepad + recorder split */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Left panel: Raw written notes */}
                  <div className="space-y-4 p-5 bg-zinc-900 border border-zinc-800 rounded-lg parchment-glow flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                        <div className="flex items-center gap-2">
                          <Edit className="w-5 h-5 text-amber-500 animate-pulse" />
                          <h3 className="font-fantasy font-semibold text-zinc-100 tracking-wider text-base uppercase">
                            Adventure Log & Scribe Ledger
                          </h3>
                        </div>
                        <span className="font-mono text-[10px] text-zinc-500">
                          Supports Markdown markup
                        </span>
                      </div>

                      {/* Fast templates injection toolbar */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-zinc-400 font-mono">Inject template:</span>
                        <button
                          onClick={() => injectTemplate("combat")}
                          className="px-2 py-1 bg-zinc-950 text-[10px] border border-zinc-800 hover:border-amber-500 hover:text-amber-400 rounded transition cursor-pointer"
                          id="btn-template-combat"
                        >
                          ⚔️ Combat Tracker
                        </button>
                        <button
                          onClick={() => injectTemplate("npc")}
                          className="px-2 py-1 bg-zinc-950 text-[10px] border border-zinc-800 hover:border-amber-500 hover:text-amber-400 rounded transition cursor-pointer"
                          id="btn-template-npc"
                        >
                          👤 Improv NPC
                        </button>
                        <button
                          onClick={() => injectTemplate("loot")}
                          className="px-2 py-1 bg-zinc-950 text-[10px] border border-zinc-800 hover:border-amber-500 hover:text-amber-400 rounded transition cursor-pointer"
                          id="btn-template-loot"
                        >
                          🪙 Gold / Magic Loot
                        </button>
                      </div>

                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Detail story happenings, dice rolls, campaigns events, player dialogue..."
                        rows={12}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded p-4 text-zinc-200 text-sm font-sans focus:outline-none focus:border-amber-500 font-sans leading-relaxed transition"
                        id="raw-notes-notepad"
                      />
                    </div>

                    <div className="flex justify-end pt-3">
                      <button
                        onClick={saveSessionChanges}
                        disabled={notesSaving}
                        className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-amber-400 rounded text-xs transition font-semibold"
                        id="btn-quick-save-notes"
                      >
                        {notesSaving ? "Saving Ledger..." : "💾 Quick Save Logs"}
                      </button>
                    </div>
                  </div>

                  {/* Right panel: Audio recorder */}
                  <div className="space-y-4 flex flex-col">
                    <AudioRecorder
                      onTranscriptionComplete={(text) => {
                        setAudioTranscription(text);
                        // Auto-append transcription to campaign notes
                        setNotes((prev) => prev + `\n\n### 🎙️ VOICE CHRONICLE RECORDING\n- ${text}`);
                        saveSessionChanges();
                      }}
                      currentTranscription={audioTranscription}
                      onAudioUpload={async (base64) => {
                        // Keep track of audio or update status
                      }}
                    />

                    {/* Integrated summaries triggers */}
                    <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-lg parchment-glow text-center space-y-4">
                      <div className="flex items-center gap-1.5 justify-center text-amber-500">
                        <Wand2 className="w-5 h-5 animate-spin-slow" />
                        <h4 className="font-fantasy font-bold tracking-wider text-sm uppercase">
                          AI Chronological Synthesis
                        </h4>
                      </div>
                      <p className="text-zinc-400 text-xs tracking-normal leading-relaxed max-w-[340px] mx-auto font-sans">
                        Fuses both the Adventure logs and transcribes to autogenerate themed campaigns overviews, combat highlight stats, mysteries, loot indices, and more.
                      </p>
                      <button
                        onClick={generateAISummary}
                        disabled={summarizing}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-sans font-bold text-xs sm:text-sm rounded transition active:scale-95 flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                        id="btn-ai-synthesize"
                      >
                        {summarizing ? (
                          <>
                            <Loader2 className="w-4.5 h-4.5 animate-spin" /> Channeling Arcane AI...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4.5 h-4.5 fill-zinc-950" /> Compile Campaign Chronicle Summary
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI Summary Display Container - Parchment paper styling */}
                <div className="p-6 md:p-8 bg-zinc-900 border border-zinc-800 rounded-lg parchment-glow relative" id="summary-section">
                  <div className="absolute top-0 left-0 w-2 h-20 bg-amber-500/20" />
                  <div className="absolute top-0 left-0 w-20 h-2 bg-amber-500/20" />
                  
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Scroll className="w-6 h-6 text-amber-500 animate-pulse" />
                      <h3 className="font-fantasy font-bold text-base md:text-lg tracking-wider text-zinc-100 uppercase">
                        📜 CHRONICLE SUMMARY & SPELLBOOK NOTES
                      </h3>
                    </div>
                    {summarizing && (
                      <span className="text-xs text-amber-500 flex items-center gap-1.5 font-sans italic animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scribing timeline...
                      </span>
                    )}
                  </div>

                  <div className="bg-zinc-950/40 p-5 rounded border border-zinc-850">
                    <MarkdownRenderer content={selectedSession.summary || ""} />
                  </div>
                </div>

                {/* Media Section: Static High-lighting & Cinematic video */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Highlights section */}
                  <HighlightSection
                    highlights={selectedSession.highlights || []}
                    onChange={(updated) => {
                      const updatedSession = { ...selectedSession, highlights: updated };
                      updateExistingSession(updatedSession).then(() => {
                        setSelectedSession(updatedSession);
                        setSessions((prev) =>
                          prev.map((s) => (s.id === selectedSession.id ? updatedSession : s))
                        );
                      });
                    }}
                  />

                  {/* Short video section */}
                  <VideoSection
                    sessionId={selectedSession.id}
                    videoUrl={selectedSession.videoUrl}
                    videoStatus={selectedSession.videoStatus}
                    videoOperationName={selectedSession.videoOperationName}
                    highlights={selectedSession.highlights || []}
                    onVideoUpdated={handleVideoUpdate}
                  />
                </div>

                {/* Characters Tracker Section */}
                <CharacterTracker
                  characters={selectedSession.characters || []}
                  onChange={(updated) => {
                    const updatedSession = { ...selectedSession, characters: updated };
                    updateExistingSession(updatedSession).then(() => {
                      setSelectedSession(updatedSession);
                      setSessions((prev) =>
                        prev.map((s) => (s.id === selectedSession.id ? updatedSession : s))
                      );
                    });
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Campaign Chapter Creation Modal Dialog */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-zinc-90 w bg-zinc-900 border border-zinc-800 rounded-lg p-6 shadow-2xl relative"
            id="creation-modal-dialog"
          >
            <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-amber-500/20" />
            
            <h2 className="font-fantasy font-extrabold text-base uppercase text-amber-400 tracking-wider mb-4 border-b border-zinc-800 pb-2">
              📕 Initiate Campaign Chapter
            </h2>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block tracking-wider font-semibold">
                  Chapter/Campaign Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="The Crypts of Strahd, Slumbering Kraken..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-amber-500 font-sans"
                  id="new-session-title-input"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block tracking-wider font-semibold">
                  Campaign Date
                </label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 bg-zinc-800 text-zinc-300 rounded font-sans text-xs transition hover:bg-zinc-700 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-sans font-bold text-xs rounded transition uppercase tracking-wide cursor-pointer"
                  id="btn-create-chapter-confirm"
                >
                  Summon Scroll
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
