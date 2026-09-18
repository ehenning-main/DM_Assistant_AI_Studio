export interface HighlightItem {
  id: string;
  imageUrl: string;
  caption: string;
  optimizedPrompt?: string;
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
  previousChapters?: Array<{ id: string; title: string; date: string }>;
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

export interface AudioSpeaker {
  id: string;
  label: string; // e.g. "Dungeon Master (DM)", "Balasar (Eric)", etc.
  role: "DM" | "Player" | "NPC" | "OOC";
  characterName?: string;
  playerName?: string;
  voiceCharacteristics?: string; // e.g. "Deep baritone, narrator cadence", "Fast, high-energy"
}

export interface AudioInGameMoment {
  category: "plot" | "combat" | "roleplay" | "loot" | "exploration";
  title: string;
  description: string;
  speakersInvolved?: string[];
  timestamp?: string;
}

export interface AudioOutOfCharacterMoment {
  category: "rules" | "banter" | "strategy" | "logistics";
  title: string;
  description: string;
  speakersInvolved?: string[];
  timestamp?: string;
}

export interface SessionAudioItem {
  id: string;
  source: "local" | "google_drive" | "live_mic" | "simulation";
  name: string;
  blob?: Blob;
  driveFile?: DriveAudioFile;
  sizeBytes: number;
  sizeStr: string;
  timestamp: number; // Unix epoch milliseconds
  timestampLabel: string; // e.g. "Sep 17, 19:30:00"
  timestampSource: "metadata" | "filename_time" | "filename_sequence" | "manual";
  estimatedDurationSeconds: number;
  estimatedDurationStr: string;
  order: number; // 1-based chronological index
  sessionTimeRange?: string; // e.g. "00:00:00 - 00:45:00"
  status: "pending" | "processing" | "completed" | "error";
  error?: string;
}

export interface AudioSessionAnalysis {
  transcript: string; // Full dialogue transcript with speaker labels and timestamps
  speakers: AudioSpeaker[];
  inGameMoments: AudioInGameMoment[];
  outOfCharacterMoments: AudioOutOfCharacterMoment[];
  processedAt?: string;
  fileName?: string;
  fileNames?: string[];
  fileCount?: number;
  fileDuration?: string;
  overallAudioNotesMarkdown?: string;
  chunkCount?: number;
  sourceType?: "local_upload" | "google_drive" | "live_mic" | "simulation" | "multi_file";
  driveFileId?: string;
}

export interface DriveAudioFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  sizeBytes?: number;
  modifiedTime?: string;
  iconLink?: string;
  thumbnailLink?: string;
}

export interface AudioChunkProgress {
  currentChunk: number;
  totalChunks: number;
  timeRangeLabel: string;
  percentage: number;
  stageMessage: string;
  isComplete: boolean;
  partialTranscript: string;
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
  audioSessionNotes?: AudioSessionAnalysis;
  summary?: string;
  videoUrl?: string;
  videoOperationName?: string;
  videoStatus?: "idle" | "generating" | "done" | "error";
  highlights: HighlightItem[];
  characters: CharacterItem[];
  createdAt: any; // Firestore Timestamp on save
  updatedAt: any;
  order?: number;
}
