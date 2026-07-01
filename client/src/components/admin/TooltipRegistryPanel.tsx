import { motion } from "framer-motion";
import { Info, HelpCircle, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function TooltipRegistryPanel() {
  const tooltips = [
    { page: "Admin Dashboard", location: "Feature Cards (AdminAllFeaturesPanel)", desc: "Explains what each individual site feature does." },
    { page: "Admin Dashboard", location: "All Features Header", desc: "Explains Active, Beta, and Coming Soon status badges." },
    { page: "Admin Dashboard", location: "Settings (Maintenance Mode)", desc: "Explains site-wide banner and restriction of logging matches." },
    { page: "Admin Dashboard", location: "Settings (ELO Config)", desc: "Explains K-factors and multipliers for ELO calculations." },
    { page: "Admin Dashboard", location: "ELO Audit Panel", desc: "Explains ELO calculations and expected win rates." },
    { page: "Admin Dashboard", location: "Dispute Panel", desc: "Explains dispute resolution steps for match conflicts." },
    { page: "Admin Dashboard", location: "Guest Players Panel", desc: "Explains guest profiles and merging mechanics." },
    { page: "Admin Dashboard", location: "Tournament Manager", desc: "Explains how the tournament creation pipeline works." },
    { page: "Match Logging", location: "Log Match Header", desc: "Explains offline Gym Mode and score validation requirements." },
    { page: "Player Profile", location: "Overall Stats Header", desc: "Distinguishes between overall stats vs friendly/tournament stats." },
    { page: "Player Profile", location: "Equipment Arsenal Header", desc: "Details the rackets, strings, shoes, and apparel used." },
    { page: "Player Profile", location: "ELO Journey (Ranking Tab)", desc: "Explains the ELO Tier system and progression." },
    { page: "Doubles Pair Profile", location: "Hero Section Header", desc: "Explains that these stats only apply when this pair teams up." },
    { page: "Find & Lost", location: "Hero Section Header", desc: "Explains claiming items and owner notifications." },
    { page: "Marketplace", location: "Exchange Header", desc: "Suggests safe on-campus meeting practices for item exchange." },
    { page: "Events", location: "Live Events Header", desc: "Distinguishes between Live events and the Hall of Fame archive." },
    { page: "Activity Feed", location: "Court Utilization Chart", desc: "Explains the real-time court usage heatmap." },
    { page: "Home Page", location: "Quick Access Header", desc: "Explains the core navigation elements." },
    { page: "About Page", location: "Club Info Header", desc: "Explains the Support and Glossary tabs." },
    { page: "About Page", location: "Glossary Terms", desc: "Explains technical badminton and site terms in detail." },
    { page: "Tournament Schedule", location: "Match Schedule Header", desc: "Explains format filters and live match glowing borders." },
    { page: "Tournament Detail", location: "Results Archive Header", desc: "Clarifies that the page is a snapshot of completed results." },
    { page: "Players Directory", location: "ELO Rankings Tab", desc: "Explains how the ELO calculation works in detail." },
    { page: "Players Directory", location: "Ironman Endurance Tab", desc: "Explains the activity-based ranking and Ironman badge." },
    { page: "Compare Players", location: "H2H Rivalry Header", desc: "Explains how the AI Pundit analyzes match history." },
    { page: "Join/Login", location: "Member Portal Header", desc: "Explains the difference between authorized members and guests." },
    { page: "Hall of Fame", location: "Club Legends Header", desc: "Explains that the wall records all major club podium finishers." }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-primary" />
            Tooltip Registry
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            A comprehensive list of all {tooltips.length} InfoModal tooltips embedded across the platform.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tooltips.map((tip, idx) => (
          <Card key={idx} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="mt-1 w-8 h-8 rounded-full bg-primary/15 dark:bg-primary/30 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-primary dark:text-primary" />
                </div>
                <div>
                  <div className="text-xs font-bold text-primary dark:text-primary uppercase tracking-wider mb-1">
                    {tip.page}
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white mb-2 leading-tight">
                    {tip.location}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {tip.desc}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
