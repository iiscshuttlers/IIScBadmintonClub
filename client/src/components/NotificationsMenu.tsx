import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Bell, Swords, UserPlus, Info, CheckCircle2, Sword, X, Trash2, BellRing, PackageSearch, Users, Trophy, Timer, Images } from "lucide-react";
import {
  fetchNotifications,
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification as deleteNotificationService,
  clearAllNotifications,
} from "@/services/playerService";
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

    const loadNotifications = async () => {
      try {
        const data = await fetchNotifications(currentUser.id);
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.is_read).length);
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
      }
    };

    loadNotifications();

    window.addEventListener("notifications_changed", loadNotifications);

    // Subscribe to new notifications
    const unsubscribe = subscribeToNotifications(currentUser.id, (newNotif) => {
      setNotifications((prev) => [newNotif, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Play sound based on notification type
      const type = newNotif.type || "";
      if (type === "match_confirmation") playVictorySound();
      else if (type === "new_match" || type === "match_logged") playServeSound();
      else if (type === "serve" || type === "buddy_request") playServeSound();
      else if (type === "elo_milestone" || type === "top10") playVictorySound();
      else playWhistleSound();
    });

    return () => {
      window.removeEventListener("notifications_changed", loadNotifications);
      unsubscribe();
    };
  }, [currentUser]);

  const markAllAsRead = async () => {
    if (!currentUser || unreadCount === 0) return;
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await markAllNotificationsRead(currentUser.id);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const markAsRead = async (id: string, is_read: boolean) => {
    if (is_read) return;
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    try {
      await markNotificationRead(id);
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
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
    try {
      await deleteNotificationService(n.id);
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  const clearAll = async () => {
    if (!currentUser || notifications.length === 0) return;
    setNotifications([]);
    setUnreadCount(0);
    try {
      await clearAllNotifications(currentUser.id);
    } catch (err) {
      console.error("Failed to clear notifications:", err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "challenge_received":
        return <Swords className="w-5 h-5 text-secondary" />;
      case "match_logged":
      case "match_confirmation":
        return <Sword className="w-5 h-5 text-primary" />;
      case "buddy_request":
      case "buddy_acceptance":
        return <UserPlus className="w-5 h-5 text-individual" />;
      case "new_follower":
        return <Users className="w-5 h-5 text-info" />;
      case "ping":
        return <BellRing className="w-5 h-5 text-warning" />;
      case "find_lost":
        return <PackageSearch className="w-5 h-5 text-info" />;
      case "court_queue":
      case "court_call":
      case "lineup_deadline":
      case "match_reminder":
      case "friend_match_reminder":
        return <Timer className="w-5 h-5 text-success" />;
      case "achievement":
      case "milestone":
        return <Trophy className="w-5 h-5 text-gold" />;
      case "gallery_photos":
        return <Images className="w-5 h-5 text-info" />;
      default:
        return <Info className="w-5 h-5 text-info" />;
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={(o) => { setOpen(o); if (o) markAllAsRead(); }}>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all mr-1">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-danger border-2 border-border"></span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-card/50 p-4 border-b border-border flex justify-between items-center">
          <h3 className="font-black text-foreground flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" /> Notifications
          </h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/30 px-2 py-0.5 rounded-full">
                {unreadCount} New
              </span>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-danger transition"
                title="Clear all notifications"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground flex flex-col items-center">
              <CheckCircle2 className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="font-bold text-sm">All caught up!</p>
              <p className="text-xs">You have no new notifications.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`group p-4 border-b border-border/50 flex gap-3 hover:bg-muted/50 transition cursor-pointer ${
                  !n.is_read ? "bg-primary/10" : ""
                }`}
              >
                <div className="mt-0.5">{getIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <h4 className="font-bold text-sm text-foreground leading-tight">
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
                        className="p-0.5 rounded-md text-muted-foreground hover:text-danger hover:bg-danger/10 transition"
                        title="Remove notification"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
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
