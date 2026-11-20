import { useState, useEffect } from "react";
import { Calendar, ChevronDown, ChevronUp, MapPin, Clock, Phone, MessageCircle, Download, Image, FileText } from "lucide-react";
import { exportElementToImage, exportElementToPDF } from "@/utils/exportUtils";
import { useAuth } from "@/contexts/AuthContext";
import { MatchPredictionCard } from "@/components/feed/MatchPredictions";
import { getCourtColor, cn } from "@/lib/utils";
import { Link } from "wouter";
import { fetchTournamentSeedRows } from "@/services/tournamentService";
import { buildSeedIndex, courtLabel, matchState, toMatchView, type MatchRow, type SeedIndex } from "@/lib/matchView";
import { MatchSideRow, MatchStatusBadge, scoreSummary } from "@/components/match/MatchPrimitives";
import { matchPath } from "@/lib/tournamentRoutes";
import { feedService } from "@/services/feedService";
import { fetchTournamentContacts, fetchTournamentOfficialsWithContacts } from "@/services/playerPrivateService";
import {
  fetchTournamentById,
  fetchTournamentMatches,
  getUserTournamentRoles,
} from "@/services/tournamentService";

interface ScheduledMatch {
  id: string;
  category: string;
  match_code: string;
  round_name: string;
  team1_label: string | null;
  team2_label: string | null;
  court_number: string | null;
  scheduled_at: string | null;
  status: string;
  winner_side: 1 | 2 | null;
  sets_history: string[] | null;
  player1_id: string | null;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
}

interface ContactInfo { id: string; name: string; contact_number: string | null; role?: string; }

const CAT_COLORS: Record<string, string> = {
  "MS": "bg-cat-ms/10 text-cat-ms border-cat-ms/40",
  "MD": "bg-cat-md/10 text-cat-md border-cat-md/40",
  "WS": "bg-cat-ws/10 text-cat-ws border-cat-ws/40",
  "WD": "bg-cat-wd/10 text-cat-wd border-cat-wd/40",
  "XD": "bg-cat-xd/10 text-cat-xd border-cat-xd/40",
  "Team": "bg-team/10 text-team border-team/40",
};

const CAT_BOX_COLORS: Record<string, string> = {
  "MS": "border-cat-ms/30 bg-cat-ms/10",
  "MD": "border-cat-md/30 bg-cat-md/10",
  "WS": "border-cat-ws/30 bg-cat-ws/10",
  "WD": "border-cat-wd/30 bg-cat-wd/10",
  "XD": "border-cat-xd/30 bg-cat-xd/10",
  "Team": "border-team/30 bg-team/10",
};

export function LiveMatchSchedule({ tournamentId, playerName }: { tournamentId: string | null, playerName: string | null }) {
  const [schedMatches, setSchedMatches] = useState<ScheduledMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [activeDate, setActiveDate] = useState("ALL");

  const { profile, isAdmin } = useAuth();
  const [picks, setPicks] = useState<Record<string, 1 | 2>>({});
  const [revealedMatchIds, setRevealedMatchIds] = useState<Record<string, boolean>>({});
  const [contactsEnabled, setContactsEnabled] = useState(false);
  const [contactMap, setContactMap] = useState<Record<string, ContactInfo>>({});
  const [officials, setOfficials] = useState<ContactInfo[]>([]);
  const [expandedContacts, setExpandedContacts] = useState<Record<string, boolean>>({});
  const [exportMenuDate, setExportMenuDate] = useState<string | null>(null);
  const [showAllContacts, setShowAllContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [tournamentOver, setTournamentOver] = useState(false);
  const [myRoles, setMyRoles] = useState<Set<string>>(new Set());
  const [seeds, setSeeds] = useState<SeedIndex>(() => new Map());

  // Seeds are decoration: a failure leaves the schedule unchanged.
  useEffect(() => {
    if (!tournamentId) return;
    let cancelled = false;
    fetchTournamentSeedRows(tournamentId).then((data) => {
      if (!cancelled && data) setSeeds(buildSeedIndex(data));
    });
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  useEffect(() => {
    if (!profile?.id) return;
    const loadPicks = async () => {
      try {
        const myPicks = await feedService.getLiveMatchPicks(profile.id);
        setPicks(myPicks);
        const revealed = await feedService.getPollRevealedMatches();
        setRevealedMatchIds(revealed);
      } catch (err) {
        console.error("Failed to load picks:", err);
      }
    };
    loadPicks();
  }, [profile?.id]);

  const handlePick = async (matchId: string, team: 1 | 2) => {
    if (!profile?.id) return;
    setPicks(prev => ({ ...prev, [matchId]: team }));
    try {
      await feedService.saveLiveMatchPick(matchId, profile.id, team);
    } catch (err) {
      console.error("Failed to save pick:", err);
    }
  };

  const handleToggleReveal = async (matchId: string) => {
    if (!isAdmin) return;
    const isRevealed = !revealedMatchIds[matchId];
    const nextState = { ...revealedMatchIds, [matchId]: isRevealed };
    setRevealedMatchIds(nextState);
    try {
      await feedService.setPollRevealedMatches(nextState);
    } catch (err) {
      console.error("Failed to update poll revealed matches:", err);
    }
  };

  useEffect(() => {
    if (!tournamentId) { setLoading(false); return; }
    fetchTournamentMatches(tournamentId)
      .then((data) => {
        const sorted = [...data].sort((a: any, b: any) => {
          if (a.scheduled_at && b.scheduled_at) {
            return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
          }
          if (a.scheduled_at) return -1;
          if (b.scheduled_at) return 1;
          if (b.round !== a.round) return (b.round ?? 0) - (a.round ?? 0);
          return (b.match_number ?? 0) - (a.match_number ?? 0);
        });
        setSchedMatches(sorted as ScheduledMatch[]);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch matches:", err);
        setLoading(false);
      });
  }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId) return;
    fetchTournamentById(tournamentId).then((data) => {
      if (data?.status === "COMPLETED" || data?.status === "ARCHIVED") {
        setTournamentOver(true);
        feedService.deleteTournamentContacts(tournamentId).catch(() => {});
      }
    }).catch((err) => {
      console.error("Failed to fetch tournament status:", err);
    });
  }, [tournamentId]);

  // Load contacts setting, player contacts, and officials
  useEffect(() => {
    if (!tournamentId || !profile?.id) return;
    (async () => {
      try {
        // Check if contacts are enabled for this tournament
        const sd = await feedService.getTournamentContacts(tournamentId);
        const enabled = sd === true || (sd as any)?.enabled === true;
        setContactsEnabled(enabled);

        // Load my roles for this tournament
        const roles = await getUserTournamentRoles(tournamentId, profile.id);
        setMyRoles(roles);

        // Load officials with contacts
        // Phone numbers are released by the server according to role.
        const offList = await fetchTournamentOfficialsWithContacts(tournamentId);
        setOfficials(offList);
      } catch (err) {
        console.error("Failed to load tournament contacts and officials:", err);
      }
    })();
  }, [tournamentId, profile?.id]);

  // Load player contacts when matches are available
  useEffect(() => {
    // get_tournament_contacts is only executable by signed-in users (anon gets
    // a 401), and the server decides per role what to release; skip it for
    // visitors, like the officials lookup above.
    if (!profile?.id) return;
    if (!schedMatches.length) return;
    const playerIds = new Set<string>();
    for (const m of schedMatches) {
      if (m.player1_id) playerIds.add(m.player1_id);
      if (m.player2_id) playerIds.add(m.player2_id);
      if (m.player3_id) playerIds.add(m.player3_id);
      if (m.player4_id) playerIds.add(m.player4_id);
    }
    if (!playerIds.size) return;
    if (!tournamentId) return;
    fetchTournamentContacts(tournamentId, [...playerIds]).then((map) => {
      setContactMap(map);
    }).catch((err) => {
      console.error("Failed to load player contacts map:", err);
    });
  }, [schedMatches, profile?.id, tournamentId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 animate-spin border-4 border-primary border-t-transparent rounded-full" /></div>;

  const categories = ["ALL", ...new Set(schedMatches.map((m) => m.category))];
  
  const formatDateForPill = (dateStr: string | null) => 
    dateStr ? new Date(dateStr).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "Unscheduled";
    
  const dates = ["ALL", ...new Set(schedMatches.map((m) => formatDateForPill(m.scheduled_at)))];

  const filtered = schedMatches.filter((m) => {
    const catMatch = activeCategory === "ALL" || m.category === activeCategory;
    const dateMatch = activeDate === "ALL" || formatDateForPill(m.scheduled_at) === activeDate;
    return catMatch && dateMatch;
  });

  if (!schedMatches.length) return (
    <div className="py-16 flex flex-col items-center justify-center text-center">
      <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-xl font-black text-soft mb-2">Schedule Not Yet Available</h3>
      <p className="text-muted-foreground max-w-md">Match schedule will appear here once the admin assigns court times to bracket matches.</p>
    </div>
  );

  const renderMatchList = (matches: ScheduledMatch[]) => {
    // Group by local calendar day (sortable key), label each day in words.
    const dayKey = (iso: string) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const grouped: Record<string, Record<string, ScheduledMatch[]>> = {};
    const labels: Record<string, string> = {};
    for (const m of matches) {
      const key = m.scheduled_at ? dayKey(m.scheduled_at) : "Unscheduled";
      if (!labels[key]) {
        labels[key] = m.scheduled_at
          ? new Date(m.scheduled_at).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })
          : "Unscheduled";
      }
      if (!grouped[key]) grouped[key] = {};
      const catKey = m.category || "Other";
      if (!grouped[key][catKey]) grouped[key][catKey] = [];
      grouped[key][catKey].push(m);
    }

    // Days run in order. With no date picked, open today (or the next day with
    // matches, or the last day once play is over); a picked date is open.
    const days = Object.keys(grouped).sort((a, b) => (a === "Unscheduled" ? 1 : b === "Unscheduled" ? -1 : a.localeCompare(b)));
    const today = dayKey(new Date().toISOString());
    const datedDays = days.filter((d) => d !== "Unscheduled");
    const focusDay = activeDate !== "ALL"
      ? null
      : datedDays.find((d) => d >= today) ?? datedDays[datedDays.length - 1] ?? days[0];

    return (
      <div className="space-y-6 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
        {days.map((key) => [key, grouped[key]] as const).map(([key, categoriesGroup]) => {
          const date = labels[key];
          const isOpen = activeDate !== "ALL" || key === focusDay || days.length === 1;
          const totalMatchesForDate = Object.values(categoriesGroup).reduce((acc, matches) => acc + matches.length, 0);
          return (
            <details key={key} open={isOpen} className="group mb-6 last:mb-0 relative">
              <summary className="flex items-center gap-3 mb-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden select-none outline-none">
                <Calendar className="w-4 h-4 text-primary" />
                <h4 className="font-black text-soft text-sm flex-1">
                  {date} <span className="text-xs font-bold text-muted-foreground">({totalMatchesForDate})</span>
                </h4>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setExportMenuDate(exportMenuDate === date ? null : date);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-muted text-soft hover:bg-muted-strong transition-colors text-xs font-bold"
                    >
                      <Download className="w-3 h-3" />
                      Export
                    </button>
                    {exportMenuDate === date && (
                      <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border-strong rounded-xl shadow-lg overflow-hidden min-w-[130px]">
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setExportMenuDate(null);
                            const el = document.getElementById(`print-schedule-${date.replace(/\s+/g, '-')}`);
                            if (el) await exportElementToImage(el, `schedule_${date.replace(/\s+/g, '_')}`, "#0f172a");
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-xs font-bold text-soft hover:bg-muted transition"
                        >
                          <Image className="w-3.5 h-3.5 text-success" /> PNG Image
                        </button>
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setExportMenuDate(null);
                            const el = document.getElementById(`print-schedule-${date.replace(/\s+/g, '-')}`);
                            if (el) await exportElementToPDF(el, `schedule_${date.replace(/\s+/g, '_')}`, "#ffffff");
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-xs font-bold text-soft hover:bg-muted transition"
                        >
                          <FileText className="w-3.5 h-3.5 text-danger" /> PDF
                        </button>
                      </div>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground group-open:rotate-180 transition-transform" />
                </div>
              </summary>
              <div className="space-y-6" id={`print-schedule-${date.replace(/\s+/g, '-')}`}>
                {/* Print Header (Only visible in print) */}
                <div className="hidden print:block mb-8 text-center border-b pb-4">
                  <h1 className="text-2xl font-black mb-1">IISc Badminton Club</h1>
                  <h2 className="text-xl text-muted-foreground">Match Schedule - {date}</h2>
                </div>

                {Object.entries(categoriesGroup).map(([cat, rawDayMatches]) => {
                  const catCls = CAT_COLORS[cat] ?? "bg-muted text-muted-foreground border-border";
                  const boxCls = CAT_BOX_COLORS[cat] ?? "border-border-strong bg-card";
                  
                  // Live first, then upcoming, then finished (shared status rules).
                  const priority = (m: ScheduledMatch) => {
                    const st = matchState(m);
                    if (st === "live") return 0;
                    if (st === "completed" || st === "walkover" || st === "cancelled") return 2;
                    return 1;
                  };

                  const dayMatches = [...rawDayMatches].sort((a, b) => {
                    const pA = priority(a);
                    const pB = priority(b);
                    if (pA !== pB) return pA - pB;
                    if (a.scheduled_at && b.scheduled_at) {
                      return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
                    }
                    return 0;
                  });

                  return (
                    <div key={cat} className="space-y-3">
                      <h5 className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-lg border w-max ${catCls}`}>
                        {cat} Matches
                      </h5>
                      {dayMatches.map((m, idx) => {
                        const view = toMatchView(m as unknown as MatchRow, seeds);
                        const isCompleted = view.state === "completed" || view.state === "walkover" || view.state === "cancelled";
                        const isLive = view.state === "live";
                        const summary = scoreSummary(view);
                        const checkMatch = (label: string | undefined | null, pName: string | null) => {
                          if (!label || !pName) return false;
                          const l = label.toLowerCase();
                          const p = pName.toLowerCase();
                          if (l.includes(p) || p.includes(l)) return true;
                          const parts = p.split(' ').filter(x => x.length > 2);
                          return parts.length > 0 && parts.some(part => l.includes(part));
                        };
                        const isMyMatch = checkMatch(m.team1_label, playerName) || checkMatch(m.team2_label, playerName);
                        
                        let customBoxCls = boxCls;
                        if (isLive) {
                          customBoxCls = cn(boxCls, "border-live/40 bg-live/10 shadow-md shadow-live/10");
                        } else if (isMyMatch) {
                          customBoxCls = cn(boxCls, "ring-2 ring-primary border-primary shadow-lg shadow-primary/30 animate-pulse !bg-primary/10");
                        }

                        return (
                          <div key={m.id} className={cn("rounded-2xl border p-4 print:break-inside-avoid print:border-border-strong print:shadow-none transition-all duration-300", customBoxCls)}>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-[10px] font-black text-muted-foreground w-5">#{idx + 1}</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${catCls} print:bg-transparent print:border-border-strong`}>{m.category}</span>
                            <span className="text-[10px] text-muted-foreground font-bold">{m.round_name} · {m.match_code}</span>
                            {view.court && (
                              <span className={cn("flex items-center gap-1 text-[10px] font-bold", getCourtColor(view.court))}>
                                <MapPin className="w-3 h-3" aria-hidden /> {courtLabel(view.court)}
                              </span>
                            )}
                            {view.scheduledAt && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Clock className="w-3 h-3" aria-hidden />
                                <span className="sr-only">Scheduled</span>
                                {new Date(view.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                            <MatchStatusBadge view={view} />
                            <Link
                              href={matchPath(view.tournamentId || tournamentId || "", view.id)}
                              className="ml-auto inline-flex items-center min-h-[44px] -my-3 px-2 text-[11px] font-black text-primary hover:underline print:hidden"
                              aria-label={`Match details: ${view.sides[0].label} versus ${view.sides[1].label}`}
                            >
                              Details →
                            </Link>
                          </div>
                          <div className="divide-y divide-border text-sm">
                            <MatchSideRow side={view.sides[0]} index={0} view={view} />
                            <MatchSideRow side={view.sides[1]} index={1} view={view} />
                          </div>
                          {summary && <p className="sr-only">Score: {summary}</p>}
                          {view.scoreText && <p className="mt-1.5 text-xs font-mono text-muted-foreground">{view.scoreText}</p>}

                          {/* Contact buttons */}
                          {(() => {
                            const isOfficial = myRoles.size > 0;
                            const canSeeContacts = isAdmin || isOfficial || (contactsEnabled && isMyMatch);
                            if (!canSeeContacts || isCompleted) return null;
                            const matchPlayerIds = [m.player1_id, m.player2_id, m.player3_id, m.player4_id].filter(Boolean) as string[];
                            const opponentIds = isMyMatch && !isOfficial
                              ? matchPlayerIds.filter(id => id !== profile?.id)
                              : matchPlayerIds;
                            const contacts = opponentIds.map(id => contactMap[id]).filter(Boolean);
                            const showOfficials = isMyMatch && !isOfficial;
                            const expanded = expandedContacts[m.id];
                            if (!contacts.length && !showOfficials) return null;
                            return (
                              <div className="mt-2 pt-2 border-t border-border/50 print:hidden">
                                <button
                                  onClick={() => setExpandedContacts(p => ({ ...p, [m.id]: !p[m.id] }))}
                                  className="inline-flex items-center gap-1.5 text-[10px] font-black text-success hover:text-success/80 transition"
                                >
                                  <Phone className="w-3 h-3" />
                                  {expanded ? "Hide Contacts" : `Contact ${isOfficial || isAdmin ? "Players" : "Opponent"}`}
                                </button>
                                {expanded && (
                                  <div className="mt-2 space-y-1.5">
                                    {contacts.map(c => (
                                      <div key={c.id} className="flex items-center gap-2 text-xs">
                                        <span className="font-bold text-soft min-w-0 truncate flex-1">{c.name}</span>
                                        {c.contact_number ? (
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <a href={`tel:${c.contact_number}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-success/10 text-success font-bold hover:bg-success/20 transition">
                                              <Phone className="w-3 h-3" /> Call
                                            </a>
                                            <a href={`https://wa.me/${c.contact_number.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-success/10 text-success font-bold hover:bg-success/20 transition">
                                              <MessageCircle className="w-3 h-3" /> WhatsApp
                                            </a>
                                          </div>
                                        ) : (
                                          <span className="text-[10px] text-muted-foreground">No phone</span>
                                        )}
                                      </div>
                                    ))}
                                    {showOfficials && officials.length > 0 && (
                                      <>
                                        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mt-2">Officials</div>
                                        {officials.map((o, i) => (
                                          <div key={`${o.id}-${o.role}-${i}`} className="flex items-center gap-2 text-xs">
                                            <span className="font-bold text-soft min-w-0 truncate flex-1">
                                              {o.name} <span className="text-[10px] text-muted-foreground">({o.role})</span>
                                            </span>
                                            {o.contact_number ? (
                                              <div className="flex items-center gap-1.5 shrink-0">
                                                <a href={`tel:${o.contact_number}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-success/10 text-success font-bold hover:bg-success/20 transition">
                                                  <Phone className="w-3 h-3" /> Call
                                                </a>
                                                <a href={`https://wa.me/${o.contact_number.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-success/10 text-success font-bold hover:bg-success/20 transition">
                                                  <MessageCircle className="w-3 h-3" /> WhatsApp
                                                </a>
                                              </div>
                                            ) : (
                                              <span className="text-[10px] text-muted-foreground">No phone</span>
                                            )}
                                          </div>
                                        ))}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Poll Card (Compact) */}
                          {m.match_code && (
                            <div className="mt-2 pt-2 border-t border-border/50 print:hidden">
                              <MatchPredictionCard
                                compact
                                matchId={m.id}
                                t1Label={m.team1_label ?? "TBD"}
                                t2Label={m.team2_label ?? "TBD"}
                                hasStarted={isLive || isCompleted}
                                myPick={picks[m.id]}
                                profileId={profile?.id}
                                onPick={(team) => handlePick(m.id, team)}
                                isResultsRevealed={isLive || !!revealedMatchIds[m.id]}
                                isAdmin={isAdmin}
                                onToggleRevealResults={() => handleToggleReveal(m.id)}
                              />
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-4">
        {/* Date filter dropdown */}
        <div className="relative inline-block">
          <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
          <select
            value={activeDate}
            onChange={(e) => setActiveDate(e.target.value)}
            className="pl-9 pr-10 py-1.5 rounded-xl text-sm font-black transition-all bg-muted/80 text-soft border border-border-strong hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer"
          >
            {dates.map((date) => (
              <option key={date} value={date}>
                {date === "ALL" ? "All Dates" : date}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
        </div>
        
        <div className="h-6 w-px bg-muted hidden sm:block" />

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-xl text-sm font-black transition-all border ${
              activeCategory === cat
                ? "bg-primary text-primary-foreground border-primary shadow"
                : "border-border-strong text-muted-foreground hover:border-primary"
            }`}>
            {cat}
          </button>
        ))}
        </div>
      </div>

      {(isAdmin || myRoles.size > 0) && !tournamentOver && (() => {
        const q = contactSearch.toLowerCase();
        const filteredOfficials = q ? officials.filter(o => o.name.toLowerCase().includes(q) || o.contact_number?.includes(q)) : officials;
        const allPlayers = Object.values(contactMap);
        const filteredPlayers = q ? allPlayers.filter(c => c.name.toLowerCase().includes(q) || c.contact_number?.includes(q)) : allPlayers;
        return (
          <div className="mt-1">
            <button
              onClick={() => { setShowAllContacts(!showAllContacts); setContactSearch(""); }}
              className="flex items-center gap-1.5 text-[11px] font-bold text-success hover:text-success/80 transition px-2 py-1 rounded-lg bg-success/10 hover:bg-success/15"
            >
              <Phone className="w-3 h-3" />
              {showAllContacts ? "Hide Contacts" : "All Contacts"}
              {showAllContacts ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showAllContacts && (
              <div className="mt-2 rounded-xl border border-success/40 bg-card p-3 shadow-sm">
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Search name or number…"
                  className="w-full text-xs font-bold px-3 py-2 mb-2 rounded-lg border border-border-strong bg-muted outline-none focus:ring-1 focus:ring-success"
                />
                {filteredOfficials.length === 0 && filteredPlayers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">{q ? "No matches." : "No contacts loaded yet."}</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {filteredOfficials.length > 0 && (
                      <div>
                        <h5 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">Officials</h5>
                        <div className="space-y-0.5">
                          {filteredOfficials.map((o) => (
                            <div key={o.id + o.role} className="flex items-center gap-2 text-xs py-1 px-1">
                              <span className="flex-1 font-bold text-soft truncate">{o.name} {o.role && <span className="text-muted-foreground font-normal">· {o.role}</span>}</span>
                              {o.contact_number ? (
                                <a href={`tel:${o.contact_number}`} className="font-mono text-success shrink-0">{o.contact_number}</a>
                              ) : (
                                <span className="text-muted-foreground italic text-[10px] shrink-0">no phone</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {filteredPlayers.length > 0 && (
                      <div>
                        <h5 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">Players</h5>
                        <div className="space-y-0.5">
                          {filteredPlayers.map((c) => (
                            <div key={c.id} className="flex items-center gap-2 text-xs py-1 px-1">
                              <span className="flex-1 font-bold text-soft truncate">{c.name}</span>
                              {c.contact_number ? (
                                <a href={`tel:${c.contact_number}`} className="font-mono text-success shrink-0">{c.contact_number}</a>
                              ) : (
                                <span className="text-muted-foreground italic text-[10px] shrink-0">no phone</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {filtered.length > 0 ? (
        <div className="bg-card/50 rounded-3xl p-1 sm:p-2">
          {renderMatchList(filtered)}
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-3xl border border-border shadow-sm">
          <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-black text-soft">No matches found</h3>
          <p className="text-sm text-muted-foreground mt-1">Try changing your filters.</p>
        </div>
      )}
    </div>
  );
}
