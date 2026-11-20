import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { tournamentService } from "@/services/tournamentService";
import { useAuth } from "@/contexts/AuthContext";
import { type CertificateInput, PLACEMENT_META, certificateWording, expandCategory } from "@/lib/certificate";
import { computeMyCertificates } from "@/lib/myCertificates";
import { CertificateDialog } from "./CertificateDialog";

/**
 * "My certificates" for a finished tournament: podium, participation and
 * officiating certificates for the signed-in user, each downloadable.
 */
export function MyCertificatesCard({ tournament }: { tournament: { id: string; name: string; status: string; start_date?: string | null; created_by?: string | null } | null }) {
  const { profile } = useAuth();
  const uid = profile?.id;
  const finished = tournament?.status === "completed" || tournament?.status === "archived";
  const [open, setOpen] = useState<CertificateInput | null>(null);
  const tournamentId = tournament?.id ?? "";

  const { data: certs = [] } = useQuery({
    queryKey: ["my-certificates", tournament?.id, uid, tournament?.created_by === uid],
    enabled: !!uid && !!tournament?.id && finished,
    queryFn: async () => {
      const { matches, officials } = await tournamentService.fetchPlayerCertificatesMatchesAndOfficials(
        tournament!.id,
        uid!,
      );
      return computeMyCertificates({
        uid: uid!,
        name: profile?.full_name || "Player",
        tournamentName: tournament!.name,
        date: tournament!.start_date ?? undefined,
        matches: (matches ?? []) as any,
        officialRoles: [
          ...(officials ?? []).map((o: any) => o.role).filter(Boolean),
          // The creator is the organiser even if not listed under Officials.
          ...(tournament!.created_by === uid ? ["ORGANIZER"] : []),
        ],
      });
    },
  });

  if (!finished || !certs.length) return null;

  return (
    <section className="mb-6 rounded-3xl border border-gold/30 bg-gold/5 p-4">
      <h3 className="flex items-center gap-2 text-sm font-black mb-3">
        <Award className="w-4 h-4 text-gold" /> My certificates
      </h3>
      <ul className="grid sm:grid-cols-2 gap-2">
        {certs.map((c, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => setOpen(c)}
              className="w-full text-left flex items-center gap-3 rounded-2xl border border-border bg-background/60 px-3 py-2.5 hover:border-gold/60 transition"
            >
              <span className="text-2xl" aria-hidden>{PLACEMENT_META[c.placement].medal}</span>
              <span className="min-w-0">
                <span className="block text-sm font-black truncate">{certificateWording(c).highlight}</span>
                <span className="block text-xs text-muted-foreground truncate">{expandCategory(c.category)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <CertificateDialog input={open} tournamentId={tournamentId} onClose={() => setOpen(null)} />
    </section>
  );
}
