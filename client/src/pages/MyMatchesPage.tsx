import { usePageMeta } from "@/hooks/usePageMeta";
import { MyMatchesTab } from "@/components/feed/MyMatchesTab";

export default function MyMatchesPage() {
  usePageMeta({
    title: "My Matches",
    description: "Your recent and upcoming matches.",
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Matches</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">Track all your matches and stats</p>
      </div>
      <MyMatchesTab />
    </div>
  );
}
