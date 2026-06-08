import { useState, useEffect } from 'react';
import { Swords } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useLocation } from 'wouter';
import LogMatchModal from './LogMatchModal';

/**
 * Floating Action Button for quickly logging a match on mobile.
 * Only visible to logged-in users with a player profile.
 * Hidden on pages where the match modal is already accessible (Players, PlayerProfile).
 */
export default function LogMatchFab() {
  const { profile } = useAuth();
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [otherPlayers, setOtherPlayers] = useState<any[]>([]);

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

  if (!profile || shouldHide) return null;

  return (
    <>
      {/* FAB — fixed bottom-left on mobile, hidden on desktop */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed bottom-20 left-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200"
        aria-label="Log a match"
        title="Log a Match"
      >
        <Swords className="w-6 h-6" />
      </button>

      {/* Modal */}
      <LogMatchModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentUser={profile as any}
        otherPlayers={otherPlayers}
        onSuccess={() => setIsOpen(false)}
      />
    </>
  );
}
