import React, { useState } from "react";
import { Image, Sparkles, Loader2, Trash2, Edit2, Check, X, AlertCircle, Maximize2, ExternalLink } from "lucide-react";
import { HighlightItem, CharacterItem, HeroCharacter } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface HighlightSectionProps {
  highlights: HighlightItem[];
  onChange: (updated: HighlightItem[]) => void;
  sessionSummary?: string;
  characters?: CharacterItem[];
  campaignHeroes?: HeroCharacter[];
  previousHighlights?: HighlightItem[];
}

export function HighlightSection({
  highlights,
  onChange,
  sessionSummary,
  characters,
  campaignHeroes,
  previousHighlights,
}: HighlightSectionProps) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Manual picture fields
  const [showManualAdder, setShowManualAdder] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [manualCaption, setManualCaption] = useState("");
  const [continuityGenerating, setContinuityGenerating] = useState(false);

  // Lightbox overlay & new window state
  const [lightboxImage, setLightboxImage] = useState<{ imageUrl: string; caption: string } | null>(null);

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

  // Action: One-button generator based on session summary with character & visual continuity
  async function generateContinuityHighlight() {
    if (!sessionSummary) return;

    setContinuityGenerating(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/generate-continuity-illustration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: sessionSummary,
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
      
      const newHighlight: HighlightItem = {
        id: "highlight-continuity-" + Date.now(),
        imageUrl: data.imageUrl,
        caption: data.caption || `Chronicle: ${data.optimizedPrompt?.substring(0, 80)}...`,
        optimizedPrompt: data.optimizedPrompt,
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
      const res = await fetch("/api/generate-highlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        <span className="font-mono text-[10px] bg-red-500/10 text-red-500 border border-red-500/30 px-2 py-0.5 rounded uppercase">
          Imagen Forge
        </span>
      </div>

      <p className="text-zinc-400 text-xs leading-relaxed">
        Summon the creative spirits of GenAI to craft stunning conceptual art representing critical NPC encounters, magic items, or epic battle scenes. These visuals will be preserved in the campaign journal forever.
      </p>

      {/* ONE-BUTTON CHRONICLE ILLUSTRATION GENERATOR */}
      {sessionSummary ? (
        <div className="bg-gradient-to-br from-amber-950/20 via-zinc-950/80 to-amber-900/10 p-4 border border-amber-500/15 rounded-lg space-y-3 relative overflow-hidden shadow-lg transition duration-300 hover:border-amber-500/25">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.06),transparent)] pointer-events-none" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
            <div className="text-left space-y-1">
              <span className="text-[9px] font-mono font-bold tracking-widest text-amber-500 uppercase">
                📜 CONTINUITY-AWARE INKPORTAL
              </span>
              <h4 className="text-xs font-semibold font-fantasy text-zinc-200 tracking-wider">
                AUTO-CHRONICLE SESSION SCENE
              </h4>
              <p className="text-[10px] text-zinc-400 font-sans leading-relaxed max-w-sm">
                Generates a grand masterpiece based directly on this session's summary, referencing character descriptions and previous illustrations to maintain portrait continuity.
              </p>
            </div>
            <button
              onClick={generateContinuityHighlight}
              disabled={continuityGenerating || !sessionSummary}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-zinc-800 disabled:to-zinc-850 disabled:text-zinc-650 text-zinc-950 font-sans font-bold text-xs uppercase tracking-wider rounded shadow-md hover:shadow-amber-500/10 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer border border-amber-300/20 whitespace-nowrap"
              id="btn-continuity-illustration"
            >
              {continuityGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>Casting Paint...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 animate-pulse text-zinc-950" />
                  <span>Forge Chronicle Art</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3.5 bg-zinc-950/40 border border-zinc-850 rounded-lg text-center text-zinc-500 text-[10px] font-mono">
          ⚠️ Complete and save the Chronicle Overview summary first to enable the continuity generator!
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
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded text-amber-200 text-xs space-y-2" id="highlight-error-banner">
          <div className="flex gap-2 items-start">
            <AlertCircle className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-sans font-bold text-amber-400 block mb-0.5">Arcane Forge Limit Warning</span>
              <p className="leading-relaxed text-zinc-300">
                {errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("429") || errorMsg.toLowerCase().includes("exhausted")
                  ? "The etheric portal is temporarily locked due to free-tier Google Gemini limit exhaustion (429 Quota). You can wait briefly for its recovery, enable a paid plan via Settings > Secrets, or pin a custom picture directly below!"
                  : `An arcane anomaly occurred: ${errorMsg}`}
              </p>
            </div>
          </div>
          
          <div className="flex justify-end pt-1">
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
                className="group relative bg-zinc-950 border border-zinc-850 hover:border-red-500/40 rounded overflow-hidden flex flex-col p-2.5 transition"
                id={`highlight-card-${item.id}`}
              >
                {/* Thumbnail Display */}
                <div
                  onClick={() => openImageFullSize(item.imageUrl, item.caption)}
                  className="relative aspect-square w-full rounded bg-zinc-900 overflow-hidden border border-zinc-850 cursor-pointer group/thumb"
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
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-3 text-center">
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

                {/* Caption Control Area */}
                <div className="mt-3 flex-1 flex flex-col justify-between">
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
                    <div className="flex items-start justify-between gap-1.5">
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
    </div>
  );
}
