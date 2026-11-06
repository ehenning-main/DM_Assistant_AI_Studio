import magicItemsData from "../data/magicItemsReference.json";

export interface MagicItemReference {
  name: string;
  rarity: "Common" | "Uncommon" | "Rare" | "Very Rare" | "Legendary" | "Artifact" | string;
  type: string;
  description: string;
  source: string;
}

// In-memory cache of online and local reference lookups
const runtimeCache = new Map<string, MagicItemReference | null>();

// Initialize with static 5e SRD dataset
const staticReference = magicItemsData as Record<string, MagicItemReference>;

function cleanItemKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes rarity string into standard 5e capitalization
 */
export function normalizeRarity(rawRarity?: string): string {
  if (!rawRarity) return "Common";
  const lower = rawRarity.toLowerCase().trim();
  if (lower === "common") return "Common";
  if (lower === "uncommon") return "Uncommon";
  if (lower === "rare") return "Rare";
  if (lower === "very rare" || lower === "veryrare") return "Very Rare";
  if (lower === "legendary") return "Legendary";
  if (lower === "artifact") return "Artifact";
  return rawRarity.charAt(0).toUpperCase() + rawRarity.slice(1);
}

// Known mundane equipment/items that must never be falsely upgraded to magic items
export const KNOWN_MUNDANE_ITEMS = new Set([
  "greatsword", "longsword", "shortsword", "dagger", "scimitar", "rapier", "handaxe", "battleaxe",
  "greataxe", "halberd", "glaive", "pike", "spear", "trident", "lance", "war pick", "morningstar",
  "flail", "warhammer", "maul", "mace", "club", "greatclub", "quarterstaff", "light hammer",
  "sickle", "whip", "light crossbow", "heavy crossbow", "hand crossbow", "shortbow", "longbow",
  "dart", "sling", "blowgun", "net",
  "padded armor", "leather armor", "studded leather armor", "hide armor", "chain shirt",
  "scale mail", "breastplate", "half plate", "ring mail", "chain mail", "splint armor", "plate armor", "plate", "shield",
  "backpack", "bedroll", "mess kit", "tinderbox", "torch", "rations", "waterskin", "hempen rope", "silk rope",
  "crowbar", "hammer", "piton", "hooded lantern", "bullseye lantern", "oil flask", "flask",
  "grappling hook", "iron spikes", "pouch", "sack", "quiver", "case", "clothes, common", "clothes, fine",
  "clothes, traveler's", "robes", "robe", "boots", "cloak", "ring", "amulet", "gem", "diamond", "ruby", "emerald"
]);

/**
 * Checks if an item is a standard mundane item rather than a magic relic.
 */
export function isMundaneEquipment(itemName: string): boolean {
  if (!itemName) return false;
  const key = cleanItemKey(itemName);
  return KNOWN_MUNDANE_ITEMS.has(key);
}

/**
 * Synchronously retrieves accurate item details from the 5e reference index or cache.
 * Falls back gracefully without blocking rendering.
 */
export function getMagicItemReference(itemName: string): MagicItemReference | null {
  if (!itemName) return null;
  const key = cleanItemKey(itemName);

  if (runtimeCache.has(key)) {
    return runtimeCache.get(key) || null;
  }

  // Mundane base items without magic qualifiers are never magic items
  if (KNOWN_MUNDANE_ITEMS.has(key)) {
    runtimeCache.set(key, null);
    return null;
  }

  // 1. Direct match in SRD reference
  if (staticReference[key]) {
    runtimeCache.set(key, staticReference[key]);
    return staticReference[key];
  }

  // 2. Normalize by removing common status/attunement tags (e.g. "(attuned)", "(requires attunement)", "(cursed)")
  const strippedKey = key
    .replace(/\b(attuned|requires attunement|cursed|\+1|\+2|\+3)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (strippedKey && strippedKey !== key && staticReference[strippedKey]) {
    runtimeCache.set(key, staticReference[strippedKey]);
    return staticReference[strippedKey];
  }

  return null;
}

/**
 * Asynchronously queries online reference APIs (dnd5eapi.co and open5e) to confirm item details,
 * caching results so future lookups are instantaneous.
 */
export async function fetchOnlineItemReference(itemName: string): Promise<MagicItemReference | null> {
  if (!itemName) return null;
  const key = cleanItemKey(itemName);

  // Check cache first
  if (runtimeCache.has(key)) {
    return runtimeCache.get(key) || null;
  }

  // Mundane items must not be searched as magic items
  if (KNOWN_MUNDANE_ITEMS.has(key)) {
    runtimeCache.set(key, null);
    return null;
  }

  // Check static reference first
  const local = getMagicItemReference(itemName);
  if (local) {
    runtimeCache.set(key, local);
    return local;
  }

  const strippedKey = key
    .replace(/\b(attuned|requires attunement|cursed|\+1|\+2|\+3)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const slug = (strippedKey || key).replace(/\s+/g, "-");

  // 1. Try D&D 5e API
  try {
    const res = await fetch(`https://www.dnd5eapi.co/api/2014/magic-items/${encodeURIComponent(slug)}`, {
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const data = await res.json();
      const ref: MagicItemReference = {
        name: data.name,
        rarity: normalizeRarity(data.rarity?.name),
        type: data.equipment_category?.name || "Wondrous Item",
        description: Array.isArray(data.desc) ? data.desc.join("\n\n") : (data.desc || ""),
        source: "Official 5e SRD Online API",
      };
      runtimeCache.set(key, ref);
      return ref;
    }
  } catch (_e) {
    // Continue to Open5e fallback
  }

  // 2. Try Open5e search API (STRICT match only, NEVER arbitrary first result)
  try {
    const res = await fetch(`https://api.open5e.com/v1/magicitems/?search=${encodeURIComponent(itemName)}`, {
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        // ONLY accept exact or stripped key matches
        const exact = data.results.find((r: any) => {
          const rKey = cleanItemKey(r.name);
          return rKey === key || rKey === strippedKey;
        });

        if (exact) {
          const ref: MagicItemReference = {
            name: exact.name,
            rarity: normalizeRarity(exact.rarity),
            type: exact.type || "Wondrous Item",
            description: exact.desc || "",
            source: exact.document__title || "Open5e Rules Reference",
          };
          runtimeCache.set(key, ref);
          return ref;
        }
      }
    }
  } catch (_e) {
    // Ignore network timeouts
  }

  // Negative cache to prevent repeated failed network requests
  runtimeCache.set(key, null);
  return null;
}
