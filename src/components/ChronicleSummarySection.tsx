import React, { useState, useEffect, useRef } from "react";
import {
  Scroll,
  Edit3,
  Check,
  X,
  Trash2,
  Loader2,
  Sparkles,
  Eye,
  Save,
  HelpCircle,
  RotateCcw,
  BookOpen,
  Shield,
} from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { CanonConflictAdjudicator } from "./CanonConflictAdjudicator";
import {
  parseCanonConflicts,
  stripCanonConflictsFromMarkdown,
  SAMPLE_CANON_CONFLICTS,
} from "../lib/canonConflictParser";

interface ChronicleSummarySectionProps {
  summary: string;
  summarizing: boolean;
  isResetConfirmOpen: boolean;
  setIsResetConfirmOpen: (open: boolean) => void;
  onGenerateSummary: () => void;
  onResetSummary: () => void;
  onSaveSummary: (updatedSummary: string) => Promise<void>;
  onEstablishCanon?: (decreeText: string) => Promise<void>;
}

export function ChronicleSummarySection({
  summary,
  summarizing,
  isResetConfirmOpen,
  setIsResetConfirmOpen,
  onGenerateSummary,
  onResetSummary,
  onSaveSummary,
  onEstablishCanon,
}: ChronicleSummarySectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(summary || "");
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Canon Decree state
  const [canonDecreeText, setCanonDecreeText] = useState("");
  const [isSavingCanon, setIsSavingCanon] = useState(false);
  const [canonSavedSuccess, setCanonSavedSuccess] = useState<string | null>(null);
  const [manualStepperActive, setManualStepperActive] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Synchronize editedContent when summary changes from external source (like AI summary generation)
  useEffect(() => {
    if (!isEditing) {
      setEditedContent(summary || "");
    }
  }, [summary, isEditing]);

  const handleStartEditing = () => {
    setEditedContent(summary || "");
    setIsEditing(true);
    setActiveTab("write");
  };

  const handleCancelEditing = () => {
    setEditedContent(summary || "");
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveSummary(editedContent);
      setIsEditing(false);
      setShowSavedToast(true);
      setTimeout(() => {
        setShowSavedToast(false);
      }, 3000);
    } catch (err) {
      console.error("Failed to save summary edits:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to insert markdown snippets at cursor position or at end
  const insertSnippet = (snippet: string) => {
    if (!textareaRef.current) {
      setEditedContent((prev) => prev + snippet);
      return;
    }

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = editedContent;

    const before = text.substring(0, start);
    const after = text.substring(end);

    const newText = before + snippet + after;
    setEditedContent(newText);

    // Reset cursor position after state update
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 0);
  };

  return (
    <div
      className="p-6 md:p-8 bg-zinc-900 border border-zinc-800 rounded-lg parchment-glow relative transition duration-300"
      id="summary-section"
    >
      <div className="absolute top-0 left-0 w-2 h-20 bg-red-500/20" />
      <div className="absolute top-0 left-0 w-20 h-2 bg-red-500/20" />

      {/* Header Bar */}
      <div className="flex justify-between items-center border-b border-zinc-800 pb-4 mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Scroll className="w-6 h-6 text-red-500 animate-pulse" />
          <h3 className="font-fantasy font-bold text-base md:text-lg tracking-wider text-zinc-100 uppercase flex items-center gap-2">
            📜 CHRONICLE SUMMARY & SPELLBOOK NOTES
            {isEditing && (
              <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded tracking-normal normal-case">
                ✏️ Editing Mode
              </span>
            )}
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {summarizing && (
            <span className="text-xs text-red-500 flex items-center gap-1.5 font-sans italic animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scribing timeline...
            </span>
          )}

          {showSavedToast && (
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded flex items-center gap-1.5 animate-fade-in">
              <Check className="w-3.5 h-3.5 text-emerald-400" /> Edits Saved to Spellbook!
            </span>
          )}

          {!summarizing && !isEditing && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleStartEditing}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                title="Edit the chronicle summary to fix program mistakes or add custom lore"
                id="btn-edit-summary"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                <span>{summary ? "Edit Summary" : "Write Custom Summary"}</span>
              </button>

              {summary && (
                <>
                  {isResetConfirmOpen ? (
                    <div
                      className="flex items-center gap-1.5 bg-red-950/20 border border-red-900/30 rounded-lg p-1 animate-pulse"
                      id="reset-confirm-box"
                    >
                      <span className="text-[10px] font-mono text-red-400 font-semibold px-2 uppercase tracking-wide">
                        Destroy Chronicle?
                      </span>
                      <button
                        onClick={() => {
                          onResetSummary();
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
          )}

          {isEditing && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelEditing}
                disabled={isSaving}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                id="btn-cancel-edit-summary"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3.5 py-1.5 bg-gradient-to-r from-red-500 to-amber-600 hover:from-red-400 hover:to-amber-500 disabled:from-zinc-800 disabled:to-zinc-800 text-zinc-950 font-bold text-xs rounded-lg transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow"
                id="btn-save-edit-summary"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 fill-zinc-950" /> Save Edits
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* EDIT MODE AREA */}
      {isEditing ? (
        <div className="space-y-4 animate-fade-in" id="summary-edit-container">
          {/* Correction Tip Banner */}
          <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-3.5 text-xs text-amber-200/90 font-sans leading-relaxed flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold font-fantasy tracking-wide text-amber-400 block mb-0.5">
                PROGRAM CORRECTION & SPELLBOOK CHRONICLE EDITOR
              </span>
              Correct any AI transcription errors, adjust character spell names or dice rolls, add missing plot hooks, or format with markdown. All changes save directly to your session chronicle.
            </div>
          </div>

          {/* Editor Header Toolbar & View Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-950/80 p-2 border border-zinc-800 rounded-t-lg">
            {/* Quick Insert Snippets */}
            <div className="flex items-center gap-1 flex-wrap text-[11px] font-mono">
              <span className="text-zinc-500 mr-1 hidden sm:inline">Format:</span>
              <button
                type="button"
                onClick={() => insertSnippet("**bold**")}
                className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-zinc-300 rounded font-bold transition cursor-pointer"
                title="Add bold text"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => insertSnippet("*italic*")}
                className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-zinc-300 rounded italic transition cursor-pointer"
                title="Add italic text"
              >
                I
              </button>
              <button
                type="button"
                onClick={() => insertSnippet("\n## ⚔️ SECTION TITLE\n")}
                className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-zinc-300 rounded font-fantasy transition cursor-pointer"
                title="Add Section Heading"
              >
                ## Heading
              </button>
              <button
                type="button"
                onClick={() => insertSnippet("\n- **Key Event**: ")}
                className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-zinc-300 rounded transition cursor-pointer"
                title="Add Bullet Point"
              >
                • Bullet
              </button>
              <button
                type="button"
                onClick={() => insertSnippet("\n### ⚔️ COMBAT & BATTLE RECAP\n- ")}
                className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-red-400 rounded transition cursor-pointer"
              >
                ⚔️ Combat
              </button>
              <button
                type="button"
                onClick={() => insertSnippet("\n### 👥 KEY NPCs & ALLIES\n- **NPC Name**: ")}
                className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-amber-400 rounded transition cursor-pointer"
              >
                👥 NPC
              </button>
              <button
                type="button"
                onClick={() => insertSnippet("\n### 🎒 LOOT & SPELLBOOK ACQUISITIONS\n- ")}
                className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-sky-400 rounded transition cursor-pointer"
              >
                🎒 Loot
              </button>
            </div>

            {/* Write vs Preview Mode Toggle */}
            <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded border border-zinc-800">
              <button
                type="button"
                onClick={() => setActiveTab("write")}
                className={`px-3 py-1 text-xs font-semibold rounded transition flex items-center gap-1 cursor-pointer ${
                  activeTab === "write"
                    ? "bg-red-500 text-zinc-950 font-bold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                id="btn-tab-write-summary"
              >
                <Edit3 className="w-3 h-3" />
                <span>Write</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`px-3 py-1 text-xs font-semibold rounded transition flex items-center gap-1 cursor-pointer ${
                  activeTab === "preview"
                    ? "bg-red-500 text-zinc-950 font-bold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                id="btn-tab-preview-summary"
              >
                <Eye className="w-3 h-3" />
                <span>Live Preview</span>
              </button>
            </div>
          </div>

          {/* Editor Body */}
          {activeTab === "write" ? (
            <textarea
              ref={textareaRef}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              placeholder="Write or edit the campaign session summary here. Correct program mistakes, add DM lore, details of dice rolls, spellbook notes..."
              rows={16}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-b-lg p-4 text-zinc-100 text-sm font-sans focus:outline-none focus:border-amber-500/70 font-sans leading-relaxed transition resize-y shadow-inner"
              id="summary-edit-textarea"
            />
          ) : (
            <div className="bg-zinc-950/60 p-5 rounded-b-lg border border-zinc-800 min-h-[300px]">
              {editedContent.trim() ? (
                <MarkdownRenderer content={editedContent} />
              ) : (
                <div className="text-zinc-500 italic text-sm font-sans">
                  Nothing written yet. Switch to the Write tab to add chronicle notes.
                </div>
              )}
            </div>
          )}

          {/* Revert to AI summary if different */}
          {summary && editedContent !== summary && (
            <div className="flex justify-between items-center text-xs pt-1">
              <button
                type="button"
                onClick={() => setEditedContent(summary)}
                className="text-zinc-500 hover:text-amber-400 flex items-center gap-1 transition cursor-pointer font-mono"
              >
                <RotateCcw className="w-3 h-3" /> Revert changes to original AI summary
              </button>
            </div>
          )}
        </div>
      ) : (
        /* READ-ONLY VIEW MODE */
        <div className="bg-zinc-950/40 p-5 rounded border border-zinc-850 relative group space-y-4">
          {(() => {
            const parsedConflicts = parseCanonConflicts(summary);
            const conflictsToRender = parsedConflicts.length > 0 ? parsedConflicts : (manualStepperActive ? SAMPLE_CANON_CONFLICTS : []);
            const shouldRenderStepper = conflictsToRender.length > 0;

            return (
              <>
                {/* Render Interactive Conflict Stepper if conflicts were detected or manually activated */}
                {shouldRenderStepper && onEstablishCanon && (
                  <CanonConflictAdjudicator
                    conflicts={conflictsToRender}
                    onEstablishCanon={onEstablishCanon}
                  />
                )}

                {/* Establish Canonical Truth Action Box if no automatic conflicts were parsed but summary exists */}
                {!shouldRenderStepper && summary && onEstablishCanon && (
                  <div className="bg-zinc-950 p-4 border border-amber-500/30 rounded-lg space-y-2.5 shadow-md" id="summary-canon-resolver">
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-amber-400" />
                        <span className="font-fantasy font-bold text-xs uppercase text-amber-300 tracking-wide">
                          Establish Official Canonical Decree for Session
                        </span>
                      </div>
                      <span className="text-[10px] font-sans text-zinc-400 italic">
                        Resolves DM Scribe vs Player Journal discrepancies & appends to Session Notes
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

                    <div className="relative flex items-center gap-2">
                      <input
                        type="text"
                        value={canonDecreeText}
                        onChange={(e) => setCanonDecreeText(e.target.value)}
                        placeholder="e.g. 'CANON DECREE: DM Log is official truth. Party received 200 GP.'"
                        className="w-full bg-zinc-900 border border-zinc-750 text-zinc-200 text-xs font-sans rounded py-2 pl-3 pr-28 focus:outline-none focus:border-amber-500 placeholder:text-zinc-600"
                        id="input-summary-canon-decree"
                      />
                      <button
                        onClick={async () => {
                          if (!canonDecreeText.trim()) return;
                          setIsSavingCanon(true);
                          try {
                            await onEstablishCanon(canonDecreeText.trim());
                            setCanonSavedSuccess("📜 Canonical decree saved and appended to Session Chapter notes!");
                            setCanonDecreeText("");
                          } catch (err: any) {
                            alert(`Failed to save canon decree: ${err.message}`);
                          } finally {
                            setIsSavingCanon(false);
                          }
                        }}
                        disabled={isSavingCanon || !canonDecreeText.trim()}
                        className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-bold text-xs rounded transition flex items-center gap-1 cursor-pointer shrink-0"
                        id="btn-save-summary-canon-decree"
                      >
                        {isSavingCanon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Canon"}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-sans pt-0.5">
                      <span className="font-mono text-zinc-500 uppercase">Presets:</span>
                      <button
                        type="button"
                        onClick={() => setCanonDecreeText("CANON RULING: The DM Scribe Log record is official canon going forward.")}
                        className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-amber-300 rounded cursor-pointer"
                      >
                        Confirm DM Scribe Log
                      </button>
                      <button
                        type="button"
                        onClick={() => setCanonDecreeText("CANON RULING: The Player Journal record is accepted as official canon.")}
                        className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-amber-300 rounded cursor-pointer"
                      >
                        Accept Player Journal
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualStepperActive(true)}
                        className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded font-semibold flex items-center gap-1 cursor-pointer transition ml-auto"
                        id="btn-launch-interactive-stepper"
                      >
                        <Shield className="w-3 h-3 text-amber-400" />
                        <span>Launch Interactive Discrepancy Stepper</span>
                      </button>
                    </div>
                  </div>
                )}

                {summary ? (
                  <MarkdownRenderer
                    content={
                      parsedConflicts.length > 0
                        ? stripCanonConflictsFromMarkdown(summary)
                        : summary
                    }
                  />
                ) : (
                  <div className="text-center py-8 space-y-4">
                    <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-red-500/80">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-fantasy text-zinc-300 font-bold text-sm tracking-wide">
                        NO CHRONICLE SUMMARY COMPILED YET
                      </h4>
                      <p className="text-zinc-500 text-xs max-w-md mx-auto font-sans leading-relaxed">
                        Use the AI Chronological Synthesis above to auto-compile session notes, or manually write and customize your own summary notes.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <button
                        onClick={onGenerateSummary}
                        disabled={summarizing}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-zinc-800 text-zinc-950 font-sans font-bold text-xs rounded transition flex items-center gap-1.5 cursor-pointer shadow"
                      >
                        <Sparkles className="w-3.5 h-3.5 fill-zinc-950" />
                        <span>Compile with AI</span>
                      </button>
                      <button
                        onClick={handleStartEditing}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-200 font-sans font-semibold text-xs rounded transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Write Custom Summary</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
