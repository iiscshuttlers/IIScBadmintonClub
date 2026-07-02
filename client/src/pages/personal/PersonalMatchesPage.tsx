import { useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { MyMatchesTab } from "@/components/feed/MyMatchesTab";
import { ChallengeHubTab } from "@/components/feed/ChallengeHubTab";
import { WeeklyChallenges } from "@/components/feed/WeeklyChallenges";
import { Activity, Swords } from "lucide-react";

export default function PersonalMatchesPage() {
  usePageMeta({
    title: "Matches",
    description: "Your matches and activity.",
  });

  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<"my_matches" | "challenges">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("tab") === "challenges" ? "challenges" : "my_matches";
    }
    return "my_matches";
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground dark:text-foreground">Matches</h1>
        <p className="text-muted-foreground dark:text-muted-foreground mt-2">
          Track your matches and manage challenges
        </p>
      </div>

      <div className="flex justify-center gap-2 mb-8 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto hide-scrollbar w-full">
        <button
          onClick={() => setActiveTab("my_matches")}
          className={`flex items-center gap-2 px-4 py-3 font-semibold transition-colors rounded-xl sm:rounded-none sm:border-b-2 whitespace-nowrap ${
            activeTab === "my_matches"
              ? "bg-primary/10 sm:bg-transparent border-primary text-primary dark:text-primary"
              : "bg-slate-50 dark:bg-slate-800/50 sm:bg-transparent border-transparent text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground"
          }`}
        >
          <Activity className="w-4 h-4" />
          My Matches
        </button>
        <button
          onClick={() => setActiveTab("challenges")}
          className={`flex items-center gap-2 px-4 py-3 font-semibold transition-colors rounded-xl sm:rounded-none sm:border-b-2 whitespace-nowrap ${
            activeTab === "challenges"
              ? "bg-primary/10 sm:bg-transparent border-primary text-primary dark:text-primary"
              : "bg-slate-50 dark:bg-slate-800/50 sm:bg-transparent border-transparent text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground"
          }`}
        >
          <Swords className="w-4 h-4" />
          Challenges
        </button>
      </div>

      {activeTab === "my_matches" ? (
        <MyMatchesTab />
      ) : (
        <div className="space-y-6">
          <WeeklyChallenges />
          <ChallengeHubTab currentUser={session?.user} />
        </div>
      )}
    </div>
  );
}
