import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOtherPlayersSlim } from "./usePlayers";

import { useInactivityLogout } from "./useInactivityLogout";
import { useNativeBackButton } from "./useNativeBackButton";
import { usePullToRefresh } from "./usePullToRefresh";
import { useOfflineSync } from "./useOfflineSync";
import { useBroadcastNotification } from "./useBroadcastNotification";
import { usePingsNotification } from "./usePingsNotification";
import { initSounds } from "@/lib/sounds";

export function useAppBootstrap() {
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

  // Deep-link handling is centralised in App.tsx — do not register a second listener here.

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
