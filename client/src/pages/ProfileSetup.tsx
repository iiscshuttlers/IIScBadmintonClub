import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserCircle, Trophy, Save, Sparkles, Activity,
  Swords, BookOpen, Quote, LogOut, Video, Image, Play, Upload, ArrowLeft, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";

export default function ProfileSetup() {
  const [, setLocation] = useLocation();
  const { id: paramId } = useParams();
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"basic" | "badminton" | "equipment" | "highlights" | "media">("basic");

  // ==========================================
  // Form State variables matching DB columns
  // ==========================================

  // Section 1: Basic Info
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [iiscEmail, setIiscEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [joinedYear, setJoinedYear] = useState("");
  const [nationality, setNationality] = useState("");
  const [homeState, setHomeState] = useState("");
  const [height, setHeight] = useState("");
  const [instagram, setInstagram] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Section 2: Badminton Attributes
  const [playingLevel, setPlayingLevel] = useState("Intermediate");
  const [playingStyle, setPlayingStyle] = useState("");
  const [dominantHand, setDominantHand] = useState("Right-handed");
  const [favoriteShot, setFavoriteShot] = useState("");
  const [yearsPlaying, setYearsPlaying] = useState("");
  const [coach, setCoach] = useState("");
  const [favoriteIdol, setFavoriteIdol] = useState("");

  // Section 3: Equipment Arsenal (Multiple Rackets & Shoes!)
  const [rackets, setRackets] = useState<{ name: string; string: string; tension: string; }[]>([
    { name: "", string: "", tension: "" }
  ]);
  const [primaryRacketIndex, setPrimaryRacketIndex] = useState<number>(0);

  const [shoesList, setShoesList] = useState<{ name: string; }[]>([
    { name: "" }
  ]);
  const [primaryShoeIndex, setPrimaryShoeIndex] = useState<number>(0);

  const [apparel, setApparel] = useState("");

  // Section 4: Highlights & Achievements
  const [bio, setBio] = useState("");
  const [quote, setQuote] = useState("");
  const [achievementsRaw, setAchievementsRaw] = useState("");
  const [tournamentsRaw, setTournamentsRaw] = useState("");

  // Admin-defined Tournaments list & Achievements builder
  const OFFICIAL_TOURNAMENTS = [
    "Gandhi Cup 2025",
    "Farewell Badminton Tournament 2026",
    "SPECTRUM 2026",
    "Open Tournament 2025",
    "Open Tournament 2024 (Gandhi Cup)",
    "INViCTA 2026",
    "BPL 2026",
    "Other (Type Custom below)"
  ];

  const EVENT_CATEGORIES = [
    "Men's Singles",
    "Men's Doubles",
    "Women's Singles",
    "Women's Doubles",
    "Mixed Doubles",
    "Team Gold",
    "Team Silver",
    "Team Bronze"
  ];

  const PLACEMENT_RESULTS = [
    "Winner",
    "Runner-up",
    "Semifinalist",
    "Bronze Medalist"
  ];

  const [selTournament, setSelTournament] = useState(OFFICIAL_TOURNAMENTS[0]);
  const [customTournamentText, setCustomTournamentText] = useState("");
  const [selCategory, setSelCategory] = useState(EVENT_CATEGORIES[0]);
  const [selResult, setSelResult] = useState(PLACEMENT_RESULTS[0]);

  function getYouTubeId(url: string): string | null {
    const m = url.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]{11})/);
    return m ? m[1] : null;
  }

  function handleImageBlur(idx: number, url: string) {
    if (!url) return;
    const img = new window.Image();
    img.onload = () =>
      setImagePreviewStatus((prev) => { const n = [...prev]; n[idx] = "ok"; return n; });
    img.onerror = () =>
      setImagePreviewStatus((prev) => { const n = [...prev]; n[idx] = "error"; return n; });
    img.src = url;
  }

  function handleVideoBlur(idx: number, url: string) {
    const ytId = getYouTubeId(url);
    setVideoPreviewIds((prev) => { const n = [...prev]; n[idx] = ytId; return n; });
  }

  const addOfficialAchievement = () => {
    const tournamentName = selTournament === "Other (Type Custom below)" ? customTournamentText.trim() : selTournament;
    if (!tournamentName) {
      alert("Please type a custom tournament name!");
      return;
    }
    const text = `${selCategory} ${selResult} - ${tournamentName}`;
    const current = achievementsRaw.trim();
    if (current) {
      setAchievementsRaw(current + ", " + text);
    } else {
      setAchievementsRaw(text);
    }

    const tourCurrent = tournamentsRaw.split(",").map(s => s.trim()).filter(Boolean);
    if (!tourCurrent.includes(tournamentName)) {
      setTournamentsRaw(tournamentsRaw.trim() ? tournamentsRaw.trim() + ", " + tournamentName : tournamentName);
    }
  };

  // Section 5: Media Gallery (Images & YouTube Videos)
  const [mediaImages, setMediaImages] = useState<{ url: string; caption: string; }[]>([]);
  const [mediaVideos, setMediaVideos] = useState<{ url: string; caption: string; }[]>([]);
  const [imagePreviewStatus, setImagePreviewStatus] = useState<("ok" | "error" | "idle")[]>([]);
  const [videoPreviewIds, setVideoPreviewIds] = useState<(string | null)[]>([]);

  // Password Change State
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast("Password too short", { description: "Password must be at least 6 characters.", icon: "⚠️" });
      return;
    }
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      toast("Password Updated", { description: "You can now log in using your email and password.", icon: "🔒" });
    } catch (err: any) {
      toast("Update failed", { description: err.message, icon: "❌" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const [isEditing, setIsEditing] = useState(false);
  const [playerSlug, setPlayerSlug] = useState("");
  const [originalStats, setOriginalStats] = useState<any>({});

  useEffect(() => {
    let mounted = true;
    
    const loadProfile = async (currentSession: any) => {
      if (!currentSession) {
        if (mounted) {
          setIsInitializing(false);
          setLocation("/join");
        }
        return;
      }

      if (mounted) {
        setSession(currentSession);
        const adminStatus = isAdminEmail(currentSession.user.email);
        setIsAdmin(adminStatus);

        let query = supabase.from("players").select("*");
        if (paramId && adminStatus) {
          query = query.eq("id", paramId);
        } else {
          query = query.eq("user_id", currentSession.user.id);
        }

        query
          .maybeSingle()
          .then(({ data: profile, error }) => {
            if (profile && !error) {
              setTargetUserId(profile.user_id);
              setIsEditing(true);
              setPlayerSlug(profile.id);
              setFullName(profile.full_name || "");
              setNickname(profile.nickname || "");
              setIiscEmail(profile.iisc_email || "");
              setContactNumber(profile.contact_number || "");
              setDepartment(profile.department || "");
              setJoinedYear(profile.joined_year?.toString() || "");
              setPlayingLevel(profile.playing_level || "Intermediate");
              setPlayingStyle(profile.playing_style || "");
              setDominantHand(profile.dominant_hand || "Right-handed");
              setFavoriteShot(profile.favorite_shot || "");
              setFavoriteIdol(profile.favorite_idol || "");
              setQuote(profile.quote || "");
              setAvatarUrl(profile.avatar_url || "");

              // Load original stats for preservation
              setOriginalStats(profile.stats || {});

              // Load media gallery from stats
              if (profile.stats && profile.stats.media) {
                const imgs = profile.stats.media.filter((m: any) => m.type === "image");
                const vids = profile.stats.media.filter((m: any) => m.type === "video");
                setMediaImages(imgs.map((i: any) => ({ url: i.url || "", caption: i.caption || "" })));
                setMediaVideos(vids.map((v: any) => ({ url: v.url || "", caption: v.caption || "" })));
              }

              // Load Rackets and identify primary
              if (profile.racket_details && profile.racket_details.length > 0) {
                setRackets(profile.racket_details.map((r: any) => ({
                  name: r.name || "",
                  string: r.string || "",
                  tension: (r.tension || "").replace(/[^0-9]/g, "")
                })));
                const primIdx = profile.racket_details.findIndex((r: any) => r.primary === true || r.name === profile.current_racket);
                setPrimaryRacketIndex(primIdx >= 0 ? primIdx : 0);
              } else if (profile.current_racket) {
                setRackets([{ name: profile.current_racket, string: "", tension: "" }]);
                setPrimaryRacketIndex(0);
              } else {
                setRackets([{ name: "", string: "", tension: "" }]);
                setPrimaryRacketIndex(0);
              }

              // Load Shoes and identify primary
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
              setHeight(profile.height || "");
              setYearsPlaying(profile.years_playing?.toString() || "");
              setCoach(profile.coach || "");
              setBio(profile.bio || "");
              setApparel(profile.apparel || "");
              setInstagram(profile.instagram || "");
              setAchievementsRaw(profile.achievements ? profile.achievements.join(", ") : "");
              setTournamentsRaw(profile.tournament_history ? profile.tournament_history.join(", ") : "");
              if (mounted) setIsInitializing(false);
            } else {
              if (currentSession.user.user_metadata?.full_name && mounted) {
                setFullName(currentSession.user.user_metadata.full_name);
              }
              if (currentSession.user.user_metadata?.avatar_url && mounted) {
                setAvatarUrl(currentSession.user.user_metadata.avatar_url);
              }
              if (mounted) setIsInitializing(false);
            }
          })
          .catch((err) => {
            console.error("Error loading profile:", err);
            if (mounted) setIsInitializing(false);
          });
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      loadProfile(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setLocation, paramId]);

  const handleSignOut = async () => {
    if (confirm("Are you sure you want to sign out?")) {
      await supabase.auth.signOut();
      setLocation("/join");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 512 * 1024) {
      alert("Image too large. Please choose a file under 512 KB.");
      e.target.value = "";
      return;
    }

    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload file to Supabase avatars bucket
      const { error } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      alert("Avatar uploaded successfully!");
    } catch (err: any) {
      console.error("Upload error:", err);
      alert("Failed to upload to Supabase avatars bucket. Please ensure the bucket exists and public policies are active! Falling back to URL input.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setLoading(true);

    const validRackets = rackets.filter(r => r.name.trim() !== "");
    const validShoes = shoesList.filter(s => s.name.trim() !== "");
    const validImages = mediaImages.filter(img => img.url.trim() !== "");
    const validVideos = mediaVideos.filter(vid => vid.url.trim() !== "");

    // Secure primary selectors
    const finalPrimaryRacketIdx = primaryRacketIndex < validRackets.length ? primaryRacketIndex : 0;
    const finalPrimaryShoeIdx = primaryShoeIndex < validShoes.length ? primaryShoeIndex : 0;

    // Pack media into stats JSONB column without wiping other stats (winPercentage, currentStreak, etc.)
    const packedStats = {
      ...originalStats,
      media: [
        ...validImages.map(img => ({ type: "image", url: img.url, caption: img.caption })),
        ...validVideos.map(vid => ({ type: "video", url: vid.url, caption: vid.caption }))
      ]
    };

    const payload = {
      full_name: fullName,
      nickname: nickname || null,
      iisc_email: iiscEmail || null,
      contact_number: contactNumber || null,
      department: department,
      joined_year: joinedYear ? parseInt(joinedYear) : null,
      playing_level: playingLevel,
      playing_style: playingStyle,
      dominant_hand: dominantHand || null,
      favorite_shot: favoriteShot || null,
      favorite_idol: favoriteIdol || null,
      quote: quote || null,
      avatar_url: avatarUrl || `https://ui-avatars.com/api/?name=${fullName}&background=random`,
      current_racket: validRackets[finalPrimaryRacketIdx]?.name || validRackets[0]?.name || "",
      racket_details: validRackets.map((r, idx) => ({
        name: r.name,
        string: r.string || "Yonex BG65",
        tension: r.tension ? (r.tension.includes("lbs") ? r.tension : `${r.tension} lbs`) : "24 lbs",
        primary: idx === finalPrimaryRacketIdx
      })),
      shoes: JSON.stringify(validShoes.map((s, idx) => ({
        name: s.name,
        primary: idx === finalPrimaryShoeIdx
      }))),
      stats: packedStats,
      nationality: nationality || null,
      home_state: homeState || null,
      height: height || null,
      years_playing: yearsPlaying ? parseInt(yearsPlaying) : null,
      coach: coach || null,
      bio: bio || null,
      apparel: apparel || null,
      instagram: instagram || null,
      achievements: achievementsRaw ? achievementsRaw.split(",").map(s => s.trim()).filter(Boolean) : [],
      tournament_history: tournamentsRaw ? tournamentsRaw.split(",").map(s => s.trim()).filter(Boolean) : [],
    };

    const timeoutMs = 60000;
    const mkTimeout = () => new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Save timed out — please check your connection and try again.")), timeoutMs)
    );

    try {
      if (isEditing) {
        // UPDATE existing profile
        const { error } = (await Promise.race([
          supabase.from("players").update(payload).eq("user_id", targetUserId || session.user.id),
          mkTimeout()
        ])) as { error: any };

        if (error) throw error;

        // Success! Go back to their updated profile
        setLocation(`/player/${playerSlug}`);
      } else {
        // INSERT new profile
        const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

        const { error } = (await Promise.race([
          supabase.from("players").insert({ id: slug, user_id: session.user.id, email: session.user.email, ...payload }),
          mkTimeout()
        ])) as { error: any };

        if (error) {
          if (error.code === '23505') {
            alert("A profile with this email or name already exists!");
          } else {
            throw error;
          }
        } else {
          // Success! Go to their new shiny profile
          setLocation(`/player/${slug}`);
        }
      }
    } catch (err: any) {
      console.error("Error saving profile:", err);
      alert("Failed to save profile. " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isInitializing) return (
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
            <div className="text-center sm:text-left">
              {isEditing && (playerSlug || paramId) && (
                <button
                  onClick={() => setLocation(`/player/${playerSlug || paramId}`)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 mb-3 transition"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Profile
                </button>
              )}
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-2">
                <Sparkles className="w-8 h-8 text-emerald-500 animate-pulse" />
                {isEditing ? "Edit Your Player Profile" : "Complete Your Profile"}
              </h1>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                {isEditing ? "Keep your badminton card updated with your latest achievements!" : "Welcome to IISc Badminton Club! Tell us about your game."}
              </p>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-semibold border border-rose-100 dark:border-rose-900/30 transition shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>

          {/* Sleek Tab Navigation */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 mb-8 overflow-x-auto gap-1 pb-1 scrollbar-none">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-xl transition-all whitespace-nowrap outline-none
                    ${isActive
                      ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/50"}`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 p-8">
            <form onSubmit={handleSubmit} className="space-y-6">

              <AnimatePresence mode="wait">

                {/* TAB 1: BASIC INFO */}
                {activeTab === "basic" && (
                  <motion.div
                    key="basic"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    {/* Avatar Upload / URL picker */}
                    <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <UserCircle className="w-5 h-5 text-emerald-500" />
                        Profile Picture (Avatar)
                      </h3>

                      <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-300 dark:border-slate-700">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-600 text-3xl font-bold uppercase">
                              {fullName ? fullName.charAt(0) : "U"}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 w-full space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Direct Image Link</label>
                            <input
                              type="text"
                              value={avatarUrl}
                              onChange={(e) => setAvatarUrl(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g. https://images.unsplash.com/... or your custom avatar URL"
                            />
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>or</span>
                            <label className="flex items-center gap-1 cursor-pointer font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
                              <Upload className="w-3.5 h-3.5" />
                              Upload Image File
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarUpload}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Full Name *</label>
                        <input
                          required
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="e.g. Tanu Singh"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Nickname / Alias</label>
                        <input
                          type="text"
                          value={nickname}
                          onChange={(e) => setNickname(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="e.g. Tanya"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">IISc Email *</label>
                        <input
                          required
                          type="email"
                          value={iiscEmail}
                          onChange={(e) => setIiscEmail(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="e.g. tanu@iisc.ac.in"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Contact Number *</label>
                        <input
                          required
                          type="tel"
                          pattern="[0-9]{10}"
                          title="Please enter exactly 10 digits"
                          value={contactNumber}
                          onChange={(e) => setContactNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="e.g. 9876543210"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Department *</label>
                        <input
                          required
                          type="text"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="e.g. Aerospace Engineering"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Joined Year (Class of) *</label>
                        <input
                          required
                          type="number"
                          value={joinedYear}
                          onChange={(e) => setJoinedYear(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="e.g. 2022"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Nationality</label>
                        <input
                          type="text"
                          value={nationality}
                          onChange={(e) => setNationality(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder="e.g. Indian"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Home State</label>
                        <input
                          type="text"
                          value={homeState}
                          onChange={(e) => setHomeState(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder="e.g. Rajasthan"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Height (in cm)</label>
                        <input
                          type="number"
                          value={height}
                          onChange={(e) => setHeight(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder="e.g. 175"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Instagram Handle</label>
                      <input
                        type="text"
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="e.g. @iiscbadmintonclub"
                      />
                    </div>

                    {/* Change Password Section */}
                    <div className="pt-6 border-t border-slate-200 dark:border-slate-700/50 mt-6">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-emerald-500" /> Account Security
                      </h3>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-3 pl-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                            placeholder="Enter new password (min 6 chars)"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handlePasswordChange}
                          disabled={passwordLoading || !newPassword}
                          className="px-6 py-3 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/40 text-emerald-700 dark:text-emerald-400 font-bold rounded-xl transition-all whitespace-nowrap disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {passwordLoading ? <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" /> : "Set Password"}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Setting a password allows you to log in with your email and password instead of using OTP codes.</p>
                    </div>
                  </motion.div>
                )}

                {/* TAB 2: GAME STATS / BADMINTON */}
                {activeTab === "badminton" && (
                  <motion.div
                    key="badminton"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Playing Level *</label>
                        <select
                          value={playingLevel}
                          onChange={(e) => setPlayingLevel(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                          <option value="Beginner">Beginner</option>
                          <option value="Intermediate">Intermediate</option>
                          <option value="Advanced">Advanced</option>
                          <option value="Professional">Professional</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Playing Style</label>
                        <input
                          type="text"
                          value={playingStyle}
                          onChange={(e) => setPlayingStyle(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder="e.g. Aggressive, Defensive, All-round"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Dominant Hand</label>
                        <select
                          value={dominantHand}
                          onChange={(e) => setDominantHand(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                          <option value="Right-handed">Right-handed</option>
                          <option value="Left-handed">Left-handed</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Signature Shot</label>
                        <input
                          type="text"
                          value={favoriteShot}
                          onChange={(e) => setFavoriteShot(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder="e.g. Net Cross Drop, Jump Smash"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Years Playing Badminton</label>
                        <input
                          type="number"
                          value={yearsPlaying}
                          onChange={(e) => setYearsPlaying(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder="e.g. 5"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Coach</label>
                        <input
                          type="text"
                          value={coach}
                          onChange={(e) => setCoach(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder="e.g. Self-coached or Academy Name"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Badminton Idol</label>
                      <input
                        type="text"
                        value={favoriteIdol}
                        onChange={(e) => setFavoriteIdol(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="e.g. Lin Dan, Viktor Axelsen"
                      />
                    </div>
                  </motion.div>
                )}

                {/* TAB 3: EQUIPMENT ARSENAL */}
                {activeTab === "equipment" && (
                  <motion.div
                    key="equipment"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-8"
                  >
                    {/* Multiple Rackets Arsenal */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Rackets in your Bag (Equipment Arsenal)</label>
                        <button
                          type="button"
                          onClick={() => setRackets([...rackets, { name: "", string: "", tension: "" }])}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30 transition shadow-sm"
                        >
                          + Add Racket
                        </button>
                      </div>

                      <div className="space-y-4">
                        {rackets.map((item, index) => (
                          <div key={index} className={`p-4 border rounded-2xl relative space-y-4 shadow-sm transition-all
                            ${index === primaryRacketIndex
                              ? "bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-300 dark:border-emerald-800"
                              : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"}`}
                          >
                            <div className="flex justify-between items-center pr-12">
                              {/* Primary Selection */}
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="primaryRacket"
                                  checked={index === primaryRacketIndex}
                                  onChange={() => setPrimaryRacketIndex(index)}
                                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300"
                                />
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Set as Primary Racket</span>
                              </label>

                              {rackets.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRackets(rackets.filter((_, idx) => idx !== index));
                                    if (primaryRacketIndex === index) setPrimaryRacketIndex(0);
                                    else if (primaryRacketIndex > index) setPrimaryRacketIndex(primaryRacketIndex - 1);
                                  }}
                                  className="text-xs font-bold text-rose-500 hover:text-rose-600 transition"
                                >
                                  Remove
                                </button>
                              )}
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Racket Name</label>
                              <input
                                type="text"
                                required
                                value={item.name}
                                onChange={(e) => {
                                  const updated = [...rackets];
                                  updated[index].name = e.target.value;
                                  setRackets(updated);
                                }}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="e.g. Yonex Astrox 99 Pro"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">String Model</label>
                                <input
                                  type="text"
                                  value={item.string}
                                  onChange={(e) => {
                                    const updated = [...rackets];
                                    updated[index].string = e.target.value;
                                    setRackets(updated);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                  placeholder="e.g. Yonex BG80"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Tension (lbs)</label>
                                <input
                                  type="number"
                                  value={item.tension}
                                  onChange={(e) => {
                                    const updated = [...rackets];
                                    updated[index].tension = e.target.value;
                                    setRackets(updated);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                  placeholder="e.g. 26"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Multiple Shoes Arsenal */}
                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-center">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Footwear / Shoes Arsenal</label>
                        <button
                          type="button"
                          onClick={() => setShoesList([...shoesList, { name: "" }])}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30 transition shadow-sm"
                        >
                          + Add Shoe
                        </button>
                      </div>

                      <div className="space-y-4">
                        {shoesList.map((item, index) => (
                          <div key={index} className={`p-4 border rounded-2xl relative space-y-4 shadow-sm transition-all
                            ${index === primaryShoeIndex
                              ? "bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-300 dark:border-emerald-800"
                              : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"}`}
                          >
                            <div className="flex justify-between items-center pr-12">
                              {/* Primary Selection */}
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="primaryShoe"
                                  checked={index === primaryShoeIndex}
                                  onChange={() => setPrimaryShoeIndex(index)}
                                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300"
                                />
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Set as Primary Shoe</span>
                              </label>

                              {shoesList.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShoesList(shoesList.filter((_, idx) => idx !== index));
                                    if (primaryShoeIndex === index) setPrimaryShoeIndex(0);
                                    else if (primaryShoeIndex > index) setPrimaryShoeIndex(primaryShoeIndex - 1);
                                  }}
                                  className="text-xs font-bold text-rose-500 hover:text-rose-600 transition"
                                >
                                  Remove
                                </button>
                              )}
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Shoe Model Name</label>
                              <input
                                type="text"
                                required
                                value={item.name}
                                onChange={(e) => {
                                  const updated = [...shoesList];
                                  updated[index].name = e.target.value;
                                  setShoesList(updated);
                                }}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="e.g. Yonex Power Cushion 65 Z3"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Preferred Apparel / Gear Brand</label>
                      <input
                        type="text"
                        value={apparel}
                        onChange={(e) => setApparel(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="e.g. Yonex, Li-Ning"
                      />
                    </div>
                  </motion.div>
                )}

                {/* TAB 4: HIGHLIGHTS & BIO */}
                {activeTab === "highlights" && (
                  <motion.div
                    key="highlights"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Bio / About Yourself</label>
                      <textarea
                        rows={3}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        placeholder="PhD researcher at IISc. Known for aggressive net play and quick reflexes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Motivational Quote</label>
                      <input
                        type="text"
                        value={quote}
                        onChange={(e) => setQuote(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="e.g. Enjoying the Game is the best strategy"
                      />
                    </div>

                    {/* Quick Achievement Builder */}
                    <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50/30 dark:from-slate-900 dark:to-slate-800/40 rounded-2xl border border-emerald-100 dark:border-slate-800 space-y-4">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-emerald-500 animate-bounce" />
                        Quick Achievement Builder (Official Tournaments)
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Admin-selected tournaments. Choose your tournament, category, and result, then click "Add to List" to automatically format and append it below!
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Tournament</label>
                          <select
                            value={selTournament}
                            onChange={(e) => setSelTournament(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            {OFFICIAL_TOURNAMENTS.map((t, idx) => (
                              <option key={idx} value={t}>{t}</option>
                            ))}
                          </select>

                          {selTournament === "Other (Type Custom below)" && (
                            <input
                              type="text"
                              required
                              value={customTournamentText}
                              onChange={(e) => setCustomTournamentText(e.target.value)}
                              className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-250 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                              placeholder="Type custom tournament name"
                            />
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Event Category</label>
                          <select
                            value={selCategory}
                            onChange={(e) => setSelCategory(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            {EVENT_CATEGORIES.map((c, idx) => (
                              <option key={idx} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Result / Placement</label>
                          <select
                            value={selResult}
                            onChange={(e) => setSelResult(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            {PLACEMENT_RESULTS.map((r, idx) => (
                              <option key={idx} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={addOfficialAchievement}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/25 transition flex items-center gap-1.5"
                        >
                          <Trophy className="w-3.5 h-3.5" />
                          Add to Achievements
                        </button>
                      </div>
                    </div>

                    {/* Achievements tag chips */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Top Achievements</label>
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 space-y-3">
                        {achievementsRaw.split(",").map(s => s.trim()).filter(Boolean).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {[...achievementsRaw.split(",").map(s => s.trim()).filter(Boolean)]
                              .sort((a, b) => {
                                const ya = parseInt(a.match(/\d{4}/)?.[0] ?? "0");
                                const yb = parseInt(b.match(/\d{4}/)?.[0] ?? "0");
                                return yb - ya;
                              })
                              .map((ach, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                                  🏆 {ach}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = achievementsRaw.split(",").map(s => s.trim()).filter(Boolean).filter(item => item !== ach);
                                      setAchievementsRaw(updated.join(", "));
                                    }}
                                    className="ml-0.5 text-emerald-500 hover:text-rose-500 transition font-black text-sm leading-none"
                                  >×</button>
                                </span>
                              ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            id="achInput"
                            placeholder="e.g. Men's Doubles Winner - Farewell 2026"
                            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault();
                                const val = (e.target as HTMLInputElement).value.trim();
                                if (val) {
                                  setAchievementsRaw(achievementsRaw.trim() ? achievementsRaw.trim() + ", " + val : val);
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const inp = document.getElementById('achInput') as HTMLInputElement;
                              const val = inp?.value.trim();
                              if (val) { setAchievementsRaw(achievementsRaw.trim() ? achievementsRaw.trim() + ", " + val : val); inp.value = ''; }
                            }}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shrink-0"
                          >Add</button>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Press Enter or comma to add · Click × to remove · Or use the builder above</p>
                      </div>
                    </div>

                    {/* Tournaments tag chips */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Tournaments Played</label>
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 space-y-3">
                        {tournamentsRaw.split(",").map(s => s.trim()).filter(Boolean).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {[...tournamentsRaw.split(",").map(s => s.trim()).filter(Boolean)]
                              .sort((a, b) => {
                                const ya = parseInt(a.match(/\d{4}/)?.[0] ?? "0");
                                const yb = parseInt(b.match(/\d{4}/)?.[0] ?? "0");
                                return yb - ya;
                              })
                              .map((t, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-xs font-bold">
                                  🏸 {t}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = tournamentsRaw.split(",").map(s => s.trim()).filter(Boolean).filter(item => item !== t);
                                      setTournamentsRaw(updated.join(", "));
                                    }}
                                    className="ml-0.5 text-blue-500 hover:text-rose-500 transition font-black text-sm leading-none"
                                  >×</button>
                                </span>
                              ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            id="tourInput"
                            placeholder="e.g. Farewell 2026"
                            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault();
                                const val = (e.target as HTMLInputElement).value.trim();
                                if (val) {
                                  setTournamentsRaw(tournamentsRaw.trim() ? tournamentsRaw.trim() + ", " + val : val);
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const inp = document.getElementById('tourInput') as HTMLInputElement;
                              const val = inp?.value.trim();
                              if (val) { setTournamentsRaw(tournamentsRaw.trim() ? tournamentsRaw.trim() + ", " + val : val); inp.value = ''; }
                            }}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shrink-0"
                          >Add</button>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Press Enter or comma to add · Click × to remove</p>
                      </div>
                    </div>
                  </motion.div>
                )}


                {/* TAB 5: MEDIA SHOWCASE (Images & YouTube Videos) */}
                {activeTab === "media" && (
                  <motion.div
                    key="media"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-8"
                  >
                    {/* Game Photos Links */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Image className="w-5 h-5 text-emerald-500" />
                          Game Photos Showcase
                        </label>
                        <button
                          type="button"
                          onClick={() => setMediaImages([...mediaImages, { url: "", caption: "" }])}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30 transition shadow-sm"
                        >
                          + Add Photo Link
                        </button>
                      </div>

                      <div className="space-y-3">
                        {mediaImages.map((img, idx) => (
                          <div key={idx} className="flex gap-3 items-end p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 relative">
                            <button
                              type="button"
                              onClick={() => setMediaImages(mediaImages.filter((_, i) => i !== idx))}
                              className="absolute top-2 right-2 text-rose-500 hover:text-rose-600 text-xs font-bold"
                            >
                              Remove
                            </button>
                            <div className="flex-1 space-y-3">
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Image URL</label>
                                <input
                                  type="text"
                                  required
                                  value={img.url}
                                  onChange={(e) => {
                                    const updated = [...mediaImages];
                                    updated[idx].url = e.target.value;
                                    setMediaImages(updated);
                                    setImagePreviewStatus((prev) => { const n = [...prev]; n[idx] = "idle"; return n; });
                                  }}
                                  onBlur={(e) => handleImageBlur(idx, e.target.value)}
                                  className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500
                                    ${imagePreviewStatus[idx] === "error" ? "border-rose-400 dark:border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                                  placeholder="e.g. https://images.unsplash.com/photo-..."
                                />
                                {imagePreviewStatus[idx] === "ok" && img.url && (
                                  <div className="mt-2 rounded-xl overflow-hidden border border-emerald-200 dark:border-emerald-800 w-full aspect-video bg-slate-100 dark:bg-slate-800">
                                    <img src={img.url} alt="preview" className="w-full h-full object-cover" />
                                  </div>
                                )}
                                {imagePreviewStatus[idx] === "error" && (
                                  <p className="mt-1 text-[11px] text-rose-500 font-semibold">Could not load image — check the URL.</p>
                                )}
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Caption</label>
                                <input
                                  type="text"
                                  value={img.caption}
                                  onChange={(e) => {
                                    const updated = [...mediaImages];
                                    updated[idx].caption = e.target.value;
                                    setMediaImages(updated);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                                  placeholder="e.g. Winning Smash in Doubles Final"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        {mediaImages.length === 0 && (
                          <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 text-sm">
                            No photos added yet. Showcase your winning matches!
                          </div>
                        )}
                      </div>
                    </div>

                    {/* YouTube Video Links */}
                    <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-center">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Play className="w-5 h-5 text-red-500 fill-red-500" />
                          YouTube Game Highlights
                        </label>
                        <button
                          type="button"
                          onClick={() => setMediaVideos([...mediaVideos, { url: "", caption: "" }])}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30 transition shadow-sm"
                        >
                          + Add Video Link
                        </button>
                      </div>

                      <div className="space-y-3">
                        {mediaVideos.map((vid, idx) => (
                          <div key={idx} className="flex gap-3 items-end p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 relative">
                            <button
                              type="button"
                              onClick={() => setMediaVideos(mediaVideos.filter((_, i) => i !== idx))}
                              className="absolute top-2 right-2 text-rose-500 hover:text-rose-600 text-xs font-bold"
                            >
                              Remove
                            </button>
                            <div className="flex-1 space-y-3">
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">YouTube Video Link</label>
                                <input
                                  type="text"
                                  required
                                  value={vid.url}
                                  onChange={(e) => {
                                    const updated = [...mediaVideos];
                                    updated[idx].url = e.target.value;
                                    setMediaVideos(updated);
                                    setVideoPreviewIds((prev) => { const n = [...prev]; n[idx] = null; return n; });
                                  }}
                                  onBlur={(e) => handleVideoBlur(idx, e.target.value)}
                                  className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500
                                    ${vid.url && videoPreviewIds[idx] === null && videoPreviewIds.length > idx ? "border-rose-400 dark:border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                                  placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                                />
                                {videoPreviewIds[idx] && (
                                  <div className="mt-2 relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 w-full aspect-video bg-slate-900">
                                    <img
                                      src={`https://img.youtube.com/vi/${videoPreviewIds[idx]}/mqdefault.jpg`}
                                      alt="YouTube thumbnail"
                                      className="w-full h-full object-cover opacity-80"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="w-10 h-10 rounded-full bg-red-600/90 flex items-center justify-center shadow-lg">
                                        <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {vid.url && videoPreviewIds.length > idx && videoPreviewIds[idx] === null && (
                                  <p className="mt-1 text-[11px] text-rose-500 font-semibold">Not a valid YouTube URL.</p>
                                )}
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Caption</label>
                                <input
                                  type="text"
                                  value={vid.caption}
                                  onChange={(e) => {
                                    const updated = [...mediaVideos];
                                    updated[idx].caption = e.target.value;
                                    setMediaVideos(updated);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                                  placeholder="e.g. Full game footage at Spectrum 2026"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        {mediaVideos.length === 0 && (
                          <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 text-sm">
                            No match videos added yet. Link your YouTube highlights!
                          </div>
                        )}
                      </div>
                    </div>

                  </motion.div>
                )}

              </AnimatePresence>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/25 transition-all text-lg flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save & Launch Profile
                    </>
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => setLocation(playerSlug ? `/player/${playerSlug}` : "/")}
                  className="px-6 py-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold transition"
                >
                  Cancel
                </button>
              </div>

            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
