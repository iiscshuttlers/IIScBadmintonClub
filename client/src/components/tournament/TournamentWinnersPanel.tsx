import { useState } from "react";
import { Medal } from "lucide-react";
import { CertificateButton, CertificateDialog } from "@/components/tournament/CertificateDialog";
import type { CertificateInput, Placement } from "@/lib/certificate";
import type { TournamentWinner } from "@/data/tournamentArchive";

const PODIUM_PLACEMENTS: Placement[] = ["winner", "runnerUp", "third", "fourth"];

const PODIUM_CONFIGS = [
  { label: "🥇 Champion", border: "border-gold", bg: "bg-gold/10", text: "text-gold" },
  { label: "🥈 Runner-up", border: "border-silver/60", bg: "bg-silver/10", text: "text-silver" },
  { label: "🥉 Third Place", border: "border-bronze/60", bg: "bg-bronze/10", text: "text-bronze" },
  { label: "Fourth Place", border: "border-info/30", bg: "bg-info/10", text: "text-info" },
];

export interface TournamentWinnersPanelProps {
  tournament: {
    id?: string;
    name: string;
    startDate?: string;
    winners?: Array<Pick<TournamentWinner, "category" | "winner"> & Partial<TournamentWinner>>;
    podium?: string[];
  };
}

/**
 * Category winners, team podium and certificate download for a finished
 * tournament. Shared by the legacy archive page (`/events/:slug`) and the
 * canonical tournament Results tab.
 */
export function TournamentWinnersPanel({ tournament }: TournamentWinnersPanelProps) {
  const [certificate, setCertificate] = useState<CertificateInput | null>(null);
  const winners = tournament.winners;
  const podium = tournament.podium;
  if (!winners?.length && !podium?.length) return null;

  const grouped = (winners ?? []).reduce(
    (acc, curr) => {
      const [group, ...rest] = curr.category.includes(":") ? curr.category.split(":") : ["Overall", curr.category];
      const catName = rest.length > 0 ? rest.join(":").trim() : curr.category;
      (acc[group] ??= []).push({ ...curr, category: catName });
      return acc;
    },
    {} as Record<string, NonNullable<TournamentWinnersPanelProps["tournament"]["winners"]>>,
  );

  return (
    <>
      {winners && winners.length > 0 && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([group, results]) => (
            <div key={group} className="space-y-4">
              {group !== "Overall" && (
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-gradient-to-b from-warning to-secondary rounded-full" />
                  <h3 className="text-lg font-black text-foreground">{group}</h3>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((result) => {
                  const open = (recipient: string, placement: Placement) =>
                    setCertificate({
                      recipient,
                      placement,
                      category: group !== "Overall" ? `${group}: ${result.category}` : result.category,
                      tournamentName: tournament.name,
                      date: tournament.startDate ?? "",
                    });
                  const row = (name: string, placement: Placement, medal: string, cls: string, key?: string) => (
                    <p key={key} className={`${cls} flex items-center justify-between gap-2`}>
                      <span className="flex items-center gap-2 min-w-0">
                        {medal} <span className="truncate">{name}</span>
                      </span>
                      <CertificateButton recipient={name} placement={placement} onOpen={open} />
                    </p>
                  );
                  return (
                    <div
                      key={result.category}
                      className="rounded-2xl bg-card border border-warning/30 p-5 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-2 text-gold font-black text-xs uppercase tracking-wider mb-3">
                        <Medal className="w-3.5 h-3.5" />
                        {result.category}
                      </div>
                      {row(result.winner, "winner", "🥇", "font-bold text-foreground")}
                      {result.runnerUp && row(result.runnerUp, "runnerUp", "🥈", "mt-1 text-sm font-semibold text-muted-foreground")}
                      {result.bronze?.map((name) =>
                        row(name, "third", "🥉", "mt-1 text-sm font-semibold text-muted-foreground", `b-${name}`),
                      )}
                      {result.fourthPlace?.map((name) =>
                        row(name, "fourth", "4️⃣", "mt-1 text-sm font-semibold text-muted-foreground", `f-${name}`),
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {podium && podium.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1.5 h-6 bg-gradient-to-b from-warning to-secondary rounded-full" />
            <h3 className="text-lg font-black text-foreground">Final Standings</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {podium.map((team, index) => {
              const cfg = PODIUM_CONFIGS[index] ?? PODIUM_CONFIGS[3];
              return (
                <div key={team} className={`rounded-2xl border ${cfg.border} ${cfg.bg} px-5 py-4 hover:shadow-sm transition-shadow`}>
                  <p className={`text-xs font-black uppercase tracking-wider ${cfg.text}`}>{cfg.label}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-lg font-bold text-foreground">{team}</p>
                    <CertificateButton
                      recipient={team}
                      placement={PODIUM_PLACEMENTS[index] ?? "fourth"}
                      onOpen={(recipient, placement) =>
                        setCertificate({
                          recipient,
                          placement,
                          category: "Team Championship",
                          tournamentName: tournament.name,
                          date: tournament.startDate ?? "",
                        })
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <CertificateDialog input={certificate} tournamentId={tournament.id} onClose={() => setCertificate(null)} />
    </>
  );
}
