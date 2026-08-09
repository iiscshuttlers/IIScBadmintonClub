import React, { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_YOUTUBE_STREAM_KEY } from "@/const";
import {
  Camera, SwitchCamera, Video, StopCircle, Download,
  Volume2, VolumeX, Maximize2, Zap, ArrowLeft, RefreshCw,
  Trophy, Flame, Sparkles, Check, ChevronDown, Youtube, Radio, Settings, X, ExternalLink, RotateCcw, ShieldCheck, ShieldAlert, Loader2, Palette
} from "lucide-react";
import { toast } from "sonner";
import type { BwfMatchState } from "@/types/umpire";

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
  const { player, isAdmin, isMasterAdmin, isUmpire, isInitializing } = useAuth();

  // Role authorization check (Only Admins, Master Admins, and Umpires can stream)
  const isAuthorized = isAdmin || isMasterAdmin || isUmpire || player?.role === "admin" || player?.role === "master_admin" || player?.role === "umpire";

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
  const [scoreTextColor, setScoreTextColor] = useState<string>(
    () => localStorage.getItem("overlay_score_color") || "#fbbf24"
  );
  const [cardBgColor, setCardBgColor] = useState<string>(
    () => localStorage.getItem("overlay_bg_color") || "rgba(15, 23, 42, 0.82)"
  );
  const [serverDotColor, setServerDotColor] = useState<string>(
    () => localStorage.getItem("overlay_server_color") || "#fbbf24"
  );

  const updateScoreTextColor = (color: string) => {
    setScoreTextColor(color);
    localStorage.setItem("overlay_score_color", color);
  };

  const updateCardBgColor = (color: string) => {
    setCardBgColor(color);
    localStorage.setItem("overlay_bg_color", color);
  };

  const updateServerDotColor = (color: string) => {
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
      const { data } = await supabase
        .from("tournament_matches")
        .select("*")
        .neq("status", "completed")
        .order("round", { ascending: true })
        .limit(20);

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
      const { data: siteData } = await supabase
        .from("site_data")
        .select("value")
        .eq("key", "live_matches")
        .maybeSingle();

      if (siteData?.value && siteData.value[selectedMatchId]) {
        setLiveMatch(parseBwfMatchStateToLiveMatch(siteData.value[selectedMatchId]));
      }

      // Fetch tournament_matches row for fallback & static details
      const { data: tmData } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("id", selectedMatchId)
        .single();

      if (tmData) {
        if (!siteData?.value?.[selectedMatchId]) {
          setLiveMatch(parseMatchScore(tmData));
        }
      }
    }

    fetchSelected();

    // Channel 1: Sub-50ms Direct WebSocket Broadcast (Instant score sync)
    const instantBroadcastChannel = supabase.channel("court_live_scores");
    instantBroadcastChannel
      .on("broadcast", { event: "score_update" }, (e) => {
        if (e.payload && (e.payload.id === selectedMatchId || e.payload.dbId === selectedMatchId)) {
          setLiveMatch(parseBwfMatchStateToLiveMatch(e.payload));
        }
      })
      .subscribe();

    // Channel 2: Listen to live_matches in site_data DB
    const siteDataChannel = supabase
      .channel(`camera_sitedata_${selectedMatchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_data", filter: "key=eq.live_matches" },
        (payload) => {
          const liveMatches = (payload.new as any)?.value;
          if (liveMatches && liveMatches[selectedMatchId]) {
            setLiveMatch(parseBwfMatchStateToLiveMatch(liveMatches[selectedMatchId]));
          }
        }
      )
      .subscribe();

    // Channel 3: Listen to tournament_matches table DB
    const tmChannel = supabase
      .channel(`camera_tm_${selectedMatchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_matches", filter: `id=eq.${selectedMatchId}` },
        (payload) => {
          if (payload.new) {
            setLiveMatch((prev) => parseMatchScore(payload.new, prev));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(instantBroadcastChannel);
      supabase.removeChannel(siteDataChannel);
      supabase.removeChannel(tmChannel);
    };
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

    // 2. Draw lower-third scoreboard overlay bug at bottom left
    const bugWidth = Math.min(440, width * 0.85);
    const bugHeight = 135;
    const bugX = 30;
    const bugY = height - bugHeight - 30;

    // Background card with dark translucent glassmorphism
    ctx.save();
    ctx.fillStyle = cardBgColor;
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(bugX, bugY, bugWidth, bugHeight, 16);
    ctx.fill();
    ctx.restore();

    // Header bar (Category + Round)
    ctx.save();
    ctx.fillStyle = "rgba(2, 6, 23, 0.88)"; // slate-950 88%
    ctx.beginPath();
    ctx.roundRect(bugX, bugY, bugWidth, 28, [16, 16, 0, 0]);
    ctx.fill();

    // Category Badge
    ctx.fillStyle = "#2563eb"; // blue-600
    ctx.beginPath();
    ctx.roundRect(bugX + 10, bugY + 5, 48, 18, 4);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(match?.category || "LIVE", bugX + 34, bugY + 18);

    // Round Name
    ctx.fillStyle = "#cbd5e1"; // slate-300
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(match?.round_name || "Court Match", bugX + 66, bugY + 18);

    // DEUCE / MATCH POINT alert badge
    if (match?.live_score?.is_deuce) {
      ctx.fillStyle = "#f97316"; // orange-500
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("⚡ DEUCE", bugX + bugWidth - 10, bugY + 18);
    } else if (match?.live_score?.is_match_point) {
      ctx.fillStyle = "#e11d48"; // rose-600
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("🔥 MATCH POINT", bugX + bugWidth - 10, bugY + 18);
    }
    ctx.restore();

    // Team 1 Row
    const row1Y = bugY + 34;
    ctx.save();
    ctx.fillStyle = "rgba(30, 41, 59, 0.75)";
    ctx.beginPath();
    ctx.roundRect(bugX + 8, row1Y, bugWidth - 16, 42, 10);
    ctx.fill();

    // Server Dot Team 1
    if (match?.live_score?.server === 1) {
      ctx.fillStyle = serverDotColor;
      ctx.shadowColor = serverDotColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(bugX + 22, row1Y + 21, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Team 1 Label
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(match?.team1_label || "Team 1", bugX + 35, row1Y + 26);

    // Team 1 Sets
    ctx.fillStyle = "#94a3b8"; // slate-400
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${match?.live_score?.t1_sets || 0} set`, bugX + bugWidth - 65, row1Y + 26);

    // Team 1 Points Box (Glowing Neon)
    ctx.save();
    ctx.fillStyle = "rgba(2, 6, 23, 0.95)";
    ctx.strokeStyle = `${scoreTextColor}65`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bugX + bugWidth - 55, row1Y + 6, 44, 30, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = scoreTextColor;
    ctx.shadowColor = scoreTextColor;
    ctx.shadowBlur = 12;
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(match?.live_score?.t1_points ?? 0), bugX + bugWidth - 33, row1Y + 27);
    ctx.restore();

    // Team 2 Row
    const row2Y = bugY + 82;
    ctx.save();
    ctx.fillStyle = "rgba(30, 41, 59, 0.75)";
    ctx.beginPath();
    ctx.roundRect(bugX + 8, row2Y, bugWidth - 16, 42, 10);
    ctx.fill();

    // Server Dot Team 2
    if (match?.live_score?.server === 2) {
      ctx.fillStyle = serverDotColor;
      ctx.shadowColor = serverDotColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(bugX + 22, row2Y + 21, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Team 2 Label
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(match?.team2_label || "Team 2", bugX + 35, row2Y + 26);

    // Team 2 Sets
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${match?.live_score?.t2_sets || 0} set`, bugX + bugWidth - 65, row2Y + 26);

    // Team 2 Points Box (Glowing Neon)
    ctx.save();
    ctx.fillStyle = "rgba(2, 6, 23, 0.95)";
    ctx.strokeStyle = `${scoreTextColor}65`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bugX + bugWidth - 55, row2Y + 6, 44, 30, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = scoreTextColor;
    ctx.shadowColor = scoreTextColor;
    ctx.shadowBlur = 12;
    ctx.font = "bold 18px monospace";
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
      <div className="w-screen h-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white space-y-4 font-sans">
        <ShieldAlert className="w-16 h-16 text-rose-500 animate-pulse" />
        <h2 className="text-2xl font-black">Restricted Access</h2>
        <p className="text-sm text-slate-400 max-w-sm">
          Phone Camera Broadcast & YouTube Live streaming controls are reserved for Tournament Admins and Umpires only.
        </p>
        <button
          onClick={() => setLocation("/")}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition shadow-lg text-sm"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={handleTouchScreen}
      className="relative w-screen h-screen bg-black overflow-hidden select-none font-sans"
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
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-white z-10 p-6 text-center space-y-3">
          <Camera className="w-16 h-16 text-slate-500 animate-pulse" />
          <h2 className="text-xl font-bold">Camera Viewfinder</h2>
          <p className="text-sm text-slate-400 max-w-xs">
            Allow camera permissions in your browser or tap the button below to start your court stream.
          </p>
          <button
            onClick={() => {
              setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
            }}
            className="mt-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition shadow-lg text-xs flex items-center gap-2"
          >
            <Camera className="w-4 h-4" /> Start / Enable Camera
          </button>
        </div>
      )}

      {/* ── BWF Style Live Scoreboard Overlay Bug ────────────────────────────── */}
      <div className="absolute bottom-6 left-4 right-4 sm:left-8 sm:right-auto z-20 pointer-events-none">
        <div
          style={{ backgroundColor: cardBgColor }}
          className="backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden max-w-md w-full animate-in fade-in duration-300"
        >
          
          {/* Header Bar: Tournament Name & Special Alerts */}
          <div className="bg-gradient-to-r from-slate-950/90 via-slate-900/90 to-slate-950/90 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white px-2 py-0.5 rounded-md font-black tracking-wider text-[10px] uppercase">
                {liveMatch?.category || "LIVE"}
              </span>
              <span className="text-slate-300 font-bold truncate max-w-[160px]">
                {liveMatch?.round_name || "Court Match"}
              </span>
            </div>

            {/* Special Badges: DEUCE / MATCH POINT */}
            <div className="flex items-center gap-1">
              {liveMatch?.live_score?.is_deuce && (
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-black text-[10px] flex items-center gap-1 animate-pulse">
                  <Zap className="w-3 h-3 fill-amber-400" /> DEUCE
                </span>
              )}
              {liveMatch?.live_score?.is_match_point && (
                <span className="bg-rose-600/30 text-rose-400 border border-rose-500/40 px-2 py-0.5 rounded-full font-black text-[10px] flex items-center gap-1 animate-bounce">
                  <Flame className="w-3 h-3 text-rose-400 fill-rose-400" /> MATCH POINT
                </span>
              )}
              {liveMatch?.live_score?.is_game_point && !liveMatch?.live_score?.is_match_point && (
                <span className="bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-black text-[10px] flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-indigo-300" /> GAME POINT
                </span>
              )}
            </div>
          </div>

          {/* Teams & Scores */}
          <div className="p-3 space-y-2">
            {/* Team 1 Row */}
            <div className="flex items-center justify-between bg-slate-800/70 rounded-xl px-3.5 py-2.5 border border-slate-700/40">
              <div className="flex items-center gap-2.5 truncate pr-2">
                <div
                  style={{
                    backgroundColor: liveMatch?.live_score?.server === 1 ? serverDotColor : undefined,
                    boxShadow: liveMatch?.live_score?.server === 1 ? `0 0 10px ${serverDotColor}` : undefined
                  }}
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${liveMatch?.live_score?.server === 1 ? "animate-pulse" : "bg-slate-700"}`}
                />
                <span className="text-white font-black text-sm sm:text-base tracking-tight truncate">
                  {liveMatch?.team1_label || "Team 1"}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-slate-400 text-xs font-bold">
                  {liveMatch?.live_score?.t1_sets || 0} set
                </span>
                <span
                  style={{
                    color: scoreTextColor,
                    borderColor: `${scoreTextColor}80`,
                    filter: `drop-shadow(0 0 8px ${scoreTextColor})`
                  }}
                  className="bg-slate-950/90 text-2xl font-black px-3 py-0.5 rounded-lg border font-mono min-w-[2.2ch] text-center"
                >
                  {liveMatch?.live_score?.t1_points ?? 0}
                </span>
              </div>
            </div>

            {/* Team 2 Row */}
            <div className="flex items-center justify-between bg-slate-800/70 rounded-xl px-3.5 py-2.5 border border-slate-700/40">
              <div className="flex items-center gap-2.5 truncate pr-2">
                <div
                  style={{
                    backgroundColor: liveMatch?.live_score?.server === 2 ? serverDotColor : undefined,
                    boxShadow: liveMatch?.live_score?.server === 2 ? `0 0 10px ${serverDotColor}` : undefined
                  }}
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${liveMatch?.live_score?.server === 2 ? "animate-pulse" : "bg-slate-700"}`}
                />
                <span className="text-white font-black text-sm sm:text-base tracking-tight truncate">
                  {liveMatch?.team2_label || "Team 2"}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-slate-400 text-xs font-bold">
                  {liveMatch?.live_score?.t2_sets || 0} set
                </span>
                <span
                  style={{
                    color: scoreTextColor,
                    borderColor: `${scoreTextColor}80`,
                    filter: `drop-shadow(0 0 8px ${scoreTextColor})`
                  }}
                  className="bg-slate-950/90 text-2xl font-black px-3 py-0.5 rounded-lg border font-mono min-w-[2.2ch] text-center"
                >
                  {liveMatch?.live_score?.t2_points ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Bar: Sets history */}
          {liveMatch?.sets_history && liveMatch.sets_history.length > 0 && (
            <div className="bg-slate-950 px-4 py-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-bold">
              <span>Sets History</span>
              <span className="text-slate-200 font-mono">{liveMatch.sets_history.join(" | ")}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Top Controls Bar ────────────────────────────────────────────────── */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-30 transition-opacity duration-300 ${
          controlsVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto">
          {/* Back button */}
          <button
            onClick={() => setLocation("/hub")}
            className="p-2.5 rounded-full bg-slate-900/80 border border-slate-700/80 text-white hover:bg-slate-800 transition shadow"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Match selector dropdown */}
          <div className="flex-1 max-w-xs">
            <select
              value={selectedMatchId || ""}
              onChange={(e) => setSelectedMatchId(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700 text-white font-bold text-xs rounded-xl px-3 py-2 outline-none cursor-pointer"
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
              <div className="bg-red-600 text-white font-black text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg animate-pulse">
                <Youtube className="w-4 h-4 fill-white" /> LIVE YOUTUBE
              </div>
            )}

            {isRecording && (
              <div className="bg-rose-600/90 text-white font-mono font-black text-xs px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
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
                  ? "bg-red-600 border-red-500 text-white shadow-lg"
                  : "bg-slate-900/80 border-slate-700 text-red-400 hover:bg-slate-800"
              }`}
              title="YouTube Live Stream Key Setup"
            >
              <Youtube className="w-5 h-5" />
            </button>

            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`p-2.5 rounded-full border transition ${
                  torchOn
                    ? "bg-amber-500 border-amber-400 text-slate-950"
                    : "bg-slate-900/80 border-slate-700 text-white"
                }`}
              >
                <Zap className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={switchCamera}
              className="p-2.5 rounded-full bg-slate-900/80 border border-slate-700 text-white hover:bg-slate-800 transition"
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
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black px-4 py-3 rounded-2xl shadow-xl transition active:scale-95 text-xs sm:text-sm"
          >
            <Download className="w-5 h-5" /> Download Video
          </button>
        )}

        {!isRecording ? (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-black px-5 py-3 rounded-2xl shadow-xl transition active:scale-95 text-xs sm:text-sm"
          >
            <Video className="w-5 h-5" /> Record Match
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-rose-400 border border-rose-500/50 font-black px-5 py-3 rounded-2xl shadow-xl transition active:scale-95 text-xs sm:text-sm"
          >
            <StopCircle className="w-5 h-5 animate-pulse" /> Stop Recording
          </button>
        )}
      </div>

      {/* ── YouTube Live Setup Modal Drawer ─────────────────────────────────── */}
      {showYoutubeModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full text-white space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Youtube className="w-6 h-6 text-red-500" />
                <h3 className="text-lg font-black">YouTube Live Setup</h3>
              </div>
              <button
                onClick={() => setShowYoutubeModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  YouTube RTMP Ingest Server
                </label>
                <input
                  type="text"
                  disabled
                  value="rtmps://a.rtmp.youtube.com/live2"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-400 font-mono outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    YouTube Stream Key
                  </label>
                  {userOverrideKey ? (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                      Manual Override
                    </span>
                  ) : (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
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
                    className="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono outline-none transition pr-10"
                  />
                  {userOverrideKey && (
                    <button
                      onClick={resetToDefaultKey}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white p-0.5 rounded transition"
                      title="Reset to Inbuilt Key"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 mt-1.5 flex items-center justify-between">
                  <span>Leave blank to use default inbuilt key.</span>
                  {userOverrideKey && (
                    <button
                      onClick={resetToDefaultKey}
                      className="text-amber-400 underline font-bold"
                    >
                      Reset to Inbuilt
                    </button>
                  )}
                </p>
              </div>

              <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 space-y-2 text-xs text-slate-300">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-red-400" /> Mobile Streaming Tip:
                </div>
                <p className="text-slate-400">
                  You can also paste your app's web overlay URL into PRISM Live Studio app to stream directly to YouTube with 60fps performance:
                </p>
                <code className="block bg-slate-900 p-2 rounded-lg text-[10px] text-slate-300 select-all overflow-x-auto">
                  https://iiscshuttlers.github.io/IIScBadmintonClub/tv/overlay
                </code>
              </div>

              {/* 🎨 Scoreboard Overlay Customization Section */}
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <Palette className="w-4 h-4 text-amber-400" /> Score Overlay Appearance
                </div>

                {/* Score Number Color */}
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1.5">Score Number Color</span>
                  <div className="flex items-center gap-2">
                    {[
                      { label: "Amber Gold", value: "#fbbf24", bg: "bg-amber-400" },
                      { label: "Electric Cyan", value: "#38bdf8", bg: "bg-sky-400" },
                      { label: "Neon Pink", value: "#f43f5e", bg: "bg-rose-500" },
                      { label: "Pure White", value: "#ffffff", bg: "bg-white" },
                      { label: "Emerald Green", value: "#34d399", bg: "bg-emerald-400" },
                    ].map((c) => (
                      <button
                        key={c.value}
                        onClick={() => updateScoreTextColor(c.value)}
                        className={`w-7 h-7 rounded-lg ${c.bg} transition border-2 ${
                          scoreTextColor === c.value ? "border-white scale-110 shadow-md" : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Server Dot Color */}
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1.5">Server Dot Color</span>
                  <div className="flex items-center gap-2">
                    {[
                      { label: "Electric Gold", value: "#fbbf24", bg: "bg-amber-400" },
                      { label: "Vibrant Cyan", value: "#38bdf8", bg: "bg-sky-400" },
                      { label: "Electric Violet", value: "#c084fc", bg: "bg-purple-400" },
                      { label: "Bright Red", value: "#ef4444", bg: "bg-red-500" },
                    ].map((c) => (
                      <button
                        key={c.value}
                        onClick={() => updateServerDotColor(c.value)}
                        className={`w-7 h-7 rounded-full ${c.bg} transition border-2 ${
                          serverDotColor === c.value ? "border-white scale-110 shadow-md" : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Card Background Glass */}
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1.5">Card Background Glass</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { label: "Fully Transparent", value: "rgba(0, 0, 0, 0)" },
                      { label: "Midnight Blue Glass", value: "rgba(15, 23, 42, 0.4)" },
                      { label: "Neon Purple Tint", value: "rgba(88, 28, 135, 0.4)" },
                      { label: "Deep Onyx Fade", value: "rgba(2, 6, 23, 0.4)" },
                    ].map((bg) => (
                      <button
                        key={bg.value}
                        onClick={() => updateCardBgColor(bg.value)}
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition text-left ${
                          cardBgColor === bg.value
                            ? "bg-blue-600/30 border-blue-500 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
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
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-2xl shadow-lg transition text-sm flex items-center justify-center gap-2"
                >
                  <Youtube className="w-5 h-5 fill-white" /> Start YouTube Stream
                </button>
              ) : (
                <button
                  onClick={() => {
                    stopYoutubeBroadcast();
                    setShowYoutubeModal(false);
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-red-400 border border-red-500/40 font-black py-3 rounded-2xl shadow-lg transition text-sm flex items-center justify-center gap-2"
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
