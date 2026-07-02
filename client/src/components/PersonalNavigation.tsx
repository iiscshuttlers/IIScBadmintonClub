import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Home,
  Activity,
  TrendingUp,
  BarChart3,
  Users,
  Moon,
  Sun,
  LogOut,
  User,
  RotateCcw,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAppMode } from "@/contexts/AppModeContext";
import { useNavigationAuth } from "@/hooks/useNavigationAuth";
import { Avatar } from "@/components/ui/Avatar";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { Search } from "lucide-react";

const PERSONAL_NAV_ITEMS = [
  { path: "/personal", label: "Home", icon: Home },
  { path: "/personal/matches", label: "Matches", icon: Activity },
  { path: "/personal/growth", label: "Growth", icon: TrendingUp },
  { path: "/personal/stats", label: "Stats", icon: BarChart3 },
  { path: "/personal/circle", label: "Circle", icon: Users },
];

export function PersonalNavigation() {
  const [location, setLocation] = useLocation();
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { setMode } = useAppMode();
  const { isAdmin } = useNavigationAuth();

  const isActive = (path: string) => {
    if (path === "/" || path === "/personal") return location === path;
    return location.startsWith(path);
  };

  const handleBackToClub = () => {
    setMode("club");
    setLocation("/");
  };

  return (
    <>
      {/* ===== Desktop Sidebar ===== */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 border-r border-border bg-card z-50 py-6 px-4">
        {/* Logo / Brand & Actions */}
        <div className="flex flex-col gap-5 px-2 mb-8">
          <button
            onClick={() => {
              setMode("club");
              setLocation("/");
            }}
            className="flex items-center gap-3 group w-full"
          >
            <img
              src={`${import.meta.env.BASE_URL}iisc-logo.png`}
              alt="IISc Logo"
              className="h-9 w-auto object-contain flex-shrink-0 group-hover:scale-105 transition-transform"
            />
            <span className="font-bold text-[14px] tracking-tight text-foreground dark:text-foreground hidden xl:block whitespace-nowrap text-left">
              IISc Badminton Club
            </span>
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
              className="flex-1 flex items-center justify-start gap-2.5 px-3 py-2 rounded-xl text-muted-foreground dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors border border-transparent dark:border-slate-800"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
              <span className="text-xs font-semibold">Search...</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => setLocation("/admin")}
                className="flex items-center justify-center flex-shrink-0 p-2 rounded-xl text-violet-600 dark:text-violet-400 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors border border-transparent dark:border-slate-800"
                title="Site Admin"
              >
                <Shield className="w-4 h-4" />
              </button>
            )}
            {profile?.id && (
              <div className="flex items-center justify-center flex-shrink-0 bg-slate-100/50 dark:bg-slate-800/50 p-0.5 rounded-xl border border-transparent dark:border-slate-800">
                <NotificationsMenu currentUser={{ id: profile.id }} />
              </div>
            )}
          </div>
        </div>
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
                    : "text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
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
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all w-full"
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
            <Avatar src={profile?.avatar_url} name={profile?.full_name} size="sm" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-foreground dark:text-foreground truncate">{profile?.full_name ?? "Profile"}</p>
              <p className="text-xs text-muted-foreground dark:text-muted-foreground truncate">{profile?.email ?? ""}</p>
            </div>
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

      {/* ===== Mobile Top Header ===== */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top)] bg-background/95 backdrop-blur-md border-b border-border">
        <div className="h-12 flex items-center justify-between px-3">
        <button
          onClick={handleBackToClub}
          className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <img src={`${import.meta.env.BASE_URL}iisc-logo.png`} alt="Club" className="w-6 h-6 object-contain opacity-90" />
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </button>
          {profile?.id && (
            <div className="[&_button]:!w-8 [&_button]:!h-8 [&_button]:!flex [&_button]:!items-center [&_button]:!justify-center [&_button]:!rounded-full [&_svg]:!w-4 [&_svg]:!h-4">
              <NotificationsMenu currentUser={{ id: profile.id }} />
            </div>
          )}
        </div>
        </div>
      </div>

      {/* ===== Mobile Floating Tab Bar ===== */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bottom-nav pointer-events-none pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        {/* Solid background covering the safe area at the very bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[max(env(safe-area-inset-bottom),0.75rem)] bg-background pointer-events-auto" />
        
        <nav className="pointer-events-auto mx-3 mb-0 rounded-[1.4rem] border border-border bg-card/85 backdrop-blur-2xl shadow-[0_10px_40px_-8px_rgba(0,0,0,0.55)] dark:shadow-[0_10px_40px_-8px_rgba(0,0,0,0.8)] relative z-10">
          <div className="flex items-center justify-around h-[4.25rem] px-1">
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
                        active ? "text-primary dark:text-primary" : "text-muted-foreground dark:text-muted-foreground"
                      )}
                      strokeWidth={active ? 2.4 : 2}
                    />
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold tracking-tight transition-colors duration-200 truncate",
                      active ? "text-primary dark:text-primary" : "text-muted-foreground dark:text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                  {active && (
                    <motion.span
                      layoutId="tab-active-dot"
                      className="absolute bottom-1.5 w-1 h-1 rounded-full bg-primary dark:bg-primary"
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
                  isActive("/personal/me") ? "text-primary dark:text-primary" : "text-muted-foreground dark:text-muted-foreground"
                )}
              >
                Me
              </span>
              {isActive("/personal/me") && (
                <motion.span
                  layoutId="tab-active-dot"
                  className="absolute bottom-1.5 w-1 h-1 rounded-full bg-primary dark:bg-primary"
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
