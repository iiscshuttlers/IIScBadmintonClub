import { usePageMeta } from "@/hooks/usePageMeta";
import { MyMatchesTab } from "@/components/feed/MyMatchesTab";

export default function PersonalTrainPage() {
  usePageMeta({
    title: "Training",
    description: "Your training matches and activity.",
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground dark:text-foreground">Training</h1>
        <p className="text-muted-foreground dark:text-muted-foreground mt-2">
          Track and manage your matches
        </p>
      </div>
      <MyMatchesTab />
    </div>
  );
}
