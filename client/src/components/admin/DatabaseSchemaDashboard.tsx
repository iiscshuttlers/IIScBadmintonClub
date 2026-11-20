import dbSchema from "@/data/dbSchemaData.json";
import { Database, TableProperties, ShieldCheck, ShieldAlert, Key, DatabaseBackup, ActivitySquare, Layers } from "lucide-react";
import { InfoModal } from "@/components/InfoModal";

const TABLE_TO_FEATURES: Record<string, string[]> = {
  "admin_history": ["Activity Logs", "Site Admin Control Center"],
  "club_courts": ["Live Courts Dashboard", "Venue & Presence Tracking"],
  "live_match_votes": ["Pulse (Social Feed)", "Live Matches"],
  "marketplace_listings": ["Club Marketplace", "Equipment Exchange"],
  "match_health_data": ["Player Health & Biometrics", "Danger Zone Heart Rate Haptics"],
  "match_motion_stats": ["Pocket Mode Motion Tracking", "Hardware Motion Tracking"],
  "match_player_paths": ["AR 3D Replays", "Path Tracing Wizard"],
  "match_rally_stats": ["Match Analytics", "Auto-Highlights Engine"],
  "match_sensor_analytics": ["Sensor Lab", "AI Stroke Breakdown"],
  "match_stroke_analytics": ["AI Stroke Breakdown & Coaching"],
  "match_video_calibration": ["Path Tracing Wizard"],
  "player_endorsements": ["Player Profiles", "Teams & Endorsements"],
  "player_sleep_data": ["Player Health & Biometrics"],
  "recycle_bin": ["Site Admin Control Center", "Recycle Bin"],
  "tournaments": ["Tournament Management", "Live Tournaments & Brackets"],
  "tournament_matches": ["Tournament Management", "Live Scoring"],
  "tournament_participants": ["Tournament Management"],
  "tournament_round_rules": ["Tournament Management", "Bracket Generation"],
  "umpire_assignments": ["Umpire Mode"]
};

export function DatabaseSchemaDashboard() {
  const tables = Object.entries(dbSchema).map(([name, data]) => ({
    name,
    columns: (data as any).columns,
    policies: (data as any).policies,
  }));

  const totalColumns = tables.reduce((acc, t) => acc + t.columns.length, 0);
  const totalPolicies = tables.reduce((acc, t) => acc + t.policies.length, 0);

  return (
    <div className="w-full min-h-screen bg-background text-[#E2E8F0] font-sans p-6 md:p-10 pb-20">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header Section */}
        <div>
          <div className="text-[0.72rem] font-bold tracking-[0.14em] uppercase text-[#38BDF8] mb-2 flex items-center gap-2">
            <Database className="w-4 h-4" /> IISc Shuttlers Database Architecture
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-foreground flex items-center gap-2">
            Postgres Schema & RLS
            <InfoModal
              title="DATABASE SCHEMA"
              items={[
                { badge: "USAGE", title: "How to use", desc: "View a comprehensive, human-readable layout of all Postgres tables, their columns, and their Row Level Security (RLS) policies." },
                { badge: "LOGIC", title: "How it works", desc: "It reads from a pre-generated static JSON file. It iterates over the columns array to display data types and the policies array to display security rules." }
              ]}
            />
          </h1>
          <p className="text-[#94A3B8] max-w-2xl text-base leading-relaxed">
            Auto-generated from Supabase migration files. This dashboard provides a live dictionary of all database tables, column structures, and Row Level Security (RLS) policies defining data access.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-muted border border-border rounded-xl overflow-hidden">
          <div className="bg-card p-5">
            <div className="text-3xl font-bold font-mono text-foreground">{tables.length}</div>
            <div className="text-[0.74rem] text-[#94A3B8] uppercase tracking-wider mt-1 flex items-center gap-1.5"><TableProperties className="w-3.5 h-3.5"/> Total Tables</div>
          </div>
          <div className="bg-card p-5">
            <div className="text-3xl font-bold font-mono text-foreground">{totalColumns}</div>
            <div className="text-[0.74rem] text-[#94A3B8] uppercase tracking-wider mt-1 flex items-center gap-1.5"><ActivitySquare className="w-3.5 h-3.5"/> Total Columns</div>
          </div>
          <div className="bg-card p-5">
            <div className="text-3xl font-bold font-mono text-foreground">{totalPolicies}</div>
            <div className="text-[0.74rem] text-[#94A3B8] uppercase tracking-wider mt-1 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5"/> RLS Policies</div>
          </div>
          <div className="bg-card p-5">
            <div className="text-3xl font-bold font-mono text-foreground">100%</div>
            <div className="text-[0.74rem] text-[#94A3B8] uppercase tracking-wider mt-1 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5"/> Protected</div>
          </div>
        </div>

        {/* Tables Grid */}
        <section>
          <div className="flex items-baseline justify-between border-b-2 border-border pb-2 mb-6">
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">Tables & Definitions</h2>
            <span className="text-sm font-mono text-[#94A3B8]">Alphabetical Order</span>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {tables.map((table, idx) => (
              <div key={idx} className="bg-card border border-border rounded-xl overflow-hidden shadow-md hover:border-[#38BDF8]/40 transition-colors duration-300">
                
                {/* Table Header */}
                <div className="flex items-center justify-between px-5 py-4 bg-card border-b border-border">
                  <div className="flex items-center gap-2">
                    <DatabaseBackup className="w-4 h-4 text-[#38BDF8]" />
                    <span className="font-bold text-foreground font-mono text-[0.95rem]">{table.name}</span>
                  </div>
                  <span className="font-mono text-xs bg-muted text-[#94A3B8] px-2 py-0.5 rounded-full">
                    {table.columns.length} cols
                  </span>
                </div>
                
                {/* Columns */}
                <div className="px-5 py-3 bg-card/50 border-b border-border">
                  <div className="text-[0.65rem] font-bold text-[#64748B] uppercase tracking-widest mb-2 flex justify-between">
                    <span>Column</span>
                    <span>Type</span>
                  </div>
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                    {table.columns.map((col: any, cidx: number) => (
                      <div key={cidx} className="flex items-center justify-between group">
                        <span className="text-sm font-mono text-[#E2E8F0] group-hover:text-foreground flex items-center gap-1.5">
                          {col.name === 'id' && <Key className="w-3 h-3 text-warning/80" />}
                          {col.name}
                        </span>
                        <span className="text-xs font-mono text-[#38BDF8]/80">{col.type}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* App Architecture Mapping */}
                <div className="px-5 py-3 bg-card border-b border-border">
                  <div className="text-[0.65rem] font-bold text-[#64748B] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Layers className="w-3 h-3" /> Associated App Features
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(TABLE_TO_FEATURES[table.name] || ["Backend Domain"]).map((feat, fidx) => (
                      <span key={fidx} className="bg-muted text-[#94A3B8] text-[0.68rem] px-2 py-1 rounded border border-border-strong">
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Policies */}
                <div className="px-5 py-4 bg-[#020617]/40">
                  <div className="text-[0.65rem] font-bold text-[#64748B] uppercase tracking-widest mb-2 flex justify-between items-center">
                    <span>RLS Policies</span>
                    <span className="text-success/80">{table.policies.length} Active</span>
                  </div>
                  {table.policies.length > 0 ? (
                    <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                      {table.policies.map((pol: any, pidx: number) => (
                        <div key={pidx} className="bg-card border border-border rounded p-2 flex flex-col gap-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-medium text-[#CBD5E1] truncate" title={pol.name}>
                              {pol.name}
                            </span>
                            <span className={`text-[0.6rem] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                              pol.action === 'SELECT' ? 'bg-info/20 text-info' :
                              pol.action === 'INSERT' ? 'bg-success/20 text-success' :
                              pol.action === 'UPDATE' ? 'bg-warning/20 text-warning' :
                              pol.action === 'DELETE' ? 'bg-danger/20 text-danger' :
                              'bg-individual/20 text-individual'
                            }`}>
                              {pol.action || 'ALL'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-[#64748B] italic">No explicit policies found (Public/Default).</div>
                  )}
                </div>

              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-border pt-6 mt-12 text-xs text-[#64748B]">
          Schema generated by parsing <code>supabase/migrations/*.sql</code>. Custom script executed at build-time.
        </footer>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1E293B;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}</style>
    </div>
  );
}
