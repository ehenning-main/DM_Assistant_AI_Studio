import React, { useState } from "react";
import { 
  User, Plus, Trash2, Shield, Heart, Sparkles, TrendingUp, Gem, 
  ChevronRight, Edit, Save, Calendar, Award, Users, Check, X, 
  Flame, HelpCircle, Swords, Scroll, Info, AlertCircle, Link2, Globe, RefreshCw, FileText, ExternalLink,
  Briefcase, BookOpen, Import, Settings
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
  const [newHeroRace, setNewHeroRace] = useState("Human");

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
  const [editRace, setEditRace] = useState("");
  const [editLevel, setEditLevel] = useState(1);
  const [editMaxHp, setEditMaxHp] = useState(10);
  const [editCurrentHp, setEditCurrentHp] = useState(10);
  const [editTempHp, setEditTempHp] = useState(0);
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
  const [editClasses, setEditClasses] = useState<Array<{ className: string; level: number; subclass?: string }>>([]);
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
  const [showCampaignLinkerModal, setShowCampaignLinkerModal] = useState(false);

  // --- NEW MULTI-TAB IMPORTER STATES FOR ADD HERO MODAL ---
  const [importerActiveTab, setImporterActiveTab] = useState<"manual" | "auto" | "ai" | "json">("manual");
  const [importerAutoInput, setImporterAutoInput] = useState("");
  const [importerPasteJsonInput, setImporterPasteJsonInput] = useState("");
  const [importerPasteTextInput, setImporterPasteTextInput] = useState("");
  const [importerLoading, setImporterLoading] = useState(false);
  const [importerError, setImporterError] = useState<string | null>(null);
  const [importerSuccess, setImporterSuccess] = useState<string | null>(null);

  // Spellbook and Inventory filter states in Character Detail Pane
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState("all");
  const [spellSearch, setSpellSearch] = useState("");
  const [spellLevelFilter, setSpellLevelFilter] = useState("all");
  const [expandedSpellName, setExpandedSpellName] = useState<string | null>(null);

  // Individual Hero D&D Beyond States
  const [editHeroDndBeyondUrl, setEditHeroDndBeyondUrl] = useState(() => {
    const initialHero = (campaign.heroes || []).find(h => h.id === (heroesList.length > 0 ? heroesList[0].id : null));
    return initialHero?.dndBeyondUrl || "";
  });
  const [heroSyncLoading, setHeroSyncLoading] = useState(false);
  const [heroSyncError, setHeroSyncError] = useState<string | null>(null);
  const [heroSyncSuccess, setHeroSyncSuccess] = useState<string | null>(null);
  const [heroPastedHtml, setHeroPastedHtml] = useState("");
  const [showHeroPasteFallback, setShowHeroPasteFallback] = useState(false);

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

  // Derive state reset when active hero changes
  const [currentSelectedHeroId, setCurrentSelectedHeroId] = useState<string | null>(selectedHeroId);
  if (selectedHeroId !== currentSelectedHeroId) {
    setCurrentSelectedHeroId(selectedHeroId);
    setHeroSyncError(null);
    setHeroSyncSuccess(null);
    setHeroPastedHtml("");
    setShowHeroPasteFallback(false);
    const targetHero = (campaign.heroes || []).find(h => h.id === selectedHeroId);
    setEditHeroDndBeyondUrl(targetHero?.dndBeyondUrl || "");
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

  // Formats multiple classes to string: e.g. "Cleric (Life Domain) 8 / Paladin 1"
  function getHeroClassListString(hero: HeroCharacter): string {
    if (hero.classes && hero.classes.length > 0) {
      return hero.classes.map(c => {
        const details: string[] = [];
        if (c.subclass) details.push(c.subclass);
        if (c.domain) details.push(`${c.domain} Domain`);
        if (c.school) details.push(`${c.school} School`);
        if (c.specialization) details.push(c.specialization);
        
        const detailsStr = details.length > 0 ? ` (${details.join(", ")})` : "";
        return `${c.className}${detailsStr} Lv ${c.level}`;
      }).join(" / ");
    }
    const sub = hero.subclass ? ` (${hero.subclass})` : "";
    return `${hero.classType}${sub}`;
  }

  // Parses class string back into individual classes: e.g. "Cleric (Life Domain) 8 / Paladin 1"
  function parseClassString(classStr: string): Array<{ className: string; level: number; subclass?: string; domain?: string; school?: string; specialization?: string }> {
    if (!classStr) return [];
    const parts = classStr.split("/");
    return parts.map(part => {
      const trimmed = part.trim();
      const match = trimmed.match(/^([^(]+?)(?:\s*\(([^)]+)\))?\s*(\d+)?$/);
      if (match) {
        const className = match[1].trim();
        const details = match[2] ? match[2].trim() : undefined;
        const level = match[3] ? parseInt(match[3], 10) : 1;
        
        let subclass = details;
        let domain: string | undefined;
        let school: string | undefined;
        let specialization: string | undefined;
        
        if (details) {
          if (details.toLowerCase().includes("domain")) {
            domain = details.replace(/domain/gi, "").trim();
          } else if (details.toLowerCase().includes("school")) {
            school = details.replace(/school/gi, "").trim();
          } else if (details.toLowerCase().includes("oath") || details.toLowerCase().includes("circle") || details.toLowerCase().includes("patron")) {
            specialization = details;
          }
        }
        
        return { className, level, subclass, domain, school, specialization };
      }
      return { className: trimmed, level: 1 };
    });
  }

  // Converts character data from our rich importer to our local HeroCharacter structure
  function mapImportedCharacterToHero(pc: any): HeroCharacter {
    const classInfo = pc.classes && pc.classes[0] ? pc.classes[0] : { className: "Fighter", level: 1 };
    
    // Ability scores total mapping (support both { stats: { strength: { total: X } } } and { stats: { strength: X } } or direct { strength: X })
    const getStatValue = (key: string): number => {
      const s = pc.stats?.[key];
      if (typeof s === "object" && s !== null) {
        return s.total !== undefined ? s.total : (s.value !== undefined ? s.value : 10);
      }
      if (typeof s === "number") {
        return s;
      }
      return pc[key] !== undefined ? pc[key] : 10;
    };

    const strength = getStatValue("strength");
    const dexterity = getStatValue("dexterity");
    const constitution = getStatValue("constitution");
    const intelligence = getStatValue("intelligence");
    const wisdom = getStatValue("wisdom");
    const charisma = getStatValue("charisma");

    const passivePerception = pc.passivePerception || (10 + Math.floor((wisdom - 10) / 2));

    // Magic items: Merge items from pc.magicItems and any magic/attuned items in pc.inventory
    const magicItemsSet = new Set<string>();
    
    if (Array.isArray(pc.magicItems)) {
      pc.magicItems.forEach((item: string) => {
        if (item) magicItemsSet.add(item);
      });
    }

    if (Array.isArray(pc.inventory)) {
      pc.inventory.forEach((item: any) => {
        const rarity = item.rarity?.toLowerCase() || "";
        const isMagicRarity = ["uncommon", "rare", "very rare", "legendary", "artifact"].includes(rarity);
        if (item.isAttuned || (isMagicRarity && item.equipped)) {
          magicItemsSet.add(item.name);
        }
      });
    }

    // Fallback: If both sources produced no magic items, inspect all non-common items in the inventory
    if (magicItemsSet.size === 0 && Array.isArray(pc.inventory)) {
      pc.inventory.forEach((item: any) => {
        const rarity = item.rarity?.toLowerCase() || "";
        if (["uncommon", "rare", "very rare", "legendary", "artifact"].includes(rarity)) {
          magicItemsSet.add(item.name);
        }
      });
    }

    const magicItems = Array.from(magicItemsSet);

    return {
      id: "hero_" + Math.random().toString(36).substring(2, 11),
      name: pc.name || "Unnamed Hero",
      classType: classInfo.className || pc.classType || "Fighter",
      subclass: classInfo.subclass || pc.subclass || undefined,
      classes: pc.classes || undefined,
      race: pc.race || "Human",
      level: pc.level || 1,
      maxHp: pc.hp?.max || pc.maxHp || 10,
      currentHp: pc.hp?.current || pc.currentHp || pc.hp?.max || pc.maxHp || 10,
      tempHp: pc.hp?.temp !== undefined ? pc.hp.temp : (pc.tempHp !== undefined ? pc.tempHp : 0),
      ac: pc.ac || 10,
      playerName: pc.playerName || "Companion",
      alignment: pc.alignment || "Neutral",
      passivePerception,
      activeStatus: "Healthy",
      strength,
      dexterity,
      constitution,
      intelligence,
      wisdom,
      charisma,
      magicItems,
      avatarUrl: pc.avatarUrl || "",
      inventory: pc.inventory || [],
      spells: pc.spells || [],
      sourceType: pc.sourceType || "auto",
      importedAt: pc.importedAt || new Date().toISOString(),
      history: [
        {
          id: "sync_init_" + Date.now(),
          type: "level",
          value: `Imported Level ${pc.level || 1} ${classInfo.className || pc.classType || "Fighter"}`,
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          notes: `Created from D&D Beyond Sheet using the ${pc.sourceType === "auto" ? "API Syncer" : pc.sourceType === "pasted_json" ? "JSON Paste" : "AI Parser"}!`
        }
      ]
    };
  }

  const handleImporterAutoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importerAutoInput.trim()) return;

    setImporterLoading(true);
    setImporterError(null);
    setImporterSuccess(null);

    try {
      const response = await fetch(`/api/import/auto?query=${encodeURIComponent(importerAutoInput.trim())}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server responded with status ${response.status}`);
      }

      const newHero = mapImportedCharacterToHero(data);
      if (importerAutoInput.trim().startsWith("http")) {
        newHero.dndBeyondUrl = importerAutoInput.trim();
      } else {
        newHero.dndBeyondUrl = `https://www.dndbeyond.com/characters/${importerAutoInput.trim()}`;
      }

      const updated = [...heroesList, newHero];
      await updateHeroes(updated);
      setSelectedHeroId(newHero.id);

      setImporterSuccess(`Successfully imported and inscribed ${newHero.name}!`);
      setImporterAutoInput("");
      
      setTimeout(() => {
        setShowAddHeroModal(false);
        setImporterSuccess(null);
        setImporterActiveTab("manual");
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setImporterError(err.message || "Failed to import character. Make sure the character ID is correct and set to Public on D&D Beyond.");
    } finally {
      setImporterLoading(false);
    }
  };

  const handleImporterPasteJsonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importerPasteJsonInput.trim()) return;

    setImporterLoading(true);
    setImporterError(null);
    setImporterSuccess(null);

    try {
      const response = await fetch("/api/import/paste-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: importerPasteJsonInput.trim() })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server responded with status ${response.status}`);
      }

      const newHero = mapImportedCharacterToHero(data);
      const updated = [...heroesList, newHero];
      await updateHeroes(updated);
      setSelectedHeroId(newHero.id);

      setImporterSuccess(`Successfully parsed and inscribed ${newHero.name}!`);
      setImporterPasteJsonInput("");

      setTimeout(() => {
        setShowAddHeroModal(false);
        setImporterSuccess(null);
        setImporterActiveTab("manual");
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setImporterError(err.message || "Failed to parse D&D Beyond JSON. Check that you copied the complete JSON block.");
    } finally {
      setImporterLoading(false);
    }
  };

  const handleImporterAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importerPasteTextInput.trim() || importerPasteTextInput.trim().length < 20) {
      setImporterError("Please paste a larger snippet of text to allow the AI to parse character traits.");
      return;
    }

    setImporterLoading(true);
    setImporterError(null);
    setImporterSuccess(null);

    try {
      const response = await fetch("/api/import/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: importerPasteTextInput.trim() })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server responded with status ${response.status}`);
      }

      const newHero = mapImportedCharacterToHero(data);
      const updated = [...heroesList, newHero];
      await updateHeroes(updated);
      setSelectedHeroId(newHero.id);

      setImporterSuccess(`Successfully analyzed and inscribed ${newHero.name} using Gemini AI!`);
      setImporterPasteTextInput("");

      setTimeout(() => {
        setShowAddHeroModal(false);
        setImporterSuccess(null);
        setImporterActiveTab("manual");
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setImporterError(err.message || "AI parsing failed. Check your internet connection or paste text quality.");
    } finally {
      setImporterLoading(false);
    }
  };

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
      race: newHeroRace.trim() || "Human",
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
      setNewHeroRace("Human");
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
    setEditClassType(getHeroClassListString(currentHero));
    setEditSubclass(currentHero.classes && currentHero.classes.length > 0 ? "" : (currentHero.subclass || ""));
    setEditRace(currentHero.race || "Human");
    setEditLevel(currentHero.level);
    setEditMaxHp(currentHero.maxHp);
    setEditCurrentHp(currentHero.currentHp);
    setEditTempHp(currentHero.tempHp || 0);
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
    setEditHeroDndBeyondUrl(currentHero.dndBeyondUrl || "");
    
    // Initialize editClasses from currentHero.classes, or fallback to current single class type
    if (currentHero.classes && currentHero.classes.length > 0) {
      setEditClasses(currentHero.classes.map(c => ({ ...c })));
    } else {
      setEditClasses([
        { 
          className: currentHero.classType || "Fighter", 
          level: currentHero.level || 1, 
          subclass: currentHero.subclass || "" 
        }
      ]);
    }

    setIsEditingState(true);
  }

  // Add a new class to the multiclass list
  function handleAddClassToEdit() {
    setEditClasses([
      ...editClasses,
      { className: "Fighter", level: 1, subclass: "" }
    ]);
  }

  // Remove a class from the multiclass list
  function handleRemoveClassFromEdit(index: number) {
    if (editClasses.length <= 1) return; // Keep at least one class
    setEditClasses(editClasses.filter((_, i) => i !== index));
  }

  // Update a specific field for a class in the list
  function handleChangeClassInEdit(index: number, field: "className" | "level" | "subclass" | "domain" | "school" | "specialization", value: any) {
    setEditClasses(editClasses.map((c, i) => {
      if (i === index) {
        return {
          ...c,
          [field]: field === "level" ? Math.max(1, parseInt(value, 10) || 1) : value
        };
      }
      return c;
    }));
  }

  // Cancel edits
  function cancelEditing() {
    setIsEditingState(false);
  }

  // Save current Hero structural updates
  function handleSaveHeroEdits() {
    if (!currentHero) return;
    
    const hasMultipleClasses = editClasses.length > 1;
    const totalLevel = editClasses.reduce((sum, c) => sum + c.level, 0);
    
    const resolvedClassType = editClasses[0]?.className || "Fighter";
    const resolvedSubclass = editClasses[0]?.subclass || undefined;

    // Check if level has changed to automatically inject progression
    const changes: HeroProgressionRecord[] = [];
    if (totalLevel !== currentHero.level) {
      changes.push({
        id: "level_up_" + Date.now(),
        type: "level",
        value: `Level ${totalLevel}`,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        notes: `Adjusted DM attributes. Traveled from Level ${currentHero.level} to ${totalLevel}!`
      });
    }

    const updatedHero: HeroCharacter = {
      ...currentHero,
      name: editHeroName.trim() || currentHero.name,
      playerName: editPlayerName.trim() || undefined,
      classes: editClasses.length > 0 ? editClasses : undefined,
      classType: resolvedClassType,
      subclass: resolvedSubclass,
      race: editRace.trim() || undefined,
      level: totalLevel,
      maxHp: editMaxHp,
      currentHp: Math.min(editCurrentHp, editMaxHp),
      tempHp: editTempHp,
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
      dndBeyondUrl: editHeroDndBeyondUrl.trim() || undefined,
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
    let newTempHp = currentHero.tempHp || 0;
    let newCurrentHp = currentHero.currentHp;
    
    if (amount < 0) {
      // Damage: depletes temporary HP first
      const damage = Math.abs(amount);
      if (newTempHp > 0) {
        if (newTempHp >= damage) {
          newTempHp -= damage;
        } else {
          const carryDamage = damage - newTempHp;
          newTempHp = 0;
          newCurrentHp = Math.max(0, newCurrentHp - carryDamage);
        }
      } else {
        newCurrentHp = Math.max(0, newCurrentHp - damage);
      }
    } else {
      // Healing: only restores actual hit points up to max, does not restore temp HP
      newCurrentHp = Math.max(0, Math.min(currentHero.maxHp, newCurrentHp + amount));
    }
    
    const updatedHero = {
      ...currentHero,
      currentHp: newCurrentHp,
      tempHp: newTempHp,
      activeStatus: newCurrentHp === 0 ? "Unconscious" : currentHero.activeStatus === "Unconscious" ? "Healthy" : currentHero.activeStatus
    };
    
    const updated = heroesList.map(h => h.id === currentHero.id ? updatedHero : h);
    updateHeroes(updated);
  }

  // Set or adjust temporary hit points directly
  function adjustTempHp(amount: number) {
    if (!currentHero) return;
    const currentTemp = currentHero.tempHp || 0;
    const nextTemp = Math.max(0, currentTemp + amount);
    const updatedHero = {
      ...currentHero,
      tempHp: nextTemp
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
          const magicItemsSet = new Set<string>((orig.magicItems || []).map(i => i.trim()));
          if (Array.isArray(pc.magicItems)) {
            pc.magicItems.forEach((item: string) => {
              if (item) magicItemsSet.add(item.trim());
            });
          }
          if (Array.isArray(pc.inventory)) {
            pc.inventory.forEach((item: any) => {
              const rarity = item.rarity?.toLowerCase() || "";
              const isMagicRarity = ["uncommon", "rare", "very rare", "legendary", "artifact"].includes(rarity);
              if (item.isAttuned || (isMagicRarity && item.equipped)) {
                magicItemsSet.add(item.name.trim());
              }
            });
          }
          const mergedItems = Array.from(magicItemsSet);
          
          const newItems = mergedItems.filter(item => !(orig.magicItems || []).includes(item));
          if (newItems.length > 0) {
            updatesDesc.push(`Attuned magic relics: ${newItems.join(", ")}`);
          }

          const getStat = (charObj: any, key: string, fallbackVal: number = 10): number => {
            const s = charObj.stats?.[key];
            if (typeof s === "object" && s !== null) {
              return s.total !== undefined ? s.total : (s.value !== undefined ? s.value : fallbackVal);
            }
            if (typeof s === "number") {
              return s;
            }
            return charObj[key] !== undefined ? charObj[key] : fallbackVal;
          };

          const updatedHero: HeroCharacter = {
            ...orig,
            classes: pc.classes || orig.classes,
            classType: pc.classType || orig.classType,
            level: pc.level || orig.level,
            maxHp: pc.maxHp || orig.maxHp,
            currentHp: pc.currentHp !== undefined ? pc.currentHp : (pc.maxHp || orig.currentHp),
            tempHp: pc.hp?.temp !== undefined ? pc.hp.temp : (pc.tempHp !== undefined ? pc.tempHp : (orig.tempHp || 0)),
            ac: pc.ac || orig.ac,
            alignment: pc.alignment || orig.alignment || "Neutral",
            playerName: pc.playerName && pc.playerName !== "N/A" ? pc.playerName : orig.playerName || "Companion",
            strength: getStat(pc, "strength", orig.strength || 10),
            dexterity: getStat(pc, "dexterity", orig.dexterity || 10),
            constitution: getStat(pc, "constitution", orig.constitution || 10),
            intelligence: getStat(pc, "intelligence", orig.intelligence || 10),
            wisdom: getStat(pc, "wisdom", orig.wisdom || 10),
            charisma: getStat(pc, "charisma", orig.charisma || 10),
            magicItems: mergedItems,
            inventory: pc.inventory || orig.inventory || [],
            spells: pc.spells || orig.spells || [],
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
          
          const getStat = (charObj: any, key: string, fallbackVal: number = 10): number => {
            const s = charObj.stats?.[key];
            if (typeof s === "object" && s !== null) {
              return s.total !== undefined ? s.total : (s.value !== undefined ? s.value : fallbackVal);
            }
            if (typeof s === "number") {
              return s;
            }
            return charObj[key] !== undefined ? charObj[key] : fallbackVal;
          };

          // merge magic items for new character
          const magicItemsSet = new Set<string>();
          if (Array.isArray(pc.magicItems)) {
            pc.magicItems.forEach((item: string) => {
              if (item) magicItemsSet.add(item.trim());
            });
          }
          if (Array.isArray(pc.inventory)) {
            pc.inventory.forEach((item: any) => {
              const rarity = item.rarity?.toLowerCase() || "";
              const isMagicRarity = ["uncommon", "rare", "very rare", "legendary", "artifact"].includes(rarity);
              if (item.isAttuned || (isMagicRarity && item.equipped)) {
                magicItemsSet.add(item.name.trim());
              }
            });
          }
          const mergedItems = Array.from(magicItemsSet);

          const newHero: HeroCharacter = {
            id: newId,
            name: pc.name,
            classes: pc.classes || undefined,
            classType: pc.classType || "Fighter",
            level: pc.level || 1,
            maxHp: pc.maxHp || 10,
            currentHp: pc.currentHp !== undefined ? pc.currentHp : (pc.maxHp || 10),
            tempHp: pc.hp?.temp !== undefined ? pc.hp.temp : (pc.tempHp !== undefined ? pc.tempHp : 0),
            ac: pc.ac || 10,
            alignment: pc.alignment || "Neutral",
            playerName: pc.playerName && pc.playerName !== "N/A" ? pc.playerName : "Companion",
            strength: getStat(pc, "strength", 10),
            dexterity: getStat(pc, "dexterity", 10),
            constitution: getStat(pc, "constitution", 10),
            intelligence: getStat(pc, "intelligence", 10),
            wisdom: getStat(pc, "wisdom", 10),
            charisma: getStat(pc, "charisma", 10),
            magicItems: mergedItems,
            inventory: pc.inventory || [],
            spells: pc.spells || [],
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

  // Individual Hero character sheet sync with dndbeyond.com
  async function performHeroDndBeyondSync(targetUrl: string, rawHtml?: string) {
    if (!currentHero) return;
    setHeroSyncLoading(true);
    setHeroSyncError(null);
    setHeroSyncSuccess(null);

    try {
      const payload: any = {};
      if (rawHtml) {
        payload.pastedHtml = rawHtml;
      } else {
        payload.characterUrl = targetUrl;
      }

      console.log("[DND Beyond Hero Sync] Submitting parse request...", targetUrl);
      const response = await fetch("/api/parse-dndbeyond-character", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Oracle server responded with status: ${response.status}`);
      }

      const pc = await response.json();

      if (pc.fallbackNeeded) {
        setHeroSyncError(pc.message);
        setShowHeroPasteFallback(true);
        setHeroSyncLoading(false);
        return;
      }

      // We got character data back! Let's update the currently active hero
      const syncId = "sync_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5);
      
      const updatesDesc: string[] = [];
      if (currentHero.level !== pc.level) {
        updatesDesc.push(`Level advanced: ${currentHero.level} -> ${pc.level}`);
      }
      if (currentHero.maxHp !== pc.maxHp) {
        updatesDesc.push(`Max HP adjusted: ${currentHero.maxHp} -> ${pc.maxHp}`);
      }
      if (currentHero.ac !== pc.ac) {
        updatesDesc.push(`Armor Class updated: ${currentHero.ac} -> ${pc.ac}`);
      }

      // Align magic items directly with the character's active sheet state to prevent legacy accumulation
      const magicItemsSet = new Set<string>();
      if (Array.isArray(pc.magicItems)) {
        pc.magicItems.forEach((item: string) => {
          if (item) magicItemsSet.add(item.trim());
        });
      }
      if (Array.isArray(pc.inventory)) {
        pc.inventory.forEach((item: any) => {
          const rarity = item.rarity?.toLowerCase() || "";
          const isMagicRarity = ["uncommon", "rare", "very rare", "legendary", "artifact"].includes(rarity);
          if (item.isAttuned || (isMagicRarity && item.equipped)) {
            magicItemsSet.add(item.name.trim());
          }
        });
      }
      // If no magic items are attuned or equipped, fallback to inspect all non-common items in the inventory
      if (magicItemsSet.size === 0 && Array.isArray(pc.inventory)) {
        pc.inventory.forEach((item: any) => {
          const rarity = item.rarity?.toLowerCase() || "";
          if (["uncommon", "rare", "very rare", "legendary", "artifact"].includes(rarity)) {
            magicItemsSet.add(item.name.trim());
          }
        });
      }
      const mergedItems = Array.from(magicItemsSet);
      
      const newItems = mergedItems.filter(item => !(currentHero.magicItems || []).includes(item));
      if (newItems.length > 0) {
        updatesDesc.push(`Attuned magic relics: ${newItems.join(", ")}`);
      }

      const getStat = (charObj: any, key: string, fallbackVal: number = 10): number => {
        const s = charObj.stats?.[key];
        if (typeof s === "object" && s !== null) {
          return s.total !== undefined ? s.total : (s.value !== undefined ? s.value : fallbackVal);
        }
        if (typeof s === "number") {
          return s;
        }
        return charObj[key] !== undefined ? charObj[key] : fallbackVal;
      };

      const updatedHero: HeroCharacter = {
        ...currentHero,
        name: pc.name || currentHero.name,
        classType: pc.classType || currentHero.classType,
        subclass: pc.subclass || currentHero.subclass,
        race: pc.race || currentHero.race || "Human",
        level: pc.level || currentHero.level,
        maxHp: pc.maxHp || currentHero.maxHp,
        currentHp: pc.currentHp !== undefined ? pc.currentHp : (pc.maxHp || currentHero.currentHp),
        tempHp: pc.hp?.temp !== undefined ? pc.hp.temp : (pc.tempHp !== undefined ? pc.tempHp : (currentHero.tempHp || 0)),
        ac: pc.ac || currentHero.ac,
        alignment: pc.alignment || currentHero.alignment || "Neutral",
        playerName: pc.playerName && pc.playerName !== "N/A" ? pc.playerName : currentHero.playerName || "Companion",
        strength: getStat(pc, "strength", currentHero.strength || 10),
        dexterity: getStat(pc, "dexterity", currentHero.dexterity || 10),
        constitution: getStat(pc, "constitution", currentHero.constitution || 10),
        intelligence: getStat(pc, "intelligence", currentHero.intelligence || 10),
        wisdom: getStat(pc, "wisdom", currentHero.wisdom || 10),
        charisma: getStat(pc, "charisma", currentHero.charisma || 10),
        passivePerception: pc.passivePerception || currentHero.passivePerception,
        magicItems: mergedItems,
        inventory: pc.inventory || currentHero.inventory || [],
        spells: pc.spells || currentHero.spells || [],
        dndBeyondUrl: targetUrl.trim(),
        history: [
          ...(currentHero.history || []),
          {
            id: syncId,
            type: "level",
            value: `Level ${pc.level} ${pc.classType} (D&D Beyond Sync)`,
            date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            notes: `Successfully imported latest chronicle data: ${pc.name} is a Level ${pc.level} ${pc.race} ${pc.classType}${pc.subclass ? ` (${pc.subclass})` : ""}. ` + (updatesDesc.length > 0 
              ? `System adjustments: ${updatesDesc.join("; ")}`
              : "All tactical matrices and ability scores are fully synchronized to the sovereign online blueprint.")
          }
        ]
      };

      const updated = heroesList.map(h => h.id === currentHero.id ? updatedHero : h);
      await updateHeroes(updated);
      
      setHeroSyncSuccess(`Successfully synchronized stats for ${pc.name || currentHero.name}!`);
      setHeroPastedHtml("");
      setShowHeroPasteFallback(false);
      
      // Update our temporary edit states so they reflect immediately if in edit mode
      setEditHeroName(pc.name || editHeroName);
      setEditPlayerName(pc.playerName && pc.playerName !== "N/A" ? pc.playerName : editPlayerName);
      setEditClassType(pc.classType || editClassType);
      setEditSubclass(pc.subclass || editSubclass);
      setEditRace(pc.race || "Human");
      setEditLevel(pc.level || editLevel);
      setEditMaxHp(pc.maxHp || editMaxHp);
      setEditCurrentHp(pc.currentHp !== undefined ? pc.currentHp : (pc.maxHp || editCurrentHp));
      setEditTempHp(pc.hp?.temp !== undefined ? pc.hp.temp : (pc.tempHp !== undefined ? pc.tempHp : 0));
      setEditAc(pc.ac || editAc);
      setEditAlignment(pc.alignment || editAlignment);
      setEditPassivePerc(pc.passivePerception || editPassivePerc);
      setEditStr(pc.strength || editStr);
      setEditDex(pc.dexterity || editDex);
      setEditCon(pc.constitution || editCon);
      setEditInt(pc.intelligence || editInt);
      setEditWis(pc.wisdom || editWis);
      setEditCha(pc.charisma || editCha);
      setEditMagicItems(mergedItems);
      setEditHeroDndBeyondUrl(targetUrl.trim());

    } catch (err: any) {
      console.error("[Hero Sync Error]", err);
      setHeroSyncError(err.message || "Failed to parse character sheet. The URL might be wrong or unreachable.");
    } finally {
      setHeroSyncLoading(false);
    }
  }

  // Trigger sync via URL
  async function handleHeroSyncWithUrl(urlToUse: string) {
    if (!urlToUse.trim()) {
      setHeroSyncError("URL of the character sheet is required.");
      return;
    }
    await performHeroDndBeyondSync(urlToUse.trim());
  }

  // Trigger sync via pasted HTML helper
  async function handleHeroSyncWithPastedHtml(urlToUse: string) {
    if (!heroPastedHtml.trim()) {
      setHeroSyncError("Source HTML content is empty. Please open View Source or Inspect Element of your character sheet, and copy-paste it here.");
      return;
    }
    await performHeroDndBeyondSync(urlToUse.trim() || "https://www.dndbeyond.com/characters/pasted", heroPastedHtml);
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
      {/* D&D BEYOND CAMPAIGN REALM LINKER BAR */}
      <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_8px_20px_-6px_rgba(239,68,68,0.08)] relative overflow-hidden transition-all duration-300" id="dndbeyond-linker-panel">
        <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20 shrink-0">
            <Link2 className="w-5 h-5 shrink-0" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-fantasy font-extrabold tracking-wider text-zinc-100 uppercase flex items-center gap-2">
              D&D Beyond Campaign Linker
            </h3>
            {campaign.dndBeyondUrl ? (
              <div className="flex items-center gap-2 mt-0.5 min-w-0">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-semibold bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-500/10 shrink-0">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Linked
                </span>
                <a
                  href={campaign.dndBeyondUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-sans text-zinc-400 hover:text-red-400 transition truncate underline"
                >
                  {campaign.dndBeyondUrl}
                </a>
              </div>
            ) : (
              <p className="text-[10px] font-sans text-zinc-500 mt-0.5">
                No active campaign link connected to this realm.
              </p>
            )}
          </div>
        </div>

        <button
          onClick={() => {
            setSyncError(null);
            setSyncSuccessMessage(null);
            setShowCampaignLinkerModal(true);
          }}
          className="px-4 py-2 bg-zinc-900 hover:bg-red-950/20 text-zinc-200 hover:text-red-400 border border-zinc-800 hover:border-red-900/40 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>{campaign.dndBeyondUrl ? "Manage Link" : "Link Campaign"}</span>
        </button>

        {/* POP UP MODAL WINDOW */}
        <AnimatePresence>
          {showCampaignLinkerModal && (
            <div className="fixed inset-0 bg-zinc-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-xl w-full shadow-2xl relative overflow-hidden font-sans p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
                
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-red-500/15 text-red-500 rounded border border-red-500/20">
                      <Link2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-fantasy font-black tracking-wider text-zinc-100 uppercase">
                        ⚔️ D&D Beyond Codex Linker
                      </h3>
                      <p className="text-[10px] font-mono text-zinc-500">
                        Add, edit, or disconnect your campaign database
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCampaignLinkerModal(false)}
                    className="p-1.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 rounded-lg text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                    title="Close Realm Linker"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Form fields */}
                <div className="space-y-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
                      Campaign URL / Roster Portal
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                        <Globe className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        id="dndbeyond-url-input"
                        placeholder="e.g. https://www.dndbeyond.com/campaigns/1234567"
                        value={dndBeyondUrl}
                        onChange={(e) => setDndBeyondUrl(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-100 focus:border-red-500 focus:outline-none placeholder:text-zinc-650 font-sans"
                      />
                    </div>
                  </div>

                  {/* Operational Actions */}
                  <div className="flex flex-col sm:flex-row gap-2">
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
                      {campaign.dndBeyondUrl ? "Full Re-Sync Roster" : "Sync & Gather Companions"}
                    </button>

                    <button
                      onClick={async () => {
                        setDndSyncLoading(true);
                        setSyncError(null);
                        setSyncSuccessMessage(null);
                        try {
                          const updatedCamp: Campaign = {
                            ...campaign,
                            dndBeyondUrl: dndBeyondUrl.trim(),
                            updatedAt: new Date().toISOString()
                          };
                          await onUpdateCampaign(updatedCamp);
                          setSyncSuccessMessage("Campaign URL successfully saved to scroll!");
                        } catch (err: any) {
                          setSyncError("Failed to save campaign URL.");
                        } finally {
                          setDndSyncLoading(false);
                        }
                      }}
                      disabled={dndSyncLoading || !dndBeyondUrl.trim()}
                      className="py-2 px-3.5 bg-zinc-800 hover:bg-zinc-750 disabled:bg-zinc-900 disabled:text-zinc-650 border border-zinc-700 text-zinc-200 text-xs font-mono font-semibold rounded-lg cursor-pointer transition duration-150 flex items-center justify-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save Link Only
                    </button>
                    
                    {campaign.dndBeyondUrl && (
                      <button
                        onClick={async () => {
                          if (confirm("Are you sure you want to sever the D&D Beyond linkage? This will remove the campaign portal and clear associated campaign scrolls.")) {
                            await handleDisconnectDndBeyond();
                          }
                        }}
                        disabled={dndSyncLoading}
                        className="py-2 px-3 bg-zinc-950 hover:bg-red-950/30 hover:text-red-400 border border-zinc-850 hover:border-red-900/40 text-zinc-450 text-xs font-mono rounded-lg cursor-pointer transition duration-150"
                        title="Disconnect Campaign Link"
                      >
                        Disconnect Link
                      </button>
                    )}
                  </div>

                  {/* Sync Failures & Fallback Paste Container */}
                  {syncError && (
                    <div className="p-4 bg-red-950/20 border border-red-500/20 rounded-lg text-xs space-y-2.5 animate-fadeIn">
                      <div className="flex items-start gap-2.5 text-red-400">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                        <div className="space-y-1">
                          <p className="font-semibold uppercase tracking-wider font-fantasy">Automated Scribe Blocked</p>
                          <p className="text-zinc-350 font-sans leading-relaxed text-[11px]">{syncError}</p>
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
                    <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-lg space-y-3 font-sans">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold tracking-widest flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-purple-400 animate-pulse" /> Manual Webpage Source Sync
                        </span>
                        <span className="text-[9px] font-mono text-zinc-500 italic">Cloudflare Bypass Mode</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 font-sans space-y-1 leading-normal p-2.5 bg-zinc-900/40 border border-zinc-900 rounded">
                        <p>
                          Open campaign on <strong className="text-zinc-200">dndbeyond.com</strong>, right-click &rarr; <strong>"View Page Source"</strong> (or press <kbd className="bg-zinc-850 text-zinc-300 px-1 rounded text-[9px] font-mono">Ctrl/Cmd + U</kbd>), copy everything (<kbd className="bg-zinc-850 text-zinc-300 px-1 rounded text-[9px] font-mono">Ctrl/Cmd + A</kbd>), and paste below:
                        </p>
                      </div>
                      <textarea
                        id="dnd-pasted-html-textarea"
                        placeholder="Paste the full raw HTML here..."
                        value={pastedHtml}
                        onChange={(e) => setPastedHtml(e.target.value)}
                        className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-[10px] font-mono text-zinc-300 focus:border-purple-500 focus:outline-none placeholder:text-zinc-700 leading-normal"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSyncWithPastedHtml}
                          disabled={!pastedHtml.trim() || dndSyncLoading}
                          className="px-3.5 py-1.5 bg-purple-900/40 hover:bg-purple-900 disabled:bg-zinc-900 disabled:text-zinc-650 text-purple-200 border border-purple-500/30 text-xs font-mono font-bold tracking-wider rounded-lg cursor-pointer transition duration-150 flex items-center gap-1 select-none"
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
                            className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 text-xs font-mono transition"
                          >
                            Hide Panel
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Alignment Details & Logs */}
                  {syncSuccessMessage && (
                    <div className="p-4 bg-emerald-950/20 border border-emerald-500/25 rounded-lg text-xs space-y-2.5 animate-fadeIn">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <Check className="w-4 h-4 text-emerald-500" />
                        <span className="font-fantasy font-black tracking-widest text-xs uppercase">Roster Aligned!</span>
                      </div>
                      <p className="text-zinc-300 font-sans text-[11px] leading-normal">
                        {syncSuccessMessage}
                      </p>
                      {syncLogs.length > 0 && (
                        <div className="space-y-1 pl-2 border-l-2 border-emerald-500/35 font-sans text-[11px] max-h-36 overflow-y-auto">
                          {syncLogs.map((log, idx) => (
                            <p key={idx} className="text-zinc-350 leading-relaxed" dangerouslySetInnerHTML={{ __html: log.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
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
        <div 
          id="active-companion-roster-column"
          className={`lg:col-span-4 bg-zinc-950 p-4 border rounded-lg space-y-4 transition-all duration-300 ${
            campaign.dndBeyondUrl 
              ? "border-amber-500/20 border-t-2 border-t-amber-500/70 shadow-[0_4px_24px_-8px_rgba(245,158,11,0.06)]" 
              : "border-zinc-850"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-xs font-mono uppercase text-zinc-400 tracking-widest flex items-center gap-1.5 font-bold">
                <Flame className="w-4 h-4 text-red-500 animate-pulse" /> Active Companion Roster
              </h3>
              {campaign.dndBeyondUrl && (
                <div className="text-[9px] text-amber-500/80 font-mono tracking-tight flex items-center gap-1 uppercase font-bold">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                  Synced via D&D Beyond Link
                </div>
              )}
            </div>
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
                {campaign.dndBeyondUrl ? (
                  <span>
                    Your D&D Beyond Campaign is linked! Press <strong className="text-red-400">"Gather Companions"</strong> or <strong className="text-purple-400">"Synthesize Copied Source"</strong> above to populate & visualize your party roster.
                  </span>
                ) : (
                  <span>
                    No active player characters inscribed in the war scroll for this campaign. Add your first Hero (PC) or link a D&D Beyond campaign above to import automatically!
                  </span>
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] lg:max-h-[calc(100vh-150px)] xl:max-h-[calc(100vh-110px)] min-h-[350px] lg:min-h-[600px] overflow-y-auto pr-1">
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
                    
                    <div className="min-w-0 pr-2 space-y-1.5 z-10">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {hero.avatarUrl ? (
                          <img 
                            src={hero.avatarUrl} 
                            alt={hero.name} 
                            referrerPolicy="no-referrer"
                            className="w-4 h-4 rounded-full object-cover border border-zinc-700 shrink-0" 
                          />
                        ) : (
                          <User className={`w-3.5 h-3.5 ${isSelected ? "text-red-400" : "text-zinc-500"}`} />
                        )}
                        <h4 className="font-fantasy font-bold text-xs md:text-sm tracking-wide truncate">
                          {hero.name}
                        </h4>
                        {campaign.dndBeyondUrl && (
                          <span className="shrink-0 px-1 py-0.5 bg-red-950/40 border border-red-500/15 rounded text-[8px] font-mono font-bold text-red-400 uppercase tracking-tighter" title="Synchronized from active D&D Beyond campaign link">
                            D&D Beyond
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                        <span className="text-zinc-400">Lv {hero.level} {getHeroClassListString(hero)}</span>
                        <span>•</span>
                        <span className="font-bold text-zinc-550">{hero.playerName || "NPC/Dungeon"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 z-10 text-right">
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

          {campaign.dndBeyondUrl && (
            <div className="pt-3 border-t border-zinc-900/80 flex items-center justify-between text-[9px] font-mono text-zinc-500">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                D&D Beyond Runic Channel Secure 
              </span>
              <span className="text-zinc-650">Active Connection</span>
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
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-zinc-850 gap-4 bg-zinc-950/40 p-4 rounded-lg border-l-2 border-l-red-500 hover:border-l-red-400 transition-all duration-300 shadow-md" id="hero-header-caption">
                <div className="flex gap-4 items-center">
                  {currentHero.avatarUrl && (
                    <img 
                      src={currentHero.avatarUrl} 
                      alt={currentHero.name} 
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-full border-2 border-red-500/30 shadow-lg object-cover shrink-0" 
                    />
                  )}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-red-400 font-mono text-[10px] uppercase font-bold tracking-widest leading-none">
                      <Scroll className="w-3.5 h-3.5 text-red-500 animate-pulse" /> Chronicles of Heroic Sovereignty
                    </div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h2 className="font-fantasy font-black text-xl md:text-2xl text-zinc-100 tracking-wider uppercase leading-none">
                        {currentHero.name}
                      </h2>
                      {currentHero.subclass && (!currentHero.classes || currentHero.classes.length <= 1) && (
                        <span className="text-xs text-red-400 font-sans italic font-semibold">
                          ({currentHero.subclass})
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-3 text-xs text-zinc-400 font-sans flex-wrap">
                        <span className="font-medium text-red-400 bg-red-950/20 px-2 py-0.5 rounded border border-red-500/10">Level {currentHero.level} {currentHero.race || "Human"} {getHeroClassListString(currentHero)}</span>
                        <span className="text-zinc-700">•</span>
                        <span>Player: <span className="font-bold text-zinc-300">{currentHero.playerName || "The Companion"}</span></span>
                        {currentHero.alignment && (
                          <>
                            <span className="text-zinc-700">•</span>
                            <span className="text-zinc-455 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-[11px] font-medium">{currentHero.alignment}</span>
                          </>
                        )}
                      </div>

                      {/* Detailed Interactive Multiclassing status breakdown */}
                      <div className="flex flex-wrap items-center gap-2 mt-1 pt-1.5 border-t border-zinc-900/40">
                        {currentHero.classes && currentHero.classes.length > 0 ? (
                          <>
                            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-extrabold mr-1">
                              Classes & Multi-Classing status:
                            </span>
                            {currentHero.classes.map((c, i) => {
                              const extraDetails: string[] = [];
                              if (c.subclass) extraDetails.push(c.subclass);
                              if (c.domain) extraDetails.push(`${c.domain} Domain`);
                              if (c.school) extraDetails.push(`${c.school} School`);
                              if (c.specialization) extraDetails.push(c.specialization);
                              
                              return (
                                <div 
                                  key={i} 
                                  className="inline-flex flex-wrap items-center gap-1.5 px-2 py-1 bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 text-zinc-300 rounded-md text-xs transition duration-150 select-none"
                                >
                                  <span className="text-red-400 font-bold font-sans">{c.className}</span>
                                  {extraDetails.length > 0 && (
                                    <span className="text-zinc-400 italic text-[10px] bg-zinc-950/40 px-1.5 py-0.5 rounded border border-zinc-850">
                                      {extraDetails.join(" • ")}
                                    </span>
                                  )}
                                  <span className="font-mono bg-zinc-950 px-1.5 py-0.2 rounded text-[10px] text-zinc-400 font-bold">
                                    Lv {c.level}
                                  </span>
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-extrabold mr-1">
                              Class status:
                            </span>
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded text-xs">
                              <span className="text-red-400 font-bold font-sans">{currentHero.classType}</span>
                              {currentHero.subclass && <span className="text-zinc-400 italic text-[10px]">({currentHero.subclass})</span>}
                              <span className="font-mono bg-zinc-950 px-1.5 py-0.2 rounded text-[10px] text-zinc-400 font-bold">Lv {currentHero.level}</span>
                            </div>
                          </>
                        )}
                      </div>

                      {currentHero.importedAt && (
                        <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="px-1 py-0.2 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 text-[9px] uppercase font-semibold">
                            Source: {currentHero.sourceType === "auto" ? "D&D Beyond Link" : currentHero.sourceType === "pasted_json" ? "JSON Sheet" : currentHero.sourceType === "ai_parsed" ? "Gemini AI" : "Pasted Source"}
                          </span>
                          <span>•</span>
                          <span>Synced on {new Date(currentHero.importedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      )}
                    </div>
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

              {/* INDIVIDUAL D&D BEYOND PROFILE LINKER & SYNCRONIZER */}
              <div className="bg-zinc-900/30 p-3.5 border border-zinc-900 rounded-lg space-y-3.5" id="hero-dndbeyond-sync-panel">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1 px-2 bg-red-650/15 border border-red-500/20 text-red-400 rounded-md font-fantasy font-black text-[12px] uppercase tracking-wider flex items-center gap-1.5 select-none">
                      <Globe className="w-3.5 h-3.5 text-red-500 animate-pulse" /> D&D Beyond Link
                    </div>
                    {currentHero.dndBeyondUrl ? (
                      <a 
                        href={currentHero.dndBeyondUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-xs text-zinc-400 hover:text-red-405 flex items-center gap-1 font-sans underline transition"
                      >
                        Active Bio Sheet <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-500 italic font-sans select-none">No digital alignment bound.</span>
                    )}
                  </div>

                  {currentHero.dndBeyondUrl && !isEditingState && (
                    <button
                      onClick={() => handleHeroSyncWithUrl(currentHero.dndBeyondUrl || "")}
                      disabled={heroSyncLoading}
                      className="px-3 py-1 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-zinc-950 disabled:bg-zinc-900 disabled:text-zinc-650 border border-red-500/25 disabled:border-zinc-800 rounded text-[11px] font-mono transition flex items-center gap-1.5 font-bold cursor-pointer h-7"
                    >
                      <RefreshCw className={`w-3 h-3 ${heroSyncLoading ? "animate-spin" : ""}`} />
                      {heroSyncLoading ? "Sync stats..." : "Sync stats now"}
                    </button>
                  )}
                </div>

                {/* Sub-form when editing OR if no URL is linked yet */}
                {(isEditingState || !currentHero.dndBeyondUrl) && (
                  <div className="space-y-3.5 pt-1.5 font-sans">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="url"
                        value={isEditingState ? editHeroDndBeyondUrl : editHeroDndBeyondUrl || ""}
                        onChange={(e) => setEditHeroDndBeyondUrl(e.target.value)}
                        placeholder="Character Sheet URL (e.g. https://www.dndbeyond.com/characters/12345678)..."
                        className="flex-1 bg-zinc-950 border border-zinc-850 hover:border-zinc-700 focus:border-red-500 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-sans transition duration-200 focus:outline-none focus:ring-1 focus:ring-red-500/30 placeholder:text-zinc-650"
                      />
                      <button
                        type="button"
                        onClick={() => handleHeroSyncWithUrl(editHeroDndBeyondUrl)}
                        disabled={heroSyncLoading || !editHeroDndBeyondUrl.trim()}
                        className="px-4 py-1.5 bg-red-500 hover:bg-red-650 disabled:bg-zinc-900 disabled:text-zinc-600 text-zinc-955 font-bold font-sans rounded text-xs transition flex items-center gap-1.5 justify-center shrink-0 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${heroSyncLoading ? "animate-spin" : ""}`} />
                        Link & Sync File
                      </button>
                    </div>
                    {!currentHero.dndBeyondUrl && !isEditingState && (
                      <p className="text-[10px] text-zinc-500 leading-normal font-sans">
                        💡 Synchronizing auto-imports HP, AC, attribute matrices, subclasses, levels, and attunements. <strong>Note: Your D&D Beyond character sheet must be explicitly set to 'Public' to be imported.</strong>
                      </p>
                    )}
                  </div>
                )}

                {/* Success/Error Notification ribbons */}
                <AnimatePresence>
                  {heroSyncError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-red-955/20 border border-red-500/20 rounded-md text-xs space-y-2.5 text-zinc-300 font-sans"
                    >
                      <div className="flex items-start gap-1.5 text-red-400">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Mystic interference detected!</p>
                          <p className="text-zinc-400 mt-0.5 text-[11px]">{heroSyncError}</p>
                        </div>
                      </div>

                      {showHeroPasteFallback && (
                        <div className="space-y-2 pt-1.5 border-t border-red-500/10">
                          <label className="text-[10px] font-mono text-zinc-400 uppercase font-bold block">Pasted Character Page Source HTML</label>
                          <p className="text-[10px] text-zinc-500 leading-relaxed">
                            1. Open your D&D Beyond Character Sheet in a new browser tab.
                            <br />
                            2. Right-click anywhere on the page and select <strong>View Page Source</strong> (or press <code>Ctrl+U</code> / <code>Cmd+Option+U</code>).
                            <br />
                            3. Select everything (<code>Ctrl+A</code>) and copy it.
                            <br />
                            4. Paste it below and click synchronize to successfully sync your stats!
                          </p>
                          <textarea
                            value={heroPastedHtml}
                            onChange={(e) => setHeroPastedHtml(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-850 rounded px-2.5 py-1.5 text-[10px] text-zinc-150 font-mono h-24 focus:border-red-500 focus:outline-none placeholder:text-zinc-650"
                            placeholder="Paste <html> source code here..."
                          />
                          <button
                            type="button"
                            onClick={() => handleHeroSyncWithPastedHtml(editHeroDndBeyondUrl || currentHero.dndBeyondUrl || "")}
                            disabled={heroSyncLoading || !heroPastedHtml.trim()}
                            className="w-full py-1.5 bg-red-500 hover:bg-red-600 text-zinc-950 font-bold rounded text-xs transition cursor-pointer"
                          >
                            Synchronize via Raw HTML Source Scroll
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {heroSyncSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-2 px-3 bg-emerald-950/20 border border-emerald-500/20 rounded-md text-xs text-emerald-400 font-sans flex items-center gap-1.5 font-medium"
                    >
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{heroSyncSuccess}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
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

                  {/* MULTI-CLASS MANAGEMENT INTERFACE */}
                  <div className="p-3.5 bg-zinc-950 border border-zinc-850 rounded-lg space-y-3 pt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono font-black text-red-400 uppercase tracking-wide flex items-center gap-1.5 select-none">
                        <Swords className="w-3.5 h-3.5 text-red-500 animate-pulse" /> Classes & Multi-Classing System
                      </label>
                      <button
                        type="button"
                        onClick={handleAddClassToEdit}
                        className="px-2.5 py-1 bg-red-650 hover:bg-red-700 hover:text-zinc-100 text-zinc-950 rounded text-[10px] font-bold font-mono transition flex items-center gap-1 cursor-pointer"
                        id="btn-add-class-edit"
                      >
                        <Plus className="w-3 h-3" /> Add Class / Multi-Class
                      </button>
                      <div className="space-y-2.5">
                      {editClasses.map((cl, idx) => (
                        <div 
                          key={idx} 
                          className="p-3 bg-zinc-900/60 border border-zinc-900 rounded-lg space-y-3 relative group"
                        >
                          {/* Row 1: Header/Name/Level/Remove */}
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-850 font-bold">
                                Class #{idx + 1}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleRemoveClassFromEdit(idx)}
                                disabled={editClasses.length <= 1}
                                title="Remove Class"
                                className="px-2 py-1 bg-zinc-950 hover:bg-red-955/40 text-zinc-400 hover:text-red-400 rounded border border-zinc-850 disabled:opacity-35 disabled:hover:text-zinc-500 disabled:hover:bg-zinc-950 disabled:cursor-not-allowed transition duration-150 cursor-pointer text-[10px] flex items-center gap-1 font-mono"
                              >
                                <Trash2 className="w-3 h-3" /> Remove
                              </button>
                            </div>
                          </div>

                          {/* Row 2: Inputs */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                            {/* Class Name */}
                            <div className="md:col-span-4 space-y-0.5">
                              <span className="text-[9px] font-mono text-zinc-500 uppercase block font-semibold">Class Name</span>
                              <input
                                type="text"
                                value={cl.className}
                                onChange={(e) => handleChangeClassInEdit(idx, "className", e.target.value)}
                                placeholder="e.g. Cleric, Wizard, Paladin"
                                className="w-full bg-zinc-950 border border-zinc-850 rounded px-2.5 py-1 text-xs text-zinc-150 font-sans focus:border-red-500 focus:outline-none"
                              />
                            </div>

                            {/* Level */}
                            <div className="md:col-span-2 space-y-0.5">
                              <span className="text-[9px] font-mono text-zinc-500 uppercase block font-semibold">Level</span>
                              <input
                                type="number"
                                min="1"
                                max="20"
                                value={cl.level}
                                onChange={(e) => handleChangeClassInEdit(idx, "level", e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-850 rounded px-2.5 py-1 text-xs text-zinc-150 font-mono focus:border-red-500 focus:outline-none"
                              />
                            </div>

                            {/* Subclass */}
                            <div className="md:col-span-3 space-y-0.5">
                              <span className="text-[9px] font-mono text-zinc-500 uppercase block font-semibold">Subclass / Archetype</span>
                              <input
                                type="text"
                                value={cl.subclass || ""}
                                onChange={(e) => handleChangeClassInEdit(idx, "subclass", e.target.value)}
                                placeholder="e.g. Champion, Thief"
                                className="w-full bg-zinc-950 border border-zinc-850 rounded px-2.5 py-1 text-xs text-zinc-150 font-sans focus:border-red-500 focus:outline-none"
                              />
                            </div>

                            {/* Domain */}
                            <div className="md:col-span-3 space-y-0.5">
                              <span className="text-[9px] font-mono text-zinc-500 uppercase block font-semibold">Divine Domain</span>
                              <input
                                type="text"
                                value={cl.domain || ""}
                                onChange={(e) => handleChangeClassInEdit(idx, "domain", e.target.value)}
                                placeholder="e.g. Life, Tempest"
                                className="w-full bg-zinc-950 border border-zinc-850 rounded px-2.5 py-1 text-xs text-zinc-150 font-sans focus:border-red-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
                            {/* School */}
                            <div className="md:col-span-6 space-y-0.5">
                              <span className="text-[9px] font-mono text-zinc-500 uppercase block font-semibold">Arcane School</span>
                              <input
                                type="text"
                                value={cl.school || ""}
                                onChange={(e) => handleChangeClassInEdit(idx, "school", e.target.value)}
                                placeholder="e.g. Evocation, Necromancy"
                                className="w-full bg-zinc-950 border border-zinc-850 rounded px-2.5 py-1 text-xs text-zinc-150 font-sans focus:border-red-500 focus:outline-none"
                              />
                            </div>

                            {/* Specialization */}
                            <div className="md:col-span-6 space-y-0.5">
                              <span className="text-[9px] font-mono text-zinc-500 uppercase block font-semibold">Specialization (Oath, Circle, Patron, etc.)</span>
                              <input
                                type="text"
                                value={cl.specialization || ""}
                                onChange={(e) => handleChangeClassInEdit(idx, "specialization", e.target.value)}
                                placeholder="e.g. Oath of Devotion, Circle of the Moon"
                                className="w-full bg-zinc-950 border border-zinc-850 rounded px-2.5 py-1 text-xs text-zinc-150 font-sans focus:border-red-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-900/60 select-none">
                      <span className="italic">
                        * Total heroic level is calculated dynamically based on individual class levels.
                      </span>
                      <span className="font-bold text-red-400 bg-red-950/15 px-2 py-0.5 rounded border border-red-500/10">
                        Total Combined Level: {editClasses.reduce((sum, c) => sum + c.level, 0)}
                      </span>
                    </div>
                  </div>

                  {/* RACE & PASSIVE PERCEPTION ROW */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase block">Race / Lineage</label>
                      <input
                        type="text"
                        value={editRace}
                        onChange={(e) => setEditRace(e.target.value)}
                        placeholder="e.g. Elf, Human"
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

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 border-t border-zinc-850 pt-3">
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
                      <label className="text-[10px] font-mono text-amber-500 uppercase block">Temp HP</label>
                      <input
                        type="number"
                        min="0"
                        value={editTempHp}
                        onChange={(e) => setEditTempHp(parseInt(e.target.value) || 0)}
                        className="w-full bg-zinc-950 border border-amber-500/20 text-amber-400 rounded px-2.5 py-1.5 text-xs font-sans focus:border-amber-500 focus:outline-none"
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
                <div className="space-y-5">
                  
                  {/* Standard Ability Block Layout */}
                  <div className="bg-zinc-900/30 p-4 border border-zinc-850 rounded-lg flex flex-col justify-between">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block mb-1">Ability Score Matrix</span>
                    
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 my-2">
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

                  {/* Tactical Shield Widget: HP/AC indicators */}
                  <div className="bg-zinc-900/30 p-4 border border-zinc-850 rounded-lg relative">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                      
                      {/* Left Side: HP Details */}
                      <div className="md:col-span-8 space-y-4">
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
                            <span className="font-fantasy font-black text-xl tracking-wide flex items-center">
                              <span>{currentHero.currentHp}</span>
                              <span className="text-zinc-500 font-sans mx-1">/</span>
                              <span>{currentHero.maxHp}</span>
                              {currentHero.tempHp ? (
                                <span className="text-sm text-amber-400 font-sans font-extrabold ml-1.5" title="Active Temporary Hit Points buffer">
                                  (+{currentHero.tempHp} Temp)
                                </span>
                              ) : null}
                              <span className="text-xs text-zinc-500 font-sans ml-1">HP</span>
                            </span>
                          </div>
                          {/* Interactive health adjustment slider with temporary HP overlay */}
                          <div className="h-2.5 w-full bg-zinc-850 rounded-full overflow-hidden border border-zinc-950/40 relative flex">
                            <div
                              className={`h-full transition-all duration-350 ${
                                (currentHero.currentHp / currentHero.maxHp) > 0.5 
                                  ? "bg-emerald-500" 
                                  : (currentHero.currentHp / currentHero.maxHp) > 0.2 
                                    ? "bg-amber-500" 
                                    : "bg-red-500 animate-pulse"
                              }`}
                              style={{ width: `${Math.min(100, (currentHero.currentHp / currentHero.maxHp) * 100) || 0}%` }}
                            />
                            {currentHero.tempHp ? (
                              <div
                                className="h-full bg-yellow-500/85 transition-all duration-350 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                                style={{ width: `${Math.min(100 - Math.min(100, (currentHero.currentHp / currentHero.maxHp) * 100), (currentHero.tempHp / currentHero.maxHp) * 100)}%` }}
                                title={`Temporary Hit Points: ${currentHero.tempHp}`}
                              />
                            ) : null}
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

                          {/* Dedicated Temporary HP Section */}
                          <div className="bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/15 rounded-lg p-2.5 flex items-center justify-between gap-3 transition-colors mt-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-extrabold">Temporary HP</span>
                              </div>
                              <div className="text-xs text-zinc-300 font-sans font-medium">
                                Active Shield Buffer: <span className="text-amber-400 font-bold text-sm ml-1">{currentHero.tempHp || 0} HP</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => adjustTempHp(-1)}
                                className="w-7 h-7 rounded-md bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 text-xs flex items-center justify-center font-bold font-mono transition-all duration-150 cursor-pointer"
                                title="Decrease Temporary HP"
                              >
                                -1
                              </button>
                              <button
                                onClick={() => adjustTempHp(1)}
                                className="w-7 h-7 rounded-md bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 text-xs flex items-center justify-center font-bold font-mono transition-all duration-150 cursor-pointer"
                                title="Increase Temporary HP"
                              >
                                +1
                              </button>
                              <button
                                onClick={() => {
                                  const inputVal = prompt("Enter temporary hit points value:", String(currentHero.tempHp || 0));
                                  if (inputVal !== null) {
                                    const parsed = parseInt(inputVal, 10);
                                    if (!isNaN(parsed) && parsed >= 0) {
                                      adjustTempHp(parsed - (currentHero.tempHp || 0));
                                    }
                                  }
                                }}
                                className="px-2.5 h-7 rounded-md bg-zinc-850 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 text-zinc-200 text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer"
                              >
                                Set
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: AC Info Column */}
                      <div className="md:col-span-4 flex flex-col justify-center">
                        {/* ARMOR CLASS (AC) - Major Stat Widget */}
                        <div className="bg-gradient-to-b from-zinc-950 to-zinc-900/90 p-4 border border-zinc-800/60 rounded-xl flex items-center justify-between gap-4 transition duration-300 relative overflow-hidden group shadow-[0_4px_20px_rgba(0,0,0,0.45)] h-full">
                          {/* Decorative red gradient glow */}
                          <div className="absolute -right-12 -bottom-12 w-32 h-32 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/8 transition-all duration-500" />
                          <div className="absolute -left-6 -top-6 w-20 h-20 bg-zinc-500/5 rounded-full blur-xl" />

                          <div className="space-y-1.5 z-10 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-red-500/80 shrink-0" />
                              <span className="text-[10px] sm:text-xs font-mono text-zinc-400 uppercase tracking-widest font-bold">
                                Armor Class
                              </span>
                            </div>
                          </div>

                          {/* Majestic shield badge for AC value */}
                          <div className="relative flex items-center justify-center shrink-0 z-10 select-none">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-zinc-950 border-2 border-red-500/35 group-hover:border-red-500/55 flex flex-col items-center justify-center font-sans font-extrabold text-2xl sm:text-3xl text-red-400 transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.15)] group-hover:shadow-[0_0_20px_rgba(239,68,68,0.25)]">
                              <span className="leading-none">{currentHero.ac}</span>
                              <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5 font-bold">AC</span>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* SENSES (Passive Perception, Investigation, Insight) */}
                  {(() => {
                    const wisMod = Math.floor(((currentHero.wisdom || 10) - 10) / 2);
                    const intMod = Math.floor(((currentHero.intelligence || 10) - 10) / 2);
                    const level = currentHero.level || 1;
                    const profBonus = Math.floor((level - 1) / 4) + 2;

                    // Class proficiency checks
                    const isInvestigator = ["wizard", "rogue", "artificer", "bard"].includes((currentHero.classType || "").toLowerCase());
                    const isInsightful = ["cleric", "druid", "paladin", "bard", "rogue", "monk"].includes((currentHero.classType || "").toLowerCase());

                    // Passive values
                    const passivePerception = currentHero.passivePerception || (10 + wisMod);
                    const passiveInvestigation = 10 + intMod + (isInvestigator ? profBonus : 0);
                    const passiveInsight = 10 + wisMod + (isInsightful ? profBonus : 0);

                    // Get race-based special senses
                    const raceLower = (currentHero.race || "").toLowerCase();
                    let senseType = "Normal Vision";
                    if (raceLower.includes("drow") || raceLower.includes("dark elf") || raceLower.includes("underdark")) {
                      senseType = "Darkvision 120 ft.";
                    } else if (
                      raceLower.includes("elf") ||
                      raceLower.includes("dwarf") ||
                      raceLower.includes("gnome") ||
                      raceLower.includes("tiefling") ||
                      raceLower.includes("orc") ||
                      raceLower.includes("aasimar") ||
                      raceLower.includes("goblin") ||
                      raceLower.includes("kobold")
                    ) {
                      senseType = "Darkvision 60 ft.";
                    }

                    return (
                      <div className="bg-zinc-900/30 p-4 border border-zinc-850 rounded-lg flex flex-col justify-between hover:border-zinc-700 transition duration-150 relative">
                        {/* Title rows */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                          {/* Row 1: Passive Perception */}
                          <div className="relative flex items-center w-full h-8 sm:h-9">
                            <div className="absolute left-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-950 border border-rose-500/30 flex items-center justify-center font-sans font-extrabold text-xs sm:text-sm text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.1)] z-10">
                              {passivePerception}
                            </div>
                            <div className="w-full pl-6 sm:pl-7 pr-2 py-1 bg-zinc-900/60 border border-rose-500/20 rounded-r-md rounded-l-full text-center flex items-center justify-center ml-3 sm:ml-4 h-7 sm:h-8">
                              <span className="text-[7px] sm:text-[8px] md:text-[9px] font-sans font-bold tracking-wider text-zinc-300 uppercase truncate">
                                Passive Perception
                              </span>
                            </div>
                          </div>

                          {/* Row 2: Passive Investigation */}
                          <div className="relative flex items-center w-full h-8 sm:h-9">
                            <div className="absolute left-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-950 border border-rose-500/30 flex items-center justify-center font-sans font-extrabold text-xs sm:text-sm text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.1)] z-10">
                              {passiveInvestigation}
                            </div>
                            <div className="w-full pl-6 sm:pl-7 pr-2 py-1 bg-zinc-900/60 border border-rose-500/20 rounded-r-md rounded-l-full text-center flex items-center justify-center ml-3 sm:ml-4 h-7 sm:h-8">
                              <span className="text-[7px] sm:text-[8px] md:text-[9px] font-sans font-bold tracking-wider text-zinc-300 uppercase truncate">
                                Passive Investigation
                              </span>
                            </div>
                          </div>

                          {/* Row 3: Passive Insight */}
                          <div className="relative flex items-center w-full h-8 sm:h-9">
                            <div className="absolute left-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-950 border border-rose-500/30 flex items-center justify-center font-sans font-extrabold text-xs sm:text-sm text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.1)] z-10">
                              {passiveInsight}
                            </div>
                            <div className="w-full pl-6 sm:pl-7 pr-2 py-1 bg-zinc-900/60 border border-rose-500/20 rounded-r-md rounded-l-full text-center flex items-center justify-center ml-3 sm:ml-4 h-7 sm:h-8">
                              <span className="text-[7px] sm:text-[8px] md:text-[9px] font-sans font-bold tracking-wider text-zinc-300 uppercase truncate">
                                Passive Insight
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Special Sense Text (e.g. Darkvision) */}
                        <div className="text-center text-[10px] sm:text-xs text-zinc-400 font-sans mt-3 font-semibold tracking-wide">
                          {senseType}
                        </div>

                        {/* Title header at the bottom with Cog */}
                        <div className="flex items-center justify-center gap-1.5 mt-2.5 pt-1.5 border-t border-zinc-850/40 w-full">
                          <span className="text-[9px] sm:text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-extrabold">
                            Senses
                          </span>
                          <Settings className="w-3 h-3 text-zinc-600 animate-pulse" />
                        </div>
                      </div>
                    );
                  })()}

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

              {/* 3.5. COMPANION INVENTORY & GEAR */}
              <div className="bg-zinc-900/10 border border-zinc-850 rounded-lg p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-zinc-850/60 gap-2">
                  <h3 className="text-xs font-mono uppercase text-amber-500 tracking-wider flex items-center gap-1.5 font-bold">
                    <Briefcase className="w-4 h-4 text-amber-500" /> Equipped Gear & Pack Inventory ({currentHero.inventory?.length || 0} Items)
                  </h3>
                  
                  {/* Search and Filters */}
                  {currentHero.inventory && currentHero.inventory.length > 0 && (
                    <div className="flex gap-2 items-center">
                      <input 
                        type="text"
                        placeholder="Search gear..."
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                        className="bg-zinc-950 border border-zinc-850 rounded px-2 py-1 text-[10px] text-zinc-200 focus:outline-none focus:border-amber-500 font-mono w-28"
                      />
                      <select
                        value={inventoryFilter}
                        onChange={(e) => setInventoryFilter(e.target.value)}
                        className="bg-zinc-950 border border-zinc-850 rounded px-2 py-1 text-[10px] text-zinc-400 focus:outline-none font-mono"
                      >
                        <option value="all">All</option>
                        <option value="common">Common</option>
                        <option value="magic">Magic/Rare</option>
                      </select>
                    </div>
                  )}
                </div>

                {(!currentHero.inventory || currentHero.inventory.length === 0) ? (
                  <div className="py-4 text-center text-xs text-zinc-550 font-sans italic">
                    Pack is currently empty or no items imported. Try importing from D&D Beyond to populate this chest!
                  </div>
                ) : (
                  (() => {
                    const filtered = currentHero.inventory.filter(item => {
                      const matchesSearch = item.name.toLowerCase().includes(inventorySearch.toLowerCase()) || 
                                           (item.description && item.description.toLowerCase().includes(inventorySearch.toLowerCase()));
                      const rarityLower = item.rarity?.toLowerCase() || "";
                      const isMagic = ["uncommon", "rare", "very rare", "legendary", "artifact"].includes(rarityLower);
                      
                      if (inventoryFilter === "magic") return matchesSearch && isMagic;
                      if (inventoryFilter === "common") return matchesSearch && !isMagic;
                      return matchesSearch;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="py-4 text-center text-xs text-zinc-600 font-mono italic">
                          No items match your scrolls search.
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                        {filtered.map((item, idx) => {
                          const isMagic = ["uncommon", "rare", "very rare", "legendary", "artifact"].includes(item.rarity?.toLowerCase() || "");
                          return (
                            <div 
                              key={idx} 
                              className={`p-2 rounded border flex flex-col justify-between ${
                                isMagic 
                                  ? "bg-purple-950/5 border-purple-500/15" 
                                  : "bg-zinc-900/25 border-zinc-900"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <div>
                                  <span className={`text-[11px] font-semibold block leading-tight ${isMagic ? "text-purple-300 font-serif" : "text-zinc-300"}`}>
                                    {item.name}
                                  </span>
                                  <div className="flex flex-wrap items-center gap-1 mt-0.5 mb-1">
                                    {item.equipped && (
                                      <span className="text-[7.5px] uppercase tracking-wider px-1 py-0.2 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 font-bold rounded leading-none shrink-0">
                                        Equipped
                                      </span>
                                    )}
                                    {item.isAttuned && (
                                      <span className="text-[7.5px] uppercase tracking-wider px-1 py-0.2 bg-purple-950/40 border border-purple-500/20 text-purple-400 font-bold rounded leading-none shrink-0">
                                        Attuned
                                      </span>
                                    )}
                                  </div>
                                  {item.description && (
                                    <span className="text-[10px] text-zinc-500 line-clamp-1 leading-normal" title={item.description}>
                                      {item.description}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[9px] font-mono text-zinc-500 shrink-0 bg-zinc-950/60 px-1 py-0.2 rounded border border-zinc-850/30">
                                  Qty {item.quantity}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[9px] font-mono text-zinc-550 mt-1 pt-1 border-t border-zinc-850/30">
                                <span className={isMagic ? "text-purple-400 font-bold capitalize" : "text-zinc-500"}>
                                  {item.rarity || "Common"}
                                </span>
                                {item.weight !== undefined && (
                                  <span>{item.weight} lbs</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>

              {/* 3.6. GRIMOIRE & SPELLBOOK */}
              <div className="bg-zinc-900/10 border border-zinc-850 rounded-lg p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-zinc-850/60 gap-2">
                  <h3 className="text-xs font-mono uppercase text-sky-400 tracking-wider flex items-center gap-1.5 font-bold">
                    <BookOpen className="w-4 h-4 text-sky-400" /> Grimoire & Prepared Spellbook ({currentHero.spells?.length || 0} Spells)
                  </h3>

                  {/* Spell Filtering and Searching */}
                  {currentHero.spells && currentHero.spells.length > 0 && (
                    <div className="flex gap-2 items-center">
                      <input 
                        type="text"
                        placeholder="Search spells..."
                        value={spellSearch}
                        onChange={(e) => setSpellSearch(e.target.value)}
                        className="bg-zinc-950 border border-zinc-850 rounded px-2 py-1 text-[10px] text-zinc-200 focus:outline-none focus:border-sky-500 font-mono w-28"
                      />
                      <select
                        value={spellLevelFilter}
                        onChange={(e) => setSpellLevelFilter(e.target.value)}
                        className="bg-zinc-950 border border-zinc-850 rounded px-2 py-1 text-[10px] text-zinc-400 focus:outline-none font-mono"
                      >
                        <option value="all">All Levels</option>
                        <option value="0">Cantrips</option>
                        <option value="1">1st Level</option>
                        <option value="2">2nd Level</option>
                        <option value="3">3rd Level+</option>
                      </select>
                    </div>
                  )}
                </div>

                {(!currentHero.spells || currentHero.spells.length === 0) ? (
                  <div className="py-4 text-center text-xs text-zinc-550 font-sans italic">
                    Grimoire is currently vacant. Spellcasting companions imported from D&D Beyond automatically record all active spells.
                  </div>
                ) : (
                  (() => {
                    const filtered = currentHero.spells.filter(spell => {
                      const matchesSearch = spell.name.toLowerCase().includes(spellSearch.toLowerCase()) ||
                                           (spell.description && spell.description.toLowerCase().includes(spellSearch.toLowerCase())) ||
                                           (spell.school && spell.school.toLowerCase().includes(spellSearch.toLowerCase()));
                      
                      if (spellLevelFilter === "0") return matchesSearch && spell.level === 0;
                      if (spellLevelFilter === "1") return matchesSearch && spell.level === 1;
                      if (spellLevelFilter === "2") return matchesSearch && spell.level === 2;
                      if (spellLevelFilter === "3") return matchesSearch && spell.level >= 3;
                      return matchesSearch;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="py-4 text-center text-xs text-zinc-600 font-mono italic">
                          No scrolls match your magical search query.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {filtered.map((spell, idx) => {
                          const isExpanded = expandedSpellName === spell.name;
                          return (
                            <div 
                              key={idx}
                              className="bg-zinc-900/25 border border-zinc-900 rounded hover:border-zinc-850 transition overflow-hidden text-left"
                            >
                              <div 
                                onClick={() => setExpandedSpellName(isExpanded ? null : spell.name)}
                                className="p-2.5 flex items-center justify-between cursor-pointer select-none"
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${spell.level === 0 ? "bg-zinc-500" : "bg-sky-500 animate-pulse"}`} />
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[11px] font-bold text-zinc-200 block leading-tight font-serif">
                                        {spell.name}
                                      </span>
                                      {spell.prepared !== undefined && (
                                        <span className={`text-[7.5px] uppercase tracking-wider px-1 py-0.2 font-bold rounded leading-none shrink-0 ${
                                          spell.prepared 
                                            ? "bg-sky-950/40 border border-sky-500/25 text-sky-400" 
                                            : "bg-zinc-800/40 border border-zinc-700/20 text-zinc-400"
                                        }`}>
                                          {spell.prepared ? "Prepared" : "Grimoire"}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[9px] font-mono text-zinc-500">
                                      {spell.level === 0 ? "Cantrip" : `${spell.level} Level`} • {spell.school || "Evocation"}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {spell.range && (
                                    <span className="text-[9px] font-mono text-zinc-550 border border-zinc-850/50 bg-zinc-950/30 px-1 py-0.2 rounded hidden sm:inline">
                                      {spell.range}
                                    </span>
                                  )}
                                  <span className="text-zinc-600 hover:text-zinc-350">
                                    {isExpanded ? "[-]" : "[+]"}
                                  </span>
                                </div>
                              </div>

                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="px-2.5 pb-2.5 pt-1 bg-zinc-950/40 border-t border-zinc-900/60 text-[10px] text-zinc-400 space-y-2 font-sans"
                                  >
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[9px] font-mono text-zinc-550 pb-1.5 border-b border-zinc-900">
                                      <div><span className="text-zinc-650">Cast:</span> {spell.castingTime || "1 Action"}</div>
                                      <div><span className="text-zinc-650">Range:</span> {spell.range || "Self"}</div>
                                      <div><span className="text-zinc-650">Duration:</span> {spell.duration || "Instantaneous"}</div>
                                      <div><span className="text-zinc-650">Comps:</span> {Array.isArray(spell.components) ? spell.components.join(", ") : (spell.components || "V/S/M")}</div>
                                    </div>
                                    {spell.description ? (
                                      <p className="leading-relaxed whitespace-pre-wrap">{spell.description}</p>
                                    ) : (
                                      <p className="italic text-zinc-550 font-mono">No description inscribed.</p>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
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
                onClick={() => {
                  setShowAddHeroModal(false);
                  setImporterError(null);
                  setImporterSuccess(null);
                }}
                className="p-1 hover:bg-zinc-900 rounded text-zinc-400 hover:text-zinc-250 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Selectors */}
            <div className="grid grid-cols-4 bg-zinc-950 p-1 rounded-lg border border-zinc-850/50 mb-4">
              <button 
                type="button"
                onClick={() => { setImporterActiveTab("manual"); setImporterError(null); }}
                className={`py-1.5 text-[10px] font-mono uppercase font-semibold rounded transition cursor-pointer ${importerActiveTab === "manual" ? "bg-red-500/10 border border-red-500/20 text-red-400 font-bold" : "text-zinc-400 hover:text-zinc-100"}`}
              >
                Manual
              </button>
              <button 
                type="button"
                onClick={() => { setImporterActiveTab("auto"); setImporterError(null); }}
                className={`py-1.5 text-[10px] font-mono uppercase font-semibold rounded transition cursor-pointer ${importerActiveTab === "auto" ? "bg-red-500/10 border border-red-500/20 text-red-400 font-bold" : "text-zinc-400 hover:text-zinc-100"}`}
              >
                Auto URL
              </button>
              <button 
                type="button"
                onClick={() => { setImporterActiveTab("ai"); setImporterError(null); }}
                className={`py-1.5 text-[10px] font-mono uppercase font-semibold rounded transition cursor-pointer ${importerActiveTab === "ai" ? "bg-red-500/10 border border-red-500/20 text-red-400 font-bold" : "text-zinc-400 hover:text-zinc-100"}`}
              >
                AI Parser
              </button>
              <button 
                type="button"
                onClick={() => { setImporterActiveTab("json"); setImporterError(null); }}
                className={`py-1.5 text-[10px] font-mono uppercase font-semibold rounded transition cursor-pointer ${importerActiveTab === "json" ? "bg-red-500/10 border border-red-500/20 text-red-400 font-bold" : "text-zinc-400 hover:text-zinc-100"}`}
              >
                Paste JSON
              </button>
            </div>

            {/* TAB 1: MANUAL ENTRY */}
            {importerActiveTab === "manual" && (
              <form onSubmit={handleAddHero} className="space-y-4 font-sans">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
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

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-zinc-455 uppercase block">Race / Lineage</label>
                    <input
                      type="text"
                      value={newHeroRace}
                      onChange={(e) => setNewHeroRace(e.target.value)}
                      placeholder="e.g. Human, Elf, dwarf..."
                      className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-1.8 text-xs text-zinc-100 focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                {/* Class Selection Patterns */}
                <div className="space-y-3.5 border-t border-zinc-900 pt-3">
                  <span className="text-[10px] font-mono text-zinc-455 uppercase block">Companion Class Blueprint</span>
                  
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
                    onClick={() => {
                      setShowAddHeroModal(false);
                      setImporterError(null);
                      setImporterSuccess(null);
                    }}
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
            )}

            {/* TAB 2: AUTO URL */}
            {importerActiveTab === "auto" && (
              <form onSubmit={handleImporterAutoSubmit} className="space-y-4 font-sans text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-zinc-455 uppercase block font-bold tracking-wider">D&D Beyond Character ID or URL</label>
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="e.g., https://www.dndbeyond.com/characters/149257248 or just 149257248"
                      value={importerAutoInput}
                      onChange={(e) => setImporterAutoInput(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-red-500 font-mono pr-9"
                    />
                    <Link2 className="absolute right-3 top-2.5 w-4 h-4 text-zinc-650" />
                  </div>
                  <div className="p-3 bg-zinc-900/40 rounded border border-zinc-850/60 text-[11px] text-zinc-400 space-y-1">
                    <p className="font-semibold text-red-400 flex items-center gap-1 font-fantasy uppercase tracking-wider">
                      <Info className="w-3.5 h-3.5 text-red-500" /> Importer Requirements:
                    </p>
                    <ul className="list-disc pl-4 space-y-1 leading-normal">
                      <li>The character sheet privacy configuration on D&D Beyond MUST be set to <strong className="text-zinc-100 font-semibold">Public</strong>.</li>
                      <li>To configure privacy, edit character &rarr; <em className="not-italic text-red-400 font-medium font-mono">Preferences</em> &rarr; <em className="not-italic text-red-400 font-medium font-mono">Character Privacy</em> &rarr; <em className="not-italic text-red-400 font-medium font-mono">Public</em>.</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-zinc-850">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddHeroModal(false);
                      setImporterError(null);
                      setImporterSuccess(null);
                    }}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 text-xs rounded transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={importerLoading || !importerAutoInput.trim()}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-zinc-900 disabled:text-zinc-650 text-zinc-950 text-xs font-bold rounded transition cursor-pointer flex items-center gap-1"
                  >
                    {importerLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Fetching D&D Beyond...
                      </>
                    ) : (
                      <>
                        <Import className="w-3.5 h-3.5 text-zinc-950" /> Inscribe Character
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: AI PARSER */}
            {importerActiveTab === "ai" && (
              <form onSubmit={handleImporterAiSubmit} className="space-y-4 font-sans text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-zinc-455 uppercase block font-bold tracking-wider">Unstructured Character Text Block</label>
                  <textarea 
                    placeholder="Paste anything here! Examples:
- Copy-pasted text from your character's active D&D Beyond page (Ctrl+A / Ctrl+C)
- PDF exported text snippet
- Rich text stat breakdown block"
                    rows={8}
                    value={importerPasteTextInput}
                    onChange={(e) => setImporterPasteTextInput(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-850 rounded p-3 text-xs text-zinc-200 focus:outline-none focus:border-red-500 font-sans leading-relaxed"
                  />
                  <p className="text-[10px] text-zinc-500 font-mono">Gemini AI will automatically study the text and parse stats, classes, levels, inventory, and spells into a complete character model.</p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-zinc-850">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddHeroModal(false);
                      setImporterError(null);
                      setImporterSuccess(null);
                    }}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 text-xs rounded transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={importerLoading || !importerPasteTextInput.trim()}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-zinc-900 disabled:text-zinc-655 text-zinc-950 text-xs font-bold rounded transition cursor-pointer flex items-center gap-1"
                  >
                    {importerLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> AI analyzing scrolls...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 fill-zinc-950" /> Let Gemini AI Parse Text
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 4: PASTE JSON */}
            {importerActiveTab === "json" && (
              <form onSubmit={handleImporterPasteJsonSubmit} className="space-y-4 font-sans text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-zinc-455 uppercase block font-bold tracking-wider">Raw Character Service JSON object</label>
                  <textarea 
                    placeholder="Paste the raw JSON object from character-service..."
                    rows={8}
                    value={importerPasteJsonInput}
                    onChange={(e) => setImporterPasteJsonInput(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-850 rounded p-3 text-[11px] text-zinc-300 focus:outline-none focus:border-red-500 font-mono"
                  />
                  <div className="p-3 bg-zinc-900/40 rounded border border-zinc-850/60 text-[11px] text-zinc-400 space-y-1">
                    <p className="font-semibold text-red-400 flex items-center gap-1 font-fantasy uppercase tracking-wider">
                      <ExternalLink className="w-3.5 h-3.5 text-red-500 animate-pulse" /> Direct Paste / Cloudflare Bypass Method:
                    </p>
                    <ol className="list-decimal pl-4 space-y-1 leading-normal">
                      <li>Obtain your character ID from your sheet's URL (e.g. 149257248).</li>
                      <li>Visit <a href="https://character-service.dndbeyond.com/character/v5/character/149257248" target="_blank" rel="noreferrer" className="text-red-400 underline hover:text-red-300">character-service.dndbeyond.com/character/v5/character/YOUR_ID</a> (replace with your ID).</li>
                      <li>Copy everything (Ctrl+A / Ctrl+C) and paste the raw JSON above. This fail-safe bypasses any browser Cloudflare blocks.</li>
                    </ol>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-zinc-850">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddHeroModal(false);
                      setImporterError(null);
                      setImporterSuccess(null);
                    }}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 text-xs rounded transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={importerLoading || !importerPasteJsonInput.trim()}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-zinc-900 disabled:text-zinc-655 text-zinc-950 text-xs font-bold rounded transition cursor-pointer flex items-center gap-1"
                  >
                    {importerLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Slicing JSON...
                      </>
                    ) : (
                      <>
                        <FileText className="w-3.5 h-3.5 text-zinc-950" /> Inscribe via JSON
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Error & Success indicators inside modal */}
            <AnimatePresence mode="wait">
              {importerError && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 bg-red-950/20 border border-red-900/40 rounded flex gap-2.5 text-xs text-red-200"
                >
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold font-mono text-[10px] uppercase text-red-400 block">Importer Alert:</span>
                    <p className="mt-1 leading-relaxed text-zinc-350 font-sans">{importerError}</p>
                  </div>
                </motion.div>
              )}

              {importerSuccess && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded flex gap-2.5 text-xs text-emerald-200"
                >
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold font-fantasy text-emerald-400 tracking-wide uppercase">{importerSuccess}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
