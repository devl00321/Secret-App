/**
 * expo-task-manager background location task.
 * MUST be defined at the module root — not inside any function or component.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { doc, setDoc } from '../firebase';
import { db, authInstance } from '../firebase';
import { encryptionService } from '../encryptionService';
import { useAuthStore } from '../../store/useAuthStore';

export const LOCATION_TASK_NAME = 'background-location-task';

function getActiveSecret(): string {
  const { sharedSecret, coupleId } = useAuthStore.getState();
  if (sharedSecret) return sharedSecret;
  if (coupleId) return encryptionService.getLegacySecret(coupleId);
  return encryptionService.LEGACY_NO_COUPLE_SENTINEL;
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    if (error.code === 1 || error.message?.includes('kCLErrorDomain Code 1')) {
      console.warn('[BG Location] Location access denied — ensure "Always" permission is granted.');
    } else if (error.code === 0 || error.message?.includes('kCLErrorDomain Code 0')) {
      console.warn('[BG Location] Location temporarily unknown (Code 0).');
    } else {
      console.error('[BG Location] Error:', error);
    }
    return;
  }

  if (data) {
    const location = (data.locations as Location.LocationObject[])[0];
    const userId = authInstance.currentUser?.uid;
    if (location && userId) {
      try {
        const secret = getActiveSecret();
        const payload = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          heading: location.coords.heading,
          speed: location.coords.speed,
          timestamp: Date.now(),
        };
        const encrypted = await encryptionService.encryptObject(payload, secret);
        await setDoc(doc(db, 'users', userId), { locationEnc: encrypted }, { merge: true });
        
        // Also check geofences to detect leaving/arriving while in background
        const { checkGeofences } = require('./tracking');
        await checkGeofences(location, secret, userId);
      } catch (err) {
        console.warn('[BG Location] Firestore sync failed:', err);
      }
    }
  }
});
