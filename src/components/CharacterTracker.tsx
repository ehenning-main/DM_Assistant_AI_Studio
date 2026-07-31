import React, { useState } from "react";
import { User, Plus, Trash2, Shield, UserX, Sparkles, ChevronDown, ChevronUp, Dices, Save, Check, RefreshCw, AlertCircle, Edit, GitMerge, ArrowRight, Layers, BookOpen, BookMarked, History } from "lucide-react";
import { CharacterItem, Session, HeroCharacter } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface CharacterTrackerProps {
  characters: CharacterItem[];
  onChange: (updated: CharacterItem[]) => void;
  session?: Session;
  campaignSessions?: Session[];
  campaignHeroes?: HeroCharacter[];
  onUpdateCampaignHeroes?: (updated: HeroCharacter[]) => Promise<void>;
}

export function CharacterTracker({ 
  characters = [], 
  onChange, 
  session,
  campaignSessions = [],
  campaignHeroes = [],
  onUpdateCampaignHeroes
}: CharacterTrackerProps) {
  // Manual adding state
  const [name, setName] = useState("");
  const [role, setRole] = useState("NPC Ally");
  const [description, setDescription] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Auto-Detect state
  const [detecting, setDetecting] = useState(false);
  const [detectedNPCs, setDetectedNPCs] = useState<CharacterItem[]>([]);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [autoDetectSummary, setAutoDetectSummary] = useState<{ timestamp: number; logs: string[] } | null>(null);

  // Editable fields for NPC core details
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("NPC Ally");
  const [editDescription, setEditDescription] = useState("");

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

  // Merge NPC state & handlers
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [primaryNpcId, setPrimaryNpcId] = useState<string>("");
  const [secondaryNpcId, setSecondaryNpcId] = useState<string>("");
  const [customMergeName, setCustomMergeName] = useState<string>("");
  const [mergeRoleChoice, setMergeRoleChoice] = useState<string>("NPC Ally");
  const [mergedBio, setMergedBio] = useState<string>("");
  const [mergeStatsStrategy, setMergeStatsStrategy] = useState<"primary" | "secondary" | "highest">("highest");
  const [mergedSkills, setMergedSkills] = useState<string>("");
  const [mergeSuccessMsg, setMergeSuccessMsg] = useState<string | null>(null);

  // --- PREVIOUS CHAPTER NPC CROSS-REFERENCE HELPERS ---
  
  // Helper: Find all previous chapters in campaign where an NPC appeared
  function getPreviousChaptersForNPC(npcName: string): Array<{ id: string; title: string; date: string }> {
    if (!campaignSessions || campaignSessions.length === 0 || !npcName.trim()) return [];
    const norm = npcName.trim().toLowerCase();
    const result: Array<{ id: string; title: string; date: string }> = [];

    for (const sess of campaignSessions) {
      if (sess.id === session?.id) continue; // Exclude active session
      const match = (sess.characters || []).some(
        (c) => c.name.trim().toLowerCase() === norm
      );
      if (match) {
        result.push({
          id: sess.id,
          title: sess.title || "Untitled Chapter",
          date: sess.date || "",
        });
      }
    }
    return result;
  }

  // Helper: Find existing statblock & skills from a previous chapter for this NPC
  function getPreviousStatblockForNPC(npcName: string): CharacterItem | null {
    if (!campaignSessions || campaignSessions.length === 0 || !npcName.trim()) return null;
    const norm = npcName.trim().toLowerCase();

    for (const sess of campaignSessions) {
      if (sess.id === session?.id) continue;
      const match = (sess.characters || []).find(
        (c) => c.name.trim().toLowerCase() === norm
      );
      if (match) {
        return match;
      }
    }
    return null;
  }

  // Helper: Extract all unique NPCs from previous chapters
  function getPreviousChapterNPCs(): CharacterItem[] {
    if (!campaignSessions || campaignSessions.length === 0) return [];
    const prevNpcs: CharacterItem[] = [];
    const seenNames = new Set<string>();

    for (const sess of campaignSessions) {
      if (sess.id === session?.id) continue;
      for (const char of sess.characters || []) {
        const norm = char.name.trim().toLowerCase();
        if (norm && !seenNames.has(norm)) {
          seenNames.add(norm);
          const chapters = getPreviousChaptersForNPC(char.name);
          prevNpcs.push({
            ...char,
            previousChapters: chapters,
          });
        }
      }
    }
    return prevNpcs;
  }

  // Sync / copy statblock from a previous chapter onto an active NPC card
  function syncStatsFromPreviousChapter(targetCharId: string, prevMatch: CharacterItem) {
    const updated = characters.map((c) => {
      if (c.id === targetCharId) {
        return {
          ...c,
          role: prevMatch.role || c.role,
          hp: prevMatch.hp ?? c.hp ?? 10,
          ac: prevMatch.ac ?? c.ac ?? 10,
          alignment: prevMatch.alignment || c.alignment || "Neutral",
          strength: prevMatch.strength ?? c.strength ?? 10,
          dexterity: prevMatch.dexterity ?? c.dexterity ?? 10,
          constitution: prevMatch.constitution ?? c.constitution ?? 10,
          intelligence: prevMatch.intelligence ?? c.intelligence ?? 10,
          wisdom: prevMatch.wisdom ?? c.wisdom ?? 10,
          charisma: prevMatch.charisma ?? c.charisma ?? 10,
          skills_or_actions: prevMatch.skills_or_actions || c.skills_or_actions || "",
          isCustomStatsCreated: prevMatch.isCustomStatsCreated ?? true,
          previousChapters: getPreviousChaptersForNPC(c.name),
        };
      }
      return c;
    });

    onChange(updated);
    setMergeSuccessMsg(`Synced statblock and skills for "${prevMatch.name}" from previous campaign chapter!`);
    setTimeout(() => {
      setMergeSuccessMsg(null);
    }, 4000);
  }

  function openMergeModal(preselectedPrimaryId?: string) {
    if (characters.length < 2) return;

    const firstPrimary = preselectedPrimaryId || characters[0].id;
    const firstSecondary = characters.find((c) => c.id !== firstPrimary)?.id || characters[1]?.id || "";

    setPrimaryNpcId(firstPrimary);
    setSecondaryNpcId(firstSecondary);

    updateMergeDefaults(firstPrimary, firstSecondary);
    setIsMergeModalOpen(true);
  }

  function updateMergeDefaults(pId: string, sId: string) {
    const pNPC = characters.find((c) => c.id === pId);
    const sNPC = characters.find((c) => c.id === sId);

    if (pNPC) {
      setCustomMergeName(pNPC.name);
      setMergeRoleChoice(pNPC.role);
    }
    if (pNPC && sNPC) {
      setMergedBio(
        pNPC.description === sNPC.description 
          ? pNPC.description 
          : `${pNPC.description}\n\n[Merged Lore from ${sNPC.name}]: ${sNPC.description}`.trim()
      );
      setMergedSkills(
        pNPC.skills_or_actions === sNPC.skills_or_actions 
          ? (pNPC.skills_or_actions || "") 
          : `${pNPC.skills_or_actions || ""}\n${sNPC.skills_or_actions || ""}`.trim()
      );
    }
  }

  function handlePrimaryChange(newPrimaryId: string) {
    setPrimaryNpcId(newPrimaryId);
    let newSecondary = secondaryNpcId;
    if (newSecondary === newPrimaryId) {
      newSecondary = characters.find((c) => c.id !== newPrimaryId)?.id || "";
      setSecondaryNpcId(newSecondary);
    }
    updateMergeDefaults(newPrimaryId, newSecondary);
  }

  function handleSecondaryChange(newSecondaryId: string) {
    setSecondaryNpcId(newSecondaryId);
    let newPrimary = primaryNpcId;
    if (newPrimary === newSecondaryId) {
      newPrimary = characters.find((c) => c.id !== newSecondaryId)?.id || "";
      setPrimaryNpcId(newPrimary);
    }
    updateMergeDefaults(newPrimary, newSecondaryId);
  }

  function handleExecuteMerge(e: React.FormEvent) {
    e.preventDefault();
    const pNPC = characters.find((c) => c.id === primaryNpcId);
    const sNPC = characters.find((c) => c.id === secondaryNpcId);

    if (!pNPC || !sNPC || pNPC.id === sNPC.id) return;

    const calcHp = mergeStatsStrategy === "highest" ? Math.max(pNPC.hp ?? 10, sNPC.hp ?? 10) : (mergeStatsStrategy === "secondary" ? (sNPC.hp ?? 10) : (pNPC.hp ?? 10));
    const calcAc = mergeStatsStrategy === "highest" ? Math.max(pNPC.ac ?? 10, sNPC.ac ?? 10) : (mergeStatsStrategy === "secondary" ? (sNPC.ac ?? 10) : (pNPC.ac ?? 10));
    const calcStr = mergeStatsStrategy === "highest" ? Math.max(pNPC.strength ?? 10, sNPC.strength ?? 10) : (mergeStatsStrategy === "secondary" ? (sNPC.strength ?? 10) : (pNPC.strength ?? 10));
    const calcDex = mergeStatsStrategy === "highest" ? Math.max(pNPC.dexterity ?? 10, sNPC.dexterity ?? 10) : (mergeStatsStrategy === "secondary" ? (sNPC.dexterity ?? 10) : (pNPC.dexterity ?? 10));
    const calcCon = mergeStatsStrategy === "highest" ? Math.max(pNPC.constitution ?? 10, sNPC.constitution ?? 10) : (mergeStatsStrategy === "secondary" ? (sNPC.constitution ?? 10) : (pNPC.constitution ?? 10));
    const calcInt = mergeStatsStrategy === "highest" ? Math.max(pNPC.intelligence ?? 10, sNPC.intelligence ?? 10) : (mergeStatsStrategy === "secondary" ? (sNPC.intelligence ?? 10) : (pNPC.intelligence ?? 10));
    const calcWis = mergeStatsStrategy === "highest" ? Math.max(pNPC.wisdom ?? 10, sNPC.wisdom ?? 10) : (mergeStatsStrategy === "secondary" ? (sNPC.wisdom ?? 10) : (pNPC.wisdom ?? 10));
    const calcCha = mergeStatsStrategy === "highest" ? Math.max(pNPC.charisma ?? 10, sNPC.charisma ?? 10) : (mergeStatsStrategy === "secondary" ? (sNPC.charisma ?? 10) : (pNPC.charisma ?? 10));

    const mergedNPC: CharacterItem = {
      ...pNPC,
      name: customMergeName.trim() || pNPC.name,
      role: mergeRoleChoice,
      description: mergedBio.trim() || pNPC.description,
      hp: calcHp,
      ac: calcAc,
      alignment: pNPC.alignment || sNPC.alignment || "Neutral",
      strength: calcStr,
      dexterity: calcDex,
      constitution: calcCon,
      intelligence: calcInt,
      wisdom: calcWis,
      charisma: calcCha,
      skills_or_actions: mergedSkills.trim(),
      isCustomStatsCreated: pNPC.isCustomStatsCreated || sNPC.isCustomStatsCreated,
    };

    const updatedList = characters
      .filter((c) => c.id !== sNPC.id)
      .map((c) => (c.id === pNPC.id ? mergedNPC : c));

    onChange(updatedList);
    setIsMergeModalOpen(false);

    setMergeSuccessMsg(`Merged duplicate soul "${sNPC.name}" into "${mergedNPC.name}"!`);
    setTimeout(() => {
      setMergeSuccessMsg(null);
    }, 4000);
  }

  // Action: Add manual character
  function addNewCharacter(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const trimmedName = name.trim();
    const prevMatch = getPreviousStatblockForNPC(trimmedName);
    const prevChapters = getPreviousChaptersForNPC(trimmedName);

    const newChar: CharacterItem = {
      id: "char-" + Date.now(),
      name: trimmedName,
      role: prevMatch?.role || role,
      description: description.trim() || prevMatch?.description || "No character details written yet.",
      hp: prevMatch?.hp ?? 10,
      ac: prevMatch?.ac ?? 10,
      alignment: prevMatch?.alignment || "Neutral",
      strength: prevMatch?.strength ?? 10,
      dexterity: prevMatch?.dexterity ?? 10,
      constitution: prevMatch?.constitution ?? 10,
      intelligence: prevMatch?.intelligence ?? 10,
      wisdom: prevMatch?.wisdom ?? 10,
      charisma: prevMatch?.charisma ?? 10,
      skills_or_actions: prevMatch?.skills_or_actions || "No special actions declared.",
      isCustomStatsCreated: prevMatch ? (prevMatch.isCustomStatsCreated ?? true) : false,
      previousChapters: prevChapters,
    };

    onChange([...characters, newChar]);
    setName("");
    setDescription("");
    setShowAddForm(false);

    if (prevMatch) {
      setMergeSuccessMsg(`Recognized recurring NPC "${trimmedName}"! Inherited existing statblock and skills from previous chapter.`);
      setTimeout(() => setMergeSuccessMsg(null), 4500);
    }
  }

  // Action: Remove character
  function removeCharacter(id: string) {
    onChange(characters.filter((c) => c.id !== id));
  }

  // Action: Trigger AI NPC & PC Hero detection from chronicle
  async function handleAutoDetectNPCs() {
    if (!session?.summary && !session?.notes && !session?.audioTranscription) {
      setDetectionError("The chronicler requires some text (Chronicle Summary, written notes, or transcription) to analyze for NPC and Hero souls.");
      return;
    }

    setDetecting(true);
    setDetectionError(null);
    setAutoDetectSummary(null);
    try {
      const previousNPCs = getPreviousChapterNPCs();

      const res = await fetch("/api/detect-npcs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: session.summary,
          notes: session.notes,
          audioTranscription: session.audioTranscription,
          existingHeroes: (campaignHeroes || []).map((h) => ({
            name: h.name,
            level: h.level,
            magicItems: h.magicItems || [],
          })),
          previousChapterNPCs: previousNPCs,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        let displayError = errorText;
        try {
          const parsed = JSON.parse(errorText);
          displayError = parsed.error || errorText;
        } catch {
          // ignore parsing error fallbacks
        }
        throw new Error(displayError);
      }

      const data = await res.json();
      
      let gotNPCs = false;
      let gotUpdates = false;

      // 1. Process Detected NPCs
      if (data.characters && data.characters.length > 0) {
        // Map detected items with IDs and check for existing previous chapter statblocks
        const parsed: CharacterItem[] = data.characters.map((npc: any, index: number) => {
          const npcName = npc.name || "Forgotten Soul";
          const prevMatch = getPreviousStatblockForNPC(npcName);
          const prevChaps = getPreviousChaptersForNPC(npcName);

          if (prevMatch) {
            return {
              id: `detected-npc-${Date.now()}-${index}`,
              name: prevMatch.name || npcName,
              role: prevMatch.role || npc.role || "NPC Ally",
              description: npc.description || prevMatch.description || "A recurring NPC seen in campaign history.",
              hp: prevMatch.hp !== undefined ? prevMatch.hp : (npc.hp !== undefined ? Number(npc.hp) : 15),
              ac: prevMatch.ac !== undefined ? prevMatch.ac : (npc.ac !== undefined ? Number(npc.ac) : 12),
              alignment: prevMatch.alignment || npc.alignment || "Neutral",
              strength: prevMatch.strength !== undefined ? prevMatch.strength : (npc.strength !== undefined ? Number(npc.strength) : 10),
              dexterity: prevMatch.dexterity !== undefined ? prevMatch.dexterity : (npc.dexterity !== undefined ? Number(npc.dexterity) : 10),
              constitution: prevMatch.constitution !== undefined ? prevMatch.constitution : (npc.constitution !== undefined ? Number(npc.constitution) : 10),
              intelligence: prevMatch.intelligence !== undefined ? prevMatch.intelligence : (npc.intelligence !== undefined ? Number(npc.intelligence) : 10),
              wisdom: prevMatch.wisdom !== undefined ? prevMatch.wisdom : (npc.wisdom !== undefined ? Number(npc.wisdom) : 10),
              charisma: prevMatch.charisma !== undefined ? prevMatch.charisma : (npc.charisma !== undefined ? Number(npc.charisma) : 10),
              skills_or_actions: prevMatch.skills_or_actions || npc.skills_or_actions || "",
              isCustomStatsCreated: prevMatch.isCustomStatsCreated ?? true,
              previousChapters: prevChaps,
            };
          }

          return {
            id: `detected-npc-${Date.now()}-${index}`,
            name: npcName,
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
            previousChapters: prevChaps,
          };
        });
        setDetectedNPCs(parsed);
        gotNPCs = true;
      }

      // 2. Process Player Hero (PC) Updates & New Heroes automatically
      let updatedCohort = campaignHeroes ? [...campaignHeroes] : [];
      const statsFeedback: string[] = [];

      // A. Process New Heroes
      if (data.newHeroes && data.newHeroes.length > 0) {
        for (const nh of data.newHeroes) {
          const exists = updatedCohort.some(h => h.name.toLowerCase() === nh.name.toLowerCase());
          if (!exists) {
            const newId = "hero_" + Math.random().toString(36).substring(2, 11);
            const classVal = nh.classType || "Hero Character";
            const levelVal = nh.level || 1;
            const maxHpVal = nh.maxHp || 12;
            const strengthVal = nh.strength || 10;
            const dexterityVal = nh.dexterity || 10;
            const constitutionVal = nh.constitution || 10;
            const intelligenceVal = nh.intelligence || 10;
            const wisdomVal = nh.wisdom || 10;
            const charismaVal = nh.charisma || 10;
            const alignmentVal = nh.alignment || "Neutral Good";
            const magicItemsVal = nh.magicItems || [];

            const hero: HeroCharacter = {
              id: newId,
              name: nh.name,
              classType: classVal,
              level: levelVal,
              maxHp: maxHpVal,
              currentHp: maxHpVal,
              ac: nh.ac || 12,
              alignment: alignmentVal,
              strength: strengthVal,
              dexterity: dexterityVal,
              constitution: constitutionVal,
              intelligence: intelligenceVal,
              wisdom: wisdomVal,
              charisma: charismaVal,
              magicItems: magicItemsVal,
              activeStatus: "Healthy",
              history: [
                {
                  id: "hist_init_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
                  type: "level",
                  value: `Started Level ${levelVal} ${classVal}`,
                  date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                  notes: `Automatically inscribed by oracle analyzer into campaign's companion log.`
                }
              ]
            };
            updatedCohort.push(hero);
            statsFeedback.push(`🛡️ Summoned New Hero character: **${nh.name}** (Level ${levelVal} ${classVal})`);
          }
        }
      }

      // B. Process Existing Hero Updates (Level-ups, Magic Items)
      if (data.heroUpdates && data.heroUpdates.length > 0) {
        for (const up of data.heroUpdates) {
          const targetIdx = updatedCohort.findIndex(h => h.name.toLowerCase() === up.heroName.toLowerCase());
          if (targetIdx !== -1) {
            const rawHero = updatedCohort[targetIdx];
            
            if (up.type === "level") {
              const numericLevel = parseInt(up.value.replace(/\D/g, ""));
              if (!isNaN(numericLevel) && numericLevel > rawHero.level) {
                const levelDiff = numericLevel - rawHero.level;
                const conMod = Math.floor(((rawHero.constitution || 10) - 10) / 2);
                const hitDieBonus = rawHero.classType.toLowerCase().includes("wizard") || rawHero.classType.toLowerCase().includes("sorcerer") ? 4 : 6;
                const hpBoost = levelDiff * (hitDieBonus + conMod);
                
                const updatedHero: HeroCharacter = {
                  ...rawHero,
                  level: numericLevel,
                  maxHp: rawHero.maxHp + hpBoost,
                  currentHp: rawHero.currentHp + hpBoost,
                  history: [
                    ...(rawHero.history || []),
                    {
                      id: "level_up_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
                      type: "level",
                      value: `Level ${numericLevel}`,
                      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                      notes: up.notes || `Chronicle parsed level-up milestone.`
                    }
                  ]
                };
                updatedCohort[targetIdx] = updatedHero;
                statsFeedback.push(`📈 **${rawHero.name}** achieved **Level ${numericLevel}**! (*${up.notes}*)`);
              }
            } else if (up.type === "magic_item") {
              const itemClean = up.value.trim();
              const itemExists = (rawHero.magicItems || []).some(m => m.toLowerCase() === itemClean.toLowerCase());
              if (!itemExists && itemClean) {
                const updatedHero: HeroCharacter = {
                  ...rawHero,
                  magicItems: [...(rawHero.magicItems || []), itemClean],
                  history: [
                    ...(rawHero.history || []),
                    {
                      id: "magic_item_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
                      type: "magic_item",
                      value: itemClean,
                      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                      notes: up.notes || `Discovered magic relic mentioned in chronicle.`
                    }
                  ]
                };
                updatedCohort[targetIdx] = updatedHero;
                statsFeedback.push(`💎 **${rawHero.name}** attuned magic relic **${itemClean}**! (*${up.notes}*)`);
              }
            }
          }
        }
      }

      if (statsFeedback.length > 0) {
        if (onUpdateCampaignHeroes) {
          await onUpdateCampaignHeroes(updatedCohort);
        }
        setAutoDetectSummary({
          timestamp: Date.now(),
          logs: statsFeedback
        });
        gotUpdates = true;
      }

      if (!gotNPCs && !gotUpdates) {
        setDetectionError("The ether could discover no unique NPC mentions, PC level-ups, or magic relic acquisitions in this session chronicle.");
      }
    } catch (err: any) {
      console.error(err);
      const errStr = String(err.message || err).toUpperCase();
      const isTransient = errStr.includes("503") || 
                          errStr.includes("UNAVAILABLE") || 
                          errStr.includes("429") || 
                          errStr.includes("QUOTA OUT") || 
                          errStr.includes("QUOTA EXCEEDED") || 
                          errStr.includes("HIGH DEMAND") ||
                          errStr.includes("RESOURCE EXHAUSTED") ||
                          errStr.includes("TEMPORARY");
      
      if (isTransient) {
        setDetectionError("The high-tier RPG soul detector is experiencing temporary traffic spikes or quota limits (503/429). Please retry in a moment, or use manual buttons to adjust stats or add items at any time!");
      } else {
        setDetectionError(`Scan failed: ${err.message || err}`);
      }
    } finally {
      setDetecting(false);
    }
  }

  // Action: Open stats prompt form for dynamic review
  function openStatsReviewPrompt(npc: CharacterItem) {
    setIsFormForReview(true);
    setTargetNPC(npc);
    setEditName(npc.name || "");
    setEditRole(npc.role || "NPC Ally");
    setEditDescription(npc.description || "");
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
    setEditName(npc.name || "");
    setEditRole(npc.role || "NPC Ally");
    setEditDescription(npc.description || "");
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
      name: editName.trim() || targetNPC.name,
      role: editRole,
      description: editDescription.trim() || targetNPC.description,
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

          {characters.length >= 2 && (
            <button
              onClick={() => openMergeModal()}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-500/30 font-mono text-xs rounded transition cursor-pointer shadow-sm active:scale-95"
              id="btn-open-merge-npcs"
              title="Merge two duplicate NPC entries into a single soul"
            >
              <GitMerge className="w-3.5 h-3.5 text-amber-400" /> Merge NPCs
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

      {mergeSuccessMsg && (
        <div className="p-3 bg-amber-950/50 border border-amber-500/40 rounded text-amber-200 text-xs flex gap-2 items-center animate-fadeIn shadow-lg">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-sans font-medium">{mergeSuccessMsg}</span>
        </div>
      )}

      {detectionError && (
        <div className="p-3 bg-red-950/40 border border-red-900/30 rounded text-red-300 text-xs flex gap-2 items-start animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{detectionError}</span>
        </div>
      )}

      {autoDetectSummary && (
        <div className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-lg text-xs space-y-3 animate-fadeIn relative" id="ai-pc-detector-summary">
          <button 
            onClick={() => setAutoDetectSummary(null)}
            className="absolute top-3 right-3 text-zinc-500 hover:text-purple-300 font-bold text-sm cursor-pointer"
          >
            &times;
          </button>
          <div className="flex items-center gap-2 text-purple-350">
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
            <span className="font-fantasy font-bold text-sm tracking-wide uppercase">Oracle's Companion Synchronization</span>
          </div>
          <p className="text-zinc-350 font-sans leading-relaxed">
            The Oracle has parsed the session chronicle, automatically matching and synchronizing character levels, magic items, and newly discovered companions to the <strong className="text-red-400 font-fantasy uppercase tracking-wider text-[11px]">Heroes of the Realm</strong> database:
          </p>
          <div className="space-y-1.5 pl-2 border-l border-purple-500/30 font-sans">
            {autoDetectSummary.logs.map((log, idx) => (
              <div key={idx} className="text-zinc-300 flex items-start gap-1.5 leading-normal">
                <span className="text-purple-400 shrink-0">•</span>
                <span dangerouslySetInnerHTML={{ __html: log.replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-100 font-bold">$1</strong>').replace(/\*(.*?)\*/g, '<em class="text-zinc-400 italic">$1</em>') }} />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-zinc-500 font-mono flex items-center gap-2 pt-1 border-t border-zinc-800/40">
            <span>Synchronized {new Date(autoDetectSummary.timestamp).toLocaleTimeString()}</span>
            <span>•</span>
            <span className="text-purple-400">View and edit details in the "Heroes of the Realm" registry!</span>
          </p>
        </div>
      )}

      {/* 2. Detected NPCs List awaiting stats review prompting */}
      {detectedNPCs.length > 0 && (
        <div className="bg-zinc-950 p-4 border border-indigo-500/20 rounded-md space-y-3.5 animate-fadeIn" id="detected-npcs-wizard">
          <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
            <span className="text-xs font-mono font-bold text-indigo-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" /> NPC SOULS DISCOVERED ({detectedNPCs.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onChange([...characters, ...detectedNPCs]);
                  setDetectedNPCs([]);
                  setMergeSuccessMsg(`Bound ${detectedNPCs.length} detected NPC soul(s) into active campaign!`);
                  setTimeout(() => setMergeSuccessMsg(null), 4000);
                }}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[10px] rounded transition uppercase font-bold cursor-pointer"
              >
                ⚡ Accept All
              </button>
              <button
                onClick={() => setDetectedNPCs([])}
                className="text-[10px] text-zinc-500 hover:text-zinc-350 uppercase tracking-wider font-mono"
              >
                Clear Queue
              </button>
            </div>
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

                  {/* Previous Chapter Recurring badge */}
                  {(() => {
                    const prevChaps = npc.previousChapters && npc.previousChapters.length > 0
                      ? npc.previousChapters
                      : getPreviousChaptersForNPC(npc.name);
                    if (!prevChaps || prevChaps.length === 0) return null;
                    return (
                      <div className="mt-2 p-1.5 bg-amber-950/30 border border-amber-500/30 rounded text-[10px] font-sans text-amber-300 flex items-center gap-1.5">
                        <BookOpen className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>Recurring in <strong>{prevChaps.length}</strong> previous chapter(s) — Statblock & Skills Preserved!</span>
                      </div>
                    );
                  })()}
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
              <Edit className="w-4 h-4 text-red-500 animate-pulse" />
              <h4 className="font-fantasy text-zinc-100 text-sm tracking-wider uppercase">
                {isFormForReview ? "Prompt: Confirm RPG Statblock & Identity" : `Inscribe & Edit Details: ${targetNPC.name}`}
              </h4>
            </div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase">
              Target: <strong className="text-zinc-300">{targetNPC.name}</strong>
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed font-sans mt-1">
            {isFormForReview 
              ? `Please review, input or modify the identity fields and mechanical stats for ${targetNPC.name} as suggested by Gemini before committing them to the active campaign array.`
              : `Adjust the biographical fields, tactical attributes, condition parameters, and active combat stats for this soul.`}
          </p>

          {/* Core Identity Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-zinc-900/40">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase block tracking-wider">Character Name</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Name of persona..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-sans focus:border-red-500 focus:outline-none"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase block tracking-wider">Role Matrix / Disposition</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
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
            <label className="text-[10px] font-mono text-zinc-400 uppercase block tracking-wider">Biography & Personal Narratives</label>
            <textarea
              rows={2}
              required
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Short bio, goals, features, or behaviors..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-sans focus:border-red-500 focus:outline-none"
            />
          </div>

          <div className="border-t border-zinc-850 pt-3">
            <span className="text-[10px] font-mono text-zinc-500 block uppercase mb-2">RPG Combat Attributes</span>
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

      {/* 4. Merge Duplicate NPCs Modal / Dialog */}
      {isMergeModalOpen && (
        <form onSubmit={handleExecuteMerge} className="bg-zinc-950 p-5 border-2 border-amber-500/40 rounded-lg space-y-4 shadow-2xl animate-scaleIn relative" id="npc-merge-dialog">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-amber-400 animate-pulse" />
              <h4 className="font-fantasy text-zinc-100 text-sm md:text-base tracking-wider uppercase">
                🔀 MERGE DUPLICATE NPC SOULS
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsMergeModalOpen(false)}
              className="text-zinc-500 hover:text-zinc-200 text-sm font-bold p-1 cursor-pointer"
            >
              &times;
            </button>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed font-sans">
            If the Auto-Detector or manual scribe created duplicate entries for the same NPC, select both souls below to combine their lore, attributes, and combat statblocks into one unified entry.
          </p>

          {/* Selection Pickers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-900/60 p-3.5 border border-zinc-850 rounded-lg">
            {/* Primary Keeper */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block font-bold">
                1. Keeper Soul (Primary Entry)
              </label>
              <select
                value={primaryNpcId}
                onChange={(e) => handlePrimaryChange(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-sans cursor-pointer"
              >
                {characters.map((c) => (
                  <option key={c.id} value={c.id} disabled={c.id === secondaryNpcId}>
                    {c.name} ({c.role})
                  </option>
                ))}
              </select>
              {characters.find((c) => c.id === primaryNpcId) && (
                <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded text-[11px] space-y-1">
                  <div className="text-zinc-200 font-semibold">{characters.find((c) => c.id === primaryNpcId)?.name}</div>
                  <div className="text-zinc-400 text-[10px] italic line-clamp-2">"{characters.find((c) => c.id === primaryNpcId)?.description}"</div>
                </div>
              )}
            </div>

            {/* Secondary Consumed */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-amber-400 uppercase tracking-wider block font-bold">
                2. Duplicate Soul (To Be Merged & Consumed)
              </label>
              <select
                value={secondaryNpcId}
                onChange={(e) => handleSecondaryChange(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-sans cursor-pointer"
              >
                {characters.map((c) => (
                  <option key={c.id} value={c.id} disabled={c.id === primaryNpcId}>
                    {c.name} ({c.role})
                  </option>
                ))}
              </select>
              {characters.find((c) => c.id === secondaryNpcId) && (
                <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded text-[11px] space-y-1">
                  <div className="text-zinc-200 font-semibold">{characters.find((c) => c.id === secondaryNpcId)?.name}</div>
                  <div className="text-zinc-400 text-[10px] italic line-clamp-2">"{characters.find((c) => c.id === secondaryNpcId)?.description}"</div>
                </div>
              )}
            </div>
          </div>

          {/* Unified Result Configuration */}
          <div className="space-y-3 pt-2 border-t border-zinc-800">
            <h5 className="text-xs font-fantasy font-bold text-amber-400 tracking-wider uppercase">
              Unified Soul Attributes & Lore Options
            </h5>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">Unified Name</label>
                <input
                  type="text"
                  required
                  value={customMergeName}
                  onChange={(e) => setCustomMergeName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">Unified Role</label>
                <select
                  value={mergeRoleChoice}
                  onChange={(e) => setMergeRoleChoice(e.target.value)}
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
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                Combined Lore & Biography Notes
              </label>
              <textarea
                rows={3}
                value={mergedBio}
                onChange={(e) => setMergedBio(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-sans focus:border-amber-500 focus:outline-none leading-relaxed"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                Statblock Strategy
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <label className={`p-2 border rounded text-center cursor-pointer transition ${mergeStatsStrategy === "highest" ? "bg-amber-950/40 border-amber-500 text-amber-300 font-bold" : "bg-zinc-900 border-zinc-800 text-zinc-400"}`}>
                  <input
                    type="radio"
                    name="statsStrategy"
                    value="highest"
                    checked={mergeStatsStrategy === "highest"}
                    onChange={() => setMergeStatsStrategy("highest")}
                    className="sr-only"
                  />
                  ⚡ Highest Stats
                </label>
                <label className={`p-2 border rounded text-center cursor-pointer transition ${mergeStatsStrategy === "primary" ? "bg-amber-950/40 border-amber-500 text-amber-300 font-bold" : "bg-zinc-900 border-zinc-800 text-zinc-400"}`}>
                  <input
                    type="radio"
                    name="statsStrategy"
                    value="primary"
                    checked={mergeStatsStrategy === "primary"}
                    onChange={() => setMergeStatsStrategy("primary")}
                    className="sr-only"
                  />
                  🛡️ Keep Primary Stats
                </label>
                <label className={`p-2 border rounded text-center cursor-pointer transition ${mergeStatsStrategy === "secondary" ? "bg-amber-950/40 border-amber-500 text-amber-300 font-bold" : "bg-zinc-900 border-zinc-800 text-zinc-400"}`}>
                  <input
                    type="radio"
                    name="statsStrategy"
                    value="secondary"
                    checked={mergeStatsStrategy === "secondary"}
                    onChange={() => setMergeStatsStrategy("secondary")}
                    className="sr-only"
                  />
                  ⚔️ Take Secondary Stats
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                Combined Combat Skills & Actions
              </label>
              <textarea
                rows={2}
                value={mergedSkills}
                onChange={(e) => setMergedSkills(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsMergeModalOpen(false)}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold rounded transition flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
              id="btn-confirm-merge-execute"
            >
              <GitMerge className="w-3.5 h-3.5" /> Confirm & Fuse Souls
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

                  {/* Previous Campaign Chapters History */}
                  {(() => {
                    const prevChapters = char.previousChapters && char.previousChapters.length > 0
                      ? char.previousChapters
                      : getPreviousChaptersForNPC(char.name);
                    const prevStatMatch = getPreviousStatblockForNPC(char.name);

                    if (!prevChapters || prevChapters.length === 0) return null;

                    return (
                      <div className="mt-2.5 p-2 bg-amber-950/20 border border-amber-500/30 rounded text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-fantasy font-bold text-amber-400 text-[10px] sm:text-[11px] flex items-center gap-1 uppercase tracking-wide">
                            <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            Encountered in {prevChapters.length} Prior Chapter{prevChapters.length > 1 ? "s" : ""}
                          </span>
                          {prevStatMatch && (
                            <button
                              onClick={() => syncStatsFromPreviousChapter(char.id, prevStatMatch)}
                              className="px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold font-mono text-[9px] rounded transition flex items-center gap-1 cursor-pointer shadow-sm active:scale-95 shrink-0"
                              title="Sync statblock & skills from previous chapter"
                            >
                              <RefreshCw className="w-2.5 h-2.5" /> Sync Stats
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {prevChapters.map((ch) => (
                            <span key={ch.id} className="bg-zinc-950 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-sans text-amber-200/90 flex items-center gap-1">
                              <BookMarked className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                              <span className="font-semibold">{ch.title}</span>
                              {ch.date && <span className="text-zinc-500 text-[9px]">({ch.date})</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-zinc-850/50">
                  <span className="text-[9px] font-mono text-zinc-650">
                    {char.isCustomStatsCreated ? "⚔️ Statblock Synchronized" : "🛡️ Stats Unassigned"}
                  </span>
                  <div className="flex items-center gap-2">
                    {characters.length >= 2 && (
                      <button
                        onClick={() => openMergeModal(char.id)}
                        className="p-1 hover:bg-amber-950/40 text-zinc-500 hover:text-amber-400 rounded transition cursor-pointer"
                        title="Merge with another NPC entry"
                        id={`btn-merge-char-${char.id}`}
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => openStatsEditPrompt(char)}
                      className="p-1 hover:bg-zinc-850 text-zinc-500 hover:text-amber-500 rounded transition cursor-pointer"
                      title="Edit Details & RPG Statblock"
                      id={`btn-edit-char-stats-${char.id}`}
                    >
                      <Edit className="w-3.5 h-3.5" />
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
