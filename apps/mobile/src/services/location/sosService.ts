/**
 * Couple SOS subscription — listens for active/cleared SOS events,
 * triggers siren/alerts on the partner side, suppresses on the victim side.
 */
import { db, doc, onSnapshot, updateDoc } from '../firebase';
import { encryptionService } from '../encryptionService';
import { useLocationStore } from '../../store/useLocationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { alertService } from '../alertService';
import { notificationService } from '../notificationService';
import { emergencyService } from '../emergencyService';

function getActiveSecret(coupleId?: string | null): string {
  const { sharedSecret, coupleId: storedCouple } = useAuthStore.getState();
  const cid = coupleId || storedCouple;
  if (sharedSecret) return sharedSecret;
  if (cid) return encryptionService.getLegacySecret(cid);
  return encryptionService.LEGACY_NO_COUPLE_SENTINEL;
}

export function subscribeToCoupleSos(coupleId: string, currentUserId: string): () => void {
  const coupleRef = doc(db, 'couples', coupleId);

  return onSnapshot(coupleRef, (snapshot) => {
    if (!snapshot?.exists()) return;
    const data = snapshot.data();
    if (!data) return;

    const rawSos = data.activeSos || null;
    const { isSirenMuted, setSirenMuted, activeSos: prevSos } = useLocationStore.getState();

    // Build decrypted SOS skeleton
    let decryptedSos: any = null;
    if (rawSos) {
      decryptedSos = {
        isActive: rawSos.isActive,
        triggeredBy: rawSos.triggeredBy,
        startTime: rawSos.startTime,
        isSilent: rawSos.isSilent,
        location: null,
      };
    }

    // Async-decrypt coordinates if present
    if (rawSos?.locationEnc) {
      const secret = getActiveSecret(coupleId);
      encryptionService.decryptObject<{ latitude: number; longitude: number }>(rawSos.locationEnc, secret)
        .then((loc) => {
          const cur = useLocationStore.getState().activeSos;
          if (cur?.startTime === decryptedSos?.startTime) {
            useLocationStore.getState().setActiveSos({ ...decryptedSos, location: loc });
          }
        })
        .catch(() => useLocationStore.getState().setActiveSos(decryptedSos));
      useLocationStore.getState().setActiveSos(decryptedSos);
    } else {
      useLocationStore.getState().setActiveSos(decryptedSos);
    }

    // Silent SOS victim suppression
    if (rawSos?.isActive && rawSos.isSilent && rawSos.triggeredBy === currentUserId) {
      alertService.setVictimSilence(true);
      return;
    } else if (!rawSos?.isActive) {
      alertService.setVictimSilence(false);
    }

    const justBecameActive = rawSos?.isActive && !prevSos?.isActive;

    if (justBecameActive && rawSos?.triggeredBy !== currentUserId) {
      if (!isSirenMuted) {
        alertService.triggerAlert('critical', '🆘 SOS EMERGENCY', 'Your partner needs help immediately!');
      }
      // Emergency AI insight
      import('../safetyService').then(({ safetyService }) => {
        const partnerLoc = useLocationStore.getState().partnerLocation;
        const insight = safetyService.getEmergencyInsight({
          batteryLevel: partnerLoc?.batteryLevel,
          partnerName: useAuthStore.getState().partner?.displayName || 'Partner',
          isSos: true,
          isSilent: rawSos?.isSilent,
        });
        useLocationStore.getState().setSafetyInsight(insight);
      });
    } else if (justBecameActive && rawSos?.triggeredBy === currentUserId) {
      alertService.setVictimSilence(true);
    } else if (!rawSos?.isActive && prevSos?.isActive) {
      alertService.stopSiren();
      alertService.setVictimSilence(false);
      setSirenMuted(false);
      useLocationStore.getState().setSafetyInsight(null);
    }
  }, (err) => console.warn('[LocationService] SOS listener error:', err));
}

export async function triggerSos(isSilent = false): Promise<void> {
  const { user, coupleId, currentUserProfile } = useAuthStore.getState();
  const { userLocation, setActiveSos } = useLocationStore.getState();
  if (!user || !coupleId) return;

  const secret = getActiveSecret(coupleId);
  let encryptedSosLocation: string | null = null;
  if (userLocation) {
    encryptedSosLocation = await encryptionService.encryptObject(
      { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude },
      secret
    );
  }

  const sosData = {
    isActive: true,
    triggeredBy: user.uid,
    startTime: Date.now(),
    locationEnc: encryptedSosLocation,
    isSilent,
  };

  try {
    if (isSilent) alertService.setVictimSilence(true);
    const coupleRef = doc(db, 'couples', coupleId);
    await updateDoc(coupleRef, { activeSos: sosData });
    setActiveSos({
      isActive: true,
      triggeredBy: user.uid,
      startTime: sosData.startTime,
      location: userLocation ? { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude } : null,
      isSilent,
    });

    import('../activityService').then(({ activityService }) => {
      activityService.logActivity('sos', isSilent ? 'Triggered a Silent SOS alert 🆘' : 'Triggered an SOS emergency alert 🆘');
    });

    const contacts = currentUserProfile?.emergencyContacts || (currentUserProfile?.emergencyContact ? [currentUserProfile.emergencyContact] : []);
    if (contacts.length > 0 && userLocation) {
      emergencyService.notifyContacts(contacts, { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude });
    }

    if (!isSilent) {
      notificationService.sendLocalNotification('🆘 SOS ALERT SENT', 'Your partner and emergency contacts have been notified.').catch(() => {});
    }
  } catch (err) {
    console.error('[LocationService] triggerSos failed:', err);
  }
}

export async function clearSos(): Promise<void> {
  const { coupleId } = useAuthStore.getState();
  if (!coupleId) return;
  try {
    alertService.setVictimSilence(false);
    const coupleRef = doc(db, 'couples', coupleId);
    await updateDoc(coupleRef, { activeSos: null, 'activeSos.location': null });
    useLocationStore.getState().setActiveSos(null);
  } catch (err) {
    console.error('[LocationService] clearSos failed:', err);
  }
}
