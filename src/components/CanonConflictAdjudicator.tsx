import React, { useState, useEffect } from "react";
import {
  Shield,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Loader2,
  Check,
  Edit3,
  BookOpen,
  Sparkles,
  X,
} from "lucide-react";
import { CanonConflictItem } from "../lib/canonConflictParser";

interface CanonConflictAdjudicatorProps {
  conflicts: CanonConflictItem[];
  onEstablishCanon: (decreeText: string) => Promise<void>;
  sessionId?: string;
}

export function CanonConflictAdjudicator({
  conflicts,
  onEstablishCanon,
}: CanonConflictAdjudicatorProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // State mapping conflict id -> choice ("dm" | "player" | "custom")
  const [selectedChoices, setSelectedChoices] = useState<Record<string, "dm" | "player" | "custom">>({});
  
  // Custom text for custom choice
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});

  // Set of conflict IDs that have been confirmed/adjudicated
  const [adjudicatedIds, setAdjudicatedIds] = useState<Set<string>>(new Set());

  // Collapse state: false by default, automatically collapses to true when all are adjudicated!
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Initialize default choices (defaulting to "dm" for each conflict)
  useEffect(() => {
    if (conflicts.length > 0) {
      setSelectedChoices((prev) => {
        const next = { ...prev };
        conflicts.forEach((c) => {
          if (!next[c.id]) {
            next[c.id] = "dm";
          }
        });
        return next;
      });
    }
  }, [conflicts]);

  if (!conflicts || conflicts.length === 0) {
    return null;
  }

  const currentConflict = conflicts[currentIndex] || conflicts[0];
  const totalConflicts = conflicts.length;
  const adjudicatedCount = adjudicatedIds.size;
  const allAdjudicated = adjudicatedCount >= totalConflicts;

  // Handles confirming decision for current conflict item and advancing
  const handleConfirmCurrent = async () => {
    if (!currentConflict) return;

    const newAdjudicated = new Set<string>(adjudicatedIds);
    newAdjudicated.add(currentConflict.id);
    setAdjudicatedIds(newAdjudicated);

    // If there are more un-adjudicated conflicts, advance to the next un-adjudicated conflict
    if (newAdjudicated.size < totalConflicts) {
      const nextUnresolvedIdx = conflicts.findIndex((c) => !newAdjudicated.has(c.id));
      if (nextUnresolvedIdx !== -1) {
        setCurrentIndex(nextUnresolvedIdx);
      } else if (currentIndex < totalConflicts - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    } else {
      // ALL conflicts have been adjudicated! Compile rulings and auto-collapse
      await finalizeAllAdjudications(newAdjudicated);
    }
  };

  // Compiles all conflict decisions into a decree and calls onEstablishCanon
  const finalizeAllAdjudications = async (finalAdjudicatedSet?: Set<string>) => {
    setIsSaving(true);
    setSaveSuccess(null);

    try {
      const rulingsList: string[] = [];

      conflicts.forEach((c, idx) => {
        const choice = selectedChoices[c.id] || "dm";
        let rulingText = "";
        if (choice === "dm") {
          rulingText = `Ruled in favor of DM Scribe Log: "${c.dmRecord}"`;
        } else if (choice === "player") {
          rulingText = `Ruled in favor of Player Journal: "${c.playerRecord}"`;
        } else if (choice === "custom") {
          rulingText = `Custom Decree: "${customTexts[c.id] || c.dmRecord}"`;
        }
        rulingsList.push(`• Conflict ${idx + 1} [${c.topic}]: ${rulingText}`);
      });

      const fullDecree = `CANON CONFLICT RESOLUTION (${conflicts.length} Discrepancies Adjudicated):\n` + rulingsList.join("\n");

      await onEstablishCanon(fullDecree);

      // Auto collapse so it doesn't distract the reader going forward!
      setIsCollapsed(true);
      setSaveSuccess(`📜 All ${conflicts.length} Canon Conflicts successfully adjudicated & established as Canon!`);
    } catch (err: any) {
      alert(`Failed to establish canonical rulings: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const choiceForCurrent = selectedChoices[currentConflict.id] || "dm";

  return (
    <div
      className="bg-zinc-950 border border-amber-500/40 rounded-xl p-4 md:p-5 shadow-xl space-y-4 relative overflow-hidden transition-all duration-300"
      id="canon-conflict-adjudicator"
    >
      {/* Decorative top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600" />

      {/* Header & Progress Bar */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-fantasy font-bold text-sm md:text-base uppercase text-amber-300 tracking-wider">
                ⚖️ CANON DISCREPANCY ADJUDICATOR
              </h4>
              <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full">
                {totalConflicts} {totalConflicts === 1 ? "Conflict" : "Conflicts"} Detected
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-sans mt-0.5">
              Review and adjudicate discrepancies between DM Scribe Notes and Player Journals.
            </p>
          </div>
        </div>

        {/* Progress Badge & Collapse Toggle */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold block">
              Adjudication Progress
            </span>
            <span className="text-xs font-mono font-bold text-amber-400">
              {adjudicatedCount} / {totalConflicts} Resolved
            </span>
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-750 text-zinc-300 hover:text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            id="btn-toggle-collapse-adjudicator"
          >
            {isCollapsed ? (
              <>
                <span>Expand Adjudicator</span>
                <ChevronDown className="w-4 h-4 text-amber-400" />
              </>
            ) : (
              <>
                <span>Collapse Notes</span>
                <ChevronUp className="w-4 h-4 text-amber-400" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {saveSuccess && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-sans rounded-lg flex items-center justify-between shadow">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
          <button
            onClick={() => setSaveSuccess(null)}
            className="text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* COLLAPSED VIEW */}
      {isCollapsed ? (
        <div
          onClick={() => setIsCollapsed(false)}
          className="bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 rounded-lg p-3 flex items-center justify-between cursor-pointer transition"
          id="adjudicator-collapsed-banner"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className={`w-4 h-4 ${allAdjudicated ? "text-emerald-400" : "text-amber-400"}`} />
            <div className="text-xs font-sans">
              <span className="font-fantasy font-bold text-amber-300 uppercase mr-2">
                {allAdjudicated ? "✓ ALL CANON CONFLICTS ADJUDICATED & ESTABLISHED" : `⚖️ CANON CONFLICTS (${adjudicatedCount}/${totalConflicts} RESOLVED)`}
              </span>
              <span className="text-zinc-400 text-[11px] hidden md:inline">
                (Conflict notes collapsed to keep chronicle clean. Click to expand and re-evaluate.)
              </span>
            </div>
          </div>
          <span className="text-xs font-mono text-amber-400 hover:underline font-semibold flex items-center gap-1">
            Expand <ChevronDown className="w-3.5 h-3.5" />
          </span>
        </div>
      ) : (
        /* EXPANDED INTERACTIVE STEPPER */
        <div className="space-y-4 animate-fade-in" id="adjudicator-stepper-body">
          {/* Progress Bar Visual */}
          <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800 flex">
            <div
              className="bg-gradient-to-r from-amber-600 to-yellow-400 h-full transition-all duration-300"
              style={{ width: `${Math.round((adjudicatedCount / totalConflicts) * 100)}%` }}
            />
          </div>

          {/* Stepper Navigation Bar */}
          <div className="flex items-center justify-between bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-750 disabled:opacity-40 text-zinc-300 text-xs font-semibold rounded transition flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              id="btn-prev-conflict"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Conflict</span>
            </button>

            <div className="text-center">
              <span className="font-fantasy font-bold text-xs uppercase tracking-wide text-amber-300 block">
                Conflict {currentIndex + 1} of {totalConflicts}
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                {adjudicatedIds.has(currentConflict.id) ? (
                  <span className="text-emerald-400 font-bold">✓ Adjudicated</span>
                ) : (
                  <span className="text-amber-400 font-bold">● Pending Ruling</span>
                )}
              </span>
            </div>

            <button
              onClick={() => setCurrentIndex((prev) => Math.min(totalConflicts - 1, prev + 1))}
              disabled={currentIndex === totalConflicts - 1}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-750 disabled:opacity-40 text-zinc-300 text-xs font-semibold rounded transition flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              id="btn-next-conflict"
            >
              <span>Next Conflict</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Conflict Prompt Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4 shadow-inner">
            <div className="space-y-1 border-b border-zinc-800 pb-3">
              <span className="text-[10px] font-mono uppercase text-amber-400 font-bold tracking-wider">
                Discrepancy Topic:
              </span>
              <h5 className="font-fantasy font-bold text-base text-zinc-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{currentConflict.topic}</span>
              </h5>
            </div>

            <p className="text-xs text-zinc-300 font-sans leading-relaxed">
              Select which record should be established as canonical truth for this session chapter, or write a custom DM decree:
            </p>

            {/* Decision Cards Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Option 1: DM Scribe Log Record */}
              <div
                onClick={() =>
                  setSelectedChoices((prev) => ({ ...prev, [currentConflict.id]: "dm" }))
                }
                className={`p-3.5 rounded-lg border cursor-pointer transition space-y-2 relative ${
                  choiceForCurrent === "dm"
                    ? "bg-amber-950/30 border-amber-500 shadow-md ring-1 ring-amber-500/50"
                    : "bg-zinc-950/60 border-zinc-800 hover:border-zinc-700"
                }`}
                id={`option-dm-${currentConflict.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span className="font-fantasy font-bold text-xs text-amber-300 uppercase">
                      1. DM Scribe Log Record
                    </span>
                  </div>
                  {choiceForCurrent === "dm" && (
                    <span className="text-[10px] font-mono font-bold bg-amber-500 text-zinc-950 px-2 py-0.5 rounded flex items-center gap-1">
                      <Check className="w-3 h-3" /> Selected
                    </span>
                  )}
                </div>
                <p className="text-xs font-sans text-zinc-200 leading-relaxed bg-zinc-950/80 p-2.5 rounded border border-zinc-850">
                  {currentConflict.dmRecord}
                </p>
                <span className="text-[10px] font-mono text-zinc-500 italic block">
                  Default assumption based on official DM notes.
                </span>
              </div>

              {/* Option 2: Player Journal Record */}
              <div
                onClick={() =>
                  setSelectedChoices((prev) => ({ ...prev, [currentConflict.id]: "player" }))
                }
                className={`p-3.5 rounded-lg border cursor-pointer transition space-y-2 relative ${
                  choiceForCurrent === "player"
                    ? "bg-indigo-950/30 border-indigo-500 shadow-md ring-1 ring-indigo-500/50"
                    : "bg-zinc-950/60 border-zinc-800 hover:border-zinc-700"
                }`}
                id={`option-player-${currentConflict.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                    <span className="font-fantasy font-bold text-xs text-indigo-300 uppercase">
                      2. Player Journal Record
                    </span>
                  </div>
                  {choiceForCurrent === "player" && (
                    <span className="text-[10px] font-mono font-bold bg-indigo-500 text-zinc-950 px-2 py-0.5 rounded flex items-center gap-1">
                      <Check className="w-3 h-3" /> Selected
                    </span>
                  )}
                </div>
                <p className="text-xs font-sans text-zinc-200 leading-relaxed bg-zinc-950/80 p-2.5 rounded border border-zinc-850">
                  {currentConflict.playerRecord}
                </p>
                <span className="text-[10px] font-mono text-zinc-500 italic block">
                  Adopt the player's diary entry as canonical truth.
                </span>
              </div>
            </div>

            {/* Option 3: Custom Decree Text */}
            <div
              onClick={() =>
                setSelectedChoices((prev) => ({ ...prev, [currentConflict.id]: "custom" }))
              }
              className={`p-3.5 rounded-lg border cursor-pointer transition space-y-2 ${
                choiceForCurrent === "custom"
                  ? "bg-zinc-900 border-amber-500 shadow-md ring-1 ring-amber-500/50"
                  : "bg-zinc-950/60 border-zinc-800 hover:border-zinc-700"
              }`}
              id={`option-custom-${currentConflict.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  <span className="font-fantasy font-bold text-xs text-amber-300 uppercase">
                    3. Custom DM Decree / Compromise
                  </span>
                </div>
                {choiceForCurrent === "custom" && (
                  <span className="text-[10px] font-mono font-bold bg-amber-500 text-zinc-950 px-2 py-0.5 rounded flex items-center gap-1">
                    <Check className="w-3 h-3" /> Selected
                  </span>
                )}
              </div>

              <input
                type="text"
                value={customTexts[currentConflict.id] || ""}
                onChange={(e) =>
                  setCustomTexts((prev) => ({
                    ...prev,
                    [currentConflict.id]: e.target.value,
                  }))
                }
                placeholder="Type custom DM decree or compromise ruling here..."
                className="w-full bg-zinc-950 border border-zinc-750 text-zinc-200 text-xs font-sans rounded p-2.5 focus:outline-none focus:border-amber-500 placeholder:text-zinc-600"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800 gap-3 flex-wrap">
              <span className="text-xs font-sans text-zinc-400">
                Decision:{" "}
                <span className="font-bold text-amber-300">
                  {choiceForCurrent === "dm"
                    ? "🛡️ DM Scribe Log"
                    : choiceForCurrent === "player"
                    ? "📖 Player Journal"
                    : "✍️ Custom Decree"}
                </span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleConfirmCurrent}
                  disabled={isSaving}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 font-bold text-xs rounded-lg transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow"
                  id="btn-confirm-ruling-next"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>
                        {currentIndex < totalConflicts - 1
                          ? "Confirm Ruling & Next Conflict"
                          : "Confirm & Finalize All Rulings"}
                      </span>
                    </>
                  )}
                </button>

                {allAdjudicated && (
                  <button
                    onClick={() => finalizeAllAdjudications()}
                    disabled={isSaving}
                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-semibold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
                    id="btn-finalize-all-now"
                  >
                    <span>Save & Collapse All</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
