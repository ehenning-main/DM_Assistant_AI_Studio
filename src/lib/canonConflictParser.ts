export interface CanonConflictItem {
  id: string;
  topic: string;
  dmRecord: string;
  playerRecord: string;
  defaultRuling?: string;
}

/**
 * Sample fallback conflicts for testing/demonstration when no raw conflicts are parsed.
 */
export const SAMPLE_CANON_CONFLICTS: CanonConflictItem[] = [
  {
    id: "sample-conflict-1",
    topic: "Bounty & Gold Reward Amount",
    dmRecord: "DM Scribe Log: Party received 200 Gold Pieces from the Town Mayor.",
    playerRecord: "Player Journal: Recorded receiving 500 Gold Pieces from the Town Mayor.",
  },
  {
    id: "sample-conflict-2",
    topic: "Fate of the Goblin Chieftain",
    dmRecord: "DM Scribe Log: Chieftain surrendered, was disarmed, and bound for trial.",
    playerRecord: "Player Journal: Chieftain was slain during the ambush in the cavern.",
  },
];

/**
 * Parses markdown text to extract Canon Conflict items from a "# ⚖️ CANON CONFLICTS" or similar section.
 */
export function parseCanonConflicts(text: string): CanonConflictItem[] {
  if (!text) return [];

  const conflicts: CanonConflictItem[] = [];

  // Look for canon conflicts section heading (supports CONFLICTS, DISCREPANCIES, CANON DISCREPANCIES, etc.)
  const sectionMatch = text.match(/(?:#|##|###|\*\*)\s*⚖️?\s*(?:CANON\s+)?(?:CONFLICTS?|DISCREPANC(?:IES|Y)).*?(?=\n(?:#|##|###|\*\*)\s+[A-Z0-9]|\s*$)/is);
  const sectionText = sectionMatch ? sectionMatch[0] : text;

  // Pattern 1: Bullet/Numbered items starting with Conflict Topic / Discrepancy / Topic / Conflict
  const bulletBlocks = sectionText.split(/(?=\n\s*[-*1-9.]+\s+(?:\*\*)?(?:Conflict Topic|Discrepancy|Topic|Conflict)\b)/i);

  let idCounter = 1;
  for (const block of bulletBlocks) {
    if (!block.trim()) continue;

    const topicMatch = block.match(/(?:Conflict Topic|Discrepancy|Topic|Conflict)\s*\*\*?:?\s*(.+?)(?=\n|$)/i);
    if (!topicMatch) continue;

    const topic = topicMatch[1].replace(/\*\*/g, "").trim();

    const dmMatch = block.match(/(?:DM Scribe Log Record|DM Scribe Log|DM Notes? Record|DM Record|DM Scribe)\s*\*\*?:?\s*(.+?)(?=\n\s*[-*1-9.]|\n\s*(?:Player|Default|DM)|$)/is);
    const dmRecord = dmMatch ? dmMatch[1].replace(/\*\*/g, "").trim() : "Default DM Scribe record applies.";

    const playerMatch = block.match(/(?:Player Journal Record|Player Journal|Player Notes? Record|Player Record|Player Journal)\s*\*\*?:?\s*(.+?)(?=\n\s*[-*1-9.]|\n\s*(?:Default|DM)|$)/is);
    const playerRecord = playerMatch ? playerMatch[1].replace(/\*\*/g, "").trim() : "Player Journal record differs.";

    conflicts.push({
      id: `conflict-${idCounter++}`,
      topic,
      dmRecord,
      playerRecord,
    });
  }

  // Fallback 2: Line-by-line parsing if heading exists but structured list blocks were not isolated
  if (conflicts.length === 0 && sectionMatch) {
    const lines = sectionText.split("\n");
    let currentTopic = "";
    let currentDm = "";
    let currentPlayer = "";

    for (const line of lines) {
      if (line.match(/(?:Topic|Conflict|Discrepancy)/i) && line.includes(":")) {
        if (currentTopic && (currentDm || currentPlayer)) {
          conflicts.push({
            id: `conflict-${idCounter++}`,
            topic: currentTopic,
            dmRecord: currentDm || "DM Scribe Note record.",
            playerRecord: currentPlayer || "Player Journal Note record.",
          });
          currentDm = "";
          currentPlayer = "";
        }
        currentTopic = line.replace(/.*?:\s*/, "").replace(/\*\*/g, "").trim();
      } else if (line.match(/DM\s*(?:Scribe|Log|Record)/i) && line.includes(":")) {
        currentDm = line.replace(/.*?:\s*/, "").replace(/\*\*/g, "").trim();
      } else if (line.match(/Player\s*(?:Journal|Record|Note)/i) && line.includes(":")) {
        currentPlayer = line.replace(/.*?:\s*/, "").replace(/\*\*/g, "").trim();
      }
    }

    if (currentTopic && (currentDm || currentPlayer)) {
      conflicts.push({
        id: `conflict-${idCounter++}`,
        topic: currentTopic,
        dmRecord: currentDm || "DM Scribe Note record.",
        playerRecord: currentPlayer || "Player Journal Note record.",
      });
    }
  }

  return conflicts;
}

/**
 * Strips the "# ⚖️ CANON CONFLICTS" raw markdown section from text
 * so it isn't rendered twice when shown in the interactive Adjudicator.
 */
export function stripCanonConflictsFromMarkdown(text: string): string {
  if (!text) return "";
  return text.replace(/(?:#|##|###|\*\*)\s*⚖️?\s*(?:CANON\s+)?(?:CONFLICTS?|DISCREPANC(?:IES|Y)).*?(?=\n(?:#|##|###|\*\*)\s+[A-Z0-9]|\s*$)/is, "").trim();
}

