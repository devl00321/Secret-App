/**
 * Foreground & background location tracking lifecycle.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { db, authInstance, doc, updateDoc } from '../firebase';
import { encryptionService } from '../encryptionService';
import { useLocationStore } from '../../store/useLocationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { notificationService } from '../notificationService';
import { LOCATION_TASK_NAME } from './backgroundTask';
import { haversineDistance } from './geoUtils';

const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const AI_CHECK_INTERVAL = 15 * 60 * 1000;
let lastAiCheckTime = 0;

function getActiveSecret(): string {
  const { sharedSecret, coupleId } = useAuthStore.getState();
  if (sharedSecret) return sharedSecret;
  if (coupleId) return encryptionService.getLegacySecret(coupleId);
  return encryptionService.LEGACY_NO_COUPLE_SENTINEL;
}

export async function startTracking(): Promise<void> {
  try {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.warn('[LocationService] Foreground permission denied');
      return;
    }

    const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    if (initial) {
      useLocationStore.getState().setUserLocation(initial);
      await syncLocation(initial);
    }

    await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 5000, distanceInterval: 5 },
      async (location) => {
        useLocationStore.getState().setUserLocation(location);
        await syncLocation(location);

        const now = Date.now();
        const { walkSafe, isTripActive } = useLocationStore.getState();
        const interval = __DEV__ ? 30000 : AI_CHECK_INTERVAL;

        if (now - lastAiCheckTime > interval && !isTripActive && !walkSafe?.isActive) {
          lastAiCheckTime = now;
          import('../safetyService').then(({ safetyService }) => {
            const result = safetyService.getMapIntelligence(isTripActive, walkSafe?.isActive || false);
            if (result?.shouldAlert) {
              notificationService.sendLocalNotification('🛡️ Safety Suggestion', `Luvv Guard: ${result.reason}. Tap to enable Reach Safely mode.`);
            }
          });
        }
      }
    );

    if (!IS_EXPO_GO || Platform.OS !== 'ios') {
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus === 'granted') {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 30000,
          distanceInterval: 10,
          deferredUpdatesInterval: 60000,
          deferredUpdatesDistance: 100,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Luvv Guard is Active',
            notificationBody: 'Keeping you and your partner safe in the background',
            notificationColor: '#FF6B6B',
          },
        });
      }
    }
  } catch (err) {
    console.error('[LocationService] startTracking failed:', err);
  }
}

export async function stopTracking(): Promise<void> {
  try {
    const isRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch (err) {
    console.warn('[LocationService] stopTracking failed:', err);
  }
}

export async function syncLocation(location: Location.LocationObject): Promise<void> {
  const userId = authInstance.currentUser?.uid;
  if (!userId) return;

  try {
    const secret = getActiveSecret();
    const battery = await Battery.getPowerStateAsync();
    const locationPayload = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      heading: location.coords.heading,
      speed: location.coords.speed,
      timestamp: Date.now(),
    };
    const statusPayload = {
      batteryLevel: Math.max(0, Math.round(battery.batteryLevel * 100)),
      isCharging: battery.batteryState === Battery.BatteryState.CHARGING,
      lastSeen: Date.now(),
    };

    const [encryptedLocation, encryptedStatus] = await Promise.all([
      encryptionService.encryptObject(locationPayload, secret),
      encryptionService.encryptObject(statusPayload, secret),
    ]);

    await updateDoc(doc(db, 'users', userId), {
      locationEnc: encryptedLocation,
      statusEnc: encryptedStatus,
    });

    // Check geofences after location sync
    await checkGeofences(location, secret, userId);
  } catch (err) {
    console.error('[LocationService] syncLocation failed:', err);
  }
}

export async function checkGeofences(location: Location.LocationObject, secret: string, userId: string): Promise<void> {
  try {
    const store = useLocationStore.getState();
    const places = store.savedPlaces;
    const lastSafePlaceId = store.userLastSafePlaceId;
    const lat = location.coords.latitude;
    const lng = location.coords.longitude;

    if (!places || places.length === 0) return;

    let inside: any = null;
    for (const place of places) {
      if (haversineDistance(lat, lng, place.latitude, place.longitude) < (place.radius || 200)) {
        inside = place;
        break;
      }
    }

    if (inside) {
      if (lastSafePlaceId !== inside.id) {
        // Arrived at a new place
        store.setUserLastSafePlaceId(inside.id);
        const placeNameEnc = await encryptionService.encryptField(inside.name, secret);
        await updateDoc(doc(db, 'users', userId), {
          geofenceEvent: {
            type: 'arrival',
            placeNameEnc,
            timestamp: Date.now()
          }
        });
      }
    } else if (lastSafePlaceId !== null) {
      const left = places.find(p => p.id === lastSafePlaceId);
      if (left && haversineDistance(lat, lng, left.latitude, left.longitude) > (left.radius || 200) + 50) {
        // Left the place
        store.setUserLastSafePlaceId(null);
        const placeNameEnc = await encryptionService.encryptField(left.name, secret);
        await updateDoc(doc(db, 'users', userId), {
          geofenceEvent: {
            type: 'departure',
            placeNameEnc,
            timestamp: Date.now()
          }
        });
      } else if (!left) {
        store.setUserLastSafePlaceId(null);
      }
    }
  } catch (err) {
    console.warn('[LocationService] checkGeofences failed:', err);
  }
}
