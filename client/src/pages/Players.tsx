import { useEffect, useState } from "react";
import { Users, Trophy, ListOrdered } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionTabs, type SectionTab } from "@/components/ui/SectionTabs";
import { GuestGate } from "@/components/GuestGate";
import { DirectoryWrapper } from "@/components/players-directory/DirectoryWrapper";
import { WinnersWallSection } from "@/components/events/WinnersWallSection";
import { RecordsBook } from "@/components/legacy/RecordsBook";
import { useAuth } from "@/contexts/AuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useSectionParams } from "@/hooks/useSectionParams";
import { fetchClubSettings } from "@/services/feedService";

/**
 * Players: the member directory (ranked by Elo, with filters and H2H), the
 * champions wall and the records book. Directory came from Pulse, Champions
 * and Records from Legacy (nav regroup, 21 Nov 2026). Champions and Records
 * are public; the directory is for signed-in members.
 */

type PlayersTab = "directory" | "champions" | "records";

const TABS: readonly SectionTab<PlayersTab>[] = [
  { id: "directory", label: "Directory", icon: <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> },
  { id: "champions", label: "Champions", icon: <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> },
  { id: "records", label: "Records", icon: <ListOrdered className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> },
];

function parsePlayersTab(params: URLSearchParams): PlayersTab | null {
  const tab = params.get("tab");
  return TABS.some((t) => t.id === tab) ? (tab as PlayersTab) : null;
}

export default function Players() {
  usePageMeta({
    title: "Players",
    description: "IISc Badminton Club players: the member directory and rankings, tournament champions and club records.",
  });
  const { session, isInitializing, isAdmin } = useAuth();
  const [params, update] = useSectionParams();

  // No tab in the URL: members land on the directory, visitors on Champions.
  const activeTab: PlayersTab = parsePlayersTab(params) ?? (session || isInitializing ? "directory" : "champions");

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      <PageHeader
        badge="Players"
        badgeIcon={<Users className="w-3.5 h-3.5 text-primary" />}
        title="Players"
        subtitle="Find members, see who's on top, and the club's champions and records."
      >
        <SectionTabs
          label="Players sections"
          tabs={TABS}
          active={activeTab}
          // Directory filters (dir_*) only belong to the directory.
          onChange={(tab) => update({ tab, ...(tab === "directory" ? {} : clearDirectoryParams(params)) })}
        />
      </PageHeader>

      {activeTab === "directory" && (
        <GuestGate feature="Players Directory" description="Search club members, compare players and see the Elo rankings.">
          <DirectoryGate isAdmin={isAdmin} />
        </GuestGate>
      )}
      {activeTab === "champions" && <WinnersWallSection />}
      {activeTab === "records" && <RecordsBook />}
    </div>
  );
}

function clearDirectoryParams(params: URLSearchParams): Record<string, null> {
  const out: Record<string, null> = {};
  params.forEach((_v, key) => {
    if (key.startsWith("dir_")) out[key] = null;
  });
  return out;
}

/** Admins can hide the directory from members (club setting showPlayerDirectory). */
function DirectoryGate({ isAdmin }: { isAdmin: boolean }) {
  const [shown, setShown] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchClubSettings()
      .then((s: any) => { if (!cancelled) setShown(!!s?.showPlayerDirectory); })
      .catch(() => { if (!cancelled) setShown(false); });
    return () => { cancelled = true; };
  }, []);

  if (isAdmin || shown) return <DirectoryWrapper />;
  if (shown === null) return <div className="h-40" aria-hidden />;
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center mt-8">
      <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
        <Users className="w-12 h-12 text-muted-foreground" aria-hidden />
      </div>
      <h2 className="text-3xl font-black text-foreground mb-4">Directory hidden</h2>
      <p className="text-lg text-muted-foreground max-w-md">
        The player directory is currently hidden by the club administrators.
      </p>
    </div>
  );
}
