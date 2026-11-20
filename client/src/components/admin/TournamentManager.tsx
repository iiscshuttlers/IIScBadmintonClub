import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminHistory } from "@/contexts/AdminHistoryContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { Loader2, Trophy, Users, Swords, Settings2, CalendarDays, FileText, CalendarClock } from "lucide-react";
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
import { TournamentRegistrationsPanel } from "./TournamentRegistrationsPanel";
import { TournamentReportPanel } from "./TournamentReportPanel";
import { TournamentArchiveTab } from "./TournamentArchiveTab";
import { TournamentParticipantsTab } from "./TournamentParticipantsTab";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

// Service & types
import {
  fetchTournaments,
  updateTournament as updateTournamentApi,
  deleteTournament as deleteTournamentApi,
} from "@/services/tournamentService";
import type { Tournament } from "@/types/tournament";

const cardCls = "bg-card rounded-2xl border border-border p-5 shadow-sm";

/** Five tabs, in the order an organiser works through them. */
const SUB_TABS = ["setup", "entries", "draw", "schedule", "wrapup"] as const;
type SubTab = typeof SUB_TABS[number];
export type SetupSection = "team" | "rules" | "officials" | "more";

/**
 * Tab ids from before the merge still arrive through saved links, admin
 * action cards (?tab=officials) and readiness "fix" buttons. Map each one to
 * the tab (and Setup section) that now holds it.
 */
const LEGACY_TABS: Record<string, { tab: SubTab; section?: SetupSection }> = {
  participants: { tab: "entries" },
  teams: { tab: "entries" },
  registrations: { tab: "entries" },
  bracket: { tab: "draw" },
  fixtures: { tab: "draw" },
  matches: { tab: "schedule" },
  rules: { tab: "setup", section: "rules" },
  officials: { tab: "setup", section: "officials" },
  report: { tab: "wrapup" },
  archive: { tab: "wrapup" },
};

function resolveTab(raw: string | null | undefined): { tab: SubTab; section?: SetupSection } | null {
  if (!raw) return null;
  if ((SUB_TABS as readonly string[]).includes(raw)) return { tab: raw as SubTab };
  return LEGACY_TABS[raw] ?? null;
}

const readLocationTab = (): { tab: SubTab; section?: SetupSection } => {
  try {
    const fromQuery = resolveTab(new URLSearchParams(window.location.search).get("tab"));
    if (fromQuery) return fromQuery;
  } catch {
    /* ignore */
  }
  return resolveTab(window.location.hash.replace("#", "").split("/")[1]) ?? { tab: "setup" };
};

export function TournamentManager() {
  const { session, isMainAdmin } = useAuth();
  const { recordAction } = useAdminHistory();
  const { confirm } = useConfirm();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [activeTab, setActiveTab] = useState<SubTab>(() => readLocationTab().tab);
  const [focusSection, setFocusSection] = useState<SetupSection | undefined>(() => readLocationTab().section);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNotify, setShowNotify] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"active" | "deleted" | "archived">("active");

  /** Accepts current ids and the old ones (see LEGACY_TABS). */
  const setTab = (raw: string) => {
    const target = resolveTab(raw) ?? { tab: "setup" as SubTab };
    setActiveTab(target.tab);
    setFocusSection(target.section);
    // A ?tab= deep link would otherwise win over the hash on the next read.
    const url = new URL(window.location.href);
    if (url.searchParams.has("tab")) {
      url.searchParams.delete("tab");
      window.history.replaceState(window.history.state, "", url.toString());
    }
    const hash = window.location.hash.replace("#", "").split("/")[0];
    window.location.hash = `${hash}/${target.tab}`;
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
    const onHashChange = () => {
      const target = readLocationTab();
      setActiveTab(target.tab);
      setFocusSection(target.section);
    };
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

  const isTeam = selected?.format_family === "TEAM";

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
        onCloneTournament={handleClone}
        onRestoreTournament={restoreTournament}
        onPermanentlyDelete={permanentlyDelete}
        onOpenNotify={() => setShowNotify(true)}
        creating={creating}
      />

      {selected && (
        <>
          <OverflowTabs
            activeId={activeTab}
            onChange={setTab}
            activeClassName={`${getTournamentTheme(selected).tokens.bg} text-foreground shadow-md`}
            tabs={[
              { id: "setup", label: "Setup", icon: Settings2 },
              { id: "entries", label: isTeam ? "Teams" : "Players", icon: Users },
              { id: "draw", label: "Draw", icon: Swords },
              { id: "schedule", label: "Schedule", icon: CalendarClock },
              { id: "wrapup", label: "Wrap-up", icon: FileText },
            ].map((tab) => {
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
                onGoArchive={() => setTab("wrapup")}
                onNavigateTab={setTab}
                focusSection={focusSection}
              />
            )}

            {activeTab === "entries" && (
              <>
                {selected.require_app_registration && <TournamentRegistrationsPanel tournament={selected} />}
                {isTeam ? <TeamsTab tournament={selected} /> : <TournamentParticipantsTab tournament={selected} />}
              </>
            )}

            {activeTab === "draw" && !isTeam && (
              <TournamentBracketTab tournament={selected} isMasterAdmin={isMainAdmin} />
            )}
            {activeTab === "draw" && isTeam && (
              <>
                <TeamBracketTab tournament={selected} isMasterAdmin={isMainAdmin} />
                <CollapsibleSection
                  bare
                  title="All ties"
                  summary="Add a tie by hand, reschedule or resolve one"
                  icon={<CalendarDays />}
                >
                  <TeamTournamentManager tournamentId={selected.id} view="fixtures" />
                </CollapsibleSection>
              </>
            )}

            {activeTab === "schedule" && <TournamentOrderOfPlayTab tournament={selected} />}

            {activeTab === "wrapup" && (
              <>
                <TournamentReportPanel tournament={selected as any} />
                <TournamentArchiveTab tournament={selected} isMasterAdmin={isMainAdmin} onArchived={() => loadTournaments(false)} />
              </>
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
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-bold">No tournaments yet. Use New above to create one.</p>
        </div>
      )}
    </div>
  );
}
