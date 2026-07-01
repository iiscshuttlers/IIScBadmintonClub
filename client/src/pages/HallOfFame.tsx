import { WinnersWallSection } from "@/components/events/WinnersWallSection";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Trophy } from "lucide-react";
import { InfoModal } from "@/components/InfoModal";

export default function HallOfFame() {
  usePageMeta({
    title: "Hall of Fame",
    description: "Honoring the champions and top performers of IISc Badminton Club.",
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      <section className="bg-gradient-to-tr from-teal-800 via-emerald-700 to-lime-600 text-foreground py-12 relative overflow-hidden">
        <div className="absolute inset-0 hero-pattern" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/80 px-4 py-2 rounded-full text-sm font-semibold mb-5">
            <Trophy className="w-4 h-4 text-amber-300" />
            Club Legends
            <InfoModal
              title="HALL OF FAME"
              items={[
                { badge: "HONOR", title: "Legacy", desc: "This wall records the ultimate podium finishers across all major club tournaments." }
              ]}
              triggerClassName="text-white hover:text-amber-100"
            />
          </div>
          <h1
            className="text-5xl md:text-6xl font-black mb-5 text-white"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Hall of Fame
          </h1>
          <p className="text-xl text-emerald-50 max-w-2xl mx-auto leading-relaxed">
            Honoring the champions, the fighters, and the top performers of IISc Badminton Club.
          </p>
        </div>
      </section>

      <WinnersWallSection />
    </div>
  );
}
