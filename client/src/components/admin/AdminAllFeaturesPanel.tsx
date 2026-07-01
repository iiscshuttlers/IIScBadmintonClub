/**
 * Comprehensive Features Tracker for Admin Panel
 * Display all platform features organized by category
 */

import { useState } from "react";
import { FEATURES, getFeatureStats } from "@/data/features";
import {
  Search, Filter, CheckCircle, Zap, Clock, Grid, List, Sparkles
} from "lucide-react";

const iconMap: Record<string, React.ReactNode> = {
  "Sword": "🗡️",
  "Users": "👥",
  "Zap": "⚡",
  "Heart": "❤️",
  "GitMerge": "🔀",
  "WifiOff": "📡",
  "TrendingUp": "📈",
  "Trophy": "🏆",
  "Crown": "👑",
  "Award": "🏅",
  "User": "👤",
  "GitCompare": "⚖️",
  "Badge": "🎖️",
  "Scale": "⚖️",
  "Handshake": "🤝",
  "Megaphone": "📢",
  "Bell": "🔔",
  "Flame": "🔥",
  "Target": "🎯",
  "Calendar": "📅",
  "Activity": "⚙️",
  "Whistle": "🔊",
  "AlertTriangle": "⚠️",
  "Image": "🖼️",
  "Video": "🎥",
  "Search": "🔍",
  "Brain": "🧠",
  "BarChart3": "📊",
  "BarChart2": "📊",
  "Paintbrush": "🎨",
  "ClipboardList": "📋",
  "Settings": "⚙️",
  "Lock": "🔐",
  "Fingerprint": "👆",
  "KeyRound": "🔑",
  "Trash2": "🗑️",
  "Moon": "🌙",
  "Download": "⬇️",
  "QrCode": "📲",
  "Smartphone": "📱",
};

import { InfoModal } from "@/components/InfoModal";

export function AdminAllFeaturesPanel() {
  const stats = getFeatureStats();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "beta" | "coming-soon">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filtered = FEATURES.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || f.category === selectedCategory;
    const matchesStatus = statusFilter === "all" || f.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const statusColors = {
    active: "bg-primary/10 dark:bg-primary/30 text-primary dark:text-primary border-primary/40 dark:border-primary/80",
    beta: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    "coming-soon": "bg-slate-50 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  };

  const statusIcons = {
    active: <CheckCircle className="w-4 h-4" />,
    beta: <Zap className="w-4 h-4" />,
    "coming-soon": <Clock className="w-4 h-4" />,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-black text-slate-800 dark:text-white">All Features</h2>
        <InfoModal
          title="FEATURE TRACKER"
          mainIcon={<Sparkles className="w-5 h-5" />}
          items={[
            { badge: "ACT", title: "Active", desc: "Currently live and stable in production." },
            { badge: "BETA", title: "Beta", desc: "Available for testing but might have occasional bugs." },
            { badge: "SOON", title: "Coming Soon", desc: "In active development and scheduled for future release." }
          ]}
        />
      </div>
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-primary/10 dark:bg-primary/30 rounded-xl p-4 border border-primary/40 dark:border-primary/80">
          <div className="text-2xl font-black text-primary dark:text-primary">{stats.active}</div>
          <div className="text-xs font-bold text-primary dark:text-primary uppercase">Active</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
          <div className="text-2xl font-black text-blue-700 dark:text-blue-400">{stats.total}</div>
          <div className="text-xs font-bold text-blue-600 dark:text-blue-500 uppercase">Total</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
          <div className="text-2xl font-black text-amber-700 dark:text-amber-400">{stats.beta}</div>
          <div className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase">Beta</div>
        </div>
        <div className="bg-slate-100 dark:bg-slate-900/30 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
          <div className="text-2xl font-black text-slate-700 dark:text-slate-400">{stats.categories.length}</div>
          <div className="text-xs font-bold text-slate-600 dark:text-slate-500 uppercase">Categories</div>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-4">
        {/* Search & View Mode */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search features..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg border transition ${viewMode === "grid" ? "bg-primary/15 dark:bg-primary border-primary/50 dark:border-primary text-primary dark:text-primary" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"}`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg border transition ${viewMode === "list" ? "bg-primary/15 dark:bg-primary border-primary/50 dark:border-primary text-primary dark:text-primary" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"}`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-2">
            {(["all", "active", "beta", "coming-soon"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                  statusFilter === status
                    ? "bg-primary/15 dark:bg-primary border-primary/50 dark:border-primary text-primary dark:text-primary"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                }`}
              >
                {status === "all" ? "All" : status === "coming-soon" ? "Coming Soon" : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
              !selectedCategory
                ? "bg-blue-100 dark:bg-blue-950 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
            }`}
          >
            All Categories
          </button>
          {stats.categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                selectedCategory === cat
                  ? "bg-blue-100 dark:bg-blue-950 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Features Display */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((feature) => (
            <div key={feature.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="text-2xl">{iconMap[feature.icon] || "✨"}</div>
                <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${statusColors[feature.status]}`}>
                  {statusIcons[feature.status]}
                  {feature.status === "coming-soon" ? "Soon" : feature.status.charAt(0).toUpperCase() + feature.status.slice(1)}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{feature.name}</h4>
                <InfoModal
                  title={feature.name.toUpperCase()}
                  items={[{ title: "Description", desc: feature.description }]}
                />
              </div>
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase">{feature.category}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((feature) => (
            <div key={feature.id} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
              <div className="flex items-center gap-3 justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="text-xl shrink-0">{iconMap[feature.icon] || "✨"}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{feature.name}</h4>
                      <InfoModal
                        title={feature.name.toUpperCase()}
                        items={[{ title: "Description", desc: feature.description }]}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
                    {feature.category}
                  </span>
                  <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${statusColors[feature.status]}`}>
                    {statusIcons[feature.status]}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <div className="text-slate-400 dark:text-slate-600 mb-2">No features match your filters</div>
          <button
            onClick={() => {
              setSearchTerm("");
              setSelectedCategory(null);
              setStatusFilter("all");
            }}
            className="text-sm font-bold text-primary dark:text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
        <div className="flex gap-3">
          <div className="text-xl">ℹ️</div>
          <div className="text-sm">
            <div className="font-bold text-blue-900 dark:text-blue-100 mb-1">Feature Overview</div>
            <div className="text-xs text-blue-800 dark:text-blue-200">
              This dashboard tracks all {stats.total} features across {stats.categories.length} categories.
              {stats.active} are actively live, {stats.beta} in beta, and {stats.comingSoon} coming soon.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
