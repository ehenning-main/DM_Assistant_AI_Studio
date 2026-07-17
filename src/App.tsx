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
  Users,
  LogOut,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Link,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Scroll,
  Dices,
  Edit,
  Compass,
  ArrowUpDown,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { Session, Campaign, HighlightItem, CharacterItem } from "./types";
import { isRealFirebase, auth, logInWithGoogle, logOutUser } from "./firebase";
import {
  fetchAllCampaigns,
  createNewCampaign,
  updateExistingCampaign,
  removeCampaign,
  fetchAllSessions,
  createNewSession,
  updateExistingSession,
  removeSession,
} from "./storage";

// Modular sub-components
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import { AudioRecorder } from "./components/AudioRecorder";
import { HighlightSection } from "./components/HighlightSection";
import { VideoSection } from "./components/VideoSection";
import { CharacterTracker } from "./components/CharacterTracker";
import { MediaForgeWizard } from "./components/MediaForgeWizard";
import { HeroPartyTracker } from "./components/HeroPartyTracker";

export default function App() {
  // Authentication & Isomorphic engine states
  const [user, setUser] = useState<{ uid: string; email: string | null; displayName: string | null } | null>(null);
  const [authLoading, setAuthLoading] = useState(isRealFirebase);
  const [isGuestMode, setIsGuestMode] = useState(false);

  // Campaign parent collections
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");

  // Campaign creation / edit states
  const [showCreateCampaignModal, setShowCreateCampaignModal] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignSetting, setNewCampaignSetting] = useState("");
  const [newCampaignDesc, setNewCampaignDesc] = useState("");
  const [newCampaignDndBeyondUrl, setNewCampaignDndBeyondUrl] = useState("");
  const [newCampaignDndBeyondNotes, setNewCampaignDndBeyondNotes] = useState("");

  const [showEditCampaignModal, setShowEditCampaignModal] = useState(false);
  const [editCampaignName, setEditCampaignName] = useState("");
  const [editCampaignSetting, setEditCampaignSetting] = useState("");
  const [editCampaignDesc, setEditCampaignDesc] = useState("");
  const [editCampaignDndBeyondUrl, setEditCampaignDndBeyondUrl] = useState("");
  const [editCampaignDndBeyondNotes, setEditCampaignDndBeyondNotes] = useState("");

  // UI-based Delete Confirmation states
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);

  // Campaign session collections
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Editor notepad controllers
  const [notes, setNotes] = useState("");
  const [playerNotes, setPlayerNotes] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [audioTranscription, setAudioTranscription] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [activeNoteTab, setActiveNoteTab] = useState<"dm" | "player">("dm");
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"chapters" | "party">("chapters");
  const [isLoreExpanded, setIsLoreExpanded] = useState(false);
  const [sessionSortMode, setSessionSortMode] = useState<"date-desc" | "date-asc" | "name-asc" | "name-desc" | "manual">(() => {
    return (localStorage.getItem("session_sort_mode") as any) || "date-desc";
  });

  const handleSortModeChange = (mode: "date-desc" | "date-asc" | "name-asc" | "name-desc" | "manual") => {
    setSessionSortMode(mode);
    localStorage.setItem("session_sort_mode", mode);
  };

  // Creation forms states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().substring(0, 10));

  // AI Summary state
  const [summarizing, setSummarizing] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  useEffect(() => {
    setIsResetConfirmOpen(false);
  }, [selectedSession?.id]);

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
      loadCampaignsAndSessions();
    } else {
      setCampaigns([]);
      setSelectedCampaignId("");
      setSessions([]);
      setSelectedSession(null);
    }
  }, [activeUserId]);

  async function loadCampaignsAndSessions(targetCampaignId?: string, targetSessionId?: string) {
    if (!activeUserId) return;
    setCampaignsLoading(true);
    setSessionsLoading(true);
    try {
      // 1. Fetch campaigns
      let campaignList = await fetchAllCampaigns(activeUserId);
      
      // Auto-seed standard default campaign if list is totally empty
      if (campaignList.length === 0) {
        const defaultCamp: Campaign = {
          id: "campaign-default-" + Date.now(),
          userId: activeUserId,
          name: "Chronicles of Eternia",
          setting: "D&D 5th Edition",
          description: "A high-fantasy chronicle following the quest across the kingdoms of Eternia.",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await createNewCampaign(defaultCamp);
        campaignList = [defaultCamp];
      }
      
      setCampaigns(campaignList);
      
      // Select appropriate campaign
      const campExists = campaignList.some((c) => c.id === selectedCampaignId);
      const campId = targetCampaignId || (campExists ? selectedCampaignId : "") || campaignList[0]?.id || "";
      setSelectedCampaignId(campId);
      
      // 2. Fetch sessions
      const sessionList = await fetchAllSessions(activeUserId);
      setSessions(sessionList);
      
      // Filter sessions active for this campaign
      const campSessions = sessionList.filter((s) => s.campaignId === campId);
      if (campSessions.length > 0) {
        const target = targetSessionId 
          ? campSessions.find((s) => s.id === targetSessionId) 
          : campSessions[0];
        const nextActive = target || campSessions[0];
        setSelectedSession(nextActive);
        setSessionTitle(nextActive.title);
        setSessionDate(nextActive.date);
        setNotes(nextActive.notes);
        setPlayerNotes(nextActive.playerNotes || "");
        setAudioTranscription(nextActive.audioTranscription || "");
      } else {
        setSelectedSession(null);
      }
    } catch (e) {
      console.error("Retrieved err:", e);
    } finally {
      setCampaignsLoading(false);
      setSessionsLoading(false);
    }
  }

  async function handleSelectCampaign(campId: string) {
    setSelectedCampaignId(campId);
    
    // Filter sessions active for this campaign
    const campSessions = sessions.filter((s) => s.campaignId === campId);
    if (campSessions.length > 0) {
      const nextActive = campSessions[0];
      setSelectedSession(nextActive);
      setSessionTitle(nextActive.title);
      setSessionDate(nextActive.date);
      setNotes(nextActive.notes);
      setPlayerNotes(nextActive.playerNotes || "");
      setAudioTranscription(nextActive.audioTranscription || "");
    } else {
      setSelectedSession(null);
    }
  }

  const sortedCampSessions = React.useMemo(() => {
    const filtered = sessions.filter((s) => s.campaignId === selectedCampaignId);
    return [...filtered].sort((a, b) => {
      if (sessionSortMode === "date-desc") {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        const uA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const uB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return uB - uA;
      } else if (sessionSortMode === "date-asc") {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        if (timeA !== timeB) return timeA - timeB;
        const uA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const uB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return uA - uB;
      } else if (sessionSortMode === "name-asc") {
        return (a.title || "").localeCompare(b.title || "");
      } else if (sessionSortMode === "name-desc") {
        return (b.title || "").localeCompare(a.title || "");
      } else if (sessionSortMode === "manual") {
        const orderA = a.order !== undefined && a.order !== null ? a.order : 999999;
        const orderB = b.order !== undefined && b.order !== null ? b.order : 999999;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        // Fallback to newest date
        const dtimeA = a.date ? new Date(a.date).getTime() : 0;
        const dtimeB = b.date ? new Date(b.date).getTime() : 0;
        return dtimeB - dtimeA;
      }
      return 0;
    });
  }, [sessions, selectedCampaignId, sessionSortMode]);

  async function handleMoveSession(sessionId: string, direction: "up" | "down") {
    const list = [...sortedCampSessions];
    const idx = list.findIndex((s) => s.id === sessionId);
    if (idx === -1) return;

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    // Swap elements
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;

    // Re-assign explicit orders
    const updatedWithOrder = list.map((session, index) => ({
      ...session,
      order: index,
    }));

    // Optimistically update local React state
    setSessions((prev) =>
      prev.map((s) => {
        const matched = updatedWithOrder.find((u) => u.id === s.id);
        return matched ? { ...s, order: matched.order } : s;
      })
    );

    if (selectedSession) {
      const activeMatch = updatedWithOrder.find((u) => u.id === selectedSession.id);
      if (activeMatch) {
        setSelectedSession(activeMatch);
      }
    }

    try {
      await Promise.all(
        updatedWithOrder.map((session) => updateExistingSession(session))
      );
    } catch (e) {
      console.error("Failed to persist manual session order:", e);
    }
  }

  // Action: Spawn a new Campaign parent
  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!newCampaignName.trim() || !activeUserId) return;

    const newCampId = "campaign-" + Date.now();
    const newCamp: Campaign = {
      id: newCampId,
      userId: activeUserId,
      name: newCampaignName.trim(),
      setting: newCampaignSetting.trim() || "D&D 5th Edition",
      description: newCampaignDesc.trim() || "No campaign notes added yet.",
      dndBeyondUrl: newCampaignDndBeyondUrl.trim() || undefined,
      dndBeyondNotes: newCampaignDndBeyondNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await createNewCampaign(newCamp);
      setNewCampaignName("");
      setNewCampaignSetting("");
      setNewCampaignDesc("");
      setNewCampaignDndBeyondUrl("");
      setNewCampaignDndBeyondNotes("");
      setShowCreateCampaignModal(false);
      await loadCampaignsAndSessions(newCampId);
    } catch (e) {
      console.error("Campaign spawn error:", e);
    }
  }

  // Action: Morph existing campaign profile properties
  async function handleUpdateCampaign(e: React.FormEvent) {
    e.preventDefault();
    const activeCamp = campaigns.find((c) => c.id === selectedCampaignId);
    if (!activeCamp || !editCampaignName.trim() || !activeUserId) return;

    const updatedCamp: Campaign = {
      ...activeCamp,
      name: editCampaignName.trim(),
      setting: editCampaignSetting.trim(),
      description: editCampaignDesc.trim(),
      dndBeyondUrl: editCampaignDndBeyondUrl.trim() || undefined,
      dndBeyondNotes: editCampaignDndBeyondNotes.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    try {
      await updateExistingCampaign(updatedCamp);
      setShowEditCampaignModal(false);
      setCampaigns((prev) => prev.map((c) => (c.id === selectedCampaignId ? updatedCamp : c)));
    } catch (e) {
      console.error("Campaign update error:", e);
    }
  }

  // Action: Destroy the campaign world and all child chapters
  function handleDeleteCampaign(campId: string) {
    if (!campId || !activeUserId) return;
    const campObj = campaigns.find((c) => c.id === campId);
    if (!campObj) return;
    setCampaignToDelete(campObj);
  }

  // Actual execution of campaign deletion on custom modal confirmation
  async function confirmDeleteCampaign() {
    if (!campaignToDelete || !activeUserId) return;
    const campId = campaignToDelete.id;
    try {
      await removeCampaign(campId, activeUserId);
      setCampaignToDelete(null);
      await loadCampaignsAndSessions();
    } catch (e: any) {
      console.error("Campaign purging anomaly:", e);
      alert(`Could not delete campaign: ${e.message || e}`);
    }
  }

  // Handle log out or exit guest mode
  function triggerLogout() {
    if (isRealFirebase) {
      logOutUser().catch(console.error);
    }
    setUser(null);
    setIsGuestMode(false);
    setCampaigns([]);
    setSelectedCampaignId("");
    setSessions([]);
    setSelectedSession(null);
  }

  // Action: Launch a new game session chapter
  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !activeUserId) return;

    const newId = "session-" + Date.now();
    const currentMaxOrder = sortedCampSessions.reduce((max, s) => Math.max(max, s.order ?? 0), -1);
    const newSessionItem: Session = {
      id: newId,
      userId: activeUserId,
      campaignId: selectedCampaignId,
      title: newTitle.trim(),
      date: newDate,
      notes: "## 📒 DM RAW LOGS\n\n- The adventure begins...\n- Write combat logs or encounter details here.",
      playerNotes: "## 👥 PLAYER JOURNAL\n\n- Key characters met...\n- Unresolved quests / rumors...\n- Shared party loot...",
      highlights: [],
      characters: [],
      videoStatus: "idle",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      order: currentMaxOrder + 1,
    };

    setSessionsLoading(true);
    try {
      await createNewSession(newSessionItem);
      setNewTitle("");
      setShowCreateModal(false);
      await loadCampaignsAndSessions(selectedCampaignId, newId);
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
      playerNotes: playerNotes,
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
  function handleDeleteSession(id: string) {
    if (!id || !activeUserId) return;
    const sessObj = sessions.find((s) => s.id === id);
    if (!sessObj) return;
    setSessionToDelete(sessObj);
  }

  // Confirmed Delete Session
  async function confirmDeleteSession() {
    if (!sessionToDelete || !activeUserId) return;
    const sessId = sessionToDelete.id;
    try {
      await removeSession(sessId, activeUserId);
      setSessionToDelete(null);
      await loadCampaignsAndSessions(selectedCampaignId);
    } catch (e) {
      console.error("Deletion failure:", e);
    }
  }

  // Quick notepad Templates injector for DMs / Players
  function injectTemplate(templateName: string) {
    let str = "";
    if (activeNoteTab === "player") {
      if (templateName === "quest") {
        str = "\n\n### 📜 ACTIVE QUESTS & REMINDERS\n- [ ] **Main Quest**: Retrieve the Shattered Spire Key.\n- [ ] **Side Quest**: Deliver Barnaby's special brew to Glimmerpost.\n- [ ] **Bounty**: Clean up giant spiders in the cellars.";
      } else if (templateName === "inventory") {
        str = "\n\n### 🎒 PARTY INVENTORY & FUNDS\n- **Gold (GP)**: 120 gp | **Silver (SP)**: 45 sp\n- **Key Items**: Shattered Spire Map, Baron's Ring of Sigil\n- **Consumables**: 2 Potions of Healing, 1 Elixir of Fire.";
      } else {
        str = "\n\n### 💡 MYSTERIES & CAMPAIGN THEORIES\n- **The Gilded Skull**: Spotted near mayor's chambers. Possible doppelganger?\n- **The Spire Gate**: Only opens on celestial eclipses. Next in 3 days.\n- **Strange Sigil**: Engraved on the goblin king's throne.";
      }
      setPlayerNotes((prev) => prev + str);
    } else {
      if (templateName === "combat") {
        str = "\n\n### ⚔️ COMBAT INITIATIVE TRACKER\n- **Monsters**: Goblins (HP 8, AC 12)\n- **Initiative Order**:\n  1. Rogue Balasar (Roll: 18)\n  2. Goblins (Roll: 12)\n  3. Fighter Galahad (Roll: 9)\n- **Skirmish Ledger**:\n  - Round 1: Rogue sneak attacks Goblin #1 for 12 piercing damage. Defeated.";
      } else if (templateName === "npc") {
        str = "\n\n### 👥 IMPROVISED NPC JOURNAL\n- **Name**: Barnaby the Brewer\n- **Role**: Town shopkeeper ally\n- **Disposition**: Friendly but highly paranoid\n- **Bio/Secrets**: Reveals goblins steal grain sacks. Offers 5% tavern discount.";
      } else {
        str = "\n\n### 🪙 LOOT & REWARDS LEDGER\n- **Magic Items Found**: Boots of Elvenkind (requires attunement)\n- **Gemstones Key**: Sapphire gem worth 100 gold pieces\n- **Coin Sacks**: 80 silver pieces, 30 gold coins.";
      }
      setNotes((prev) => prev + str);
    }
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

  async function handleResetSummary() {
    if (!selectedSession) return;
    try {
      const updated: Session = {
        ...selectedSession,
        summary: "",
      };

      await updateExistingSession(updated);
      setSelectedSession(updated);
      
      setSessions((prev) =>
        prev.map((s) => (s.id === selectedSession.id ? updated : s))
      );
    } catch (e: any) {
      alert(`Arcane purge bottleneck: ${e.message}`);
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-red-500 selection:text-zinc-950">
      {/* Header element */}
      <header className="bg-zinc-900/90 backdrop-blur border-b border-zinc-800 py-4 px-4 sm:px-6 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-6 h-6 text-red-400 animate-pulse" />
          <div>
            <h1 className="font-fantasy font-black tracking-widest text-zinc-100 text-sm sm:text-base md:text-lg flex items-center gap-1.5 uppercase">
              DUNGEON MASTER <span className="text-red-400">ASSISTANT</span>
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
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-red-500 font-mono text-[10px]">LOCAL ENGINE FALLBACK</span>
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
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 text-center text-xs text-red-300 flex items-center justify-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
          <span>
            Currently in local mode. To back up campaign logs permanently in a secure cloud database, ask me in the chat to <strong>"initialize Firebase"</strong>!
          </span>
        </div>
      )}

      {/* Redesigned Premium Active Campaign Selector Top Bar */}
      <div className="bg-zinc-900/40 backdrop-blur border-b border-zinc-800 px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-20">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
          <div className="inline-flex self-start sm:self-auto items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-md text-[10px] font-mono font-extrabold text-red-400 select-none uppercase tracking-widest">
            <BookOpen className="w-3.5 h-3.5" />
            Active Realm
          </div>
          
          {campaignsLoading ? (
            <div className="flex items-center text-xs text-zinc-500 font-mono py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> Unshrouding realms...
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-xs text-zinc-500 italic bg-zinc-950 px-2 py-1 border border-zinc-900 rounded">
              No active realms. Click "New Realm" to spawn!
            </div>
          ) : (
            <div className="w-full sm:w-80 min-w-0">
              <select
                value={selectedCampaignId}
                onChange={(e) => handleSelectCampaign(e.target.value)}
                className="w-full bg-zinc-950 text-red-400 border border-zinc-800 focus:border-red-500 focus:outline-none rounded-lg py-1.5 px-3 text-xs font-sans font-semibold hover:border-zinc-700 transition cursor-pointer truncate shadow-sm"
                id="campaign-realm-selector"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id} className="bg-zinc-900 text-zinc-100 font-sans">
                    🏰 {c.name} {c.setting ? `— ${c.setting}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Action Buttons for Campaigns */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {(() => {
            const activeCamp = campaigns.find((c) => c.id === selectedCampaignId);
            if (!activeCamp) return null;
            return (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditCampaignName(activeCamp.name);
                    setEditCampaignSetting(activeCamp.setting || "");
                    setEditCampaignDesc(activeCamp.description || "");
                    setEditCampaignDndBeyondUrl(activeCamp.dndBeyondUrl || "");
                    setEditCampaignDndBeyondNotes(activeCamp.dndBeyondNotes || "");
                    setShowEditCampaignModal(true);
                  }}
                  className="px-3 py-1.5 bg-zinc-950/80 hover:bg-zinc-900 hover:text-red-400 text-zinc-400 border border-zinc-850 hover:border-zinc-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  title="Edit Campaign Details"
                  id="btn-sidebar-edit-campaign"
                >
                  <Edit className="w-3.5 h-3.5 text-zinc-550" />
                  <span className="hidden md:inline">Edit Realm</span>
                </button>
                <button
                  onClick={() => handleDeleteCampaign(activeCamp.id)}
                  className="px-3 py-1.5 bg-zinc-950/80 hover:bg-red-955/20 hover:text-red-400 text-zinc-400 border border-zinc-850 hover:border-red-900/30 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  title="Delete Campaign Realm"
                  id="btn-sidebar-delete-campaign"
                >
                  <Trash2 className="w-3.5 h-3.5 text-zinc-550" />
                  <span className="hidden md:inline">Delete</span>
                </button>
              </div>
            );
          })()}

          <div className="h-5 w-[1px] bg-zinc-800 mx-1.5 hidden sm:block" />

          <button
            onClick={() => setShowCreateCampaignModal(true)}
            className="px-3.5 py-1.5 bg-red-500/15 hover:bg-red-500 text-red-400 hover:text-zinc-950 rounded-lg text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer border border-red-500/30"
            id="btn-sidebar-plus-campaign"
            title="Create New Campaign World"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Realm</span>
          </button>
        </div>
      </div>

      {/* Active Campaign Info Strip Banner - Spanning full screen below the Active Realm component */}
      {campaigns.find((c) => c.id === selectedCampaignId) && (() => {
        const activeCamp = campaigns.find((c) => c.id === selectedCampaignId)!;
        const totalChapters = sessions.filter((s) => s.campaignId === selectedCampaignId).length;
        const totalHeroes = activeCamp.heroes?.length || 0;

        return (
          <div className="bg-zinc-900/30 border-b border-zinc-800/80 transition-all duration-300">
            {/* Header/Strip Row */}
            <div 
              onClick={() => setIsLoreExpanded(!isLoreExpanded)}
              className="px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs cursor-pointer hover:bg-zinc-900/50 transition-colors select-none"
              title="Click to toggle full Realm lore and chronicles"
            >
              <div className="flex items-center gap-3 flex-wrap min-w-0 flex-1">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-[10px] font-mono uppercase tracking-wider font-extrabold shrink-0">
                  <Scroll className="w-3 h-3 text-red-500" /> Realm Lore
                </span>
                <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                  <span className="font-fantasy font-extrabold text-xs text-zinc-200 tracking-wide uppercase truncate">
                    {activeCamp.name}
                  </span>
                  {activeCamp.setting && (
                    <span className="text-[10px] text-zinc-400 font-sans px-1.5 py-0.5 bg-zinc-950 border border-zinc-850 rounded shrink-0">
                      {activeCamp.setting}
                    </span>
                  )}
                </div>
                {!isLoreExpanded && activeCamp.description && (
                  <p className="text-zinc-500 italic text-[11px] font-sans truncate max-w-xl hidden lg:block border-l border-zinc-800/60 pl-3">
                    "{activeCamp.description}"
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                <div className="hidden sm:flex items-center gap-3 text-[10px] font-mono text-zinc-500 border-r border-zinc-850 pr-3">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-zinc-650" />
                    <strong>{totalChapters}</strong> {totalChapters === 1 ? "Chapter" : "Chapters"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-zinc-650" />
                    <strong>{totalHeroes}</strong> {totalHeroes === 1 ? "Hero" : "Heroes"}
                  </span>
                </div>
                
                <button 
                  className="flex items-center gap-1 px-2 py-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded transition font-medium text-[10px] uppercase font-mono"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLoreExpanded(!isLoreExpanded);
                  }}
                >
                  <span>{isLoreExpanded ? "Hide Details" : "Show Details"}</span>
                  {isLoreExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-red-500" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Dynamic Expanded Section */}
            <AnimatePresence initial={false}>
              {isLoreExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden bg-zinc-950/60 border-t border-zinc-800/50"
                >
                  <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-zinc-350 text-xs">
                    {/* Main Description Column */}
                    <div className="md:col-span-2 space-y-3.5">
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-red-400/80 uppercase tracking-widest font-bold">
                          Chronicle & Summary
                        </span>
                        <h4 className="font-fantasy text-zinc-100 font-extrabold text-sm tracking-wide">
                          About the Realm
                        </h4>
                      </div>
                      <div className="bg-zinc-900/30 p-4 border border-zinc-850/80 rounded-lg text-[13px] font-sans leading-relaxed text-zinc-300 italic relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                          <Scroll className="w-16 h-16 text-white" />
                        </div>
                        {activeCamp.description ? (
                          <p className="relative z-10">"{activeCamp.description}"</p>
                        ) : (
                          <p className="text-zinc-500 italic relative z-10">No lore or description has been inscribed for this campaign realm yet.</p>
                        )}
                      </div>

                      {activeCamp.dndBeyondNotes && (
                        <div className="space-y-2 pt-3.5 border-t border-zinc-900">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-mono text-amber-500/80 uppercase tracking-widest font-bold">
                              Imported DM Campaign Scrolls
                            </span>
                            <h4 className="font-fantasy text-zinc-100 font-extrabold text-xs tracking-wide uppercase">
                              📖 DM Campaign Notes & Codex
                            </h4>
                          </div>
                          <div className="bg-zinc-950/50 p-4 border border-zinc-850/60 rounded-lg text-xs font-sans leading-relaxed text-zinc-300 whitespace-pre-line max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                            {activeCamp.dndBeyondNotes}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Metadata & Secondary Column */}
                    <div className="bg-zinc-900/10 p-4 border border-zinc-850/60 rounded-lg space-y-4">
                      <div>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">
                          Realm Registry
                        </span>
                        <div className="mt-2 space-y-2.5">
                          <div className="flex items-center justify-between text-xs py-1 border-b border-zinc-900">
                            <span className="text-zinc-500 font-medium">Setting / Theme</span>
                            <span className="text-zinc-300 font-semibold">{activeCamp.setting || "Custom Fantasy"}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs py-1 border-b border-zinc-900">
                            <span className="text-zinc-500 font-medium">Chronicle Chapters</span>
                            <span className="text-zinc-300 font-mono font-bold text-red-400">{totalChapters}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs py-1 border-b border-zinc-900">
                            <span className="text-zinc-500 font-medium">Party Size</span>
                            <span className="text-zinc-300 font-mono font-bold text-red-400">{totalHeroes} Heroes</span>
                          </div>
                        </div>
                      </div>

                      {/* D&D Beyond Integration Info */}
                      <div className="pt-2 border-t border-zinc-850/60 space-y-2">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-500" /> D&D Beyond Codex
                        </span>
                        {activeCamp.dndBeyondUrl ? (
                          <div className="space-y-2">
                            <a
                              href={activeCamp.dndBeyondUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition hover:underline py-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Visit Campaign Portal</span>
                            </a>
                            {activeCamp.dndBeyondNotes && (
                              <p className="text-[11px] text-zinc-400 leading-normal italic font-sans bg-zinc-950/40 p-2 border border-zinc-900 rounded">
                                {activeCamp.dndBeyondNotes}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] text-zinc-500 italic space-y-2">
                            <p>No campaign portal or D&D Beyond link linked to this realm.</p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditCampaignName(activeCamp.name);
                                setEditCampaignSetting(activeCamp.setting || "");
                                setEditCampaignDesc(activeCamp.description || "");
                                setEditCampaignDndBeyondUrl(activeCamp.dndBeyondUrl || "");
                                setEditCampaignDndBeyondNotes(activeCamp.dndBeyondNotes || "");
                                setShowEditCampaignModal(true);
                              }}
                              className="w-full text-left inline-flex items-center gap-1.5 text-red-400/80 hover:text-red-400 hover:underline font-mono uppercase tracking-wider text-[10px] font-bold cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Link Campaign Portal
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })()}

      {/* Main Grid split */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left column sidebar lists */}
        <aside className="w-full lg:w-72 bg-zinc-950/50 border-r border-b lg:border-b-0 border-zinc-800 flex flex-col shrink-0">
          
          {activeWorkspaceTab === "chapters" && (
            <>
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-905/10">
                <div className="flex items-center gap-1.5">
                  <Scroll className="w-4 h-4 text-red-500" />
                  <span className="text-xs uppercase font-fantasy tracking-wider font-semibold text-zinc-300">
                    CAMPAIGN CHAPTERS
                  </span>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="p-1.5 bg-red-500/15 text-red-400 hover:bg-red-500 hover:text-zinc-950 rounded transition border border-red-500/30"
                  id="btn-sidebar-plus-char"
                  title="Add Campaign Session"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Sort configuration bar */}
              <div className="px-4 py-2 border-b border-zinc-850 bg-zinc-950/40 flex items-center justify-between gap-1.5 text-[11px] font-sans text-zinc-400">
                <span className="flex items-center gap-1 shrink-0 font-mono text-[10px] uppercase tracking-wider font-semibold text-zinc-500">
                  <ArrowUpDown className="w-3 h-3 text-red-500/80" /> Sort By
                </span>
                <select
                  value={sessionSortMode}
                  onChange={(e) => handleSortModeChange(e.target.value as any)}
                  className="bg-zinc-900 text-zinc-200 border border-zinc-800 rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none focus:border-red-500 max-w-[150px] cursor-pointer"
                  title="Configure sorting logic for chronicle chapters"
                >
                  <option value="date-desc">Date (Newest)</option>
                  <option value="date-asc">Date (Oldest)</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="manual">Manual (Custom)</option>
                </select>
              </div>

              {/* Chapters listing */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 max-h-[300px] lg:max-h-none">
                {sessionsLoading && sessions.length === 0 ? (
                  <div className="flex items-center justify-center p-4 text-xs text-zinc-500 font-sans">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Unsealing codex...
                  </div>
                ) : sortedCampSessions.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-500 italic font-sans leading-normal">
                    No session chapters created yet in this campaign. Click the "+" button above to start your legend!
                  </div>
                ) : (
                  sortedCampSessions.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedSession(item);
                        setSessionTitle(item.title);
                        setSessionDate(item.date);
                        setNotes(item.notes);
                        setPlayerNotes(item.playerNotes || "");
                        setAudioTranscription(item.audioTranscription || "");
                      }}
                      className={`group w-full p-3 text-left rounded border transition flex items-center justify-between cursor-pointer ${
                        selectedSession?.id === item.id
                          ? "bg-red-500/10 border-red-500/40 text-red-400 parchment-glow"
                          : "bg-zinc-900/40 border-zinc-850 hover:bg-zinc-900 hover:border-zinc-700 text-zinc-300"
                      }`}
                      id={`side-session-${item.id}`}
                    >
                      <div className="space-y-1 min-w-0 pr-1.5 flex-1">
                        <h3 className="font-fantasy font-bold text-xs md:text-sm truncate tracking-wide">
                          {item.title}
                        </h3>
                        <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                          <Calendar className="w-3 h-3 text-zinc-650" />
                          <span>{item.date}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Manual Order Controls */}
                        {sessionSortMode === "manual" && (
                          <div className="flex items-center gap-0.5 bg-zinc-950/65 border border-zinc-850 rounded px-1 py-0.5 mr-1 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveSession(item.id, "up");
                              }}
                              disabled={sortedCampSessions.findIndex((s) => s.id === item.id) === 0}
                              className="p-0.5 hover:bg-zinc-800 text-zinc-500 hover:text-red-400 rounded transition disabled:opacity-20 disabled:hover:text-zinc-500 cursor-pointer"
                              title="Move Chapter Up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveSession(item.id, "down");
                              }}
                              disabled={sortedCampSessions.findIndex((s) => s.id === item.id) === sortedCampSessions.length - 1}
                              className="p-0.5 hover:bg-zinc-800 text-zinc-500 hover:text-red-400 rounded transition disabled:opacity-20 disabled:hover:text-zinc-500 cursor-pointer"
                              title="Move Chapter Down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

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
                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-red-500" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeWorkspaceTab === "party" && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-905/10">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-red-500" />
                  <span className="text-xs uppercase font-fantasy tracking-wider font-semibold text-zinc-300">
                    PARTY ROSTER SUMMARY
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 max-h-[300px] lg:max-h-none">
                {(() => {
                  const activeCamp = campaigns.find((c) => c.id === selectedCampaignId);
                  const campaignHeroes = activeCamp?.heroes || [];
                  if (campaignHeroes.length === 0) {
                    return (
                      <div className="p-4 text-center text-xs text-zinc-500 italic font-sans leading-normal">
                        No companions in this realm yet. Add them in the main party view!
                      </div>
                    );
                  }
                  return campaignHeroes.map((hero) => (
                    <div
                      key={hero.id}
                      className="p-3 bg-zinc-900/40 border border-zinc-850 rounded text-xs text-zinc-300 flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <h4 className="font-fantasy font-bold text-xs truncate text-zinc-200">
                          {hero.name}
                        </h4>
                        <p className="text-[10px] text-zinc-550 font-mono truncate">
                          {hero.classes && hero.classes.length > 0 
                            ? hero.classes.map(c => `${c.className} (Lv ${c.level})`).join(" / ")
                            : `${hero.classType} (Lv ${hero.level})`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right font-mono text-[10px] bg-zinc-950 px-1.5 py-0.5 border border-zinc-850 rounded text-red-400 font-bold">
                        Lv {hero.classes && hero.classes.length > 0 
                          ? hero.classes.reduce((acc, c) => acc + c.level, 0)
                          : hero.level}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </aside>

        {/* Right column main detail panels scroll container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          
          {/* Active Campaign Workspace Tabs Toggle Row */}
          {selectedCampaignId && (
            <div className="flex border-b border-zinc-850 gap-1.5" id="campaign-workspace-tabstrip">
              <button
                onClick={() => setActiveWorkspaceTab("chapters")}
                className={`px-4 py-2.5 border-b-2 font-fantasy tracking-wider uppercase text-xs transition duration-150 flex items-center gap-2 cursor-pointer font-bold ${
                  activeWorkspaceTab === "chapters"
                    ? "border-red-500 text-red-500 font-bold bg-zinc-900/40"
                    : "border-transparent text-zinc-550 hover:text-zinc-300"
                }`}
              >
                <Scroll className="w-3.5 h-3.5" /> 📖 Chronicle Chapters
              </button>
              <button
                onClick={() => setActiveWorkspaceTab("party")}
                className={`px-4 py-2.5 border-b-2 font-fantasy tracking-wider uppercase text-xs transition duration-150 flex items-center gap-2 cursor-pointer font-bold ${
                  activeWorkspaceTab === "party"
                    ? "border-red-500 text-red-500 font-bold bg-zinc-900/40"
                    : "border-transparent text-zinc-550 hover:text-zinc-300"
                }`}
              >
                <Users className="w-3.5 h-3.5" /> 🛡️ Heroes of the Realm
              </button>
            </div>
          )}

          {selectedCampaignId && activeWorkspaceTab === "party" ? (
            <HeroPartyTracker
              campaign={campaigns.find((c) => c.id === selectedCampaignId)!}
              onUpdateCampaign={async (updated) => {
                try {
                  await updateExistingCampaign(updated);
                  setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                } catch (e) {
                  console.error("Failed to update campaign heroes:", e);
                }
              }}
            />
          ) : (
            <AnimatePresence mode="wait">
            {!selectedSession ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-center p-8 bg-zinc-900/10 border border-zinc-850 rounded-lg min-h-[400px]"
                id="empty-welcome-panel"
              >
                <div className="inline-flex p-3 bg-zinc-900 border border-zinc-800 rounded-full mb-3 text-red-500 max-w-max mx-auto shadow-md">
                  <Compass className="w-10 h-10 animate-spin-slow text-red-500" />
                </div>
                <h2 className="font-fantasy font-bold text-lg text-zinc-200 uppercase tracking-widest">
                  Ready to Scribe, DM?
                </h2>
                <p className="text-zinc-500 text-xs sm:text-sm mt-1 max-w-[420px] font-sans leading-normal">
                  No active session chapter selected in this campaign. Create or pick another, or click the "+" button below to unscroll a new chronicle page!
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-zinc-950 font-sans font-bold text-xs rounded transition active:scale-95 cursor-pointer flex items-center gap-1.5"
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
                    <span className="text-[10px] font-mono text-red-500 tracking-widest uppercase font-bold flex items-center gap-1">
                      <Scroll className="w-3.5 h-3.5" /> ACTIVE STORY LEDGER
                    </span>
                    <input
                      type="text"
                      value={sessionTitle}
                      onChange={(e) => setSessionTitle(e.target.value)}
                      className="font-fantasy font-extrabold text-xl sm:text-2xl text-zinc-100 tracking-wide bg-transparent border-b border-transparent focus:border-red-500 focus:outline-none focus:bg-zinc-950/20 px-1 transition"
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
                      className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-zinc-950 font-sans font-bold text-xs sm:text-sm rounded transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
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
                      {/* Tabs Header inside the Notes Box */}
                      <div className="flex border-b border-zinc-800 font-sans text-xs uppercase tracking-wider mb-2">
                        <button
                          onClick={() => setActiveNoteTab("dm")}
                          className={`flex-1 px-3 py-2 text-center border-b-2 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            activeNoteTab === "dm"
                              ? "border-red-500 text-red-100 font-bold bg-zinc-950/20"
                              : "border-transparent text-zinc-500 hover:text-zinc-300"
                          }`}
                          id="btn-tab-dm"
                        >
                          <BookOpen className="w-3.5 h-3.5" /> DM Scribe Logs
                        </button>
                        <button
                          onClick={() => setActiveNoteTab("player")}
                          className={`flex-1 px-3 py-2 text-center border-b-2 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            activeNoteTab === "player"
                              ? "border-amber-500 text-amber-100 font-bold bg-zinc-950/20"
                              : "border-transparent text-zinc-500 hover:text-zinc-300"
                          }`}
                          id="btn-tab-players"
                        >
                          <Users className="w-3.5 h-3.5" /> Player Journal
                        </button>
                      </div>

                      <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                        <div className="flex items-center gap-2">
                          <Edit className="w-4 h-4 text-red-500 animate-pulse" />
                          <h3 className="font-fantasy font-semibold text-zinc-100 tracking-wider text-sm uppercase">
                            {activeNoteTab === "dm" ? "DM Adventure Scribe Ledger" : "Players' Campaign Chronicles"}
                          </h3>
                        </div>
                        <span className="font-mono text-[9px] text-zinc-500">
                          Supports Markdown markup
                        </span>
                      </div>

                      {/* Fast templates injection toolbar based on active tab */}
                      {activeNoteTab === "dm" ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-zinc-400 font-mono">Inject DM template:</span>
                          <button
                            onClick={() => injectTemplate("combat")}
                            className="px-2 py-1 bg-zinc-950 text-[10px] border border-zinc-800 hover:border-red-500 hover:text-red-400 rounded transition cursor-pointer"
                            id="btn-template-combat"
                          >
                            ⚔️ Combat Tracker
                          </button>
                          <button
                            onClick={() => injectTemplate("npc")}
                            className="px-2 py-1 bg-zinc-950 text-[10px] border border-zinc-800 hover:border-red-500 hover:text-red-400 rounded transition cursor-pointer"
                            id="btn-template-npc"
                          >
                            👤 Improv NPC
                          </button>
                          <button
                            onClick={() => injectTemplate("loot")}
                            className="px-2 py-1 bg-zinc-950 text-[10px] border border-zinc-800 hover:border-red-500 hover:text-red-400 rounded transition cursor-pointer"
                            id="btn-template-loot"
                          >
                            🪙 Gold / Magic Loot
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-amber-400 font-mono">Inject Player template:</span>
                          <button
                            onClick={() => injectTemplate("quest")}
                            className="px-2 py-1 bg-zinc-950 text-[10px] border border-zinc-800 hover:border-amber-500 hover:text-amber-400 rounded transition cursor-pointer"
                            id="btn-template-quest"
                          >
                            📜 Quest Codex
                          </button>
                          <button
                            onClick={() => injectTemplate("inventory")}
                            className="px-2 py-1 bg-zinc-950 text-[10px] border border-zinc-800 hover:border-amber-500 hover:text-amber-400 rounded transition cursor-pointer"
                            id="btn-template-inventory"
                          >
                            🎒 Party Stash
                          </button>
                          <button
                            onClick={() => injectTemplate("theories")}
                            className="px-2 py-1 bg-zinc-950 text-[10px] border border-zinc-800 hover:border-amber-500 hover:text-amber-400 rounded transition cursor-pointer"
                            id="btn-template-theories"
                          >
                            💡 Theories / Clues
                          </button>
                        </div>
                      )}

                      {activeNoteTab === "dm" ? (
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Detail story happenings, dice rolls, campaigns events, player dialogue..."
                          rows={12}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded p-4 text-zinc-200 text-sm font-sans focus:outline-none focus:border-red-500 font-sans leading-relaxed transition"
                          id="raw-notes-notepad"
                        />
                      ) : (
                        <textarea
                          value={playerNotes}
                          onChange={(e) => setPlayerNotes(e.target.value)}
                          placeholder="Record player-led diaries, quest notes, group stash, active campaign theories..."
                          rows={12}
                          className="w-full bg-zinc-950 border border-zinc-850 rounded p-4 text-amber-100/90 text-sm font-sans focus:outline-none focus:border-amber-500 font-sans leading-relaxed transition"
                          id="player-notes-notepad"
                        />
                      )}
                    </div>

                    <div className="flex justify-end pt-3">
                      <button
                        onClick={saveSessionChanges}
                        disabled={notesSaving}
                        className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-red-400 rounded text-xs transition font-semibold"
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
                      <div className="flex items-center gap-1.5 justify-center text-red-500">
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
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-sans font-bold text-xs sm:text-sm rounded transition active:scale-95 flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
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
                  <div className="absolute top-0 left-0 w-2 h-20 bg-red-500/20" />
                  <div className="absolute top-0 left-0 w-20 h-2 bg-red-500/20" />
                  
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-4 mb-4 gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Scroll className="w-6 h-6 text-red-500 animate-pulse" />
                      <h3 className="font-fantasy font-bold text-base md:text-lg tracking-wider text-zinc-100 uppercase">
                        📜 CHRONICLE SUMMARY & SPELLBOOK NOTES
                      </h3>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      {summarizing && (
                        <span className="text-xs text-red-500 flex items-center gap-1.5 font-sans italic animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scribing timeline...
                        </span>
                      )}
                      
                      {selectedSession.summary && !summarizing && (
                        <>
                          {isResetConfirmOpen ? (
                            <div className="flex items-center gap-1.5 bg-red-950/20 border border-red-900/30 rounded-lg p-1 animate-pulse" id="reset-confirm-box">
                              <span className="text-[10px] font-mono text-red-400 font-semibold px-2 uppercase tracking-wide">
                                Destroy Chronicle?
                              </span>
                              <button
                                onClick={() => {
                                  handleResetSummary();
                                  setIsResetConfirmOpen(false);
                                }}
                                className="px-2 py-1 bg-red-600 hover:bg-red-500 text-zinc-950 text-[10px] font-bold font-mono uppercase rounded transition cursor-pointer"
                                id="btn-confirm-reset-summary"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setIsResetConfirmOpen(false)}
                                className="px-2 py-1 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-[10px] font-bold font-mono uppercase rounded transition cursor-pointer"
                                id="btn-cancel-reset-summary"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setIsResetConfirmOpen(true)}
                              className="px-2.5 py-1.5 bg-zinc-950/60 hover:bg-red-950/30 text-zinc-400 hover:text-red-400 border border-zinc-850 hover:border-red-900/40 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                              title="Delete and reset the compiled summary"
                              id="btn-trigger-reset-summary"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Reset Summary</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="bg-zinc-950/40 p-5 rounded border border-zinc-850">
                    <MarkdownRenderer content={selectedSession.summary || ""} />
                  </div>
                </div>

                {/* Automation Wizard: Auto-Forge 3 Images and 1 Video from the summary */}
                <MediaForgeWizard
                  session={selectedSession}
                  onUpdateSession={async (updatedSession) => {
                    await updateExistingSession(updatedSession);
                    setSelectedSession(updatedSession);
                    setSessions((prev) =>
                      prev.map((s) => (s.id === selectedSession.id ? updatedSession : s))
                    );
                  }}
                />

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
                  session={selectedSession}
                  campaignHeroes={campaigns.find((c) => c.id === selectedCampaignId)?.heroes || []}
                  onUpdateCampaignHeroes={async (updatedHeroes) => {
                    const currentCampaign = campaigns.find((c) => c.id === selectedCampaignId);
                    if (currentCampaign) {
                      const updatedCamp = {
                        ...currentCampaign,
                        heroes: updatedHeroes,
                        updatedAt: new Date().toISOString()
                      };
                      try {
                        await updateExistingCampaign(updatedCamp);
                        setCampaigns((prev) => prev.map((c) => (c.id === updatedCamp.id ? updatedCamp : c)));
                      } catch (e) {
                        console.error("Failed to sync party during auto-detect:", e);
                      }
                    }
                  }}
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
          )}
        </main>
      </div>

      {/* Campaign Chapter Creation Modal Dialog */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-lg p-6 shadow-2xl relative"
            id="creation-modal-dialog"
          >
            <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-red-500/20" />
            
            <h2 className="font-fantasy font-extrabold text-base uppercase text-red-400 tracking-wider mb-4 border-b border-zinc-800 pb-2">
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
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-red-500 font-sans"
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
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-red-500 font-sans"
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
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-zinc-950 font-sans font-bold text-xs rounded transition uppercase tracking-wide cursor-pointer"
                  id="btn-create-chapter-confirm"
                >
                  Summon Scroll
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Campaign Realm Creation Modal */}
      {showCreateCampaignModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-lg p-6 shadow-2xl relative"
            id="create-campaign-modal"
          >
            <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-red-500/20" />
            
            <h2 className="font-fantasy font-extrabold text-base uppercase text-red-400 tracking-wider mb-4 border-b border-zinc-800 pb-2">
              🏰 Forge New Campaign Realm
            </h2>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block tracking-wider font-semibold">
                  Campaign/World Name
                </label>
                <input
                  type="text"
                  required
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="e.g. Curse of Strahd, Eberron Legacy..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-red-500 font-sans"
                  id="new-campaign-name-input"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block tracking-wider font-semibold">
                  Setting / Ruleset Edition
                </label>
                <input
                  type="text"
                  value={newCampaignSetting}
                  onChange={(e) => setNewCampaignSetting(e.target.value)}
                  placeholder="e.g. D&D 5e, Pathfinder 2e, Custom Lore..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-red-500 font-sans"
                  id="new-campaign-setting-input"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block tracking-wider font-semibold">
                  World Description & Lore Hook
                </label>
                <textarea
                  value={newCampaignDesc}
                  onChange={(e) => setNewCampaignDesc(e.target.value)}
                  placeholder="Brief synopsis of the main quest, continents, or major factions..."
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-red-500 font-sans resize-none"
                  id="new-campaign-desc-input"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block tracking-wider font-semibold">
                  D&D Beyond Campaign Link (URL)
                </label>
                <input
                  type="url"
                  value={newCampaignDndBeyondUrl}
                  onChange={(e) => setNewCampaignDndBeyondUrl(e.target.value)}
                  placeholder="e.g. https://www.dndbeyond.com/campaigns/..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-red-500 font-sans"
                  id="new-campaign-beyond-url"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block tracking-wider font-semibold">
                  D&D Beyond / Campaign Extra Notes
                </label>
                <input
                  type="text"
                  value={newCampaignDndBeyondNotes}
                  onChange={(e) => setNewCampaignDndBeyondNotes(e.target.value)}
                  placeholder="e.g. Join code, password, or integration status..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-red-500 font-sans"
                  id="new-campaign-beyond-notes"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCampaignModal(false)}
                  className="px-3.5 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 rounded font-sans text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-zinc-950 font-sans font-bold text-xs rounded transition uppercase tracking-wide cursor-pointer"
                  id="btn-create-campaign-confirm"
                >
                  Conjure Realm
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Campaign Realm Edit Modal */}
      {showEditCampaignModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-lg p-6 shadow-2xl relative"
            id="edit-campaign-modal"
          >
            <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-red-500/20" />
            
            <h2 className="font-fantasy font-extrabold text-base uppercase text-red-400 tracking-wider mb-4 border-b border-zinc-800 pb-2">
              📜 Morph Campaign Details
            </h2>

            <form onSubmit={handleUpdateCampaign} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block tracking-wider font-semibold">
                  Campaign/World Name
                </label>
                <input
                  type="text"
                  required
                  value={editCampaignName}
                  onChange={(e) => setEditCampaignName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-red-500 font-sans"
                  id="edit-campaign-name-input"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block tracking-wider font-semibold">
                  Setting / Ruleset Edition
                </label>
                <input
                  type="text"
                  value={editCampaignSetting}
                  onChange={(e) => setEditCampaignSetting(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-red-500 font-sans"
                  id="edit-campaign-setting-input"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block tracking-wider font-semibold">
                  World Description & Lore Hook
                </label>
                <textarea
                  value={editCampaignDesc}
                  onChange={(e) => setEditCampaignDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-red-500 font-sans resize-none"
                  id="edit-campaign-desc-input"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block tracking-wider font-semibold">
                  D&D Beyond Campaign Link (URL)
                </label>
                <input
                  type="url"
                  value={editCampaignDndBeyondUrl}
                  onChange={(e) => setEditCampaignDndBeyondUrl(e.target.value)}
                  placeholder="e.g. https://www.dndbeyond.com/campaigns/..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-red-500 font-sans"
                  id="edit-campaign-beyond-url"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block tracking-wider font-semibold">
                  D&D Beyond / Campaign Extra Notes
                </label>
                <input
                  type="text"
                  value={editCampaignDndBeyondNotes}
                  onChange={(e) => setEditCampaignDndBeyondNotes(e.target.value)}
                  placeholder="e.g. Join code, password, or integration status..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-red-500 font-sans"
                  id="edit-campaign-beyond-notes"
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditCampaignModal(false);
                    handleDeleteCampaign(selectedCampaignId);
                  }}
                  className="px-3 py-2 bg-red-950/20 hover:bg-red-900/35 text-red-400 hover:text-red-300 border border-red-950/40 hover:border-red-900/60 rounded font-sans text-xs transition cursor-pointer flex items-center gap-1.5"
                  id="btn-edit-campaign-delete"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Realm
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditCampaignModal(false)}
                    className="px-3.5 py-2 bg-zinc-805 hover:bg-zinc-800 text-zinc-300 rounded font-sans text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-zinc-950 font-sans font-bold text-xs rounded transition uppercase tracking-wide cursor-pointer"
                    id="btn-edit-campaign-confirm"
                  >
                    Engrave Changes
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Custom Campaign Delete Confirmation Modal */}
      {campaignToDelete && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-zinc-905 border border-red-500/30 rounded-lg p-6 shadow-2xl relative"
            id="campaign-delete-confirmation-modal"
          >
            <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-red-500/50" />
            
            <h2 className="font-fantasy font-extrabold text-base uppercase text-red-500 tracking-wider mb-3 flex items-center gap-2">
              ⚠️ Collapse Campaign Realm?
            </h2>
            
            <p className="text-zinc-300 text-xs leading-relaxed font-sans mb-4">
              Are you sure you want to permanently dissolve the entire campaign setting{" "}
              <span className="text-red-400 font-bold font-sans">
                &ldquo;{campaignToDelete.name}&rdquo;
              </span>{" "}
              and <span className="text-red-400 font-bold text-red-400">ALL</span> of its recorded sessions?
            </p>
            
            <div className="bg-red-950/25 border border-red-900/30 rounded p-3 mb-5">
              <span className="text-[10px] font-mono text-red-300 uppercase block tracking-wider font-semibold mb-1">
                ⚠️ Eternal Warning
              </span>
              <p className="text-[11px] text-zinc-405 leading-normal font-sans">
                This action is permanent and completely irreversible. It will purge all records from the chronicles.
              </p>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCampaignToDelete(null)}
                className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded font-sans text-xs font-semibold cursor-pointer transition border border-zinc-700/50"
                id="btn-delete-campaign-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCampaign}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-zinc-100 font-sans font-bold text-xs rounded transition uppercase tracking-wide cursor-pointer shadow-lg shadow-red-900/40"
                id="btn-delete-campaign-confirm"
              >
                Purge Realm
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Custom Session Delete Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-zinc-905 border border-red-500/30 rounded-lg p-6 shadow-2xl relative"
            id="session-delete-confirmation-modal"
          >
            <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-red-500/50" />
            
            <h2 className="font-fantasy font-extrabold text-base uppercase text-red-500 tracking-wider mb-3 flex items-center gap-2">
              ⚠️ Erase Session Chapter?
            </h2>
            
            <p className="text-zinc-300 text-xs leading-relaxed font-sans mb-4">
              Are you sure you want to permanently erase the session chronicle{" "}
              <span className="text-red-400 font-bold font-sans">
                &ldquo;{sessionToDelete.title}&rdquo;
              </span>?
            </p>

            <div className="bg-red-950/25 border border-red-900/30 rounded p-3 mb-5">
              <span className="text-[10px] font-mono text-red-300 uppercase block tracking-wider font-semibold mb-1">
                ⚠️ Chronology Warning
              </span>
              <p className="text-[11px] text-zinc-405 leading-normal font-sans">
                Once erased, the scrolls of this session are lost to time and cannot be restored.
              </p>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded font-sans text-xs font-semibold cursor-pointer transition border border-zinc-700/50"
                id="btn-delete-session-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteSession}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-zinc-100 font-sans font-bold text-xs rounded transition uppercase tracking-wide cursor-pointer shadow-lg shadow-red-900/40"
                id="btn-delete-session-confirm"
              >
                Erase Scrolls
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
