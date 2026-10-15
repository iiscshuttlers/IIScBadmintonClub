import { usePageMeta } from "@/hooks/usePageMeta";
import { MyMatchesTab } from "@/components/feed/MyMatchesTab";
import { PageHeader } from "@/components/ui/PageHeader";
import { Swords } from "lucide-react";

export default function MyMatchesPage() {
  usePageMeta({
    title: "My Matches",
    description: "Your recent and upcoming matches.",
  });

  return (
    <>
      <PageHeader
        compact
        badge="Tournaments"
        badgeIcon={<Swords className="w-3.5 h-3.5 text-primary" />}
        title="My Matches"
        subtitle="Your live, upcoming and completed tournament matches."
      />
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <MyMatchesTab />
      </div>
    </>
  );
}
