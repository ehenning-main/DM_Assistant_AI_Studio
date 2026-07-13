export interface HighlightItem {
  id: string;
  imageUrl: string;
  caption: string;
}

export interface CharacterItem {
  id: string;
  name: string;
  role: string; // e.g. "NPC Ally", "Boss Villain", "Hero Player"
  description: string;
  hp?: number;
  ac?: number;
  alignment?: string;
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  skills_or_actions?: string;
  isCustomStatsCreated?: boolean;
}

export interface Campaign {
  id: string;
  userId: string;
  name: string;
  setting: string;
  description: string;
  heroes?: HeroCharacter[];
  dndBeyondUrl?: string;
  dndBeyondNotes?: string;
  createdAt: any;
  updatedAt: any;
}

export interface HeroProgressionRecord {
  id: string;
  type: "level" | "magic_item";
  value: string; // e.g., "Level 5" or "Flame Tongue Longsword"
  date: string;  // e.g., "June 23, 2026"
  notes: string; // e.g., "Defeated the goblin warpriest in Chapter 2"
}

export interface HeroCharacter {
  id: string;
  name: string;
  classType: string; // Class like Fighter, Wizard, Paladin, Cleric, etc.
  subclass?: string;
  classes?: Array<{
    className: string;
    level: number;
    subclass?: string;
    domain?: string;
    school?: string;
    specialization?: string; // e.g., Divine Oath, Warlock Patron, Druid Circle
  }>;
  level: number;
  maxHp: number;
  currentHp: number;
  tempHp?: number;
  ac: number;
  playerName?: string;
  alignment?: string;
  race?: string;
  passivePerception?: number;
  activeStatus?: string; // e.g. "Healthy", "Poisoned", "Unconscious", "Exhausted"
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  magicItems: string[]; // Current roster of magic items
  history: HeroProgressionRecord[];
  dndBeyondUrl?: string;
  avatarUrl?: string;
  inventory?: Array<{
    name: string;
    description: string;
    quantity: number;
    equipped: boolean;
    type?: string;
    rarity?: string;
    weight?: number;
    isAttuned?: boolean;
  }>;
  spells?: Array<{
    name: string;
    level: number;
    school?: string;
    description: string;
    range?: string;
    castingTime?: string;
    components?: string[];
    duration?: string;
    prepared?: boolean;
  }>;
  sourceType?: "auto" | "pasted_json" | "ai_parsed";
  importedAt?: string;
}

export interface Session {
  id: string;
  userId: string;
  campaignId: string;
  title: string;
  date: string;
  notes: string;
  playerNotes?: string;
  audioUrl?: string;
  audioTranscription?: string;
  summary?: string;
  videoUrl?: string;
  videoOperationName?: string;
  videoStatus?: "idle" | "generating" | "done" | "error";
  highlights: HighlightItem[];
  characters: CharacterItem[];
  createdAt: any; // Firestore Timestamp on save
  updatedAt: any;
}
