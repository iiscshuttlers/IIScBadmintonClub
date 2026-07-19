import { registerPlugin } from '@capacitor/core';

export interface MediaPermissionsPlugin {
  requestVideoPermission(): Promise<{ granted: boolean }>;
}

export const MediaPermissions = registerPlugin<MediaPermissionsPlugin>('MediaPermissions');
