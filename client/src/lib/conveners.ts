import { supabase } from "./supabase";
import { fetchSiteData } from "./siteData";

/**
 * Club leadership (Convener + Co-Convener), edited in Site Admin → Content →
 * Conveners and stored in site_data under "convener_photos". One source for
 * the Club page's leadership cards and the two signatures on certificates.
 */
export interface ConvenerPerson {
  name: string;
  description: string;
  /** Custom photo. Empty → the linked player's avatar → the bundled photo. */
  imageUrl: string;
  /** Linked player profile: the name comes from it and links to it. */
  playerId?: string;
  /** Signature scan for certificates (dark ink on white or transparent). */
  signatureUrl?: string;
}

export interface ConvenerData {
  convener: ConvenerPerson;
  coConvener: ConvenerPerson;
}

export type ConvenerRole = keyof ConvenerData;

export const CONVENER_ROLES: readonly { key: ConvenerRole; title: string }[] = [
  { key: "convener", title: "Convener" },
  { key: "coConvener", title: "Co-Convener" },
];

export const DEFAULT_CONVENER_DATA: ConvenerData = {
  convener: {
    name: "Raja Janmejay",
    description: "Leading the club with vision and passion for the sport",
    imageUrl: "",
  },
  coConvener: {
    name: "Aneesh Varla",
    description: "Helping members connect, compete, and grow through badminton",
    imageUrl: "",
  },
};

/**
 * Photos and signatures shipped in public/. Keyed by person, not role, so they
 * follow the person if roles swap and never appear under a new convener's name.
 */
const BUNDLED: Record<string, { photo: string; signature: string }> = {
  "raja janmejay": { photo: "convener.webp", signature: "sign-convener.png" },
  "aneesh varla": { photo: "co_convener.png", signature: "sign-co-convener.png" },
};

const publicPath = (file: string) =>
  `${(import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/")}${file}`;

const nameKey = (name?: string | null) => (name ?? "").trim().toLowerCase();

export function sameName(a?: string | null, b?: string | null): boolean {
  return nameKey(a) !== "" && nameKey(a) === nameKey(b);
}

export function bundledConvenerAssets(...names: (string | null | undefined)[]) {
  for (const n of names) {
    const hit = BUNDLED[nameKey(n)];
    if (hit) return { photo: publicPath(hit.photo), signature: publicPath(hit.signature) };
  }
  return null;
}

export interface LinkedPlayer {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface ResolvedConvener {
  role: ConvenerRole;
  title: string;
  name: string;
  photoUrl: string;
  signatureUrl: string;
  /** Set only when the linked player still exists. */
  playerId: string | null;
}

export function normaliseConvenerData(data?: Partial<ConvenerData> | null): ConvenerData {
  return {
    convener: { ...DEFAULT_CONVENER_DATA.convener, ...(data?.convener ?? {}) },
    coConvener: { ...DEFAULT_CONVENER_DATA.coConvener, ...(data?.coConvener ?? {}) },
  };
}

export function resolveConvener(
  role: ConvenerRole,
  person: ConvenerPerson,
  player?: LinkedPlayer | null,
): ResolvedConvener {
  const name = (player?.full_name || person.name || DEFAULT_CONVENER_DATA[role].name).trim();
  const bundled = bundledConvenerAssets(name, person.name);
  return {
    role,
    title: CONVENER_ROLES.find((r) => r.key === role)!.title,
    name,
    photoUrl: person.imageUrl || player?.avatar_url || bundled?.photo || "",
    signatureUrl: person.signatureUrl || bundled?.signature || "",
    playerId: player?.id ?? null,
  };
}

/** Players that can be picked as conveners, or looked up by id. Public columns only. */
export async function fetchConvenerPlayers(ids?: string[]): Promise<LinkedPlayer[]> {
  let query = supabase
    .from("players")
    .select("id, full_name, avatar_url")
    .is("deleted_at", null);
  query = ids ? query.in("id", ids) : query.eq("is_approved", true).eq("is_guest", false).order("full_name");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as LinkedPlayer[];
}

export type ResolvedConveners = Record<ConvenerRole, ResolvedConvener>;

let cached: { at: number; promise: Promise<ResolvedConveners> } | null = null;
const CACHE_MS = 60_000;

/** Current leadership with linked profiles applied. Never rejects: falls back to defaults. */
export function loadConveners(): Promise<ResolvedConveners> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.promise;
  const promise = (async () => {
    const raw = await fetchSiteData<ConvenerData>("convener_photos", "convener_photos.json").catch(() => null);
    const data = normaliseConvenerData(raw);
    const ids = CONVENER_ROLES.map((r) => data[r.key].playerId).filter((id): id is string => !!id);
    const players = ids.length ? await fetchConvenerPlayers(ids).catch(() => []) : [];
    const byId = new Map(players.map((p) => [p.id, p]));
    return {
      convener: resolveConvener("convener", data.convener, byId.get(data.convener.playerId ?? "")),
      coConvener: resolveConvener("coConvener", data.coConvener, byId.get(data.coConvener.playerId ?? "")),
    };
  })();
  cached = { at: Date.now(), promise };
  return promise;
}

/** Drop the cached leadership, e.g. right after an admin saves changes. */
export function clearConvenerCache() {
  cached = null;
}
