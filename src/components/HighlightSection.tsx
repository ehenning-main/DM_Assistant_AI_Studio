import React, { useState, useEffect } from "react";
import { Image, Sparkles, Loader2, Trash2, Edit2, Check, X, AlertCircle, Maximize2, ExternalLink, Shield, User, Info, Key, LogIn, LogOut, Eye, EyeOff } from "lucide-react";
import { HighlightItem, CharacterItem, HeroCharacter } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { AiAccountModal } from "./AiAccountModal";

interface HighlightSectionProps {
  highlights: HighlightItem[];
  onChange: (updated: HighlightItem[]) => void;
  sessionSummary?: string;
  sessionTitle?: string;
  notes?: string;
  playerNotes?: string;
  campaignTitle?: string;
  campaignSetting?: string;
  characters?: CharacterItem[];
  campaignHeroes?: HeroCharacter[];
  previousHighlights?: HighlightItem[];
  onUpdateCampaignHeroes?: (updatedHeroes: HeroCharacter[]) => Promise<void>;
}

export function HighlightSection({
  highlights,
  onChange,
  sessionSummary,
  sessionTitle,
  notes,
  playerNotes,
  campaignTitle,
  campaignSetting,
  characters,
  campaignHeroes,
  previousHighlights,
  onUpdateCampaignHeroes,
}: HighlightSectionProps) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paidKeyNotice, setPaidKeyNotice] = useState<boolean>(false);
  
  // Separate AI Account Login state
  const [customAiKey, setCustomAiKey] = useState<string>(() => {
    try {
      return localStorage.getItem("dma_custom_ai_key") || "";
    } catch {
      return "";
    }
  });
  const [showAiAccountModal, setShowAiAccountModal] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [showKeyText, setShowKeyText] = useState(false);
  const [verifyingKey, setVerifyingKey] = useState(false);
  const [keyVerifyMessage, setKeyVerifyMessage] = useState<{ success: boolean; text: string } | null>(null);

  // Sync AI account state across windows and storage events
  useEffect(() => {
    const handleStorage = () => {
      try {
        setCustomAiKey(localStorage.getItem("dma_custom_ai_key") || "");
      } catch {
        // ignore
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Manual picture fields
  const [showManualAdder, setShowManualAdder] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [manualCaption, setManualCaption] = useState("");
  const [continuityGenerating, setContinuityGenerating] = useState(false);

  // Inspector modal for character continuity details
  const [inspectedHighlight, setInspectedHighlight] = useState<HighlightItem | null>(null);

  // Lightbox overlay & new window state
  const [lightboxImage, setLightboxImage] = useState<{ imageUrl: string; caption: string } | null>(null);

  // Action: Verify and save separate AI Account key
  async function handleVerifyAndSaveKey() {
    if (!keyInput.trim()) {
      setKeyVerifyMessage({ success: false, text: "Please enter an API key to connect your account." });
      return;
    }
    setVerifyingKey(true);
    setKeyVerifyMessage(null);
    try {
      const res = await fetch("/api/verify-ai-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: keyInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        localStorage.setItem("dma_custom_ai_key", keyInput.trim());
        setCustomAiKey(keyInput.trim());
        setKeyVerifyMessage({ success: true, text: "✓ AI Account verified and linked! 1K Photorealistic generation is now active." });
      } else {
        setKeyVerifyMessage({ success: false, text: data.error || "Failed to verify key with AI service." });
      }
    } catch (e: any) {
      setKeyVerifyMessage({ success: false, text: e.message || "Failed to connect to verification server." });
    } finally {
      setVerifyingKey(false);
    }
  }

  // Action: Disconnect separate AI Account key
  function handleDisconnectKey() {
    try {
      localStorage.removeItem("dma_custom_ai_key");
    } catch {}
    setCustomAiKey("");
    setKeyInput("");
    setKeyVerifyMessage({ success: true, text: "Disconnected. Reverted to default app account." });
  }

  const openImageFullSize = (imageUrl: string, caption: string) => {
    // 1. Try opening image directly in a new window/tab
    try {
      const newWin = window.open();
      if (newWin) {
        newWin.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${caption ? caption.replace(/</g, "&lt;") : "Full Size Chronicle Artwork"}</title>
              <style>
                body { margin: 0; background: #0a0a0c; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui, sans-serif; color: #f4f4f5; padding: 20px; box-sizing: border-box; }
                img { max-width: 95vw; max-height: 85vh; object-fit: contain; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); border: 1px solid #3f3f46; }
                h2 { margin-top: 16px; font-size: 16px; font-weight: 500; color: #f59e0b; text-align: center; max-width: 800px; font-style: italic; }
              </style>
            </head>
            <body>
              <img src="${imageUrl}" alt="Full Size Artwork" />
              ${caption ? `<h2>"${caption.replace(/</g, "&lt;")}"</h2>` : ""}
            </body>
          </html>
        `);
        newWin.document.close();
      }
    } catch (err) {
      console.warn("[IMAGE LIGHTBOX] Direct window.open popup prevented by sandbox:", err);
    }

    // 2. Also set local Lightbox modal so image is displayed full size inside the app window
    setLightboxImage({ imageUrl, caption });
  };

  // Action: Forge Chronicle Art - Extracts major episode theme from journal & preserves character continuity
  async function generateContinuityHighlight() {
    if (!sessionSummary && !notes && !playerNotes) return;

    setContinuityGenerating(true);
    setErrorMsg(null);
    setPaidKeyNotice(false);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (customAiKey.trim()) {
        headers["x-custom-ai-key"] = customAiKey.trim();
      }

      const res = await fetch("/api/generate-continuity-illustration", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: sessionTitle || "",
          summary: sessionSummary || "",
          notes: notes || "",
          playerNotes: playerNotes || "",
          campaignTitle: campaignTitle || "",
          campaignSetting: campaignSetting || "",
          characters: characters || [],
          campaignHeroes: campaignHeroes || [],
          previousHighlights: previousHighlights || [],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate continuity illustration.");
      }

      const data = await res.json();

      // Persist canonical character visual profiles back to campaign heroes for future sessions
      if (data.updatedHeroes && onUpdateCampaignHeroes && Array.isArray(data.updatedHeroes)) {
        try {
          await onUpdateCampaignHeroes(data.updatedHeroes);
        } catch (syncErr) {
          console.warn("Character visual continuity sync warning:", syncErr);
        }
      }

      if (data.requiresPaidKey) {
        setPaidKeyNotice(true);
      }
      
      const newHighlight: HighlightItem = {
        id: "highlight-continuity-" + Date.now(),
        imageUrl: data.imageUrl,
        caption: data.caption || `Chronicle: ${data.thematicTitle || data.optimizedPrompt?.substring(0, 80)}...`,
        optimizedPrompt: data.optimizedPrompt,
        majorTheme: data.majorTheme,
        thematicTitle: data.thematicTitle,
        charactersInScene: data.charactersInScene,
        imageSource: data.imageSource,
      };

      onChange([...highlights, newHighlight]);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message);
    } finally {
      setContinuityGenerating(false);
    }
  }

  // Action: Generates a highlight item
  async function generateHighlight(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;

    setGenerating(true);
    setErrorMsg(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (customAiKey.trim()) {
        headers["x-custom-ai-key"] = customAiKey.trim();
      }

      const res = await fetch("/api/generate-highlight", {
        method: "POST",
        headers,
        body: JSON.stringify({ promptString: prompt }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate fantasy illustration.");
      }

      const data = await res.json();
      
      const newHighlight: HighlightItem = {
        id: "highlight-" + Date.now(),
        imageUrl: data.imageUrl,
        caption: prompt,
        imageSource: data.imageSource,
      };

      onChange([...highlights, newHighlight]);
      setPrompt("");
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message);
    } finally {
      setGenerating(false);
    }
  }

  // Action: Add custom image manually
  async function handleAddManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualUrl.trim() || !manualCaption.trim()) return;

    const newHighlight: HighlightItem = {
      id: "manual-highlight-" + Date.now(),
      imageUrl: manualUrl.trim(),
      caption: manualCaption.trim(),
    };

    onChange([...highlights, newHighlight]);
    setManualUrl("");
    setManualCaption("");
    setShowManualAdder(false);
    setErrorMsg(null);
  }

  // Action: Deletes a highlight item
  function deleteHighlight(id: string) {
    onChange(highlights.filter((h) => h.id !== id));
  }

  // Action: Triggers inline editing mode
  function startEditing(item: HighlightItem) {
    setEditingId(item.id);
    setEditCaption(item.caption);
  }

  // Action: Confirms edit updates
  function saveEdit(id: string) {
    onChange(
      highlights.map((h) => (h.id === id ? { ...h, caption: editCaption } : h))
    );
    setEditingId(null);
  }

  return (
    <div className="space-y-4 p-5 bg-zinc-900 border border-zinc-800 rounded-lg parchment-glow transition duration-300 hover:shadow-[0_12px_24px_-8px_rgba(245,158,11,0.06)]" id="highlight-panel">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Image className="w-5 h-5 text-red-500 animate-pulse" />
          <h3 className="font-fantasy font-semibold text-zinc-100 tracking-wider text-base">
            ILLUSTRATED CHRONICLE HIGHLIGHTS
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAiAccountModal(true)}
            className={`font-mono text-[10px] px-2.5 py-1 rounded border flex items-center gap-1.5 transition cursor-pointer ${
              customAiKey
                ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/40 hover:bg-emerald-900/60"
                : "bg-zinc-850 text-zinc-300 border-zinc-700 hover:border-amber-500/40 hover:text-amber-300"
            }`}
            id="btn-open-ai-account-modal"
            title="Log into your separate AI account to enable 1K photorealistic concept art"
          >
            <Key className="w-3 h-3 text-amber-400" />
            <span>{customAiKey ? "AI Account: Linked ✓" : "Log In to AI Account"}</span>
          </button>
          <span className="font-mono text-[10px] bg-red-500/10 text-red-500 border border-red-500/30 px-2 py-0.5 rounded uppercase hidden sm:inline-block">
            Imagen Forge
          </span>
        </div>
      </div>

      <p className="text-zinc-400 text-xs leading-relaxed">
        Summon the creative spirits of GenAI to craft stunning conceptual art representing critical NPC encounters, magic items, or epic battle scenes. These visuals will be preserved in the campaign journal forever.
      </p>

      {/* ONE-BUTTON CHRONICLE ILLUSTRATION GENERATOR */}
      {(sessionSummary || notes || playerNotes) ? (
        <div className="bg-gradient-to-br from-amber-950/20 via-zinc-950/80 to-amber-900/10 p-4 border border-amber-500/15 rounded-lg space-y-3 relative overflow-hidden shadow-lg transition duration-300 hover:border-amber-500/25">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.06),transparent)] pointer-events-none" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
            <div className="text-left space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-mono font-bold tracking-widest text-amber-500 uppercase">
                  📜 CONTINUITY-AWARE INKPORTAL
                </span>
                <span className="text-zinc-600 font-mono text-[9px]">•</span>
                <button
                  type="button"
                  onClick={() => setShowAiAccountModal(true)}
                  className="text-[9px] font-mono text-amber-400/90 hover:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Key className="w-2.5 h-2.5" />
                  <span>{customAiKey ? "Using Personal AI Account (1K Art)" : "Using Default Key (Click to Log In)"}</span>
                </button>
              </div>
              <h4 className="text-xs font-semibold font-fantasy text-zinc-200 tracking-wider">
                AUTO-CHRONICLE SESSION SCENE
              </h4>
              <p className="text-[10px] text-zinc-400 font-sans leading-relaxed max-w-sm">
                Generates a grand masterpiece based directly on this session's journal notes &amp; summary, representing each character and the major theme while locking facial and body features for session-to-session continuity.
              </p>
            </div>
            <button
              onClick={generateContinuityHighlight}
              disabled={continuityGenerating || (!sessionSummary && !notes && !playerNotes)}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-zinc-800 disabled:to-zinc-850 disabled:text-zinc-650 text-zinc-950 font-sans font-bold text-xs uppercase tracking-wider rounded shadow-md hover:shadow-amber-500/10 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer border border-amber-300/20 whitespace-nowrap"
              id="btn-continuity-illustration"
            >
              {continuityGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>Forging Chronicle Art...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 animate-pulse text-zinc-950" />
                  <span>Forge Chronicle Art</span>
                </>
              )}
            </button>
          </div>

          {/* Dedicated AI Account Option Bar for Chronicle Art */}
          <div className="relative z-10 pt-2 border-t border-amber-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] bg-zinc-950/70 p-2.5 rounded-md border border-zinc-850">
            <div className="flex items-center gap-2">
              <Key className={`w-3.5 h-3.5 shrink-0 ${customAiKey ? "text-emerald-400" : "text-amber-400"}`} />
              <div className="leading-snug">
                <span className="text-zinc-400 font-medium">Generation AI Account: </span>
                <span className={customAiKey ? "text-emerald-400 font-bold" : "text-amber-300/90 font-medium"}>
                  {customAiKey ? "Personal AI Account Active (1K Concept Art)" : "App Default Shared Key (Free Tier Quota)"}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAiAccountModal(true)}
              className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded text-[10px] font-mono flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto whitespace-nowrap"
              id="btn-chronicle-ai-account-option"
            >
              <LogIn className="w-3 h-3" />
              <span>{customAiKey ? "Manage / Switch AI Account" : "Log In to Separate AI Account"}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3.5 bg-zinc-950/40 border border-zinc-850 rounded-lg text-center text-zinc-500 text-[10px] font-mono">
          ⚠️ Record DM Scribe notes, Player Journal notes, or weave a session summary first to forge chronicle art!
        </div>
      )}

      {/* Generator Prompt Form */}
      <form onSubmit={generateHighlight} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the highlight scene (e.g. 'A glowing iron longsword embedded in ancient stone moss'...)"
            disabled={generating}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-red-500 font-sans transition"
            id="highlight-prompt-input"
          />
          <button
            type="submit"
            disabled={generating || !prompt.trim()}
            className="px-4 py-2 bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-sans font-medium text-xs md:text-sm rounded transition hover:bg-red-600 active:scale-95 flex items-center gap-1 cursor-pointer"
            id="btn-forge-illustration"
          >
            {generating ? (
              <>
                <Loader2 className="w-4.5 h-4.5 animate-spin" /> Painting...
              </>
            ) : (
              <>
                <Sparkles className="w-4.5 h-4.5 fill-zinc-950" /> Forge Art
              </>
            )}
          </button>
        </div>
      </form>

      {errorMsg && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded text-amber-200 text-xs space-y-3" id="highlight-error-banner">
          <div className="flex gap-2 items-start">
            <AlertCircle className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-sans font-bold text-amber-400 block">Arcane Forge Limit Notice</span>
              <p className="leading-relaxed text-zinc-300">
                {errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("429") || errorMsg.toLowerCase().includes("exhausted")
                  ? "The shared generation quota is temporarily saturated (429 Quota Limit). You can log into your separate AI account below for unlimited generation, or pin a custom picture directly!"
                  : `An arcane anomaly occurred: ${errorMsg}`}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-amber-500/15">
            <button
              type="button"
              onClick={() => setShowAiAccountModal(true)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded text-[11px] flex items-center gap-1.5 transition cursor-pointer shadow"
              id="btn-error-login-ai-account"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In to Your Separate AI Account</span>
            </button>
            <button
              onClick={() => setShowManualAdder(!showManualAdder)}
              type="button"
              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded text-[11px] font-mono border border-amber-500/30 transition text-right cursor-pointer"
            >
              {showManualAdder ? "Hide Manual Form" : "✍️ Open Manual Inscriber"}
            </button>
          </div>
        </div>
      )}

      {/* Manual Picture Inscriber Form */}
      {showManualAdder && (
        <form onSubmit={handleAddManual} className="p-4 bg-zinc-950 border border-zinc-800 rounded space-y-3 animation-fadeIn">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-850">
            <span className="text-xs font-mono text-zinc-300 uppercase tracking-widest">✍️ MANUAL PORTRAIT BINDING</span>
            <button
              type="button"
              onClick={() => setShowManualAdder(false)}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 uppercase"
            >
              Close
            </button>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-mono text-zinc-450 block uppercase mb-1">Image URL</label>
              <input
                type="url"
                required
                placeholder="https://images.unsplash.com/photo-... or other direct link"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-zinc-450 block uppercase mb-1">Description / Caption</label>
              <input
                type="text"
                required
                placeholder="e.g. 'Lord Blackwood standing by the dragon altar'"
                value={manualCaption}
                onChange={(e) => setManualCaption(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-sans font-bold text-xs rounded transition"
            >
              Bind Image to Journal
            </button>
          </div>
        </form>
      )}

        {/* Optional Notice when key operates with vector continuity masterwork */}
        {paidKeyNotice && (
          <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Masterpiece vector chronicle forged with full episode theme &amp; character continuity! Log into your separate AI account below to unlock 1K photorealistic concept art.</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowAiAccountModal(true)}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded text-[11px] flex items-center gap-1.5 transition cursor-pointer"
                id="btn-notice-ai-login"
              >
                <LogIn className="w-3 h-3" />
                <span>Log In to AI Account</span>
              </button>
              <button onClick={() => setPaidKeyNotice(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Highlights Grid */}
        {highlights.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 bg-zinc-950/40 border border-zinc-850 border-dashed rounded text-zinc-500 font-sans text-xs">
            <Image className="w-10 h-10 text-zinc-700 mb-2" />
            <span>No visual scroll-highlights created yet for this campaign session.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            <AnimatePresence>
              {highlights.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative bg-zinc-950 border border-zinc-850 hover:border-amber-500/40 rounded-lg overflow-hidden flex flex-col p-3 transition shadow-md"
                  id={`highlight-card-${item.id}`}
                >
                  {/* Major Theme Pill */}
                  {item.majorTheme && (
                    <div className="mb-2 px-2 py-1 bg-amber-500/10 border border-amber-500/25 rounded text-[10px] font-sans text-amber-300 font-medium line-clamp-1" title={item.majorTheme}>
                      📜 <strong>Theme:</strong> {item.majorTheme}
                    </div>
                  )}

                  {/* Thumbnail Display */}
                  <div
                    onClick={() => openImageFullSize(item.imageUrl, item.caption)}
                    className="relative aspect-square w-full rounded-md bg-zinc-900 overflow-hidden border border-zinc-800 cursor-pointer group/thumb"
                    title="Click to open image full size in a new window"
                    id={`highlight-img-container-${item.id}`}
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.caption}
                      referrerPolicy="no-referrer"
                      className="object-cover w-full h-full group-hover/thumb:scale-105 transition duration-500"
                    />
                    
                    {/* Hover Overlay with Full Size Prompt */}
                    <div className="absolute inset-0 bg-black/55 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-3 text-center">
                      <div className="p-2 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-300">
                        <Maximize2 className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-sans font-bold text-zinc-100 uppercase tracking-wider">
                        Open Full Size
                      </span>
                      <span className="text-[9px] font-mono text-amber-400 flex items-center gap-1">
                        New Window <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>

                    {/* Delete Button (Overlay) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteHighlight(item.id);
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-red-650 text-zinc-300 hover:text-white rounded transition z-10"
                      title="Expatriate Highlight"
                      id={`btn-delete-${item.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Characters In Scene Badges */}
                  {item.charactersInScene && item.charactersInScene.length > 0 && (
                    <div className="mt-2.5 flex items-center gap-1 flex-wrap">
                      <span className="text-[9px] font-mono text-zinc-500 uppercase">Cast:</span>
                      {item.charactersInScene.map((c, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[9.5px] font-mono text-zinc-300 flex items-center gap-1">
                          <User className="w-2.5 h-2.5 text-amber-400" />
                          {c.name}
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => setInspectedHighlight(item)}
                        className="ml-auto text-[9px] font-mono text-amber-400 hover:text-amber-300 underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Info className="w-2.5 h-2.5" /> Continuity
                      </button>
                    </div>
                  )}

                  {/* Caption Control Area */}
                  <div className="mt-2.5 flex-1 flex flex-col justify-between">
                    {editingId === item.id ? (
                      <div className="space-y-1.5">
                        <textarea
                          value={editCaption}
                          onChange={(e) => setEditCaption(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-zinc-100 font-sans focus:outline-none focus:border-red-500"
                          rows={2}
                        />
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => saveEdit(item.id)}
                            className="p-1 bg-green-700/85 hover:bg-green-600 text-white rounded transition"
                            id={`btn-confirm-edit-${item.id}`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-1.5 pt-1">
                        <p className="text-zinc-300 text-xs font-sans leading-relaxed italic pr-4">
                          "{item.caption}"
                        </p>
                        <button
                          onClick={() => startEditing(item)}
                          className="p-1 hover:bg-zinc-900 text-zinc-500 hover:text-red-400 rounded transition shrink-0"
                          title="Edit caption"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Character Continuity Inspector Modal */}
        <AnimatePresence>
          {inspectedHighlight && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
              onClick={() => setInspectedHighlight(null)}
            >
              <div
                className="bg-zinc-950 border border-amber-500/40 rounded-xl p-5 max-w-lg w-full space-y-4 shadow-2xl relative cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-amber-400" />
                    <h4 className="font-fantasy text-sm text-zinc-100 font-bold uppercase tracking-wider">
                      Session Character Continuity Sheet
                    </h4>
                  </div>
                  <button onClick={() => setInspectedHighlight(null)} className="p-1 text-zinc-400 hover:text-white cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {inspectedHighlight.majorTheme && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-200">
                    <strong>Major Episodic Theme:</strong> {inspectedHighlight.majorTheme}
                  </div>
                )}

                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {(inspectedHighlight.charactersInScene || []).map((char, idx) => (
                    <div key={idx} className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-lg space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-amber-300 font-fantasy text-sm">{char.name}</span>
                        <span className="text-[10px] font-mono bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">{char.role || "Cast"}</span>
                      </div>
                      {char.facialFeatures && (
                        <p className="text-zinc-300">
                          <strong className="text-zinc-400">Facial Features:</strong> {char.facialFeatures}
                        </p>
                      )}
                      {char.bodyFeatures && (
                        <p className="text-zinc-300">
                          <strong className="text-zinc-400">Body Build:</strong> {char.bodyFeatures}
                        </p>
                      )}
                      {char.attireAndGear && (
                        <p className="text-zinc-300">
                          <strong className="text-zinc-400">Attire &amp; Gear:</strong> {char.attireAndGear}
                        </p>
                      )}
                      {char.actionInScene && (
                        <p className="text-zinc-300 italic text-[11px] pt-1 border-t border-zinc-800/60">
                          "{char.actionInScene}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-zinc-800 flex justify-end">
                  <button
                    onClick={() => setInspectedHighlight(null)}
                    className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FULL SIZE IMAGE LIGHTBOX MODAL */}
        <AnimatePresence>
          {lightboxImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLightboxImage(null)}
              className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8 cursor-zoom-out"
              id="highlight-lightbox-modal"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center justify-center space-y-4 cursor-default"
              >
                {/* Modal Top Controls Bar */}
                <div className="w-full flex items-center justify-between border-b border-zinc-800 pb-3 text-zinc-300">
                  <div className="flex items-center gap-2">
                    <Image className="w-4 h-4 text-amber-500" />
                    <span className="font-fantasy font-bold text-xs uppercase tracking-wider text-amber-300">
                      Full Resolution Artwork
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={lightboxImage.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded text-xs font-sans font-bold flex items-center gap-1.5 transition"
                      title="Open directly in a new window tab"
                      id="btn-lightbox-open-new-window"
                    >
                      <span>Open in New Window</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => setLightboxImage(null)}
                      className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-full transition"
                      id="btn-lightbox-close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Full Size Image */}
                <div className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 max-h-[75vh] flex items-center justify-center shadow-2xl">
                  <img
                    src={lightboxImage.imageUrl}
                    alt={lightboxImage.caption}
                    referrerPolicy="no-referrer"
                    className="max-h-[75vh] max-w-full object-contain rounded"
                  />
                </div>

                {/* Caption */}
                {lightboxImage.caption && (
                  <p className="text-center text-sm font-sans italic text-amber-200/90 max-w-2xl leading-relaxed bg-zinc-900/80 px-4 py-2 rounded border border-zinc-800">
                    "{lightboxImage.caption}"
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SEPARATE AI ACCOUNT LOGIN MODAL */}
        <AiAccountModal
          isOpen={showAiAccountModal}
          onClose={() => setShowAiAccountModal(false)}
          onAccountChange={(newKey) => setCustomAiKey(newKey)}
        />
    </div>
  );
}
