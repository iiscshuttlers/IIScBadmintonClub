import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Trash2, Plus, Loader2, UserCheck, UserX, Activity, Search, RefreshCw, Download, AlertTriangle, Play, Pencil, Clock, CheckCircle2, Ban, Shield, History, FileDown, ArrowRight, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAdminHistory } from "@/contexts/AdminHistoryContext";
import { 
  Holiday, Announcement, EventItem, Chapter, VideoItem, Player, SiteConfig, FlyerItem, DynamicFlyer, AuthUser,
  inputCls, labelCls, cardCls, colorSwatchCls, toHex, parseTime, fmtTime
} from "./shared";
import { optimizeImage } from '@/lib/imageUtils';

export function RegistrationsManager() {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "pending" | "approved" | "rejected" | "all"
  >("pending");
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tournament_registrations")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setRegistrations(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (
    id: string,
    status: "approved" | "rejected" | "pending",
  ) => {
    setActionId(id);
    const { error } = await supabase
      .from("tournament_registrations")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast(`Failed to ${status}: ` + error.message, { icon: "❌" });
    } else {
      toast(`Registration ${status}.`, {
        icon: status === "approved" ? "✅" : "⚠️",
      });
      setRegistrations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r)),
      );
    }
    setActionId(null);
  };

  const filtered = registrations.filter(
    (r) => filter === "all" || r.status === filter,
  );

  if (loading)
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: "Total",
            value: registrations.length,
            color: "bg-blue-50 text-blue-700",
          },
          {
            label: "Pending",
            value: registrations.filter((r) => r.status === "pending").length,
            color: "bg-amber-50 text-amber-700",
          },
          {
            label: "Approved",
            value: registrations.filter((r) => r.status === "approved").length,
            color: "bg-primary/10 text-primary",
          },
          {
            label: "Rejected",
            value: registrations.filter((r) => r.status === "rejected").length,
            color: "bg-rose-50 text-rose-700",
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-2xl p-4 text-center ${s.color}`}
          >
            <div className="text-2xl font-black">{s.value}</div>
            <div className="text-xs font-bold uppercase tracking-wider mt-0.5">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap ${filter === f ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-muted-foreground hover:bg-slate-50"}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-muted-foreground font-medium border-2 border-dashed border-slate-200 rounded-2xl">
            No registrations found.
          </div>
        )}
        {filtered.map((r) => {
          const busy = actionId === r.id;
          return (
            <div
              key={r.id}
              className={`${cardCls} flex flex-col md:flex-row gap-4 items-start md:items-center`}
            >
              <div className="flex-1 space-y-1 w-full">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground dark:text-foreground">
                    {r.full_name}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${r.status === "approved" ? "bg-primary/15 text-primary" : r.status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {r.status}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground dark:text-muted-foreground">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Events:
                  </span>{" "}
                  {r.categories.join(", ")}
                </div>
                {r.partner_names && Object.keys(r.partner_names).length > 0 && (
                  <div className="text-sm text-muted-foreground dark:text-muted-foreground">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Partners:
                    </span>{" "}
                    {Object.entries(r.partner_names)
                      .map(([cat, name]) => `${cat}: ${name}`)
                      .join(" | ")}
                  </div>
                )}
                <div className="text-xs text-muted-foreground font-mono mt-1">
                  UPI: {r.transaction_id}
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto shrink-0 border-t border-slate-100 dark:border-slate-800 md:border-none pt-3 md:pt-0 mt-2 md:mt-0">
                <a
                  href={
                    supabase.storage
                      .from("tournament_receipts")
                      .getPublicUrl(r.receipt_path).data.publicUrl
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold"
                >
                  View Receipt
                </a>

                {r.status === "pending" && (
                  <>
                    <button
                      onClick={() => updateStatus(r.id, "approved")}
                      disabled={busy}
                      className="flex-1 md:flex-none px-3 py-2 rounded-xl bg-primary hover:bg-primary text-primary-foreground text-xs font-bold transition disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateStatus(r.id, "rejected")}
                      disabled={busy}
                      className="flex-1 md:flex-none px-3 py-2 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200 text-xs font-bold transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}
                {r.status === "rejected" && (
                  <button
                    onClick={() => updateStatus(r.id, "pending")}
                    disabled={busy}
                    className="flex-1 md:flex-none px-3 py-2 rounded-xl bg-slate-100 text-muted-foreground hover:bg-slate-200 text-xs font-bold transition disabled:opacity-50"
                  >
                    Re-evaluate
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
