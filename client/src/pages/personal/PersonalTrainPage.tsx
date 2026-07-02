import { usePageMeta } from "@/hooks/usePageMeta";
import { MyMatchesTab } from "@/components/feed/MyMatchesTab";

export default function PersonalTrainPage() {
  usePageMeta({
    title: "Matches",
    description: "Your matches and activity.",
  });

  return (
    <div className="container mx-auto px-4 py-3 max-w-4xl">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground dark:text-foreground">Matches</h1>
          <p className="text-muted-foreground dark:text-muted-foreground mt-1 text-sm">
            Track and manage your matches
          </p>
        </div>
      </div>
      <MyMatchesTab />
    </div>
  );
}
