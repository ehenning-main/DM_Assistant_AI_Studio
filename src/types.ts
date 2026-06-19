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
}

export interface Session {
  id: string;
  userId: string;
  title: string;
  date: string;
  notes: string;
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
