import { registerSW } from 'virtual:pwa-register';

registerSW({
  onNeedRefresh() {
    // 🔥 Auto reload when new version available
    window.location.reload();
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});
