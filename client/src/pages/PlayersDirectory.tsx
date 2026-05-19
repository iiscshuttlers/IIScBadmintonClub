import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, Users, Trophy, Sword, UserCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { usePageMeta } from "@/hooks/usePageMeta";

interface Player {
  id: string;
  full_name: string;
  nickname?: string;
  department: string;
  joined_year: number;
  playing_level: string;
  playing_style: string;
  dominant_hand: string;
  avatar_url: string;
  current_racket?: string;
}

export default function PlayersDirectory() {
  usePageMeta({
    title: "Player Directory",
    description: "Search and discover member profiles, styles, playing levels, and equipments within IISc Badminton Club.",
  });

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("All");
  const [styleFilter, setStyleFilter] = useState("All");

  useEffect(() => {
    supabase
      .from("players")
      .select("id, full_name, nickname, department, joined_year, playing_level, playing_style, dominant_hand, avatar_url, current_racket")
      .then(({ data, error }) => {
        if (!error && data) {
          setPlayers(data);
        }
        setLoading(false);
      });
  }, []);

  const filteredPlayers = players.filter((player) => {
    const matchesSearch =
      player.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (player.nickname && player.nickname.toLowerCase().includes(searchQuery.toLowerCase())) ||
      player.department.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesLevel = levelFilter === "All" || player.playing_level === levelFilter;
    const matchesStyle = styleFilter === "All" || player.playing_style?.toLowerCase().includes(styleFilter.toLowerCase());

    return matchesSearch && matchesLevel && matchesStyle;
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } },
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Hero Header Section */}
      <section className="bg-gradient-to-r from-blue-900 via-indigo-950 to-emerald-900 text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(16,185,129,0.1),transparent)] pointer-events-none" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-bold mb-5 backdrop-blur-sm animate-pulse">
            <Users className="w-4 h-4 text-emerald-400" />
            Club Roster
          </div>

          <h1
            className="text-4xl sm:text-5xl font-black mb-5 tracking-tight font-sans"
          >
            Player Directory
          </h1>

          <p className="text-lg sm:text-xl text-slate-200 max-w-3xl mx-auto font-medium leading-relaxed">
            Discover and connect with badminton players, teammates, and tournament champions across IISc department squads.
          </p>
        </div>
      </section>

      {/* Directory Controls & Roster */}
      <section className="container mx-auto px-4 py-12 max-w-7xl">
        
        {/* Search and Filters panel */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 mb-10 space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            
            {/* Search Input */}
            <div className="relative w-full md:flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search players by name, nickname, or department..."
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm font-semibold"
              />
            </div>

            {/* Quick Filter Sliders trigger indication */}
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 font-bold shrink-0">
              <SlidersHorizontal className="w-4 h-4 text-emerald-500" />
              Filters
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Playing Level Filter */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Playing Level</label>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
              >
                <option value="All">All Levels</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="Professional">Professional</option>
              </select>
            </div>

            {/* Playing Style Filter */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Playing Style</label>
              <select
                value={styleFilter}
                onChange={(e) => setStyleFilter(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
              >
                <option value="All">All Styles</option>
                <option value="Aggressive">Aggressive</option>
                <option value="Defensive">Defensive</option>
                <option value="All-round">All-round / Balanced</option>
              </select>
            </div>
          </div>
        </div>

        {/* Directory Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
            <p className="text-slate-500 dark:text-slate-400 font-bold">Assembling club roster...</p>
          </div>
        ) : filteredPlayers.length > 0 ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {filteredPlayers.map((player) => (
              <motion.div key={player.id} variants={itemVariants} className="group h-full">
                <Link href={`/player/${player.id}`}>
                  <Card className="h-full rounded-[2rem] overflow-hidden cursor-pointer border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-2xl hover:shadow-slate-200/50 dark:hover:shadow-none hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between group">
                    <CardContent className="p-6 flex flex-col items-center text-center space-y-4 h-full relative">
                      
                      {/* Top floating Department Label */}
                      <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider">
                        {player.department.split(" ").slice(0, 2).join(" ")}
                      </span>

                      {/* User Avatar */}
                      <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-800 shadow-md group-hover:scale-105 transition-transform duration-300 bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        {player.avatar_url ? (
                          <img
                            src={player.avatar_url}
                            alt={player.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-600 text-3xl font-bold uppercase bg-slate-200 dark:bg-slate-800">
                            {player.full_name.charAt(0)}
                          </div>
                        )}
                      </div>

                      {/* Name Details */}
                      <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
                          {player.full_name}
                        </h3>
                        {player.nickname && (
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 italic">
                            "{player.nickname}"
                          </span>
                        )}
                      </div>

                      {/* Quick Meta Stats / Badges */}
                      <div className="flex flex-wrap gap-1.5 justify-center py-2">
                        {/* Playing Level Badge */}
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest
                          ${player.playing_level === "Advanced" || player.playing_level === "Professional"
                            ? "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30"
                            : player.playing_level === "Intermediate"
                            ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}
                        >
                          {player.playing_level}
                        </span>

                        {/* Hand Badge */}
                        {player.dominant_hand && (
                          <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 text-[10px] font-extrabold uppercase tracking-widest">
                            {player.dominant_hand.split("-")[0]}
                          </span>
                        )}
                      </div>

                      {/* Current Racket Weapon */}
                      {player.current_racket && (
                        <div className="w-full pt-3 border-t border-slate-100 dark:border-slate-850 flex items-center justify-center gap-1 text-slate-500 dark:text-slate-400 text-xs font-bold mt-auto">
                          <Sword className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="truncate max-w-[150px]">{player.current_racket}</span>
                        </div>
                      )}

                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-12 text-center border border-dashed border-slate-200 dark:border-slate-800">
            <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">No players found matching filters</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6 text-sm">
              Try adjusting your search terms or filters to locate members of the club roster.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setLevelFilter("All");
                setStyleFilter("All");
              }}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition text-xs"
            >
              Reset Filters
            </button>
          </div>
        )}

      </section>
    </div>
  );
}
