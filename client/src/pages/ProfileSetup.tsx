import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserCircle, Trophy, Save, Sparkles, Activity,
  Swords, BookOpen, Quote, LogOut, Video, Image, Play, Upload, ArrowLeft, Lock
, Star} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ARCHIVED_TOURNAMENTS } from "@/data/tournamentArchive";

function getPasswordStrength(pwd: string) {
  let score = 0;
  if (!pwd) return 0;
  if (pwd.length >= 8) score += 1;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
  return score;
}

const PREDEFINED_DEPARTMENTS = [
  "OTHER - Other",
  "ADMIN - Administration",
  "UG - Undergraduate Programme",
  "AE - Aerospace Engineering",
  "AI - Artificial Intelligence",
  "AAP - Astronomy and Astrophysics Programme",
  "BC - Biochemistry",
  "BE - Bioengineering",
  "CAOS - Centre for Atmospheric and Oceanic Sciences",
  "CBR - Centre for Brain Research",
  "CCT - Centre for Cryogenic Technology",
  "CDS - Computational and Data Sciences",
  "CEaS - Centre for Earth Sciences",
  "CeNSE - Centre for Nano Science and Engineering",
  "CES - Centre for Ecological Sciences",
  "CHEP - Centre for High Energy Physics",
  "CiSTUP - Centre for Infrastructure, Sustainable Transportation and Urban Planning",
  "CNS - Centre for Neuroscience",
  "CPDM - Centre for Product Design and Manufacturing",
  "CPS - Cyber Physical Systems",
  "CSP - Centre for Society and Policy",
  "CST - Centre for Sustainable Technologies",
  "CE - Civil Engineering",
  "CH - Chemical Engineering",
  "CSA - Computer Science and Automation",
  "DBG - Developmental Biology and Genetics",
  "DESE - Department of Electronic Systems Engineering",
  "ECE - Electrical Communication Engineering",
  "EE - Electrical Engineering",
  "IAP - Instrumentation and Applied Physics",
  "ICER - Interdisciplinary Centre for Energy Research",
  "ICWaR - Interdisciplinary Centre for Water Research",
  "IPC - Inorganic and Physical Chemistry",
  "MA - Mathematics",
  "MCB - Microbiology and Cell Biology",
  "MBU - Molecular Biophysics Unit",
  "ME - Mechanical Engineering",
  "MGMT - Management Studies",
  "MRC - Materials Research Centre",
  "MTE - Materials Engineering",
  "OC - Organic Chemistry",
  "PH - Physics",
  "SSCU - Solid State and Structural Chemistry Unit"
];
const PASSWORD_UPDATE_TIMEOUT_MS = 12_000;

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default function ProfileSetup() {
  const [, setLocation] = useLocation();
  const { id: paramId } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const { session, profile: authProfile, isInitializing, isAdmin } = useAuth();
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  // Tracks whether we've run the DB profile fetch for the current session
  const profileLoadedRef = useRef<string | null>(null);

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
  const [customDepartment, setCustomDepartment] = useState("");
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
  const [tourName, setTourName] = useState("");
  const [tourYear, setTourYear] = useState("");
  const [achMedal, setAchMedal] = useState("Gold");
  const [achCustomMedal, setAchCustomMedal] = useState("");
  const [achTournament, setAchTournament] = useState("");
  const [achCategory, setAchCategory] = useState("Men's");
  const [achEventType, setAchEventType] = useState("Singles");

  const [careerHighlights, setCareerHighlights] = useState<{year: string; title: string; description: string}[]>([]);

  // Admin-defined Tournaments list & Achievements builder
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
      const { data: { session: currentSession } } = await withTimeout(
        supabase.auth.getSession(),
        PASSWORD_UPDATE_TIMEOUT_MS,
        "Could not verify your login session. Please try again."
      );
      if (!currentSession) throw new Error("Your login session expired. Please sign in again.");

      const { error } = await withTimeout(
        supabase.auth.updateUser({ password: newPassword }),
        PASSWORD_UPDATE_TIMEOUT_MS,
        "Password update timed out. Please check your connection and try again."
      );
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
      query = query.eq("user_id", session.user.id);
    }

    Promise.resolve(query
      .maybeSingle()
    )
      .then(({ data: profile, error }) => {
        if (!mounted) return;
        if (profile && !error) {
          setTargetUserId(profile.user_id);
          setIsEditing(true);
          setPlayerSlug(profile.id);
          setFullName(profile.full_name || "");
          setNickname(profile.nickname || "");
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
    if (!file) return;

    setLoading(true);

    try {
      // Create a temporary URL for the image
      const imgUrl = URL.createObjectURL(file);
      const img = new window.Image();
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgUrl;
      });

      // Max dimensions for the avatar (reduce resolution to shrink file size)
      const MAX_WIDTH = 1200;
      const MAX_HEIGHT = 1200;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      // Draw resized image to canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(imgUrl);

      // Loop to guarantee size is under 512KB, starting with high quality
      let quality = 0.95;
      let blob: Blob;
      
      while (true) {
        blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('Canvas to Blob failed'));
          }, 'image/webp', quality); 
        });

        if (blob.size <= 500 * 1024 || quality <= 0.6) {
          break; // It fits perfectly, or we reached the lowest acceptable quality
        }
        
        quality -= 0.1; // Reduce quality and try again
      }

      if (blob.size > 512 * 1024) {
        throw new Error('Image could not be compressed below 500KB. Please try a different image.');
      }

      // Use just the user ID to ensure we overwrite the previous avatar
      const fileName = `${session.user.id}.webp`;
      const filePath = fileName;

      // Upload the compressed Blob to Supabase
      const { error } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { contentType: 'image/webp', cacheControl: '3600', upsert: true });

      if (error) throw error;

      // Get public URL
      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      // Add cache buster so the UI immediately updates
      setAvatarUrl(`${publicUrlData.publicUrl}?t=${Date.now()}`);
      toast.success("Avatar uploaded and compressed successfully!");
    } catch (err: any) {
      console.error("Avatar upload failed:", err);
      toast.error("Upload failed", { description: err.message || "Ensure the bucket exists and public policies are active!" });
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
      department: department === "OTHER - Other" ? customDepartment : department,
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
      career_highlights: careerHighlights.filter(h => h.year && h.title),
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
            toast.error("Duplicate profile", { description: "A profile with this email or name already exists!" });
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
      toast.error("Failed to save profile", { description: err.message });
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6 sm:mb-8">
            <div className="text-center sm:text-left min-w-0">
              {isEditing && (playerSlug || paramId) && (
                <button
                  onClick={() => setLocation(`/player/${playerSlug || paramId}`)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 mb-3 transition"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Profile
                </button>
              )}
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-2 leading-tight">
                <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-500 animate-pulse shrink-0" />
                {isEditing ? "Edit Your Player Profile" : "Complete Your Profile"}
              </h1>
              <p className="mt-2 text-slate-600 dark:text-slate-400 text-base sm:text-lg">
                {isEditing ? "Keep your badminton card updated with your latest achievements!" : "Welcome to IISc Badminton Club! Tell us about your game."}
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

          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 p-5 sm:p-8">
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
                        <label className="relative w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-300 dark:border-slate-700 cursor-pointer group shadow-sm hover:shadow-md transition-shadow">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar Preview" className="w-full h-full object-cover transition-opacity group-hover:opacity-50" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-600 text-3xl font-bold uppercase transition-opacity group-hover:opacity-50">
                              {fullName ? fullName.charAt(0) : "U"}
                            </div>
                          )}
                          <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 text-white">
                            <Upload className="w-5 h-5 mb-0.5" />
                            <span className="text-[10px] font-bold">Upload</span>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            className="hidden"
                          />
                        </label>

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
                        <select
                          required
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        >
                          <option value="" disabled>Select your department</option>
                          {PREDEFINED_DEPARTMENTS.map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                        {department === "OTHER - Other" && (
                          <div className="mt-3">
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Please specify *</label>
                            <input
                              required
                              type="text"
                              value={customDepartment}
                              onChange={(e) => setCustomDepartment(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                              placeholder="Type your department"
                            />
                          </div>
                        )}
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
                    <div className="pt-6 border-t border-slate-200 dark:border-slate-700/50 mt-6 space-y-3">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-emerald-500" /> Account Security
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                        <div className="flex-1 relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-3 pl-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                            placeholder="Enter new password (min 6 chars)"
                          />
                          {newPassword && (
                            <div className="mt-2 w-full px-1">
                              <div className="flex gap-1">
                                {[1, 2, 3, 4].map((level) => {
                                  const strength = getPasswordStrength(newPassword);
                                  let color = 'bg-slate-200 dark:bg-slate-700';
                                  if (level <= strength) {
                                    if (strength <= 1) color = 'bg-rose-500';
                                    else if (strength === 2) color = 'bg-orange-500';
                                    else if (strength === 3) color = 'bg-amber-500';
                                    else color = 'bg-emerald-500';
                                  }
                                  return <div key={level} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${color}`} />
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handlePasswordChange}
                          disabled={passwordLoading || !newPassword}
                          className="min-h-[48px] px-5 py-3 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/40 text-emerald-700 dark:text-emerald-400 font-bold rounded-xl transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {passwordLoading ? (
                            <>
                              <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                              Updating...
                            </>
                          ) : "Set Password"}
                        </button>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">Setting a password allows you to log in with your email and password instead of using OTP codes.</p>
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
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={tourName}
                            onChange={(e) => setTourName(e.target.value)}
                            placeholder="Tournament Name (e.g. Farewell Tournament)"
                            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="number"
                            value={tourYear}
                            onChange={(e) => setTourYear(e.target.value)}
                            placeholder="Year (e.g. 2025)"
                            className="w-full sm:w-32 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (tourName.trim() && tourYear.trim() && /^\d{4}$/.test(tourYear.trim())) {
                                const val = `${tourName.trim()} ${tourYear.trim()}`;
                                setTournamentsRaw(tournamentsRaw.trim() ? tournamentsRaw.trim() + ", " + val : val);
                                setTourName("");
                                setTourYear("");
                              }
                            }}
                            disabled={!tourName.trim() || !tourYear.trim() || !/^\d{4}$/.test(tourYear.trim())}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shrink-0"
                          >Add</button>
                        </div>
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
                        <div className="flex flex-wrap gap-2 w-full items-center">
                          <select
                            value={achCategory}
                            onChange={(e) => setAchCategory(e.target.value)}
                            className="w-full sm:w-auto shrink-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="Men's">Men's</option>
                            <option value="Women's">Women's</option>
                            <option value="Mixed">Mixed</option>
                          </select>
                          <select
                            value={achEventType}
                            onChange={(e) => setAchEventType(e.target.value)}
                            className="w-full sm:w-auto shrink-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="Singles">Singles</option>
                            <option value="Doubles">Doubles</option>
                          </select>
                          <div className="flex gap-2 sm:w-1/3 shrink-0">
                            <select
                              value={achMedal}
                              onChange={(e) => setAchMedal(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="Gold">🥇 Gold / Winner</option>
                              <option value="Silver">🥈 Silver / Runner-up</option>
                              <option value="Bronze">🥉 Bronze / Semi-Finalist</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          {achMedal === "Other" && (
                            <input
                              type="text"
                              value={achCustomMedal}
                              onChange={(e) => setAchCustomMedal(e.target.value)}
                              placeholder="e.g. Quarter-Finalist"
                              className="w-full sm:w-32 shrink-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          )}
                          <select
                            value={achTournament}
                            onChange={(e) => setAchTournament(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">-- Select Tournament Played --</option>
                            {tournamentsRaw.split(",").map(s => s.trim()).filter(Boolean).map((t, idx) => (
                              <option key={idx} value={t}>{t}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const medalStr = achMedal === "Other" ? achCustomMedal.trim() : (achMedal === "Gold" ? "Winner" : achMedal === "Silver" ? "Runner-up" : "Semi-Finalist");
                              if (medalStr && achTournament.trim()) {
                                const val = `${achCategory} ${achEventType} ${medalStr} - ${achTournament.trim()}`;
                                setAchievementsRaw(achievementsRaw.trim() ? achievementsRaw.trim() + ", " + val : val);
                                setAchCustomMedal("");
                                setAchTournament("");
                              }
                            }}
                            disabled={!(achMedal === "Other" ? achCustomMedal.trim() : true) || !achTournament.trim()}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shrink-0"
                          >Add</button>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">First add Tournaments below, then select them here.</p>
                      </div>
                    </div>

                    {/* Career Highlights Builder */}
                    <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex justify-between items-center mb-3">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Star className="w-5 h-5 text-amber-500" />
                          Career Highlights
                        </label>
                        <button
                          type="button"
                          onClick={() => setCareerHighlights([...careerHighlights, { year: "", title: "", description: "" }])}
                          className="text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 rounded-lg border border-amber-100 dark:border-amber-900/30 transition shadow-sm"
                        >
                          + Add Highlight
                        </button>
                      </div>
                      
                      {careerHighlights.length === 0 ? (
                        <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
                          <p className="text-slate-500 dark:text-slate-400 text-sm">Add custom narrative milestones (e.g. "Joined IISc Team") to show on your profile timeline.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {careerHighlights.map((hl, idx) => (
                            <div key={idx} className="relative bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm pr-12">
                              <button
                                type="button"
                                onClick={() => setCareerHighlights(careerHighlights.filter((_, i) => i !== idx))}
                                className="absolute top-4 right-4 text-rose-500 hover:text-rose-600 dark:text-rose-400 font-black p-1 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg transition"
                                title="Remove highlight"
                              >
                                ×
                              </button>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <div className="sm:col-span-1">
                                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Year</label>
                                  <input
                                    type="text"
                                    value={hl.year}
                                    placeholder="e.g. 2023"
                                    onChange={(e) => {
                                      const arr = [...careerHighlights];
                                      arr[idx].year = e.target.value;
                                      setCareerHighlights(arr);
                                    }}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500"
                                  />
                                </div>
                                <div className="sm:col-span-3">
                                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Title</label>
                                  <input
                                    type="text"
                                    value={hl.title}
                                    placeholder="e.g. Inter-University Quarter-Finalist"
                                    onChange={(e) => {
                                      const arr = [...careerHighlights];
                                      arr[idx].title = e.target.value;
                                      setCareerHighlights(arr);
                                    }}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500"
                                  />
                                </div>
                                <div className="sm:col-span-4">
                                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Description (Optional)</label>
                                  <textarea
                                    value={hl.description}
                                    rows={2}
                                    placeholder="Briefly describe this milestone..."
                                    onChange={(e) => {
                                      const arr = [...careerHighlights];
                                      arr[idx].description = e.target.value;
                                      setCareerHighlights(arr);
                                    }}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
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

              <div className="pt-5 sm:pt-6 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
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

                <button
                  type="button"
                  onClick={() => setLocation(playerSlug ? `/player/${playerSlug}` : "/")}
                  disabled={loading}
                  className="min-h-[52px] px-6 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
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
