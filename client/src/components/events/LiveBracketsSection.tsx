import { useState, useEffect } from "react";
import { Trophy, Activity, CheckCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

interface TournamentData {
  formats: string[];
  players: any;
  matches: {
    [format: string]: any[];
  };
  config: any;
  lastUpdated: string;
}

export function LiveBracketsSection() {
  const [activeFormat, setActiveFormat] = useState("MS");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [tournamentData, setTournamentData] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!db) {
      setError("Firebase is unavailable.");
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, "live_data", "tournament"),
      (docSnap) => {
        if (docSnap.exists()) {
          setTournamentData(docSnap.data() as TournamentData);
          setLoading(false);
          setError("");
        } else {
          setError("Tournament brackets are not available yet.");
          setLoading(false);
        }
      },
      (err) => {
        console.error("Firebase listen error:", err);
        setError("Failed to connect to live updates.");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const currentMatches = tournamentData?.matches[activeFormat] || [];
  const rounds = currentMatches.reduce((acc, match) => {
    const roundName = match.Round || "Unassigned";
    if (!acc[roundName]) acc[roundName] = [];
    acc[roundName].push(match);
    return acc;
  }, {} as { [key: string]: any[] });

  // Build the complete set of match IDs where selectedPlayer appears (full path)
  const selectedPlayerPath = (() => {
    if (!selectedPlayer) return new Set<number>();
    const path = new Set<number>();
    currentMatches.forEach((m, idx) => {
      const p1 = m.Player_1 || m.Players_1 || "";
      const p2 = m.Player_2 || m.Players_2 || "";
      if (p1.includes(selectedPlayer) || p2.includes(selectedPlayer)) {
        path.add(idx);
      }
    });
    // Trace winners forward through subsequent rounds
    let changed = true;
    while (changed) {
      changed = false;
      currentMatches.forEach((m, idx) => {
        if (path.has(idx)) return;
        const winner = m.Winner || "";
        if (selectedPlayer && winner.includes(selectedPlayer)) {
          path.add(idx);
          changed = true;
        }
      });
    }
    return path;
  })();

  if (loading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin"></div>
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest animate-pulse">
          Loading Brackets
        </p>
      </div>
    );
  }

  if (error || !tournamentData) {
    return (
      <div className="py-32 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
          <Trophy className="w-10 h-10 text-slate-400 dark:text-slate-500" />
        </div>
        <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">
          Brackets Not Yet Available
        </h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Tournament brackets will appear here once the draw has been published. Check back closer to the tournament start date.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 w-full py-6">
      <div className="max-w-7xl mx-auto mb-6 flex flex-wrap gap-2 justify-center">
        {[...tournamentData.formats]
          .sort(
            (a, b) =>
              ["MS", "WS", "MD", "WD", "XD"].indexOf(a) -
              ["MS", "WS", "MD", "WD", "XD"].indexOf(b),
          )
          .map((format) => (
            <button
              key={format}
              onClick={() => setActiveFormat(format)}
              className={`px-6 py-2 rounded-full font-bold transition-all shadow-sm ${
                activeFormat === format
                  ? "bg-emerald-600 text-white"
                  : "bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700"
              }`}
            >
              {format}
            </button>
          ))}
      </div>

      <div className="max-w-7xl mx-auto bg-white dark:bg-slate-900 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-800 overflow-hidden">
        {selectedPlayer && (
          <div className="px-8 pt-4 pb-0 flex items-center gap-3 text-sm flex-wrap">
            <span className="font-black text-emerald-600 dark:text-emerald-400">{selectedPlayer}</span>
            <span className="text-slate-500 dark:text-slate-400">— path highlighted</span>
            <span className="flex items-center gap-1 text-xs text-slate-400"><span className="inline-block w-3 h-3 rounded ring-2 ring-emerald-500" /> Direct match</span>
            <span className="flex items-center gap-1 text-xs text-slate-400"><span className="inline-block w-3 h-3 rounded ring-2 ring-emerald-400/60" /> Win path</span>
            <button onClick={() => setSelectedPlayer(null)} className="ml-auto text-xs text-slate-400 hover:text-rose-500 font-bold transition-colors">✕ Clear</button>
          </div>
        )}
        <div className="p-8 overflow-x-auto">
          {currentMatches.length === 0 ? (
            <div className="text-center py-20 text-gray-400 dark:text-slate-500 italic">
              No matches scheduled for {activeFormat} yet.
            </div>
          ) : (
            <div className="flex gap-12 min-w-max">
              {Object.keys(rounds).map((roundName, idx) => (
                <div key={idx} className="flex flex-col w-72">
                  <h3 className="text-center font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest text-sm mb-6 bg-gray-100 dark:bg-slate-800 py-2 rounded">
                    {roundName}
                  </h3>
                  <div className="flex flex-col gap-6 justify-around h-full">
                    {rounds[roundName].map((match: any, matchIdx: number) => {
                      const isCompleted = match.Status === "completed";
                      const isLive = match.Status === "in-progress";
                      const p1Name = match.Player_1 || match.Players_1 || "TBD";
                      const p2Name = match.Player_2 || match.Players_2 || "TBD";
                      const p1Won =
                        isCompleted &&
                        match.Winner &&
                        match.Winner.includes(p1Name.split("/")[0]);
                      const p2Won =
                        isCompleted &&
                        match.Winner &&
                        match.Winner.includes(p2Name.split("/")[0]);

                      // flatIndex for path lookup
                      const flatIndex = currentMatches.indexOf(match);
                      const isOnPath = selectedPlayerPath.has(flatIndex);
                      const isDirectMatch = isOnPath && (p1Name.includes(selectedPlayer ?? "") || p2Name.includes(selectedPlayer ?? ""));

                      return (
                        <div
                          key={matchIdx}
                          className={`border rounded-xl overflow-hidden bg-white dark:bg-slate-900 transition-all ${
                            isLive
                              ? "border-red-500 dark:border-red-900 shadow-lg shadow-red-200 ring-2 ring-red-200"
                              : "border-gray-200 dark:border-slate-700 shadow-sm"
                          } ${isDirectMatch ? "ring-4 ring-emerald-500 border-emerald-500 shadow-emerald-500/20 shadow-xl scale-[1.02]" : isOnPath ? "ring-2 ring-emerald-400/60 border-emerald-400/60 shadow-emerald-400/10 shadow-lg" : ""}`}
                        >
                          <div
                            className={`px-3 py-1.5 text-xs font-semibold flex justify-between items-center ${
                              isLive
                                ? "bg-red-50 dark:bg-red-950/20 text-red-700"
                                : "bg-gray-50 dark:bg-slate-800/50 text-gray-500 dark:text-slate-500"
                            }`}
                          >
                            <span>{match.Match_ID}</span>
                            {isLive ? (
                              <span className="animate-pulse flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-red-500 dark:bg-red-500/80"></span>{" "}
                                LIVE
                              </span>
                            ) : (
                              <span>{match.Status}</span>
                            )}
                          </div>
                          <div
                            onClick={() => setSelectedPlayer(selectedPlayer === p1Name ? null : p1Name)}
                            className={`p-3 flex justify-between items-center border-b cursor-pointer transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/20 ${
                              p1Won
                                ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 font-bold"
                                : "text-gray-700 dark:text-slate-300"
                            }`}
                          >
                            <span className="truncate pr-2">{p1Name}</span>
                            {p1Won && <Trophy size={14} className="text-emerald-600 flex-shrink-0" />}
                          </div>
                          {match.Score_1 && (
                            <div className="text-center py-1 bg-gray-50 dark:bg-slate-800/50 text-xs font-mono font-bold text-gray-600 dark:text-slate-400">
                              {match.Score_1}
                            </div>
                          )}
                          <div
                            onClick={() => setSelectedPlayer(selectedPlayer === p2Name ? null : p2Name)}
                            className={`p-3 flex justify-between items-center cursor-pointer transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/20 ${
                              p2Won
                                ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 font-bold"
                                : "text-gray-700 dark:text-slate-300"
                            } ${match.Score_1 ? "border-t" : ""}`}
                          >
                            <span className="truncate pr-2">{p2Name}</span>
                            {p2Won && <Trophy size={14} className="text-emerald-600 flex-shrink-0" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
