import { Campaign, Session } from "../types";
import {
  createNewCampaign,
  createNewSession,
  fetchAllCampaigns,
  fetchAllSessions,
  updateExistingCampaign,
  updateExistingSession,
} from "../storage";

export interface CampaignArchiveData {
  schemaVersion: "dma-campaign-archive-v1";
  exportedAt: string;
  exportedByApp: "Dungeon Master Assistant";
  campaign: Campaign;
  sessions: Session[];
  stats: {
    totalSessions: number;
    totalHeroes: number;
    totalCharacters: number;
    totalHighlights: number;
    hasAudioNotesCount: number;
    hasAiSummariesCount: number;
    earliestSessionDate?: string;
    latestSessionDate?: string;
  };
}

// Helper to sanitize campaign name for safe filename
function sanitizeFilename(name: string): string {
  const clean = name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return clean || "campaign";
}

// Builds the archive structure from a campaign and its sessions
export function buildCampaignArchive(campaign: Campaign, allSessions: Session[]): CampaignArchiveData {
  // Filter sessions that belong to this campaign
  const campaignSessions = allSessions.filter((s) => s.campaignId === campaign.id);

  // Sort sessions chronologically by date / order
  const sortedSessions = [...campaignSessions].sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    return timeA - timeB;
  });

  // Calculate statistics
  let totalCharacters = 0;
  let totalHighlights = 0;
  let hasAudioNotesCount = 0;
  let hasAiSummariesCount = 0;
  const dates: number[] = [];

  sortedSessions.forEach((s) => {
    if (s.characters && Array.isArray(s.characters)) {
      totalCharacters += s.characters.length;
    }
    if (s.highlights && Array.isArray(s.highlights)) {
      totalHighlights += s.highlights.length;
    }
    if (s.audioSessionNotes || s.audioTranscription) {
      hasAudioNotesCount++;
    }
    if (s.summary && s.summary.trim().length > 0) {
      hasAiSummariesCount++;
    }
    if (s.date) {
      const parsed = new Date(s.date).getTime();
      if (!isNaN(parsed)) dates.push(parsed);
    }
  });

  const datesSorted = dates.sort((a, b) => a - b);
  const earliestSessionDate = datesSorted.length > 0 ? new Date(datesSorted[0]).toISOString().split("T")[0] : undefined;
  const latestSessionDate = datesSorted.length > 0 ? new Date(datesSorted[datesSorted.length - 1]).toISOString().split("T")[0] : undefined;

  return {
    schemaVersion: "dma-campaign-archive-v1",
    exportedAt: new Date().toISOString(),
    exportedByApp: "Dungeon Master Assistant",
    campaign: {
      ...campaign,
    },
    sessions: sortedSessions,
    stats: {
      totalSessions: sortedSessions.length,
      totalHeroes: campaign.heroes?.length || 0,
      totalCharacters,
      totalHighlights,
      hasAudioNotesCount,
      hasAiSummariesCount,
      earliestSessionDate,
      latestSessionDate,
    },
  };
}

// Triggers a client-side JSON download of the campaign archive
export function downloadCampaignArchive(
  campaign: Campaign,
  allSessions: Session[]
): { fileName: string; sizeBytes: number; data: CampaignArchiveData } {
  const archive = buildCampaignArchive(campaign, allSessions);
  const jsonString = JSON.stringify(archive, null, 2);
  const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
  const sizeBytes = blob.size;

  const dateStr = new Date().toISOString().split("T")[0];
  const safeName = sanitizeFilename(campaign.name);
  const fileName = `dma-archive-${safeName}-${dateStr}.json`;

  // Create temporary anchor and trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);

  return { fileName, sizeBytes, data: archive };
}

// Validates whether an uploaded/pasted JSON is a valid campaign archive
export function validateAndParseArchive(rawInput: string | any): {
  valid: boolean;
  data?: CampaignArchiveData;
  error?: string;
} {
  try {
    let parsed: any;
    if (typeof rawInput === "string") {
      parsed = JSON.parse(rawInput.trim());
    } else {
      parsed = rawInput;
    }

    if (!parsed || typeof parsed !== "object") {
      return { valid: false, error: "The provided content is not a valid JSON object." };
    }

    // Standard Schema check or flexible fallback
    let campaign: Campaign | null = null;
    let sessions: Session[] = [];

    if (parsed.schemaVersion === "dma-campaign-archive-v1" && parsed.campaign) {
      campaign = parsed.campaign;
      sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    } else if (parsed.campaign && typeof parsed.campaign === "object") {
      campaign = parsed.campaign;
      sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    } else if (parsed.name && (parsed.setting !== undefined || parsed.description !== undefined)) {
      // Flat campaign object containing sessions
      const { sessions: rawSessions, ...campFields } = parsed;
      campaign = campFields as Campaign;
      sessions = Array.isArray(rawSessions) ? rawSessions : [];
    }

    if (!campaign || !campaign.name) {
      return {
        valid: false,
        error: "Missing required campaign data: Campaign name was not found in the archive.",
      };
    }

    // Hand-written or older archives may lack an id; "restore IDs" mode needs one to write to
    if (!campaign.id) {
      campaign = { ...campaign, id: `campaign-${Date.now()}-${Math.random().toString(36).substring(2, 6)}` };
    }

    // Ensure session properties are well structured, keeping fields not normalized here (e.g. capture)
    const validSessions: Session[] = sessions.map((s, idx) => ({
      ...s,
      id: s.id || `session-${Date.now()}-${idx}`,
      userId: s.userId || "local_guest_dm",
      campaignId: campaign!.id,
      title: s.title || `Chapter ${idx + 1}`,
      date: s.date || new Date().toISOString().split("T")[0],
      notes: s.notes || "",
      playerNotes: s.playerNotes || "",
      audioUrl: s.audioUrl,
      audioTranscription: s.audioTranscription,
      audioSessionNotes: s.audioSessionNotes,
      summary: s.summary || "",
      videoUrl: s.videoUrl,
      videoOperationName: s.videoOperationName,
      videoStatus: s.videoStatus || "idle",
      highlights: Array.isArray(s.highlights) ? s.highlights : [],
      characters: Array.isArray(s.characters) ? s.characters : [],
      createdAt: s.createdAt || new Date().toISOString(),
      updatedAt: s.updatedAt || new Date().toISOString(),
      order: s.order !== undefined ? s.order : idx + 1,
    }));

    // Build finalized verified structure
    const archiveData = buildCampaignArchive(campaign, validSessions);

    return {
      valid: true,
      data: archiveData,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `JSON parse error: ${err.message || "Failed to parse archive file."}`,
    };
  }
}

// Imports an archive into the system, persisting campaign and sessions
export async function importCampaignArchive({
  archiveData,
  activeUserId,
  mode = "new_campaign",
}: {
  archiveData: CampaignArchiveData;
  activeUserId: string;
  mode?: "new_campaign" | "restore_ids";
}): Promise<{
  importedCampaign: Campaign;
  importedSessionsCount: number;
}> {
  const isNew = mode === "new_campaign";
  const timestampISO = new Date().toISOString();

  // Generate target campaign ID
  const targetCampaignId = isNew
    ? `campaign-imported-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    : archiveData.campaign.id;

  const targetCampaignName = isNew
    ? `${archiveData.campaign.name} (Restored)`
    : archiveData.campaign.name;

  const campaignToSave: Campaign = {
    ...archiveData.campaign,
    id: targetCampaignId,
    userId: activeUserId,
    name: targetCampaignName,
    createdAt: isNew ? timestampISO : archiveData.campaign.createdAt || timestampISO,
    updatedAt: timestampISO,
  };

  // Restoring onto records that still exist must update them: Firestore rules reject a create over an existing doc
  const existingCampaignIds = isNew ? new Set<string>() : new Set((await fetchAllCampaigns(activeUserId)).map((c) => c.id));
  const existingSessionIds = isNew ? new Set<string>() : new Set((await fetchAllSessions(activeUserId)).map((s) => s.id));

  // 1. Create the campaign
  if (existingCampaignIds.has(targetCampaignId)) {
    await updateExistingCampaign(campaignToSave);
  } else {
    await createNewCampaign(campaignToSave);
  }

  // 2. Create the associated sessions
  let importedCount = 0;
  for (let i = 0; i < archiveData.sessions.length; i++) {
    const s = archiveData.sessions[i];
    const targetSessionId = isNew
      ? `session-imported-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`
      : s.id;

    const sessionToSave: Session = {
      ...s,
      id: targetSessionId,
      campaignId: targetCampaignId,
      userId: activeUserId,
      createdAt: isNew ? timestampISO : s.createdAt || timestampISO,
      updatedAt: timestampISO,
      order: s.order !== undefined ? s.order : i + 1,
    };

    if (existingSessionIds.has(targetSessionId)) {
      await updateExistingSession(sessionToSave);
    } else {
      await createNewSession(sessionToSave);
    }
    importedCount++;
  }

  return {
    importedCampaign: campaignToSave,
    importedSessionsCount: importedCount,
  };
}
