import React, { useState, useEffect } from 'react';
import { Bell, X, Save, Clock, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface MatchReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId?: string; // If undefined, it's global settings
  userId: string;
  initialGlobalMins?: number | null;
}

export function MatchReminderModal({ isOpen, onClose, matchId, userId, initialGlobalMins }: MatchReminderModalProps) {
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [minutes, setMinutes] = useState<string>("30");

  const isGlobal = !matchId;

  // Load existing preference
  useEffect(() => {
    if (!isOpen) return;

    if (isGlobal) {
      if (initialGlobalMins !== undefined && initialGlobalMins !== null) {
        setEnabled(true);
        setMinutes(initialGlobalMins.toString());
      } else {
        setEnabled(false);
        setMinutes("30");
      }
    } else {
      // Fetch match specific
      supabase.from("match_reminders")
        .select("remind_before_mins")
        .eq("match_id", matchId)
        .eq("user_id", userId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (data && !error) {
            setEnabled(true);
            setMinutes(data.remind_before_mins.toString());
          } else {
            setEnabled(false);
            if (initialGlobalMins !== undefined && initialGlobalMins !== null) {
              setMinutes(initialGlobalMins.toString());
            } else {
              setMinutes("30");
            }
          }
        });
    }
  }, [isOpen, matchId, userId, isGlobal, initialGlobalMins]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const parsedMins = parseInt(minutes, 10);
      if (enabled && (isNaN(parsedMins) || parsedMins <= 0)) {
        toast.error("Please enter a valid number of minutes.");
        setLoading(false);
        return;
      }

      if (isGlobal) {
        const { error } = await supabase
          .from("players")
          .update({ default_match_reminder_mins: enabled ? parsedMins : null })
          .eq("id", userId);
        
        if (error) throw error;
        toast.success(enabled ? `Global reminders set for ${parsedMins} minutes before match` : "Global match reminders disabled");
      } else {
        if (enabled) {
          const { error } = await supabase
            .from("match_reminders")
            .upsert({
              match_id: matchId,
              user_id: userId,
              remind_before_mins: parsedMins,
              sent_at: null // reset sent status
            }, { onConflict: 'match_id,user_id' });
          if (error) throw error;
          toast.success(`Reminder set for ${parsedMins} minutes before this match`);
        } else {
          // Disable -> delete record
          const { error } = await supabase
            .from("match_reminders")
            .delete()
            .eq("match_id", matchId)
            .eq("user_id", userId);
          if (error && error.code !== 'PGRST116') throw error; // Ignore not found
          toast.success("Reminder removed for this match");
        }
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save reminder setting.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Bell className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">
              {isGlobal ? "Match Reminders" : "Set Match Reminder"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isGlobal 
              ? "We'll send you an in-app notification, email, and push notification before your upcoming matches."
              : "Set a custom reminder for this specific match. This will override your global setting if you have one."}
          </p>

          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Enable Reminder</p>
              <p className="text-xs text-slate-500">Turn notifications {enabled ? 'on' : 'off'}</p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {enabled && (
            <div className="space-y-3 animate-in slide-in-from-top-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Remind me before match (in minutes):
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Clock className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  min="1"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all text-slate-900 dark:text-white font-medium"
                  placeholder="e.g. 30"
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-slate-900 bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Preference
          </button>
        </div>
      </div>
    </div>
  );
}
