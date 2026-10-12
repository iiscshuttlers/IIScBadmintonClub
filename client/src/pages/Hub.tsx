import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";
import { Info, MapPin, ShieldCheck, MonitorPlay } from "lucide-react";
import { InfoModal } from "@/components/InfoModal";
import { ContactSection } from "@/components/about/ContactSection";
import { FacilitiesSection } from "@/components/about/FacilitiesSection";
import { useState, useEffect, useCallback } from "react";
import { safeReplaceState, safePushState, safeGetSearchParams } from "@/lib/navUtils";
import ExchangeTab from "@/components/hub/ExchangeTab";
import FindLost from "@/pages/FindLost";
import { Store, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

export default function Hub() {
  usePageMeta({
    title: "About Us",
    description: "Learn more about IISc Badminton Club, our facilities, contact info, and platform features.",
  });

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    return ["lost-found", "buy-sell", "facilities", "contact"].includes(tab as string) ? tab : "facilities";
  });

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      setActiveTab(["lost-found", "buy-sell", "facilities", "contact"].includes(tab as string) ? tab as any : "facilities");
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
      <PageHeader
        badge="Club Info"
        badgeIcon={<ShieldCheck className="w-3.5 h-3.5 text-lime-300" />}
        title="Club"
        subtitle="Courts, contacts, and platform info — all in one place."
      >
        {/* View Toggle — 2×2 grid on mobile, single row on sm+ */}
        <div className="flex justify-center w-full px-2">
          <div className="flex w-full sm:w-auto bg-black/20 backdrop-blur-md p-1 rounded-2xl border border-black/10 gap-1 flex-wrap justify-center shadow-inner">
            <div className="flex flex-wrap sm:flex-nowrap justify-center gap-1">
              {[
                { id: "lost-found", label: "Lost & Found", icon: <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, activeClass: "bg-slate-900 text-orange-400 shadow-md scale-100" },
                { id: "buy-sell",   label: "Buy & Sell",   icon: <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, activeClass: "bg-slate-900 text-emerald-400 shadow-md scale-100" },
                { id: "facilities", label: "Facilities",   icon: <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, activeClass: "bg-slate-900 text-blue-400 shadow-md scale-100" },
                { id: "contact",    label: "Contact & FAQ",icon: <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, activeClass: "bg-slate-900 text-indigo-400 shadow-md scale-100" },
              ].map(({ id, label, icon, activeClass }) => (
                <Button
                  key={id}
                  variant="tab"
                  size="tab"
                  onClick={() => handleTabChange(id)}
                  className={
                    activeTab === id
                      ? activeClass
                      : "text-white/80 hover:text-white hover:bg-black/20 scale-95"
                  }
                >
                  {icon} {label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PageHeader>

      <div className="container mx-auto px-4 max-w-4xl pt-6">
        {activeTab === "contact" && <ContactSection />}
        {activeTab === "facilities" && <FacilitiesSection />}
        {activeTab === "buy-sell" && <ExchangeTab />}
        {activeTab === "lost-found" && <FindLost />}
      </div>
    </div>
  );
}
