import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useOtherPlayersSlim } from "./usePlayers";

import { useInactivityLogout } from "./useInactivityLogout";
import { useNativeBackButton } from "./useNativeBackButton";
import { usePullToRefresh } from "./usePullToRefresh";
import { useOfflineSync } from "./useOfflineSync";
import { useBroadcastNotification } from "./useBroadcastNotification";
import { usePingsNotification } from "./usePingsNotification";
import { initSounds } from "@/lib/sounds";

export function useAppBootstrap() {
  const [, setLocation] = useLocation();
  const { profile } = useAuth();
  const [isLogMatchOpen, setIsLogMatchOpen] = useState(false);
  const [defaultOpponentId, setDefaultOpponentId] = useState<string | undefined>(undefined);

  useInactivityLogout();
  useNativeBackButton();
  usePullToRefresh();
  useOfflineSync();
  usePingsNotification();
  useBroadcastNotification();

  useEffect(() => {
    initSounds();
  }, []);

  // Handle deep links from QR codes and NFC scans
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleDeepLink = (event: any) => {
      const url = event.url;
      if (url) {
        if (url.startsWith("iiscshuttlers://")) {
          const path = url.slice("iiscshuttlers://".length);
          setLocation("/" + path);
          return;
        }
        if (url.includes("iiscbadmintonclub.github.io")) {
          const match = url.match(/iiscbadmintonclub\.github\.io\/iiscshuttlers(\/[^?]*)?/);
          if (match) {
            setLocation(match[1] || "/");
          }
        }
      }
    };

    CapacitorApp.addListener("appUrlOpen", handleDeepLink);

    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, [setLocation]);

  useEffect(() => {
    const handleOpenLogMatch = (e: any) => {
      if (e.detail?.player2_id) {
        setDefaultOpponentId(e.detail.player2_id);
      } else {
        setDefaultOpponentId(undefined);
      }
      setIsLogMatchOpen(true);
    };
    window.addEventListener("openLogMatchModal", handleOpenLogMatch);
    return () =>
      window.removeEventListener("openLogMatchModal", handleOpenLogMatch);
  }, []);

  const { data: otherPlayersRaw } = useOtherPlayersSlim(profile?.id);
  const otherPlayers = otherPlayersRaw || [];

  return {
    isLogMatchOpen,
    setIsLogMatchOpen,
    defaultOpponentId,
    setDefaultOpponentId,
    otherPlayers
  };
}
