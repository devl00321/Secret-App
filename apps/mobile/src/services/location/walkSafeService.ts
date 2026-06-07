/**
 * Walk Safe (Reach Safely) trip monitor — geofenced arrival detection,
 * overdue/warning escalation, and Firestore sync.
 */
import { Alert } from 'react-native';
import { db, authInstance, doc, updateDoc } from '../firebase';
import { encryptionService } from '../encryptionService';
import { useLocationStore, SavedPlace } from '../../store/useLocationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { notificationService } from '../notificationService';
import { haversineDistance } from './geoUtils';
import { triggerSos } from './sosService';
import { syncTripStatus } from './partnerSubscription';
import * as Location from 'expo-location';

function getActiveSecret(): string {
  const { sharedSecret, coupleId } = useAuthStore.getState();
  if (sharedSecret) return sharedSecret;
  if (coupleId) return encryptionService.getLegacySecret(coupleId);
  return encryptionService.LEGACY_NO_COUPLE_SENTINEL;
}

let _walkSafeInterval: ReturnType<typeof setInterval> | null = null;
let _graceTimeout: ReturnType<typeof setTimeout> | null = null;

export function stopWalkSafeMonitor(): void {
  if (_walkSafeInterval) { clearInterval(_walkSafeInterval); _walkSafeInterval = null; }
  if (_graceTimeout) { clearTimeout(_graceTimeout); _graceTimeout = null; }
}

export async function syncWalkSafe(): Promise<void> {
  const userId = authInstance.currentUser?.uid;
  if (!userId) return;
  const { walkSafe } = useLocationStore.getState();
  const secret = getActiveSecret();

  try {
    const encDestName = walkSafe?.destination?.name
      ? await encryptionService.encryptField(walkSafe.destination.name, secret)
      : null;
    const encPath = walkSafe?.path?.length
      ? await encryptionService.encryptObject(walkSafe.path, secret)
      : null;

    await updateDoc(doc(db, 'users', userId), {
      walkSafe: walkSafe ? {
        isActive: walkSafe.isActive,
        destinationNameEnc: encDestName,
        destinationName: null,
        deadline: walkSafe.deadline,
        durationMinutes: walkSafe.durationMinutes,
        status: walkSafe.status,
        lastCheckDistance: walkSafe.lastCheckDistance,
        pathEnc: encPath,
        path: [],
      } : null,
      lastCompletedPath: useLocationStore.getState().lastCompletedPath || null,
      lastCompletedTime: useLocationStore.getState().lastCompletedTime || null,
    });
  } catch (err) {
    console.error('[WalkSafe] syncWalkSafe failed:', err);
  }
}

export function startWalkSafeMonitor(): void {
  stopWalkSafeMonitor();

  _walkSafeInterval = setInterval(async () => {
    const { walkSafe, userLocation, updateWalkSafe, addToWalkSafePath } = useLocationStore.getState();
    if (!walkSafe?.isActive || !walkSafe.destination || !userLocation) return;

    const distance = haversineDistance(
      userLocation.coords.latitude, userLocation.coords.longitude,
      walkSafe.destination.latitude, walkSafe.destination.longitude
    );
    const now = Date.now();
    const remainingMs = (walkSafe.deadline || 0) - now;
    const remainingMin = remainingMs / 60000;
    const geofenceRadius = walkSafe.destination.radius || 150;

    // Arrived
    if (distance < geofenceRadius) {
      updateWalkSafe({ status: 'arrived', lastCheckDistance: distance });
      stopWalkSafeMonitor();
      await syncWalkSafe();
      notificationService.sendLocalNotification('✅ Arrived Safely!', `You've reached ${walkSafe.destination.name}. Your partner has been notified.`).catch(() => {});
      setTimeout(async () => {
        const { walkSafe: ws } = useLocationStore.getState();
        import('../activityService').then(({ activityService }) => {
          activityService.logActivity('travel', `Arrived safely at ${ws?.destination?.name || 'destination'} ✅`);
        });
        useLocationStore.getState().endWalkSafe('arrived');
        await syncWalkSafe();
      }, 5000);
      return;
    }

    // Overdue
    if (remainingMs <= 0 && walkSafe.status !== 'overdue') {
      updateWalkSafe({ status: 'overdue', lastCheckDistance: distance });
      await syncWalkSafe();
      Alert.alert(
        '⚠️ Are you safe?',
        `You haven't reached ${walkSafe.destination.name} yet. If you don't respond within 2 minutes, SOS will be triggered.`,
        [
          {
            text: "I'm Safe ✅",
            onPress: async () => {
              stopWalkSafeMonitor();
              useLocationStore.getState().endWalkSafe('arrived');
              await syncWalkSafe();
              await syncTripStatus();
              notificationService.sendLocalNotification('✅ Glad you\'re safe!', 'Walk Safe trip ended.').catch(() => {});
            },
          },
          {
            text: '+5 min ⏱️',
            onPress: async () => {
              useLocationStore.getState().extendWalkSafe(5);
              await syncWalkSafe();
              if (_graceTimeout) { clearTimeout(_graceTimeout); _graceTimeout = null; }
              notificationService.sendLocalNotification('⏱️ Timer Extended', 'Added 5 more minutes.').catch(() => {});
            },
          },
        ],
        { cancelable: false }
      );
      _graceTimeout = setTimeout(async () => {
        const current = useLocationStore.getState().walkSafe;
        if (current?.isActive && current?.status === 'overdue') {
          await triggerSos();
          notificationService.sendLocalNotification('🆘 SOS AUTO-TRIGGERED', 'Walk Safe timer expired.').catch(() => {});
        }
      }, 2 * 60 * 1000);
      return;
    }

    // Warning
    if (remainingMin < 2 && remainingMin > 0 && distance > 500 && walkSafe.status === 'traveling') {
      updateWalkSafe({ status: 'warning', lastCheckDistance: distance });
      await syncWalkSafe();
      notificationService.sendLocalNotification('⏰ Running Late', `Less than 2 minutes left but still ${Math.round(distance)}m away.`).catch(() => {});
      return;
    }

    // Normal tick
    addToWalkSafePath(userLocation.coords.latitude, userLocation.coords.longitude);
    updateWalkSafe({ lastCheckDistance: distance });
    await syncWalkSafe();
  }, 10000);
}

export function startWalkSafe(name: string, latitude: number, longitude: number, durationMinutes = 30): void {
  const newPlace: SavedPlace = {
    id: Math.random().toString(36).substring(7),
    name,
    latitude,
    longitude,
    radius: 200,
    type: 'other',
  };
  useLocationStore.getState().startWalkSafe(newPlace, durationMinutes);
  startWalkSafeMonitor();
  syncWalkSafe();
  syncTripStatus();
  import('../activityService').then(({ activityService }) => {
    activityService.logActivity('travel', `Started Walk Safe to ${name} 🚶‍♂️`);
  });
}
