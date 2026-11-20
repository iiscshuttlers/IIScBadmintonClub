import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "shuttlers.iisc.com",
  appName: "IISc Shuttlers",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#0a1020",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#0a1020",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      style: "DARK",
      overlaysWebView: false,
      backgroundColor: "#0a1020"
    }
  },
};

export default config;
