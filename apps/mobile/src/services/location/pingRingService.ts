/**
 * Ping / ring request service — heartbeat pings, ring signals, location-on-demand.
 */
import { db, authInstance, doc, updateDoc, onSnapshot } from '../firebase';
import { encryptionService } from '../encryptionService';
import { useAuthStore } from '../../store/useAuthStore';
import { alertService } from '../alertService';
import { streakService } from '../streakService';
import { syncLocation } from './tracking';
import * as Location from 'expo-location';

function getActiveSecret(): string {
  const { sharedSecret, coupleId } = useAuthStore.getState();
  if (sharedSecret) return sharedSecret;
  if (coupleId) return encryptionService.getLegacySecret(coupleId);
  return encryptionService.LEGACY_NO_COUPLE_SENTINEL;
}

export async function sendPing(partnerId: string): Promise<void> {
  const { user } = useAuthStore.getState();
  if (!partnerId || !user) {
    console.error('[Ping] Missing partnerId or user');
    return;
  }
  try {
    const secret = getActiveSecret();
    const payload = { from: user.uid, timestamp: Date.now(), pingId: Math.random().toString(36).substring(7), type: 'heartbeat' };
    const encrypted = await encryptionService.encryptObject(payload, secret);
    await updateDoc(doc(db, 'users', partnerId), { incomingPingEnc: encrypted, incomingPingTs: payload.timestamp });
    streakService.recordInteraction('ping');
  } catch (err) {
    console.error('[Ping] Firestore write failed:', err);
  }
}

export function subscribeToIncomingPings(userId: string, onPing: (ping: any) => void): () => void {
  if (!userId) return () => {};
  const userRef = doc(db, 'users', userId);

  return onSnapshot(userRef, async (snapshot) => {
    if (!snapshot?.exists()) return;
    const data = snapshot.data();
    if (!data) return;
    const secret = getActiveSecret();

    if (data.incomingPingEnc) {
      const ping = await encryptionService.decryptObject<any>(data.incomingPingEnc, secret);
      if (ping) {
        onPing(ping);
        alertService.triggerHeartbeatHaptics();
        try { await updateDoc(userRef, { incomingPingEnc: null, incomingPingTs: null }); } catch { /* ignore */ }
      }
    } else if (data.incomingPing) {
      onPing(data.incomingPing);
      alertService.triggerHeartbeatHaptics();
      try { await updateDoc(userRef, { incomingPing: null }); } catch { /* ignore */ }
    }
  }, (err) => console.warn('[Ping] Listener error:', err));
}

export async function requestPartnerLocationUpdate(partnerId: string): Promise<void> {
  if (!partnerId) return;
  try {
    await updateDoc(doc(db, 'users', partnerId), { locationRequestTs: Date.now() });
  } catch (err) {
    console.error('[LocationService] requestPartnerLocationUpdate failed:', err);
  }
}

export function subscribeToLocationRequests(userId: string): () => void {
  if (!userId) return () => {};
  const userRef = doc(db, 'users', userId);
  const startTime = Date.now();

  return onSnapshot(userRef, async (snapshot) => {
    if (!snapshot?.exists()) return;
    const data = snapshot.data();
    if (data?.locationRequestTs && data.locationRequestTs > startTime) {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (loc) await syncLocation(loc);
      } catch (err) {
        console.warn('[LocationService] On-demand sync failed:', err);
      }
    }
  }, (err) => console.warn('[LocationService] Location request listener error:', err));
}

export async function sendRingRequest(partnerId: string): Promise<void> {
  if (!partnerId) return;
  try {
    await updateDoc(doc(db, 'users', partnerId), { ringRequestTs: Date.now() });
  } catch (err) {
    console.error('[LocationService] sendRingRequest failed:', err);
  }
}

export function subscribeToRingRequests(userId: string, onRing: () => void): () => void {
  if (!userId) return () => {};
  const userRef = doc(db, 'users', userId);
  let lastHandledTs = Date.now();

  return onSnapshot(userRef, (snapshot) => {
    if (!snapshot?.exists()) return;
    const data = snapshot.data();
    if (data?.ringRequestTs && data.ringRequestTs > lastHandledTs) {
      lastHandledTs = data.ringRequestTs;
      onRing();
    }
  }, (err) => console.warn('[LocationService] Ring request listener error:', err));
}

export async function clearRingRequest(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await updateDoc(doc(db, 'users', userId), { ringRequestTs: null });
  } catch (err) {
    console.error('[LocationService] clearRingRequest failed:', err);
  }
}
