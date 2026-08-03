import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, MapPin } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface HourlyPoint {
  hour_of_day: number;
  avg_checkins: number;
}

const POLL_INTERVAL_MS = 30_000;

function formatHour(hour: number) {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? "am" : "pm"}`;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as HourlyPoint;
    return (
      <div className="bg-slate-900/95 border border-slate-700/50 p-2.5 rounded-xl shadow-xl backdrop-blur-sm">
        <p className="text-xs text-slate-400 font-medium mb-0.5">{formatHour(data.hour_of_day)}</p>
        <p className="text-sm font-bold text-white">
          {data.avg_checkins} <span className="text-xs font-normal text-slate-400">avg check-ins</span>
        </p>
      </div>
    );
  }
  return null;
};

export function VenueTrafficWidget() {
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [hourlyPattern, setHourlyPattern] = useState<HourlyPoint[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const { profile } = useAuth();

  useEffect(() => {
    let cancelled = false;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const loadActiveCount = async () => {
      const { data, error } = await supabase.rpc("get_venue_active_count");
      if (error) {
        if (intervalId) clearInterval(intervalId);
        return;
      }
      if (!cancelled && typeof data === "number") {
        setActiveCount(data);
      }
    };

    const loadHourlyPattern = async () => {
      const { data, error } = await supabase.rpc("get_venue_hourly_pattern", { days_back: 14 });
      if (!cancelled && !error && Array.isArray(data)) {
        // Filter to only show 6 AM to 10 PM (hours 6 to 22)
        const filtered = (data as HourlyPoint[]).filter(p => p.hour_of_day >= 6 && p.hour_of_day <= 22);
        setHourlyPattern(filtered);
      }
      if (!cancelled) setLoaded(true);
    };

    loadActiveCount();
    loadHourlyPattern();

    intervalId = setInterval(loadActiveCount, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const handleManualCheckIn = async () => {
    if (!profile) {
      toast.error("You must be logged in to check in");
      return;
    }
    setIsCheckingIn(true);
    try {
      const { error } = await supabase.from("venue_presence_events").insert({
        player_id: profile.id,
        event_type: "enter"
      });
      if (error) throw error;
      toast.success("Successfully checked in to Gymkhana!");
      
      // Optimistically update the count or trigger a refetch
      const { data: newCount } = await supabase.rpc("get_venue_active_count");
      if (typeof newCount === "number") setActiveCount(newCount);
    } catch (err) {
      console.error(err);
      toast.error("Failed to check in manually");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const hasTrafficData = hourlyPattern.some((p) => p.avg_checkins > 0);
  const currentHour = new Date().getHours();

  // Don't render anything until we know whether there's data — avoids a
  // flash of an empty section on every Home page load.
  if (!loaded) return null;

  return (
    <section aria-label="Venue Traffic" className="py-6 bg-slate-900 dark:bg-slate-950 border-y border-slate-800">
      <div className="container mx-auto px-4 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 items-center bg-slate-900/60 border border-slate-700/40 rounded-2xl p-5 sm:p-6"
        >
          {/* Live headcount */}
          <div className="flex flex-col items-start gap-2 sm:gap-1 sm:border-r sm:border-slate-700/40 sm:pr-6">
            <div className="flex flex-row sm:flex-col items-center sm:items-start gap-3 sm:gap-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <MapPin className="w-3.5 h-3.5" />
                At Gymkhana now
              </div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                <span className="text-3xl font-black text-white tabular-nums">{activeCount ?? "–"}</span>
                <span className="text-sm text-slate-400 font-medium">{activeCount === 1 ? "player" : "players"}</span>
              </div>
            </div>
            
            <Button
              onClick={handleManualCheckIn}
              disabled={isCheckingIn}
              variant="outline"
              size="sm"
              className="mt-1 w-full sm:w-auto text-xs font-bold bg-slate-800/50 hover:bg-slate-800 border-slate-700/50 h-8"
            >
              I'm Here
            </Button>
          </div>

          {/* Popular-times style chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Activity className="w-3.5 h-3.5" />
                Typical traffic by hour
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">
                AI Predictions Soon
              </span>
            </div>
            {hasTrafficData ? (
              <div className="h-28 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyPattern} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.3} />
                    <XAxis
                      dataKey="hour_of_day"
                      tickFormatter={formatHour}
                      interval={3}
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={8}
                    />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(148, 163, 184, 0.2)", strokeWidth: 1, strokeDasharray: "4 4" }} />
                    <Area 
                      type="monotone" 
                      dataKey="avg_checkins" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2.5}
                      fillOpacity={1} 
                      fill="url(#trafficGradient)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4">Not enough visits yet to show a pattern.</p>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
