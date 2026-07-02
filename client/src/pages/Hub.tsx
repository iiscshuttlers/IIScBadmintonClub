import { usePageMeta } from "@/hooks/usePageMeta";
import { Info, MapPin, BookOpen, ShieldCheck } from "lucide-react";
import { InfoModal } from "@/components/InfoModal";
import { ContactSection } from "@/components/about/ContactSection";
import { FacilitiesSection } from "@/components/about/FacilitiesSection";
import { GlossarySection } from "@/components/about/GlossarySection";
import { useHashTab } from "@/hooks/useHashTab";
import ExchangeTab from "@/components/hub/ExchangeTab";
import { Store } from "lucide-react";

export default function Hub() {
  usePageMeta({
    title: "About Us",
    description: "Learn more about IISc Badminton Club, our facilities, contact info, and platform features.",
  });

  const [activeTab, setActiveTab] = useHashTab(
    ["contact", "facilities", "glossary", "exchange"] as const,
    "contact"
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 lg:pb-8 font-sans selection:bg-primary/30">
      <div className="bg-gradient-to-r from-teal-800 via-emerald-700 to-lime-600 text-foreground py-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(132,204,22,0.15),transparent)] pointer-events-none" />
        <div className="absolute inset-0 hero-pattern opacity-50" />

        <div className="container mx-auto px-4 max-w-4xl relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-black uppercase tracking-widest mb-2">
            <ShieldCheck className="w-4 h-4 text-lime-300" /> Club Info
            <InfoModal
              title="ABOUT THE CLUB"
              items={[
                { badge: "HELP", title: "Support", desc: "If you have issues with the app, check the FAQ or contact the admins here." },
                { badge: "GUIDE", title: "Glossary", desc: "Confused by some terms? The glossary explains all the badminton jargon we use." }
              ]}
              triggerClassName="text-white hover:text-lime-200"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mb-1 tracking-tight text-white" style={{ fontFamily: "Playfair Display, serif" }}>
            Club Hub
          </h1>
          <p className="text-emerald-50 font-medium max-w-2xl mx-auto">
            Everything you need to know about our courts, reaching out to the team, and how the platform works.
          </p>

          {/* View Toggle */}
          <div className="mt-4 flex justify-center">
            <div className="flex bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 flex-wrap justify-center gap-1 sm:gap-0">
              <button
                onClick={() => setActiveTab("contact")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
                  activeTab === "contact"
                    ? "bg-white text-blue-900 shadow-md scale-100"
                    : "text-foreground/80 hover:text-foreground hover:bg-white/10 scale-95"
                }`}
              >
                <Info className="w-4 h-4" /> Contact & FAQ
              </button>
              <button
                onClick={() => setActiveTab("facilities")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
                  activeTab === "facilities"
                    ? "bg-white text-blue-900 shadow-md scale-100"
                    : "text-foreground/80 hover:text-foreground hover:bg-white/10 scale-95"
                }`}
              >
                <MapPin className="w-4 h-4" /> Facilities
              </button>
              <button
                onClick={() => setActiveTab("glossary")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
                  activeTab === "glossary"
                    ? "bg-white text-blue-900 shadow-md scale-100"
                    : "text-foreground/80 hover:text-foreground hover:bg-white/10 scale-95"
                }`}
              >
                <BookOpen className="w-4 h-4" /> Glossary
              </button>
              <button
                onClick={() => setActiveTab("exchange")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
                  activeTab === "exchange"
                    ? "bg-white text-blue-900 shadow-md scale-100"
                    : "text-foreground/80 hover:text-foreground hover:bg-white/10 scale-95"
                }`}
              >
                <Store className="w-4 h-4" /> Exchange
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full">
        {activeTab === "contact" && <ContactSection />}
        {activeTab === "facilities" && <FacilitiesSection />}
        {activeTab === "glossary" && <GlossarySection />}
        {activeTab === "exchange" && <ExchangeTab />}
      </div>
    </div>
  );
}
