import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, Shield, Zap, Target, Star, Swords, Award, Brain, Heart, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface EndorsementsWidgetProps {
  playerId: string;
}

const SKILLS = [
  { id: "Smash", label: "Powerful Smash", icon: <Zap className="w-3.5 h-3.5 text-amber-500" /> },
  { id: "Defense", label: "Iron Defense", icon: <Shield className="w-3.5 h-3.5 text-blue-500" /> },
  { id: "Agility", label: "Court Coverage", icon: <Target className="w-3.5 h-3.5 text-emerald-500" /> },
  { id: "Net Play", label: "Net Play", icon: <Swords className="w-3.5 h-3.5 text-rose-500" /> },
  { id: "Stamina", label: "Endless Stamina", icon: <Heart className="w-3.5 h-3.5 text-pink-500" /> },
  { id: "Tactics", label: "Tactical Genius", icon: <Brain className="w-3.5 h-3.5 text-purple-500" /> }
];

const BEHAVIORS = [
  { id: "Fair Play", label: "Fair Play", icon: <Award className="w-3.5 h-3.5 text-emerald-500" /> },
  { id: "Great Attitude", label: "Great Attitude", icon: <Star className="w-3.5 h-3.5 text-amber-400" /> },
  { id: "Team Player", label: "Good Partner", icon: <ThumbsUp className="w-3.5 h-3.5 text-blue-400" /> }
];

export function PlayerEndorsementsWidget({ playerId }: EndorsementsWidgetProps) {
  const { user, profile } = useAuth();
  const [endorsements, setEndorsements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const isOwnProfile = profile?.id === playerId;

  const fetchEndorsements = async () => {
    try {
      const { data, error } = await supabase
        .from("player_endorsements")
        .select("category, trait, endorser_id")
        .eq("endorsed_player_id", playerId);

      if (error) throw error;
      setEndorsements(data || []);
    } catch (err) {
      console.error("Failed to fetch endorsements", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (playerId) fetchEndorsements();
  }, [playerId]);

  const handleVote = async (category: "skill" | "behavior", trait: string) => {
    if (!profile?.id) {
      toast.error("You must be logged in to endorse someone.");
      return;
    }
    if (isOwnProfile) {
      toast.error("You cannot endorse yourself!");
      return;
    }

    try {
      const { error } = await supabase.rpc("upsert_player_endorsement", {
        p_endorsed_player_id: playerId,
        p_endorser_id: profile.id,
        p_category: category,
        p_trait: trait
      });

      if (error) throw error;

      // Optimistically update local state
      setEndorsements(prev => {
        // Remove old vote for this category from this user
        const filtered = prev.filter(e => !(e.endorser_id === profile.id && e.category === category));
        // Add new vote
        return [...filtered, { category, trait, endorser_id: profile.id }];
      });

      toast.success(`Endorsed for ${trait}!`);
    } catch (err: any) {
      toast.error("Failed to cast endorsement", { description: err.message });
    }
  };

  if (loading) return <div className="h-20 animate-pulse bg-slate-100 dark:bg-white/5 rounded-xl"></div>;

  const getTraitCount = (trait: string) => endorsements.filter(e => e.trait === trait).length;
  const hasUserVotedForTrait = (trait: string) => endorsements.some(e => e.trait === trait && e.endorser_id === profile?.id);

  // Filter lists to only show items that have votes, unless expanded or it's not our own profile
  const visibleSkills = isExpanded || !isOwnProfile ? SKILLS : SKILLS.filter(s => getTraitCount(s.id) > 0);
  const visibleBehaviors = isExpanded || !isOwnProfile ? BEHAVIORS : BEHAVIORS.filter(b => getTraitCount(b.id) > 0);

  if (isOwnProfile && visibleSkills.length === 0 && visibleBehaviors.length === 0) {
    return null; // Don't show empty widget on own profile
  }

  const renderChips = (items: any[], category: "skill" | "behavior") => {
    return items.map((item) => {
      const count = getTraitCount(item.id);
      const isVoted = hasUserVotedForTrait(item.id);

      if (isOwnProfile && count === 0) return null;

      return (
        <button
          key={item.id}
          onClick={() => handleVote(category, item.id)}
          disabled={isOwnProfile}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border
            ${isVoted 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
              : count > 0
                ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
                : 'bg-transparent border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-emerald-400 hover:text-emerald-500'
            }
            ${isOwnProfile ? 'cursor-default' : 'cursor-pointer hover:shadow-sm'}
          `}
        >
          {item.icon}
          {item.label}
          {count > 0 && (
            <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] ${isVoted ? 'bg-emerald-500/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
              {count}
            </span>
          )}
          {!isOwnProfile && !isVoted && count === 0 && <span className="ml-1 opacity-50">+</span>}
        </button>
      );
    });
  };

  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl p-5 border border-slate-200 dark:border-white/8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-white/40">
          Skills & Endorsements
        </h3>
        {isOwnProfile && (visibleSkills.length < SKILLS.length || visibleBehaviors.length < BEHAVIORS.length) && (
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-emerald-500 hover:underline flex items-center gap-1"
          >
            {isExpanded ? "Show Less" : "Show All"}
            <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Gameplay</div>
          <div className="flex flex-wrap gap-2">
            {renderChips(visibleSkills, "skill")}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Sportsmanship</div>
          <div className="flex flex-wrap gap-2">
            {renderChips(visibleBehaviors, "behavior")}
          </div>
        </div>
      </div>
      
      {!isOwnProfile && (
        <p className="text-[9px] text-slate-400 mt-4 text-center">
          You can endorse exactly 1 Gameplay skill and 1 Sportsmanship behavior. Your vote is anonymous.
        </p>
      )}
    </div>
  );
}
