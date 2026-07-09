import { usePageMeta } from "@/hooks/usePageMeta";
import { Info, MapPin, BookOpen, ShieldCheck } from "lucide-react";
import { InfoModal } from "@/components/InfoModal";
import { ContactSection } from "@/components/about/ContactSection";
import { FacilitiesSection } from "@/components/about/FacilitiesSection";
import { GlossarySection } from "@/components/about/GlossarySection";
import { useState, useEffect, useCallback } from "react";
import { safeReplaceState, safePushState, safeGetSearchParams } from "@/lib/navUtils";
import ExchangeTab from "@/components/hub/ExchangeTab";
import { Store } from "lucide-react";

export default function Hub() {
  usePageMeta({
    title: "About Us",
    description: "Learn more about IISc Badminton Club, our facilities, contact info, and platform features.",
  });

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    return ["contact", "facilities", "glossary", "exchange"].includes(tab as string) ? tab : "contact";
  });

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      setActiveTab(["contact", "facilities", "glossary", "exchange"].includes(tab as string) ? tab as any : "contact");
    };
    window.addEventListener("popstate", handlePopState);
    
    // Ensure initial URL has the tab parameter set
    const params = safeGetSearchParams();
    if (params.get("tab") !== activeTab) {
      params.set("tab", activeTab);
      safeReplaceState(`${window.location.pathname}?${params.toString()}`);
    }
    
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeTab]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    const params = safeGetSearchParams();
    params.set("tab", tab);
    safePushState(`${window.location.pathname}?${params.toString()}`);
  }, []);

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
          <div className="mt-4 flex justify-center w-full px-2">
            <div className="grid grid-cols-2 sm:flex bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 sm:flex-wrap sm:justify-center gap-1.5 sm:gap-0 w-full sm:w-auto">
              <button
                onClick={() => handleTabChange("contact")}
                className={`flex w-full sm:w-auto items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-[13px] sm:text-sm font-black transition-all ${
                  activeTab === "contact"
                    ? "bg-white text-blue-900 shadow-md scale-100"
                    : "text-foreground/80 hover:text-foreground hover:bg-white/10 scale-95"
                }`}
              >
                <Info className="w-4 h-4" /> Contact & FAQ
              </button>
              <button
                onClick={() => handleTabChange("facilities")}
                className={`flex w-full sm:w-auto items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-[13px] sm:text-sm font-black transition-all ${
                  activeTab === "facilities"
                    ? "bg-white text-blue-900 shadow-md scale-100"
                    : "text-foreground/80 hover:text-foreground hover:bg-white/10 scale-95"
                }`}
              >
                <MapPin className="w-4 h-4" /> Facilities
              </button>
              <button
                onClick={() => handleTabChange("glossary")}
                className={`flex w-full sm:w-auto items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-[13px] sm:text-sm font-black transition-all ${
                  activeTab === "glossary"
                    ? "bg-white text-blue-900 shadow-md scale-100"
                    : "text-foreground/80 hover:text-foreground hover:bg-white/10 scale-95"
                }`}
              >
                <BookOpen className="w-4 h-4" /> Glossary
              </button>
              <button
                onClick={() => handleTabChange("exchange")}
                className={`flex w-full sm:w-auto items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-[13px] sm:text-sm font-black transition-all ${
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
