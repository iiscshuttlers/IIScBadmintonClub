/**
 * Pure helpers behind useProfileSetup: turning a loaded player row into form
 * state, checking required fields, and building the row written on save.
 */
import { PREDEFINED_DEPARTMENTS } from "@/data/departments";
import type { PlayerStats, RacketDetail, ShoeItem } from "@/types";

export type RacketInput = { name: string; string: string; tension: string };
export type ShoeInput = { name: string };
export type MediaInput = { url: string; caption: string };
export type HighlightInput = { year: string; title: string; description: string };

const OTHER_DEPARTMENT = "OTHER - Other";

/** A department outside the predefined list is shown as "Other" plus free text. */
export function splitDepartment(department: string | null | undefined): { department: string; customDepartment: string } {
  if (department && !PREDEFINED_DEPARTMENTS.includes(department) && department !== OTHER_DEPARTMENT) {
    return { department: OTHER_DEPARTMENT, customDepartment: department };
  }
  return { department: department || "", customDepartment: "" };
}

/**
 * Racket rows for the form. Tension keeps digits only ("24 lbs" → "24"). The
 * primary is the first racket flagged primary or named as current_racket.
 */
export function racketsFromProfile(
  racketDetails: RacketDetail[] | null | undefined,
  currentRacket: string | null | undefined,
): { rackets: RacketInput[]; primaryIndex: number } {
  if (racketDetails?.length > 0) {
    const rackets = racketDetails.map((r) => ({ name: r.name || "", string: r.string || "", tension: (r.tension || "").replace(/[^0-9]/g, "") }));
    const primIdx = racketDetails.findIndex((r) => r.primary === true || r.name === currentRacket);
    return { rackets, primaryIndex: primIdx >= 0 ? primIdx : 0 };
  }
  if (currentRacket) {
    return { rackets: [{ name: currentRacket, string: "", tension: "" }], primaryIndex: 0 };
  }
  return { rackets: [{ name: "", string: "", tension: "" }], primaryIndex: 0 };
}

/** Shoes are stored as a JSON array string; older rows hold a plain name. */
export function shoesFromProfile(shoes: string | null | undefined): { shoes: ShoeInput[]; primaryIndex: number } {
  if (shoes) {
    try {
      if (shoes.startsWith("[")) {
        const parsedShoes = JSON.parse(shoes) as ShoeItem[];
        const primShoeIdx = parsedShoes.findIndex((s) => s.primary === true);
        return { shoes: parsedShoes.map((s) => ({ name: s.name || "" })), primaryIndex: primShoeIdx >= 0 ? primShoeIdx : 0 };
      }
      return { shoes: [{ name: shoes }], primaryIndex: 0 };
    } catch {
      return { shoes: [{ name: shoes }], primaryIndex: 0 };
    }
  }
  return { shoes: [{ name: "" }], primaryIndex: 0 };
}

/** Gallery images and videos kept in stats.media, split for the two editors. Null when there is none. */
export function mediaFromStats(stats: PlayerStats | null | undefined): { images: MediaInput[]; videos: MediaInput[] } | null {
  if (!stats?.media) return null;
  const imgs = stats.media.filter((m) => m.type === "image");
  const vids = stats.media.filter((m) => m.type === "video");
  return {
    images: imgs.map((i) => ({ url: i.url || "", caption: i.caption || "" })),
    videos: vids.map((v) => ({ url: v.url || "", caption: v.caption || "" })),
  };
}

export interface RequiredProfileFields {
  fullName: string;
  isGuest: boolean;
  iiscEmail: string;
  contactNumber: string;
  gender: string;
  joinedYear: string;
  department: string;
}

/** Labels of the required fields still empty (guests need no IISc email). */
export function missingProfileFields(f: RequiredProfileFields): string[] {
  const missing: string[] = [];
  if (!f.fullName.trim()) missing.push("Full Name");
  if (!f.isGuest && !f.iiscEmail.trim()) missing.push("IISc Email");
  if (!f.contactNumber.trim()) missing.push("Contact Number");
  if (!f.gender) missing.push("Gender");
  if (!f.joinedYear.trim()) missing.push("Joined Year");
  if (!f.department) missing.push("Department");
  return missing;
}

/** An IISc staff/student or alumni address (case-insensitive). */
export function isIiscEmail(email: string): boolean {
  const e = email.toLowerCase();
  return e.endsWith("@iisc.ac.in") || e.endsWith("@alum.iisc.ac.in");
}

export interface ProfileFormValues {
  fullName: string;
  nickname: string;
  status: string | null;
  isGuest: boolean;
  isRetired: boolean;
  iiscEmail: string;
  contactNumber: string;
  department: string;
  customDepartment: string;
  joinedYear: string;
  playingLevel: string;
  playingStyle: string;
  dominantHand: string;
  favoriteShot: string;
  favoriteIdol: string;
  gender: string;
  favoriteFormat: string;
  quote: string;
  avatarUrl: string;
  rackets: RacketInput[];
  primaryRacketIndex: number;
  shoesList: ShoeInput[];
  primaryShoeIndex: number;
  originalStats: PlayerStats;
  mediaImages: MediaInput[];
  mediaVideos: MediaInput[];
  nationality: string;
  homeState: string;
  height: string;
  startedPlayingYear: string;
  coach: string;
  bio: string;
  apparel: string;
  instagram: string;
  achievementsRaw: string;
  tournamentsRaw: string;
  careerHighlights: HighlightInput[];
}

/**
 * The players row written on save. Blank rackets, shoes and media are
 * dropped; stats keep everything else from the loaded row; the profile is
 * always undeleted. `status` is only read (to derive is_looking_to_play).
 */
export function buildProfilePayload(v: ProfileFormValues) {
  const validRackets = v.rackets.filter((r) => r.name.trim() !== "");
  const validShoes = v.shoesList.filter((s) => s.name.trim() !== "");
  const validImages = v.mediaImages.filter((img) => img.url.trim() !== "");
  const validVideos = v.mediaVideos.filter((vid) => vid.url.trim() !== "");
  const finalPrimaryRacketIdx = v.primaryRacketIndex < validRackets.length ? v.primaryRacketIndex : 0;
  const finalPrimaryShoeIdx = v.primaryShoeIndex < validShoes.length ? v.primaryShoeIndex : 0;
  const packedStats = {
    ...v.originalStats,
    media: [
      ...validImages.map((img) => ({ type: "image" as const, url: img.url, caption: img.caption })),
      ...validVideos.map((vid) => ({ type: "video" as const, url: vid.url, caption: vid.caption })),
    ],
  };
  return {
    full_name: v.fullName,
    nickname: v.nickname || null,
    is_looking_to_play: v.status === 'looking',
    is_guest: v.isGuest,
    is_retired: v.isRetired,
    iisc_email: v.iiscEmail || null,
    contact_number: v.contactNumber || null,
    department: v.department === OTHER_DEPARTMENT ? v.customDepartment : v.department,
    joined_year: v.joinedYear ? parseInt(v.joinedYear) : null,
    playing_level: v.playingLevel,
    playing_style: v.playingStyle,
    dominant_hand: v.dominantHand || null,
    favorite_shot: v.favoriteShot || null,
    favorite_idol: v.favoriteIdol || null,
    gender: v.gender || null,
    favorite_format: v.favoriteFormat || null,
    quote: v.quote || null,
    avatar_url: v.avatarUrl || `https://ui-avatars.com/api/?name=${v.fullName}&background=random`,
    current_racket: validRackets[finalPrimaryRacketIdx]?.name || validRackets[0]?.name || "",
    racket_details: validRackets.map((r, idx) => ({
      name: r.name,
      string: r.string || "Yonex BG65",
      tension: r.tension ? r.tension.includes("lbs") ? r.tension : `${r.tension} lbs` : "24 lbs",
      primary: idx === finalPrimaryRacketIdx,
    })),
    shoes: JSON.stringify(validShoes.map((s, idx) => ({ name: s.name, primary: idx === finalPrimaryShoeIdx }))),
    stats: packedStats,
    nationality: v.nationality || null,
    home_state: v.homeState || null,
    height: v.height || null,
    started_playing_year: v.startedPlayingYear ? parseInt(v.startedPlayingYear) : null,
    coach: v.coach || null,
    bio: v.bio || null,
    apparel: v.apparel || null,
    instagram: v.instagram || null,
    achievements: v.achievementsRaw ? v.achievementsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
    tournament_history: v.tournamentsRaw ? v.tournamentsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
    career_highlights: v.careerHighlights.filter((h) => h.year && h.title),
    deleted_at: null,
  };
}
