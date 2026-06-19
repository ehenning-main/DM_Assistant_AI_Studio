import React, { useState } from "react";
import { User, Plus, Trash2, Shield, UserX } from "lucide-react";
import { CharacterItem } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface CharacterTrackerProps {
  characters: CharacterItem[];
  onChange: (updated: CharacterItem[]) => void;
}

export function CharacterTracker({ characters = [], onChange }: CharacterTrackerProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("NPC Ally");
  const [description, setDescription] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  function addNewCharacter(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const newChar: CharacterItem = {
      id: "char-" + Date.now(),
      name: name.trim(),
      role,
      description: description.trim() || "No character details written yet.",
    };

    onChange([...characters, newChar]);
    setName("");
    setDescription("");
    setShowAddForm(false);
  }

  function removeCharacter(id: string) {
    onChange(characters.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-4 p-5 bg-zinc-900 border border-zinc-800 rounded-lg parchment-glow" id="character-tracker">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-500 animate-pulse" />
          <h3 className="font-fantasy font-semibold text-zinc-100 tracking-wider text-base">
            CODEX OF ACTIVE SOULS (NPCs & Heroes)
          </h3>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-sans font-medium text-xs rounded transition active:scale-95 cursor-pointer"
          id="btn-toggle-character-form"
        >
          <Plus className="w-3.5 h-3.5" /> Summon Persona
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={addNewCharacter} className="bg-zinc-950 p-4 border border-zinc-800 rounded space-y-3">
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
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-amber-500 font-sans"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">
                Role Matrix
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500 font-sans cursor-pointer"
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
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-amber-500 font-sans"
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
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-905 text-zinc-950 font-sans font-medium text-xs rounded transition"
            >
              Add Soul
            </button>
          </div>
        </form>
      )}

      {/* Grid of Characters */}
      {characters.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-6 bg-zinc-950/40 border border-zinc-850 border-dashed rounded text-zinc-500 font-sans text-xs">
          <UserX className="w-8 h-8 text-zinc-750 mb-1.5" />
          <span>No NPCs or party characters cataloged in this chronicle yet.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          <AnimatePresence>
            {characters.map((char) => (
              <motion.div
                key={char.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group p-3 bg-zinc-950 border border-zinc-850 rounded hover:border-amber-500/30 transition flex flex-col justify-between"
                id={`character-badge-${char.id}`}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-zinc-850 pb-1.5 mb-1.5">
                    <span className="font-fantasy font-semibold text-zinc-200 text-xs sm:text-sm">
                      {char.name}
                    </span>
                    <span className="text-[9px] font-mono px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-amber-500 rounded font-semibold">
                      {char.role}
                    </span>
                  </div>
                  <p className="text-zinc-400 text-xs font-sans leading-relaxed">
                    {char.description}
                  </p>
                </div>

                <div className="flex justify-end pt-2 border-t border-zinc-850/50 mt-2">
                  <button
                    onClick={() => removeCharacter(char.id)}
                    className="p-1 hover:bg-red-950/40 text-zinc-600 hover:text-red-500 rounded transition"
                    title="Expatriate Persona"
                    id={`btn-remove-char-${char.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
