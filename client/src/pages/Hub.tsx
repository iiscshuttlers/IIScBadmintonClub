import { usePageMeta } from "@/hooks/usePageMeta";
import { Info, MapPin, ShieldCheck, MonitorPlay } from "lucide-react";
import { InfoModal } from "@/components/InfoModal";
import { ContactSection } from "@/components/about/ContactSection";
import { FacilitiesSection } from "@/components/about/FacilitiesSection";
import { useState, useEffect, useCallback } from "react";
import { safeReplaceState, safePushState, safeGetSearchParams } from "@/lib/navUtils";
import ExchangeTab from "@/components/hub/ExchangeTab";
import FindLost from "@/pages/FindLost";
import { Store, Search } from "lucide-react";

export default function Hub() {
  usePageMeta({
    title: "About Us",
    description: "Learn more about IISc Badminton Club, our facilities, contact info, and platform features.",
  });

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    return ["lost-found", "buy-sell", "facilities", "contact"].includes(tab as string) ? tab : "lost-found";
  });

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      setActiveTab(["lost-found", "buy-sell", "facilities", "contact"].includes(tab as string) ? tab as any : "lost-found");
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
      <div className="bg-gradient-to-r from-teal-800 via-emerald-700 to-lime-600 text-on-accent py-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(132,204,22,0.15),transparent)] pointer-events-none" />
        <div className="absolute inset-0 hero-pattern opacity-50" />

        <div className="container mx-auto px-4 max-w-4xl relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-black uppercase tracking-widest mb-2">
            <ShieldCheck className="w-4 h-4 text-lime-300" /> Club Info
            <InfoModal
              title="ABOUT THE CLUB"
              items={[
                { badge: "HELP", title: "Support", desc: "If you have issues with the app, check the FAQ or contact the admins here." }
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
            <div className="flex flex-wrap justify-center bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 gap-1.5 w-full sm:w-auto">
              <button
                onClick={() => handleTabChange("lost-found")}
                className={`flex w-full sm:w-auto flex-1 sm:flex-none items-center justify-center min-w-[140px] gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-[13px] sm:text-sm font-black transition-all ${
                  activeTab === "lost-found"
                    ? "bg-white text-blue-900 shadow-md scale-100"
                    : "text-foreground/80 hover:text-foreground hover:bg-white/10 scale-95"
                }`}
              >
                <Search className="w-4 h-4" /> Lost & Found
              </button>
              <button
                onClick={() => handleTabChange("buy-sell")}
                className={`flex w-full sm:w-auto flex-1 sm:flex-none items-center justify-center min-w-[140px] gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-[13px] sm:text-sm font-black transition-all ${
                  activeTab === "buy-sell"
                    ? "bg-white text-blue-900 shadow-md scale-100"
                    : "text-foreground/80 hover:text-foreground hover:bg-white/10 scale-95"
                }`}
              >
                <Store className="w-4 h-4" /> Buy & Sell
              </button>
              <button
                onClick={() => handleTabChange("facilities")}
                className={`flex w-full sm:w-auto flex-1 sm:flex-none items-center justify-center min-w-[140px] gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-[13px] sm:text-sm font-black transition-all ${
                  activeTab === "facilities"
                    ? "bg-white text-blue-900 shadow-md scale-100"
                    : "text-foreground/80 hover:text-foreground hover:bg-white/10 scale-95"
                }`}
              >
                <MapPin className="w-4 h-4" /> Facilities
              </button>
              <button
                onClick={() => handleTabChange("contact")}
                className={`flex w-full sm:w-auto flex-1 sm:flex-none items-center justify-center min-w-[140px] gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-[13px] sm:text-sm font-black transition-all ${
                  activeTab === "contact"
                    ? "bg-white text-blue-900 shadow-md scale-100"
                    : "text-foreground/80 hover:text-foreground hover:bg-white/10 scale-95"
                }`}
              >
                <Info className="w-4 h-4" /> Contact & FAQ
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl pt-6">
        {activeTab === "contact" && <ContactSection />}
        {activeTab === "facilities" && <FacilitiesSection />}
        {activeTab === "buy-sell" && <ExchangeTab />}
        {activeTab === "lost-found" && <FindLost />}
      </div>
    </div>
  );
}
