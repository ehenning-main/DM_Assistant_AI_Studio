import React, { useState } from "react";
import { UserPlus, Trash2, Mic, CheckCircle2, Crown, User, Brain } from "lucide-react";
import { Campaign, CampaignPlayer, TablePlayerRole } from "../../types";
import { VoiceEnrollmentModal } from "./VoiceEnrollmentModal";
import { deleteClip } from "../../services/localAudioStore";

interface Props {
  campaign: Campaign;
  onUpdatePlayers: (players: CampaignPlayer[]) => Promise<void>;
  deviceId?: string;
  compact?: boolean;
}

export function TablePlayersPanel({ campaign, onUpdatePlayers, deviceId, compact }: Props) {
  const players = campaign.players || [];
  const heroes = campaign.heroes || [];
  const [name, setName] = useState("");
  const [role, setRole] = useState<TablePlayerRole>(players.some((p) => p.role === "GM") ? "Player" : "GM");
  const [heroId, setHeroId] = useState("");
  const [enrolling, setEnrolling] = useState<CampaignPlayer[] | null>(null);
  const [saving, setSaving] = useState(false);

  // Offer heroes from the party tracker that haven't been claimed yet; picking one pre-fills the player name.
  const unclaimedHeroes = heroes.filter((h) => !players.some((p) => p.heroId === h.id));

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    const hero = heroes.find((h) => h.id === heroId);
    const finalName = name.trim() || hero?.playerName || "";
    if (!finalName) return;
    setSaving(true);
    try {
      const player: CampaignPlayer = {
        id: `pl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: finalName,
        role,
        heroId: role === "Player" && hero ? hero.id : undefined,
        characterName: role === "Player" && hero ? hero.name : undefined,
      };
      await onUpdatePlayers([...players, player]);
      setName("");
      setHeroId("");
      setRole("Player");
    } finally {
      setSaving(false);
    }
  }

  async function removePlayer(p: CampaignPlayer) {
    if (!window.confirm(`Remove ${p.name} from this campaign's table? Their voice samples on this device will be deleted.`)) return;
    if (p.enrollment) await deleteClip(p.enrollment.clipId).catch(() => {});
    if (p.learnedVoice?.clipId) await deleteClip(p.learnedVoice.clipId).catch(() => {});
    await onUpdatePlayers(players.filter((x) => x.id !== p.id));
  }

  async function updatePlayer(id: string, patch: Partial<CampaignPlayer>) {
    await onUpdatePlayers(players.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  const missing = players.filter((p) => !p.enrollment);

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg">
      <div className="px-4 py-3 border-b border-zinc-850 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-fantasy font-bold text-sm uppercase tracking-wider text-zinc-200">Table &amp; voices</h3>
          {!compact && <p className="text-xs text-zinc-500">Everyone who speaks at the table, including you.</p>}
        </div>
        {missing.length > 0 && (
          <button onClick={() => setEnrolling(missing)} className="px-3 py-2 text-xs font-bold rounded bg-red-500 hover:bg-red-600 text-zinc-950 flex items-center gap-1.5 cursor-pointer">
            <Mic className="w-3.5 h-3.5" /> Enroll {missing.length === players.length ? "everyone" : `${missing.length} missing`}
          </button>
        )}
      </div>

      <ul className="divide-y divide-zinc-850">
        {players.length === 0 && <li className="px-4 py-5 text-sm text-zinc-500 italic">No one at the table yet. Add yourself as GM, then each player.</li>}
        {players.map((p) => (
          <li key={p.id} className="px-4 py-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${p.role === "GM" ? "bg-red-950 text-red-400" : "bg-zinc-800 text-zinc-300"}`}>
              {p.role === "GM" ? <Crown className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-100 truncate">
                {p.name} <span className="text-xs font-normal text-zinc-500">{p.role === "GM" ? "· Game Master" : p.characterName ? `· ${p.characterName}` : ""}</span>
              </p>
              <div className="flex items-center gap-2 flex-wrap text-[11px] mt-0.5">
                {p.enrollment ? (
                  <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Voice enrolled</span>
                ) : (
                  <span className="text-amber-400">Not enrolled</span>
                )}
                {p.learnedVoice && p.learnedVoice.confirmations > 0 && (
                  <span className="text-purple-300 flex items-center gap-1" title="Learned from tagging past transcripts">
                    <Brain className="w-3 h-3" /> Remembered from {p.learnedVoice.confirmations} session{p.learnedVoice.confirmations > 1 ? "s" : ""}
                  </span>
                )}
                {p.role === "Player" && !p.heroId && unclaimedHeroes.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      const h = heroes.find((x) => x.id === e.target.value);
                      if (h) updatePlayer(p.id, { heroId: h.id, characterName: h.name });
                    }}
                    className="bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-zinc-400"
                    aria-label={`Link ${p.name} to a hero`}
                  >
                    <option value="">Link hero…</option>
                    {unclaimedHeroes.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                )}
              </div>
            </div>
            <button onClick={() => setEnrolling([p])} className="px-2.5 py-2 text-xs rounded border border-zinc-700 text-zinc-300 hover:border-red-500 hover:text-red-400 cursor-pointer flex items-center gap-1" aria-label={`${p.enrollment ? "Re-enroll" : "Enroll"} ${p.name}`}>
              <Mic className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{p.enrollment ? "Re-enroll" : "Enroll"}</span>
            </button>
            <button onClick={() => removePlayer(p)} className="p-2 text-zinc-600 hover:text-red-400 cursor-pointer" aria-label={`Remove ${p.name}`}>
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={addPlayer} className="p-4 border-t border-zinc-850 grid grid-cols-2 sm:grid-cols-[1fr_auto_auto_auto] gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={role === "GM" ? "Your name" : "Player name"}
          className="col-span-2 sm:col-span-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-red-500"
          aria-label="Player name"
        />
        <select value={role} onChange={(e) => setRole(e.target.value as TablePlayerRole)} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-2.5 text-sm text-zinc-200" aria-label="Role">
          <option value="GM">GM</option>
          <option value="Player">Player</option>
        </select>
        {role === "Player" && unclaimedHeroes.length > 0 ? (
          <select
            value={heroId}
            onChange={(e) => {
              setHeroId(e.target.value);
              const h = heroes.find((x) => x.id === e.target.value);
              if (h?.playerName && !name.trim()) setName(h.playerName);
            }}
            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-2.5 text-sm text-zinc-200"
            aria-label="Character"
          >
            <option value="">No hero linked</option>
            {unclaimedHeroes.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        ) : (
          <span className="hidden sm:block" />
        )}
        <button type="submit" disabled={saving || (!name.trim() && !heroId)} className="col-span-2 sm:col-span-1 px-3 py-2.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-sm font-semibold text-zinc-100 flex items-center justify-center gap-1.5 cursor-pointer">
          <UserPlus className="w-4 h-4" /> Add
        </button>
      </form>

      {enrolling && (
        <VoiceEnrollmentModal
          players={enrolling}
          deviceId={deviceId}
          onEnrolled={(playerId, enrollment) => updatePlayer(playerId, { enrollment })}
          onClose={() => setEnrolling(null)}
        />
      )}
    </div>
  );
}
