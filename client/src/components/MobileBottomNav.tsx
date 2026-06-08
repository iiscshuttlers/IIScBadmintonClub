import { useState, useEffect } from 'react';
import { Home, Swords, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useLocation } from 'wouter';
import LogMatchModal from './LogMatchModal';

export default function MobileBottomNav() {
  const { profile } = useAuth();
  const [location, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [otherPlayers, setOtherPlayers] = useState<any[]>([]);

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

  if (!profile) return null;

  // Hide on admin screens
  if (location.startsWith('/admin')) return null;

  return (
    <>
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[60] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pt-1">
        <div className="flex items-center justify-around px-2 pb-2">
          {/* HOME */}
          <button 
            onClick={() => setLocation('/')}
            className={`flex flex-col items-center justify-center w-16 h-12 transition-colors ${location === '/' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
          >
            <Home className={`w-6 h-6 mb-1 ${location === '/' ? 'fill-emerald-500/20' : ''}`} strokeWidth={location === '/' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Home</span>
          </button>

          {/* LOG MATCH (Center FAB-style) */}
          <div className="relative -top-5">
            <button
              onClick={() => setIsOpen(true)}
              className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
            >
              <Swords className="w-6 h-6" />
            </button>
            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
              Log Match
            </span>
          </div>

          {/* PROFILE / MATCHES */}
          <button 
            onClick={() => setLocation(`/player/${profile.id}`)}
            className={`flex flex-col items-center justify-center w-16 h-12 transition-colors ${location.startsWith('/player') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
          >
            <User className={`w-6 h-6 mb-1 ${location.startsWith('/player') ? 'fill-emerald-500/20' : ''}`} strokeWidth={location.startsWith('/player') ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Profile</span>
          </button>
        </div>
      </div>

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
