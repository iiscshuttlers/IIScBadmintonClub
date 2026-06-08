import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';

export function usePushNotifications(userId: string | undefined) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !userId) return;

    let isRegistered = false;

    const registerPush = async () => {
      try {
        const permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          const requested = await PushNotifications.requestPermissions();
          if (requested.receive !== 'granted') return;
        } else if (permStatus.receive !== 'granted') {
          return; // Permission denied
        }

        await PushNotifications.register();
      } catch (err) {
        console.warn('Failed to register push notifications', err);
      }
    };

    registerPush();

    const addListeners = async () => {
      await PushNotifications.addListener('registration', async (token) => {
        // Save FCM token to Supabase for backend to use when user is offline
        if (userId && token.value) {
          await supabase.from('push_tokens').upsert(
            { user_id: userId, token: token.value, platform: Capacitor.getPlatform() },
            { onConflict: 'token' }
          );
        }
      });

      await PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on registration: ' + JSON.stringify(error));
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received: ' + JSON.stringify(notification));
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push action performed: ' + JSON.stringify(notification));
        // E.g., navigate to pending matches
        window.location.href = `${import.meta.env.BASE_URL}player/${userId}`;
      });
      isRegistered = true;
    };

    addListeners();

    return () => {
      if (isRegistered) {
        PushNotifications.removeAllListeners();
      }
    };
  }, [userId]);
}
