import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { supabase } from "@/lib/supabase";
import { playerService } from "@/services/playerService";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { optimizeImage } from "@/lib/imageUtils";
import { withTimeout } from "@/lib/authUtils";
import { PREDEFINED_DEPARTMENTS } from "@/data/departments";
import { useProfileBasicState } from "./profile/useProfileBasicState";
import { useProfileBadmintonState } from "./profile/useProfileBadmintonState";
import { useProfileEquipmentState } from "./profile/useProfileEquipmentState";
import { useProfileHighlightsState } from "./profile/useProfileHighlightsState";
import { useProfileMediaState } from "./profile/useProfileMediaState";
import { safeReplaceState, safeGetHash } from "@/lib/navUtils";
import { useQueryClient } from "@tanstack/react-query";

const PASSWORD_UPDATE_TIMEOUT_MS = 12_000;

export function useProfileSetup() {
  const [, setLocation] = useLocation();
  const { id: paramId } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const { session, profile: authProfile, isInitializing, isAdmin } = useAuth();
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
    favoriteShot, setFavoriteShot, yearsPlaying, setYearsPlaying, coach, setCoach,
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
  const [originalStats, setOriginalStats] = useState<any>({});



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
    } catch (err: any) {
      toast("Update failed", { description: err.message, icon: "❌" });
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

    let query = supabase.from("players").select("*");
    if (paramId && isAdmin && !isSelfEdit) {
      query = query.eq("id", paramId);
    } else if (authProfile?.id) {
      query = query.eq("id", authProfile.id);
    } else {
      query = query.eq("id", session.user.id);
    }

    Promise.resolve(query.maybeSingle())
      .then(({ data: profile, error }) => {
        if (!mounted) return;
        if (profile && !error) {
          setTargetUserId(profile.id);
          setIsEditing(true);
          setPlayerSlug(profile.id);
          setFullName(profile.full_name || "");
          setNickname(profile.nickname || "");
          setStatus(profile.status || "looking");
          setIiscEmail(profile.iisc_email || "");
          setContactNumber(profile.contact_number || "");
          if (profile.department && !PREDEFINED_DEPARTMENTS.includes(profile.department) && profile.department !== "OTHER - Other") {
            setDepartment("OTHER - Other");
            setCustomDepartment(profile.department);
          } else {
            setDepartment(profile.department || "");
            setCustomDepartment("");
          }
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
          setCareerHighlights(profile.career_highlights || []);

          if (profile.stats?.media) {
            const imgs = profile.stats.media.filter((m: any) => m.type === "image");
            const vids = profile.stats.media.filter((m: any) => m.type === "video");
            setMediaImages(imgs.map((i: any) => ({ url: i.url || "", caption: i.caption || "" })));
            setMediaVideos(vids.map((v: any) => ({ url: v.url || "", caption: v.caption || "" })));
          }

          if (profile.racket_details?.length > 0) {
            setRackets(profile.racket_details.map((r: any) => ({ name: r.name || "", string: r.string || "", tension: (r.tension || "").replace(/[^0-9]/g, "") })));
            const primIdx = profile.racket_details.findIndex((r: any) => r.primary === true || r.name === profile.current_racket);
            setPrimaryRacketIndex(primIdx >= 0 ? primIdx : 0);
          } else if (profile.current_racket) {
            setRackets([{ name: profile.current_racket, string: "", tension: "" }]);
            setPrimaryRacketIndex(0);
          } else {
            setRackets([{ name: "", string: "", tension: "" }]);
            setPrimaryRacketIndex(0);
          }

          if (profile.shoes) {
            try {
              if (profile.shoes.startsWith("[")) {
                const parsedShoes = JSON.parse(profile.shoes);
                setShoesList(parsedShoes.map((s: any) => ({ name: s.name || "" })));
                const primShoeIdx = parsedShoes.findIndex((s: any) => s.primary === true);
                setPrimaryShoeIndex(primShoeIdx >= 0 ? primShoeIdx : 0);
              } else {
                setShoesList([{ name: profile.shoes }]);
                setPrimaryShoeIndex(0);
              }
            } catch {
              setShoesList([{ name: profile.shoes }]);
              setPrimaryShoeIndex(0);
            }
          } else {
            setShoesList([{ name: "" }]);
            setPrimaryShoeIndex(0);
          }

          setNationality(profile.nationality || "");
          setHomeState(profile.home_state || "");
          setGender(profile.gender || "");
          setFavoriteFormat(profile.favorite_format || "");
          setHeight(profile.height || "");
          setYearsPlaying(profile.years_playing?.toString() || "");
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
    if (confirm("Are you sure you want to sign out?")) {
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
    } catch (err: any) {
      toast.dismiss();
      console.error("Avatar upload failed:", err);
      toast.error("Upload failed", { description: err.message });
      setAvatarUrl("");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const buildPayload = useCallback(() => {
    const validRackets = rackets.filter((r) => r.name.trim() !== "");
    const validShoes = shoesList.filter((s) => s.name.trim() !== "");
    const validImages = mediaImages.filter((img) => img.url.trim() !== "");
    const validVideos = mediaVideos.filter((vid) => vid.url.trim() !== "");

    const finalPrimaryRacketIdx = primaryRacketIndex < validRackets.length ? primaryRacketIndex : 0;
    const finalPrimaryShoeIdx = primaryShoeIndex < validShoes.length ? primaryShoeIndex : 0;
    const packedStats = {
      ...originalStats,
      media: [
        ...validImages.map((img) => ({ type: "image", url: img.url, caption: img.caption })),
        ...validVideos.map((vid) => ({ type: "video", url: vid.url, caption: vid.caption })),
      ],
    };
    return {
      full_name: fullName,
      nickname: nickname || null,
      is_looking_to_play: status === 'looking',
      is_guest: isGuest,
      is_retired: isRetired,
      iisc_email: iiscEmail || null,
      contact_number: contactNumber || null,
      department: department === "OTHER - Other" ? customDepartment : department,
      joined_year: joinedYear ? parseInt(joinedYear) : null,
      playing_level: playingLevel,
      playing_style: playingStyle,
      dominant_hand: dominantHand || null,
      favorite_shot: favoriteShot || null,
      favorite_idol: favoriteIdol || null,
      gender: gender || null,
      favorite_format: favoriteFormat || null,
      quote: quote || null,
      avatar_url: avatarUrl || `https://ui-avatars.com/api/?name=${fullName}&background=random`,
      current_racket: validRackets[finalPrimaryRacketIdx]?.name || validRackets[0]?.name || "",
      racket_details: validRackets.map((r, idx) => ({
        name: r.name,
        string: r.string || "Yonex BG65",
        tension: r.tension ? r.tension.includes("lbs") ? r.tension : `${r.tension} lbs` : "24 lbs",
        primary: idx === finalPrimaryRacketIdx,
      })),
      shoes: JSON.stringify(validShoes.map((s, idx) => ({ name: s.name, primary: idx === finalPrimaryShoeIdx }))),
      stats: packedStats,
      nationality: nationality || null,
      home_state: homeState || null,
      height: height || null,
      years_playing: yearsPlaying ? parseInt(yearsPlaying) : null,
      coach: coach || null,
      bio: bio || null,
      apparel: apparel || null,
      instagram: instagram || null,
      achievements: achievementsRaw ? achievementsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
      tournament_history: tournamentsRaw ? tournamentsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
      career_highlights: careerHighlights.filter((h) => h.year && h.title),
      deleted_at: null,
    };
  }, [
    rackets, shoesList, mediaImages, mediaVideos, primaryRacketIndex, primaryShoeIndex,
    originalStats, fullName, nickname, status, isGuest, isRetired, iiscEmail, contactNumber,
    department, customDepartment, joinedYear, playingLevel, playingStyle, dominantHand,
    favoriteShot, favoriteIdol, gender, favoriteFormat, quote, avatarUrl, nationality,
    homeState, height, yearsPlaying, coach, bio, apparel, instagram, achievementsRaw,
    tournamentsRaw, careerHighlights,
  ]);

  // Silently save (no toast) used for auto-save
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRenderRef = useRef(true);

  const saveNow = useCallback(async (silent = false, nextTab?: string) => {
    if (!session) return;
    if (iiscEmail && !silent) {
      const e = iiscEmail.toLowerCase();
      if (!e.endsWith("@iisc.ac.in") && !e.endsWith("@alum.iisc.ac.in")) {
        toast.error("Invalid IISc Email", { description: "Email must end with @iisc.ac.in or @alum.iisc.ac.in" });
        return false;
      }
    }
    if (!silent) setLoading(true);
    const payload = buildPayload();
    const timeoutMs = 30000;
    const mkTimeout = () => new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Save timed out")), timeoutMs));
    try {
      await Promise.race([
        playerService.upsertProfile(targetUserId || session.user.id, isEditing, payload, session.user.email),
        mkTimeout()
      ]);
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
          setActiveTab(nextTab as any);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          if (isEditing) setLocation(`/player/${playerSlug}`);
          else setLocation(`/player/${session.user.id}`);
        }
      }
      return true;
    } catch (err: any) {
      if (!silent) {
        if (err.code === "23505") toast.error("Duplicate profile", { description: "A profile with this email or name already exists!" });
        else { console.error("Error saving profile:", err); toast.error("Failed to save", { description: err.message }); }
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [session, buildPayload, targetUserId, isEditing, playerSlug, setLocation]);

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
    playingLevel, playingStyle, dominantHand, favoriteShot, yearsPlaying, coach,
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
    favoriteShot, setFavoriteShot, yearsPlaying, setYearsPlaying, coach, setCoach,
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
