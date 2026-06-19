import React, { useState } from "react";
import { Image, Sparkles, Loader2, Trash2, Edit2, Check, X, AlertCircle } from "lucide-react";
import { HighlightItem } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface HighlightSectionProps {
  highlights: HighlightItem[];
  onChange: (updated: HighlightItem[]) => void;
}

export function HighlightSection({ highlights, onChange }: HighlightSectionProps) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");

  // Action: Generates a highlight item
  async function generateHighlight(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;

    setGenerating(true);
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
      alert(`Visualizer anomaly: ${error.message}`);
    } finally {
      setGenerating(false);
    }
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
    <div className="space-y-4 p-5 bg-zinc-900 border border-zinc-800 rounded-lg parchment-glow" id="highlight-panel">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Image className="w-5 h-5 text-amber-500 animate-pulse" />
          <h3 className="font-fantasy font-semibold text-zinc-100 tracking-wider text-base">
            ILLUSTRATED CHRONICLE HIGHLIGHTS
          </h3>
        </div>
        <span className="font-mono text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded uppercase">
          Imagen Forge
        </span>
      </div>

      <p className="text-zinc-400 text-xs leading-relaxed">
        Summon the creative spirits of GenAI to craft stunning conceptual art representing critical NPC encounters, magic items, or epic battle scenes. These visuals will be preserved in the campaign journal forever.
      </p>

      {/* Generator Prompt Form */}
      <form onSubmit={generateHighlight} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the highlight scene (e.g. 'A glowing iron longsword embedded in ancient stone moss'...)"
            disabled={generating}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-sans transition"
            id="highlight-prompt-input"
          />
          <button
            type="submit"
            disabled={generating || !prompt.trim()}
            className="px-4 py-2 bg-amber-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-sans font-medium text-xs md:text-sm rounded transition hover:bg-amber-600 active:scale-95 flex items-center gap-1 cursor-pointer"
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
                className="group relative bg-zinc-950 border border-zinc-850 hover:border-amber-500/40 rounded overflow-hidden flex flex-col p-2.5 transition"
                id={`highlight-card-${item.id}`}
              >
                {/* Thumbnail Display */}
                <div className="relative aspect-square w-full rounded bg-zinc-900 overflow-hidden border border-zinc-850">
                  <img
                    src={item.imageUrl}
                    alt={item.caption}
                    referrerPolicy="no-referrer"
                    className="object-cover w-full h-full group-hover:scale-102 transition duration-500"
                  />
                  
                  {/* Delete Button (Overlay) */}
                  <button
                    onClick={() => deleteHighlight(item.id)}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-red-650 text-zinc-300 hover:text-white rounded transition"
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
                        className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-zinc-100 font-sans focus:outline-none focus:border-amber-500"
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
                        className="p-1 hover:bg-zinc-900 text-zinc-500 hover:text-amber-400 rounded transition shrink-0"
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
    </div>
  );
}
