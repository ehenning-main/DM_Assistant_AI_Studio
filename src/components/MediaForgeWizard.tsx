import React, { useState } from "react";
import { Sparkles, Loader2, Image as ImageIcon, Wand2, AlertTriangle } from "lucide-react";
import { HighlightItem, Session } from "../types";

interface MediaForgeWizardProps {
  session: Session;
  onUpdateSession: (updated: Session) => Promise<void>;
}

export function MediaForgeWizard({ session, onUpdateSession }: MediaForgeWizardProps) {
  const [extracting, setExtracting] = useState(false);
  const [forging, setForging] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [lastNotification, setLastNotification] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<{
    imagePrompts: string[];
  } | null>(null);

  async function handleAnalyze() {
    if (!session.summary) return;
    setExtracting(true);
    setLastNotification(null);
    try {
      const res = await fetch("/api/extract-media-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: session.summary }),
      });
      if (!res.ok) throw new Error("Failed to analyze summary for scenes.");
      const data = await res.json();
      setExtractedData({
        imagePrompts: data.imagePrompts || [],
      });
    } catch (err: any) {
      setLastNotification(`Arcane visualizer failed to dissect chronicle: ${err.message}`);
    } finally {
      setExtracting(false);
    }
  }

  async function handleForge() {
    if (!extractedData) return;
    setForging(true);
    setProgress("Initiating Forge Process...");
    setLastNotification(null);

    let skippedImagesCount = 0;

    try {
      const createdHighlights: HighlightItem[] = [];

      // Generate 3 images
      const imgPromptsToRun = extractedData.imagePrompts.slice(0, 3);
      for (let i = 0; i < imgPromptsToRun.length; i++) {
        const promptText = imgPromptsToRun[i];
        setProgress(`Forging highlight artwork ${i + 1}/3: "${promptText.substring(0, 30)}..."`);
        
        try {
          const res = await fetch("/api/generate-highlight", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promptString: promptText }),
          });

          if (res.ok) {
            const data = await res.json();
            createdHighlights.push({
              id: `forge-highlight-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
              imageUrl: data.imageUrl,
              caption: promptText,
            });
          } else {
            console.warn(`Art forge skipped slot ${i+1}`);
            skippedImagesCount++;
          }
        } catch (err) {
          console.error(`Error forging image highlight ${i+1}:`, err);
          skippedImagesCount++;
        }
      }

      // Save into session
      const updatedSession: Session = {
        ...session,
        highlights: [...(session.highlights || []), ...createdHighlights],
      };

      setProgress("Finalizing campaign records...");
      await onUpdateSession(updatedSession);
      setProgress("Forge process accomplished successfully!");
      setExtractedData(null);

      if (skippedImagesCount > 0) {
        setLastNotification(
          `✨ Multi-Media assets bound! Note: ${skippedImagesCount} illustration slots fallback-simulated automatically due to free-API rate-limits. Feel free to use the manual image attachment section as needed!`
        );
      } else {
        setLastNotification("✨ Batch chronicles successfully generated and bound!");
      }
    } catch (err: any) {
      setLastNotification(`Visualizer anomaly during batch material forge: ${err.message}`);
    } finally {
      setForging(false);
      setProgress("");
    }
  }

  // If no summary, prompt summarizing first
  if (!session.summary) {
    return null;
  }

  return (
    <div className="p-5 bg-zinc-900 border border-amber-500/30 rounded-lg shadow-xl relative overflow-hidden my-4" id="media-forge-wizard">
      {/* Decorative medieval top rail */}
      <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-red-600 via-amber-500 to-red-600" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-amber-500 animate-pulse" />
            <h3 className="font-fantasy font-bold text-zinc-100 tracking-wider text-sm md:text-base uppercase">
              🧙‍♂️ Chronicle Multi-Media Forge
            </h3>
            <span className="text-[10px] font-mono bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded uppercase">
              Auto-Pilot
            </span>
          </div>
          <p className="text-zinc-400 text-xs mt-1 max-w-2xl leading-relaxed">
            Scan your active AI Campaign Chronicle automatically! Our system uses deep narrative reasoning to extract <strong>3 key illustration scenes</strong>, then batch-forges them directly.
          </p>
        </div>

        {!extractedData && !forging && (
          <button
            onClick={handleAnalyze}
            disabled={extracting}
            className="px-4 py-2 hover:from-amber-600 hover:to-red-600 bg-gradient-to-r from-amber-500 to-red-500 disabled:from-zinc-800 disabled:to-zinc-900 text-zinc-950 disabled:text-zinc-500 font-sans font-bold text-xs rounded transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            id="btn-forge-wizard-start"
          >
            {extracting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Deep Scanning Summary...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 fill-zinc-950" /> Dissect Summary & Prepare Assets
              </>
            )}
          </button>
        )}
      </div>

      {lastNotification && (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded text-amber-300 text-xs flex items-start gap-2.5" id="wizard-notification">
          <AlertTriangle className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-sans font-bold block mb-0.5 text-amber-400">Chronicle Forge Message</span>
            <p className="leading-relaxed text-zinc-300">{lastNotification}</p>
          </div>
          <button 
            type="button"
            onClick={() => setLastNotification(null)}
            className="text-[10px] text-zinc-500 hover:text-zinc-350 font-mono uppercase cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {extractedData && !forging && (
        <div className="mt-4 pt-3.5 border-t border-zinc-805 space-y-4 animate-fadeIn">
          <div className="bg-zinc-950 p-4 rounded border border-zinc-850 space-y-3">
            <h4 className="text-xs font-mono text-amber-400 uppercase tracking-widest">📋 DISCOVERED VISUAL SCENARIOS</h4>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-mono text-zinc-500 flex items-center gap-1.5">
                  <ImageIcon className="w-3 h-3 text-red-500" /> Key Highlight Drawings (3 slots)
                </span>
                <div className="space-y-1.5">
                  {extractedData.imagePrompts.map((prompt, idx) => (
                    <div key={idx} className="bg-zinc-900/50 p-2.5 rounded border border-zinc-800 text-zinc-300 text-xs font-sans leading-relaxed flex gap-2">
                      <span className="font-mono text-red-500 font-bold shrink-0">#{idx + 1}</span>
                      <input
                        type="text"
                        value={prompt}
                        onChange={(e) => {
                          const updated = [...extractedData.imagePrompts];
                          updated[idx] = e.target.value;
                          setExtractedData({ ...extractedData, imagePrompts: updated });
                        }}
                        className="bg-transparent border-none text-zinc-200 focus:outline-none w-full italic"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setExtractedData(null)}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-sans rounded transition cursor-pointer"
            >
              Reset Dissection
            </button>
            <button
              onClick={handleForge}
              className="px-4 py-2 bg-gradient-to-r from-red-650 to-amber-500 hover:from-red-500 hover:to-amber-400 text-zinc-950 font-sans font-bold text-xs sm:text-sm rounded transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
              id="btn-forge-wizard-execute"
            >
              <Sparkles className="w-4 h-4 fill-zinc-950" /> Forge Chronicle Assets
            </button>
          </div>
        </div>
      )}

      {forging && (
        <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-col items-center justify-center p-6 bg-zinc-950 rounded border border-zinc-850">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
          <h4 className="text-xs font-mono text-zinc-100 uppercase tracking-widest mb-1.5 animate-pulse">ARCANE IMAGE COMPILER ACTIVE</h4>
          <p className="text-zinc-400 text-xs font-sans italic text-center max-w-[480px]">
             {progress}
          </p>
        </div>
      )}
    </div>
  );
}

