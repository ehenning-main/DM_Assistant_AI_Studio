import {
  Campaign,
  CharacterItem,
  NpcCampaignStatus,
  NpcRosterEntry,
  NpcToHeroRelationship,
  NpcToNpcRelationship,
  PartyStanding,
  Session,
} from "../types";

export interface NpcSessionAppearance {
  sessionId: string;
  title: string;
  date: string;
  role: string;
  description: string;
}

export interface IncomingNpcRelationship {
  sourceNpcKey: string;
  sourceNpcName: string;
  relationshipType: string;
  notes?: string;
}

export interface MergedNpcRecord extends NpcRosterEntry {
  key: string;
  aliases: string[];
  appearances: NpcSessionAppearance[];
  incomingNpcRelationships: IncomingNpcRelationship[];
  isFromSessions: boolean;
  hasCustomOverride: boolean;
}

export function normalizeNpcKey(name: string): string {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function inferStatusFromRole(role: string): NpcCampaignStatus {
  const r = (role || "").toLowerCase();
  if (r.includes("villain") || r.includes("boss") || r.includes("enemy") || r.includes("hostile")) {
    return "Hostile";
  }
  if (r.includes("ally") || r.includes("companion") || r.includes("friend")) {
    return "Allied";
  }
  return "Active";
}

export function inferStandingFromRole(role: string): PartyStanding {
  const r = (role || "").toLowerCase();
  if (r.includes("villain") || r.includes("boss") || r.includes("nemesis")) {
    return "Sworn Enemy";
  }
  if (r.includes("enemy") || r.includes("hostile")) {
    return "Hostile";
  }
  if (r.includes("ally")) {
    return "Friendly";
  }
  if (r.includes("quest")) {
    return "Friendly";
  }
  return "Neutral";
}

function sortSessionsChronologically(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    if (timeA !== timeB) return timeA - timeB;
    if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
    return 0;
  });
}

/**
 * Merges all NPCs discovered across campaign sessions with any saved campaign.npcRoster records.
 * Resolves merged aliases so duplicate names from earlier sessions collapse cleanly under the canonical NPC.
 */
export function buildMergedNpcRoster(
  campaign: Campaign | undefined,
  campaignSessions: Session[],
  options?: { excludeSessionId?: string | null }
): MergedNpcRecord[] {
  if (!campaign) return [];

  const aliasToCanonicalKey = new Map<string, string>();
  for (const saved of campaign.npcRoster || []) {
    const canonicalKey = normalizeNpcKey(saved.name);
    if (!canonicalKey) continue;
    aliasToCanonicalKey.set(canonicalKey, canonicalKey);
    for (const alias of saved.aliases || []) {
      const aKey = normalizeNpcKey(alias);
      if (aKey) {
        aliasToCanonicalKey.set(aKey, canonicalKey);
      }
    }
  }

  const resolveKey = (name: string): string => {
    const raw = normalizeNpcKey(name);
    return aliasToCanonicalKey.get(raw) || raw;
  };

  const filteredSessions = sortSessionsChronologically(
    campaignSessions.filter((s) => {
      if (s.campaignId !== campaign.id) return false;
      if (options?.excludeSessionId && s.id === options.excludeSessionId) return false;
      return true;
    })
  );

  const map = new Map<string, MergedNpcRecord>();

  // 1. Collect all NPCs across recorded sessions
  for (const sess of filteredSessions) {
    for (const char of sess.characters || []) {
      const key = resolveKey(char.name);
      if (!key) continue;

      const existing = map.get(key);
      const appearance: NpcSessionAppearance = {
        sessionId: sess.id,
        title: sess.title || "Untitled Chapter",
        date: sess.date || "",
        role: char.role || "NPC",
        description: char.description || "",
      };

      if (!existing) {
        map.set(key, {
          id: char.id || `npc_${key.replace(/[^a-z0-9]/g, "_")}`,
          key,
          name: char.name.trim(),
          aliases: [],
          role: char.role || "NPC",
          description: char.description || "",
          campaignStatus: inferStatusFromRole(char.role),
          statusNote: "",
          lastKnownLocation: "",
          partyStanding: inferStandingFromRole(char.role),
          partyRelationshipSummary: "",
          heroRelationships: [],
          npcRelationships: [],
          hp: char.hp,
          ac: char.ac,
          alignment: char.alignment,
          strength: char.strength,
          dexterity: char.dexterity,
          constitution: char.constitution,
          intelligence: char.intelligence,
          wisdom: char.wisdom,
          charisma: char.charisma,
          skills_or_actions: char.skills_or_actions,
          appearances: [appearance],
          incomingNpcRelationships: [],
          isFromSessions: true,
          hasCustomOverride: false,
        });
      } else {
        existing.appearances.push(appearance);
        if (char.role) existing.role = char.role;
        if (char.description) existing.description = char.description;
        if (char.hp !== undefined) existing.hp = char.hp;
        if (char.ac !== undefined) existing.ac = char.ac;
        if (char.alignment) existing.alignment = char.alignment;
        if (char.strength !== undefined) existing.strength = char.strength;
        if (char.dexterity !== undefined) existing.dexterity = char.dexterity;
        if (char.constitution !== undefined) existing.constitution = char.constitution;
        if (char.intelligence !== undefined) existing.intelligence = char.intelligence;
        if (char.wisdom !== undefined) existing.wisdom = char.wisdom;
        if (char.charisma !== undefined) existing.charisma = char.charisma;
        if (char.skills_or_actions) existing.skills_or_actions = char.skills_or_actions;
      }
    }
  }

  // 2. Overlay persisted campaign.npcRoster records (status, relationships, aliases, custom NPCs)
  for (const saved of campaign.npcRoster || []) {
    const key = normalizeNpcKey(saved.name);
    if (!key) continue;

    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        ...existing,
        id: saved.id || existing.id,
        name: saved.name || existing.name,
        aliases: Array.isArray(saved.aliases) ? saved.aliases : existing.aliases,
        role: saved.role || existing.role,
        description: saved.description || existing.description,
        campaignStatus: saved.campaignStatus || existing.campaignStatus,
        statusNote: saved.statusNote ?? existing.statusNote,
        lastKnownLocation: saved.lastKnownLocation ?? existing.lastKnownLocation,
        partyStanding: saved.partyStanding || existing.partyStanding,
        partyRelationshipSummary:
          saved.partyRelationshipSummary ?? existing.partyRelationshipSummary,
        heroRelationships: Array.isArray(saved.heroRelationships)
          ? saved.heroRelationships
          : existing.heroRelationships,
        npcRelationships: Array.isArray(saved.npcRelationships)
          ? saved.npcRelationships
          : existing.npcRelationships,
        hp: saved.hp ?? existing.hp,
        ac: saved.ac ?? existing.ac,
        alignment: saved.alignment || existing.alignment,
        strength: saved.strength ?? existing.strength,
        dexterity: saved.dexterity ?? existing.dexterity,
        constitution: saved.constitution ?? existing.constitution,
        intelligence: saved.intelligence ?? existing.intelligence,
        wisdom: saved.wisdom ?? existing.wisdom,
        charisma: saved.charisma ?? existing.charisma,
        skills_or_actions: saved.skills_or_actions || existing.skills_or_actions,
        updatedAt: saved.updatedAt,
        hasCustomOverride: true,
      });
    } else if (!options?.excludeSessionId) {
      map.set(key, {
        ...saved,
        key,
        aliases: Array.isArray(saved.aliases) ? saved.aliases : [],
        heroRelationships: Array.isArray(saved.heroRelationships) ? saved.heroRelationships : [],
        npcRelationships: Array.isArray(saved.npcRelationships) ? saved.npcRelationships : [],
        appearances: [],
        incomingNpcRelationships: [],
        isFromSessions: false,
        hasCustomOverride: true,
      });
    }
  }

  // 3. Populate reverse (incoming) NPC-to-NPC relationships so connections are discoverable from either side
  const records = Array.from(map.values());
  for (const source of records) {
    for (const rel of source.npcRelationships) {
      const targetKey = resolveKey(rel.targetNpcName);
      if (!targetKey || targetKey === source.key) continue;
      const target = map.get(targetKey);
      if (!target) continue;

      const alreadyExplicit = target.npcRelationships.some(
        (r) => resolveKey(r.targetNpcName) === source.key
      );
      if (!alreadyExplicit) {
        target.incomingNpcRelationships.push({
          sourceNpcKey: source.key,
          sourceNpcName: source.name,
          relationshipType: rel.relationshipType,
          notes: rel.notes,
        });
      }
    }
  }

  return records.sort((a, b) => a.name.localeCompare(b.name));
}

export function toPersistedNpcEntry(record: MergedNpcRecord | NpcRosterEntry): NpcRosterEntry {
  return {
    id: record.id,
    name: record.name.trim(),
    ...(record.aliases && record.aliases.length > 0 ? { aliases: record.aliases } : {}),
    role: record.role || "NPC",
    description: record.description || "",
    campaignStatus: record.campaignStatus || "Active",
    statusNote: record.statusNote || "",
    lastKnownLocation: record.lastKnownLocation || "",
    partyStanding: record.partyStanding || "Neutral",
    partyRelationshipSummary: record.partyRelationshipSummary || "",
    heroRelationships: (record.heroRelationships || []).map((r: NpcToHeroRelationship) => ({
      id: r.id,
      targetType: r.targetType,
      ...(r.heroId ? { heroId: r.heroId } : {}),
      heroName: r.heroName,
      standing: r.standing,
      ...(r.notes ? { notes: r.notes } : {}),
    })),
    npcRelationships: (record.npcRelationships || []).map((r: NpcToNpcRelationship) => ({
      id: r.id,
      targetNpcName: r.targetNpcName,
      relationshipType: r.relationshipType,
      ...(r.notes ? { notes: r.notes } : {}),
    })),
    ...(record.hp !== undefined ? { hp: record.hp } : {}),
    ...(record.ac !== undefined ? { ac: record.ac } : {}),
    ...(record.alignment ? { alignment: record.alignment } : {}),
    ...(record.strength !== undefined ? { strength: record.strength } : {}),
    ...(record.dexterity !== undefined ? { dexterity: record.dexterity } : {}),
    ...(record.constitution !== undefined ? { constitution: record.constitution } : {}),
    ...(record.intelligence !== undefined ? { intelligence: record.intelligence } : {}),
    ...(record.wisdom !== undefined ? { wisdom: record.wisdom } : {}),
    ...(record.charisma !== undefined ? { charisma: record.charisma } : {}),
    ...(record.skills_or_actions ? { skills_or_actions: record.skills_or_actions } : {}),
    updatedAt: new Date().toISOString(),
  };
}

export interface MergeRosterNpcsParams {
  primaryKey: string;
  duplicateKey: string;
  canonicalName: string;
  role: string;
  campaignStatus: string;
  partyStanding: string;
  description: string;
  statusNote: string;
  lastKnownLocation: string;
  partyRelationshipSummary: string;
}

export interface MergeRosterNpcsResult {
  nextNpcRoster: NpcRosterEntry[];
  updatedSessions: Session[];
  canonicalKey: string;
  canonicalName: string;
  mergedFromName: string;
}

/**
 * Combines a duplicate NPC into a primary canonical NPC across the campaign roster,
 * inter-NPC relationship links, hero/party bonds, and chapter character lists.
 */
export function mergeRosterNpcs(
  campaign: Campaign,
  roster: MergedNpcRecord[],
  campaignSessions: Session[],
  params: MergeRosterNpcsParams
): MergeRosterNpcsResult {
  const primary = roster.find((n) => n.key === params.primaryKey);
  const duplicate = roster.find((n) => n.key === params.duplicateKey);
  if (!primary || !duplicate || primary.key === duplicate.key) {
    throw new Error("Please choose two distinct NPCs to merge.");
  }

  const canonicalName = params.canonicalName.trim() || primary.name;
  const canonicalKey = normalizeNpcKey(canonicalName);

  // Gather all keys/names that should resolve to the merged canonical NPC
  const aliasSet = new Map<string, string>();
  const addAlias = (rawName: string) => {
    const trimmed = (rawName || "").trim();
    const k = normalizeNpcKey(trimmed);
    if (!k || k === canonicalKey) return;
    if (!aliasSet.has(k)) aliasSet.set(k, trimmed);
  };

  addAlias(primary.name);
  addAlias(duplicate.name);
  (primary.aliases || []).forEach(addAlias);
  (duplicate.aliases || []).forEach(addAlias);

  const absorbedKeys = new Set<string>([
    primary.key,
    duplicate.key,
    canonicalKey,
    ...Array.from(aliasSet.keys()),
  ]);

  // Combine Hero/Party relationships without duplicates
  const heroRelMap = new Map<string, NpcToHeroRelationship>();
  for (const hr of [...primary.heroRelationships, ...duplicate.heroRelationships]) {
    const sig = `${hr.targetType}::${normalizeNpcKey(hr.heroName)}::${(hr.standing || "").toLowerCase()}`;
    const existing = heroRelMap.get(sig);
    if (!existing) {
      heroRelMap.set(sig, { ...hr });
    } else if (hr.notes && !existing.notes?.includes(hr.notes)) {
      existing.notes = [existing.notes, hr.notes].filter(Boolean).join(" · ");
    }
  }

  // Combine NPC-to-NPC relationships, removing self-links between primary & duplicate
  const npcRelMap = new Map<string, NpcToNpcRelationship>();
  for (const nr of [...primary.npcRelationships, ...duplicate.npcRelationships]) {
    const targetKey = normalizeNpcKey(nr.targetNpcName);
    if (!targetKey || absorbedKeys.has(targetKey)) continue;
    const sig = `${targetKey}::${(nr.relationshipType || "").toLowerCase()}`;
    const existing = npcRelMap.get(sig);
    if (!existing) {
      npcRelMap.set(sig, { ...nr });
    } else if (nr.notes && !existing.notes?.includes(nr.notes)) {
      existing.notes = [existing.notes, nr.notes].filter(Boolean).join(" · ");
    }
  }

  const combinedSkills =
    primary.skills_or_actions &&
    duplicate.skills_or_actions &&
    primary.skills_or_actions.trim() !== duplicate.skills_or_actions.trim()
      ? `${primary.skills_or_actions.trim()} | ${duplicate.skills_or_actions.trim()}`
      : primary.skills_or_actions || duplicate.skills_or_actions;

  const mergedEntry: NpcRosterEntry = toPersistedNpcEntry({
    id: primary.id,
    name: canonicalName,
    aliases: Array.from(aliasSet.values()),
    role: params.role.trim() || primary.role,
    description: params.description.trim(),
    campaignStatus: params.campaignStatus || primary.campaignStatus,
    statusNote: params.statusNote.trim(),
    lastKnownLocation: params.lastKnownLocation.trim(),
    partyStanding: params.partyStanding || primary.partyStanding,
    partyRelationshipSummary: params.partyRelationshipSummary.trim(),
    heroRelationships: Array.from(heroRelMap.values()),
    npcRelationships: Array.from(npcRelMap.values()),
    hp:
      primary.hp !== undefined && duplicate.hp !== undefined
        ? Math.max(primary.hp, duplicate.hp)
        : primary.hp ?? duplicate.hp,
    ac:
      primary.ac !== undefined && duplicate.ac !== undefined
        ? Math.max(primary.ac, duplicate.ac)
        : primary.ac ?? duplicate.ac,
    alignment: primary.alignment || duplicate.alignment,
    strength: primary.strength ?? duplicate.strength,
    dexterity: primary.dexterity ?? duplicate.dexterity,
    constitution: primary.constitution ?? duplicate.constitution,
    intelligence: primary.intelligence ?? duplicate.intelligence,
    wisdom: primary.wisdom ?? duplicate.wisdom,
    charisma: primary.charisma ?? duplicate.charisma,
    skills_or_actions: combinedSkills,
  });

  // Update persisted campaign.npcRoster: remove absorbed entries, rewrite references in other NPCs, insert mergedEntry
  const nextRosterMap = new Map<string, NpcRosterEntry>();
  for (const saved of campaign.npcRoster || []) {
    const savedKey = normalizeNpcKey(saved.name);
    if (!savedKey || absorbedKeys.has(savedKey)) continue;

    // Rewrite any NPC-to-NPC relationships pointing at the duplicate / old primary name
    const rewrittenNpcRels: NpcToNpcRelationship[] = [];
    const seenRelSigs = new Set<string>();
    for (const rel of saved.npcRelationships || []) {
      const targetKey = normalizeNpcKey(rel.targetNpcName);
      const nextTargetName = absorbedKeys.has(targetKey) ? canonicalName : rel.targetNpcName;
      const sig = `${normalizeNpcKey(nextTargetName)}::${(rel.relationshipType || "").toLowerCase()}`;
      if (!seenRelSigs.has(sig)) {
        seenRelSigs.add(sig);
        rewrittenNpcRels.push({ ...rel, targetNpcName: nextTargetName });
      }
    }

    nextRosterMap.set(savedKey, {
      ...saved,
      npcRelationships: rewrittenNpcRels,
    });
  }
  nextRosterMap.set(canonicalKey, mergedEntry);

  // Also rewrite & deduplicate matching characters in previous sessions so Chronicle Chapters stay consistent
  const updatedSessions: Session[] = [];
  for (const sess of campaignSessions) {
    if (sess.campaignId !== campaign.id || !sess.characters || sess.characters.length === 0) continue;

    const hasAbsorbedChar = sess.characters.some((c) => absorbedKeys.has(normalizeNpcKey(c.name)));
    if (!hasAbsorbedChar) continue;

    let canonicalChar: CharacterItem | null = null;
    const otherChars: CharacterItem[] = [];
    let changed = false;

    for (const char of sess.characters) {
      const cKey = normalizeNpcKey(char.name);
      if (!absorbedKeys.has(cKey)) {
        otherChars.push(char);
        continue;
      }

      if (char.name.trim() !== canonicalName) {
        changed = true;
      }

      if (!canonicalChar) {
        canonicalChar = {
          ...char,
          name: canonicalName,
          role: params.role.trim() || char.role,
        };
      } else {
        // Two duplicate entries existed in the exact same session -> fuse into one
        changed = true;
        canonicalChar = {
          ...canonicalChar,
          description:
            canonicalChar.description === char.description
              ? canonicalChar.description
              : [canonicalChar.description, char.description].filter(Boolean).join("\n"),
          hp: Math.max(canonicalChar.hp ?? 0, char.hp ?? 0) || canonicalChar.hp || char.hp,
          ac: Math.max(canonicalChar.ac ?? 0, char.ac ?? 0) || canonicalChar.ac || char.ac,
          skills_or_actions:
            canonicalChar.skills_or_actions &&
            char.skills_or_actions &&
            canonicalChar.skills_or_actions !== char.skills_or_actions
              ? `${canonicalChar.skills_or_actions} | ${char.skills_or_actions}`
              : canonicalChar.skills_or_actions || char.skills_or_actions,
        };
      }
    }

    if (changed && canonicalChar) {
      updatedSessions.push({
        ...sess,
        characters: [canonicalChar, ...otherChars],
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return {
    nextNpcRoster: Array.from(nextRosterMap.values()),
    updatedSessions,
    canonicalKey,
    canonicalName,
    mergedFromName: duplicate.name,
  };
}
