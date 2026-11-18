import React, { useState, useEffect } from "react";
import { useParams, Link, useLocation, Redirect } from "wouter";
import { motion } from "framer-motion";
import {
  Home,
  Swords,
  BarChart3,
  Dumbbell,
  Search,
  User,
  Flame,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { LoadingScreen } from "@/components/player-profile/PlayerProfileWidgets";
import { usePersonalStats } from "@/hooks/queries/usePersonalStats";
import { PersonalHomeSection } from "@/components/personal/PersonalHomeSection";
import { MatchesSection } from "@/components/personal/PersonalMatchesSection";
import { PersonalStatsSection } from "@/components/personal/PersonalStatsSection";
import { TrainingSection } from "@/components/personal/PersonalTrainingSection";

const MAIN_TABS = ["Home", "Matches", "Stats", "Training"] as const;
type MainTab = (typeof MAIN_TABS)[number];

const FORMAT_TABS = ["All", "Singles", "Doubles", "Mixed Doubles"] as const;
type FormatTab = (typeof FORMAT_TABS)[number];

function getTabIcon(tab: MainTab) {
  switch (tab) {
    case "Home":
      return <Home className="w-4 h-4" />;
    case "Matches":
      return <Swords className="w-4 h-4" />;
    case "Stats":
      return <BarChart3 className="w-4 h-4" />;
    case "Training":
      return <Dumbbell className="w-4 h-4" />;
    default:
      return null;
  }
}

export default function PlayerPersonalPage() {
  const { id } = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const [formatTab, setFormatTab] = useState<FormatTab>("All");

  let activeTab: MainTab = "Home";
  let subTab: "Match Stats" | "Phone" | "Watch Data" | "Rallies" = "Match Stats";

  const match = location.match(/^\/player\/[^/]+\/personal\/?([^/]*)\/?([^/]*)/);
  if (match) {
    const tabParam = match[1]?.toLowerCase();
    const subParam = match[2]?.toLowerCase();
    if (tabParam === "matches") activeTab = "Matches";
    else if (tabParam === "stats") {
      activeTab = "Stats";
      if (subParam === "phone") subTab = "Phone";
      else if (subParam === "watch") subTab = "Watch Data";
      else if (subParam === "rallies") subTab = "Rallies";
    } else if (tabParam === "training") activeTab = "Training";
  }

  const navigateTab = (tab: MainTab) => {
    const basePath = `/player/${id}/personal`;
    switch (tab) {
      case "Home": setLocation(`${basePath}/home`); break;
      case "Matches": setLocation(`${basePath}/matches`); break;
      case "Stats": setLocation(`${basePath}/stats/match`); break;
      case "Training": setLocation(`${basePath}/training`); break;
      default: setLocation(`${basePath}/home`);
    }
  };

  useEffect(() => {
    if (!id) return;
    if (location === `/player/${id}/personal`) {
      setLocation(`/player/${id}/personal/home`, { replace: true });
    }
  }, [id, location, setLocation]);

  const {
    player,
    fullMatches,
    matches,
    motionSummary,
    motionMatches,
    sensorAnalytics,
    workRate,
    tournamentStreak,
    isLoading,
  } = usePersonalStats(id);

  const { profile, signOut } = useAuth();

  if (profile && profile.id !== id) {
    return <Redirect to={`/player/${id}`} />;
  }

  if (isLoading || !player) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050505] pb-32 lg:pb-0 lg:flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 border-r border-border bg-card z-50 py-6 px-4">
        <div className="flex flex-col gap-5 px-2 mb-8">
          <Link href="/">
            <div className="flex items-center gap-3 group w-full cursor-pointer">
              <img
                src={`${import.meta.env.BASE_URL}iisc-logo.png`}
                alt="IISc Logo"
                className="h-9 w-auto object-contain flex-shrink-0 group-hover:scale-105 transition-transform"
              />
              <span className="font-bold text-[14px] tracking-tight text-foreground dark:text-foreground hidden xl:block whitespace-nowrap text-left">
                IISc Badminton Club
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-global-search"))}
              className="flex-1 flex items-center justify-start gap-2.5 px-3 py-2 rounded-xl text-muted-foreground dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors border border-transparent dark:border-slate-800"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
              <span className="text-xs font-semibold">Search...</span>
            </button>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {MAIN_TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => navigateTab(tab)}
                className={cn(
                  "relative flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold tracking-tight transition-all duration-200 w-full text-left",
                  active
                    ? "text-primary dark:text-primary bg-primary/10 dark:bg-primary/30"
                    : "text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-primary/15 dark:bg-primary/40 rounded-xl"
                    transition={{ type: "spring", bounce: 0.18, duration: 0.5 }}
                  />
                )}
                <span className={cn("relative z-10 flex items-center gap-3", active && "text-primary dark:text-primary")}>
                  {getTabIcon(tab)}
                  <span>{tab}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex flex-col gap-2 border-t border-border pt-4 mt-4">
          {profile?.id && (
            <Link href={`/player/${profile.id}/personal`}>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all w-full hover:bg-slate-100 dark:hover:bg-slate-800/60 group mt-1 cursor-pointer">
                <Avatar src={profile.avatar_url} name={profile.full_name} size="sm" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-primary transition-colors text-left">
                    {profile.full_name?.split(" ")[0]}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate text-left">{profile.email}</span>
                </div>
              </div>
            </Link>
          )}

          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-[var(--series-b)]/80 hover:text-[var(--series-b)] hover:bg-rose-50 dark:hover:bg-[var(--series-b)]/10 transition-all w-full mt-1"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-3 lg:pt-8 pb-6">
          {/* Hero */}
          <div className="relative overflow-hidden px-5 pt-3 pb-3 lg:px-8 lg:pt-8 lg:pb-7 mb-3">
            <div className="grid-texture absolute inset-0 opacity-60" />
            <div className="orb orb-volt absolute -top-24 -right-16 h-72 w-72" />
            <div className="orb orb-cyan absolute -bottom-16 left-1/4 h-44 w-44" />

            <div className="relative z-10 mx-auto max-w-4xl">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  {player?.avatar_url ? (
                    <img
                      src={player.avatar_url}
                      alt={player.full_name}
                      className="h-16 w-16 rounded-full border-2 border-primary/40 object-cover"
                    />
                  ) : (
                    <div className="gradient-bg flex h-16 w-16 items-center justify-center rounded-full text-2xl font-extrabold text-primary-foreground">
                      {player?.full_name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">
                      {(() => {
                        const h = new Date().getHours();
                        if (h < 12) return "Good morning";
                        if (h < 17) return "Good afternoon";
                        return "Good evening";
                      })()},
                    </p>
                    <motion.h1
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-0.5 truncate text-3xl font-extrabold leading-none tracking-tight lg:text-4xl text-slate-800 dark:text-slate-100"
                    >
                      {player?.full_name?.split(" ")[0]}
                    </motion.h1>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-bold capitalize text-primary">
                        {player?.playing_level ?? "Player"}
                      </span>
                      {tournamentStreak && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-secondary">
                          <Flame className="h-3.5 w-3.5" />
                          {tournamentStreak}
                        </span>
                      )}
                      <Link href={`/player/${id}`}>
                        <button className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700">
                          <User className="w-3.5 h-3.5 shrink-0" /> Public Profile →
                        </button>
                      </Link>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                      {player?.email && player?.is_guest === false && (
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[200px] sm:max-w-xs">{player.email}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--series-a)] text-[var(--series-a)] dark:bg-[var(--series-a)]/40 dark:text-[var(--series-a)] px-1.5 py-0.5 rounded-md border border-[var(--series-a)] dark:border-[var(--series-a)]/50">
                            BRAINMINTON Linked
                          </span>
                        </div>
                      )}
                      {player?.created_at && (
                        <div className="flex items-center gap-1.5">
                          {player?.email && <span className="opacity-50 hidden sm:inline">•</span>}
                          <span>Member since {new Date(player.created_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content Sections */}
          {activeTab === "Home" && (
            <PersonalHomeSection
              player={player}
              matches={matches}
              fullMatches={fullMatches}
              currentUser={profile}
            />
          )}
          {activeTab === "Matches" && (
            <MatchesSection
              matches={matches}
              fullMatches={fullMatches}
              formatTab={formatTab}
              setFormatTab={setFormatTab}
              currentUser={profile}
            />
          )}
          {activeTab === "Stats" && (
            <PersonalStatsSection
              matches={matches}
              fullMatches={fullMatches}
              player={player}
              motionSummary={motionSummary}
              motionMatches={motionMatches}
              workRate={workRate}
              sensorAnalytics={sensorAnalytics}
              playerId={id}
              isCurrentUser={profile?.id === player?.id}
              currentSubTab={subTab}
            />
          )}
          {activeTab === "Training" && <TrainingSection />}
        </div>
      </div>

      {/* Bottom Navigation - Mobile Only */}
      <div
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-[9999] bg-white/95 dark:bg-slate-950/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 flex justify-around items-end px-1 pt-1 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
      >
        {MAIN_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => navigateTab(tab)}
            className={`relative flex-1 min-w-0 flex flex-col items-center pt-2 pb-1 px-0.5 cursor-pointer ${
              activeTab === tab
                ? "text-[#ccff00]"
                : "text-muted-foreground hover:text-foreground dark:hover:text-foreground"
            }`}
          >
            <div className="mb-0.5 transform scale-90 opacity-90">
              {getTabIcon(tab)}
            </div>
            <span className="text-[11px] font-semibold">{tab}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
