import { Card, CardContent } from "@/components/ui/card";
import { Share2, Pencil, Trash2, Sword } from "lucide-react";
import { toast } from "sonner";

export interface Player {
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
  user_id?: string;
  elo_rating?: number;
  win_loss_record?: string;
  recent_form?: string[];
  is_approved?: boolean;
}

const AVATAR_GRADIENTS = [
  "from-emerald-400 to-teal-500",
  "from-blue-400 to-indigo-500",
  "from-violet-400 to-purple-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-cyan-400 to-sky-500",
];

function avatarGradient(name: string) {
  const sum = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[sum % AVATAR_GRADIENTS.length];
}

export function parseWinPct(record?: string): number | null {
  if (!record) return null;
  const m = record.match(/(\d+)\s*W\s*-\s*(\d+)\s*L/i);
  if (!m) return null;
  const w = +m[1], l = +m[2];
  return w + l ? Math.round((w / (w + l)) * 100) : null;
}

const levelColor: Record<string, string> = {
  Advanced:      "bg-amber-50   dark:bg-amber-950/20  text-amber-700   dark:text-amber-400  border border-amber-100  dark:border-amber-900/30",
  Professional:  "bg-amber-50   dark:bg-amber-950/20  text-amber-700   dark:text-amber-400  border border-amber-100  dark:border-amber-900/30",
  Intermediate:  "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30",
  Beginner:      "bg-slate-100  dark:bg-slate-800      text-slate-600   dark:text-slate-300",
};

interface PlayerCardProps {
  player: Player;
  isOwn?: boolean;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
}

export function PlayerCard({ player, isOwn = false, isAdmin = false, onDelete, onEdit }: PlayerCardProps) {
  const winPct = parseWinPct(player.win_loss_record);

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/player/${player.id}`;
    if (navigator.share) {
      navigator.share({ title: player.full_name, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => toast.success("Profile link copied!")).catch(() => {});
    }
  };

  return (
    <Card
      className={`h-full rounded-[2rem] overflow-hidden cursor-pointer border bg-white dark:bg-slate-900
        hover:shadow-2xl hover:shadow-slate-200/50 dark:hover:shadow-none hover:-translate-y-1.5
        transition-all duration-300 flex flex-col justify-between group relative
        ${isOwn
          ? "border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-400/30"
          : "border-slate-100 dark:border-slate-800"}`}
    >
      {isOwn && (
        <span className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest shadow">
          You
        </span>
      )}

      {/* Share button — always visible on hover */}
      <button
        onClick={handleShare}
        className="absolute top-3 right-3 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 shadow transition opacity-0 group-hover:opacity-100"
        title="Copy profile link"
      >
        <Share2 className="w-3.5 h-3.5" />
      </button>

      {/* Admin Actions */}
      {isAdmin && !isOwn && (
        <div className="absolute top-3 right-10 z-20 flex gap-1.5" onClick={(e) => e.preventDefault()}>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit?.(player.id); }}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 shadow transition"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete?.(player.id); }}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200 shadow transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <CardContent className="p-6 flex flex-col items-center text-center space-y-3 h-full relative">
        {/* Department chip */}
        <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider">
          {player.department.split(" ").slice(0, 2).join(" ")}
        </span>

        {/* Avatar */}
        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-800 shadow-md group-hover:scale-105 transition-transform duration-300 shrink-0 mt-4">
          {player.avatar_url ? (
            <img loading="lazy" src={player.avatar_url} alt={player.full_name} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${avatarGradient(player.full_name)} flex items-center justify-center text-white font-black text-3xl`}>
              {player.full_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Name */}
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

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest ${levelColor[player.playing_level] ?? levelColor.Beginner}`}>
            {player.playing_level}
          </span>
          {player.dominant_hand && (
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 text-[10px] font-extrabold uppercase tracking-widest">
              {player.dominant_hand.split("-")[0]}
            </span>
          )}
        </div>

        {/* Win % + Recent Form */}
        {(winPct !== null || (player.recent_form && player.recent_form.length > 0)) && (
          <div className="flex flex-col items-center gap-1.5 w-full">
            {winPct !== null && (
              <span className="text-xs font-black text-slate-600 dark:text-slate-300">
                {winPct}% win rate · <span className="text-slate-400 font-semibold">{player.win_loss_record}</span>
              </span>
            )}
            {player.recent_form && player.recent_form.length > 0 && (
              <div className="flex gap-1 justify-center">
                {player.recent_form.slice(-5).map((r, i) => (
                  <div
                    key={i}
                    className={`w-5 h-5 rounded text-[9px] font-black flex items-center justify-center text-white
                      ${r === "W" ? "bg-emerald-500" : "bg-rose-500"}`}
                  >
                    {r}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Racket */}
        {player.current_racket && (
          <div className="w-full pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1 text-slate-500 dark:text-slate-400 text-xs font-bold mt-auto">
            <Sword className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="truncate max-w-[150px]">{player.current_racket}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
