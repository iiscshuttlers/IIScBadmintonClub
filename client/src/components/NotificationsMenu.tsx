import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Bell, Swords, UserPlus, Info, CheckCircle2, Sword, X, Trash2, BellRing, PackageSearch, Users, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { playSmashSound, playPointSound, playServeSound, playWhistleSound, playVictorySound } from "@/lib/sounds";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function NotificationsMenu({ currentUser }: { currentUser: any }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!currentUser) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error && data) {
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.is_read).length);
      }
    };

    fetchNotifications();

    window.addEventListener("notifications_changed", fetchNotifications);

    // Subscribe to new notifications
    const channel = supabase
      .channel(`notifications_channel_${currentUser.id}_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
          setUnreadCount((prev) => prev + 1);

          // Play sound based on notification type
          const type = payload.new.type || "";
          if (type === "match_confirmation") playVictorySound();
          else if (type === "new_match" || type === "match_logged") playServeSound();
          else if (type === "serve" || type === "kudos" || type === "buddy_request") playServeSound();
          else if (type === "elo_milestone" || type === "top10") playVictorySound();
          else playWhistleSound();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("notifications_changed", fetchNotifications);
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  const markAllAsRead = async () => {
    if (!currentUser || unreadCount === 0) return;
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", currentUser.id)
      .eq("is_read", false);
  };

  const markAsRead = async (id: string, is_read: boolean) => {
    if (is_read) return;
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  };

  const handleNotificationClick = (n: any) => {
    markAsRead(n.id, n.is_read);
    if (n.link) {
      setOpen(false);
      setLocation(n.link);
    }
  };

  const deleteNotification = async (e: React.MouseEvent, n: any) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    if (!n.is_read) setUnreadCount((prev) => Math.max(0, prev - 1));
    await supabase.from("notifications").delete().eq("id", n.id);
  };

  const clearAll = async () => {
    if (!currentUser || notifications.length === 0) return;
    setNotifications([]);
    setUnreadCount(0);
    await supabase.from("notifications").delete().eq("user_id", currentUser.id);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "challenge_received":
        return <Swords className="w-5 h-5 text-orange-500" />;
      case "match_logged":
      case "match_confirmation":
        return <Sword className="w-5 h-5 text-primary" />;
      case "buddy_request":
      case "buddy_acceptance":
        return <UserPlus className="w-5 h-5 text-violet-500" />;
      case "new_follower":
        return <Users className="w-5 h-5 text-sky-500" />;
      case "ping":
        return <BellRing className="w-5 h-5 text-amber-500" />;
      case "find_lost":
        return <PackageSearch className="w-5 h-5 text-indigo-500" />;
      case "achievement":
      case "milestone":
        return <Trophy className="w-5 h-5 text-amber-400" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={(o) => { setOpen(o); if (o) markAllAsRead(); }}>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 rounded-xl text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all mr-1">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border-2 border-white dark:border-slate-950"></span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-black text-slate-800 dark:text-foreground flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" /> Notifications
          </h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/15 dark:bg-primary/30 px-2 py-0.5 rounded-full">
                {unreadCount} New
              </span>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-rose-500 transition"
                title="Clear all notifications"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground dark:text-muted-foreground flex flex-col items-center">
              <CheckCircle2 className="w-8 h-8 text-slate-300 dark:text-muted-foreground mb-2" />
              <p className="font-bold text-sm">All caught up!</p>
              <p className="text-xs">You have no new notifications.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`group p-4 border-b border-slate-50 dark:border-slate-800/50 flex gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer ${
                  !n.is_read ? "bg-primary/10/50 dark:bg-primary/10" : ""
                }`}
              >
                <div className="mt-0.5">{getIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <h4 className="font-bold text-sm text-foreground dark:text-foreground leading-tight">
                      {n.title}
                    </h4>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                        {new Date(n.created_at).toLocaleString([], {
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      <button
                        onClick={(e) => deleteNotification(e, n)}
                        className="p-0.5 rounded-md text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
                        title="Remove notification"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground line-clamp-2">
                    {n.message}
                  </p>
                  {n.link && (
                    <span className="inline-block mt-2 text-xs font-bold text-primary group-hover:text-primary">
                      View details →
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
