import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserCircle,
  Trophy,
  Save,
  Sparkles,
  Activity,
  Swords,
  BookOpen,
  Quote,
  LogOut,
  Video,
  Image,
  Play,
  Upload,
  ArrowLeft,
  Lock,
  Star,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ARCHIVED_TOURNAMENTS } from "@/data/tournamentArchive";
import { optimizeImage } from "@/lib/imageUtils";
import { getPasswordStrength, withTimeout } from "@/lib/authUtils";
import { PREDEFINED_DEPARTMENTS } from "@/data/departments";
import { BasicInfoTab } from "@/components/profile/BasicInfoTab";
import { GameStatsTab } from "@/components/profile/GameStatsTab";
import { EquipmentTab } from "@/components/profile/EquipmentTab";
import { HighlightsTab } from "@/components/profile/HighlightsTab";
import { MediaTab } from "@/components/profile/MediaTab";
import { getYouTubeId } from "@/lib/playerUtils";

const PASSWORD_UPDATE_TIMEOUT_MS = 12_000;

export default function ProfileSetup() {
  const [, setLocation] = useLocation();
  const { id: paramId } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const { session, profile: authProfile, isInitializing, isAdmin } = useAuth();
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  // Tracks whether we've run the DB profile fetch for the current session
  const profileLoadedRef = useRef<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    "basic" | "badminton" | "equipment" | "highlights" | "media"
  >(() => {
    const hash = window.location.hash.replace("#", "");
    if (["basic", "badminton", "equipment", "highlights", "media"].includes(hash)) {
      return hash as "basic" | "badminton" | "equipment" | "highlights" | "media";
    }
    return "basic";
  });

  useEffect(() => {
    window.history.replaceState(null, "", `#${activeTab}`);
  }, [activeTab]);

  // ==========================================
  // Form State variables matching DB columns
  // ==========================================

  // Section 1: Basic Info
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState("looking");
  const [iiscEmail, setIiscEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [customDepartment, setCustomDepartment] = useState("");
  const [joinedYear, setJoinedYear] = useState("");
  const [nationality, setNationality] = useState("");
  const [homeState, setHomeState] = useState("");
  const [height, setHeight] = useState("");
  const [instagram, setInstagram] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [gender, setGender] = useState("");
  const [isGuest, setIsGuest] = useState(false);

  // Section 2: Badminton Attributes
  const [playingLevel, setPlayingLevel] = useState("Intermediate");
  const [playingStyle, setPlayingStyle] = useState("");
  const [dominantHand, setDominantHand] = useState("Right-handed");
  const [favoriteShot, setFavoriteShot] = useState("");
  const [yearsPlaying, setYearsPlaying] = useState("");
  const [coach, setCoach] = useState("");
  const [favoriteIdol, setFavoriteIdol] = useState("");
  const [favoriteFormat, setFavoriteFormat] = useState("");

  // Section 3: Equipment Arsenal (Multiple Rackets & Shoes!)
  const [rackets, setRackets] = useState<
    { name: string; string: string; tension: string }[]
  >([{ name: "", string: "", tension: "" }]);
  const [primaryRacketIndex, setPrimaryRacketIndex] = useState<number>(0);

  const [shoesList, setShoesList] = useState<{ name: string }[]>([
    { name: "" },
  ]);
  const [primaryShoeIndex, setPrimaryShoeIndex] = useState<number>(0);

  const [apparel, setApparel] = useState("");

  // Section 4: Highlights & Achievements
  const [bio, setBio] = useState("");
  const [quote, setQuote] = useState("");
  const [achievementsRaw, setAchievementsRaw] = useState("");
  const [tournamentsRaw, setTournamentsRaw] = useState("");
  const [tourName, setTourName] = useState("");
  const [tourYear, setTourYear] = useState("");
  const [achMedal, setAchMedal] = useState("Gold");
  const [achCustomMedal, setAchCustomMedal] = useState("");
  const [achTournament, setAchTournament] = useState("");
  const [achCategory, setAchCategory] = useState("Men's");
  const [achEventType, setAchEventType] = useState("Singles");

  const [careerHighlights, setCareerHighlights] = useState<
    { year: string; title: string; description: string }[]
  >([]);

  // Admin-defined Tournaments list & Achievements builder


  function handleImageBlur(idx: number, url: string) {
    if (!url) return;
    const img = new window.Image();
    img.onload = () =>
      setImagePreviewStatus((prev) => {
        const n = [...prev];
        n[idx] = "ok";
        return n;
      });
    img.onerror = () =>
      setImagePreviewStatus((prev) => {
        const n = [...prev];
        n[idx] = "error";
        return n;
      });
    img.src = url;
  }

  function handleVideoBlur(idx: number, url: string) {
    const ytId = getYouTubeId(url);
    setVideoPreviewIds((prev) => {
      const n = [...prev];
      n[idx] = ytId;
      return n;
    });
  }

  // Section 5: Media Gallery (Images & YouTube Videos)
  const [mediaImages, setMediaImages] = useState<
    { url: string; caption: string }[]
  >([]);
  const [mediaVideos, setMediaVideos] = useState<
    { url: string; caption: string }[]
  >([]);
  const [imagePreviewStatus, setImagePreviewStatus] = useState<
    ("ok" | "error" | "idle")[]
  >([]);
  const [videoPreviewIds, setVideoPreviewIds] = useState<(string | null)[]>([]);

  // Password Change State
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast("Password too short", {
        description: "Password must be at least 6 characters.",
        icon: "⚠️",
      });
      return;
    }
    setPasswordLoading(true);
    try {
      const {
        data: { session: currentSession },
      } = await withTimeout(
        supabase.auth.getSession(),
        PASSWORD_UPDATE_TIMEOUT_MS,
        "Could not verify your login session. Please try again.",
      );
      if (!currentSession)
        throw new Error("Your login session expired. Please sign in again.");

      const { error } = await withTimeout(
        supabase.auth.updateUser({ password: newPassword }),
        PASSWORD_UPDATE_TIMEOUT_MS,
        "Password update timed out. Please check your connection and try again.",
      );
      if (error) throw error;
      setNewPassword("");
      toast("Password Updated", {
        description: "You can now log in using your email and password.",
        icon: "🔒",
      });
    } catch (err: any) {
      toast("Update failed", { description: err.message, icon: "❌" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const [isEditing, setIsEditing] = useState(false);
  const [playerSlug, setPlayerSlug] = useState("");
  const [originalStats, setOriginalStats] = useState<any>({});

  // Redirect unauthenticated users once session is resolved
  useEffect(() => {
    if (!isInitializing && !session) {
      setLocation("/join");
    }
  }, [isInitializing, session, setLocation]);

  // Load player profile from DB — runs once per unique (session user + paramId) combination
  useEffect(() => {
    if (isInitializing || !session) return;

    // Build a cache key so we don't re-fetch if nothing has changed
    const cacheKey = `${session.user.id}:${paramId ?? ""}:${isAdmin}`;
    if (profileLoadedRef.current === cacheKey) return;
    profileLoadedRef.current = cacheKey;

    let mounted = true;

    // If we are just editing ourselves, we can seed it with the global profile directly
    const isSelfEdit = !paramId || (authProfile && authProfile.id === paramId);

    let query = supabase.from("players").select("*");
    if (paramId && isAdmin && !isSelfEdit) {
      query = query.eq("id", paramId);
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
          if (
            profile.department &&
            !PREDEFINED_DEPARTMENTS.includes(profile.department) &&
            profile.department !== "OTHER - Other"
          ) {
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
            const imgs = profile.stats.media.filter(
              (m: any) => m.type === "image",
            );
            const vids = profile.stats.media.filter(
              (m: any) => m.type === "video",
            );
            setMediaImages(
              imgs.map((i: any) => ({
                url: i.url || "",
                caption: i.caption || "",
              })),
            );
            setMediaVideos(
              vids.map((v: any) => ({
                url: v.url || "",
                caption: v.caption || "",
              })),
            );
          }

          if (profile.racket_details?.length > 0) {
            setRackets(
              profile.racket_details.map((r: any) => ({
                name: r.name || "",
                string: r.string || "",
                tension: (r.tension || "").replace(/[^0-9]/g, ""),
              })),
            );
            const primIdx = profile.racket_details.findIndex(
              (r: any) =>
                r.primary === true || r.name === profile.current_racket,
            );
            setPrimaryRacketIndex(primIdx >= 0 ? primIdx : 0);
          } else if (profile.current_racket) {
            setRackets([
              { name: profile.current_racket, string: "", tension: "" },
            ]);
            setPrimaryRacketIndex(0);
          } else {
            setRackets([{ name: "", string: "", tension: "" }]);
            setPrimaryRacketIndex(0);
          }

          if (profile.shoes) {
            try {
              if (profile.shoes.startsWith("[")) {
                const parsedShoes = JSON.parse(profile.shoes);
                setShoesList(
                  parsedShoes.map((s: any) => ({ name: s.name || "" })),
                );
                const primShoeIdx = parsedShoes.findIndex(
                  (s: any) => s.primary === true,
                );
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
          setCoach(profile.coach || "");
          setBio(profile.bio || "");
          setApparel(profile.apparel || "");
          setInstagram(profile.instagram || "");
          setAchievementsRaw(
            profile.achievements ? profile.achievements.join(", ") : "",
          );
          setTournamentsRaw(
            profile.tournament_history
              ? profile.tournament_history.join(", ")
              : "",
          );
        } else {
          if (session.user.user_metadata?.full_name)
            setFullName(session.user.user_metadata.full_name);
          if (session.user.user_metadata?.avatar_url)
            setAvatarUrl(session.user.user_metadata.avatar_url);
        }
      })
      .catch((err) => console.error("Error loading profile:", err));

    return () => {
      mounted = false;
    };
  }, [isInitializing, session, paramId]);

  const handleSignOut = async () => {
    if (confirm("Are you sure you want to sign out?")) {
      await supabase.auth.signOut();
      setLocation("/join");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);

    try {
      toast.loading("Optimizing image...");
      const optimizedFile = await optimizeImage(file, 1200, 0.85);

      if (optimizedFile.size > 1024 * 1024) {
        // 1MB fallback cap
        toast.dismiss();
        throw new Error(
          "Image could not be compressed enough. Please try a different image.",
        );
      }

      // Use just the user ID to ensure we overwrite the previous avatar
      const fileName = `${session.user.id}.webp`;
      const filePath = fileName;

      toast.dismiss();
      toast.loading("Uploading avatar...");

      // Upload the compressed Blob to Supabase
      const { error } = await supabase.storage
        .from("avatars")
        .upload(filePath, optimizedFile, {
          contentType: "image/webp",
          cacheControl: "3600",
          upsert: true,
        });

      toast.dismiss();

      if (error) throw error;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);
      // Add cache buster so the UI immediately updates
      setAvatarUrl(`${publicUrlData.publicUrl}?t=${Date.now()}`);
      toast.success("Avatar uploaded and compressed successfully!");
    } catch (err: any) {
      console.error("Avatar upload failed:", err);
      toast.error("Upload failed", {
        description:
          err.message ||
          "Ensure the bucket exists and public policies are active!",
      });
      setAvatarUrl("");
    } finally {
      setLoading(false);
      // Reset input so the same file can be selected again if needed
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setLoading(true);

    const validRackets = rackets.filter((r) => r.name.trim() !== "");
    const validShoes = shoesList.filter((s) => s.name.trim() !== "");
    const validImages = mediaImages.filter((img) => img.url.trim() !== "");
    const validVideos = mediaVideos.filter((vid) => vid.url.trim() !== "");

    // Secure primary selectors
    const finalPrimaryRacketIdx =
      primaryRacketIndex < validRackets.length ? primaryRacketIndex : 0;
    const finalPrimaryShoeIdx =
      primaryShoeIndex < validShoes.length ? primaryShoeIndex : 0;

    // Pack media into stats JSONB column without wiping other stats (winPercentage, currentStreak, etc.)
    const packedStats = {
      ...originalStats,
      media: [
        ...validImages.map((img) => ({
          type: "image",
          url: img.url,
          caption: img.caption,
        })),
        ...validVideos.map((vid) => ({
          type: "video",
          url: vid.url,
          caption: vid.caption,
        })),
      ],
    };

    const payload = {
      full_name: fullName,
      nickname: nickname || null,
      status: status,
      iisc_email: iiscEmail || null,
      contact_number: contactNumber || null,
      department:
        department === "OTHER - Other" ? customDepartment : department,
      joined_year: joinedYear ? parseInt(joinedYear) : null,
      playing_level: playingLevel,
      playing_style: playingStyle,
      dominant_hand: dominantHand || null,
      favorite_shot: favoriteShot || null,
      favorite_idol: favoriteIdol || null,
      gender: gender || null,
      favorite_format: favoriteFormat || null,
      quote: quote || null,
      avatar_url:
        avatarUrl ||
        `https://ui-avatars.com/api/?name=${fullName}&background=random`,
      current_racket:
        validRackets[finalPrimaryRacketIdx]?.name ||
        validRackets[0]?.name ||
        "",
      racket_details: validRackets.map((r, idx) => ({
        name: r.name,
        string: r.string || "Yonex BG65",
        tension: r.tension
          ? r.tension.includes("lbs")
            ? r.tension
            : `${r.tension} lbs`
          : "24 lbs",
        primary: idx === finalPrimaryRacketIdx,
      })),
      shoes: JSON.stringify(
        validShoes.map((s, idx) => ({
          name: s.name,
          primary: idx === finalPrimaryShoeIdx,
        })),
      ),
      stats: packedStats,
      nationality: nationality || null,
      home_state: homeState || null,
      height: height || null,
      years_playing: yearsPlaying ? parseInt(yearsPlaying) : null,
      coach: coach || null,
      bio: bio || null,
      apparel: apparel || null,
      instagram: instagram || null,
      achievements: achievementsRaw
        ? achievementsRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      tournament_history: tournamentsRaw
        ? tournamentsRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      career_highlights: careerHighlights.filter((h) => h.year && h.title),
      deleted_at: null, // Restore profile if it was soft-deleted
    };

    const timeoutMs = 60000;
    const mkTimeout = () =>
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Save timed out — please check your connection and try again.",
              ),
            ),
          timeoutMs,
        ),
      );

    try {
      if (isEditing) {
        // UPDATE existing profile
        const { error } = (await Promise.race([
          supabase
            .from("players")
            .update(payload)
            .eq("id", targetUserId || session.user.id),
          mkTimeout(),
        ])) as { error: any };

        if (error) throw error;

        // Success! Go back to their updated profile
        setLocation(`/player/${playerSlug}`);
      } else {
        // INSERT new profile
        const { error } = (await Promise.race([
          supabase
            .from("players")
            .insert({
              id: session.user.id,
              email: session.user.email,
              ...payload,
            }),
          mkTimeout(),
        ])) as { error: any };

        if (error) {
          if (error.code === "23505") {
            toast.error("Duplicate profile", {
              description: "A profile with this email or name already exists!",
            });
          } else {
            throw error;
          }
        } else {
          // Success! Go to their new shiny profile
          setLocation(`/player/${session.user.id}`);
        }
      }
    } catch (err: any) {
      console.error("Error saving profile:", err);
      toast.error("Failed to save profile", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (isInitializing)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );

  if (!session) return null; // Wait for redirect

  const tabs = [
    { id: "basic", label: "Basic Info", icon: UserCircle },
    { id: "badminton", label: "Game Stats", icon: Activity },
    { id: "equipment", label: "Equipment", icon: Swords },
    { id: "highlights", label: "Highlights", icon: Trophy },
    { id: "media", label: "Media Showcase", icon: Video },
  ];

  const tabOrder = tabs.map((t) => t.id);
  const currentIndex = tabOrder.indexOf(activeTab);
  const isLastTab = currentIndex === tabOrder.length - 1;
  const nextTabId = isLastTab ? null : tabOrder[currentIndex + 1];
  const nextTabObj = tabs.find((t) => t.id === nextTabId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6 sm:mb-8">
            <div className="text-center sm:text-left min-w-0">
              {isEditing && (playerSlug || paramId) && (
                <button
                  onClick={() =>
                    setLocation(`/player/${playerSlug || paramId}`)
                  }
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 mb-3 transition"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Profile
                </button>
              )}
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-2 leading-tight">
                <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-500 animate-pulse shrink-0" />
                {isEditing
                  ? "Edit Your Player Profile"
                  : "Complete Your Profile"}
              </h1>
              <p className="mt-2 text-slate-600 dark:text-slate-400 text-base sm:text-lg">
                {isEditing
                  ? "Keep your badminton card updated with your latest achievements!"
                  : "Welcome to IISc Badminton Club! Tell us about your game."}
              </p>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="self-center sm:self-auto flex items-center justify-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-semibold border border-rose-100 dark:border-rose-900/30 transition shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>

          {/* Sleek Tab Navigation */}
          <div className="-mx-4 sm:mx-0 px-4 sm:px-0 flex border-b border-slate-200 dark:border-slate-800 mb-6 sm:mb-8 overflow-x-auto gap-2 pb-2 scrollbar-none snap-x">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`snap-start shrink-0 flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 font-semibold text-sm rounded-xl transition-all whitespace-nowrap outline-none
                    ${
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/50"
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 p-5 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <AnimatePresence mode="wait">
                {activeTab === "basic" && (
                  <BasicInfoTab
                    avatarUrl={avatarUrl}
                    setAvatarUrl={setAvatarUrl}
                    fullName={fullName}
                    setFullName={setFullName}
                    nickname={nickname}
                    setNickname={setNickname}
                    iiscEmail={iiscEmail}
                    setIiscEmail={setIiscEmail}
                    contactNumber={contactNumber}
                    setContactNumber={setContactNumber}
                    gender={gender}
                    setGender={setGender}
                    joinedYear={joinedYear}
                    setJoinedYear={setJoinedYear}
                    isGuest={isGuest}
                    setIsGuest={setIsGuest}
                    department={department}
                    setDepartment={setDepartment}
                    customDepartment={customDepartment}
                    setCustomDepartment={setCustomDepartment}
                    handleAvatarUpload={handleAvatarUpload}
                  />
                )}

                {activeTab === "badminton" && (
                  <GameStatsTab
                    playingLevel={playingLevel}
                    setPlayingLevel={setPlayingLevel}
                    playingStyle={playingStyle}
                    setPlayingStyle={setPlayingStyle}
                    dominantHand={dominantHand}
                    setDominantHand={setDominantHand}
                    favoriteShot={favoriteShot}
                    setFavoriteShot={setFavoriteShot}
                    yearsPlaying={yearsPlaying}
                    setYearsPlaying={setYearsPlaying}
                    coach={coach}
                    setCoach={setCoach}
                    favoriteIdol={favoriteIdol}
                    setFavoriteIdol={setFavoriteIdol}
                    favoriteFormat={favoriteFormat}
                    setFavoriteFormat={setFavoriteFormat}
                  />
                )}

                {activeTab === "equipment" && (
                  <EquipmentTab
                    rackets={rackets}
                    setRackets={setRackets}
                    primaryRacketIndex={primaryRacketIndex}
                    setPrimaryRacketIndex={setPrimaryRacketIndex}
                    shoesList={shoesList}
                    setShoesList={setShoesList}
                    primaryShoeIndex={primaryShoeIndex}
                    setPrimaryShoeIndex={setPrimaryShoeIndex}
                    apparel={apparel}
                    setApparel={setApparel}
                  />
                )}

                {activeTab === "highlights" && (
                  <HighlightsTab
                    bio={bio}
                    setBio={setBio}
                    quote={quote}
                    setQuote={setQuote}
                    tournamentsRaw={tournamentsRaw}
                    setTournamentsRaw={setTournamentsRaw}
                    tourName={tourName}
                    setTourName={setTourName}
                    tourYear={tourYear}
                    setTourYear={setTourYear}
                    achievementsRaw={achievementsRaw}
                    setAchievementsRaw={setAchievementsRaw}
                    achCategory={achCategory}
                    setAchCategory={setAchCategory}
                    achEventType={achEventType}
                    setAchEventType={setAchEventType}
                    achMedal={achMedal}
                    setAchMedal={setAchMedal}
                    achCustomMedal={achCustomMedal}
                    setAchCustomMedal={setAchCustomMedal}
                    achTournament={achTournament}
                    setAchTournament={setAchTournament}
                    careerHighlights={careerHighlights}
                    setCareerHighlights={setCareerHighlights}
                  />
                )}

                {activeTab === "media" && (
                  <MediaTab
                    mediaImages={mediaImages}
                    setMediaImages={setMediaImages}
                    imagePreviewStatus={imagePreviewStatus}
                    setImagePreviewStatus={setImagePreviewStatus}
                    mediaVideos={mediaVideos}
                    setMediaVideos={setMediaVideos}
                    videoPreviewIds={videoPreviewIds}
                    setVideoPreviewIds={setVideoPreviewIds}
                    handleImageBlur={handleImageBlur}
                    handleVideoBlur={handleVideoBlur}
                  />
                )}
              </AnimatePresence>

              <div className="pt-5 sm:pt-6 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                {isLastTab ? (
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[52px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3.5 rounded-xl shadow-lg shadow-emerald-500/25 transition-all text-base sm:text-lg flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Save & Launch Profile
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveTab(nextTabId as any);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="w-full min-h-[52px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3.5 rounded-xl shadow-lg shadow-emerald-500/25 transition-all text-base sm:text-lg flex items-center justify-center gap-2"
                  >
                    Save & Next: {nextTabObj?.label}{" "}
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                )}

                <button
                  type="button"
                  onClick={(e) => handleSubmit(e as any)}
                  disabled={loading}
                  className="min-h-[52px] px-6 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed text-xs sm:text-sm"
                >
                  Complete profile later, Launch for now
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
