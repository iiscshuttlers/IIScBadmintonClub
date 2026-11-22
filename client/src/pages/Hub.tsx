import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useSectionParams } from "@/hooks/useSectionParams";
import { Info, MapPin, ShieldCheck, Store, Search, Radio, Calendar, Camera } from "lucide-react";
import { ClubAbout } from "@/components/about/ClubAbout";
import { ContactSection } from "@/components/about/ContactSection";
import { FacilitiesSection } from "@/components/about/FacilitiesSection";
import { AnnouncementsTab } from "@/components/hub/AnnouncementsTab";
import { EventsTab } from "@/components/hub/EventsTab";
import ExchangeTab from "@/components/hub/ExchangeTab";
import FindLost from "@/pages/FindLost";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionTabs, type SectionTab } from "@/components/ui/SectionTabs";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { GuestGate } from "@/components/GuestGate";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

/** The gallery is big; load it only when its tab opens. */
const Gallery = lazy(() => import("@/pages/Gallery"));

/**
 * Club: everything about the club itself. News (was Pulse → Feed),
 * Calendar (was Pulse → Calendar), Gallery (was Legacy → Albums), Courts,
 * Market (Buy & Sell + Lost & Found) and About & Contact.
 * About and Gallery are public; the rest are for signed-in members.
 */

type ClubTab = "news" | "calendar" | "gallery" | "facilities" | "market" | "contact";
type MarketSub = "lost-found" | "buy-sell";

const TABS: readonly SectionTab<ClubTab>[] = [
  { id: "news", label: "News", icon: <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> },
  { id: "calendar", label: "Calendar", icon: <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> },
  { id: "gallery", label: "Gallery", icon: <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> },
  { id: "facilities", label: "Courts", icon: <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> },
  { id: "market", label: "Market", icon: <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> },
  { id: "contact", label: "About", icon: <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> },
];

const PUBLIC_TABS: readonly ClubTab[] = ["gallery", "contact"];

/** Old and alternative `?tab=` values → canonical tab (+ market sub). */
const ALIASES: Record<string, { tab: ClubTab; sub?: MarketSub }> = {
  about: { tab: "contact" },
  feed: { tab: "news" },
  announcements: { tab: "news" },
  events: { tab: "calendar" },
  albums: { tab: "gallery" },
  photos: { tab: "gallery" },
  videos: { tab: "gallery" },
  legacy: { tab: "gallery" },
  courts: { tab: "facilities" },
  "buy-sell": { tab: "market", sub: "buy-sell" },
  "lost-found": { tab: "market", sub: "lost-found" },
};

function parseClubTab(params: URLSearchParams): ClubTab | null {
  const raw = params.get("tab");
  if (!raw) return null;
  if (raw === "exchange") return "market"; // old /marketplace, /exchange, /find-lost redirects
  if (TABS.some((t) => t.id === raw)) return raw as ClubTab;
  return ALIASES[raw]?.tab ?? null;
}

function parseMarketSub(params: URLSearchParams): MarketSub {
  const raw = params.get("tab");
  const sub = params.get("sub");
  if (raw && ALIASES[raw]?.sub) return ALIASES[raw].sub!;
  return sub === "buy-sell" ? "buy-sell" : "lost-found";
}

export default function Hub() {
  usePageMeta({
    title: "Club",
    description: "IISc Badminton Club: news, court calendar, gallery, courts, the club marketplace, and who we are.",
  });
  const { session, isInitializing } = useAuth();
  const [params, update] = useSectionParams();

  const chosenTab = parseClubTab(params);
  // No tab in the URL: members land on News, visitors on About (always open to them).
  const activeTab: ClubTab = chosenTab ?? (session || isInitializing ? "news" : "contact");
  const marketSub = parseMarketSub(params);

  // Rewrite an alias (?tab=about, ?tab=buy-sell, ?tab=exchange&sub=…) to the canonical URL.
  const rawTab = params.get("tab");
  useEffect(() => {
    if (!chosenTab || rawTab === chosenTab) return;
    update({ tab: chosenTab, sub: chosenTab === "market" ? marketSub : null }, { replace: true });
  }, [chosenTab, rawTab, marketSub, update]);

  const selectTab = (tab: ClubTab) =>
    update({ tab, sub: tab === "market" ? marketSub : null, filter: null, photo: null });

  const label = TABS.find((t) => t.id === activeTab)?.label ?? "Club";
  const gated = !PUBLIC_TABS.includes(activeTab);

  const body = (() => {
    switch (activeTab) {
      case "news":
        return <NewsTab />;
      case "calendar":
        return <EventsTab />;
      case "gallery":
        return (
          <Suspense fallback={<PageSkeleton />}>
            <Gallery />
          </Suspense>
        );
      case "facilities":
        return (
          <div className="container mx-auto px-4 max-w-4xl pt-6">
            <FacilitiesSection />
          </div>
        );
      case "market":
        return (
          <div className="container mx-auto px-4 max-w-4xl pt-6">
            <MarketSwitch active={marketSub} onChange={(sub) => update({ tab: "market", sub })} />
            {marketSub === "buy-sell" ? <ExchangeTab /> : <FindLost />}
          </div>
        );
      case "contact":
        return (
          <div className="container mx-auto px-4 max-w-4xl pt-6">
            <ClubAbout />
            <ContactSection />
          </div>
        );
    }
  })();

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8 font-sans selection:bg-primary/30">
      <PageHeader
        badge="Club Info"
        badgeIcon={<ShieldCheck className="w-3.5 h-3.5 text-primary" />}
        title="Club"
        subtitle="News, the court calendar, our gallery, courts, the club market, and who we are."
      >
        <SectionTabs label="Club sections" tabs={TABS} active={activeTab} onChange={selectTab} />
      </PageHeader>

      {gated ? <GuestGate feature={label}>{body}</GuestGate> : body}
    </div>
  );
}

/** News is the old Pulse feed; opening it clears the nav's unread dot. */
function NewsTab() {
  useEffect(() => {
    try {
      localStorage.setItem("iisc_announcements_last_seen", Date.now().toString());
    } catch { /* storage blocked: the dot just stays */ }
    window.dispatchEvent(new Event("announcements-read"));
  }, []);
  return <AnnouncementsTab />;
}

function MarketSwitch({ active, onChange }: { active: MarketSub; onChange: (sub: MarketSub) => void }) {
  const items: { id: MarketSub; label: string; icon: ReactNode }[] = [
    { id: "lost-found", label: "Lost & Found", icon: <Search className="w-3.5 h-3.5" aria-hidden /> },
    { id: "buy-sell", label: "Buy & Sell", icon: <Store className="w-3.5 h-3.5" aria-hidden /> },
  ];
  return (
    <div role="group" aria-label="Market" className="flex gap-2 mb-4">
      {items.map(({ id, label, icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={active === id}
          className={cn(
            "inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-full text-xs font-black border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            active === id
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-soft border-border hover:border-primary/50",
          )}
        >
          {icon} {label}
        </button>
      ))}
    </div>
  );
}
