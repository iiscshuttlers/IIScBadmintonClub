import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronRight, 
  Smartphone, 
  Globe, 
  Activity, 
  MonitorPlay, 
  LayoutDashboard,
  User,
  Settings,
  Trophy,
  ActivitySquare,
  ShieldAlert,
  BrainCircuit,
  Eye,
  Crosshair,
  Volume2,
  Video,
  ListTodo
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoModal } from "@/components/InfoModal";

const MAP_DATA = [
  {
    id: "nav",
    title: "Mobile Bottom Navigation",
    icon: Smartphone,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    children: [
      { 
        id: "home", 
        title: "Home", 
        icon: LayoutDashboard,
        isGroup: true,
        children: [
          { id: "home_auth", title: "Authentication", icon: User },
          { id: "home_landing", title: "Landing Page", icon: LayoutDashboard }
        ]
      },
      { 
        id: "pulse", 
        title: "Pulse (Social Feed & Live Events)", 
        icon: Activity,
        isGroup: true,
        children: [
          { id: "pulse_feed", title: "Global Match Feed", icon: Activity },
          { id: "pulse_tourney", title: "Tournament Archive", icon: Trophy },
          { id: "pulse_live", title: "Live Tournaments & Brackets", icon: ActivitySquare }
        ]
      },
      { 
        id: "hub", 
        title: "Hub (Live Courts & Info)", 
        icon: Globe,
        isGroup: true,
        children: [
          { id: "hub_courts", title: "Live Courts Dashboard", icon: Globe },
          { id: "hub_exchange", title: "Equipment Exchange", icon: LayoutDashboard },
          { id: "hub_contact", title: "Facilities & Contact Info", icon: Settings },
          { id: "hub_glossary", title: "Badminton Glossary", icon: ListTodo }
        ]
      },
      { 
        id: "legacy", 
        title: "Legacy (Archives)", 
        icon: Trophy,
        isGroup: true,
        children: [
          { id: "legacy_leaderboard", title: "Category Leaderboards", icon: Trophy },
          { id: "legacy_directory", title: "Player Directory", icon: User },
          { id: "legacy_hall", title: "Hall of Fame", icon: Trophy }
        ]
      },
      { 
        id: "menu", 
        title: "Menu Drawer", 
        icon: ListTodo,
        isGroup: true,
        children: [
          { id: "menu_profile", title: "My Profile", icon: User },
          { id: "menu_umpire", title: "Umpire Mode", icon: ShieldAlert },
          { id: "menu_buddies", title: "Buddies & Network", icon: User },
          { id: "menu_settings", title: "App Settings", icon: Settings },
          { id: "menu_admin", title: "Site Admin Control", icon: Settings }
        ]
      }
    ]
  },
  {
    id: "personal",
    title: "Personal Profile (Menu Drawer)",
    icon: User,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    children: [
      { id: "overview", title: "Stats Overview & ACWR", icon: ActivitySquare },
      { id: "matches", title: "Match History", icon: ListTodo },
      { id: "sensors", title: "Sensor Lab", icon: ActivitySquare, isGroup: true, children: [
        { id: "pocket", title: "Pocket Mode Motion Tracking", icon: Smartphone },
        { id: "haptics", title: "Danger Zone Heart Rate Haptics", icon: ShieldAlert },
        { id: "analytics", title: "AI Stroke Breakdown & Coaching", icon: BrainCircuit },
        { id: "ar", title: "AR 3D Replays", icon: Eye },
        { id: "highlights", title: "Auto-Highlights Engine", icon: Video },
        { id: "hawkeye", title: "Hawk-Eye Lite Line Calls", icon: Crosshair },
        { id: "path_tracing", title: "Path Tracing Wizard (Shuttlecock & Player)", icon: Activity },
        { id: "tension", title: "Acoustic String Tuner", icon: Volume2 },
        { id: "drills", title: "AI Shadow Footwork Drills", icon: BrainCircuit }
      ]}
    ]
  },
  {
    id: "standalone",
    title: "Standalone Routes",
    icon: Globe,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    children: [
      { id: "broadcast", title: "ESPN-Style Broadcast Overlay", icon: MonitorPlay },
      { 
        id: "admin", 
        title: "Site Administration Control Center", 
        icon: Settings,
        isGroup: true,
        children: [
          { id: "admin_dash", title: "Admin Dashboard", icon: LayoutDashboard },
          { id: "admin_elo", title: "ELO Audit & Recalc", icon: Trophy },
          { id: "admin_users", title: "User & Player Mgmt", icon: User },
          { id: "admin_content", title: "Content Management", icon: Settings },
          { id: "admin_logs", title: "Activity Logs", icon: Activity },
          { id: "admin_settings", title: "System Settings", icon: Settings },
          { id: "admin_guests", title: "Guest Player Mgmt", icon: User },
          { id: "admin_maint", title: "Maintenance Mode", icon: ShieldAlert }
        ]
      },
      { 
        id: "tourney", 
        title: "Tournament Management", 
        icon: Trophy,
        isGroup: true,
        children: [
          { id: "tourney_brackets", title: "Bracket Generation", icon: Trophy },
          { id: "tourney_live", title: "Live Scoring", icon: Activity },
          { id: "tourney_history", title: "Tournament History", icon: ListTodo }
        ]
      }
    ]
  },
  {
    id: "android",
    title: "Native Android Layer (Capacitor & Java)",
    icon: Smartphone,
    color: "text-green-600 dark:text-green-500",
    bg: "bg-green-500/10",
    children: [
      { id: "android_tv", title: "Smart TV Scoreboard", icon: MonitorPlay },
      { id: "android_overlay", title: "Floating Score Overlay", icon: LayoutDashboard },
      { id: "android_bg", title: "Umpire Background Service", icon: Activity },
      { id: "android_lock", title: "Lock-Screen Scoring", icon: ShieldAlert },
      { id: "android_alarms", title: "Exact Match Alarms", icon: ActivitySquare },
      { id: "android_pip", title: "Picture-in-Picture Umpire", icon: Video },
      { id: "android_motion", title: "Hardware Motion Tracking", icon: ActivitySquare },
      { id: "android_widget", title: "Home Screen Score Widget", icon: LayoutDashboard },
      { id: "android_geo", title: "Gymkhana Geofence", icon: Globe },
      { id: "android_qs", title: "Quick Settings Tile", icon: Settings }
    ]
  },
  {
    id: "backend",
    title: "Backend & Data Domains (Supabase)",
    icon: BrainCircuit,
    color: "text-orange-600 dark:text-orange-500",
    bg: "bg-orange-500/10",
    children: [
      { id: "be_match", title: "Match Engine & Officiating", icon: Activity },
      { id: "be_elo", title: "ELO, Tournaments & Records", icon: Trophy },
      { id: "be_health", title: "Player Health & Biometrics", icon: ActivitySquare },
      { id: "be_teams", title: "Teams, Guests & Endorsements", icon: User },
      { id: "be_market", title: "Marketplace", icon: Globe },
      { id: "be_venue", title: "Venue & Presence Tracking", icon: Globe },
      { id: "be_social", title: "Social & Notifications", icon: Activity }
    ]
  },
  {
    id: "platform",
    title: "Platform & Global Features",
    icon: Globe,
    color: "text-cyan-600 dark:text-cyan-500",
    bg: "bg-cyan-500/10",
    children: [
      { id: "plat_pwa", title: "PWA Offline Support", icon: Smartphone },
      { id: "plat_push", title: "Push Notifications", icon: Activity },
      { id: "plat_qr", title: "QR Code Scanning", icon: Smartphone },
      { id: "plat_search", title: "Global Search", icon: Globe },
      { id: "plat_onboard", title: "Onboarding Tour", icon: Eye },
      { id: "plat_auth", title: "Authentication & Security", icon: ShieldAlert },
      { id: "plat_media", title: "Content & Media (Gallery/Video)", icon: Video }
    ]
  }
];

export function AppArchitectureMap() {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    nav: true,
    personal: true,
    standalone: true,
    sensors: true,
    android: false,
    backend: false,
    platform: false
  });

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderNode = (node: any, level: number = 0) => {
    const isExpanded = expandedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;
    const Icon = node.icon;

    return (
      <div key={node.id} className="relative">
        {/* Connection Line */}
        {level > 0 && (
          <div className="absolute left-[-16px] top-[24px] w-4 h-px bg-slate-200 dark:bg-slate-700" />
        )}
        
        {/* Node */}
        <div 
          onClick={() => hasChildren && toggleNode(node.id)}
          className={cn(
            "flex items-center gap-3 p-3 rounded-xl border mb-3 transition-all",
            hasChildren ? "cursor-pointer hover:border-primary/50" : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800",
            level === 0 ? "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700" : ""
          )}
        >
          {Icon && (
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg",
              node.bg || "bg-slate-100 dark:bg-slate-800",
              node.color || "text-slate-500"
            )}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          
          <div className="flex-1 font-semibold text-sm text-slate-800 dark:text-slate-200">
            {node.title}
          </div>
          
          {hasChildren && (
            <div className={cn(
              "transition-transform duration-200",
              isExpanded ? "rotate-90" : ""
            )}>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          )}
        </div>

        {/* Children */}
        {hasChildren && (
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden relative"
              >
                {/* Vertical connecting line */}
                <div className="absolute left-[15px] top-0 bottom-6 w-px bg-slate-200 dark:bg-slate-700" />
                
                <div className="pl-8">
                  {node.children.map((child: any) => renderNode(child, level + 1))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 max-w-3xl mx-auto w-full overflow-x-hidden">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Globe className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            App Architecture
            <InfoModal
              title="APP ARCHITECTURE"
              items={[
                { badge: "USAGE", title: "How to use", desc: "Click through the visual accordion menu to map out the exact navigational flow of the app (e.g., what pages are nested under the Pulse tab vs the Hub tab)." },
                { badge: "LOGIC", title: "How it works", desc: "It acts as a static blueprint of the frontend route tree. It uses Recursive React Rendering and framer-motion to smoothly animate the expansion." }
              ]}
            />
          </h2>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest"><span className="normal-case">IISc</span> Badminton Ecosystem</p>
        </div>
      </div>
      
      <div className="space-y-2">
        {MAP_DATA.map(node => renderNode(node))}
      </div>
    </div>
  );
}
