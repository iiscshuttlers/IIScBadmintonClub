import { useState, useEffect } from "react";
import { fetchPlayerEndorsements, upsertPlayerEndorsement } from "@/services/socialService";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, Shield, Zap, Target, Star, Swords, Award, Brain, Heart, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface EndorsementsWidgetProps {
  playerId: string;
}

const SKILLS = [
  { id: "Smash", label: "Powerful Smash", icon: <Zap className="w-3.5 h-3.5 text-warning" /> },
  { id: "Defense", label: "Iron Defense", icon: <Shield className="w-3.5 h-3.5 text-info" /> },
  { id: "Agility", label: "Court Coverage", icon: <Target className="w-3.5 h-3.5 text-primary" /> },
  { id: "Net Play", label: "Net Play", icon: <Swords className="w-3.5 h-3.5 text-danger" /> },
  { id: "Stamina", label: "Endless Stamina", icon: <Heart className="w-3.5 h-3.5 text-individual" /> },
  { id: "Tactics", label: "Tactical Genius", icon: <Brain className="w-3.5 h-3.5 text-individual" /> }
];

const BEHAVIORS = [
  { id: "Fair Play", label: "Fair Play", icon: <Award className="w-3.5 h-3.5 text-primary" /> },
  { id: "Great Attitude", label: "Great Attitude", icon: <Star className="w-3.5 h-3.5 text-gold" /> },
  { id: "Team Player", label: "Good Partner", icon: <ThumbsUp className="w-3.5 h-3.5 text-info" /> }
];

export function PlayerEndorsementsWidget({ playerId }: EndorsementsWidgetProps) {
  const { user, profile } = useAuth();
  const [endorsements, setEndorsements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const isOwnProfile = profile?.id === playerId;

  const fetchEndorsements = async () => {
    try {
      const data = await fetchPlayerEndorsements(playerId);
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
      await upsertPlayerEndorsement({
        endorsedPlayerId: playerId,
        endorserId: profile.id,
        category,
        trait,
      });

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

  if (loading) return <div className="h-20 animate-pulse bg-foreground/5 rounded-xl"></div>;

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
              ? 'bg-primary/10 border-primary/30 text-primary' 
              : count > 0
                ? 'bg-muted border-border-strong text-soft hover:border-primary'
                : 'bg-transparent border-dashed border-border-strong text-muted-foreground hover:border-primary hover:text-primary'
            }
            ${isOwnProfile ? 'cursor-default' : 'cursor-pointer hover:shadow-sm'}
          `}
        >
          {item.icon}
          {item.label}
          {count > 0 && (
            <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] ${isVoted ? 'bg-primary/20' : 'bg-muted-strong'}`}>
              {count}
            </span>
          )}
          {!isOwnProfile && !isVoted && count === 0 && <span className="ml-1 opacity-50">+</span>}
        </button>
      );
    });
  };

  return (
    <div className="bg-foreground/5 rounded-2xl p-5 border border-foreground/8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-foreground/60">
          Skills & Endorsements
        </h3>
        {isOwnProfile && (visibleSkills.length < SKILLS.length || visibleBehaviors.length < BEHAVIORS.length) && (
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            {isExpanded ? "Show Less" : "Show All"}
            <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Gameplay</div>
          <div className="flex flex-wrap gap-2">
            {renderChips(visibleSkills, "skill")}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Sportsmanship</div>
          <div className="flex flex-wrap gap-2">
            {renderChips(visibleBehaviors, "behavior")}
          </div>
        </div>
      </div>
      
      {!isOwnProfile && (
        <p className="text-[9px] text-muted-foreground mt-4 text-center">
          You can endorse exactly 1 Gameplay skill and 1 Sportsmanship behavior. Your vote is anonymous.
        </p>
      )}
    </div>
  );
}
