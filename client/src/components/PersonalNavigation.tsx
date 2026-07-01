import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Home,
  Dumbbell,
  TrendingUp,
  BarChart3,
  Users,
  Moon,
  Sun,
  LogOut,
  User,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAppMode } from "@/contexts/AppModeContext";
import { Avatar } from "@/components/ui/Avatar";

const PERSONAL_NAV_ITEMS = [
  { path: "/personal", label: "Home", icon: Home },
  { path: "/personal/train", label: "Train", icon: Dumbbell },
  { path: "/personal/growth", label: "Growth", icon: TrendingUp },
  { path: "/personal/stats", label: "Stats", icon: BarChart3 },
  { path: "/personal/circle", label: "Circle", icon: Users },
];

export function PersonalNavigation() {
  const [location, setLocation] = useLocation();
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { setMode } = useAppMode();

  const isActive = (path: string) =>
    path === "/" ? location === "/" : location.startsWith(path);

  const handleBackToClub = () => {
    setMode("club");
    setLocation("/");
  };

  return (
    <>
      {/* ===== Desktop Sidebar ===== */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 border-r border-border bg-card z-50 py-6 px-4">
        {/* Logo / Brand */}
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-3 px-2 mb-9 group"
        >
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform">
            <span className="text-lg font-bold text-white">🏸</span>
          </div>
          <span className="font-bold text-xl text-slate-900 dark:text-white">
            Shuttlers
          </span>
        </button>

        {/* Nav links */}
        <nav className="flex flex-col gap-1 flex-1">
          {PERSONAL_NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = isActive(path);
            return (
              <button
                key={path}
                onClick={() => setLocation(path)}
                className={cn(
                  "relative flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold tracking-tight transition-all duration-200 w-full text-left",
                  active
                    ? "text-primary dark:text-primary bg-primary/10 dark:bg-primary/30"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-primary/15 dark:bg-primary/40 rounded-xl"
                    transition={{ type: "spring", bounce: 0.18, duration: 0.5 }}
                  />
                )}
                <Icon className={cn("w-5 h-5 relative z-10", active && "text-primary dark:text-primary")} />
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="flex flex-col gap-2 border-t border-border pt-4 mt-4">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all w-full"
          >
            {theme === "dark" ? (
              <>
                <Sun className="w-5 h-5" />
                Light Mode
              </>
            ) : (
              <>
                <Moon className="w-5 h-5" />
                Dark Mode
              </>
            )}
          </button>

          {/* Profile Button */}
          <button
            onClick={() => setLocation("/personal/me")}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all w-full",
              isActive("/personal/me") ? "bg-primary/10 dark:bg-primary/30" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
            )}
          >
            <Avatar src={profile?.avatar_url} name={profile?.name} size="sm" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{profile?.name ?? "Profile"}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 truncate">@{profile?.username ?? "user"}</p>
            </div>
          </button>

          {/* Back to Club Button */}
          <button
            onClick={handleBackToClub}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all w-full"
          >
            <RotateCcw className="w-5 h-5" />
            Back to Club
          </button>

          {/* Sign Out */}
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all w-full"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ===== Mobile Floating Tab Bar ===== */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bottom-nav pointer-events-none">
        <nav className="pointer-events-auto mx-3 mb-3 rounded-[1.4rem] border border-border bg-card/85 backdrop-blur-2xl shadow-[0_10px_40px_-8px_rgba(0,0,0,0.55)] dark:shadow-[0_10px_40px_-8px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-around h-[4.25rem] px-1.5">
            {PERSONAL_NAV_ITEMS.map(({ path, label, icon: Icon }) => {
              const active = isActive(path);
              return (
                <button
                  key={path}
                  onClick={() => setLocation(path)}
                  className="relative flex flex-col items-center justify-center gap-1 flex-1 h-full min-w-0"
                >
                  <span className="relative flex items-center justify-center w-11 h-8">
                    {active && (
                      <motion.span
                        layoutId="tab-active-pill"
                        className="absolute inset-0 rounded-full bg-primary/15"
                        transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                      />
                    )}
                    <Icon
                      className={cn(
                        "w-[1.35rem] h-[1.35rem] relative z-10 transition-colors duration-200",
                        active ? "text-primary dark:text-primary" : "text-slate-600 dark:text-slate-400"
                      )}
                      strokeWidth={active ? 2.4 : 2}
                    />
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold tracking-tight transition-colors duration-200 truncate",
                      active ? "text-primary dark:text-primary" : "text-slate-600 dark:text-slate-400"
                    )}
                  >
                    {label}
                  </span>
                  {active && (
                    <motion.span
                      layoutId="tab-active-dot"
                      className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary dark:bg-primary"
                      transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                    />
                  )}
                </button>
              );
            })}

            {/* Profile tab with avatar */}
            <button
              onClick={() => setLocation("/personal/me")}
              className="relative flex flex-col items-center justify-center gap-1 flex-1 h-full min-w-0"
            >
              <span className="relative flex items-center justify-center w-11 h-8">
                {isActive("/personal/me") && (
                  <motion.span
                    layoutId="tab-active-pill"
                    className="absolute inset-0 rounded-full bg-primary/15"
                    transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10">
                  <Avatar src={profile?.avatar_url} name={profile?.name} size="sm" />
                </span>
              </span>
              <span
                className={cn(
                  "text-[10px] font-semibold tracking-tight transition-colors duration-200 truncate",
                  isActive("/personal/me") ? "text-primary dark:text-primary" : "text-slate-600 dark:text-slate-400"
                )}
              >
                Me
              </span>
              {isActive("/personal/me") && (
                <motion.span
                  layoutId="tab-active-dot"
                  className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary dark:bg-primary"
                  transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                />
              )}
            </button>
          </div>
        </nav>
      </div>
    </>
  );
}
