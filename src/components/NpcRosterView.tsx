import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRightLeft,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  Edit,
  GitFork,
  GitMerge,
  HeartHandshake,
  HelpCircle,
  Link2,
  Loader2,
  MapPin,
  Network,
  Plus,
  Search,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Trash2,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  Campaign,
  NpcCampaignStatus,
  NpcRosterEntry,
  NpcToHeroRelationship,
  NpcToNpcRelationship,
  PartyStanding,
  Session,
} from "../types";
import {
  buildMergedNpcRoster,
  MergedNpcRecord,
  mergeRosterNpcs,
  normalizeNpcKey,
  toPersistedNpcEntry,
} from "../services/npcRosterService";

interface NpcRosterViewProps {
  campaign: Campaign;
  campaignSessions: Session[];
  activeSessionId?: string | null;
  selectedNpcKey?: string | null;
  onSelectNpc?: (npcKey: string | null) => void;
  onUpdateCampaign: (updatedCampaign: Campaign) => Promise<void>;
  onUpdateSession?: (updatedSession: Session) => Promise<void>;
  onOpenSession?: (sessionId: string) => void;
}

const CAMPAIGN_STATUS_OPTIONS: NpcCampaignStatus[] = [
  "Active",
  "Allied",
  "Missing",
  "Captured",
  "Hostile",
  "Deceased",
  "Unknown",
];

const PARTY_STANDING_OPTIONS: PartyStanding[] = [
  "Trusted Ally",
  "Friendly",
  "Neutral",
  "Wary",
  "Hostile",
  "Sworn Enemy",
];

const NPC_RELATION_PRESETS = [
  "Ally",
  "Rival",
  "Sibling",
  "Parent / Child",
  "Commander",
  "Subordinate",
  "Patron",
  "Informant",
  "Trade Partner",
  "Secret Contact",
  "Nemesis",
];

function getStatusMeta(status: string): {
  label: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  icon: React.ReactNode;
} {
  const s = (status || "Active").toLowerCase();
  if (s === "allied") {
    return {
      label: status || "Allied",
      textClass: "text-emerald-300",
      bgClass: "bg-emerald-950/50",
      borderClass: "border-emerald-800/70",
      icon: <HeartHandshake className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
    };
  }
  if (s === "active") {
    return {
      label: status || "Active",
      textClass: "text-sky-300",
      bgClass: "bg-sky-950/50",
      borderClass: "border-sky-800/70",
      icon: <Activity className="w-3.5 h-3.5 text-sky-400 shrink-0" />,
    };
  }
  if (s === "missing") {
    return {
      label: status || "Missing",
      textClass: "text-amber-300",
      bgClass: "bg-amber-950/50",
      borderClass: "border-amber-800/70",
      icon: <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
    };
  }
  if (s === "captured") {
    return {
      label: status || "Captured",
      textClass: "text-orange-300",
      bgClass: "bg-orange-950/50",
      borderClass: "border-orange-800/70",
      icon: <AlertCircle className="w-3.5 h-3.5 text-orange-400 shrink-0" />,
    };
  }
  if (s === "hostile") {
    return {
      label: status || "Hostile",
      textClass: "text-red-300",
      bgClass: "bg-red-950/50",
      borderClass: "border-red-800/70",
      icon: <Swords className="w-3.5 h-3.5 text-red-400 shrink-0" />,
    };
  }
  if (s === "deceased") {
    return {
      label: status || "Deceased",
      textClass: "text-zinc-400",
      bgClass: "bg-zinc-900",
      borderClass: "border-zinc-700",
      icon: <Skull className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
    };
  }
  return {
    label: status || "Unknown",
    textClass: "text-zinc-300",
    bgClass: "bg-zinc-900",
    borderClass: "border-zinc-700",
    icon: <HelpCircle className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
  };
}

function getStandingMeta(standing: string): {
  textClass: string;
  strokeHex: string;
} {
  const s = (standing || "Neutral").toLowerCase();
  if (s.includes("trusted") || s.includes("friendly") || s.includes("allied")) {
    return { textClass: "text-emerald-400", strokeHex: "#34d399" };
  }
  if (s.includes("sworn") || s.includes("hostile") || s.includes("enemy")) {
    return { textClass: "text-red-400", strokeHex: "#f87171" };
  }
  if (s.includes("wary") || s.includes("suspicious") || s.includes("rival")) {
    return { textClass: "text-amber-400", strokeHex: "#fbbf24" };
  }
  return { textClass: "text-zinc-300", strokeHex: "#a1a1aa" };
}

export function NpcRosterView({
  campaign,
  campaignSessions,
  activeSessionId,
  selectedNpcKey: controlledSelectedKey,
  onSelectNpc,
  onUpdateCampaign,
  onUpdateSession,
  onOpenSession,
}: NpcRosterViewProps) {
  const heroes = campaign.heroes || [];

  // View & Filter state
  const [viewMode, setViewMode] = useState<"dossier" | "web">("dossier");
  const [sessionScope, setSessionScope] = useState<"all" | "prior">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [standingFilter, setStandingFilter] = useState<string>("all");

  // Selection state (supports parent sync from sidebar)
  const [internalSelectedKey, setInternalSelectedKey] = useState<string | null>(null);

  // AI analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeSuccess, setAnalyzeSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Add / Edit NPC Modal
  const [showNpcModal, setShowNpcModal] = useState(false);
  const [editingNpcKey, setEditingNpcKey] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("NPC Ally");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState<string>("Active");
  const [formStatusNote, setFormStatusNote] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formStanding, setFormStanding] = useState<string>("Neutral");
  const [formStandingSummary, setFormStandingSummary] = useState("");

  // Merge Duplicate NPCs Modal
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergePrimaryKey, setMergePrimaryKey] = useState<string>("");
  const [mergeDuplicateKey, setMergeDuplicateKey] = useState<string>("");
  const [mergeCanonicalName, setMergeCanonicalName] = useState("");
  const [mergeRole, setMergeRole] = useState("");
  const [mergeStatus, setMergeStatus] = useState<string>("Active");
  const [mergeStatusNote, setMergeStatusNote] = useState("");
  const [mergeLocation, setMergeLocation] = useState("");
  const [mergeStanding, setMergeStanding] = useState<string>("Neutral");
  const [mergeStandingSummary, setMergeStandingSummary] = useState("");
  const [mergeDescription, setMergeDescription] = useState("");
  const [mergeError, setMergeError] = useState<string | null>(null);

  // Inline Hero/Party relationship form
  const [showHeroRelForm, setShowHeroRelForm] = useState(false);
  const [relHeroTarget, setRelHeroTarget] = useState<string>("party");
  const [relHeroStanding, setRelHeroStanding] = useState<string>("Friendly");
  const [relHeroNotes, setRelHeroNotes] = useState("");

  // Inline NPC-to-NPC relationship form
  const [showNpcRelForm, setShowNpcRelForm] = useState(false);
  const [relNpcTarget, setRelNpcTarget] = useState("");
  const [relNpcCustomName, setRelNpcCustomName] = useState("");
  const [relNpcType, setRelNpcType] = useState("Ally");
  const [relNpcNotes, setRelNpcNotes] = useState("");
  const [relNpcReciprocal, setRelNpcReciprocal] = useState(true);

  const roster = useMemo(
    () =>
      buildMergedNpcRoster(campaign, campaignSessions, {
        excludeSessionId: sessionScope === "prior" ? activeSessionId : null,
      }),
    [campaign, campaignSessions, sessionScope, activeSessionId]
  );

  const filteredRoster = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return roster.filter((npc) => {
      if (statusFilter !== "all" && npc.campaignStatus.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (standingFilter !== "all" && npc.partyStanding.toLowerCase() !== standingFilter.toLowerCase()) {
        return false;
      }
      if (!q) return true;

      const haystack = [
        npc.name,
        ...(npc.aliases || []),
        npc.role,
        npc.description,
        npc.campaignStatus,
        npc.statusNote,
        npc.lastKnownLocation,
        npc.partyStanding,
        npc.partyRelationshipSummary,
        ...npc.heroRelationships.map((h) => `${h.heroName} ${h.standing} ${h.notes || ""}`),
        ...npc.npcRelationships.map((r) => `${r.targetNpcName} ${r.relationshipType} ${r.notes || ""}`),
        ...npc.incomingNpcRelationships.map((r) => `${r.sourceNpcName} ${r.relationshipType} ${r.notes || ""}`),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [roster, searchQuery, statusFilter, standingFilter]);

  const effectiveSelectedKey = useMemo(() => {
    const candidate = controlledSelectedKey ?? internalSelectedKey;
    if (candidate && roster.some((n) => n.key === candidate)) {
      return candidate;
    }
    return filteredRoster[0]?.key ?? roster[0]?.key ?? null;
  }, [controlledSelectedKey, internalSelectedKey, roster, filteredRoster]);

  const selectedNpc: MergedNpcRecord | null = useMemo(
    () => roster.find((n) => n.key === effectiveSelectedKey) || null,
    [roster, effectiveSelectedKey]
  );

  function selectNpc(key: string | null) {
    setInternalSelectedKey(key);
    onSelectNpc?.(key);
    setShowHeroRelForm(false);
    setShowNpcRelForm(false);
  }

  // Metrics for summary strip
  const metrics = useMemo(() => {
    const total = roster.length;
    const alliedOrActive = roster.filter((n) =>
      ["active", "allied"].includes((n.campaignStatus || "").toLowerCase())
    ).length;
    const perilOrHostile = roster.filter((n) =>
      ["hostile", "missing", "captured", "deceased"].includes((n.campaignStatus || "").toLowerCase())
    ).length;
    const heroLinks = roster.reduce(
      (acc, n) => acc + n.heroRelationships.length + (n.partyRelationshipSummary ? 1 : 0),
      0
    );
    const npcLinks = roster.reduce((acc, n) => acc + n.npcRelationships.length, 0);
    return { total, alliedOrActive, perilOrHostile, heroLinks, npcLinks };
  }, [roster]);

  async function persistRosterUpdates(nextEntries: NpcRosterEntry[]) {
    setSaving(true);
    try {
      await onUpdateCampaign({
        ...campaign,
        npcRoster: nextEntries,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setSaving(false);
    }
  }

  async function upsertNpcRecord(
    updatedRecord: MergedNpcRecord | NpcRosterEntry,
    extraEntries?: NpcRosterEntry[]
  ) {
    const currentList = [...(campaign.npcRoster || [])];
    const targetKey = normalizeNpcKey(updatedRecord.name);
    const cleanEntry = toPersistedNpcEntry(updatedRecord);

    const idx = currentList.findIndex(
      (item) => normalizeNpcKey(item.name) === targetKey || item.id === cleanEntry.id
    );
    if (idx >= 0) {
      currentList[idx] = cleanEntry;
    } else {
      currentList.push(cleanEntry);
    }

    if (extraEntries) {
      for (const extra of extraEntries) {
        const extraKey = normalizeNpcKey(extra.name);
        const eIdx = currentList.findIndex((item) => normalizeNpcKey(item.name) === extraKey);
        if (eIdx >= 0) {
          currentList[eIdx] = extra;
        } else {
          currentList.push(extra);
        }
      }
    }

    await persistRosterUpdates(currentList);
  }

  function openAddNpcModal() {
    setEditingNpcKey(null);
    setFormName("");
    setFormRole("NPC Ally");
    setFormDescription("");
    setFormStatus("Active");
    setFormStatusNote("");
    setFormLocation("");
    setFormStanding("Neutral");
    setFormStandingSummary("");
    setShowNpcModal(true);
  }

  function openEditNpcModal(npc: MergedNpcRecord) {
    setEditingNpcKey(npc.key);
    setFormName(npc.name);
    setFormRole(npc.role || "NPC");
    setFormDescription(npc.description || "");
    setFormStatus(npc.campaignStatus || "Active");
    setFormStatusNote(npc.statusNote || "");
    setFormLocation(npc.lastKnownLocation || "");
    setFormStanding(npc.partyStanding || "Neutral");
    setFormStandingSummary(npc.partyRelationshipSummary || "");
    setShowNpcModal(true);
  }

  async function handleSaveNpcModal(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = formName.trim();
    if (!trimmedName) return;

    const existing = editingNpcKey ? roster.find((r) => r.key === editingNpcKey) : null;
    const entry: NpcRosterEntry = {
      id: existing?.id || `npc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: trimmedName,
      ...(existing?.aliases && existing.aliases.length > 0 ? { aliases: existing.aliases } : {}),
      role: formRole.trim() || "NPC",
      description: formDescription.trim(),
      campaignStatus: formStatus,
      statusNote: formStatusNote.trim(),
      lastKnownLocation: formLocation.trim(),
      partyStanding: formStanding,
      partyRelationshipSummary: formStandingSummary.trim(),
      heroRelationships: existing?.heroRelationships || [],
      npcRelationships: existing?.npcRelationships || [],
      hp: existing?.hp,
      ac: existing?.ac,
      alignment: existing?.alignment,
      skills_or_actions: existing?.skills_or_actions,
      updatedAt: new Date().toISOString(),
    };

    await upsertNpcRecord(entry);
    setShowNpcModal(false);
    selectNpc(normalizeNpcKey(trimmedName));
  }

  function syncMergeDefaults(pKey: string, dKey: string) {
    const primary = roster.find((n) => n.key === pKey);
    const duplicate = roster.find((n) => n.key === dKey);
    if (!primary) return;

    setMergeCanonicalName(primary.name);
    setMergeRole(primary.role || duplicate?.role || "NPC");
    setMergeStatus(primary.campaignStatus || duplicate?.campaignStatus || "Active");
    setMergeStanding(primary.partyStanding || duplicate?.partyStanding || "Neutral");
    setMergeLocation(primary.lastKnownLocation || duplicate?.lastKnownLocation || "");
    setMergeStatusNote(
      [primary.statusNote, duplicate?.statusNote]
        .filter((s, idx, arr) => Boolean(s) && arr.indexOf(s) === idx)
        .join(" · ")
    );
    setMergeStandingSummary(
      [primary.partyRelationshipSummary, duplicate?.partyRelationshipSummary]
        .filter((s, idx, arr) => Boolean(s) && arr.indexOf(s) === idx)
        .join(" ")
    );
    setMergeDescription(
      [primary.description, duplicate?.description]
        .filter((s, idx, arr) => Boolean(s) && arr.indexOf(s) === idx)
        .join("\n\n")
    );
    setMergeError(null);
  }

  function openMergeModal(preferredPrimaryKey?: string) {
    if (roster.length < 2) return;
    const pKey =
      preferredPrimaryKey && roster.some((n) => n.key === preferredPrimaryKey)
        ? preferredPrimaryKey
        : effectiveSelectedKey && roster.some((n) => n.key === effectiveSelectedKey)
          ? effectiveSelectedKey
          : roster[0].key;
    const fallbackDup = roster.find((n) => n.key !== pKey)?.key || roster[1].key;

    setMergePrimaryKey(pKey);
    setMergeDuplicateKey(fallbackDup);
    syncMergeDefaults(pKey, fallbackDup);
    setShowMergeModal(true);
  }

  function handleSwapMergeParties() {
    if (!mergePrimaryKey || !mergeDuplicateKey) return;
    const nextPrimary = mergeDuplicateKey;
    const nextDuplicate = mergePrimaryKey;
    setMergePrimaryKey(nextPrimary);
    setMergeDuplicateKey(nextDuplicate);
    syncMergeDefaults(nextPrimary, nextDuplicate);
  }

  async function handleExecuteMerge(e: React.FormEvent) {
    e.preventDefault();
    if (!mergePrimaryKey || !mergeDuplicateKey || mergePrimaryKey === mergeDuplicateKey) {
      setMergeError("Select two different NPC entries to merge.");
      return;
    }

    setSaving(true);
    setMergeError(null);
    setAnalyzeError(null);

    try {
      const result = mergeRosterNpcs(campaign, roster, campaignSessions, {
        primaryKey: mergePrimaryKey,
        duplicateKey: mergeDuplicateKey,
        canonicalName: mergeCanonicalName,
        role: mergeRole,
        campaignStatus: mergeStatus,
        partyStanding: mergeStanding,
        description: mergeDescription,
        statusNote: mergeStatusNote,
        lastKnownLocation: mergeLocation,
        partyRelationshipSummary: mergeStandingSummary,
      });

      await persistRosterUpdates(result.nextNpcRoster);
      if (onUpdateSession && result.updatedSessions.length > 0) {
        await Promise.all(result.updatedSessions.map((sess) => onUpdateSession(sess)));
      }

      setShowMergeModal(false);
      selectNpc(result.canonicalKey);
      setAnalyzeSuccess(
        `Merged "${result.mergedFromName}" into "${result.canonicalName}" across campaign roster and session chapters.`
      );
    } catch (err: any) {
      setMergeError(err?.message || "Failed to merge NPC entries.");
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickStatusChange(npc: MergedNpcRecord, newStatus: string) {
    await upsertNpcRecord({
      ...npc,
      campaignStatus: newStatus,
    });
  }

  async function handleQuickStandingChange(npc: MergedNpcRecord, newStanding: string) {
    await upsertNpcRecord({
      ...npc,
      partyStanding: newStanding,
    });
  }

  async function handleAddHeroRelationship(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedNpc) return;

    const isParty = relHeroTarget === "party";
    const matchedHero = isParty ? null : heroes.find((h) => h.id === relHeroTarget);
    const newBond: NpcToHeroRelationship = {
      id: `hrel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      targetType: isParty ? "party" : "hero",
      ...(matchedHero ? { heroId: matchedHero.id } : {}),
      heroName: isParty ? "Entire Party" : matchedHero?.name || relHeroTarget,
      standing: relHeroStanding.trim() || "Friendly",
      notes: relHeroNotes.trim(),
    };

    await upsertNpcRecord({
      ...selectedNpc,
      heroRelationships: [...selectedNpc.heroRelationships, newBond],
    });
    setRelHeroNotes("");
    setShowHeroRelForm(false);
  }

  async function handleRemoveHeroRelationship(relId: string) {
    if (!selectedNpc) return;
    await upsertNpcRecord({
      ...selectedNpc,
      heroRelationships: selectedNpc.heroRelationships.filter((r) => r.id !== relId),
    });
  }

  async function handleAddNpcRelationship(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedNpc) return;

    const targetName =
      relNpcTarget === "__custom__" ? relNpcCustomName.trim() : relNpcTarget.trim();
    if (!targetName) return;

    const newRel: NpcToNpcRelationship = {
      id: `nrel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      targetNpcName: targetName,
      relationshipType: relNpcType.trim() || "Ally",
      notes: relNpcNotes.trim(),
    };

    const extraEntries: NpcRosterEntry[] = [];
    if (relNpcReciprocal) {
      const targetRecord = roster.find((n) => n.key === normalizeNpcKey(targetName));
      const reciprocalRel: NpcToNpcRelationship = {
        id: `nrel_${Date.now()}_rec_${Math.random().toString(36).slice(2, 6)}`,
        targetNpcName: selectedNpc.name,
        relationshipType: relNpcType.trim() || "Ally",
        notes: relNpcNotes.trim(),
      };
      if (targetRecord) {
        const alreadyHas = targetRecord.npcRelationships.some(
          (r) => normalizeNpcKey(r.targetNpcName) === selectedNpc.key
        );
        if (!alreadyHas) {
          extraEntries.push(
            toPersistedNpcEntry({
              ...targetRecord,
              npcRelationships: [...targetRecord.npcRelationships, reciprocalRel],
            })
          );
        }
      } else {
        extraEntries.push({
          id: `npc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: targetName,
          role: "NPC",
          description: `Connected to ${selectedNpc.name}.`,
          campaignStatus: "Active",
          partyStanding: "Neutral",
          heroRelationships: [],
          npcRelationships: [reciprocalRel],
          updatedAt: new Date().toISOString(),
        });
      }
    }

    await upsertNpcRecord(
      {
        ...selectedNpc,
        npcRelationships: [...selectedNpc.npcRelationships, newRel],
      },
      extraEntries
    );

    setRelNpcNotes("");
    setRelNpcCustomName("");
    setRelNpcTarget("");
    setShowNpcRelForm(false);
  }

  async function handleRemoveNpcRelationship(relId: string) {
    if (!selectedNpc) return;
    await upsertNpcRecord({
      ...selectedNpc,
      npcRelationships: selectedNpc.npcRelationships.filter((r) => r.id !== relId),
    });
  }

  async function handleRemoveCustomNpc(npc: MergedNpcRecord) {
    const next = (campaign.npcRoster || []).filter(
      (item) => normalizeNpcKey(item.name) !== npc.key && item.id !== npc.id
    );
    await persistRosterUpdates(next);
    if (effectiveSelectedKey === npc.key) {
      selectNpc(null);
    }
  }

  async function handleAnalyzeSessionsWithAI() {
    if (campaignSessions.length === 0) {
      setAnalyzeError("No recorded sessions found in this campaign to analyze.");
      return;
    }

    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalyzeSuccess(null);

    try {
      const sorted = [...campaignSessions].sort((a, b) => {
        const tA = a.date ? new Date(a.date).getTime() : 0;
        const tB = b.date ? new Date(b.date).getTime() : 0;
        return tA - tB;
      });

      const res = await fetch("/api/analyze-npc-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName: campaign.name,
          campaignSetting: campaign.setting,
          campaignHeroes: heroes.map((h) => ({
            id: h.id,
            name: h.name,
            level: h.level,
            race: h.race,
            classType: h.classType,
          })),
          sessions: sorted.map((s) => ({
            id: s.id,
            title: s.title,
            date: s.date,
            summary: s.summary,
            notes: s.notes,
            playerNotes: s.playerNotes,
            characters: s.characters,
          })),
          existingNpcRoster: roster.map((r) => ({
            name: r.name,
            role: r.role,
            campaignStatus: r.campaignStatus,
            partyStanding: r.partyStanding,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze campaign sessions.");
      }

      const analyzedList: any[] = Array.isArray(data.npcs) ? data.npcs : [];
      if (analyzedList.length === 0) {
        setAnalyzeSuccess("Analysis complete — no new NPC relationships or status changes detected.");
        return;
      }

      const mergedByKey = new Map<string, NpcRosterEntry>();
      const aliasToKey = new Map<string, string>();
      for (const existing of roster) {
        mergedByKey.set(existing.key, toPersistedNpcEntry(existing));
        aliasToKey.set(existing.key, existing.key);
        for (const al of existing.aliases || []) {
          const alKey = normalizeNpcKey(al);
          if (alKey && !aliasToKey.has(alKey)) {
            aliasToKey.set(alKey, existing.key);
          }
        }
      }

      for (const aiNpc of analyzedList) {
        const rawKey = normalizeNpcKey(aiNpc.name || "");
        if (!rawKey) continue;
        const key = aliasToKey.get(rawKey) || rawKey;

        const prev = mergedByKey.get(key);
        const mappedHeroRels: NpcToHeroRelationship[] = (aiNpc.heroRelationships || []).map(
          (hr: any, idx: number) => {
            const matchedHero = heroes.find(
              (h) => normalizeNpcKey(h.name) === normalizeNpcKey(hr.heroName || "")
            );
            return {
              id: `aih_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
              targetType: hr.targetType === "party" ? "party" : "hero",
              ...(matchedHero ? { heroId: matchedHero.id } : {}),
              heroName: matchedHero?.name || hr.heroName || "Entire Party",
              standing: hr.standing || "Neutral",
              notes: hr.notes || "",
            };
          }
        );

        const mappedNpcRels: NpcToNpcRelationship[] = (aiNpc.npcRelationships || []).map(
          (nr: any, idx: number) => {
            const targetKey = normalizeNpcKey(nr.targetNpcName || "");
            const canonicalTargetKey = aliasToKey.get(targetKey);
            const canonicalTargetName =
              (canonicalTargetKey && mergedByKey.get(canonicalTargetKey)?.name) ||
              nr.targetNpcName ||
              "";
            return {
              id: `ain_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
              targetNpcName: canonicalTargetName,
              relationshipType: nr.relationshipType || "Connected",
              notes: nr.notes || "",
            };
          }
        );

        mergedByKey.set(key, {
          id: prev?.id || `npc_${key.replace(/[^a-z0-9]/g, "_")}_${Date.now()}`,
          name: prev?.name || aiNpc.name,
          ...(prev?.aliases && prev.aliases.length > 0 ? { aliases: prev.aliases } : {}),
          role: aiNpc.role || prev?.role || "NPC",
          description: aiNpc.description || prev?.description || "",
          campaignStatus: aiNpc.campaignStatus || prev?.campaignStatus || "Active",
          statusNote: aiNpc.statusNote || prev?.statusNote || "",
          lastKnownLocation: aiNpc.lastKnownLocation || prev?.lastKnownLocation || "",
          partyStanding: aiNpc.partyStanding || prev?.partyStanding || "Neutral",
          partyRelationshipSummary:
            aiNpc.partyRelationshipSummary || prev?.partyRelationshipSummary || "",
          heroRelationships:
            mappedHeroRels.length > 0 ? mappedHeroRels : prev?.heroRelationships || [],
          npcRelationships:
            mappedNpcRels.length > 0 ? mappedNpcRels : prev?.npcRelationships || [],
          hp: prev?.hp,
          ac: prev?.ac,
          alignment: prev?.alignment,
          skills_or_actions: prev?.skills_or_actions,
          updatedAt: new Date().toISOString(),
        });
      }

      await persistRosterUpdates(Array.from(mergedByKey.values()));
      setAnalyzeSuccess(
        `Updated ${analyzedList.length} NPCs with statuses, party/hero bonds, and inter-NPC links.`
      );
      setTimeout(() => setAnalyzeSuccess(null), 6000);
    } catch (err: any) {
      setAnalyzeError(err.message || "Failed to analyze sessions.");
    } finally {
      setAnalyzing(false);
    }
  }

  // Layout nodes for Interactive Relationship Web SVG
  const webLayout = useMemo(() => {
    const width = 880;
    const height = 520;
    const cx = width / 2;
    const cy = height / 2;

    const displayedNpcs = filteredRoster.slice(0, 18);
    const activeHeroTargets = new Set<string>();
    for (const n of displayedNpcs) {
      for (const hr of n.heroRelationships) {
        if (hr.targetType === "hero" && hr.heroName) {
          activeHeroTargets.add(normalizeNpcKey(hr.heroName));
        }
      }
    }

    const connectedHeroes = heroes.filter((h) => activeHeroTargets.has(normalizeNpcKey(h.name)));

    type WebNode = {
      id: string;
      label: string;
      subLabel: string;
      kind: "party" | "hero" | "npc";
      x: number;
      y: number;
      status?: string;
      standing?: string;
      npcKey?: string;
    };

    const nodes: WebNode[] = [];

    // Center node(s): Party + connected individual heroes
    if (connectedHeroes.length === 0) {
      nodes.push({
        id: "party_core",
        label: "The Party",
        subLabel: `${heroes.length} Heroes`,
        kind: "party",
        x: cx,
        y: cy,
      });
    } else {
      nodes.push({
        id: "party_core",
        label: "The Party",
        subLabel: "Group Standing",
        kind: "party",
        x: cx,
        y: cy - 36,
      });
      const innerR = 82;
      connectedHeroes.forEach((h, i) => {
        const angle = (Math.PI / Math.max(connectedHeroes.length, 1)) * i + Math.PI * 0.15;
        nodes.push({
          id: `hero_${normalizeNpcKey(h.name)}`,
          label: h.name,
          subLabel: h.classType,
          kind: "hero",
          x: cx + Math.cos(angle) * innerR,
          y: cy + 28 + Math.sin(angle) * (innerR * 0.65),
        });
      });
    }

    // Outer ring: NPCs
    const rx = 335;
    const ry = 200;
    displayedNpcs.forEach((npc, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(displayedNpcs.length, 1) - Math.PI / 2;
      nodes.push({
        id: `npc_${npc.key}`,
        label: npc.name,
        subLabel: npc.campaignStatus,
        kind: "npc",
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry,
        status: npc.campaignStatus,
        standing: npc.partyStanding,
        npcKey: npc.key,
      });
    });

    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    type WebEdge = {
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      label: string;
      color: string;
      dashed?: boolean;
      involvesSelected: boolean;
    };

    const edges: WebEdge[] = [];
    const seenPairs = new Set<string>();

    for (const npc of displayedNpcs) {
      const fromNode = nodeById.get(`npc_${npc.key}`);
      if (!fromNode) continue;

      const isSelectedNpc = effectiveSelectedKey === npc.key;

      // Party link (when standing != Neutral or party summary exists)
      if (npc.partyStanding !== "Neutral" || npc.partyRelationshipSummary) {
        const partyNode = nodeById.get("party_core");
        if (partyNode) {
          edges.push({
            id: `edge_party_${npc.key}`,
            x1: fromNode.x,
            y1: fromNode.y,
            x2: partyNode.x,
            y2: partyNode.y,
            label: npc.partyStanding,
            color: getStandingMeta(npc.partyStanding).strokeHex,
            involvesSelected: isSelectedNpc,
          });
        }
      }

      // Hero links
      for (const hr of npc.heroRelationships) {
        const targetId =
          hr.targetType === "party"
            ? "party_core"
            : `hero_${normalizeNpcKey(hr.heroName)}`;
        const targetNode = nodeById.get(targetId);
        if (!targetNode) continue;
        edges.push({
          id: `edge_hero_${npc.key}_${hr.id}`,
          x1: fromNode.x,
          y1: fromNode.y,
          x2: targetNode.x,
          y2: targetNode.y,
          label: hr.standing,
          color: getStandingMeta(hr.standing).strokeHex,
          involvesSelected: isSelectedNpc,
        });
      }

      // NPC-to-NPC links
      for (const nr of npc.npcRelationships) {
        const targetKey = normalizeNpcKey(nr.targetNpcName);
        const targetNode = nodeById.get(`npc_${targetKey}`);
        if (!targetNode) continue;

        const pairKey = [npc.key, targetKey].sort().join("::");
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        edges.push({
          id: `edge_npc_${pairKey}`,
          x1: fromNode.x,
          y1: fromNode.y,
          x2: targetNode.x,
          y2: targetNode.y,
          label: nr.relationshipType,
          color: "#f59e0b",
          dashed: true,
          involvesSelected: isSelectedNpc || effectiveSelectedKey === targetKey,
        });
      }
    }

    return { width, height, nodes, edges };
  }, [filteredRoster, heroes, effectiveSelectedKey]);

  return (
    <div className="space-y-6 animate-fadeIn" id="npc-roster-workspace">
      {/* Top Bar Contract: Title + 1-line descriptor on left, Primary actions on right */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="font-fantasy font-bold text-xl tracking-wide text-zinc-100">
              NPC Roster
            </h2>
            {saving && (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-400 font-sans">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" /> Saving
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 font-sans">
            Track non-player characters from previous sessions, their inter-NPC ties, party and hero bonds, and current campaign status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode("dossier")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                viewMode === "dossier"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              id="btn-npc-view-dossier"
            >
              <Users className="w-3.5 h-3.5" /> Dossier
            </button>
            <button
              type="button"
              onClick={() => setViewMode("web")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                viewMode === "web"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              id="btn-npc-view-web"
            >
              <Network className="w-3.5 h-3.5" /> Relationship Web
            </button>
          </div>

          {roster.length >= 2 && (
            <button
              type="button"
              onClick={() => openMergeModal()}
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-medium transition whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
              id="btn-merge-roster-npcs"
            >
              <GitMerge className="w-3.5 h-3.5 text-zinc-400" />
              <span>Merge Duplicates</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleAnalyzeSessionsWithAI}
            disabled={analyzing || campaignSessions.length === 0}
            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700 rounded-lg text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            id="btn-analyze-npc-roster"
          >
            {analyzing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{analyzing ? "Analyzing Sessions..." : "Analyze Sessions"}</span>
          </button>

          <button
            type="button"
            onClick={openAddNpcModal}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-zinc-950 font-bold rounded-lg text-xs transition whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
            id="btn-add-roster-npc"
          >
            <Plus className="w-3.5 h-3.5" /> Add NPC
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {analyzeError && (
        <div className="p-3 bg-red-950/30 border border-red-800/60 rounded-lg text-xs text-red-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{analyzeError}</span>
          </div>
          <button
            type="button"
            onClick={() => setAnalyzeError(null)}
            className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {analyzeSuccess && (
        <div className="p-3 bg-emerald-950/30 border border-emerald-800/60 rounded-lg text-xs text-emerald-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{analyzeSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setAnalyzeSuccess(null)}
            className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4-Column Summary Strip (tabular-nums) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-1">
          <div className="text-xs text-zinc-400 font-sans">Tracked NPCs</div>
          <div className="text-2xl font-mono font-bold tabular-nums text-zinc-100">
            {metrics.total}
          </div>
          <div className="text-xs text-zinc-500 font-sans">
            Across {campaignSessions.length} {campaignSessions.length === 1 ? "session" : "sessions"}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-1">
          <div className="text-xs text-zinc-400 font-sans">Active &amp; Allied</div>
          <div className="text-2xl font-mono font-bold tabular-nums text-emerald-400">
            {metrics.alliedOrActive}
          </div>
          <div className="text-xs text-zinc-500 font-sans tabular-nums">
            {metrics.perilOrHostile} hostile, missing, or fallen
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-1">
          <div className="text-xs text-zinc-400 font-sans">Party &amp; Hero Bonds</div>
          <div className="text-2xl font-mono font-bold tabular-nums text-zinc-100">
            {metrics.heroLinks}
          </div>
          <div className="text-xs text-zinc-500 font-sans">
            Tracked across {heroes.length} {heroes.length === 1 ? "hero" : "heroes"}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-1">
          <div className="text-xs text-zinc-400 font-sans">Inter-NPC Links</div>
          <div className="text-2xl font-mono font-bold tabular-nums text-amber-400">
            {metrics.npcLinks}
          </div>
          <div className="text-xs text-zinc-500 font-sans">
            Alliances, rivalries &amp; factions
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 bg-zinc-900/40 border border-zinc-800 rounded-lg">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter NPCs by name, role, location, status, or relationship..."
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 focus:outline-none rounded-md pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-500"
            id="input-npc-roster-search"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {activeSessionId && (
            <div className="flex items-center gap-1 p-0.5 bg-zinc-950 border border-zinc-800 rounded-md">
              <button
                type="button"
                onClick={() => setSessionScope("all")}
                className={`px-2.5 py-1.5 text-xs rounded transition whitespace-nowrap cursor-pointer ${
                  sessionScope === "all"
                    ? "bg-zinc-800 text-zinc-100 font-medium"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                All Sessions
              </button>
              <button
                type="button"
                onClick={() => setSessionScope("prior")}
                className={`px-2.5 py-1.5 text-xs rounded transition whitespace-nowrap cursor-pointer ${
                  sessionScope === "prior"
                    ? "bg-zinc-800 text-zinc-100 font-medium"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Prior Chapters Only
              </button>
            </div>
          )}

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500 cursor-pointer"
            aria-label="Filter by campaign status"
          >
            <option value="all">All Statuses</option>
            {CAMPAIGN_STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                Status: {st}
              </option>
            ))}
          </select>

          <select
            value={standingFilter}
            onChange={(e) => setStandingFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500 cursor-pointer"
            aria-label="Filter by party standing"
          >
            <option value="all">All Party Standings</option>
            {PARTY_STANDING_OPTIONS.map((st) => (
              <option key={st} value={st}>
                Party: {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Empty State */}
      {roster.length === 0 ? (
        <div className="p-10 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-lg text-center space-y-3">
          <Users className="w-9 h-9 text-zinc-600 mx-auto" />
          <h3 className="font-fantasy font-bold text-base text-zinc-200">
            No NPCs Recorded Across Previous Sessions
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto font-sans leading-relaxed">
            NPCs detected or logged in your Chronicle Chapters appear here automatically. You can also scan your existing session notes with AI or add an NPC manually.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            {campaignSessions.length > 0 && (
              <button
                type="button"
                onClick={handleAnalyzeSessionsWithAI}
                disabled={analyzing}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-amber-300 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" /> Analyze Sessions
              </button>
            )}
            <button
              type="button"
              onClick={openAddNpcModal}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-zinc-950 font-bold rounded-lg text-xs cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add First NPC
            </button>
          </div>
        </div>
      ) : viewMode === "web" ? (
        /* INTERACTIVE RELATIONSHIP WEB VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
              <span>
                Click any NPC node to inspect their relationships and status. Showing up to 18 filtered NPCs.
              </span>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-3 h-0.5 bg-emerald-400 inline-block" /> Allied / Friendly
                </span>
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-3 h-0.5 bg-amber-400 inline-block border-b border-dashed" /> NPC-to-NPC Tie
                </span>
                <span className="flex items-center gap-1.5 text-red-400">
                  <span className="w-3 h-0.5 bg-red-400 inline-block" /> Hostile / Rival
                </span>
              </div>
            </div>

            <div className="w-full overflow-x-auto bg-zinc-900/30 border border-zinc-800/80 rounded-lg">
              <svg
                viewBox={`0 0 ${webLayout.width} ${webLayout.height}`}
                className="w-full min-w-[680px] h-auto select-none"
                role="img"
                aria-label="Campaign NPC and Hero Relationship Network"
              >
                {/* Edges */}
                {webLayout.edges.map((edge) => {
                  const mx = (edge.x1 + edge.x2) / 2;
                  const my = (edge.y1 + edge.y2) / 2;
                  return (
                    <g key={edge.id}>
                      <line
                        x1={edge.x1}
                        y1={edge.y1}
                        x2={edge.x2}
                        y2={edge.y2}
                        stroke={edge.color}
                        strokeWidth={edge.involvesSelected ? 2.2 : 1.2}
                        strokeOpacity={edge.involvesSelected ? 0.95 : 0.32}
                        strokeDasharray={edge.dashed ? "5 4" : undefined}
                      />
                      {edge.involvesSelected && (
                        <g transform={`translate(${mx}, ${my})`}>
                          <rect
                            x={-48}
                            y={-9}
                            width={96}
                            height={18}
                            rx={4}
                            fill="#09090b"
                            stroke={edge.color}
                            strokeWidth={0.8}
                            opacity={0.95}
                          />
                          <text
                            textAnchor="middle"
                            dy={3}
                            fill="#f4f4f5"
                            fontSize={9}
                            fontFamily="monospace"
                          >
                            {edge.label.length > 16 ? `${edge.label.slice(0, 15)}…` : edge.label}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Nodes */}
                {webLayout.nodes.map((node) => {
                  const isNpc = node.kind === "npc";
                  const isSelected = isNpc && node.npcKey === effectiveSelectedKey;
                  const fill =
                    node.kind === "party"
                      ? "#450a0a"
                      : node.kind === "hero"
                        ? "#1e1b4b"
                        : isSelected
                          ? "#27272a"
                          : "#18181b";
                  const stroke =
                    node.kind === "party"
                      ? "#ef4444"
                      : node.kind === "hero"
                        ? "#818cf8"
                        : isSelected
                          ? "#f59e0b"
                          : "#52525b";

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => {
                        if (isNpc && node.npcKey) {
                          selectNpc(node.npcKey);
                        }
                      }}
                      style={{ cursor: isNpc ? "pointer" : "default" }}
                    >
                      <rect
                        x={-68}
                        y={-22}
                        width={136}
                        height={44}
                        rx={8}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={isSelected ? 2 : 1.2}
                      />
                      <text
                        textAnchor="middle"
                        y={-3}
                        fill="#f4f4f5"
                        fontSize={11}
                        fontWeight="bold"
                        fontFamily="sans-serif"
                      >
                        {node.label.length > 18 ? `${node.label.slice(0, 17)}…` : node.label}
                      </text>
                      <text
                        textAnchor="middle"
                        y={12}
                        fill="#a1a1aa"
                        fontSize={9}
                        fontFamily="monospace"
                      >
                        {node.subLabel.length > 20 ? `${node.subLabel.slice(0, 19)}…` : node.subLabel}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Right side inspector for selected node */}
          <div className="lg:col-span-4 bg-zinc-950 border border-zinc-800 rounded-lg p-5 space-y-4">
            {selectedNpc ? (
              <>
                <div className="flex items-start justify-between gap-2 border-b border-zinc-800 pb-3">
                  <div>
                    <h3 className="font-fantasy font-bold text-base text-zinc-100">
                      {selectedNpc.name}
                    </h3>
                    <div className="text-xs text-zinc-400">
                      {selectedNpc.role} · {selectedNpc.campaignStatus}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewMode("dossier")}
                    className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 cursor-pointer shrink-0"
                  >
                    Open Dossier
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="text-zinc-400 font-medium">Party &amp; Hero Standing</div>
                  <div className={`font-semibold ${getStandingMeta(selectedNpc.partyStanding).textClass}`}>
                    Party: {selectedNpc.partyStanding}
                  </div>
                  {selectedNpc.partyRelationshipSummary && (
                    <p className="text-zinc-300 leading-relaxed">{selectedNpc.partyRelationshipSummary}</p>
                  )}
                  {selectedNpc.heroRelationships.map((hr) => (
                    <div key={hr.id} className="pt-1.5 border-t border-zinc-900 text-zinc-300">
                      <span className="font-medium text-zinc-100">{hr.heroName}</span> ·{" "}
                      <span className={getStandingMeta(hr.standing).textClass}>{hr.standing}</span>
                      {hr.notes && <div className="text-zinc-400 mt-0.5">{hr.notes}</div>}
                    </div>
                  ))}
                </div>

                <div className="space-y-2 text-xs pt-2 border-t border-zinc-800">
                  <div className="text-zinc-400 font-medium">Connections to Other NPCs</div>
                  {selectedNpc.npcRelationships.length === 0 &&
                  selectedNpc.incomingNpcRelationships.length === 0 ? (
                    <p className="text-zinc-500 italic">No inter-NPC links recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedNpc.npcRelationships.map((nr) => (
                        <button
                          type="button"
                          key={nr.id}
                          onClick={() => {
                            const target = roster.find(
                              (n) => n.key === normalizeNpcKey(nr.targetNpcName)
                            );
                            if (target) selectNpc(target.key);
                          }}
                          className="w-full text-left p-2 rounded bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 cursor-pointer"
                        >
                          <div className="font-medium text-zinc-200">
                            {nr.targetNpcName} · <span className="text-amber-400">{nr.relationshipType}</span>
                          </div>
                          {nr.notes && <div className="text-zinc-400 mt-0.5">{nr.notes}</div>}
                        </button>
                      ))}
                      {selectedNpc.incomingNpcRelationships.map((ir) => (
                        <button
                          type="button"
                          key={`${ir.sourceNpcKey}_${ir.relationshipType}`}
                          onClick={() => selectNpc(ir.sourceNpcKey)}
                          className="w-full text-left p-2 rounded bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800 cursor-pointer"
                        >
                          <div className="font-medium text-zinc-200">
                            {ir.sourceNpcName} · <span className="text-amber-400">{ir.relationshipType}</span>
                          </div>
                          {ir.notes && <div className="text-zinc-400 mt-0.5">{ir.notes}</div>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-zinc-500">Select an NPC node to view connections.</p>
            )}
          </div>
        </div>
      ) : (
        /* DOSSIER MASTER-DETAIL VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Filterable NPC Roster List */}
          <div className="lg:col-span-5 bg-zinc-950 border border-zinc-800 rounded-lg divide-y divide-zinc-900 overflow-hidden">
            <div className="px-4 py-3 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-400">
              <span className="font-medium text-zinc-200">
                Directory ({filteredRoster.length})
              </span>
              <span>Status · Party Standing</span>
            </div>

            {filteredRoster.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500">
                No NPCs match your current search or filters.
              </div>
            ) : (
              <div className="max-h-[680px] overflow-y-auto divide-y divide-zinc-900">
                {filteredRoster.map((npc) => {
                  const isSelected = selectedNpc?.key === npc.key;
                  const statusMeta = getStatusMeta(npc.campaignStatus);
                  const standingMeta = getStandingMeta(npc.partyStanding);
                  const totalTies =
                    npc.heroRelationships.length +
                    npc.npcRelationships.length +
                    npc.incomingNpcRelationships.length;

                  return (
                    <button
                      type="button"
                      key={npc.key}
                      onClick={() => selectNpc(npc.key)}
                      id={`npc-roster-row-${npc.key.replace(/[^a-z0-9]/g, "-")}`}
                      className={`w-full text-left px-4 py-3.5 transition flex items-start justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? "bg-red-500/10"
                          : "hover:bg-zinc-900/60"
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-fantasy font-bold text-sm truncate ${
                              isSelected ? "text-red-300" : "text-zinc-100"
                            }`}
                          >
                            {npc.name}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-400 flex items-center gap-1.5 flex-wrap">
                          <span>{npc.role}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {npc.appearances.length} {npc.appearances.length === 1 ? "session" : "sessions"}
                          </span>
                          {totalTies > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums text-amber-400/90">
                                {totalTies} {totalTies === 1 ? "tie" : "ties"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 space-y-1">
                        <div className="inline-flex items-center gap-1.5 text-xs font-medium justify-end">
                          {statusMeta.icon}
                          <span className={statusMeta.textClass}>{statusMeta.label}</span>
                        </div>
                        <div className={`text-xs font-sans ${standingMeta.textClass}`}>
                          {npc.partyStanding}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Selected NPC Dossier */}
          <div className="lg:col-span-7 bg-zinc-950 border border-zinc-800 rounded-lg p-6 space-y-6" id="npc-detail-dossier">
            {selectedNpc ? (
              <>
                {/* 1. NPC Identity & Current Campaign Status */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-zinc-800 pb-5">
                  <div className="space-y-1.5 min-w-0">
                    <h3 className="font-fantasy font-bold text-xl text-zinc-100 tracking-wide">
                      {selectedNpc.name}
                    </h3>
                    {selectedNpc.aliases && selectedNpc.aliases.length > 0 && (
                      <div className="text-xs text-zinc-400 font-sans">
                        Also known as: {selectedNpc.aliases.join(", ")}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      <span>{selectedNpc.role}</span>
                      {selectedNpc.alignment && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{selectedNpc.alignment}</span>
                        </>
                      )}
                      {selectedNpc.lastKnownLocation && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-zinc-300">
                            <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                            {selectedNpc.lastKnownLocation}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {roster.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => openMergeModal(selectedNpc.key)}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-md text-xs text-zinc-200 transition cursor-pointer flex items-center gap-1.5"
                        id="btn-merge-selected-npc"
                        title="Merge a duplicate NPC into this character"
                      >
                        <GitMerge className="w-3.5 h-3.5 text-zinc-400" /> Merge
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditNpcModal(selectedNpc)}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-md text-xs text-zinc-200 transition cursor-pointer flex items-center gap-1.5"
                      id="btn-edit-selected-npc"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </button>
                    {!selectedNpc.isFromSessions && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomNpc(selectedNpc)}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-red-950/60 border border-zinc-700 hover:border-red-800 rounded-md text-xs text-zinc-300 hover:text-red-300 transition cursor-pointer flex items-center gap-1.5"
                        title="Remove custom NPC"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* Campaign Status & Party Standing Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-lg space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-400">
                        Current Campaign Status
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                        {getStatusMeta(selectedNpc.campaignStatus).icon}
                        <span className={getStatusMeta(selectedNpc.campaignStatus).textClass}>
                          {selectedNpc.campaignStatus}
                        </span>
                      </span>
                    </div>
                    <select
                      value={selectedNpc.campaignStatus}
                      onChange={(e) => handleQuickStatusChange(selectedNpc, e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500 cursor-pointer"
                      id="select-npc-campaign-status"
                    >
                      {CAMPAIGN_STATUS_OPTIONS.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    {selectedNpc.statusNote ? (
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {selectedNpc.statusNote}
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-500 italic">
                        No status note recorded yet. Use Edit to add location or condition details.
                      </p>
                    )}
                  </div>

                  <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-lg space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-400">
                        Party Relationship
                      </span>
                      <span className={`text-xs font-semibold ${getStandingMeta(selectedNpc.partyStanding).textClass}`}>
                        {selectedNpc.partyStanding}
                      </span>
                    </div>
                    <select
                      value={selectedNpc.partyStanding}
                      onChange={(e) => handleQuickStandingChange(selectedNpc, e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500 cursor-pointer"
                      id="select-npc-party-standing"
                    >
                      {PARTY_STANDING_OPTIONS.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    {selectedNpc.partyRelationshipSummary ? (
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {selectedNpc.partyRelationshipSummary}
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-500 italic">
                        Add notes about how this NPC views the party as a whole.
                      </p>
                    )}
                  </div>
                </div>

                {/* Biography / Description */}
                {selectedNpc.description && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-zinc-400">Character Overview</h4>
                    <p className="text-sm text-zinc-300 leading-relaxed font-sans">
                      {selectedNpc.description}
                    </p>
                  </div>
                )}

                {/* 2. Party & Individual Hero Relationships */}
                <div className="space-y-3 pt-4 border-t border-zinc-800">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-fantasy font-bold text-sm text-zinc-200 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-red-400" />
                      Relationships with Party &amp; Individual Heroes
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowHeroRelForm(!showHeroRelForm)}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-md text-xs text-zinc-200 cursor-pointer flex items-center gap-1"
                      id="btn-add-hero-bond"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Add Hero Bond
                    </button>
                  </div>

                  {showHeroRelForm && (
                    <form
                      onSubmit={handleAddHeroRelationship}
                      className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-zinc-400 block">Target</label>
                          <select
                            value={relHeroTarget}
                            onChange={(e) => setRelHeroTarget(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500"
                          >
                            <option value="party">Entire Party</option>
                            {heroes.map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.name} ({h.classType})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-zinc-400 block">Relationship / Standing</label>
                          <input
                            type="text"
                            value={relHeroStanding}
                            onChange={(e) => setRelHeroStanding(e.target.value)}
                            placeholder="e.g. Mentor, Trusted Ally, Rival, Debtor"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-400 block">Notes</label>
                        <input
                          type="text"
                          value={relHeroNotes}
                          onChange={(e) => setRelHeroNotes(e.target.value)}
                          placeholder="How did this bond form in previous sessions?"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowHeroRelForm(false)}
                          className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-zinc-950 font-bold rounded text-xs cursor-pointer"
                        >
                          Save Bond
                        </button>
                      </div>
                    </form>
                  )}

                  {selectedNpc.heroRelationships.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic">
                      No individual hero bonds added yet. Click "Add Hero Bond" to track relationships with specific party members.
                    </p>
                  ) : (
                    <div className="divide-y divide-zinc-900 border border-zinc-800 rounded-lg bg-zinc-900/20">
                      {selectedNpc.heroRelationships.map((hr) => (
                        <div
                          key={hr.id}
                          className="px-4 py-3 flex items-start justify-between gap-3"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2 text-xs flex-wrap">
                              <span className="font-semibold text-zinc-100">{hr.heroName}</span>
                              <span aria-hidden="true" className="text-zinc-600">·</span>
                              <span className={`font-medium ${getStandingMeta(hr.standing).textClass}`}>
                                {hr.standing}
                              </span>
                            </div>
                            {hr.notes && (
                              <p className="text-xs text-zinc-400 leading-relaxed">{hr.notes}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveHeroRelationship(hr.id)}
                            className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer shrink-0"
                            title="Remove hero bond"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Relationships Between NPCs */}
                <div className="space-y-3 pt-4 border-t border-zinc-800">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-fantasy font-bold text-sm text-zinc-200 flex items-center gap-2">
                      <GitFork className="w-4 h-4 text-amber-400" />
                      Relationships with Other NPCs
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowNpcRelForm(!showNpcRelForm)}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-md text-xs text-zinc-200 cursor-pointer flex items-center gap-1"
                      id="btn-add-npc-link"
                    >
                      <Link2 className="w-3.5 h-3.5" /> Link NPC
                    </button>
                  </div>

                  {showNpcRelForm && (
                    <form
                      onSubmit={handleAddNpcRelationship}
                      className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-zinc-400 block">Connected NPC</label>
                          <select
                            value={relNpcTarget}
                            onChange={(e) => setRelNpcTarget(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500"
                            required
                          >
                            <option value="">Select an NPC...</option>
                            {roster
                              .filter((other) => other.key !== selectedNpc.key)
                              .map((other) => (
                                <option key={other.key} value={other.name}>
                                  {other.name} ({other.role})
                                </option>
                              ))}
                            <option value="__custom__">+ Enter New NPC Name</option>
                          </select>
                          {relNpcTarget === "__custom__" && (
                            <input
                              type="text"
                              value={relNpcCustomName}
                              onChange={(e) => setRelNpcCustomName(e.target.value)}
                              placeholder="New NPC name"
                              className="mt-2 w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500"
                              required
                            />
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-zinc-400 block">Relationship Type</label>
                          <input
                            type="text"
                            list="npc-relation-presets"
                            value={relNpcType}
                            onChange={(e) => setRelNpcType(e.target.value)}
                            placeholder="e.g. Rival, Sibling, Commander"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500"
                            required
                          />
                          <datalist id="npc-relation-presets">
                            {NPC_RELATION_PRESETS.map((p) => (
                              <option key={p} value={p} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-400 block">Context / Lore Notes</label>
                        <input
                          type="text"
                          value={relNpcNotes}
                          onChange={(e) => setRelNpcNotes(e.target.value)}
                          placeholder="Describe their alliance, rivalry, history, or shared secret..."
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={relNpcReciprocal}
                          onChange={(e) => setRelNpcReciprocal(e.target.checked)}
                          className="rounded border-zinc-700 bg-zinc-950"
                        />
                        Also record reciprocal connection on the linked NPC
                      </label>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowNpcRelForm(false)}
                          className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-zinc-950 font-bold rounded text-xs cursor-pointer"
                        >
                          Save Link
                        </button>
                      </div>
                    </form>
                  )}

                  {selectedNpc.npcRelationships.length === 0 &&
                  selectedNpc.incomingNpcRelationships.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic">
                      No relationships with other NPCs recorded yet. Click "Link NPC" to connect characters across your campaign.
                    </p>
                  ) : (
                    <div className="divide-y divide-zinc-900 border border-zinc-800 rounded-lg bg-zinc-900/20">
                      {selectedNpc.npcRelationships.map((nr) => {
                        const targetRecord = roster.find(
                          (n) => n.key === normalizeNpcKey(nr.targetNpcName)
                        );
                        return (
                          <div
                            key={nr.id}
                            className="px-4 py-3 flex items-start justify-between gap-3"
                          >
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2 text-xs flex-wrap">
                                {targetRecord ? (
                                  <button
                                    type="button"
                                    onClick={() => selectNpc(targetRecord.key)}
                                    className="font-semibold text-zinc-100 hover:text-amber-300 underline decoration-zinc-700 underline-offset-2 cursor-pointer"
                                  >
                                    {nr.targetNpcName}
                                  </button>
                                ) : (
                                  <span className="font-semibold text-zinc-100">
                                    {nr.targetNpcName}
                                  </span>
                                )}
                                <span aria-hidden="true" className="text-zinc-600">·</span>
                                <span className="text-amber-400 font-medium">
                                  {nr.relationshipType}
                                </span>
                                {targetRecord && (
                                  <>
                                    <span aria-hidden="true" className="text-zinc-600">·</span>
                                    <span className={getStatusMeta(targetRecord.campaignStatus).textClass}>
                                      {targetRecord.campaignStatus}
                                    </span>
                                  </>
                                )}
                              </div>
                              {nr.notes && (
                                <p className="text-xs text-zinc-400 leading-relaxed">{nr.notes}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveNpcRelationship(nr.id)}
                              className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer shrink-0"
                              title="Remove NPC link"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}

                      {selectedNpc.incomingNpcRelationships.map((ir) => {
                        const sourceRecord = roster.find((n) => n.key === ir.sourceNpcKey);
                        return (
                          <div
                            key={`in_${ir.sourceNpcKey}_${ir.relationshipType}`}
                            className="px-4 py-3 flex items-start justify-between gap-3 bg-zinc-900/30"
                          >
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2 text-xs flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => selectNpc(ir.sourceNpcKey)}
                                  className="font-semibold text-zinc-100 hover:text-amber-300 underline decoration-zinc-700 underline-offset-2 cursor-pointer"
                                >
                                  {ir.sourceNpcName}
                                </button>
                                <span aria-hidden="true" className="text-zinc-600">·</span>
                                <span className="text-amber-400 font-medium">
                                  {ir.relationshipType}
                                </span>
                                {sourceRecord && (
                                  <>
                                    <span aria-hidden="true" className="text-zinc-600">·</span>
                                    <span className={getStatusMeta(sourceRecord.campaignStatus).textClass}>
                                      {sourceRecord.campaignStatus}
                                    </span>
                                  </>
                                )}
                              </div>
                              {ir.notes && (
                                <p className="text-xs text-zinc-400 leading-relaxed">{ir.notes}</p>
                              )}
                            </div>
                            <span className="text-xs text-zinc-500 shrink-0">Linked from {ir.sourceNpcName}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 4. Session Appearances History */}
                <div className="space-y-3 pt-4 border-t border-zinc-800">
                  <h4 className="font-fantasy font-bold text-sm text-zinc-200 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-zinc-400" />
                    Previous Session Appearances ({selectedNpc.appearances.length})
                  </h4>
                  {selectedNpc.appearances.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic">
                      Added directly to the campaign NPC roster (not yet linked to a chapter character card).
                    </p>
                  ) : (
                    <div className="divide-y divide-zinc-900 border border-zinc-800 rounded-lg bg-zinc-900/20">
                      {selectedNpc.appearances.map((appItem) => (
                        <div
                          key={`${appItem.sessionId}_${appItem.title}`}
                          className="px-4 py-3 flex items-start justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs flex-wrap">
                              <span className="font-semibold text-zinc-100">{appItem.title}</span>
                              {appItem.date && (
                                <>
                                  <span aria-hidden="true" className="text-zinc-600">·</span>
                                  <span className="font-mono tabular-nums text-zinc-400">
                                    {appItem.date}
                                  </span>
                                </>
                              )}
                              <span aria-hidden="true" className="text-zinc-600">·</span>
                              <span className="text-zinc-400">{appItem.role}</span>
                            </div>
                            {appItem.description && (
                              <p className="text-xs text-zinc-400 leading-relaxed">
                                {appItem.description}
                              </p>
                            )}
                          </div>
                          {onOpenSession && (
                            <button
                              type="button"
                              onClick={() => onOpenSession(appItem.sessionId)}
                              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 cursor-pointer shrink-0 flex items-center gap-1 whitespace-nowrap"
                            >
                              <span>Open Chapter</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. Combat & Statblock Snapshot (if present) */}
                {(selectedNpc.hp !== undefined ||
                  selectedNpc.ac !== undefined ||
                  selectedNpc.skills_or_actions) && (
                  <div className="space-y-3 pt-4 border-t border-zinc-800">
                    <h4 className="font-fantasy font-bold text-sm text-zinc-200 flex items-center gap-2">
                      <User className="w-4 h-4 text-zinc-400" />
                      Combat &amp; Ability Reference
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
                      <div className="p-2.5 bg-zinc-900/40 border border-zinc-800 rounded">
                        <div className="text-zinc-500">HP</div>
                        <div className="text-sm font-bold text-zinc-100">
                          {selectedNpc.hp ?? "—"}
                        </div>
                      </div>
                      <div className="p-2.5 bg-zinc-900/40 border border-zinc-800 rounded">
                        <div className="text-zinc-500">AC</div>
                        <div className="text-sm font-bold text-zinc-100">
                          {selectedNpc.ac ?? "—"}
                        </div>
                      </div>
                      <div className="p-2.5 bg-zinc-900/40 border border-zinc-800 rounded col-span-2">
                        <div className="text-zinc-500">Alignment</div>
                        <div className="text-sm font-bold text-zinc-100 font-sans">
                          {selectedNpc.alignment || "Neutral"}
                        </div>
                      </div>
                    </div>
                    {selectedNpc.skills_or_actions && (
                      <p className="text-xs text-zinc-300 bg-zinc-900/30 border border-zinc-800 rounded p-3 leading-relaxed">
                        {selectedNpc.skills_or_actions}
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="py-12 text-center text-xs text-zinc-500">
                Select an NPC from the directory to view their status, session history, and relationships.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit NPC Modal */}
      {showNpcModal && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-fantasy font-bold text-base text-zinc-100">
                {editingNpcKey ? `Edit ${formName}` : "Add NPC to Roster"}
              </h3>
              <button
                type="button"
                onClick={() => setShowNpcModal(false)}
                className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNpcModal} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 block">NPC Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Captain Vane"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Role / Archetype</label>
                  <input
                    type="text"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    placeholder="e.g. NPC Ally, Guildmaster, Villain"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Current Campaign Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                  >
                    {CAMPAIGN_STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Party Standing</label>
                  <select
                    value={formStanding}
                    onChange={(e) => setFormStanding(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                  >
                    {PARTY_STANDING_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block">Last Known Location</label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="e.g. Silvercrest Harbor / Underdark Outpost"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block">Current Status Note</label>
                <input
                  type="text"
                  value={formStatusNote}
                  onChange={(e) => setFormStatusNote(e.target.value)}
                  placeholder="e.g. Recovering after the siege of Ironhold"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block">Party Relationship Summary</label>
                <textarea
                  rows={2}
                  value={formStandingSummary}
                  onChange={(e) => setFormStandingSummary(e.target.value)}
                  placeholder="How does this NPC currently view or interact with the party?"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block">Character Description</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Appearance, demeanor, and narrative role..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowNpcModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-zinc-950 font-bold rounded-md cursor-pointer"
                >
                  Save NPC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Merge Duplicate NPCs Modal */}
      {showMergeModal && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          id="modal-merge-roster-npcs"
        >
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-fantasy font-bold text-base text-zinc-100 flex items-center gap-2">
                  <GitMerge className="w-4 h-4 text-red-400" />
                  Merge Duplicate NPCs
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5 font-sans">
                  Combine two entries for the same character across session appearances, hero bonds, and inter-NPC links.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMergeModal(false)}
                className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {mergeError && (
              <div className="p-2.5 bg-red-950/40 border border-red-800/60 rounded text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{mergeError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteMerge} className="space-y-4 text-xs">
              {/* Primary vs Duplicate selector row */}
              <div className="grid grid-cols-1 md:grid-cols-11 gap-2 items-end p-3.5 bg-zinc-950 border border-zinc-800 rounded-lg">
                <div className="md:col-span-5 space-y-1">
                  <label className="text-zinc-400 block font-medium">
                    Keep as Primary NPC
                  </label>
                  <select
                    value={mergePrimaryKey}
                    onChange={(e) => {
                      const nextP = e.target.value;
                      let nextD = mergeDuplicateKey;
                      if (nextP === nextD) {
                        nextD = roster.find((n) => n.key !== nextP)?.key || "";
                        setMergeDuplicateKey(nextD);
                      }
                      setMergePrimaryKey(nextP);
                      syncMergeDefaults(nextP, nextD);
                    }}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                    id="select-merge-primary-npc"
                  >
                    {roster.map((npc) => (
                      <option key={npc.key} value={npc.key}>
                        {npc.name} ({npc.appearances.length}{" "}
                        {npc.appearances.length === 1 ? "session" : "sessions"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-1 flex justify-center pb-0.5">
                  <button
                    type="button"
                    onClick={handleSwapMergeParties}
                    className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded text-zinc-300 cursor-pointer"
                    title="Swap Primary and Duplicate"
                    id="btn-swap-merge-npcs"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="md:col-span-5 space-y-1">
                  <label className="text-zinc-400 block font-medium">
                    Duplicate Entry to Absorb
                  </label>
                  <select
                    value={mergeDuplicateKey}
                    onChange={(e) => {
                      const nextD = e.target.value;
                      setMergeDuplicateKey(nextD);
                      syncMergeDefaults(mergePrimaryKey, nextD);
                    }}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                    id="select-merge-duplicate-npc"
                  >
                    {roster
                      .filter((n) => n.key !== mergePrimaryKey)
                      .map((npc) => (
                        <option key={npc.key} value={npc.key}>
                          {npc.name} ({npc.appearances.length}{" "}
                          {npc.appearances.length === 1 ? "session" : "sessions"})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Combined summary preview */}
              {(() => {
                const primaryRec = roster.find((n) => n.key === mergePrimaryKey);
                const dupRec = roster.find((n) => n.key === mergeDuplicateKey);
                if (!primaryRec || !dupRec) return null;
                const combinedSessionsCount = new Set([
                  ...primaryRec.appearances.map((a) => a.sessionId),
                  ...dupRec.appearances.map((a) => a.sessionId),
                ]).size;
                const combinedHeroCount =
                  primaryRec.heroRelationships.length + dupRec.heroRelationships.length;
                const combinedNpcLinkCount =
                  primaryRec.npcRelationships.length + dupRec.npcRelationships.length;
                return (
                  <div className="grid grid-cols-3 gap-3 p-3 bg-zinc-950/60 border border-zinc-800 rounded-lg text-center">
                    <div>
                      <div className="text-zinc-400">Sessions Combined</div>
                      <div className="font-mono font-bold tabular-nums text-sm text-zinc-100">
                        {combinedSessionsCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-zinc-400">Party &amp; Hero Bonds</div>
                      <div className="font-mono font-bold tabular-nums text-sm text-zinc-100">
                        {combinedHeroCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-zinc-400">Inter-NPC Links</div>
                      <div className="font-mono font-bold tabular-nums text-sm text-amber-400">
                        {combinedNpcLinkCount}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Unified Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Canonical Name</label>
                  <input
                    type="text"
                    value={mergeCanonicalName}
                    onChange={(e) => setMergeCanonicalName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                    id="input-merge-canonical-name"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Role / Archetype</label>
                  <input
                    type="text"
                    value={mergeRole}
                    onChange={(e) => setMergeRole(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Campaign Status</label>
                  <select
                    value={mergeStatus}
                    onChange={(e) => setMergeStatus(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                  >
                    {CAMPAIGN_STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Party Standing</label>
                  <select
                    value={mergeStanding}
                    onChange={(e) => setMergeStanding(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                  >
                    {PARTY_STANDING_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Last Known Location</label>
                  <input
                    type="text"
                    value={mergeLocation}
                    onChange={(e) => setMergeLocation(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block">Current Status Note</label>
                <input
                  type="text"
                  value={mergeStatusNote}
                  onChange={(e) => setMergeStatusNote(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block">Party Relationship Summary</label>
                <textarea
                  rows={2}
                  value={mergeStandingSummary}
                  onChange={(e) => setMergeStandingSummary(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block">Unified Character Description</label>
                <textarea
                  rows={3}
                  value={mergeDescription}
                  onChange={(e) => setMergeDescription(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowMergeModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !mergePrimaryKey || !mergeDuplicateKey || mergePrimaryKey === mergeDuplicateKey}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-zinc-950 font-bold rounded-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  id="btn-confirm-merge-npcs"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <GitMerge className="w-3.5 h-3.5" />
                  )}
                  <span>Merge NPCs</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
