import { useState } from "react";
import { adminService } from "@/services/adminService";
import { toast } from "sonner";
import { Bell, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm";
const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-foreground dark:text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition";
const labelCls = "block text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-1.5";

export function PushBroadcastPanel() {
  const { session } = useAuth();
  const [customPush, setCustomPush] = useState({ title: "", body: "", url: "" });
  const [pushing, setPushing] = useState(false);
  const [showOnHome, setShowOnHome] = useState(false);

  const sendCustomPush = async () => {
    if (!customPush.title.trim()) { toast.error("Title is required"); return; }
    setPushing(true);
    try {
      const fnData = await adminService.sendPushBroadcast({
        title: customPush.title.trim(),
        body: customPush.body.trim(),
        url: customPush.url.trim() || undefined,
        admin_email: session?.user?.email ?? "admin",
        showOnHome,
      });

      const sent = fnData?.sent ?? 0;
      const failed = fnData?.failed ?? 0;

      toast.success(`Sent to ${sent} device${sent !== 1 ? "s" : ""}${failed > 0 ? ` (${failed} failed)` : ""}!`);
      setCustomPush({ title: "", body: "", url: "" });
    } catch (err: any) {
      toast.error(err?.message || "Failed to send push");
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className={cardCls}>
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-5 h-5 text-indigo-500" />
        <h3 className="font-black text-slate-800 dark:text-foreground">Send Custom Push Notification</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Send a direct push notification to all users immediately. This uses the local websocket channel for active users and native push for mobile users.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelCls}>Notification Title *</label>
          <input
            type="text"
            value={customPush.title}
            onChange={(e) => setCustomPush(p => ({...p, title: e.target.value}))}
            className={inputCls}
            placeholder="e.g. Tournament Registration Open!"
            maxLength={60}
          />
        </div>
        <div>
          <label className={labelCls}>Action URL (Optional)</label>
          <input
            type="text"
            value={customPush.url}
            onChange={(e) => setCustomPush(p => ({...p, url: e.target.value}))}
            className={inputCls}
            placeholder="e.g. /events"
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Message Body</label>
          <textarea
            value={customPush.body}
            onChange={(e) => setCustomPush(p => ({...p, body: e.target.value}))}
            className={inputCls}
            rows={2}
            placeholder="Short description..."
            maxLength={150}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-muted-foreground dark:text-slate-300">
            <input
              type="checkbox"
              checked={showOnHome}
              onChange={(e) => setShowOnHome(e.target.checked)}
              className="w-4 h-4 text-primary rounded focus:ring-primary"
            />
            Show on Home Page
          </label>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          onClick={sendCustomPush}
          disabled={pushing || !customPush.title.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-on-accent font-bold shadow-lg shadow-indigo-500/20 transition disabled:opacity-50"
        >
          {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          {pushing ? "Sending…" : "Send Broadcast"}
        </button>
      </div>
    </div>
  );
}
