import React, { useState } from "react";
import { User, Plus, Trash2, Shield, UserX, Sparkles, ChevronDown, ChevronUp, Dices, Save, Check, RefreshCw, AlertCircle } from "lucide-react";
import { CharacterItem, Session } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface CharacterTrackerProps {
  characters: CharacterItem[];
  onChange: (updated: CharacterItem[]) => void;
  session?: Session;
}

export function CharacterTracker({ characters = [], onChange, session }: CharacterTrackerProps) {
  // Manual adding state
  const [name, setName] = useState("");
  const [role, setRole] = useState("NPC Ally");
  const [description, setDescription] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Auto-Detect state
  const [detecting, setDetecting] = useState(false);
  const [detectedNPCs, setDetectedNPCs] = useState<CharacterItem[]>([]);
  const [detectionError, setDetectionError] = useState<string | null>(null);

  // Key stats form state (reusable for review prompting and editing active)
  const [isFormForReview, setIsFormForReview] = useState(true); // true = reviewing a detected NPC; false = editing existing
  const [targetNPC, setTargetNPC] = useState<CharacterItem | null>(null);
  
  // Stats fields
  const [statHp, setStatHp] = useState<number>(10);
  const [statAc, setStatAc] = useState<number>(12);
  const [statAlignment, setStatAlignment] = useState<string>("Neutral");
  const [statStr, setStatStr] = useState<number>(10);
  const [statDex, setStatDex] = useState<number>(10);
  const [statCon, setStatCon] = useState<number>(10);
  const [statInt, setStatInt] = useState<number>(10);
  const [statWis, setStatWis] = useState<number>(10);
  const [statCha, setStatCha] = useState<number>(10);
  const [statSkillsActions, setStatSkillsActions] = useState<string>("");

  // Action: Add manual character
  function addNewCharacter(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const newChar: CharacterItem = {
      id: "char-" + Date.now(),
      name: name.trim(),
      role,
      description: description.trim() || "No character details written yet.",
      hp: 10,
      ac: 10,
      alignment: "Neutral",
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      skills_or_actions: "No special actions declared.",
      isCustomStatsCreated: false,
    };

    onChange([...characters, newChar]);
    setName("");
    setDescription("");
    setShowAddForm(false);
  }

  // Action: Remove character
  function removeCharacter(id: string) {
    onChange(characters.filter((c) => c.id !== id));
  }

  // Action: Trigger AI NPC detection from chronicle
  async function handleAutoDetectNPCs() {
    if (!session?.summary && !session?.notes && !session?.audioTranscription) {
      setDetectionError("The chronicler requires some text (Chronicle Summary, written notes, or transcription) to analyze for NPC souls.");
      return;
    }

    setDetecting(true);
    setDetectionError(null);
    try {
      const res = await fetch("/api/detect-npcs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: session.summary,
          notes: session.notes,
          audioTranscription: session.audioTranscription,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      if (data.characters && data.characters.length > 0) {
        // Map detected items with IDs
        const parsed: CharacterItem[] = data.characters.map((npc: any, index: number) => ({
          id: `detected-npc-${Date.now()}-${index}`,
          name: npc.name || "Forgotten Soul",
          role: npc.role || "NPC Ally",
          description: npc.description || "A mysterious NPC seen in passing.",
          hp: npc.hp !== undefined ? Number(npc.hp) : 15,
          ac: npc.ac !== undefined ? Number(npc.ac) : 12,
          alignment: npc.alignment || "Neutral",
          strength: npc.strength !== undefined ? Number(npc.strength) : 10,
          dexterity: npc.dexterity !== undefined ? Number(npc.dexterity) : 10,
          constitution: npc.constitution !== undefined ? Number(npc.constitution) : 10,
          intelligence: npc.intelligence !== undefined ? Number(npc.intelligence) : 10,
          wisdom: npc.wisdom !== undefined ? Number(npc.wisdom) : 10,
          charisma: npc.charisma !== undefined ? Number(npc.charisma) : 10,
          skills_or_actions: npc.skills_or_actions || "",
          isCustomStatsCreated: true,
        }));
        setDetectedNPCs(parsed);
      } else {
        setDetectionError("The ether could discover no unique NPC names or roles mentioned in the selected chronicle.");
      }
    } catch (err: any) {
      console.error(err);
      setDetectionError(`Scan failed: ${err.message || err}`);
    } finally {
      setDetecting(false);
    }
  }

  // Action: Open stats prompt form for dynamic review
  function openStatsReviewPrompt(npc: CharacterItem) {
    setIsFormForReview(true);
    setTargetNPC(npc);
    setStatHp(npc.hp || 12);
    setStatAc(npc.ac || 12);
    setStatAlignment(npc.alignment || "Neutral");
    setStatStr(npc.strength || 10);
    setStatDex(npc.dexterity || 10);
    setStatCon(npc.constitution || 10);
    setStatInt(npc.intelligence || 10);
    setStatWis(npc.wisdom || 10);
    setStatCha(npc.charisma || 10);
    setStatSkillsActions(npc.skills_or_actions || "");
  }

  // Action: Open stats editor for existing NPC
  function openStatsEditPrompt(npc: CharacterItem) {
    setIsFormForReview(false);
    setTargetNPC(npc);
    setStatHp(npc.hp !== undefined ? npc.hp : 10);
    setStatAc(npc.ac !== undefined ? npc.ac : 10);
    setStatAlignment(npc.alignment || "Neutral");
    setStatStr(npc.strength !== undefined ? npc.strength : 10);
    setStatDex(npc.dexterity !== undefined ? npc.dexterity : 10);
    setStatCon(npc.constitution !== undefined ? npc.constitution : 10);
    setStatInt(npc.intelligence !== undefined ? npc.intelligence : 10);
    setStatWis(npc.wisdom !== undefined ? npc.wisdom : 10);
    setStatCha(npc.charisma !== undefined ? npc.charisma : 10);
    setStatSkillsActions(npc.skills_or_actions || "");
  }

  // Acton: Submit & Save custom prompt stats
  function handleSaveStats(e: React.FormEvent) {
    e.preventDefault();
    if (!targetNPC) return;

    const finalizedNPC: CharacterItem = {
      ...targetNPC,
      hp: statHp,
      ac: statAc,
      alignment: statAlignment,
      strength: statStr,
      dexterity: statDex,
      constitution: statCon,
      intelligence: statInt,
      wisdom: statWis,
      charisma: statCha,
      skills_or_actions: statSkillsActions || "None specified.",
      isCustomStatsCreated: true,
    };

    if (isFormForReview) {
      // Add the reviewed character to our real campaign characters
      onChange([...characters, finalizedNPC]);
      // Remove it from detected queue
      setDetectedNPCs(detectedNPCs.filter((n) => n.id !== targetNPC.id));
    } else {
      // Update existing character
      onChange(characters.map((c) => (c.id === targetNPC.id ? finalizedNPC : c)));
    }

    // Dismiss the form
    setTargetNPC(null);
  }

  // Ignore/Skip detected item
  function dismissDetectedNPC(id: string) {
    setDetectedNPCs(detectedNPCs.filter((n) => n.id !== id));
  }

  return (
    <div className="space-y-5 p-5 bg-zinc-900 border border-zinc-800 rounded-lg parchment-glow" id="character-tracker">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-3 gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-500 animate-pulse animate-duration-3000" />
          <h3 className="font-fantasy font-semibold text-zinc-100 tracking-wider text-base">
            CODEX OF ACTIVE SOULS (NPCs & Heroes)
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {session && (
            <button
              onClick={handleAutoDetectNPCs}
              disabled={detecting}
              className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-purple-900/40 to-indigo-900/40 hover:from-purple-800/50 hover:to-indigo-800/50 text-indigo-300 font-mono text-xs rounded border border-indigo-500/30 transition shadow-inner disabled:opacity-50 cursor-pointer"
              id="btn-auto-detect-npcs"
              title="Parse selected session details to auto-detect NPCs using Gemini"
            >
              {detecting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              )}
              {detecting ? "Scanning..." : "🔮 Auto-Detect NPCs"}
            </button>
          )}

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1 bg-red-500 hover:bg-red-600 text-zinc-950 font-sans font-medium text-xs rounded transition active:scale-95 cursor-pointer"
            id="btn-toggle-character-form"
          >
            <Plus className="w-3.5 h-3.5" /> Summon Persona
          </button>
        </div>
      </div>

      {detectionError && (
        <div className="p-3 bg-red-950/40 border border-red-900/30 rounded text-red-300 text-xs flex gap-2 items-start animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{detectionError}</span>
        </div>
      )}

      {/* 2. Detected NPCs List awaiting stats review prompting */}
      {detectedNPCs.length > 0 && (
        <div className="bg-zinc-950 p-4 border border-indigo-500/20 rounded-md space-y-3.5 animate-fadeIn" id="detected-npcs-wizard">
          <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
            <span className="text-xs font-mono font-bold text-indigo-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" /> NPC SOULS DISCOVERED ({detectedNPCs.length})
            </span>
            <button
              onClick={() => setDetectedNPCs([])}
              className="text-[10px] text-zinc-500 hover:text-zinc-350 uppercase tracking-wider font-mono"
            >
              Clear Queue
            </button>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
            The magical portal parsed the session chronicle and located NPC identities! Click <strong className="text-indigo-300">"Verify & Prompt Stats"</strong> to review and finalize their RPG statblock before binding them into the Active Souls array.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            {detectedNPCs.map((npc) => (
              <div
                key={npc.id}
                className="p-3 bg-zinc-900/60 border border-zinc-800 rounded hover:border-indigo-500/20 transition flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-fantasy text-zinc-200 mt-0.5 text-xs sm:text-sm font-semibold">{npc.name}</span>
                    <span className="text-[9px] font-mono px-2 py-0.5 bg-zinc-950 border border-zinc-800 text-indigo-400 rounded">
                      {npc.role}
                    </span>
                  </div>
                  <p className="text-zinc-400 text-xs font-sans mt-1 leading-relaxed italic">
                    "{npc.description}"
                  </p>
                  
                  {/* Suggested stats summary */}
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-mono">
                    <span className="bg-zinc-950 px-1.5 py-0.5 text-red-400 rounded">HP: {npc.hp}</span>
                    <span className="bg-zinc-950 px-1.5 py-0.5 text-amber-500 rounded">AC: {npc.ac}</span>
                    <span className="bg-zinc-950 px-1.5 py-0.5 text-emerald-400 rounded">{npc.alignment}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/40">
                  <button
                    onClick={() => dismissDetectedNPC(npc.id)}
                    className="px-2.5 py-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 text-[10px] rounded font-mono uppercase"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => openStatsReviewPrompt(npc)}
                    className="px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-zinc-950 font-mono text-[10px] rounded border border-indigo-500/30 transition uppercase font-bold cursor-pointer"
                  >
                    📝 Verify & Prompt Stats
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Reusable Stats Prompting / Fine-Tuning Dialog Form */}
      {targetNPC && (
        <form onSubmit={handleSaveStats} className="bg-zinc-950 p-4 border-2 border-red-500/30 rounded-lg space-y-4 shadow-2xl animate-scaleIn" id="npc-stats-prompt-form">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-1.5">
              <Dices className="w-4 h-4 text-red-500 animate-spin animate-duration-2000" />
              <h4 className="font-fantasy text-zinc-100 text-sm tracking-wider uppercase">
                {isFormForReview ? "Prompt: Confirm RPG Statblock" : `Edit Stats for ${targetNPC.name}`}
              </h4>
            </div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase">
              Target: <strong className="text-zinc-300">{targetNPC.name}</strong>
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed font-sans mt-1">
            {isFormForReview 
              ? `Please review, input or modify the crucial mechanical stats for ${targetNPC.name} as suggested above by Gemini before committing them to the permanent campaign chronicles.`
              : `Adjust the tactical attributes, condition parameters, and abilities for this character in the combat archives below.`}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">HP (Hit Points)</label>
              <input
                type="number"
                required
                min="1"
                max="999"
                value={statHp}
                onChange={(e) => setStatHp(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-mono focus:border-red-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">AC (Armor Class)</label>
              <input
                type="number"
                required
                min="5"
                max="30"
                value={statAc}
                onChange={(e) => setStatAc(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-mono focus:border-red-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Alignment</label>
              <input
                type="text"
                placeholder="Lawful Good, Chaotic Evil, Neutral..."
                value={statAlignment}
                onChange={(e) => setStatAlignment(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-sans focus:border-red-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="border-t border-zinc-850 pt-3">
            <span className="text-[10px] font-mono text-zinc-500 block uppercase mb-2">Core Ability Scores (DnD Standards)</span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <div className="bg-zinc-900/40 border border-zinc-850 p-2 rounded text-center">
                <label className="text-[9px] font-mono text-zinc-400 uppercase block">STR</label>
                <input
                  type="number"
                  min="1"
                  max="25"
                  value={statStr}
                  onChange={(e) => setStatStr(Number(e.target.value))}
                  className="w-full bg-transparent text-center font-mono font-bold text-zinc-100 focus:outline-none focus:text-red-400 text-xs"
                />
              </div>

              <div className="bg-zinc-900/40 border border-zinc-850 p-2 rounded text-center">
                <label className="text-[9px] font-mono text-zinc-400 uppercase block">DEX</label>
                <input
                  type="number"
                  min="1"
                  max="25"
                  value={statDex}
                  onChange={(e) => setStatDex(Number(e.target.value))}
                  className="w-full bg-transparent text-center font-mono font-bold text-zinc-100 focus:outline-none focus:text-red-400 text-xs"
                />
              </div>

              <div className="bg-zinc-900/40 border border-zinc-850 p-2 rounded text-center">
                <label className="text-[9px] font-mono text-zinc-400 uppercase block">CON</label>
                <input
                  type="number"
                  min="1"
                  max="25"
                  value={statCon}
                  onChange={(e) => setStatCon(Number(e.target.value))}
                  className="w-full bg-transparent text-center font-mono font-bold text-zinc-100 focus:outline-none focus:text-red-400 text-xs"
                />
              </div>

              <div className="bg-zinc-900/40 border border-zinc-850 p-2 rounded text-center">
                <label className="text-[9px] font-mono text-zinc-400 uppercase block">INT</label>
                <input
                  type="number"
                  min="1"
                  max="25"
                  value={statInt}
                  onChange={(e) => setStatInt(Number(e.target.value))}
                  className="w-full bg-transparent text-center font-mono font-bold text-zinc-100 focus:outline-none focus:text-red-400 text-xs"
                />
              </div>

              <div className="bg-zinc-900/40 border border-zinc-850 p-2 rounded text-center">
                <label className="text-[9px] font-mono text-zinc-400 uppercase block">WIS</label>
                <input
                  type="number"
                  min="1"
                  max="25"
                  value={statWis}
                  onChange={(e) => setStatWis(Number(e.target.value))}
                  className="w-full bg-transparent text-center font-mono font-bold text-zinc-100 focus:outline-none focus:text-red-400 text-xs"
                />
              </div>

              <div className="bg-zinc-900/40 border border-zinc-850 p-2 rounded text-center">
                <label className="text-[9px] font-mono text-zinc-400 uppercase block">CHA</label>
                <input
                  type="number"
                  min="1"
                  max="25"
                  value={statCha}
                  onChange={(e) => setStatCha(Number(e.target.value))}
                  className="w-full bg-transparent text-center font-mono font-bold text-zinc-100 focus:outline-none focus:text-red-400 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Combat Skills & Custom Actions</label>
            <textarea
              rows={2}
              value={statSkillsActions}
              onChange={(e) => setStatSkillsActions(e.target.value)}
              placeholder="Spellcaster Level 3 (DC 13). Multiattack: +4 to hit, 1d6+2 slashing or fireball."
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-red-500 font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-850">
            <button
              type="button"
              onClick={() => setTargetNPC(null)}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-zinc-950 text-xs font-bold rounded transition flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> 
              {isFormForReview ? "Inscribe to Codex of Active Souls" : "Commit Attribute Changes"}
            </button>
          </div>
        </form>
      )}

      {/* Manual Summon Persona Form */}
      {showAddForm && (
        <form onSubmit={addNewCharacter} className="bg-zinc-950 p-4 border border-zinc-800 rounded space-y-3 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">
                Character Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Balasar, Elara, Strahd..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-red-500 font-sans"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">
                Role Matrix
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-red-500 font-sans cursor-pointer"
              >
                <option value="NPC Ally">🛡️ NPC Ally</option>
                <option value="Boss Villain">💀 Boss Villain</option>
                <option value="Quest Giver">📜 Quest Giver</option>
                <option value="Shopkeeper">🪙 Shopkeeper</option>
                <option value="Hero Character">⚔️ Hero Character</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">
              Persona Notes & Biometrics
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A secretive tavern rogue with a glass eye, hides a sapphire key..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-red-500 font-sans"
            />
          </div>

          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-2.5 py-1.5 bg-zinc-800 text-zinc-300 text-xs rounded transition hover:bg-zinc-700"
            >
              Close
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-zinc-950 font-sans font-medium text-xs rounded transition"
            >
              Add Soul
            </button>
          </div>
        </form>
      )}

      {/* Real Grid of Characters */}
      {characters.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 bg-zinc-950/40 border border-zinc-850 border-dashed rounded text-zinc-500 font-sans text-xs">
          <UserX className="w-8 h-8 text-zinc-750 mb-1.5" />
          <span>No NPCs or party characters cataloged in this chronicle yet.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <AnimatePresence>
            {characters.map((char) => (
              <motion.div
                key={char.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group p-4 bg-zinc-950 border border-zinc-850 rounded hover:border-red-500/30 transition flex flex-col justify-between space-y-3"
                id={`character-badge-${char.id}`}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-zinc-850 pb-2 mb-2">
                    <span className="font-fantasy font-semibold text-zinc-200 text-sm">
                      {char.name}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-red-500 rounded font-semibold">
                      {char.role}
                    </span>
                  </div>
                  <p className="text-zinc-400 text-xs font-sans leading-relaxed">
                    {char.description}
                  </p>

                  {/* Mechanical stats presentation */}
                  {char.isCustomStatsCreated && (
                    <div className="mt-3 p-2 bg-zinc-900/60 border border-zinc-850 rounded text-zinc-300 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono text-red-400 border-b border-zinc-850 pb-1">
                        <span className="flex items-center gap-1">♥️ HP: <strong>{char.hp ?? 10}</strong></span>
                        <span className="flex items-center gap-1">🛡️ AC: <strong>{char.ac ?? 10}</strong></span>
                        <span className="bg-zinc-950 px-1 py-0.25 text-zinc-400 text-[10px] rounded">{char.alignment || "Neutral"}</span>
                      </div>
                      
                      {/* Interactive grid of scores */}
                      <div className="grid grid-cols-6 gap-1 text-[10px] font-mono text-center">
                        <div className="bg-zinc-950 py-0.5 rounded leading-tight"><span className="text-zinc-500 text-[8px] block select-none">STR</span><strong>{char.strength ?? 10}</strong></div>
                        <div className="bg-zinc-950 py-0.5 rounded leading-tight"><span className="text-zinc-500 text-[8px] block select-none">DEX</span><strong>{char.dexterity ?? 10}</strong></div>
                        <div className="bg-zinc-950 py-0.5 rounded leading-tight"><span className="text-zinc-500 text-[8px] block select-none">CON</span><strong>{char.constitution ?? 10}</strong></div>
                        <div className="bg-zinc-950 py-0.5 rounded leading-tight"><span className="text-zinc-500 text-[8px] block select-none">INT</span><strong>{char.intelligence ?? 10}</strong></div>
                        <div className="bg-zinc-950 py-0.5 rounded leading-tight"><span className="text-zinc-500 text-[8px] block select-none">WIS</span><strong>{char.wisdom ?? 10}</strong></div>
                        <div className="bg-zinc-950 py-0.5 rounded leading-tight"><span className="text-zinc-500 text-[8px] block select-none">CHA</span><strong>{char.charisma ?? 10}</strong></div>
                      </div>

                      {char.skills_or_actions && (
                        <div className="text-[10px] text-zinc-400 font-mono leading-tight pt-1.5 border-t border-zinc-850/40">
                          <strong className="text-zinc-550 uppercase">Actions: </strong>{char.skills_or_actions}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-zinc-850/50">
                  <span className="text-[9px] font-mono text-zinc-650">
                    {char.isCustomStatsCreated ? "⚔️ Statblock Synchronized" : "🛡️ Stats Unassigned"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openStatsEditPrompt(char)}
                      className="p-1 hover:bg-zinc-850 text-zinc-500 hover:text-amber-500 rounded transition cursor-pointer"
                      title="Adjust Attributes & Stats"
                      id={`btn-edit-char-stats-${char.id}`}
                    >
                      <Dices className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeCharacter(char.id)}
                      className="p-1 hover:bg-red-950/40 text-zinc-650 hover:text-red-500 rounded transition cursor-pointer"
                      title="Expatriate Persona"
                      id={`btn-remove-char-${char.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
