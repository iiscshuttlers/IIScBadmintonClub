import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { showWebNotification } from './usePushNotifications';

/**
 * Subscribes to realtime INSERT events on the `matches` table.
 * When a match involving the current user is created (by someone else),
 * triggers a blinking shuttle animation and plays a smash sound.
 */
export function useMatchNotification() {
  const { profile } = useAuth();
  const [notification, setNotification] = useState<{
    id: string;
    opponentName?: string;
  } | null>(null);
  const shownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('match-alert-overlay')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
        },
        async (payload) => {
          const match = payload.new as any;
          if (!match) return;

          // Only alert if this match involves the current player
          const isInvolved =
            match.player1_id === profile.id ||
            match.player2_id === profile.id ||
            match.team1_partner_id === profile.id ||
            match.team2_partner_id === profile.id;

          if (!isInvolved) return;

          // Removed early return so submitter also gets visual feedback
          // Deduplicate
          if (shownRef.current.has(match.id)) return;
          shownRef.current.add(match.id);

          // Determine who the opponent is (the submitter)
          const challengerId = match.submitted_by;
          const isSubmitter = match.submitted_by === profile.id;

          // Fetch opponent name for the notification
          let opponentName = 'Someone';
          if (challengerId && !isSubmitter) {
            const { data } = await supabase
              .from('players')
              .select('full_name')
              .eq('id', challengerId)
              .single();
            if (data) opponentName = data.full_name;
          }

          // Play smash sound (in-app)
          playSmashSound();

          // Fire browser notification ONLY for the receiver(s)
          if (!isSubmitter) {
            const alertName = opponentName || 'Someone';
            showWebNotification(
              '🏸 New Match Challenge!',
              `${alertName} just logged a match against you. Open the app to confirm.`,
              () => {
                window.location.href = `${import.meta.env.BASE_URL || '/'}matches`;
              }
            );
          }

          // Show in-app overlay notification (for everyone involved)
          // For submitter, we just say "Match Logged!" instead of "Opponent logged"
          setNotification({ 
            id: match.id, 
            opponentName: isSubmitter ? 'Success! Match logged' : opponentName 
          });

          // Auto-dismiss after 2 seconds
          setTimeout(() => {
            setNotification(null);
          }, 2000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  return notification;
}

/**
 * Generates and plays a short "smash" sound using Web Audio API.
 * No external audio file needed — synthesised on the fly.
 */
function playSmashSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Impact hit — short noise burst
    const bufferLen = ctx.sampleRate * 0.15; // 150ms
    const buffer = ctx.createBuffer(1, bufferLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferLen; i++) {
      // White noise with fast exponential decay
      const t = i / ctx.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 30);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Bandpass filter to shape the "thwack"
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 800;
    bandpass.Q.value = 1.5;

    // High shelf for brightness
    const highShelf = ctx.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 2000;
    highShelf.gain.value = 6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    noise.connect(bandpass);
    bandpass.connect(highShelf);
    highShelf.connect(gain);
    gain.connect(ctx.destination);

    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + 0.15);

    // Add a sharp "ping" overtone for the shuttle cork hit
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.3, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);

    // Clean up context after sound finishes
    setTimeout(() => ctx.close(), 500);
  } catch (e) {
    console.warn('Could not play smash sound:', e);
  }
}
