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
      <div className="bg-gradient-to-r from-teal-800 via-emerald-700 to-lime-600 text-on-accent py-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(132,204,22,0.15),transparent)] pointer-events-none" />
        <div className="absolute inset-0 hero-pattern opacity-50" />

        <div className="container mx-auto px-4 max-w-4xl relative z-10 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold mb-3 text-white/80">
            <ShieldCheck className="w-3.5 h-3.5 text-lime-300" /> Club Info
            <InfoModal
              title="ABOUT THE CLUB"
              items={[
                { badge: "HELP", title: "Support", desc: "If you have issues with the app, check the FAQ or contact the admins here." }
              ]}
              triggerClassName="text-white hover:text-lime-200"
            />
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-2 text-white" style={{ fontFamily: "Playfair Display, serif" }}>
            Club Hub
          </h1>
          <p className="text-sm md:text-base text-emerald-50 max-w-3xl mx-auto">
            Courts, contacts, and platform info — all in one place.
          </p>

          {/* View Toggle — 2×2 grid on mobile, single row on sm+ */}
          <div className="mt-6 flex justify-center w-full px-2">
            <div className="flex w-full sm:w-auto bg-black/20 backdrop-blur-md p-1 rounded-xl border border-black/10 gap-1 flex-wrap justify-center shadow-inner">
              {/* unified grid/flex for all screens */}
              <div className="flex flex-wrap sm:flex-nowrap justify-center gap-1">
                {[
                  { id: "lost-found", label: "Lost & Found", icon: <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> },
                  { id: "buy-sell",   label: "Buy & Sell",   icon: <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> },
                  { id: "facilities", label: "Facilities",   icon: <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> },
                  { id: "contact",    label: "Contact & FAQ",icon: <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> },
                ].map(({ id, label, icon }) => (
                  <button
                    key={id}
                    onClick={() => handleTabChange(id)}
                    className={`flex-auto sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-5 sm:py-2 rounded-lg text-xs sm:text-sm font-black transition-all ${
                      activeTab === id
                        ? "bg-slate-900 text-lime-400 shadow-md scale-100"
                        : "text-white/80 hover:text-white hover:bg-black/20 scale-95"
                    }`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
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
