import { useState, useEffect } from 'react';
import { Swords, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useLocation } from 'wouter';
import LogMatchModal from './LogMatchModal';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Floating Action Button for quickly logging a match on mobile.
 * Only visible to logged-in users with a player profile.
 * Hidden on pages where the match modal is already accessible (Players, PlayerProfile).
 *
 * If the user played within the last 2 hours, the FAB morphs into a "Quick Rematch"
 * button that pre-selects the same opponent and skips the selection screen.
 */
export default function LogMatchFab() {
  const { profile } = useAuth();
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [otherPlayers, setOtherPlayers] = useState<any[]>([]);
  const [recentOpponent, setRecentOpponent] = useState<any | null>(null);
  const [isRematch, setIsRematch] = useState(false);

  // Hide on pages that already have match-logging UI
  const hideOnPages = ['/players', '/player/', '/profile/setup', '/join', '/admin'];
  const shouldHide = hideOnPages.some(p => location.startsWith(p));

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from('players')
      .select('id, full_name, avatar_url, gender')
      .neq('id', profile.id)
      .is('deleted_at', null)
      .order('full_name')
      .then(({ data }) => {
        if (data) setOtherPlayers(data);
      });
  }, [profile?.id]);

  // Check if user played in the last 2 hours for Quick Rematch
  useEffect(() => {
    if (!profile?.id) return;
    const since = new Date(Date.now() - TWO_HOURS_MS).toISOString();
    supabase
      .from('matches')
      .select('player1_id, player2_id, player1:players!player1_id(id, full_name, avatar_url), player2:players!player2_id(id, full_name, avatar_url)')
      .eq('status', 'confirmed')
      .gte('created_at', since)
      .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const m = data[0];
          const opp = m.player1_id === profile.id ? m.player2 : m.player1;
          if (opp) {
            setRecentOpponent(opp);
            setIsRematch(true);
          }
        } else {
          setRecentOpponent(null);
          setIsRematch(false);
        }
      });
  }, [profile?.id]);

  if (!profile || shouldHide) return null;

  return (
    <>
      {isRematch && recentOpponent ? (
        <button
          onClick={() => setIsOpen(true)}
          className="lg:hidden fixed bottom-20 left-5 z-40 h-14 px-4 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all duration-200"
          aria-label="Quick Rematch"
          title={`Quick Rematch vs ${recentOpponent.full_name}`}
        >
          <Zap className="w-5 h-5 shrink-0" />
          <span className="text-xs font-black">Rematch {recentOpponent.full_name.split(' ')[0]}</span>
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="lg:hidden fixed bottom-20 left-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200"
          aria-label="Log a match"
          title="Log a Match"
        >
          <Swords className="w-6 h-6" />
        </button>
      )}

      <LogMatchModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentUser={profile as any}
        otherPlayers={otherPlayers}
        onSuccess={() => setIsOpen(false)}
        defaultOpponentId={isRematch ? recentOpponent?.id : undefined}
      />
    </>
  );
}
