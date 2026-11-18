import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminHistory } from "@/contexts/AdminHistoryContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import {
  Loader2, Trophy, Users, Swords, Archive, Settings2,
  CalendarDays, FileText, ShieldCheck, ClipboardList, CalendarClock, Gauge
} from "lucide-react";
import { cloneTournament } from "@/lib/cloneTournament";
import { OverflowTabs } from "@/components/tournament/OverflowTabs";
import { ThemeScope } from "@/components/tournament/ThemeScope";
import { getTournamentTheme, getEventFamily } from "@/lib/tournamentTheme";

// Child tab & header components
import { TournamentHeader } from "./TournamentHeader";
import { TournamentSettingsTab } from "./TournamentSettingsTab";
import { TournamentBracketTab } from "./TournamentBracketTab";
import { TournamentOrderOfPlayTab } from "./TournamentOrderOfPlayTab";
import { TournamentNotificationsTab } from "./TournamentNotificationsTab";
import { TeamBracketTab } from "./TeamBracketTab";
import { TeamsTab } from "./TeamsTab";
import { TeamTournamentManager } from "./TeamTournamentManager";
import { ScoringRulesPanel } from "@/components/tournament/ScoringRulesPanel";
import { TournamentOfficialsPanel } from "./TournamentOfficialsPanel";
import { TournamentRegistrationsPanel } from "./TournamentRegistrationsPanel";
import { TournamentReportPanel } from "./TournamentReportPanel";
import { TournamentArchiveTab } from "./TournamentArchiveTab";
import { TournamentParticipantsTab } from "./TournamentParticipantsTab";

// Service & types
import {
  fetchTournaments,
  createTournament as createTournamentApi,
  updateTournament as updateTournamentApi,
  deleteTournament as deleteTournamentApi,
} from "@/services/tournamentService";
import type { Tournament } from "@/types/tournament";

const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm";

const SUB_TABS = [
  "setup", "participants", "teams", "fixtures", "bracket",
  "schedule", "rules", "officials", "registrations", "report", "archive"
] as const;
type SubTab = typeof SUB_TABS[number];

const getHashSubTab = (): SubTab => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const paramTab = urlParams.get("tab") as SubTab;
    if (paramTab && (SUB_TABS as readonly string[]).includes(paramTab)) return paramTab;
  } catch {
    /* ignore */
  }

  const hash = window.location.hash.replace("#", "");
  const parts = hash.split("/");
  const sub = parts[1] as SubTab;
  return SUB_TABS.includes(sub) ? sub : "setup";
};

export function TournamentManager() {
  const { session, isMainAdmin } = useAuth();
  const { recordAction } = useAdminHistory();
  const { confirm } = useConfirm();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [activeTab, setActiveTab] = useState<SubTab>(getHashSubTab);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNotify, setShowNotify] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"active" | "deleted" | "archived">("active");

  const setTab = (tab: SubTab) => {
    setActiveTab(tab);
    const hash = window.location.hash.replace("#", "").split("/")[0];
    window.location.hash = `${hash}/${tab}`;
  };

  const loadTournaments = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const allTournaments = await fetchTournaments();
      setTournaments(allTournaments);

      setSelected((prev) => {
        const searchParams = new URLSearchParams(window.location.search);
        const urlId = searchParams.get("id");
        if (urlId && allTournaments.length) {
          const matchUrl = allTournaments.find(t => t.id === urlId);
          if (matchUrl) return matchUrl;
        }
        if (!prev && allTournaments.length) {
          const savedId = localStorage.getItem("admin_selected_tournament_id");
          const savedT = allTournaments.find(t => t.id === savedId);
          return savedT || allTournaments[0];
        }
        if (prev) {
          const updated = allTournaments.find(t => t.id === prev.id);
          return updated || prev;
        }
        return null;
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to load tournaments");
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => { loadTournaments(true); }, [loadTournaments]);

  // Synchronize when URL search ?id= changes
  useEffect(() => {
    const handleUrlChange = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const urlId = searchParams.get("id");
      if (urlId && tournaments.length) {
        const match = tournaments.find(t => t.id === urlId);
        if (match && match.id !== selected?.id) {
          setSelected(match);
        }
      }
    };
    handleUrlChange();
    window.addEventListener("popstate", handleUrlChange);
    return () => window.removeEventListener("popstate", handleUrlChange);
  }, [tournaments, selected?.id]);

  useEffect(() => {
    if (selected?.id) {
      localStorage.setItem("admin_selected_tournament_id", selected.id);
    }
  }, [selected?.id]);

  useEffect(() => {
    const onHashChange = () => setActiveTab(getHashSubTab());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const filteredTournaments = useMemo(() => {
    if (statusFilter === "active") return tournaments.filter((t) => t.status !== "deleted" && t.status !== "archived");
    if (statusFilter === "deleted") return tournaments.filter((t) => t.status === "deleted");
    return tournaments.filter((t) => t.status === "archived");
  }, [tournaments, statusFilter]);

  useEffect(() => {
    if (selected && filteredTournaments.some((t) => t.id === selected.id)) return;
    setSelected(filteredTournaments[0] ?? null);
  }, [filteredTournaments]);

  const permanentlyDelete = async (tournament: Tournament) => {
    const ok = await confirm({
      title: "Permanently Delete Tournament",
      description: `This will permanently delete "${tournament.name}" and all its matches, participants, teams, rules and bracket data. This action CANNOT be undone.`,
      confirmLabel: "Delete Forever",
      confirmVariant: "danger",
    });
    if (!ok) return;

    try {
      await deleteTournamentApi(tournament.id);
      await recordAction({
        action_type: "delete",
        entity_type: "tournaments",
        entity_id: tournament.id,
        before_state: tournament,
        after_state: null,
        label: `Permanently deleted tournament "${tournament.name}"`,
      });
      toast.success("Tournament permanently deleted");
      await loadTournaments(false);
      if (selected?.id === tournament.id) setSelected(null);
    } catch (error: any) {
      toast.error("Failed to permanently delete: " + error.message);
    }
  };

  const restoreTournament = async (tournament: Tournament) => {
    try {
      await updateTournamentApi(tournament.id, { status: "draft" });
      await recordAction({
        action_type: "update",
        entity_type: "tournaments",
        entity_id: tournament.id,
        before_state: tournament,
        after_state: { ...tournament, status: "draft" },
        label: `Restored tournament "${tournament.name}" to draft`,
      });
      toast.success("Tournament restored to draft");
      await loadTournaments(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCreateTournament = async (formatFamily: "OPEN_EVENT" | "TEAM") => {
    setCreating(true);
    try {
      const created = await createTournamentApi({
        name: "New Tournament",
        created_by: session?.user?.id,
        year: new Date().getFullYear(),
        format_family: formatFamily,
      });
      toast.success("Tournament created");
      await loadTournaments(false);
      setSelected(created);
      setTab("setup");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleClone = async () => {
    if (!selected) return;
    const ok = await confirm({
      title: "Clone tournament?",
      description: `Creates a new draft with ${selected.name}'s format, settings, scoring rules and officials. Participants, matches, dates and form links are not copied.`,
      confirmLabel: "Clone",
    });
    if (!ok) return;

    setCreating(true);
    try {
      const { tournament, warnings } = await cloneTournament(selected, session?.user?.id);
      toast.success(`Created ${tournament.name}`);
      if (warnings.length) toast.warning(`Couldn't copy ${warnings.join(" and ")} — set them on the new event.`);
      await loadTournaments(false);
      setSelected(tournament as Tournament);
      setTab("setup");
    } catch (e: any) {
      toast.error(e?.message || "Clone failed");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Tournament Selector Header */}
      <TournamentHeader
        tournaments={tournaments}
        selected={selected}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        filteredTournaments={filteredTournaments}
        onSelectTournament={(t) => {
          setSelected(t);
          setTab("setup");
          const url = new URL(window.location.href);
          url.searchParams.set("id", t.id);
          window.history.replaceState({}, "", url.toString());
        }}
        onCreateTournament={handleCreateTournament}
        onCloneTournament={handleClone}
        onRestoreTournament={restoreTournament}
        onPermanentlyDelete={permanentlyDelete}
        onOpenNotify={() => setShowNotify(true)}
        creating={creating}
      />

      {selected && (
        <>
          {/* Navigation Tabs */}
          <OverflowTabs
            activeId={activeTab}
            onChange={(id) => setTab(id as SubTab)}
            activeClassName={`${getTournamentTheme(selected).tokens.bg} text-white shadow-md`}
            tabs={(selected?.format_family === "TEAM"
              ? [
                  { id: "setup", label: "Setup", icon: Settings2 },
                  { id: "teams", label: "Teams", icon: Users },
                  { id: "fixtures", label: "Schedule Tie", icon: CalendarDays },
                  { id: "bracket", label: "Bracket & Pools", icon: Swords },
                  { id: "schedule", label: "Order of Play", icon: CalendarClock },
                  { id: "rules", label: "Scoring Rules", icon: Gauge },
                  { id: "officials", label: "Officials", icon: ShieldCheck },
                  ...(selected?.require_app_registration ? [{ id: "registrations", label: "Registrations", icon: ClipboardList }] : []),
                  { id: "report", label: "Report", icon: FileText },
                  { id: "archive", label: "Archive", icon: Archive }
                ]
              : [
                  { id: "setup", label: "Setup", icon: Settings2 },
                  { id: "participants", label: "Participants", icon: Users },
                  { id: "bracket", label: "Bracket", icon: Swords },
                  { id: "schedule", label: "Order of Play", icon: CalendarClock },
                  { id: "rules", label: "Scoring Rules", icon: Gauge },
                  { id: "officials", label: "Officials", icon: ShieldCheck },
                  ...(selected?.require_app_registration ? [{ id: "registrations", label: "Registrations", icon: ClipboardList }] : []),
                  { id: "report", label: "Report", icon: FileText },
                  { id: "archive", label: "Archive", icon: Archive }
                ]
            ).map((tab) => {
              const IconComp = tab.icon;
              return { id: tab.id, label: tab.label, icon: <IconComp className="w-4 h-4 shrink-0" /> };
            })}
          />

          <ThemeScope family={getEventFamily(selected)} className="mt-5 space-y-5">
            {activeTab === "setup" && (
              <TournamentSettingsTab
                tournament={selected}
                onSaved={(t) => {
                  setSelected(t);
                  setTournaments((prev) => prev.map((item) => (item.id === t.id ? t : item)));
                }}
                isMasterAdmin={isMainAdmin}
                onDelete={() => { setSelected(null); loadTournaments(false); }}
                onGoArchive={() => setTab("archive")}
                onNavigateTab={(tab) => setTab(tab as SubTab)}
              />
            )}
            {activeTab === "participants" && <TournamentParticipantsTab tournament={selected} />}
            {activeTab === "teams" && <TeamsTab tournament={selected} />}
            {activeTab === "fixtures" && selected?.format_family === "TEAM" && (
              <TeamTournamentManager tournamentId={selected.id} />
            )}
            {activeTab === "bracket" && selected?.format_family === "TEAM" && (
              <TeamBracketTab tournament={selected} isMasterAdmin={isMainAdmin} />
            )}
            {activeTab === "bracket" && selected?.format_family !== "TEAM" && (
              <TournamentBracketTab tournament={selected} isMasterAdmin={isMainAdmin} />
            )}
            {activeTab === "schedule" && <TournamentOrderOfPlayTab tournament={selected} />}
            {activeTab === "rules" && <ScoringRulesPanel tournament={selected as any} />}
            {activeTab === "officials" && <TournamentOfficialsPanel tournament={selected} />}
            {activeTab === "registrations" && <TournamentRegistrationsPanel tournament={selected} />}
            {activeTab === "report" && <TournamentReportPanel tournament={selected as any} />}
            {activeTab === "archive" && (
              <TournamentArchiveTab tournament={selected} isMasterAdmin={isMainAdmin} onArchived={() => loadTournaments(false)} />
            )}
          </ThemeScope>

          {showNotify && (
            <TournamentNotificationsTab
              tournament={selected}
              open={showNotify}
              onClose={() => setShowNotify(false)}
            />
          )}
        </>
      )}

      {!selected && !loading && (
        <div className={`${cardCls} text-center py-10`}>
          <Trophy className="w-12 h-12 text-slate-300 dark:text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-bold">No tournaments yet. Create one above.</p>
        </div>
      )}
    </div>
  );
}
