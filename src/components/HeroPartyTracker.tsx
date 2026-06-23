import React, { useState } from "react";
import { 
  User, Plus, Trash2, Shield, Heart, Sparkles, TrendingUp, Gem, 
  ChevronRight, Edit, Save, Calendar, Award, Users, Check, X, 
  Flame, HelpCircle, Swords, Scroll, Info, AlertCircle, Link2, Globe, RefreshCw, FileText
} from "lucide-react";
import { HeroCharacter, HeroProgressionRecord, Campaign } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface HeroPartyTrackerProps {
  campaign: Campaign;
  onUpdateCampaign: (updatedCampaign: Campaign) => Promise<void>;
}

// Preset D&D classes for quick templating
const CLASS_TEMPLATES = [
  { classType: "Fighter", hp: 10, ac: 16, mainStat: "Strength", strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 12, charisma: 10, desc: "A master of martial combat, skilled with a variety of weapons and armor." },
  { classType: "Wizard", hp: 6, ac: 12, mainStat: "Intelligence", strength: 8, dexterity: 14, constitution: 12, intelligence: 16, wisdom: 12, charisma: 10, desc: "A scholarly magic-user capable of manipulating the structures of reality." },
  { classType: "Rogue", hp: 8, ac: 14, mainStat: "Dexterity", strength: 10, dexterity: 16, constitution: 12, intelligence: 12, wisdom: 10, charisma: 14, desc: "A scoundrel who uses stealth and trickery to overcome obstacles and enemies." },
  { classType: "Cleric", hp: 8, ac: 16, mainStat: "Wisdom", strength: 14, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 16, charisma: 12, desc: "A priestly champion who wields divine magic in service of a greater power." },
  { classType: "Paladin", hp: 10, ac: 18, mainStat: "Charisma", strength: 15, dexterity: 8, constitution: 14, intelligence: 10, wisdom: 12, charisma: 14, desc: "A holy warrior bound to a sacred oath, protecting allies and vanquishing evil." },
  { classType: "Barbarian", hp: 12, ac: 14, mainStat: "Strength", strength: 16, dexterity: 14, constitution: 15, intelligence: 8, wisdom: 10, charisma: 8, desc: "A fierce warrior of primitive background who can enter a battle rage." },
  { classType: "Druid", hp: 8, ac: 14, mainStat: "Wisdom", strength: 10, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 16, charisma: 10, desc: "A priest of the Old Faith, wielding the elemental powers of nature and shape." },
];

export function HeroPartyTracker({ campaign, onUpdateCampaign }: HeroPartyTrackerProps) {
  const heroesList = campaign.heroes || [];

  // Navigation / Selection States
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(
    heroesList.length > 0 ? heroesList[0].id : null
  );

  // Modal / Drawer States
  const [showAddHeroModal, setShowAddHeroModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressModalType, setProgressModalType] = useState<"level" | "magic_item">("level");

  // Add Hero form state
  const [newHeroName, setNewHeroName] = useState("");
  const [newHeroPlayer, setNewHeroPlayer] = useState("");
  const [selectedClassTemplate, setSelectedClassTemplate] = useState("Fighter");
  const [customClassType, setCustomClassType] = useState("");
  const [newHeroSubclass, setNewHeroSubclass] = useState("");
  const [newHeroLevel, setNewHeroLevel] = useState(1);
  const [newHeroAlignment, setNewHeroAlignment] = useState("Neutral Good");
  const [newHeroStatus, setNewHeroStatus] = useState("Healthy");

  // Advanced Stats Toggle
  const [useCustomStats, setUseCustomStats] = useState(false);
  // Manual Attribute Scores (Optional block)
  const [newStr, setNewStr] = useState(10);
  const [newDex, setNewDex] = useState(10);
  const [newCon, setNewCon] = useState(10);
  const [newInt, setNewInt] = useState(10);
  const [newWis, setNewWis] = useState(10);
  const [newCha, setNewCha] = useState(10);

  // Edit states for selected hero
  const [isEditingState, setIsEditingState] = useState(false);
  const [editHeroName, setEditHeroName] = useState("");
  const [editPlayerName, setEditPlayerName] = useState("");
  const [editClassType, setEditClassType] = useState("");
  const [editSubclass, setEditSubclass] = useState("");
  const [editLevel, setEditLevel] = useState(1);
  const [editMaxHp, setEditMaxHp] = useState(10);
  const [editCurrentHp, setEditCurrentHp] = useState(10);
  const [editAc, setEditAc] = useState(10);
  const [editAlignment, setEditAlignment] = useState("Neutral Good");
  const [editStatus, setEditStatus] = useState("Healthy");
  const [editPassivePerc, setEditPassivePerc] = useState(10);
  const [editStr, setEditStr] = useState(10);
  const [editDex, setEditDex] = useState(10);
  const [editCon, setEditCon] = useState(10);
  const [editInt, setEditInt] = useState(10);
  const [editWis, setEditWis] = useState(10);
  const [editCha, setEditCha] = useState(10);
  const [editMagicItems, setEditMagicItems] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Add progression state
  const [progressValue, setProgressValue] = useState("");
  const [progressNotes, setProgressNotes] = useState("");
  const [progressDate, setProgressDate] = useState(new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));

  // D&D Beyond Integration States
  const [dndBeyondUrl, setDndBeyondUrl] = useState(campaign.dndBeyondUrl || "");
  const [pastedHtml, setPastedHtml] = useState("");
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  const [dndSyncLoading, setDndSyncLoading] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncNotes, setSyncNotes] = useState<string | null>(campaign.dndBeyondNotes || null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);

  // Derive state reset when active campaign changes
  const [currentCampaignId, setCurrentCampaignId] = useState(campaign.id);
  if (campaign.id !== currentCampaignId) {
    setCurrentCampaignId(campaign.id);
    setDndBeyondUrl(campaign.dndBeyondUrl || "");
    setSyncNotes(campaign.dndBeyondNotes || null);
    setPastedHtml("");
    setSyncLogs([]);
    setSyncError(null);
    setSyncSuccessMessage(null);
    setShowPasteFallback(false);
  }

  // Helper inside Component to track updated campaigns
  async function updateHeroes(updatedList: HeroCharacter[]) {
    const updatedCamp: Campaign = {
      ...campaign,
      heroes: updatedList,
      updatedAt: new Date().toISOString()
    };
    await onUpdateCampaign(updatedCamp);
  }

  // Handle Adding new Hero
  function handleAddHero(e: React.FormEvent) {
    e.preventDefault();
    if (!newHeroName.trim()) return;

    // Use selected template or manual
    const template = CLASS_TEMPLATES.find(c => c.classType === selectedClassTemplate);
    const resolvedClass = selectedClassTemplate === "Custom" ? customClassType.trim() : selectedClassTemplate;

    let baseHp = 10;
    let baseAc = 10;
    let resolvedStr = newStr;
    let resolvedDex = newDex;
    let resolvedCon = newCon;
    let resolvedInt = newInt;
    let resolvedWis = newWis;
    let resolvedCha = newCha;

    if (template && selectedClassTemplate !== "Custom") {
      baseHp = template.hp + Math.floor((template.constitution - 10) / 2); // default HP at level 1
      baseAc = template.ac;
      resolvedStr = template.strength;
      resolvedDex = template.dexterity;
      resolvedCon = template.constitution;
      resolvedInt = template.intelligence;
      resolvedWis = template.wisdom;
      resolvedCha = template.charisma;
    }

    // Multiply default HP per level
    if (newHeroLevel > 1) {
      const avgHitDie = template ? Math.ceil(template.hp / 2) + 1 : 6;
      baseHp += (newHeroLevel - 1) * (avgHitDie + Math.floor((resolvedCon - 10) / 2));
    }

    const calculatedPassive = 10 + Math.floor((resolvedWis - 10) / 2);

    const newHero: HeroCharacter = {
      id: "hero_" + Math.random().toString(36).substr(2, 9),
      name: newHeroName.trim(),
      playerName: newHeroPlayer.trim() || undefined,
      classType: resolvedClass || "Hero Adventurer",
      subclass: newHeroSubclass.trim() || undefined,
      level: newHeroLevel,
      maxHp: baseHp,
      currentHp: baseHp,
      ac: baseAc,
      alignment: newHeroAlignment,
      activeStatus: newHeroStatus,
      passivePerception: calculatedPassive,
      strength: resolvedStr,
      dexterity: resolvedDex,
      constitution: resolvedCon,
      intelligence: resolvedInt,
      wisdom: resolvedWis,
      charisma: resolvedCha,
      magicItems: [],
      history: [
        {
          id: "hist_init",
          type: "level",
          value: `Started Legend at Level ${newHeroLevel}`,
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          notes: `Joined the Campaign of ${campaign.name} as a ${resolvedClass}!`
        }
      ]
    };

    const updated = [...heroesList, newHero];
    updateHeroes(updated).then(() => {
      setSelectedHeroId(newHero.id);
      // Reset state
      setNewHeroName("");
      setNewHeroPlayer("");
      setNewHeroSubclass("");
      setNewHeroLevel(1);
      setShowAddHeroModal(false);
    });
  }

  // Get currently selected PC
  const currentHero = heroesList.find(h => h.id === selectedHeroId) || null;

  // Trigger quick edit fields
  function startEditing() {
    if (!currentHero) return;
    setEditHeroName(currentHero.name);
    setEditPlayerName(currentHero.playerName || "");
    setEditClassType(currentHero.classType);
    setEditSubclass(currentHero.subclass || "");
    setEditLevel(currentHero.level);
    setEditMaxHp(currentHero.maxHp);
    setEditCurrentHp(currentHero.currentHp);
    setEditAc(currentHero.ac);
    setEditAlignment(currentHero.alignment || "Neutral");
    setEditStatus(currentHero.activeStatus || "Healthy");
    setEditPassivePerc(currentHero.passivePerception || 10);
    setEditStr(currentHero.strength || 10);
    setEditDex(currentHero.dexterity || 10);
    setEditCon(currentHero.constitution || 10);
    setEditInt(currentHero.intelligence || 10);
    setEditWis(currentHero.wisdom || 10);
    setEditCha(currentHero.charisma || 10);
    setEditMagicItems([...(currentHero.magicItems || [])]);
    setIsEditingState(true);
  }

  // Cancel edits
  function cancelEditing() {
    setIsEditingState(false);
  }

  // Save current Hero structural updates
  function handleSaveHeroEdits() {
    if (!currentHero) return;
    
    // Check if level has changed to automatically inject progression
    const changes: HeroProgressionRecord[] = [];
    if (editLevel !== currentHero.level) {
      changes.push({
        id: "level_up_" + Date.now(),
        type: "level",
        value: `Level ${editLevel}`,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        notes: `Adjusted DM attributes. Traveled from Level ${currentHero.level} to ${editLevel}!`
      });
    }

    const updatedHero: HeroCharacter = {
      ...currentHero,
      name: editHeroName.trim() || currentHero.name,
      playerName: editPlayerName.trim() || undefined,
      classType: editClassType.trim() || currentHero.classType,
      subclass: editSubclass.trim() || undefined,
      level: editLevel,
      maxHp: editMaxHp,
      currentHp: Math.min(editCurrentHp, editMaxHp),
      ac: editAc,
      alignment: editAlignment,
      activeStatus: editStatus,
      passivePerception: editPassivePerc,
      strength: editStr,
      dexterity: editDex,
      constitution: editCon,
      intelligence: editInt,
      wisdom: editWis,
      charisma: editCha,
      magicItems: editMagicItems,
      history: [...currentHero.history, ...changes]
    };

    const updated = heroesList.map(h => h.id === currentHero.id ? updatedHero : h);
    updateHeroes(updated).then(() => {
      setIsEditingState(false);
    });
  }

  // Quick adjust HP slider or buttons
  function adjustHp(amount: number) {
    if (!currentHero) return;
    const nextCurrent = Math.max(0, Math.min(currentHero.maxHp, currentHero.currentHp + amount));
    const updatedHero = {
      ...currentHero,
      currentHp: nextCurrent,
      activeStatus: nextCurrent === 0 ? "Unconscious" : currentHero.activeStatus === "Unconscious" ? "Healthy" : currentHero.activeStatus
    };
    const updated = heroesList.map(h => h.id === currentHero.id ? updatedHero : h);
    updateHeroes(updated);
  }

  // Remove hero character permanently
  function handleDeleteHero(heroId: string) {
    const updated = heroesList.filter(h => h.id !== heroId);
    updateHeroes(updated).then(() => {
      if (selectedHeroId === heroId) {
        setSelectedHeroId(updated.length > 0 ? updated[0].id : null);
      }
      setShowDeleteConfirm(false);
    });
  }

  // Synchronize campaign characters & notes with D&D Beyond API endpoint
  async function performDndBeyondSync(targetUrl: string, rawHtml?: string) {
    setDndSyncLoading(true);
    setSyncError(null);
    setSyncSuccessMessage(null);
    setSyncLogs([]);

    try {
      const payload: any = {};
      if (rawHtml) {
        payload.pastedHtml = rawHtml;
      } else {
        payload.campaignUrl = targetUrl;
      }

      console.log("[DND Beyond Link Sync] Submitting parse request...", targetUrl);
      const response = await fetch("/api/parse-dndbeyond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Oracle server responded with status: ${response.status}`);
      }

      const parsedData = await response.json();

      if (parsedData.fallbackNeeded) {
        setSyncError(parsedData.message);
        setShowPasteFallback(true);
        setDndSyncLoading(false);
        return;
      }

      // Check if we retrieved characters
      const characters = parsedData.characters || [];
      const logs: string[] = [];
      let updatedHeroes = [...heroesList];

      for (const pc of characters) {
        const existingIndex = updatedHeroes.findIndex(h => h.name.toLowerCase() === pc.name.toLowerCase());
        
        if (existingIndex !== -1) {
          const orig = updatedHeroes[existingIndex];
          const syncId = "sync_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5);
          
          const updatesDesc: string[] = [];
          if (orig.level !== pc.level) {
            updatesDesc.push(`Level advanced: ${orig.level} -> ${pc.level}`);
          }
          if (orig.maxHp !== pc.maxHp) {
            updatesDesc.push(`Max HP adjusted: ${orig.maxHp} -> ${pc.maxHp}`);
          }
          if (orig.ac !== pc.ac) {
            updatesDesc.push(`Armor Class updated: ${orig.ac} -> ${pc.ac}`);
          }

          // merge magic items
          const existingItemsLower = (orig.magicItems || []).map(i => i.toLowerCase());
          const newItems = (pc.magicItems || []).filter((item: string) => !existingItemsLower.includes(item.toLowerCase()));
          if (newItems.length > 0) {
            updatesDesc.push(`Attuned magic relics: ${newItems.join(", ")}`);
          }

          const mergedItems = [...(orig.magicItems || []), ...newItems];

          const updatedHero: HeroCharacter = {
            ...orig,
            classType: pc.classType || orig.classType,
            level: pc.level || orig.level,
            maxHp: pc.maxHp || orig.maxHp,
            currentHp: pc.maxHp || orig.currentHp,
            ac: pc.ac || orig.ac,
            alignment: pc.alignment || orig.alignment || "Neutral",
            playerName: pc.playerName && pc.playerName !== "N/A" ? pc.playerName : orig.playerName || "Companion",
            strength: pc.strength || orig.strength || 10,
            dexterity: pc.dexterity || orig.dexterity || 10,
            constitution: pc.constitution || orig.constitution || 10,
            intelligence: pc.intelligence || orig.intelligence || 10,
            wisdom: pc.wisdom || orig.wisdom || 10,
            charisma: pc.charisma || orig.charisma || 10,
            magicItems: mergedItems,
            history: [
              ...(orig.history || []),
              {
                id: syncId,
                type: "level",
                value: `D&D Beyond Sync (Level ${pc.level} ${pc.classType})`,
                date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                notes: updatesDesc.length > 0 
                  ? `Synced stats: ${updatesDesc.join("; ")}`
                  : "Verified companion properties against active D&D Beyond roster; aligned and healthy."
              }
            ]
          };

          updatedHeroes[existingIndex] = updatedHero;
          logs.push(`🛡️ Aligned **${pc.name}** (Level ${pc.level} ${pc.classType})${updatesDesc.length > 0 ? ` - *Updates*: ${updatesDesc.join(", ")}` : " - *Unchanged*"}`);
        } else {
          // Add new hero character completely
          const newId = "hero_" + Math.random().toString(36).substring(2, 11);
          const syncId = "sync_init_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5);
          
          const newHero: HeroCharacter = {
            id: newId,
            name: pc.name,
            classType: pc.classType || "Fighter",
            level: pc.level || 1,
            maxHp: pc.maxHp || 10,
            currentHp: pc.maxHp || 10,
            ac: pc.ac || 10,
            alignment: pc.alignment || "Neutral",
            playerName: pc.playerName && pc.playerName !== "N/A" ? pc.playerName : "Companion",
            strength: pc.strength || 10,
            dexterity: pc.dexterity || 10,
            constitution: pc.constitution || 10,
            intelligence: pc.intelligence || 10,
            wisdom: pc.wisdom || 10,
            charisma: pc.charisma || 10,
            magicItems: pc.magicItems || [],
            activeStatus: "Healthy",
            history: [
              {
                id: syncId,
                type: "level",
                value: `Imported Level ${pc.level} ${pc.classType}`,
                date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                notes: "Companion created and stats populated from linked D&D Beyond campaign roster."
              }
            ]
          };

          updatedHeroes.push(newHero);
          logs.push(`✨ Imported **${pc.name}** (Level ${pc.level} ${pc.classType}) as a new Heroes of the Realm companion!`);
          if (pc.magicItems && pc.magicItems.length > 0) {
            logs.push(`   *Magic treasures linked*: ${pc.magicItems.join(", ")}`);
          }
        }
      }

      // Update parent Campaign
      const updatedCamp: Campaign = {
        ...campaign,
        name: parsedData.campaignName || campaign.name,
        description: parsedData.description && parsedData.description !== "N/A" ? parsedData.description : campaign.description,
        dndBeyondUrl: targetUrl,
        dndBeyondNotes: parsedData.notes && parsedData.notes !== "N/A" ? parsedData.notes : campaign.dndBeyondNotes,
        heroes: updatedHeroes,
        updatedAt: new Date().toISOString()
      };

      await onUpdateCampaign(updatedCamp);
      setSyncNotes(parsedData.notes && parsedData.notes !== "N/A" ? parsedData.notes : null);
      setSyncSuccessMessage(`Successfully synchronized with campaign "${parsedData.campaignName || campaign.name}"!`);
      setSyncLogs(logs);
      setPastedHtml("");
      setShowPasteFallback(false);

      // Select first hero if none was elected yet
      if (updatedHeroes.length > 0) {
        setSelectedHeroId(updatedHeroes[0].id);
      }
    } catch (err: any) {
      console.error("[DND Beyond Link Sync] Sync task failed:", err);
      setSyncError(`Failed to synchronize with campaign: ${err.message || err}. Ensure you pasted valid HTML page source if using manual synchronization.`);
    } finally {
      setDndSyncLoading(false);
    }
  }

  // Trigger sync via URL
  async function handleSyncDndBeyond() {
    if (!dndBeyondUrl.trim()) {
      setSyncError("Please supply a valid D&D Beyond campaign URL (e.g. https://www.dndbeyond.com/campaigns/123456).");
      return;
    }
    await performDndBeyondSync(dndBeyondUrl.trim());
  }

  // Trigger sync via pasted HTML
  async function handleSyncWithPastedHtml() {
    if (!pastedHtml.trim()) {
      setSyncError("Roster scroll is barren. Please paste your campaign webpage source HTML first.");
      return;
    }
    await performDndBeyondSync(dndBeyondUrl.trim() || "https://www.dndbeyond.com/campaigns/pasted-source", pastedHtml);
  }

  // Sever the tie / disconnect from D&D Beyond
  async function handleDisconnectDndBeyond() {
    setDndSyncLoading(true);
    try {
      const updatedCamp: Campaign = {
        ...campaign,
        dndBeyondUrl: "",
        dndBeyondNotes: "",
        updatedAt: new Date().toISOString()
      };
      await onUpdateCampaign(updatedCamp);
      setDndBeyondUrl("");
      setSyncNotes(null);
      setSyncSuccessMessage(null);
      setSyncError(null);
      setSyncLogs([]);
    } catch (err: any) {
      console.error(err);
      setSyncError("Unlinking campaign failed.");
    } finally {
      setDndSyncLoading(false);
    }
  }

  // Handle adding custom level or magic item progression
  function handleAddProgression(e: React.FormEvent) {
    e.preventDefault();
    if (!currentHero || !progressValue.trim()) return;

    const newRecord: HeroProgressionRecord = {
      id: "prog_" + Date.now(),
      type: progressModalType,
      value: progressValue.trim(),
      date: progressDate,
      notes: progressNotes.trim() || "Chronicle documented by the Dungeon Master."
    };

    // Update active attributes
    let updatedMagicItems = [...(currentHero.magicItems || [])];
    let updatedLevel = currentHero.level;
    let updatedMaxHp = currentHero.maxHp;

    if (progressModalType === "magic_item") {
      updatedMagicItems.push(progressValue.trim());
    } else if (progressModalType === "level") {
      // Find numeric level to set if any
      const levelNum = parseInt(progressValue.replace(/\D/g, ""));
      if (!isNaN(levelNum) && levelNum > 0) {
        updatedLevel = levelNum;
        // Offer proportional bonus HP
        const conMod = Math.floor(((currentHero.constitution || 10) - 10) / 2);
        const hpDiff = (levelNum - currentHero.level) * (6 + conMod);
        if (hpDiff > 0) {
          updatedMaxHp += hpDiff;
        }
      }
    }

    const updatedHero: HeroCharacter = {
      ...currentHero,
      level: updatedLevel,
      maxHp: updatedMaxHp,
      currentHp: updatedLevel !== currentHero.level ? updatedMaxHp : currentHero.currentHp,
      magicItems: updatedMagicItems,
      history: [...(currentHero.history || []), newRecord]
    };

    const updated = heroesList.map(h => h.id === currentHero.id ? updatedHero : h);
    updateHeroes(updated).then(() => {
      // Reset
      setProgressValue("");
      setProgressNotes("");
      setShowProgressModal(false);
    });
  }

  // Delete progression record
  function handleRemoveProgression(recordId: string) {
    if (!currentHero) return;
    
    const targetRecord = currentHero.history.find(r => r.id === recordId);
    if (!targetRecord) return;

    let updatedMagicItems = [...(currentHero.magicItems || [])];
    if (targetRecord.type === "magic_item") {
      // Remove first occurrence of this item from inventory representation
      const idx = updatedMagicItems.indexOf(targetRecord.value);
      if (idx !== -1) {
        updatedMagicItems.splice(idx, 1);
      }
    }

    const updatedHero = {
      ...currentHero,
      magicItems: updatedMagicItems,
      history: currentHero.history.filter(r => r.id !== recordId)
    };

    const updated = heroesList.map(h => h.id === currentHero.id ? updatedHero : h);
    updateHeroes(updated);
  }

  // Remove a magic item directly
  function handleRemoveMagicItemDirectly(itemValue: string) {
    if (!currentHero) return;
    const updatedMagicItems = currentHero.magicItems.filter(i => i !== itemValue);
    
    // Add progression log about missing item
    const exitRecord: HeroProgressionRecord = {
      id: "prog_lost_" + Date.now(),
      type: "magic_item",
      value: `Lost/Donated: ${itemValue}`,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      notes: "Attunement severed or magic item removed from active player equipment list."
    };

    const updatedHero = {
      ...currentHero,
      magicItems: updatedMagicItems,
      history: [...currentHero.history, exitRecord]
    };

    const updated = heroesList.map(h => h.id === currentHero.id ? updatedHero : h);
    updateHeroes(updated);
  }

  return (
    <div className="space-y-6" id="hero-party-tracker-root">
      
      {/* D&D BEYOND CAMPAIGN REALM LINKER */}
      <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-5 space-y-4 shadow-2xl relative overflow-hidden" id="dndbeyond-linker-panel">
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-zinc-850 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20">
              <Link2 className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <h3 className="text-sm font-fantasy font-extrabold tracking-wider text-zinc-100 uppercase flex items-center gap-2">
                D&D Beyond Campaign Linker
              </h3>
              <p className="text-[10px] font-mono text-zinc-500">
                Synchronize player characters, active stats & DM chronicle scrolls
              </p>
            </div>
          </div>
          
          {campaign.dndBeyondUrl && (
            <span className="inline-flex self-start sm:self-center items-center gap-1.5 px-2.5 py-1 bg-emerald-950/40 border border-emerald-500/25 text-[10px] font-mono text-emerald-400 rounded-full select-none">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              Connected Campaign Link Active
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-8 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <Globe className="w-4 h-4" />
              </div>
              <input
                type="text"
                id="dndbeyond-url-input"
                placeholder="Paste D&D Beyond campaign link (e.g. https://www.dndbeyond.com/campaigns/1234567)"
                value={dndBeyondUrl}
                onChange={(e) => setDndBeyondUrl(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-100 focus:border-red-500 focus:outline-none placeholder:text-zinc-650 font-sans"
              />
            </div>
            <div className="md:col-span-4 flex gap-2">
              <button
                onClick={handleSyncDndBeyond}
                disabled={dndSyncLoading}
                className="flex-1 py-2 bg-red-650 hover:bg-red-700 disabled:bg-zinc-900 disabled:text-zinc-600 border border-red-500/30 text-zinc-100 text-xs font-mono font-bold tracking-wider rounded-lg shadow-md cursor-pointer transition duration-150 flex items-center justify-center gap-1.5"
              >
                {dndSyncLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                {campaign.dndBeyondUrl ? "Re-Sync Roster" : "Gather Companions"}
              </button>
              
              {campaign.dndBeyondUrl && (
                <button
                  onClick={handleDisconnectDndBeyond}
                  disabled={dndSyncLoading}
                  className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-850 hover:text-red-400 text-zinc-400 text-xs font-mono border border-zinc-800 rounded-lg cursor-pointer transition duration-150"
                  title="Disconnect Campaign Link"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {/* Sync Failures & Fallback Paste Container */}
          {syncError && (
            <div className="p-4 bg-red-950/20 border border-red-500/20 rounded-lg text-xs space-y-2.5 animate-fadeIn">
              <div className="flex items-start gap-2.5 text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <div className="space-y-1">
                  <p className="font-semibold uppercase tracking-wider font-fantasy">Automated Scribe Blocked</p>
                  <p className="text-zinc-350 font-sans leading-relaxed">{syncError}</p>
                </div>
              </div>
              {!showPasteFallback && (
                <div className="pt-1.5">
                  <button
                    onClick={() => {
                      setShowPasteFallback(true);
                      setSyncError(null);
                    }}
                    className="px-3 py-1.5 bg-red-950/40 hover:bg-red-950 border border-red-500/30 text-red-300 rounded font-mono text-[10px] cursor-pointer"
                  >
                    Bypass with Direct Web Source Paste &rarr;
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Paste source fallback panel */}
          {(showPasteFallback || !campaign.dndBeyondUrl) && (
            <div className="p-4 bg-zinc-950/80 border border-zinc-850 rounded-lg space-y-3.5 font-sans">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold tracking-widest flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-400 animate-pulse" /> Manual Webpage Source Synclink
                </span>
                <span className="text-[9px] font-mono text-zinc-500 italic">Cloudflare Bypass Mode</span>
              </div>
              <div className="text-[11px] text-zinc-400 font-sans space-y-1.5 leading-relaxed p-3 bg-zinc-950/40 border border-zinc-900 rounded-lg">
                <p>
                  D&D Beyond campaign dashboards are sometimes shielded by secure credentials or anti-bot protections. Follow these simple steps to import instantly:
                </p>
                <ol className="list-decimal pl-5 space-y-1 text-zinc-400">
                  <li>Open your campaign page on <strong className="text-zinc-200">dndbeyond.com</strong> in a new browser tab.</li>
                  <li>Right-click anywhere on the campaign dashboard and select <strong className="text-zinc-200">"View Page Source"</strong> (or press <kbd className="bg-zinc-850 text-zinc-300 px-1 py-0.5 rounded text-[10px] font-mono">Ctrl + U</kbd> / <kbd className="bg-zinc-850 text-zinc-300 px-1 py-0.5 rounded text-[10px] font-mono">Cmd + U</kbd>).</li>
                  <li>Select everything with <kbd className="bg-zinc-850 text-zinc-300 px-1 py-0.5 rounded text-[10px] font-mono">Ctrl + A</kbd>, copy it, and paste it fully in the vessel below.</li>
                </ol>
              </div>
              <textarea
                id="dnd-pasted-html-textarea"
                placeholder="Paste the full raw webpage source HTML starting with <!DOCTYPE html> here..."
                value={pastedHtml}
                onChange={(e) => setPastedHtml(e.target.value)}
                className="w-full h-28 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-[10px] font-mono text-zinc-300 focus:border-purple-500 focus:outline-none placeholder:text-zinc-705 leading-normal"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSyncWithPastedHtml}
                  disabled={!pastedHtml.trim() || dndSyncLoading}
                  className="px-4 py-2 bg-purple-900/40 hover:bg-purple-900 disabled:bg-zinc-900 disabled:text-zinc-600 text-purple-200 border border-purple-550 hover:border-purple-500/40 text-xs font-mono font-bold tracking-wider rounded-lg cursor-pointer transition duration-150 flex items-center gap-1.5 select-none"
                >
                  {dndSyncLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  )}
                  Synthesize Copied Source
                </button>
                {showPasteFallback && (
                  <button
                    type="button"
                    onClick={() => setShowPasteFallback(false)}
                    className="px-3.5 py-2 text-zinc-500 hover:text-zinc-300 text-xs font-mono transition"
                  >
                    Hide Paste Shield
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Alignment Details & Logs */}
          {syncSuccessMessage && (
            <div className="p-4 bg-emerald-950/20 border border-emerald-500/25 rounded-lg text-xs space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-emerald-400">
                <Check className="w-4 h-4 text-emerald-500 animate-bounce" />
                <span className="font-fantasy font-black tracking-widest text-sm uppercase">Synchronized Campaign Roster Aligned!</span>
              </div>
              <p className="text-zinc-300 font-sans leading-normal">
                {syncSuccessMessage}
              </p>
              {syncLogs.length > 0 && (
                <div className="space-y-1.5 pl-3 border-l-2 border-emerald-500/35 font-sans text-xs">
                  {syncLogs.map((log, idx) => (
                    <p key={idx} className="text-zinc-350 leading-relaxed" dangerouslySetInnerHTML={{ __html: log.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sync Notes */}
          {syncNotes && syncNotes !== "N/A" && (
            <div className="p-4 bg-zinc-950/60 border border-zinc-850 rounded-lg space-y-2">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-extrabold block">📖 DM Campaign Notes & Scrolls</span>
              <div className="text-zinc-300 font-sans text-xs whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto pr-1">
                {syncNotes}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 1. COMPOSITE PARTY OVERVIEW STATS BOARD */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900/60 p-4 border border-zinc-800 rounded-lg flex items-center gap-3.5 shadow-lg">
          <div className="p-2.5 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Party Size</div>
            <div className="text-xl font-fantasy font-black text-zinc-100 tracking-wide">
              {heroesList.length} {heroesList.length === 1 ? "Soul" : "Active Heroes"}
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/60 p-4 border border-zinc-800 rounded-lg flex items-center gap-3.5 shadow-lg">
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Average Level</div>
            <div className="text-xl font-fantasy font-black text-zinc-100 tracking-wide">
              Level {heroesList.length > 0 
                ? (heroesList.reduce((acc, h) => acc + h.level, 0) / heroesList.length).toFixed(1)
                : "0"}
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/60 p-4 border border-zinc-800 rounded-lg flex items-center gap-3.5 shadow-lg">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Companions Alive</div>
            <div className="text-xl font-fantasy font-black text-zinc-100 tracking-wide">
              {heroesList.filter(h => h.currentHp > 0).length} / {heroesList.length} Stable
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/60 p-4 border border-zinc-800 rounded-lg flex items-center gap-3.5 shadow-lg">
          <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/20">
            <Gem className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Legendary Treasures</div>
            <div className="text-xl font-fantasy font-black text-zinc-100 tracking-wide">
              {heroesList.reduce((acc, h) => acc + (h.magicItems?.length || 0), 0)} Attuned
            </div>
          </div>
        </div>
      </div>

      {/* 2. THE PARTY SPLIT-GRID VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Party Roster Selection List (lg:col-span-4) */}
        <div className="lg:col-span-4 bg-zinc-950 p-4 border border-zinc-850 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase text-zinc-400 tracking-widest flex items-center gap-1.5 font-bold">
              <Flame className="w-4 h-4 text-red-500 animate-pulse" /> Active Companion Roster
            </h3>
            <button
              onClick={() => {
                setNewHeroName("");
                setSelectedClassTemplate("Fighter");
                setShowAddHeroModal(true);
              }}
              className="px-2 py-1 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-zinc-950 border border-red-500/30 rounded text-[10px] font-mono tracking-widest transition flex items-center gap-1 cursor-pointer"
              id="btn-summon-pc-hero"
            >
              <Plus className="w-3.5 h-3.5" /> ADD HERO
            </button>
          </div>

          {heroesList.length === 0 ? (
            <div className="py-12 px-4 border border-dashed border-zinc-850 rounded-lg text-center space-y-2.5">
              <Users className="w-8 h-8 text-zinc-650 mx-auto animate-bounce animate-duration-3000" />
              <p className="text-xs text-zinc-500 leading-normal font-sans italic">
                No active player characters inscribed in the war scroll for this campaign. Add your first Hero (PC) to track their hit points, attuned relics, and high milestones!
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {heroesList.map((hero) => {
                const isSelected = selectedHeroId === hero.id;
                const hpPercentage = Math.round((hero.currentHp / hero.maxHp) * 100) || 0;
                
                return (
                  <div
                    key={hero.id}
                    onClick={() => {
                      setSelectedHeroId(hero.id);
                      setIsEditingState(false);
                      setShowDeleteConfirm(false);
                    }}
                    className={`p-3 rounded border text-left cursor-pointer transition relative overflow-hidden flex items-center justify-between ${
                      isSelected
                        ? "bg-red-500/5 border-red-500/40 text-red-400 shadow-md"
                        : "bg-zinc-900/30 border-zinc-900 hover:bg-zinc-900/70 hover:border-zinc-800 text-zinc-300"
                    }`}
                  >
                    {/* Background damage indicator/shading */}
                    <div 
                      className={`absolute left-0 bottom-0 top-0 transition-all duration-350 -z-10 ${
                        hpPercentage > 50 
                          ? "bg-emerald-500/5" 
                          : hpPercentage > 20 
                            ? "bg-amber-500/5" 
                            : "bg-red-500/5"
                      }`}
                      style={{ width: `${hpPercentage}%` }}
                    />
                    
                    <div className="min-w-0 pr-2 space-y-1 z-10">
                      <div className="flex items-center gap-1.5">
                        <User className={`w-3.5 h-3.5 ${isSelected ? "text-red-400" : "text-zinc-500"}`} />
                        <h4 className="font-fantasy font-bold text-xs md:text-sm tracking-wide truncate">
                          {hero.name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                        <span className="text-zinc-400">Lv {hero.level} {hero.classType}</span>
                        <span>•</span>
                        <span className="font-bold text-zinc-550">{hero.playerName || "NPC/Dungeon"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2shrink-0 z-10 text-right">
                      <div className="space-y-0.5 text-right">
                        <div className="text-[10px] font-mono font-bold text-zinc-300">
                          HP {hero.currentHp}/{hero.maxHp}
                        </div>
                        <div className="w-14 bg-zinc-800 h-1.5 rounded-full overflow-hidden border border-zinc-950/20">
                          <div
                            className={`h-full transition-all duration-350 ${
                              hpPercentage > 50 
                                ? "bg-emerald-500" 
                                : hpPercentage > 20 
                                  ? "bg-amber-500" 
                                  : "bg-red-500 animate-pulse"
                            }`}
                            style={{ width: `${hpPercentage}%` }}
                          />
                        </div>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 transition ${isSelected ? "text-red-400 translate-x-0.5" : "text-zinc-600"}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Hero Detail Card, Active Stats Panel, Magic Items, and Progression Timeline (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6">
          {currentHero ? (
            <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-5 space-y-6 shadow-xl relative overflow-hidden" id="hero-detail-workspace">
              
              {/* Custom Inline Confirmation Overlay to bypass iframe dialog blocks */}
              <AnimatePresence>
                {showDeleteConfirm && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 bg-red-950/40 border border-red-500/40 rounded-lg text-xs space-y-3 animate-fadeIn relative z-10"
                    id="hero-deletion-confirm-panel"
                  >
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />
                      <span className="font-fantasy font-bold text-sm tracking-wide uppercase">Vanish Legendary Hero?</span>
                    </div>
                    <p className="text-zinc-350 font-sans leading-relaxed">
                      Are you absolute certain you wish to delete <strong className="text-zinc-100">{currentHero.name}</strong>? This action is permanent and will remove them from the companion records of this campaign forever.
                    </p>
                    <div className="flex gap-2 pt-1.5 align-baseline">
                      <button
                        onClick={() => handleDeleteHero(currentHero.id)}
                        className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-zinc-950 font-bold hover:text-zinc-100 rounded text-xs transition duration-150 cursor-pointer"
                        id="btn-confirm-delete-hero"
                      >
                        Confirm Permanent Deletion
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-xs border border-zinc-800 transition duration-150 cursor-pointer"
                        id="btn-cancel-delete-hero"
                      >
                        Nevermind, Keep
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* HEADER CAPPTION */}
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-zinc-850 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-zinc-550 font-mono text-[10px] uppercase font-bold tracking-widest leading-none">
                    <Scroll className="w-3 h-3 text-red-500/80" /> Chronicles of Heroic Sovereignty
                  </div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h2 className="font-fantasy font-black text-xl md:text-2xl text-zinc-100 tracking-wider uppercase leading-none">
                      {currentHero.name}
                    </h2>
                    {currentHero.subclass && (
                      <span className="text-xs text-red-400 font-sans italic">
                        ({currentHero.subclass})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400 font-sans">
                    <span className="font-medium">Level {currentHero.level} {currentHero.classType}</span>
                    <span className="text-zinc-700">•</span>
                    <span>Player: <span className="font-bold text-zinc-300">{currentHero.playerName || "The Companion"}</span></span>
                    {currentHero.alignment && (
                      <>
                        <span className="text-zinc-700">•</span>
                        <span className="text-zinc-500 text-[11px]">{currentHero.alignment}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2shrink-0 self-start md:self-center">
                  {!isEditingState ? (
                    <>
                      <button
                        onClick={startEditing}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-red-400 rounded text-xs font-sans transition flex items-center gap-1 cursor-pointer"
                        id="btn-edit-hero-trigger"
                      >
                        <Edit className="w-3.5 h-3.5" /> Adjust Profile
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-1.5 hover:bg-red-950/45 text-zinc-600 hover:text-red-400 rounded transition border border-zinc-900 cursor-pointer"
                        title="Vanish Hero from Realm"
                        id="btn-delete-hero-trigger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleSaveHeroEdits}
                        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-zinc-950 rounded text-xs font-bold font-sans transition flex items-center gap-1 cursor-pointer"
                        id="btn-save-hero-trigger"
                      >
                        <Save className="w-3.5 h-3.5" /> Save Changes
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 rounded text-xs font-sans transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* DYNAMIC FORM OR ATTRIBUTE VISUALIZER */}
              {isEditingState ? (
                /* EDIT MODAL BODY IN-PLACE */
                <div className="space-y-4 bg-zinc-900/40 p-4 border border-zinc-850 rounded-lg animate-scaleIn">
                  <h3 className="text-xs font-mono uppercase text-amber-500 tracking-wider font-bold mb-2">
                    🔄 Update Biographical & Tactical Blueprint
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase block">Character Name</label>
                      <input
                        type="text"
                        required
                        value={editHeroName}
                        onChange={(e) => setEditHeroName(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-sans focus:border-red-500 focus:outline-none"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase block font-bold">Player Name</label>
                      <input
                        type="text"
                        value={editPlayerName}
                        onChange={(e) => setEditPlayerName(e.target.value)}
                        placeholder="Player's alias..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-sans focus:border-red-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase block">Alignment / Morality</label>
                      <input
                        type="text"
                        value={editAlignment}
                        onChange={(e) => setEditAlignment(e.target.value)}
                        placeholder="e.g. Chaotic Good"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-sans focus:border-red-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase block">Class / Guild</label>
                      <input
                        type="text"
                        value={editClassType}
                        onChange={(e) => setEditClassType(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-sans focus:border-red-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase block">Subclass specialization</label>
                      <input
                        type="text"
                        value={editSubclass}
                        onChange={(e) => setEditSubclass(e.target.value)}
                        placeholder="e.g. Assassin, Evocation"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-sans focus:border-red-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase block">Heroic Level</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={editLevel}
                        onChange={(e) => setEditLevel(parseInt(e.target.value) || 1)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-sans focus:border-red-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase block">Passive Perception</label>
                      <input
                        type="number"
                        min="1"
                        value={editPassivePerc}
                        onChange={(e) => setEditPassivePerc(parseInt(e.target.value) || 10)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-sans focus:border-red-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 border-t border-zinc-850 pt-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase block">Max HP</label>
                      <input
                        type="number"
                        min="1"
                        value={editMaxHp}
                        onChange={(e) => setEditMaxHp(parseInt(e.target.value) || 10)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-sans focus:border-red-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase block">Current HP</label>
                      <input
                        type="number"
                        min="0"
                        max={editMaxHp}
                        value={editCurrentHp}
                        onChange={(e) => setEditCurrentHp(parseInt(e.target.value) || 0)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-sans focus:border-red-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase block">Armor Class (AC)</label>
                      <input
                        type="number"
                        min="1"
                        value={editAc}
                        onChange={(e) => setEditAc(parseInt(e.target.value) || 10)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-sans focus:border-red-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase block">Active Condition Status</label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-red-500 font-sans"
                      >
                        <option value="Healthy">Healthy</option>
                        <option value="Poisoned">☠️ Poisoned</option>
                        <option value="Unconscious">💤 Unconscious</option>
                        <option value="Frightened">😨 Frightened</option>
                        <option value="Stunned">⚡ Stunned</option>
                        <option value="Exhausted">💤 Exhausted</option>
                        <option value="Dead">🪦 Deceased</option>
                      </select>
                    </div>
                  </div>

                  {/* Attribute stats block */}
                  <div className="border-t border-zinc-850 pt-3">
                    <span className="text-[10px] font-mono text-zinc-550 block uppercase mb-2">DnD Attribute Matrix</span>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      <div className="bg-zinc-950 p-2 border border-zinc-850 rounded text-center">
                        <div className="text-[9px] font-mono text-zinc-500 uppercase font-bold">STR</div>
                        <input
                          type="number"
                          className="w-full text-center bg-transparent border-0 font-fantasy text-zinc-100 text-sm focus:outline-none p-0 mt-0.5"
                          value={editStr}
                          onChange={(e) => setEditStr(parseInt(e.target.value) || 10)}
                        />
                      </div>
                      <div className="bg-zinc-950 p-2 border border-zinc-850 rounded text-center">
                        <div className="text-[9px] font-mono text-zinc-500 uppercase font-bold">DEX</div>
                        <input
                          type="number"
                          className="w-full text-center bg-transparent border-0 font-fantasy text-zinc-100 text-sm focus:outline-none p-0 mt-0.5"
                          value={editDex}
                          onChange={(e) => setEditDex(parseInt(e.target.value) || 10)}
                        />
                      </div>
                      <div className="bg-zinc-950 p-2 border border-zinc-850 rounded text-center">
                        <div className="text-[9px] font-mono text-zinc-500 uppercase font-bold">CON</div>
                        <input
                          type="number"
                          className="w-full text-center bg-transparent border-0 font-fantasy text-zinc-100 text-sm focus:outline-none p-0 mt-0.5"
                          value={editCon}
                          onChange={(e) => setEditCon(parseInt(e.target.value) || 10)}
                        />
                      </div>
                      <div className="bg-zinc-950 p-2 border border-zinc-850 rounded text-center">
                        <div className="text-[9px] font-mono text-zinc-500 uppercase font-bold">INT</div>
                        <input
                          type="number"
                          className="w-full text-center bg-transparent border-0 font-fantasy text-zinc-100 text-sm focus:outline-none p-0 mt-0.5"
                          value={editInt}
                          onChange={(e) => setEditInt(parseInt(e.target.value) || 10)}
                        />
                      </div>
                      <div className="bg-zinc-950 p-2 border border-zinc-850 rounded text-center">
                        <div className="text-[9px] font-mono text-zinc-500 uppercase font-bold">WIS</div>
                        <input
                          type="number"
                          className="w-full text-center bg-transparent border-0 font-fantasy text-zinc-100 text-sm focus:outline-none p-0 mt-0.5"
                          value={editWis}
                          onChange={(e) => setEditWis(parseInt(e.target.value) || 10)}
                        />
                      </div>
                      <div className="bg-zinc-950 p-2 border border-zinc-850 rounded text-center">
                        <div className="text-[9px] font-mono text-zinc-500 uppercase font-bold">CHA</div>
                        <input
                          type="number"
                          className="w-full text-center bg-transparent border-0 font-fantasy text-zinc-100 text-sm focus:outline-none p-0 mt-0.5"
                          value={editCha}
                          onChange={(e) => setEditCha(parseInt(e.target.value) || 10)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Inline Inventory / Magic Items Editor */}
                  <div className="border-t border-zinc-850 pt-3">
                    <span className="text-[10px] font-mono text-zinc-500 block uppercase mb-2 font-bold select-none">Relics & Magic Items (Inventory)</span>
                    <div className="p-3 bg-zinc-950/60 border border-zinc-850 rounded-lg space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {editMagicItems.length === 0 ? (
                          <span className="text-[11px] text-zinc-500 italic select-none">No magic items currently equipped or carried.</span>
                        ) : (
                          editMagicItems.map((item, idx) => (
                            <span 
                              key={idx} 
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-950/50 border border-purple-500/30 text-purple-200 text-xs rounded-full shadow-inner animate-fadeIn select-none"
                            >
                              <span>{item}</span>
                              <button 
                                type="button"
                                onClick={() => setEditMagicItems(editMagicItems.filter((_, i) => i !== idx))}
                                className="text-purple-400 hover:text-red-400 font-bold ml-1 text-sm focus:outline-none cursor-pointer"
                                title="Remove magic item"
                              >
                                &times;
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <input
                          type="text"
                          id="input-add-edit-magic-item"
                          placeholder="Type item name (e.g. Flame Tongue Longsword, Ring of Protection)..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const val = e.currentTarget.value.trim();
                              if (val) {
                                if (!editMagicItems.some(i => i.toLowerCase() === val.toLowerCase())) {
                                  setEditMagicItems([...editMagicItems, val]);
                                }
                                e.currentTarget.value = "";
                              }
                            }
                          }}
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-sans focus:border-red-500 focus:outline-none placeholder:text-zinc-600"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById("input-add-edit-magic-item") as HTMLInputElement;
                            if (input && input.value.trim()) {
                              const val = input.value.trim();
                              if (!editMagicItems.some(i => i.toLowerCase() === val.toLowerCase())) {
                                setEditMagicItems([...editMagicItems, val]);
                              }
                              input.value = "";
                            }
                          }}
                          className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono rounded cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                      <span className="text-[9px] font-mono text-zinc-500 block">Press Enter or click Add to save items to this hero's active equipment roster!</span>
                    </div>
                  </div>

                </div>
              ) : (
                /* READ-ONLY STATS MATRIX SCREEN */
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  
                  {/* Tactical Shield Widget: HP/AC indicators (md:col-span-5) */}
                  <div className="md:col-span-5 bg-zinc-900/30 p-4 border border-zinc-850 rounded-lg flex flex-col justify-between gap-5 relative">
                    <div className="space-y-4">
                      {/* Active Status Ribbon */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">Vitality Core</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest ${
                          currentHero.activeStatus === "Healthy" 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : currentHero.activeStatus === "Dead" 
                              ? "bg-red-500/10 text-zinc-500 border border-red-500/10 line-through"
                              : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                        }`}>
                          {currentHero.activeStatus || "Healthy"}
                        </span>
                      </div>

                      {/* Large Health Counter */}
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between text-zinc-100">
                          <span className="text-xs font-mono font-bold text-zinc-400">Current Combat Hit Points</span>
                          <span className="font-fantasy font-black text-xl tracking-wide">
                            {currentHero.currentHp} / {currentHero.maxHp} <span className="text-xs text-zinc-500 font-sans">HP</span>
                          </span>
                        </div>
                        {/* Interactive health adjustment slider */}
                        <div className="h-2.5 w-full bg-zinc-850 rounded-full overflow-hidden border border-zinc-950/40 relative">
                          <div
                            className={`h-full transition-all duration-350 ${
                              (currentHero.currentHp / currentHero.maxHp) > 0.5 
                                ? "bg-emerald-500" 
                                : (currentHero.currentHp / currentHero.maxHp) > 0.2 
                                  ? "bg-amber-500" 
                                  : "bg-red-500 animate-pulse"
                            }`}
                            style={{ width: `${(currentHero.currentHp / currentHero.maxHp) * 100 || 0}%` }}
                          />
                        </div>

                        {/* Interactive Heals/Damage quick hotbuttons */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            onClick={() => adjustHp(-5)}
                            className="flex-1 py-1 bg-red-950/20 hover:bg-red-950/50 border border-red-500/20 text-red-400 hover:text-red-300 rounded text-[9px] font-mono font-bold uppercase transition"
                            title="Apply 5 Poison/Combat damage"
                          >
                            -5 Damage
                          </button>
                          <button
                            onClick={() => adjustHp(-1)}
                            className="py-1 px-2.5 bg-red-950/15 hover:bg-red-950/30 border border-red-500/10 text-red-500 rounded text-[9px] font-mono transition"
                          >
                            -1
                          </button>
                          <button
                            onClick={() => adjustHp(1)}
                            className="py-1 px-2.5 bg-emerald-950/15 hover:bg-emerald-950/30 border border-emerald-500/10 text-emerald-500 rounded text-[9px] font-mono transition"
                          >
                            +1
                          </button>
                          <button
                            onClick={() => adjustHp(5)}
                            className="flex-1 py-1 bg-emerald-950/20 hover:bg-emerald-950/50 border border-emerald-500/20 text-emerald-400 hover:text-emerald-300 rounded text-[9px] font-mono font-bold uppercase transition"
                            title="Inscribe 5 Holy Cure points"
                          >
                            +5 Healing
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* AC Shield and Passive Senses panel */}
                    <div className="grid grid-cols-2 gap-3.5 border-t border-zinc-850/60 pt-4 mt-1">
                      <div className="bg-zinc-950 p-2.5 border border-zinc-850 rounded flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="text-[8px] font-mono text-zinc-550 uppercase">Armor Class</div>
                          <div className="text-sm font-fantasy text-zinc-200 tracking-wider">AC Attributes</div>
                        </div>
                        <div className="w-10 h-10 bg-red-500/5 text-red-400 rounded-full border border-red-500/15 flex items-center justify-center font-fantasy font-black text-md">
                          {currentHero.ac}
                        </div>
                      </div>
                      
                      <div className="bg-zinc-950 p-2.5 border border-zinc-850 rounded flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="text-[8px] font-mono text-zinc-550 uppercase">Passive Sense</div>
                          <div className="text-sm font-fantasy text-zinc-200 tracking-wider">Perception</div>
                        </div>
                        <div className="w-10 h-10 bg-amber-500/5 text-amber-400 rounded-full border border-amber-500/15 flex items-center justify-center font-mono font-bold text-sm">
                          {currentHero.passivePerception || (10 + Math.floor(((currentHero.wisdom || 10) - 10) / 2))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Standard Ability Block Layout (md:col-span-7) */}
                  <div className="md:col-span-7 bg-zinc-900/30 p-4 border border-zinc-850 rounded-lg flex flex-col justify-between">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block mb-1">Ability Score Matrix</span>
                    
                    <div className="grid grid-cols-3 gap-3 my-2">
                      {[
                        { label: "STR", val: currentHero.strength || 10, name: "Strength" },
                        { label: "DEX", val: currentHero.dexterity || 10, name: "Dexterity" },
                        { label: "CON", val: currentHero.constitution || 10, name: "Constitution" },
                        { label: "INT", val: currentHero.intelligence || 10, name: "Intelligence" },
                        { label: "WIS", val: currentHero.wisdom || 10, name: "Wisdom" },
                        { label: "CHA", val: currentHero.charisma || 10, name: "Charisma" },
                      ].map((stat) => {
                        const modifier = Math.floor((stat.val - 10) / 2);
                        const modStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
                        
                        return (
                          <div key={stat.label} className="bg-zinc-950 p-2 border border-zinc-850 rounded-md text-center group hover:border-zinc-700 transition">
                            <div className="text-[9px] font-mono text-zinc-500 uppercase font-bold tracking-widest">{stat.label}</div>
                            <div className="text-lg font-fantasy text-zinc-105 font-bold mt-1 tracking-wide">{stat.val}</div>
                            <div className="text-[10px] font-mono text-red-400 font-bold bg-zinc-900 border border-zinc-850/80 rounded py-0.5 mx-2.5 mt-1">
                              {modStr}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="text-[10px] font-mono text-zinc-550 flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-zinc-850 border-dashed justify-center">
                      <Info className="w-3.5 h-3.5 text-zinc-650 shrink-0" />
                      <span>Ability modifiers are dynamically calculated following core SRD 5e parameters.</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. ACTIVE MAGIC ITEMS INVENTORY BOX */}
              <div className="bg-zinc-900/10 border border-zinc-850 rounded-lg p-4 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-850/60">
                  <h3 className="text-xs font-mono uppercase text-purple-400 tracking-wider flex items-center gap-1.5 font-bold">
                    <Gem className="w-4 h-4" /> Attuned Relics & Magic Items
                  </h3>
                  <button
                    onClick={() => {
                      setProgressValue("");
                      setProgressNotes("");
                      setProgressModalType("magic_item");
                      setShowProgressModal(true);
                    }}
                    className="px-2 py-1 bg-purple-500/10 hover:bg-purple-500 text-purple-300 hover:text-zinc-950 border border-purple-500/20 rounded text-[10px] font-mono transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Attune Item
                  </button>
                </div>

                {(!currentHero.magicItems || currentHero.magicItems.length === 0) ? (
                  <div className="py-6 text-center text-xs text-zinc-550 font-sans italic">
                    No magic items attuned or tracked for this hero yet. Cast some legendary treasures above!
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {currentHero.magicItems.map((item, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-950/20 border border-purple-500/20 text-purple-300 text-xs rounded-full font-serif leading-none hover:bg-purple-950/40"
                      >
                        <Gem className="w-3 h-3 text-purple-400" />
                        <span>{item}</span>
                        <button
                          onClick={() => handleRemoveMagicItemDirectly(item)}
                          className="hover:text-red-400 ml-1 cursor-pointer focus:outline-none"
                          title="Sever Relic Attunement"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. CHRONICLED TIMELINE LOGS (LEVELS AND MAGIC ITEMS TRANSITION HISTORY) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
                  <h3 className="text-xs font-mono uppercase text-red-400 tracking-wider flex items-center gap-1.5 font-bold">
                    <TrendingUp className="w-4 h-4 text-red-500" /> Historical Lore & Progression Log
                  </h3>
                  <button
                    onClick={() => {
                      setProgressValue("");
                      setProgressNotes("");
                      setProgressModalType("level");
                      setShowProgressModal(true);
                    }}
                    className="px-2 py-1 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-zinc-950 border border-red-500/20 rounded text-[10px] font-mono transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Log Milestone
                  </button>
                </div>

                {(!currentHero.history || currentHero.history.length === 0) ? (
                  <div className="py-6 text-center text-xs text-zinc-550 font-sans italic">
                    No character achievements logged on the chronological spectrum.
                  </div>
                ) : (
                  <div className="relative border-l border-zinc-800 ml-3.5 pl-5 space-y-5 py-2">
                    {currentHero.history.map((record) => {
                      const isLevelIdx = record.type === "level";
                      
                      return (
                        <div key={record.id} className="relative group">
                          
                          {/* Left node dot icon */}
                          <div className={`absolute -left-[27px] top-1.5 w-4.5 h-4.5 rounded-full flex items-center justify-center border ${
                            isLevelIdx 
                              ? "bg-red-500/10 text-red-400 border-red-500/30" 
                              : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                          }`}>
                            {isLevelIdx ? (
                              <TrendingUp className="w-2.5 h-2.5" />
                            ) : (
                              <Gem className="w-2.5 h-2.5" />
                            )}
                          </div>

                          <div className="space-y-1 bg-zinc-900/40 hover:bg-zinc-900/60 transition p-3.5 border border-zinc-900 rounded-lg pr-10">
                            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                              <span className="font-fantasy font-semibold text-xs text-zinc-200 uppercase tracking-wider">
                                {record.value}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-550 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {record.date}
                              </span>
                            </div>
                            
                            <p className="text-xs text-zinc-400 font-sans leading-normal">
                              {record.notes}
                            </p>

                            {/* Deletion button inside log item */}
                            <button
                              onClick={() => handleRemoveProgression(record.id)}
                              className="absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-800 rounded text-zinc-650 hover:text-red-400 transition cursor-pointer"
                              title="Erase log item and attunement status"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-12 text-center space-y-4">
              <Users className="w-12 h-12 text-zinc-700 mx-auto" />
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="font-fantasy font-bold text-md text-zinc-200 uppercase tracking-widest">
                  PC Explorer Interface
                </h3>
                <p className="text-zinc-500 text-xs font-sans leading-normal">
                  Inscribe some heroic souls in the list on the left, then inspect individual attributes, abilities, and progression milestones in detail.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>


      {/* MODAL: ADD HERO CHARACTER */}
      {showAddHeroModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-950 p-5 rounded-lg border-2 border-red-500/30 max-w-2xl w-full space-y-4 shadow-2xl my-8"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-zinc-850">
              <h3 className="font-fantasy font-bold text-sm text-zinc-100 tracking-wider uppercase flex items-center gap-1.5">
                <Swords className="w-4 h-4 text-red-500 animate-pulse" /> Inscribe Adventurer
              </h3>
              <button 
                onClick={() => setShowAddHeroModal(false)}
                className="p-1 hover:bg-zinc-900 rounded text-zinc-400 hover:text-zinc-250 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddHero} className="space-y-4 font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-455 uppercase block">Character Name</label>
                  <input
                    type="text"
                    required
                    value={newHeroName}
                    onChange={(e) => setNewHeroName(e.target.value)}
                    placeholder="e.g. Roland Ironheart"
                    className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-1.8 text-xs text-zinc-100 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-455 uppercase block">Player Alias</label>
                  <input
                    type="text"
                    value={newHeroPlayer}
                    onChange={(e) => setNewHeroPlayer(e.target.value)}
                    placeholder="Player moniker..."
                    className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-1.8 text-xs text-zinc-100 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* Class Selection Patterns */}
              <div className="space-y-3.5 border-t border-zinc-900 pt-3">
                <span className="text-[10px] font-mono text-zinc-450 uppercase block">Companion Class Blueprint</span>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CLASS_TEMPLATES.map((tpl) => {
                    const active = selectedClassTemplate === tpl.classType;
                    return (
                      <button
                        key={tpl.classType}
                        type="button"
                        onClick={() => setSelectedClassTemplate(tpl.classType)}
                        className={`p-2.5 rounded border text-left transition ${
                          active 
                            ? "bg-red-500/10 border-red-500/40 text-red-400 font-bold"
                            : "bg-zinc-900/60 border-zinc-850 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        <div className="text-xs font-fantasy uppercase tracking-wider">{tpl.classType}</div>
                        <div className="text-[9px] font-mono text-zinc-500 mt-0.5">HPDie {tpl.hp}</div>
                      </button>
                    );
                  })}
                  
                  <button
                    type="button"
                    onClick={() => setSelectedClassTemplate("Custom")}
                    className={`p-2.5 rounded border text-left transition ${
                      selectedClassTemplate === "Custom"
                        ? "bg-red-500/10 border-red-500/40 text-red-400 font-bold"
                        : "bg-zinc-900/60 border-zinc-850 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <div className="text-xs font-fantasy uppercase tracking-wider">Custom</div>
                    <div className="text-[9px] font-mono text-zinc-550 mt-0.5">Build Own Stats</div>
                  </button>
                </div>

                {selectedClassTemplate === "Custom" && (
                  <div className="space-y-1 animate-fadeIn">
                    <label className="text-[10px] font-mono text-zinc-500 uppercase block">Define Class Name</label>
                    <input
                      type="text"
                      required
                      value={customClassType}
                      onChange={(e) => setCustomClassType(e.target.value)}
                      placeholder="e.g. Spellblade, Necromancer"
                      className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-1.8 text-xs text-zinc-100 focus:outline-none focus:border-red-500"
                    />
                  </div>
                )}
                
                {selectedClassTemplate !== "Custom" && (
                  <p className="text-[11px] text-zinc-500 leading-normal italic font-sans px-1">
                    "{CLASS_TEMPLATES.find(c => c.classType === selectedClassTemplate)?.desc}"
                  </p>
                )}
              </div>

              {/* Advanced attributes details toggler */}
              <div className="border-t border-zinc-900 pt-3">
                <button
                  type="button"
                  onClick={() => setUseCustomStats(!useCustomStats)}
                  className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200 flex items-center gap-1 uppercase tracking-wide cursor-pointer select-none"
                >
                  {useCustomStats ? "[-] Hide Core Attributes" : "[+] Customize D&D Ability Scores (Base 10)"}
                </button>

                {useCustomStats && (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3 animate-slideDown">
                    {[
                      { l: "Strength", v: newStr, s: setNewStr },
                      { l: "Dexterity", v: newDex, s: setNewDex },
                      { l: "Constitution", v: newCon, s: setNewCon },
                      { l: "Intelligence", v: newInt, s: setNewInt },
                      { l: "Wisdom", v: newWis, s: setNewWis },
                      { l: "Charisma", v: newCha, s: setNewCha },
                    ].map((attr) => (
                      <div key={attr.l} className="bg-zinc-900/40 p-2 border border-zinc-850 rounded text-center">
                        <label className="text-[9px] font-mono text-zinc-500 block uppercase font-bold">{attr.l.substring(0,3)}</label>
                        <input
                          type="number"
                          min="3"
                          max="20"
                          className="w-full text-center bg-transparent border-0 font-fantasy text-zinc-100 text-sm mt-1 focus:outline-none"
                          value={attr.v}
                          onChange={(e) => attr.s(parseInt(e.target.value) || 10)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 border-t border-zinc-900 pt-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-455 uppercase block">Initial Level</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={newHeroLevel}
                    onChange={(e) => setNewHeroLevel(parseInt(e.target.value) || 1)}
                    className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-1.8 text-xs text-zinc-100 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-455 uppercase block">Subclass Theme if any</label>
                  <input
                    type="text"
                    value={newHeroSubclass}
                    onChange={(e) => setNewHeroSubclass(e.target.value)}
                    placeholder="e.g. Champion, Thief"
                    className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-1.8 text-xs text-zinc-100 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-455 uppercase block">Moral Alignment</label>
                  <input
                    type="text"
                    value={newHeroAlignment}
                    onChange={(e) => setNewHeroAlignment(e.target.value)}
                    placeholder="e.g. Lawful Good"
                    className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-1.8 text-xs text-zinc-100 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-zinc-850">
                <button
                  type="button"
                  onClick={() => setShowAddHeroModal(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 text-xs rounded transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-zinc-950 text-xs font-bold rounded transition cursor-pointer flex items-center gap-1"
                >
                  Inscribe Adventurer
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: ADD MILESTONE PROGRESSION EVENT */}
      {showProgressModal && currentHero && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-950 p-5 rounded-lg border-2 border-purple-500/20 max-w-md w-full space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-zinc-850">
              <h3 className="font-fantasy font-bold text-sm text-zinc-100 uppercase tracking-widest flex items-center gap-1.5">
                {progressModalType === "level" ? (
                  <>
                    <TrendingUp className="w-4 h-4 text-red-400 animate-pulse" /> Scribe Milestone Event
                  </>
                ) : (
                  <>
                    <Gem className="w-4 h-4 text-purple-400" /> Scribe Relic Attunement
                  </>
                )}
              </h3>
              <button 
                onClick={() => setShowProgressModal(false)}
                className="p-1 hover:bg-zinc-900 rounded text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddProgression} className="space-y-4 text-xs font-sans">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                  {progressModalType === "level" 
                    ? "Progression Value (e.g. Level 5, Accomplished Hero)" 
                    : "Magic Item Title (e.g. Sun Blade, Ring of Protection)"}
                </label>
                <input
                  type="text"
                  required
                  value={progressValue}
                  onChange={(e) => setProgressValue(e.target.value)}
                  placeholder={progressModalType === "level" ? "Level 3 / Archmage status..." : "Name of custom item..."}
                  className="w-full bg-zinc-900 border border-zinc-850 rounded px-2.5 py-1.8 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">Documented Calendar/Campaign Date</label>
                <input
                  type="text"
                  required
                  value={progressDate}
                  onChange={(e) => setProgressDate(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-850 rounded px-2.5 py-1.8 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">Milestone Details & Chronicles</label>
                <textarea
                  rows={3}
                  value={progressNotes}
                  onChange={(e) => setProgressNotes(e.target.value)}
                  placeholder={progressModalType === "level" 
                    ? "List features unlocked, spell slots increased, or feats selected..." 
                    : "Describe rare properties, attunement stats, or where this legendary relic was discovered..."}
                  className="w-full bg-zinc-900 border border-zinc-850 rounded px-2.5 py-1.8 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-850">
                <button
                  type="button"
                  onClick={() => setShowProgressModal(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-855 border border-zinc-800 text-zinc-400 rounded transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-red-550 to-purple-550 bg-red-500 hover:bg-red-650 text-zinc-950 font-bold rounded transition cursor-pointer"
                >
                  Inscribe & Save Log
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
