/**
 * Listens to partner's Firestore document — decrypts location, battery,
 * walkSafe, trip status, breadcrumbs, saved places, and triggers geofence
 * arrival/departure notifications.
 */
import * as Location from 'expo-location';
import { db, authInstance, doc, updateDoc, onSnapshot } from '../firebase';
import { encryptionService } from '../encryptionService';
import { useLocationStore, SavedPlace } from '../../store/useLocationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { alertService } from '../alertService';
import { notificationService } from '../notificationService';
import { aiService } from '../aiService';

const AI_CHECK_INTERVAL = 15 * 60 * 1000;
let lastAiCheckTime = 0;

function getActiveSecret(coupleId?: string | null): string {
  const { sharedSecret, coupleId: storedCouple } = useAuthStore.getState();
  const cid = coupleId || storedCouple;
  if (sharedSecret) return sharedSecret;
  if (cid) return encryptionService.getLegacySecret(cid);
  return encryptionService.LEGACY_NO_COUPLE_SENTINEL;
}

export function subscribeToPartner(partnerId: string): () => void {
  const partnerRef = doc(db, 'users', partnerId);

  return onSnapshot(partnerRef, async (snapshot) => {
    if (!snapshot?.exists()) return;
    const data = snapshot.data();
    const secret = getActiveSecret();

    // ── Decrypt location ──
    let lat: number | null = null;
    let lng: number | null = null;
    if (data?.locationEnc) {
      const loc = await encryptionService.decryptObject<any>(data.locationEnc, secret);
      if (loc) {
        lat = loc.latitude; lng = loc.longitude;
        useLocationStore.getState().setPartnerLocation({ ...loc, isSharing: data.isSharingLocation ?? true });
      }
    } else if (data?.location) {
      lat = data.location.latitude; lng = data.location.longitude;
      useLocationStore.getState().setPartnerLocation({ ...data.location, isSharing: data.isSharingLocation ?? true });
    }

    // ── Geofence: arrival / departure ──
    // Handled by Firebase Cloud Functions via FCM Data-only messages (Sender-evaluated)


    // ── Decrypt battery status ──
    if (data?.statusEnc) {
      const status = await encryptionService.decryptObject<any>(data.statusEnc, secret);
      if (status) {
        useLocationStore.getState().setPartnerLocation({
          ...useLocationStore.getState().partnerLocation,
          ...status,
          batteryLevel: Math.max(0, status.batteryLevel || 0),
        } as any);
      }
    }

    // ── AI safety analysis ──
    if (data?.locationEnc || data?.statusEnc) {
      const now = Date.now();
      if (now - lastAiCheckTime > AI_CHECK_INTERVAL) {
        lastAiCheckTime = now;
        const partnerLoc = useLocationStore.getState().partnerLocation;
        if (partnerLoc) {
          aiService.analyzeSafetyContext({
            latitude: partnerLoc.latitude,
            longitude: partnerLoc.longitude,
            batteryLevel: (partnerLoc as any).batteryLevel / 100 || 1,
            isCharging: (partnerLoc as any).isCharging || false,
            timeOfDay: new Date().toLocaleTimeString(),
            isNavigating: !!data?.trip || !!data?.walkSafe,
            partnerName: useAuthStore.getState().currentUserProfile?.partnerNickname || 'Partner',
          }).then(insight => {
            useLocationStore.getState().setAiInsight(insight);
            if (insight.status !== 'safe') notificationService.sendLocalNotification('🛡️ Luvv Guard', insight.message);
          });
        }
      }
    }

    // ── Partner saved places ──
    if (data?.savedPlaces) {
      const { coupleId } = useAuthStore.getState();
      if (typeof data.savedPlaces === 'string' && coupleId) {
        encryptionService.loadSharedSecret(coupleId).then(sec => {
          if (sec) encryptionService.decryptObject<SavedPlace[]>(data.savedPlaces, sec).then(decrypted => {
            if (decrypted) useLocationStore.getState().setPartnerSavedPlaces(decrypted);
          });
        });
      } else if (Array.isArray(data.savedPlaces)) {
        useLocationStore.getState().setPartnerSavedPlaces(data.savedPlaces);
      }
    }

    // ── Partner trip ──
    if (data?.trip) useLocationStore.getState().setPartnerTrip(data.trip);

    // ── Partner walkSafe ──
    if (data?.walkSafe) {
      const prev = useLocationStore.getState().partnerWalkSafe;
      const current = data.walkSafe;
      const partnerName = useAuthStore.getState().currentUserProfile?.partnerNickname || useAuthStore.getState().partner?.displayName || 'Partner';

      let destName = current.destinationName || 'destination';
      if (current.destinationNameEnc) {
        try { destName = await encryptionService.decryptField(current.destinationNameEnc, secret, useAuthStore.getState().coupleId); }
        catch { /* keep fallback */ }
      }

      if (current.isActive && !prev?.isActive) {
        const eta = current.durationMinutes || 30;
        const title = '🚶‍♂️ Walk Safe Started';
        const msg = `Your ${partnerName} started a trip to ${destName} — ${eta} min. 💖🚗✨`;
        alertService.triggerAlert('info', title, msg);
        notificationService.sendLocalNotification(title, msg).catch(() => {});
      }

      useLocationStore.getState().setPartnerWalkSafe({ ...current, destinationName: destName });

      if (current.isActive && current.status !== prev?.status) {
        if (current.status === 'overdue' || current.status === 'warning') {
          alertService.triggerAlert('warning', `⚠️ Partner ${current.status.toUpperCase()}`, `${partnerName} is ${current.status} on their trip to ${destName}.`);
        }
      }
    } else {
      const prev = useLocationStore.getState().partnerWalkSafe;
      const partnerName = useAuthStore.getState().currentUserProfile?.partnerNickname || useAuthStore.getState().partner?.displayName || 'Partner';
      if (prev?.isActive && prev.status === 'arrived') {
        const title = '✅ Arrived Safely';
        const msg = `Your ${partnerName} has arrived at ${prev.destinationName || 'destination'} safely! 🏡💕✨`;
        alertService.triggerAlert('info', title, msg);
        notificationService.sendLocalNotification(title, msg).catch(() => {});
      }
      useLocationStore.getState().setPartnerWalkSafe(null);
    }

    // ── Partner breadcrumbs ──
    if (data?.lastCompletedPath && data?.lastCompletedTime) {
      useLocationStore.setState({ partnerLastCompletedPath: data.lastCompletedPath, partnerLastCompletedTime: data.lastCompletedTime });
    }
  }, (err) => console.warn('[LocationService] Partner listener error:', err));
}

export async function syncSavedPlaces(specificPlaces?: SavedPlace[]): Promise<void> {
  const userId = authInstance.currentUser?.uid;
  if (!userId) return;
  const savedPlaces = specificPlaces || useLocationStore.getState().savedPlaces;
  const { coupleId } = useAuthStore.getState();
  try {
    let dataToSync: any = { savedPlaces };
    if (coupleId) {
      const sec = await encryptionService.loadSharedSecret(coupleId);
      if (sec) dataToSync.savedPlaces = await encryptionService.encryptObject(savedPlaces, sec);
    }
    await updateDoc(doc(db, 'users', userId), dataToSync);
  } catch (err) {
    console.error('[LocationService] syncSavedPlaces failed:', err);
  }
}

export async function syncTripStatus(): Promise<void> {
  const userId = authInstance.currentUser?.uid;
  if (!userId) return;
  const { isTripActive, destination } = useLocationStore.getState();
  try {
    await updateDoc(doc(db, 'users', userId), { trip: { isActive: isTripActive, destination } });
  } catch (err) {
    console.error('[LocationService] syncTripStatus failed:', err);
  }
}
