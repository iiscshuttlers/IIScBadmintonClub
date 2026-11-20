import React, { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { fetchLiveMatchesRow, subscribeToCameraBroadcast } from "@/services/matchService";
import { fetchTournamentMatchRow, fetchUncompletedTournamentMatches } from "@/services/tournamentService";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_YOUTUBE_STREAM_KEY } from "@/const";
import {
  Camera, SwitchCamera, Video, StopCircle, Download,
  Volume2, VolumeX, Maximize2, Zap, ArrowLeft, RefreshCw,
  Trophy, Flame, Sparkles, Check, ChevronDown, Youtube, Radio, Settings, X, ExternalLink, RotateCcw, ShieldCheck, ShieldAlert, Loader2, Palette
} from "lucide-react";
import { toast } from "sonner";
import type { BwfMatchState } from "@/types/umpire";
import { cssVar, cssVarAlpha, themeColor, themeColorAlpha, themeFont, withAlpha, type ThemeColorToken } from "@/lib/themeColors";

// Scoreboard overlay colours are theme tokens, so the overlay follows the user's theme.
// The chosen token (not a colour) is saved; older saved colours fall back to the default.
type OverlaySwatch = { label: string; value: ThemeColorToken; bg: string };
const SCORE_COLOR_PRESETS: OverlaySwatch[] = [
  { label: "Amber Gold", value: "warning", bg: "bg-warning" },
  { label: "Electric Cyan", value: "info", bg: "bg-info" },
  { label: "Neon Pink", value: "danger", bg: "bg-danger" },
  { label: "Pure White", value: "foreground", bg: "bg-foreground" },
  { label: "Emerald Green", value: "success", bg: "bg-success" },
];
const SERVER_DOT_PRESETS: OverlaySwatch[] = [
  { label: "Electric Gold", value: "warning", bg: "bg-warning" },
  { label: "Vibrant Cyan", value: "info", bg: "bg-info" },
  { label: "Electric Violet", value: "individual", bg: "bg-individual" },
  { label: "Bright Red", value: "danger", bg: "bg-danger" },
];
type OverlayGlass = { label: string; value: string; token: ThemeColorToken; alpha: number };
const CARD_BG_PRESETS: OverlayGlass[] = [
  { label: "Fully Transparent", value: "transparent", token: "card", alpha: 0 },
  { label: "Midnight Blue Glass", value: "card-glass", token: "card", alpha: 0.4 },
  { label: "Neon Purple Tint", value: "violet-tint", token: "individual", alpha: 0.4 },
  { label: "Deep Onyx Fade", value: "deep-fade", token: "background", alpha: 0.4 },
];
const CARD_BG_DEFAULT: OverlayGlass = { label: "Default", value: "default", token: "card", alpha: 0.82 };
const savedOverlayToken = (key: string, presets: OverlaySwatch[]): ThemeColorToken => {
  const saved = localStorage.getItem(key);
  return presets.find((p) => p.value === saved)?.value ?? presets[0].value;
};

interface MatchData {
  id: string;
  category: string;
  round_name: string;
  team1_label: string;
  team2_label: string;
  player1_id?: string;
  player2_id?: string;
  court_number?: string;
  points_to_win?: number;
  best_of_sets?: number;
  status: string;
  sets_history?: string[];
  score?: string;
  live_score?: {
    t1_points: number;
    t2_points: number;
    t1_sets: number;
    t2_sets: number;
    server: 1 | 2;
    current_set: number;
    is_deuce?: boolean;
    is_match_point?: boolean;
    is_game_point?: boolean;
  };
}

export default function CameraBroadcast() {
  const params = useParams<{ matchId?: string }>();
  const matchId = params?.matchId;
  const [, setLocation] = useLocation();
  const { profile, isAdmin, isMasterAdmin, isUmpire, isInitializing } = useAuth();

  // Role authorization check (Only Admins, Master Admins, and Umpires can stream)
  const isAuthorized = isAdmin || isMasterAdmin || isUmpire || profile?.role === "admin" || profile?.role === "master_admin" || profile?.role === "umpire";

  // Camera & Video Streams
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Camera settings
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [micEnabled, setMicEnabled] = useState<boolean>(true);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);

  // Recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const timerIntervalRef = useRef<any>(null);

  // YouTube Live RTMP State (Inbuilt key + Manual Override)
  const [userOverrideKey, setUserOverrideKey] = useState<string | null>(
    () => localStorage.getItem("youtube_stream_key") || null
  );
  const effectiveStreamKey = userOverrideKey || DEFAULT_YOUTUBE_STREAM_KEY;

  const [isLiveOnYoutube, setIsLiveOnYoutube] = useState<boolean>(false);
  const [showYoutubeModal, setShowYoutubeModal] = useState<boolean>(false);

  // Customizable Scorecard Overlay Styling
  const [scoreTextColor, setScoreTextColor] = useState<ThemeColorToken>(
    () => savedOverlayToken("overlay_score_color", SCORE_COLOR_PRESETS)
  );
  const [cardBgColor, setCardBgColor] = useState<string>(
    () => localStorage.getItem("overlay_bg_color") || CARD_BG_DEFAULT.value
  );
  const [serverDotColor, setServerDotColor] = useState<ThemeColorToken>(
    () => savedOverlayToken("overlay_server_color", SERVER_DOT_PRESETS)
  );
  const cardGlass = CARD_BG_PRESETS.find((p) => p.value === cardBgColor) ?? CARD_BG_DEFAULT;

  const updateScoreTextColor = (color: ThemeColorToken) => {
    setScoreTextColor(color);
    localStorage.setItem("overlay_score_color", color);
  };

  const updateCardBgColor = (color: string) => {
    setCardBgColor(color);
    localStorage.setItem("overlay_bg_color", color);
  };

  const updateServerDotColor = (color: ThemeColorToken) => {
    setServerDotColor(color);
    localStorage.setItem("overlay_server_color", color);
  };

  // Matches state
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(matchId || null);
  const [liveMatch, setLiveMatch] = useState<MatchData | null>(null);

  // UI overlay state
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const controlsTimeoutRef = useRef<any>(null);

  // Save manual Stream Key override
  const handleKeyInput = (val: string) => {
    if (!val || val.trim() === "" || val.trim() === DEFAULT_YOUTUBE_STREAM_KEY) {
      localStorage.removeItem("youtube_stream_key");
      setUserOverrideKey(null);
    } else {
      localStorage.setItem("youtube_stream_key", val.trim());
      setUserOverrideKey(val.trim());
    }
  };

  const resetToDefaultKey = () => {
    localStorage.removeItem("youtube_stream_key");
    setUserOverrideKey(null);
    toast.success("Reverted to Inbuilt Default YouTube Stream Key!");
  };

  // 1. Fetch available matches
  useEffect(() => {
    if (!isAuthorized) return;

    async function loadMatches() {
      const data = await fetchUncompletedTournamentMatches();

      if (data && data.length > 0) {
        const mapped: MatchData[] = data.map((m) => {
          let liveScoreObj = undefined;
          if (m.score && m.score.includes("-")) {
            const parts = m.score.split("-").map((s: string) => parseInt(s.trim()) || 0);
            liveScoreObj = {
              t1_points: parts[0] || 0,
              t2_points: parts[1] || 0,
              t1_sets: 0,
              t2_sets: 0,
              server: 1 as 1 | 2,
              current_set: 1
            };
          }
          return { ...m, live_score: liveScoreObj };
        });
        setMatches(mapped);
        if (!selectedMatchId) {
          const activeMatch = mapped.find((m) => m.status === "in_progress") || mapped[0];
          setSelectedMatchId(activeMatch.id);
        }
      }
    }
    loadMatches();
  }, [matchId, isAuthorized]);

  // 2. Fetch selected match details & subscribe to Realtime updates (Site Data & Tournament Matches)
  useEffect(() => {
    if (!selectedMatchId || !isAuthorized) return;

    async function fetchSelected() {
      // Check site_data (live_matches) first for instant real-time scores
      const siteData = await fetchLiveMatchesRow();

      if (siteData?.value && siteData.value[selectedMatchId]) {
        setLiveMatch(parseBwfMatchStateToLiveMatch(siteData.value[selectedMatchId]));
      }

      // Fetch tournament_matches row for fallback & static details
      const tmData = await fetchTournamentMatchRow(selectedMatchId);

      if (tmData) {
        if (!siteData?.value?.[selectedMatchId]) {
          setLiveMatch(parseMatchScore(tmData));
        }
      }
    }

    fetchSelected();

    // Channel 1: court_live_scores broadcast; 2: site_data live_matches; 3: the tournament_matches row.
    return subscribeToCameraBroadcast(selectedMatchId, {
      onScoreUpdate: (e) => {
        if (e.payload && (e.payload.id === selectedMatchId || e.payload.dbId === selectedMatchId)) {
          setLiveMatch(parseBwfMatchStateToLiveMatch(e.payload));
        }
      },
      onLiveMatchesChange: (payload) => {
        const liveMatches = (payload.new as any)?.value;
        if (liveMatches && liveMatches[selectedMatchId]) {
          setLiveMatch(parseBwfMatchStateToLiveMatch(liveMatches[selectedMatchId]));
        }
      },
      onMatchChange: (payload) => {
        if (payload.new) {
          setLiveMatch((prev) => parseMatchScore(payload.new, prev));
        }
      },
    });
  }, [selectedMatchId, isAuthorized]);

  function parseBwfMatchStateToLiveMatch(bwf: BwfMatchState, matchData?: MatchData): MatchData {
    const t1_points = bwf.t1?.score ?? 0;
    const t2_points = bwf.t2?.score ?? 0;
    const t1_sets = bwf.t1?.games ?? 0;
    const t2_sets = bwf.t2?.games ?? 0;
    const server = bwf.serverTeam || 1;
    const ptsToWin = bwf.pointsToWin || 21;
    
    const is_deuce = t1_points >= ptsToWin - 1 && t2_points >= ptsToWin - 1 && t1_points === t2_points;
    const is_match_point = (t1_points >= ptsToWin - 1 && t1_points > t2_points && t1_sets === Math.ceil((bwf.bestOfSets || 3)/2) - 1) ||
                           (t2_points >= ptsToWin - 1 && t2_points > t1_points && t2_sets === Math.ceil((bwf.bestOfSets || 3)/2) - 1);
    const is_game_point = !is_match_point && ((t1_points >= ptsToWin - 1 && t1_points > t2_points) || (t2_points >= ptsToWin - 1 && t2_points > t1_points));

    const t1Label = bwf.t1?.p2Name ? `${bwf.t1.p1Name} & ${bwf.t1.p2Name}` : bwf.t1?.p1Name || matchData?.team1_label || "Team 1";
    const t2Label = bwf.t2?.p2Name ? `${bwf.t2.p1Name} & ${bwf.t2.p2Name}` : bwf.t2?.p1Name || matchData?.team2_label || "Team 2";

    return {
      id: bwf.id || matchData?.id || "",
      category: bwf.category || matchData?.category || "LIVE",
      round_name: bwf.matchNumber || matchData?.round_name || "Court Match",
      team1_label: t1Label,
      team2_label: t2Label,
      status: bwf.status || matchData?.status || "in_progress",
      sets_history: bwf.setsHistory || matchData?.sets_history || [],
      live_score: {
        t1_points,
        t2_points,
        t1_sets,
        t2_sets,
        server,
        current_set: (t1_sets + t2_sets) + 1,
        is_deuce,
        is_match_point,
        is_game_point
      }
    };
  }

  function parseMatchScore(m: any, prevLive?: MatchData | null): MatchData {
    let t1_points = 0;
    let t2_points = 0;
    let t1_sets = 0;
    let t2_sets = 0;
    let server: 1 | 2 = prevLive?.live_score?.server || 1;
    let is_deuce = false;
    let is_match_point = false;
    let is_game_point = false;

    if (m.score) {
      const sets = (m.sets_history || [m.score]).filter(Boolean);
      t1_sets = 0;
      t2_sets = 0;
      for (const s of sets) {
        const parts = s.split("-").map((n: string) => parseInt(n.trim()) || 0);
        if (parts[0] > parts[1] && (parts[0] >= 21 || parts[0] - parts[1] >= 2)) t1_sets++;
        else if (parts[1] > parts[0] && (parts[1] >= 21 || parts[1] - parts[0] >= 2)) t2_sets++;
      }
      const lastSet = sets[sets.length - 1] || m.score;
      const parts = lastSet.split("-").map((n: string) => parseInt(n.trim()) || 0);
      t1_points = parts[0] || 0;
      t2_points = parts[1] || 0;

      if (t1_points >= 20 && t2_points >= 20) is_deuce = true;
      const ptsToWin = m.points_to_win || 21;
      const bestOf = m.best_of_sets || 3;
      const setsToWin = Math.ceil(bestOf / 2);

      if ((t1_points >= ptsToWin - 1 && t1_points > t2_points) || (t2_points >= ptsToWin - 1 && t2_points > t1_points)) {
        if (t1_sets === setsToWin - 1 || t2_sets === setsToWin - 1) {
          is_match_point = true;
        } else {
          is_game_point = true;
        }
      }
    }

    return {
      ...m,
      team1_label: prevLive?.team1_label || m.team1_label,
      team2_label: prevLive?.team2_label || m.team2_label,
      live_score: {
        t1_points,
        t2_points,
        t1_sets,
        t2_sets,
        server,
        current_set: (t1_sets + t2_sets) + 1,
        is_deuce,
        is_match_point,
        is_game_point
      }
    };
  }

  // 3. Initialize Camera MediaStream
  useEffect(() => {
    if (!isAuthorized) return;
    let activeStream: MediaStream | null = null;

    async function initCamera() {
      try {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        }

        let stream: MediaStream | null = null;

        // Try ideal mobile resolution + facingMode first
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: micEnabled
          });
        } catch (e1) {
          // Fallback 1: Try simple facingMode without resolution constraint
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode },
              audio: micEnabled
            });
          } catch (e2) {
            // Fallback 2: General webcam access (desktop / PC)
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false
            });
          }
        }

        if (stream) {
          activeStream = stream;
          mediaStreamRef.current = stream;

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => console.warn("Video play exception:", e));
          }
          setCameraActive(true);

          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            const caps = (videoTrack.getCapabilities?.() as any) || {};
            setHasTorch(!!caps.torch);
          }
        }
      } catch (err: any) {
        console.error("Camera access error:", err);
        toast.error("Camera permission required or camera unavailable.");
        setCameraActive(false);
      }
    }

    initCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [facingMode, micEnabled, isAuthorized]);

  // Toggle Flashlight/Torch
  const toggleTorch = async () => {
    if (!mediaStreamRef.current) return;
    const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
    if (videoTrack && hasTorch) {
      try {
        const nextState = !torchOn;
        await (videoTrack as any).applyConstraints({ advanced: [{ torch: nextState }] });
        setTorchOn(nextState);
      } catch (err) {
        toast.error("Flashlight control failed");
      }
    }
  };

  // Switch Rear / Front Camera
  const switchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const liveMatchRef = useRef<MatchData | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    liveMatchRef.current = liveMatch;
  }, [liveMatch]);

  // Canvas Compositing: Burn live scoreboard overlay directly into recorded video frames
  function drawFrameToCanvas(
    ctx: CanvasRenderingContext2D,
    videoEl: HTMLVideoElement,
    match: MatchData | null
  ) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // 1. Draw raw camera video
    ctx.drawImage(videoEl, 0, 0, width, height);

    // Theme colours and fonts for the burned-in overlay
    const scoreColor = themeColor(scoreTextColor);
    const dotColor = themeColor(serverDotColor);
    const fg = themeColor("foreground");
    const metaColor = themeColor("muted-foreground");
    const idleDot = themeColor("faint");
    const rowBg = themeColorAlpha("muted", 0.75);
    const pointsBg = themeColorAlpha("background", 0.95);
    const bodyFont = themeFont("body");
    const statFont = themeFont("stat");

    // 2. Draw lower-third scoreboard overlay bug at bottom left
    const bugWidth = Math.min(440, width * 0.85);
    const bugHeight = 135;
    const bugX = 30;
    const bugY = height - bugHeight - 30;

    // Background card with dark translucent glassmorphism
    ctx.save();
    ctx.fillStyle = themeColorAlpha(cardGlass.token, cardGlass.alpha);
    ctx.shadowColor = themeColor("scrim");
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(bugX, bugY, bugWidth, bugHeight, 16);
    ctx.fill();
    ctx.restore();

    // Header bar (Category + Round)
    ctx.save();
    ctx.fillStyle = themeColorAlpha("background", 0.88);
    ctx.beginPath();
    ctx.roundRect(bugX, bugY, bugWidth, 28, [16, 16, 0, 0]);
    ctx.fill();

    // Category Badge
    ctx.fillStyle = themeColor("info");
    ctx.beginPath();
    ctx.roundRect(bugX + 10, bugY + 5, 48, 18, 4);
    ctx.fill();

    ctx.fillStyle = themeColor("info-foreground");
    ctx.font = `bold 11px ${bodyFont}`;
    ctx.textAlign = "center";
    ctx.fillText(match?.category || "LIVE", bugX + 34, bugY + 18);

    // Round Name
    ctx.fillStyle = themeColor("soft");
    ctx.font = `bold 11px ${bodyFont}`;
    ctx.textAlign = "left";
    ctx.fillText(match?.round_name || "Court Match", bugX + 66, bugY + 18);

    // DEUCE / MATCH POINT alert badge
    if (match?.live_score?.is_deuce) {
      ctx.fillStyle = themeColor("warning");
      ctx.font = `bold 10px ${bodyFont}`;
      ctx.textAlign = "right";
      ctx.fillText("⚡ DEUCE", bugX + bugWidth - 10, bugY + 18);
    } else if (match?.live_score?.is_match_point) {
      ctx.fillStyle = themeColor("danger");
      ctx.font = `bold 10px ${bodyFont}`;
      ctx.textAlign = "right";
      ctx.fillText("🔥 MATCH POINT", bugX + bugWidth - 10, bugY + 18);
    }
    ctx.restore();

    // Team 1 Row
    const row1Y = bugY + 34;
    ctx.save();
    ctx.fillStyle = rowBg;
    ctx.beginPath();
    ctx.roundRect(bugX + 8, row1Y, bugWidth - 16, 42, 10);
    ctx.fill();

    // Server Dot Team 1
    if (match?.live_score?.server === 1) {
      ctx.fillStyle = dotColor;
      ctx.shadowColor = dotColor;
      ctx.shadowBlur = 8;
    } else {
      ctx.fillStyle = idleDot;
      ctx.shadowBlur = 0;
    }
    ctx.beginPath();
    ctx.arc(bugX + 22, row1Y + 21, 5, 0, Math.PI * 2);
    ctx.fill();


    // Team 1 Label
    ctx.fillStyle = fg;
    ctx.font = `bold 14px ${bodyFont}`;
    ctx.textAlign = "left";
    ctx.fillText(match?.team1_label || "Team 1", bugX + 35, row1Y + 26);

    // Team 1 Sets
    ctx.fillStyle = metaColor;
    ctx.font = `bold 11px ${bodyFont}`;
    ctx.textAlign = "right";
    ctx.fillText(`${match?.live_score?.t1_sets || 0} set`, bugX + bugWidth - 65, row1Y + 26);

    // Team 1 Points Box (Glowing Neon)
    ctx.save();
    ctx.fillStyle = pointsBg;
    ctx.strokeStyle = withAlpha(scoreColor, 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bugX + bugWidth - 55, row1Y + 6, 44, 30, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = scoreColor;
    ctx.shadowColor = scoreColor;
    ctx.shadowBlur = 12;
    ctx.font = `bold 18px ${statFont}`;
    ctx.textAlign = "center";
    ctx.fillText(String(match?.live_score?.t1_points ?? 0), bugX + bugWidth - 33, row1Y + 27);
    ctx.restore();

    // Team 2 Row
    const row2Y = bugY + 82;
    ctx.save();
    ctx.fillStyle = rowBg;
    ctx.beginPath();
    ctx.roundRect(bugX + 8, row2Y, bugWidth - 16, 42, 10);
    ctx.fill();

    // Server Dot Team 2
    if (match?.live_score?.server === 2) {
      ctx.fillStyle = dotColor;
      ctx.shadowColor = dotColor;
      ctx.shadowBlur = 8;
    } else {
      ctx.fillStyle = idleDot;
      ctx.shadowBlur = 0;
    }
    ctx.beginPath();
    ctx.arc(bugX + 22, row2Y + 21, 5, 0, Math.PI * 2);
    ctx.fill();

    // Team 2 Label
    ctx.fillStyle = fg;
    ctx.font = `bold 14px ${bodyFont}`;
    ctx.textAlign = "left";
    ctx.fillText(match?.team2_label || "Team 2", bugX + 35, row2Y + 26);

    // Team 2 Sets
    ctx.fillStyle = metaColor;
    ctx.font = `bold 11px ${bodyFont}`;
    ctx.textAlign = "right";
    ctx.fillText(`${match?.live_score?.t2_sets || 0} set`, bugX + bugWidth - 65, row2Y + 26);

    // Team 2 Points Box (Glowing Neon)
    ctx.save();
    ctx.fillStyle = pointsBg;
    ctx.strokeStyle = withAlpha(scoreColor, 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bugX + bugWidth - 55, row2Y + 6, 44, 30, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = scoreColor;
    ctx.shadowColor = scoreColor;
    ctx.shadowBlur = 12;
    ctx.font = `bold 18px ${statFont}`;
    ctx.textAlign = "center";
    ctx.fillText(String(match?.live_score?.t2_points ?? 0), bugX + bugWidth - 33, row2Y + 27);
    ctx.restore();
  }

  // Handle Local Video Recording
  const startRecording = () => {
    if (!videoRef.current || !mediaStreamRef.current) {
      toast.error("Camera stream not ready");
      return;
    }

    try {
      const videoEl = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = videoEl.videoWidth || 1280;
      canvas.height = videoEl.videoHeight || 720;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        toast.error("Canvas context unavailable");
        return;
      }

      function renderFrame() {
        if (ctx && videoEl) {
          drawFrameToCanvas(ctx, videoEl, liveMatchRef.current);
        }
        animFrameIdRef.current = requestAnimationFrame(renderFrame);
      }

      renderFrame();

      const canvasStream = canvas.captureStream(30);
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
      const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
      if (audioTrack) tracks.push(audioTrack);

      const combinedStream = new MediaStream(tracks);
      recordedChunksRef.current = [];

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm"
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (animFrameIdRef.current) {
          cancelAnimationFrame(animFrameIdRef.current);
          animFrameIdRef.current = null;
        }
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        toast.success("Match video with live score overlay recorded!");
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((sec) => sec + 1);
      }, 1000);

      toast.success("🔴 Recording started (Scoreboard overlay included)!");
    } catch (err: any) {
      toast.error("Failed to start recording: " + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    }
  };

  const downloadVideo = () => {
    if (!recordedVideoUrl) return;
    const a = document.createElement("a");
    a.href = recordedVideoUrl;
    a.download = `Match_${liveMatch?.team1_label ?? "T1"}_vs_${liveMatch?.team2_label ?? "T2"}.webm`;
    a.click();
  };

  // YouTube Live Stream Toggle
  const startYoutubeBroadcast = () => {
    if (!effectiveStreamKey || effectiveStreamKey.trim().length < 5) {
      toast.error("Please enter a valid YouTube Live Stream Key");
      setShowYoutubeModal(true);
      return;
    }

    setIsLiveOnYoutube(true);
    toast.success(`🔴 Live on YouTube (${userOverrideKey ? "Custom Key" : "Inbuilt Key"})!`, { duration: 5000 });
  };

  const stopYoutubeBroadcast = () => {
    setIsLiveOnYoutube(false);
    toast.info("YouTube stream stopped");
  };

  // Tap overlay to toggle controls visibility
  const handleTouchScreen = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isRecording || isLiveOnYoutube) {
        setControlsVisible(false);
      }
    }, 4000);
  };

  const formatTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (isInitializing) {
    return (
      <div className="w-screen h-screen bg-background flex items-center justify-center text-foreground">
        <Loader2 className="w-10 h-10 animate-spin text-info" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="w-screen h-screen bg-background flex flex-col items-center justify-center p-6 text-center text-foreground space-y-4 font-sans">
        <ShieldAlert className="w-16 h-16 text-danger animate-pulse" />
        <h2 className="text-2xl font-black">Restricted Access</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Phone Camera Broadcast & YouTube Live streaming controls are reserved for Tournament Admins and Umpires only.
        </p>
        <button
          onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/")}
          className="px-6 py-2.5 bg-info hover:bg-info/90 text-info-foreground font-bold rounded-xl transition shadow-lg text-sm"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={handleTouchScreen}
      className="relative w-screen h-screen bg-background overflow-hidden select-none font-sans"
    >
      {/* Real-time Phone Camera Viewport */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {!cameraActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 text-foreground z-10 p-6 text-center space-y-3">
          <Camera className="w-16 h-16 text-muted-foreground animate-pulse" />
          <h2 className="text-xl font-bold">Camera Viewfinder</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Allow camera permissions in your browser or tap the button below to start your court stream.
          </p>
          <button
            onClick={() => {
              setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
            }}
            className="mt-2 px-5 py-2.5 bg-danger hover:bg-danger/90 text-danger-foreground font-bold rounded-xl transition shadow-lg text-xs flex items-center gap-2"
          >
            <Camera className="w-4 h-4" /> Start / Enable Camera
          </button>
        </div>
      )}

      {/* ── Premium BWF Live Scoreboard Overlay ──────────────────────────── */}
      <div className="absolute bottom-6 left-4 right-4 sm:left-8 sm:right-auto z-20 pointer-events-none">
        <div
          style={{ backgroundColor: cssVarAlpha(cardGlass.token, cardGlass.alpha) }}
          className="backdrop-blur-xl border border-border-strong/50 rounded-2xl shadow-[0_12px_40px_var(--scrim)] overflow-hidden max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          {/* Accent top gradient */}
          <div className="h-0.5 bg-gradient-to-r from-success via-accent to-info" />
          
          {/* Header Bar */}
          <div className="px-4 py-2 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse shadow-[0_0_6px_color-mix(in_srgb,var(--live)_70%,transparent)]" />
              <span className="bg-info/90 text-info-foreground px-2 py-0.5 rounded-md font-black tracking-wider text-[9px] uppercase">
                {liveMatch?.category || "LIVE"}
              </span>
              <span className="text-muted-foreground font-bold truncate max-w-[140px] text-[11px]">
                {liveMatch?.round_name || "Court Match"}
              </span>
            </div>

            {/* Special Badges */}
            <div className="flex items-center gap-1">
              {liveMatch?.live_score?.is_deuce && (
                <span className="bg-warning/15 text-warning border border-warning/30 px-1.5 py-0.5 rounded-md font-black text-[8px] tracking-wider animate-pulse">
                  ⚡ DEUCE
                </span>
              )}
              {liveMatch?.live_score?.is_match_point && (
                <span className="bg-danger/20 text-danger border border-danger/30 px-1.5 py-0.5 rounded-md font-black text-[8px] tracking-wider animate-bounce">
                  🔥 MATCH PT
                </span>
              )}
              {liveMatch?.live_score?.is_game_point && !liveMatch?.live_score?.is_match_point && (
                <span className="bg-info/20 text-info border border-info/30 px-1.5 py-0.5 rounded-md font-black text-[8px] tracking-wider">
                  GAME PT
                </span>
              )}
            </div>
          </div>

          {/* Teams & Scores */}
          <div className="p-2.5 space-y-1.5">
            {/* Team 1 Row */}
            <div className="flex items-center justify-between rounded-xl px-3 py-2 transition-all duration-300"
              style={{
                backgroundColor: liveMatch?.live_score?.server === 1 ? cssVarAlpha("team-1", 0.08) : cssVarAlpha("muted", 0.5),
                borderWidth: "1px",
                borderColor: liveMatch?.live_score?.server === 1 ? cssVarAlpha("team-1", 0.2) : cssVarAlpha("border-strong", 0.3),
              }}
            >
              <div className="flex items-center gap-2.5 truncate pr-2">
                <div
                  className="w-2 h-2 rounded-full shrink-0 transition-all duration-300 animate-pulse"
                  style={{
                    backgroundColor: liveMatch?.live_score?.server === 1 ? cssVar(serverDotColor) : cssVar("faint"),
                    boxShadow: liveMatch?.live_score?.server === 1 ? `0 0 10px ${cssVar(serverDotColor)}` : "none"
                  }}
                />
                <span className="text-foreground font-black text-sm tracking-tight truncate">
                  {liveMatch?.team1_label || "Team 1"}
                </span>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-muted-foreground text-[10px] font-bold tabular-nums">
                  {liveMatch?.live_score?.t1_sets || 0}
                </span>
                <span
                  className="text-2xl font-black tabular-nums min-w-[2ch] text-center rounded-lg px-2 py-0.5 transition-all duration-200"
                  style={{
                    color: cssVar(scoreTextColor),
                    backgroundColor: cssVarAlpha("background", 0.7),
                    textShadow: `0 0 16px ${cssVarAlpha(scoreTextColor, 0.38)}`,
                  }}
                >
                  {liveMatch?.live_score?.t1_points ?? 0}
                </span>
              </div>
            </div>

            {/* Team 2 Row */}
            <div className="flex items-center justify-between rounded-xl px-3 py-2 transition-all duration-300"
              style={{
                backgroundColor: liveMatch?.live_score?.server === 2 ? cssVarAlpha("team-2", 0.08) : cssVarAlpha("muted", 0.5),
                borderWidth: "1px",
                borderColor: liveMatch?.live_score?.server === 2 ? cssVarAlpha("team-2", 0.2) : cssVarAlpha("border-strong", 0.3),
              }}
            >
              <div className="flex items-center gap-2.5 truncate pr-2">
                <div
                  className="w-2 h-2 rounded-full shrink-0 transition-all duration-300 animate-pulse"
                  style={{
                    backgroundColor: liveMatch?.live_score?.server === 2 ? cssVar(serverDotColor) : cssVar("faint"),
                    boxShadow: liveMatch?.live_score?.server === 2 ? `0 0 10px ${cssVar(serverDotColor)}` : "none"
                  }}
                />
                <span className="text-foreground font-black text-sm tracking-tight truncate">
                  {liveMatch?.team2_label || "Team 2"}
                </span>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-muted-foreground text-[10px] font-bold tabular-nums">
                  {liveMatch?.live_score?.t2_sets || 0}
                </span>
                <span
                  className="text-2xl font-black tabular-nums min-w-[2ch] text-center rounded-lg px-2 py-0.5 transition-all duration-200"
                  style={{
                    color: cssVar(scoreTextColor),
                    backgroundColor: cssVarAlpha("background", 0.7),
                    textShadow: `0 0 16px ${cssVarAlpha(scoreTextColor, 0.38)}`,
                  }}
                >
                  {liveMatch?.live_score?.t2_points ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Sets history footer */}
          {liveMatch?.sets_history && liveMatch.sets_history.length > 0 && (
            <div className="px-4 py-1.5 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-bold">
              <span className="uppercase tracking-wider">Sets</span>
              <span className="text-soft font-mono">{liveMatch.sets_history.join(" · ")}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Top Controls Bar ────────────────────────────────────────────────── */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-media/80 via-media/40 to-transparent z-30 transition-opacity duration-300 ${
          controlsVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto">
          {/* Back button */}
          <button
            onClick={() => setLocation("/hub")}
            className="p-2.5 rounded-full bg-card/80 border border-border-strong/80 text-foreground hover:bg-muted transition shadow"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Match selector dropdown */}
          <div className="flex-1 max-w-xs">
            <select
              value={selectedMatchId || ""}
              onChange={(e) => setSelectedMatchId(e.target.value)}
              className="w-full bg-card/90 border border-border-strong text-foreground font-bold text-xs rounded-xl px-3 py-2 outline-none cursor-pointer"
            >
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.category} • {m.team1_label} vs {m.team2_label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Badges: Recording & YouTube */}
          <div className="flex items-center gap-2">
            {isLiveOnYoutube && (
              <div className="bg-live text-live-foreground font-black text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg animate-pulse">
                <Youtube className="w-4 h-4 fill-foreground" /> LIVE YOUTUBE
              </div>
            )}

            {isRecording && (
              <div className="bg-live/90 text-foreground font-mono font-black text-xs px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-foreground animate-ping" />
                {formatTime(recordingSeconds)}
              </div>
            )}
          </div>

          {/* Camera & YouTube Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowYoutubeModal(true)}
              className={`p-2.5 rounded-full border transition ${
                isLiveOnYoutube
                  ? "bg-live border-live text-live-foreground shadow-lg"
                  : "bg-card/80 border-border-strong text-live hover:bg-muted"
              }`}
              title="YouTube Live Stream Key Setup"
            >
              <Youtube className="w-5 h-5" />
            </button>

            {hasTorch && (
              <button aria-label="Toggle flashlight"
                onClick={toggleTorch}
                className={`p-2.5 rounded-full border transition ${
                  torchOn
                    ? "bg-warning border-warning text-warning-foreground"
                    : "bg-card/80 border-border-strong text-foreground"
                }`}
              >
                <Zap className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={switchCamera}
              className="p-2.5 rounded-full bg-card/80 border border-border-strong text-foreground hover:bg-muted transition"
              title="Flip Rear/Front Camera"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom Controls Bar: Record & Download ──────────────────────────── */}
      <div
        className={`absolute bottom-6 right-4 sm:right-8 z-30 flex items-center gap-3 transition-opacity duration-300 ${
          controlsVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {recordedVideoUrl && !isRecording && (
          <button
            onClick={downloadVideo}
            className="flex items-center gap-2 bg-info hover:bg-info/90 text-info-foreground font-black px-4 py-3 rounded-2xl shadow-xl transition active:scale-95 text-xs sm:text-sm"
          >
            <Download className="w-5 h-5" /> Download Video
          </button>
        )}

        {!isRecording ? (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 bg-danger hover:bg-danger/90 text-danger-foreground font-black px-5 py-3 rounded-2xl shadow-xl transition active:scale-95 text-xs sm:text-sm"
          >
            <Video className="w-5 h-5" /> Record Match
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 bg-card hover:bg-muted text-danger border border-danger/50 font-black px-5 py-3 rounded-2xl shadow-xl transition active:scale-95 text-xs sm:text-sm"
          >
            <StopCircle className="w-5 h-5 animate-pulse" /> Stop Recording
          </button>
        )}
      </div>

      {/* ── YouTube Live Setup Modal Drawer ─────────────────────────────────── */}
      {showYoutubeModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 bg-media/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-card border border-border-strong rounded-3xl p-6 max-w-md w-full text-foreground space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <Youtube className="w-6 h-6 text-danger" />
                <h3 className="text-lg font-black">YouTube Live Setup</h3>
              </div>
              <button
                onClick={() => setShowYoutubeModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  YouTube RTMP Ingest Server
                </label>
                <input
                  type="text"
                  disabled
                  value="rtmps://a.rtmp.youtube.com/live2"
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-muted-foreground font-mono outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-soft uppercase tracking-wider">
                    YouTube Stream Key
                  </label>
                  {userOverrideKey ? (
                    <span className="text-[10px] bg-warning/20 text-warning border border-warning/40 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                      Manual Override
                    </span>
                  ) : (
                    <span className="text-[10px] bg-success/20 text-success border border-success/40 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Inbuilt Default Key Active
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="password"
                    value={effectiveStreamKey}
                    onChange={(e) => handleKeyInput(e.target.value)}
                    placeholder="Enter custom key or leave empty for default"
                    className="w-full bg-background border border-border-strong focus:border-danger rounded-xl px-3.5 py-2.5 text-sm text-foreground font-mono outline-none transition pr-10"
                  />
                  {userOverrideKey && (
                    <button
                      onClick={resetToDefaultKey}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground p-0.5 rounded transition"
                      title="Reset to Inbuilt Key"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center justify-between">
                  <span>Leave blank to use default inbuilt key.</span>
                  {userOverrideKey && (
                    <button
                      onClick={resetToDefaultKey}
                      className="text-warning underline font-bold"
                    >
                      Reset to Inbuilt
                    </button>
                  )}
                </p>
              </div>

              <div className="bg-background/60 rounded-2xl p-4 border border-border/80 space-y-2 text-xs text-soft">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-live" /> Mobile Streaming Tip:
                </div>
                <p className="text-muted-foreground">
                  You can also paste your app's web overlay URL into PRISM Live Studio app to stream directly to YouTube with 60fps performance:
                </p>
                <code className="block bg-card p-2 rounded-lg text-[10px] text-soft select-all overflow-x-auto">
                  https://iiscshuttlers.github.io/IIScBadmintonClub/tv/overlay
                </code>
              </div>

              {/* 🎨 Scoreboard Overlay Customization Section */}
              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-soft uppercase tracking-wider">
                  <Palette className="w-4 h-4 text-warning" /> Score Overlay Appearance
                </div>

                {/* Score Number Color */}
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground block mb-1.5">Score Number Color</span>
                  <div className="flex items-center gap-2">
                    {SCORE_COLOR_PRESETS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => updateScoreTextColor(c.value)}
                        className={`w-7 h-7 rounded-lg ${c.bg} transition border-2 ${
                          scoreTextColor === c.value ? "border-foreground scale-110 shadow-md" : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Server Dot Color */}
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground block mb-1.5">Server Dot Color</span>
                  <div className="flex items-center gap-2">
                    {SERVER_DOT_PRESETS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => updateServerDotColor(c.value)}
                        className={`w-7 h-7 rounded-full ${c.bg} transition border-2 ${
                          serverDotColor === c.value ? "border-foreground scale-110 shadow-md" : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Card Background Glass */}
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground block mb-1.5">Card Background Glass</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {CARD_BG_PRESETS.map((bg) => (
                      <button
                        key={bg.value}
                        onClick={() => updateCardBgColor(bg.value)}
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition text-left ${
                          cardBgColor === bg.value
                            ? "bg-info/30 border-info text-info shadow-[0_0_10px_color-mix(in_srgb,var(--info)_50%,transparent)]"
                            : "bg-background border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {bg.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              {!isLiveOnYoutube ? (
                <button
                  onClick={() => {
                    startYoutubeBroadcast();
                    setShowYoutubeModal(false);
                  }}
                  className="flex-1 bg-danger hover:bg-danger/90 text-danger-foreground font-black py-3 rounded-2xl shadow-lg transition text-sm flex items-center justify-center gap-2"
                >
                  <Youtube className="w-5 h-5 fill-foreground" /> Start YouTube Stream
                </button>
              ) : (
                <button
                  onClick={() => {
                    stopYoutubeBroadcast();
                    setShowYoutubeModal(false);
                  }}
                  className="flex-1 bg-muted hover:bg-muted-strong text-danger border border-danger/40 font-black py-3 rounded-2xl shadow-lg transition text-sm flex items-center justify-center gap-2"
                >
                  <StopCircle className="w-5 h-5" /> Stop YouTube Stream
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
