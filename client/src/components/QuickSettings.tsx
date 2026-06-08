import { useState, useEffect } from 'react';
import { Settings, Palette, Activity, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function QuickSettings() {
  const { accent, setAccent } = useTheme();
  const { profile, refreshProfile } = useAuth();
  const [updating, setUpdating] = useState(false);

  // Fallback status if none found
  const currentStatus = (profile as any)?.status || 'looking';

  const updateStatus = async (newStatus: string) => {
    if (!profile?.id) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('players')
        .update({ status: newStatus })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Live status updated!");
    } catch (err: any) {
      toast.error("Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const statusConfig = [
    { id: 'looking', label: 'Looking for Match', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950' },
    { id: 'playing', label: 'Playing Right Now', color: 'text-amber-500 bg-amber-50 dark:bg-amber-950' },
    { id: 'resting', label: 'Resting / Injured', color: 'text-rose-500 bg-rose-50 dark:bg-rose-950' },
  ];

  const themes = [
    { id: 'emerald', bg: 'bg-emerald-500' },
    { id: 'violet', bg: 'bg-violet-500' },
    { id: 'rose', bg: 'bg-rose-500' },
    { id: 'amber', bg: 'bg-amber-500' },
    { id: 'blue', bg: 'bg-blue-500' },
    { id: 'cyberpunk', bg: 'bg-black border border-[#00ffcc] shadow-[0_0_8px_#00ffcc]' },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" title="Settings & Appearance">
          <Settings className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-64 p-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl">
        {/* APP THEME COLOR */}
        <div className="mb-2">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" /> App Theme Color
          </div>
          <div className="flex flex-wrap items-center gap-2 px-1">
            {themes.map(color => (
              <div 
                key={color.id} 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAccent?.(color.id as any); }}
                className={`w-7 h-7 rounded-full cursor-pointer transition-transform ${color.bg} ${accent === color.id ? 'ring-2 ring-offset-2 ring-slate-800 dark:ring-white scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                title={`Theme: ${color.id}`}
              />
            ))}
          </div>
        </div>

        {profile?.id && (
          <>
            <DropdownMenuSeparator className="my-3 bg-slate-100 dark:bg-slate-800" />
            
            {/* LIVE STATUS */}
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Live Status
              </div>
              <div className="flex flex-col gap-1.5">
                {statusConfig.map(status => {
                  const isActive = currentStatus === status.id;
                  return (
                    <button
                      key={status.id}
                      disabled={updating}
                      onClick={(e) => { e.preventDefault(); updateStatus(status.id); }}
                      className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold transition-colors ${isActive ? status.color + " shadow-sm border border-current/10" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                    >
                      {status.label}
                      {isActive && <Check className="w-4 h-4" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
