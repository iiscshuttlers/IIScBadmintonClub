import { useState } from "react";
import { adminService } from "@/services/adminService";
import { toast } from "sonner";
import { Bell, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useContentStore } from "../content/contentStore";

const inputCls = "w-full px-3 py-2.5 rounded-xl border border-border-strong bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition";
const labelCls = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

export function PushBroadcastPanel() {
  const { session } = useAuth();
  const [customPush, setCustomPush] = useState({ title: "", body: "", url: "" });
  const [pushing, setPushing] = useState(false);
  const [showOnHome, setShowOnHome] = useState(false);
  const { dirtyKeys, reloadDoc } = useContentStore();
  // "Show on Home" writes a banner straight to home_banners; with unsaved
  // banner edits open, reloading them afterwards would throw those edits away.
  const bannersDirty = dirtyKeys.includes("home_banners");

  const sendCustomPush = async () => {
    if (!customPush.title.trim()) { toast.error("Title is required"); return; }
    setPushing(true);
    try {
      const fnData = await adminService.sendPushBroadcast({
        title: customPush.title.trim(),
        body: customPush.body.trim(),
        url: customPush.url.trim() || undefined,
        admin_email: session?.user?.email ?? "admin",
        showOnHome: showOnHome && !bannersDirty,
      });

      const sent = fnData?.sent ?? 0;
      const failed = fnData?.failed ?? 0;

      toast.success(`Sent to ${sent} device${sent !== 1 ? "s" : ""}${failed > 0 ? ` (${failed} failed)` : ""}!`);
      setCustomPush({ title: "", body: "", url: "" });
      if (showOnHome && !bannersDirty) {
        setShowOnHome(false);
        await reloadDoc("home_banners");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to send push");
    } finally {
      setPushing(false);
    }
  };

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">
        Goes out immediately to everyone with notifications on (in-app for people on the site, native push on phones).
        To notify about an announcement or poll, use “Send push” on it instead.
      </p>
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
          <label className={`flex items-center gap-2 text-sm font-bold text-soft ${bannersDirty ? "opacity-60" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={showOnHome && !bannersDirty}
              disabled={bannersDirty}
              onChange={(e) => setShowOnHome(e.target.checked)}
              className="w-4 h-4 text-primary rounded focus:ring-primary"
            />
            Also add it as a Home banner
          </label>
          {bannersDirty && (
            <p className="mt-1 text-xs text-muted-foreground">Save or undo your Home banner edits first.</p>
          )}
        </div>
      </div>
      <div className="flex justify-end">
        <button
          onClick={sendCustomPush}
          disabled={pushing || !customPush.title.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-info hover:bg-info/90 text-on-accent font-bold shadow-lg shadow-info/20 transition disabled:opacity-50"
        >
          {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          {pushing ? "Sending…" : "Send Broadcast"}
        </button>
      </div>
    </div>
  );
}
