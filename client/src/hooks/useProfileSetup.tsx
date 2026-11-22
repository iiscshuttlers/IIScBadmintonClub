import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { supabase } from "@/lib/supabase";
import { playerService } from "@/services/playerService";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { optimizeImage } from "@/lib/imageUtils";
import { withTimeout } from "@/lib/authUtils";
import { useProfileBasicState } from "./profile/useProfileBasicState";
import { useProfileBadmintonState } from "./profile/useProfileBadmintonState";
import { useProfileEquipmentState } from "./profile/useProfileEquipmentState";
import { useProfileHighlightsState } from "./profile/useProfileHighlightsState";
import { useProfileMediaState } from "./profile/useProfileMediaState";
import { safeReplaceState, safeGetHash } from "@/lib/navUtils";
import { useQueryClient } from "@tanstack/react-query";
import { fetchMyPrivate, playerEmailInUse, withAdminPrivate } from "@/services/playerPrivateService";
import { PLAYER_PUBLIC_COLUMNS } from "@/lib/playerColumns";
import type { PlayerRow, PlayerStats } from "@/types";
import {
  buildProfilePayload,
  isIiscEmail,
  mediaFromStats,
  missingProfileFields,
  racketsFromProfile,
  shoesFromProfile,
  splitDepartment,
} from "./profile/profilePayload";

const PASSWORD_UPDATE_TIMEOUT_MS = 12_000;

/**
 * The profile being edited (public columns, plus private ones the viewer may
 * read). `status` (looking | playing | resting | injured, NULL = not set) has
 * no picker in the app right now; this form only reads it to derive
 * is_looking_to_play and never writes it, so a stale draft can't overwrite a
 * newer choice.
 */
type LoadedProfile = PlayerRow;

export function useProfileSetup() {
  const [, setLocation] = useLocation();
  const { id: paramId } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const { session, profile: authProfile, isInitializing, isAdmin } = useAuth();
  const { confirm } = useConfirm();
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const profileLoadedRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"basic" | "status" | "badminton" | "equipment" | "highlights" | "media">(() => {
    const hash = safeGetHash();
    if (["basic", "status", "badminton", "equipment", "highlights", "media"].includes(hash)) {
      return hash as "basic" | "status" | "badminton" | "equipment" | "highlights" | "media";
    }
    return "basic";
  });

  useEffect(() => {
    safeReplaceState(`#${activeTab}`);
  }, [activeTab]);

  const basic = useProfileBasicState();
  const badminton = useProfileBadmintonState();
  const equipment = useProfileEquipmentState();
  const highlights = useProfileHighlightsState();
  const media = useProfileMediaState();
  
  const { 
    fullName, setFullName, nickname, setNickname, status, setStatus, iiscEmail, setIiscEmail,
    contactNumber, setContactNumber, department, setDepartment, customDepartment, setCustomDepartment,
    joinedYear, setJoinedYear, nationality, setNationality, homeState, setHomeState, height, setHeight,
    instagram, setInstagram, avatarUrl, setAvatarUrl, gender, setGender, isGuest, setIsGuest, isRetired, setIsRetired 
  } = basic;

  const { 
    playingLevel, setPlayingLevel, playingStyle, setPlayingStyle, dominantHand, setDominantHand,
    favoriteShot, setFavoriteShot, startedPlayingYear, setStartedPlayingYear, coach, setCoach,
    favoriteIdol, setFavoriteIdol, favoriteFormat, setFavoriteFormat 
  } = badminton;

  const { 
    rackets, setRackets, primaryRacketIndex, setPrimaryRacketIndex,
    shoesList, setShoesList, primaryShoeIndex, setPrimaryShoeIndex, apparel, setApparel 
  } = equipment;

  const { 
    bio, setBio, quote, setQuote, achievementsRaw, setAchievementsRaw, tournamentsRaw, setTournamentsRaw,
    tourName, setTourName, tourYear, setTourYear, achMedal, setAchMedal, achCustomMedal, setAchCustomMedal,
    achTournament, setAchTournament, achCategory, setAchCategory, achEventType, setAchEventType,
    careerHighlights, setCareerHighlights 
  } = highlights;

  const { 
    mediaImages, setMediaImages, mediaVideos, setMediaVideos,
    imagePreviewStatus, setImagePreviewStatus, videoPreviewIds, setVideoPreviewIds,
    handleImageBlur, handleVideoBlur 
  } = media;

  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [playerSlug, setPlayerSlug] = useState("");
  const [originalStats, setOriginalStats] = useState<PlayerStats>({});



  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast("Password too short", { description: "Password must be at least 6 characters.", icon: "⚠️" });
      return;
    }
    setPasswordLoading(true);
    try {
      const { data: { session: currentSession } } = await withTimeout(supabase.auth.getSession(), PASSWORD_UPDATE_TIMEOUT_MS, "Could not verify your login session. Please try again.");
      if (!currentSession) throw new Error("Your login session expired. Please sign in again.");
      const { error } = await withTimeout(supabase.auth.updateUser({ password: newPassword }), PASSWORD_UPDATE_TIMEOUT_MS, "Password update timed out. Please check your connection and try again.");
      if (error) throw error;
      setNewPassword("");
      toast("Password Updated", { description: "You can now log in using your email and password.", icon: "🔒" });
    } catch (err) {
      toast("Update failed", { description: err instanceof Error ? err.message : String(err), icon: "❌" });
    } finally {
      setPasswordLoading(false);
    }
  };

  useEffect(() => {
    if (isInitializing || !session) return;

    const cacheKey = `${session.user.id}:${paramId ?? ""}:${isAdmin}`;
    if (profileLoadedRef.current === cacheKey) return;
    profileLoadedRef.current = cacheKey;

    let mounted = true;
    const isSelfEdit = !paramId || (authProfile && authProfile.id === paramId);

    let query = supabase.from("players").select(PLAYER_PUBLIC_COLUMNS);
    if (paramId && isAdmin && !isSelfEdit) {
      query = query.eq("id", paramId);
    } else if (authProfile?.id) {
      query = query.eq("id", authProfile.id);
    } else {
      query = query.eq("id", session.user.id);
    }

    Promise.resolve(query.maybeSingle())
      .then(async ({ data: publicProfile, error }) => {
        // Contact fields: own via self-only RPC, others' (admin edit) via admin RPC.
        let profile = publicProfile as unknown as LoadedProfile | null;
        if (publicProfile && !error) {
          const own = await fetchMyPrivate();
          if (own && own.id === profile.id) profile = { ...profile, ...own };
          else if (isAdmin) profile = (await withAdminPrivate([profile]))[0];
        }
        if (!mounted) return;
        if (profile && !error) {
          setTargetUserId(profile.id);
          setIsEditing(true);
          setPlayerSlug(profile.id);
          setFullName(profile.full_name || "");
          setNickname(profile.nickname || "");
          setStatus(profile.status ?? null);
          setIiscEmail(profile.iisc_email || "");
          setContactNumber(profile.contact_number || "");
          const dep = splitDepartment(profile.department);
          setDepartment(dep.department);
          setCustomDepartment(dep.customDepartment);
          setJoinedYear(profile.joined_year?.toString() || "");
          setPlayingLevel(profile.playing_level || "Intermediate");
          setPlayingStyle(profile.playing_style || "");
          setDominantHand(profile.dominant_hand || "Right-handed");
          setFavoriteShot(profile.favorite_shot || "");
          setFavoriteIdol(profile.favorite_idol || "");
          setGender(profile.gender || "");
          setFavoriteFormat(profile.favorite_format || "");
          setQuote(profile.quote || "");
          setAvatarUrl(profile.avatar_url || "");
          setOriginalStats(profile.stats || {});
          setCareerHighlights((profile.career_highlights || []) as Array<{ year: string; title: string; description: string }>);

          const media = mediaFromStats(profile.stats);
          if (media) {
            setMediaImages(media.images);
            setMediaVideos(media.videos);
          }

          const racketState = racketsFromProfile(profile.racket_details, profile.current_racket);
          setRackets(racketState.rackets);
          setPrimaryRacketIndex(racketState.primaryIndex);

          const shoeState = shoesFromProfile(profile.shoes);
          setShoesList(shoeState.shoes);
          setPrimaryShoeIndex(shoeState.primaryIndex);

          setNationality(profile.nationality || "");
          setHomeState(profile.home_state || "");
          setGender(profile.gender || "");
          setFavoriteFormat(profile.favorite_format || "");
          setHeight(profile.height || "");
          setStartedPlayingYear(profile.started_playing_year?.toString() || "");
          setIsGuest(profile.is_guest || false);
          setIsRetired(profile.is_retired || false);
          setCoach(profile.coach || "");
          setBio(profile.bio || "");
          setApparel(profile.apparel || "");
          setInstagram(profile.instagram || "");
          setAchievementsRaw(profile.achievements ? profile.achievements.join(", ") : "");
          setTournamentsRaw(profile.tournament_history ? profile.tournament_history.join(", ") : "");
        } else {
          if (session.user.user_metadata?.full_name) setFullName(session.user.user_metadata.full_name);
          if (session.user.user_metadata?.avatar_url) setAvatarUrl(session.user.user_metadata.avatar_url);
        }
      })
      .catch((err) => console.error("Error loading profile:", err));

    return () => { mounted = false; };
  }, [isInitializing, session, paramId]);

  const handleSignOut = async () => {
    const ok = await confirm({
      title: "Sign Out?",
      description: "Are you sure you want to sign out of your account?",
      confirmLabel: "Sign Out",
      confirmVariant: "danger"
    });
    if (ok) {
      await supabase.auth.signOut();
      setLocation("/join");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    setLoading(true);
    try {
      toast.loading("Optimizing image...");
      const optimizedFile = await optimizeImage(file, 1200, 0.85);
      if (optimizedFile.size > 1024 * 1024) {
        toast.dismiss();
        throw new Error("Image could not be compressed enough. Please try a different image.");
      }
      toast.dismiss();
      toast.loading("Uploading avatar...");
      const publicUrl = await playerService.uploadAvatar(session.user.id, optimizedFile);
      toast.dismiss();
      setAvatarUrl(`${publicUrl}?t=${Date.now()}`);
      toast.success("Avatar uploaded and compressed successfully!");
    } catch (err) {
      toast.dismiss();
      console.error("Avatar upload failed:", err);
      toast.error("Upload failed", { description: err instanceof Error ? err.message : String(err) });
      setAvatarUrl("");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const buildPayload = useCallback(() => buildProfilePayload({
    fullName, nickname, status, isGuest, isRetired, iiscEmail, contactNumber,
    department, customDepartment, joinedYear, playingLevel, playingStyle, dominantHand,
    favoriteShot, favoriteIdol, gender, favoriteFormat, quote, avatarUrl,
    rackets, primaryRacketIndex, shoesList, primaryShoeIndex, originalStats,
    mediaImages, mediaVideos, nationality, homeState, height, startedPlayingYear,
    coach, bio, apparel, instagram, achievementsRaw, tournamentsRaw, careerHighlights,
  }), [
    rackets, shoesList, mediaImages, mediaVideos, primaryRacketIndex, primaryShoeIndex,
    originalStats, fullName, nickname, status, isGuest, isRetired, iiscEmail, contactNumber,
    department, customDepartment, joinedYear, playingLevel, playingStyle, dominantHand,
    favoriteShot, favoriteIdol, gender, favoriteFormat, quote, avatarUrl, nationality,
    homeState, height, startedPlayingYear, coach, bio, apparel, instagram, achievementsRaw,
    tournamentsRaw, careerHighlights,
  ]);

  // Silently save (no toast) used for auto-save
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRenderRef = useRef(true);

  const saveNow = useCallback(async (silent = false, nextTab?: string) => {
    if (!session) return;

    const missing = missingProfileFields({ fullName, isGuest, iiscEmail, contactNumber, gender, joinedYear, department });
    if (missing.length > 0) {
      if (!silent) {
        toast.error("Required fields missing", { description: `Please fill: ${missing.join(", ")}` });
        if (activeTab !== "basic") setActiveTab("basic");
      }
      return;
    }

    if (iiscEmail) {
      if (!isIiscEmail(iiscEmail)) {
        if (!silent) toast.error("Invalid IISc Email", { description: "Email must end with @iisc.ac.in or @alum.iisc.ac.in" });
        return;
      }
    }

    if (!silent) {
      setLoading(true);
      if (iiscEmail) {
        const inUseBy = await playerEmailInUse(iiscEmail).catch(() => null);

        if (inUseBy && inUseBy !== (targetUserId || session.user.id)) {
          toast.error("Duplicate profile", {
            description: "This IISc Email belongs to an existing profile.\nPlease log out and Sign In using that exact email, OR contact a club admin to manually link it."
          });
          setLoading(false);
          return;
        }
      }
    }
    
    const payload = buildPayload();
    const timeoutMs = 30000;
    const mkTimeout = () => new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Save timed out")), timeoutMs));
    try {
      await Promise.race([
        playerService.upsertProfile(targetUserId || session.user.id, isEditing, payload, session.user.email),
        mkTimeout()
      ]);
      
      if (!isEditing) setIsEditing(true);
      
      queryClient.invalidateQueries({ queryKey: ["playerProfile", targetUserId || session.user.id] });
      queryClient.invalidateQueries({ queryKey: ["playerRank", targetUserId || session.user.id] });
      queryClient.invalidateQueries({ queryKey: ["allPlayers"] });

      // Clear all sticky drafts after successful save
      Object.keys(window.localStorage).forEach((key) => {
        if (key.startsWith("profile_draft_")) {
          window.localStorage.removeItem(key);
        }
      });

      if (!silent) {
        if (nextTab) {
          toast.success("Progress saved!");
          setActiveTab(nextTab as typeof activeTab);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          if (isEditing) setLocation(`/player/${playerSlug}`);
          else setLocation(`/player/${session.user.id}`);
        }
      }
    } catch (err) {
      if (!silent) {
        console.error("Error saving profile:", err); 
        toast.error("Failed to save", { description: (err instanceof Error && err.message) || "An error occurred." }); 
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [session, buildPayload, targetUserId, isEditing, playerSlug, setLocation, iiscEmail, fullName, isGuest, contactNumber, gender, joinedYear, department, activeTab]);

  // Auto-save: debounce 1.5s after any field change (skip on first load)
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (!session || !isEditing) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveNow(true);
    }, 300);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [
    fullName, nickname, status, iiscEmail, contactNumber, department, customDepartment,
    joinedYear, nationality, homeState, height, instagram, gender, isGuest, isRetired,
    playingLevel, playingStyle, dominantHand, favoriteShot, startedPlayingYear, coach,
    favoriteIdol, favoriteFormat, rackets, primaryRacketIndex, shoesList, primaryShoeIndex,
    apparel, bio, quote, achievementsRaw, tournamentsRaw, careerHighlights,
    mediaImages, mediaVideos,
  ]);

  const handleSubmit = async (e?: React.FormEvent, nextTab?: string) => {
    if (e) e.preventDefault();
    await saveNow(false, nextTab);
  };

  return {
    // Top-level state
    loading, session, isInitializing, isAdmin, targetUserId, isEditing, playerSlug,
    paramId,
    // Tab state
    activeTab, setActiveTab,
    // Basic Info
    fullName, setFullName, nickname, setNickname, status, setStatus, iiscEmail, setIiscEmail,
    contactNumber, setContactNumber, department, setDepartment, customDepartment, setCustomDepartment,
    joinedYear, setJoinedYear, nationality, setNationality, homeState, setHomeState, height, setHeight,
    instagram, setInstagram, avatarUrl, setAvatarUrl, gender, setGender, isGuest, setIsGuest, isRetired, setIsRetired,
    // Badminton
    playingLevel, setPlayingLevel, playingStyle, setPlayingStyle, dominantHand, setDominantHand,
    favoriteShot, setFavoriteShot, startedPlayingYear, setStartedPlayingYear, coach, setCoach,
    favoriteIdol, setFavoriteIdol, favoriteFormat, setFavoriteFormat,
    // Equipment
    rackets, setRackets, primaryRacketIndex, setPrimaryRacketIndex,
    shoesList, setShoesList, primaryShoeIndex, setPrimaryShoeIndex, apparel, setApparel,
    // Highlights
    bio, setBio, quote, setQuote, achievementsRaw, setAchievementsRaw, tournamentsRaw, setTournamentsRaw,
    tourName, setTourName, tourYear, setTourYear, achMedal, setAchMedal, achCustomMedal, setAchCustomMedal,
    achTournament, setAchTournament, achCategory, setAchCategory, achEventType, setAchEventType,
    careerHighlights, setCareerHighlights,
    // Media
    mediaImages, setMediaImages, mediaVideos, setMediaVideos, imagePreviewStatus, setImagePreviewStatus,
    videoPreviewIds, setVideoPreviewIds,
    // Password (if needed)
    newPassword, setNewPassword, passwordLoading, setPasswordLoading,
    // Handlers
    handleImageBlur, handleVideoBlur, handlePasswordChange, handleSignOut, handleAvatarUpload, handleSubmit, saveNow,
  };
}
