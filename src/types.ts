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
  level: number;
  maxHp: number;
  currentHp: number;
  ac: number;
  playerName?: string;
  alignment?: string;
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
