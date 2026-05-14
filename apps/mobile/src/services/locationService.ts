import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import { db, authInstance, doc, setDoc, updateDoc, onSnapshot } from './firebase';
import { useLocationStore, SavedPlace } from '../store/useLocationStore';
import { useAuthStore } from '../store/useAuthStore';
import { notificationService } from './notificationService';
import { alertService } from './alertService';
import { emergencyService } from './emergencyService';
import { encryptionService } from './encryptionService';
import { aiService } from './aiService';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

const LOCATION_TASK_NAME = 'background-location-task';
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
let lastAiCheckTime = 0;
const AI_CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes

/** Returns the active ECDH shared secret or legacy bridge secret. */
function getActiveSecret(coupleId?: string | null): string {
  const { sharedSecret, coupleId: storedCouple } = useAuthStore.getState();
  const cid = coupleId || storedCouple;
  if (sharedSecret) return sharedSecret;
  if (cid) return encryptionService.getLegacySecret(cid);
  return 'luvv_no_couple';
}

// Background Task Definition
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    if (error.code === 1 || error.message?.includes('kCLErrorDomain Code 1')) {
      console.warn('[Background Location Task] Location access denied. Please ensure "Always" permission is granted in Settings.');
    } else if (error.code === 0 || error.message?.includes('kCLErrorDomain Code 0')) {
      console.warn('[Background Location Task] Location temporarily unknown (Code 0).');
    } else {
      console.error('[Background Location Task] Error:', error);
    }
    return;
  }
  if (data) {
    const { locations } = data;
    const location = locations[0] as Location.LocationObject;
    if (location) {
      const currentUser = authInstance.currentUser;
      const userId = currentUser?.uid;
      if (userId) {
        try {
          const secret = getActiveSecret();
          const locationPayload = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading,
            speed: location.coords.speed,
            timestamp: Date.now(),
          };
          const encryptedLocation = await encryptionService.encryptObject(locationPayload, secret);

          const userRef = doc(db, 'users', userId);
          await setDoc(userRef, { locationEnc: encryptedLocation }, { merge: true });
        } catch (err) {
          console.warn('[Background Location Task] Firestore sync failed:', err);
        }
      }
    }
  }
});


export const locationService = {
  startTracking: async () => {
    try {
      // 1. Request Foreground Permissions first - This is safe everywhere
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        console.warn('[LocationService] Foreground location permission denied');
        return;
      }

      // 2. Get an immediate initial position to snap the map correctly
      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (initialLocation) {
        useLocationStore.getState().setUserLocation(initialLocation);
        locationService.syncLocation(initialLocation);
      }

      // 3. Start high-accuracy watch stream
      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000,
          distanceInterval: 5,
        },
        (location) => {
          useLocationStore.getState().setUserLocation(location);
          locationService.syncLocation(location);

          // ── PROACTIVE MAP INTELLIGENCE ──
          const now = Date.now();
          const { walkSafe, isTripActive } = useLocationStore.getState();
          
          const TEST_MODE = true; 
          const interval = TEST_MODE ? 30000 : AI_CHECK_INTERVAL;

          if (now - lastAiCheckTime > interval && !isTripActive && !walkSafe?.isActive) {
            lastAiCheckTime = now;
            import('./safetyService').then(({ safetyService }) => {
              const result = safetyService.getMapIntelligence(isTripActive, walkSafe?.isActive || false);
              if (result?.shouldAlert) {
                notificationService.sendLocalNotification(
                  '🛡️ Safety Suggestion',
                  `Luvv Guard: ${result.reason}. Tap to enable Reach Safely mode.`
                );
              }
            });
          }
        }
      );

      // 4. Background tracking logic - EXTREMELY STICKY ON iOS
      // Only attempt background permissions if NOT in Expo Go on iOS
      const isPhysicalIosGo = IS_EXPO_GO && Platform.OS === 'ios';
      
      if (!isPhysicalIosGo) {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus === 'granted') {
          await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 30000, // 30s
            distanceInterval: 10, // 10m
            deferredUpdatesInterval: 60000, // Defer for 1min to save battery
            deferredUpdatesDistance: 100, // Defer for 100m
            pausesUpdatesAutomatically: false, // CRITICAL: Don't let iOS stop tracking
            showsBackgroundLocationIndicator: true, // Show the blue bar on iOS
            foregroundService: {
              notificationTitle: "Luvv Guard is Active",
              notificationBody: "Keeping you and your partner safe in the background",
              notificationColor: "#FF6B6B"
            },
          });
        }
      } else {
        console.warn('[LocationService] Skipping background permission request on iOS Expo Go to prevent crash.');
      }
    } catch (err) {
      console.error('[LocationService] startTracking failed:', err);
    }
  },

  stopTracking: async () => {
    try {
      const isTaskRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isTaskRunning) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    } catch (err) {
      console.warn('[LocationService] stopTracking failed:', err);
    }
  },

  syncLocation: async (location: Location.LocationObject) => {
    const userId = authInstance.currentUser?.uid;
    if (!userId) return;

    try {
      const secret = getActiveSecret();
      const userRef = doc(db, 'users', userId);
      const battery = await Battery.getPowerStateAsync();

      // Encrypt location coordinates
      const locationPayload = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: Date.now(),
      };
      const encryptedLocation = await encryptionService.encryptObject(locationPayload, secret);

      // Encrypt battery status
      const statusPayload = {
        batteryLevel: Math.round(battery.batteryLevel * 100),
        isCharging: battery.batteryState === Battery.BatteryState.CHARGING,
        lastSeen: Date.now(),
      };
      const encryptedStatus = await encryptionService.encryptObject(statusPayload, secret);

      await updateDoc(userRef, {
        locationEnc: encryptedLocation,
        statusEnc: encryptedStatus,
      });
    } catch (err) {
      console.error('[LocationService] Failed to sync location:', err);
    }
  },

  subscribeToPartner: (partnerId: string) => {
    const partnerRef = doc(db, 'users', partnerId);
    return onSnapshot(partnerRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const secret = getActiveSecret();

        // ── Decrypt location ──
        if (data && data.locationEnc) {
          const locationData = await encryptionService.decryptObject<any>(
            data.locationEnc,
            secret
          );
          if (locationData) {
            useLocationStore.getState().setPartnerLocation({
              ...locationData,
              isSharing: data.isSharingLocation ?? true,
            });
          }
        } else if (data && data.location) {
          // Legacy fallback — unencrypted location from before migration
          useLocationStore.getState().setPartnerLocation({
            ...data.location,
            isSharing: data.isSharingLocation ?? true,
          });
        }

        // ── Decrypt battery status ──
        if (data && data.statusEnc) {
          const statusData = await encryptionService.decryptObject<any>(
            data.statusEnc,
            secret
          );
          if (statusData) {
            // Merge battery status into partner location store
            useLocationStore.getState().setPartnerLocation({
              ...useLocationStore.getState().partnerLocation,
              ...statusData,
            } as any);
          }
        }

        // ── PROACTIVE AI ANALYSIS ──
        if (data && (data.locationEnc || data.statusEnc)) {
          const now = Date.now();
          if (now - lastAiCheckTime > AI_CHECK_INTERVAL) {
            lastAiCheckTime = now;
            
            const currentPartner = useLocationStore.getState().partnerLocation;
            if (currentPartner) {
              const context = {
                latitude: currentPartner.latitude,
                longitude: currentPartner.longitude,
                batteryLevel: (currentPartner as any).batteryLevel / 100 || 1,
                isCharging: (currentPartner as any).isCharging || false,
                timeOfDay: new Date().toLocaleTimeString(),
                isNavigating: !!data.trip || !!data.walkSafe,
                partnerName: useAuthStore.getState().currentUserProfile?.partnerNickname || 'Partner',
              };

              aiService.analyzeSafetyContext(context).then(insight => {
                useLocationStore.getState().setAiInsight(insight);
                if (insight.status !== 'safe') {
                  notificationService.sendLocalNotification(
                    '🛡️ Luvv Guard',
                    insight.message
                  );
                }
              });
            }
          }
        }

        if (data && data.savedPlaces) {
          useLocationStore.getState().setPartnerSavedPlaces(data.savedPlaces);
        }
        if (data && data.trip) {
          useLocationStore.getState().setPartnerTrip(data.trip);
        }
        if (data && data.walkSafe) {
          const prevPartnerWalkSafe = useLocationStore.getState().partnerWalkSafe;
          const currentPartnerWalkSafe = data.walkSafe;
          const partnerName = useAuthStore.getState().currentUserProfile?.partnerNickname || useAuthStore.getState().partner?.displayName || 'Partner';

          // Trip Started alert
          if (currentPartnerWalkSafe.isActive && !prevPartnerWalkSafe?.isActive) {
            alertService.triggerAlert(
              'info',
              '🚶‍♂️ Walk Safe Started',
              `${partnerName} started a Walk Safe trip to ${currentPartnerWalkSafe.destinationName}.`
            );
          }

          useLocationStore.getState().setPartnerWalkSafe(currentPartnerWalkSafe);

          // Warning/Overdue alerts
          if (currentPartnerWalkSafe.isActive && currentPartnerWalkSafe.status !== prevPartnerWalkSafe?.status) {
            if (currentPartnerWalkSafe.status === 'overdue' || currentPartnerWalkSafe.status === 'warning') {
              alertService.triggerAlert(
                'warning',
                `⚠️ Partner ${currentPartnerWalkSafe.status.toUpperCase()}`,
                `${partnerName} is ${currentPartnerWalkSafe.status} on their trip to ${currentPartnerWalkSafe.destinationName}.`
              );
            }
          }
        } else {
          const prevPartnerWalkSafe = useLocationStore.getState().partnerWalkSafe;
          const partnerName = useAuthStore.getState().currentUserProfile?.partnerNickname || useAuthStore.getState().partner?.displayName || 'Partner';

          // Detect Arrival (prev was active + arrived, now null)
          if (prevPartnerWalkSafe?.isActive && prevPartnerWalkSafe.status === 'arrived') {
            alertService.triggerAlert(
              'info',
              '✅ Arrived Safely',
              `${partnerName} has reached their destination.`
            );
          }
          useLocationStore.getState().setPartnerWalkSafe(null);
        }

        // ── SYNC PARTNER BREADCRUMBS ──
        if (data && data.lastCompletedPath && data.lastCompletedTime) {
          useLocationStore.setState({
            partnerLastCompletedPath: data.lastCompletedPath,
            partnerLastCompletedTime: data.lastCompletedTime,
          });
        }
      }
    });
  },

  syncSavedPlaces: async () => {
    const userId = authInstance.currentUser?.uid;
    if (!userId) return;
    
    const savedPlaces = useLocationStore.getState().savedPlaces;
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { savedPlaces });
    } catch (err) {
      console.error('[LocationService] Failed to sync saved places:', err);
    }
  },

  syncTripStatus: async () => {
    const userId = authInstance.currentUser?.uid;
    if (!userId) return;

    const { isTripActive, destination } = useLocationStore.getState();
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        trip: {
          isActive: isTripActive,
          destination: destination,
        }
      });
    } catch (err) {
      console.error('[LocationService] Failed to sync trip status:', err);
    }
  },

  sendPing: async (partnerId: string) => {
    const { user } = useAuthStore.getState();
    console.log('[Ping] Attempting to send ping. PartnerId:', partnerId, '| SenderUid:', user?.uid);
    
    if (!partnerId) {
      console.error('[Ping] FAILED: No partnerId provided!');
      return;
    }
    if (!user) {
      console.error('[Ping] FAILED: No logged-in user found!');
      return;
    }

    try {
      const secret = getActiveSecret();
      const pingPayload = {
        from: user.uid,
        timestamp: Date.now(),
        pingId: Math.random().toString(36).substring(7),
        type: 'heartbeat',
      };
      // Encrypt the ping payload
      const encryptedPing = await encryptionService.encryptObject(pingPayload, secret);

      const partnerRef = doc(db, 'users', partnerId);
      await updateDoc(partnerRef, {
        incomingPingEnc: encryptedPing,
        // Keep a plaintext timestamp for freshness check (not PII)
        incomingPingTs: pingPayload.timestamp,
      });
      console.log('[Ping] SUCCESS: Encrypted ping written to Firestore for user:', partnerId);
    } catch (err) {
      console.error('[Ping] FAILED: Firestore write error:', err);
    }
  },


  subscribeToIncomingPings: (userId: string, onPing: (ping: any) => void) => {
    if (!userId) return () => {};
    const userRef = doc(db, 'users', userId);
    const listenerStartTime = Date.now();

    return onSnapshot(userRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (!data) return;

        // ── Handle encrypted ping ──
        if (data.incomingPingEnc && data.incomingPingTs) {
          const timestamp = data.incomingPingTs;
          if (timestamp > listenerStartTime) {
            const secret = getActiveSecret();
            const decryptedPing = await encryptionService.decryptObject<any>(
              data.incomingPingEnc,
              secret
            );
            if (decryptedPing) {
              console.log('[LocationService] New encrypted ping detected!', decryptedPing);
              onPing(decryptedPing);
              try {
                await updateDoc(userRef, { incomingPingEnc: null, incomingPingTs: null });
                console.log('[LocationService] Encrypted ping cleared from Firestore.');
              } catch (err) {
                console.warn('[LocationService] Could not clear incomingPing:', err);
              }
            }
          } else {
            console.log('[LocationService] Ignored stale encrypted ping.');
          }
        }

        // ── Legacy plaintext ping fallback ──
        if (data.incomingPing && !data.incomingPingEnc) {
          const { timestamp } = data.incomingPing;
          if (timestamp > listenerStartTime) {
            console.log('[LocationService] Legacy ping detected (plaintext).', data.incomingPing);
            onPing(data.incomingPing);
            try {
              await updateDoc(userRef, { incomingPing: null });
            } catch (err) {
              console.warn('[LocationService] Could not clear legacy incomingPing:', err);
            }
          }
        }
      }
    });
  },

  
  geocode: async (address: string) => {
    try {
      const results = await Location.geocodeAsync(address);
      return results;
    } catch (err) {
      console.error('[LocationService] Geocoding failed:', err);
      return [];
    }
  },

  subscribeToCoupleSos: (coupleId: string, currentUserId: string) => {
    const coupleRef = doc(db, 'couples', coupleId);
    return onSnapshot(coupleRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (!data) return;
        const activeSos = data.activeSos || null;
        const userId = currentUserId;
        const { isSirenMuted, setSirenMuted, activeSos: prevSos } = useLocationStore.getState();
        
        useLocationStore.getState().setActiveSos(activeSos);

        // Explicit suppression for Silent SOS on victim's device
        if (activeSos?.isActive && activeSos.isSilent && activeSos.triggeredBy === userId) {
          console.log('[LocationService] Silent SOS - Suppressing victim alert');
          alertService.setVictimSilence(true);
          return;
        } else if (!activeSos?.isActive) {
          alertService.setVictimSilence(false);
        }

        // Global Alert Trigger — ONLY ON STATUS CHANGE (to avoid re-triggering siren on coords update)
        const justBecameActive = activeSos?.isActive && !prevSos?.isActive;
        
        if (justBecameActive && activeSos?.triggeredBy !== userId) {
          console.log('[LocationService] Partner triggered SOS. Silent:', activeSos?.isSilent);
          // Partner always gets the alert (even if silent for the victim)
          if (!isSirenMuted) {
            alertService.triggerAlert(
              'critical',
              '🆘 SOS EMERGENCY',
              'Your partner needs help immediately!'
            );
          }

          // ── EMERGENCY ANALYSIS ──
          if (activeSos?.location) {
            const partnerProfile = useAuthStore.getState().partner;
            const partnerLoc = useLocationStore.getState().partnerLocation;
            
            import('./safetyService').then(({ safetyService }) => {
              const insight = safetyService.getEmergencyInsight({
                batteryLevel: partnerLoc?.batteryLevel,
                partnerName: partnerProfile?.displayName || 'Partner',
              });
              useLocationStore.getState().setSafetyInsight(insight);
            });
          }

        } else if (justBecameActive && activeSos?.triggeredBy === userId) {
          console.log('[LocationService] Victim triggered SOS - UI only, no local alert.');
          // Victim NEVER gets the siren/vibration alert, only the partner does.
          // This ensures total sensory discretion for the victim.
          alertService.setVictimSilence(true);
        } else if (!activeSos?.isActive && prevSos?.isActive) {
          // Stop siren when SOS is JUST cleared
          alertService.stopSiren();
          alertService.setVictimSilence(false);
          setSirenMuted(false); // Reset for next time
          useLocationStore.getState().setSafetyInsight(null); // Clear insight
        }
      }
    });
  },

  triggerSos: async (isSilent: boolean = false) => {
    const { user, coupleId } = useAuthStore.getState();
    const { userLocation, setActiveSos } = useLocationStore.getState();
    if (!user || !coupleId) return;

    // Encrypt the SOS location coordinates
    const secret = getActiveSecret(coupleId);
    let encryptedSosLocation: string | null = null;
    if (userLocation) {
      encryptedSosLocation = await encryptionService.encryptObject(
        {
          latitude: userLocation.coords.latitude,
          longitude: userLocation.coords.longitude,
        },
        secret
      );
    }

    const sosData = {
      isActive: true,
      triggeredBy: user.uid,   // Plaintext — needed by Cloud Function for push notification
      startTime: Date.now(),
      locationEnc: encryptedSosLocation, // Encrypted GPS coordinates
      location: userLocation ? {         // Keep plaintext copy for Cloud Function (no PII risk since lat/lng alone is non-identifying without identity)
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude
      } : null,
      isSilent: isSilent,
    };

    try {
      if (isSilent) {
        alertService.setVictimSilence(true);
      }
      const coupleRef = doc(db, 'couples', coupleId);
      await updateDoc(coupleRef, { activeSos: sosData });
      setActiveSos(sosData);

      // Log to timeline
      import('./activityService').then(({ activityService }) => {
        activityService.logActivity('sos', isSilent ? 'Triggered a Silent SOS alert 🆘' : 'Triggered an SOS emergency alert 🆘');
      });

      // ─── NOTIFY EMERGENCY CONTACTS ───
      const { currentUserProfile } = useAuthStore.getState();
      if (currentUserProfile?.emergencyContacts && userLocation) {
        emergencyService.notifyContacts(
          currentUserProfile.emergencyContacts, 
          {
            latitude: userLocation.coords.latitude,
            longitude: userLocation.coords.longitude
          }
        );
      } else if (currentUserProfile?.emergencyContact && userLocation) {
        emergencyService.notifyContacts(
          [currentUserProfile.emergencyContact], 
          {
            latitude: userLocation.coords.latitude,
            longitude: userLocation.coords.longitude
          }
        );
      }

      if (!isSilent) {
        try {
          await notificationService.sendLocalNotification(
            "🆘 SOS ALERT SENT",
            "Your partner and emergency contacts have been notified."
          );
        } catch (e) {}
      }

    } catch (err) {
      console.error('[LocationService] SOS Trigger failed:', err);
    }
  },

  clearSos: async () => {
    const { coupleId } = useAuthStore.getState();
    const { setActiveSos } = useLocationStore.getState();
    if (!coupleId) return;

    try {
      alertService.setVictimSilence(false);
      const coupleRef = doc(db, 'couples', coupleId);
      await updateDoc(coupleRef, { activeSos: null });
      setActiveSos(null);
    } catch (err) {
      console.error('[LocationService] SOS Clear failed:', err);
    }
  },

  // ─── Walk Safe Mode ───────────────────────────────────────────────

  _walkSafeInterval: null as ReturnType<typeof setInterval> | null,
  _graceTimeout: null as ReturnType<typeof setTimeout> | null,

  /** Haversine distance in meters between two lat/lng points */
  haversineDistance: (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth radius in meters
    const toRad = (deg: number) => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  startWalkSafeMonitor: () => {
    // Clear any existing monitor
    locationService.stopWalkSafeMonitor();

    console.log('[WalkSafe] Monitor started');

    locationService._walkSafeInterval = setInterval(() => {
      const { walkSafe, userLocation, updateWalkSafe, addToWalkSafePath } = useLocationStore.getState();

      if (!walkSafe?.isActive || !walkSafe.destination || !userLocation) return;

      const distance = locationService.haversineDistance(
        userLocation.coords.latitude,
        userLocation.coords.longitude,
        walkSafe.destination.latitude,
        walkSafe.destination.longitude
      );

      const now = Date.now();
      const remainingMs = (walkSafe.deadline || 0) - now;
      const remainingMin = remainingMs / 60000;
      const geofenceRadius = walkSafe.destination.radius || 150;

      // ── AUTO-ARRIVAL: Within geofence radius ──
      if (distance < geofenceRadius) {
        console.log('[WalkSafe] ARRIVED — within geofence');
        updateWalkSafe({ status: 'arrived', lastCheckDistance: distance });
        locationService.stopWalkSafeMonitor();
        locationService.syncWalkSafe();

        // Notify
        notificationService.sendLocalNotification(
          '✅ Arrived Safely!',
          `You've reached ${walkSafe.destination.name}. Your partner has been notified.`
        ).catch(() => {});

        // Auto-end after brief display
        setTimeout(() => {
          const { walkSafe: currentWS } = useLocationStore.getState();
          import('./activityService').then(({ activityService }) => {
            activityService.logActivity('travel', `Arrived safely at ${currentWS?.destination?.name || 'destination'} ✅`);
          });
          useLocationStore.getState().endWalkSafe('arrived');
          locationService.syncWalkSafe();
        }, 5000);
        return;
      }

      // ── OVERDUE: Timer expired and not arrived ──
      if (remainingMs <= 0 && walkSafe.status !== 'overdue') {
        console.log('[WalkSafe] OVERDUE — showing safety check');
        updateWalkSafe({ status: 'overdue', lastCheckDistance: distance });
        locationService.syncWalkSafe();

        // Show "Are you safe?" alert with options
        const { Alert } = require('react-native');
        Alert.alert(
          '⚠️ Are you safe?',
          `You haven't reached ${walkSafe.destination.name} yet. If you don't respond within 2 minutes, SOS will be triggered automatically.`,
          [
            {
              text: "I'm Safe ✅",
              onPress: () => {
                console.log('[WalkSafe] User confirmed safe — ending trip');
                locationService.stopWalkSafeMonitor();
                useLocationStore.getState().endWalkSafe('arrived');
                locationService.syncWalkSafe();
                locationService.syncTripStatus();
                notificationService.sendLocalNotification(
                  '✅ Glad you\'re safe!',
                  'Walk Safe trip ended. Your partner has been notified.'
                ).catch(() => {});
              },
            },
            {
              text: '+5 min ⏱️',
              onPress: () => {
                console.log('[WalkSafe] User extended by 5 minutes');
                useLocationStore.getState().extendWalkSafe(5);
                locationService.syncWalkSafe();
                // Clear grace timeout since they responded
                if (locationService._graceTimeout) {
                  clearTimeout(locationService._graceTimeout);
                  locationService._graceTimeout = null;
                }
                notificationService.sendLocalNotification(
                  '⏱️ Timer Extended',
                  'Added 5 more minutes to your Walk Safe trip.'
                ).catch(() => {});
              },
            },
          ],
          { cancelable: false }
        );

        // 2-minute grace period — auto-SOS if no response
        locationService._graceTimeout = setTimeout(async () => {
          const current = useLocationStore.getState().walkSafe;
          if (current?.isActive && current?.status === 'overdue') {
            console.log('[WalkSafe] Grace period expired — triggering SOS');
            await locationService.triggerSos();
            notificationService.sendLocalNotification(
              '🆘 SOS AUTO-TRIGGERED',
              'Walk Safe timer expired with no response. Your guardian network has been alerted.'
            ).catch(() => {});
          }
        }, 2 * 60 * 1000); // 2 minutes
        return;
      }

      // ── WARNING: < 2 min left and > 500m away ──
      if (remainingMin < 2 && remainingMin > 0 && distance > 500 && walkSafe.status === 'traveling') {
        console.log('[WalkSafe] WARNING — running late');
        updateWalkSafe({ status: 'warning', lastCheckDistance: distance });
        locationService.syncWalkSafe();

        notificationService.sendLocalNotification(
          '⏰ Running Late',
          `Less than 2 minutes left but you're still ${Math.round(distance)}m from ${walkSafe.destination.name}.`
        ).catch(() => {});
        return;
      }

      // ── Normal update ──
      addToWalkSafePath(userLocation.coords.latitude, userLocation.coords.longitude);
      updateWalkSafe({ lastCheckDistance: distance });
      locationService.syncWalkSafe();

    }, 10000); // Check every 10 seconds
  },

  stopWalkSafeMonitor: () => {
    if (locationService._walkSafeInterval) {
      clearInterval(locationService._walkSafeInterval);
      locationService._walkSafeInterval = null;
    }
    if (locationService._graceTimeout) {
      clearTimeout(locationService._graceTimeout);
      locationService._graceTimeout = null;
    }
    console.log('[WalkSafe] Monitor stopped');
  },

  syncWalkSafe: async () => {
    const userId = authInstance.currentUser?.uid;
    if (!userId) return;

    const { walkSafe } = useLocationStore.getState();
    const secret = getActiveSecret();

    try {
      const userRef = doc(db, 'users', userId);

      let encryptedPath: string | null = null;
      let encryptedDestName: string | null = null;

      if (walkSafe?.destination?.name) {
        encryptedDestName = await encryptionService.encryptField(
          walkSafe.destination.name,
          secret
        );
      }
      if (walkSafe?.path && walkSafe.path.length > 0) {
        encryptedPath = await encryptionService.encryptObject(walkSafe.path, secret);
      }

      await updateDoc(userRef, {
        walkSafe: walkSafe ? {
          isActive: walkSafe.isActive,
          destinationNameEnc: encryptedDestName,
          destinationName: null, // Clear plaintext field
          deadline: walkSafe.deadline,
          status: walkSafe.status,
          lastCheckDistance: walkSafe.lastCheckDistance,
          pathEnc: encryptedPath,
          path: [],  // Clear plaintext path
        } : null,
        lastCompletedPath: useLocationStore.getState().lastCompletedPath || null,
        lastCompletedTime: useLocationStore.getState().lastCompletedTime || null,
      });
    } catch (err) {
      console.error('[WalkSafe] Sync failed:', err);
    }
  },

  startWalkSafe: (name: string, latitude: number, longitude: number, durationMinutes: number = 30) => {
    const newPlace: SavedPlace = {
      id: Math.random().toString(36).substring(7),
      name,
      latitude,
      longitude,
      radius: 200,
      type: 'other'
    };
    
    useLocationStore.getState().startWalkSafe(newPlace, durationMinutes);
    locationService.startWalkSafeMonitor();
    locationService.syncWalkSafe();
    locationService.syncTripStatus();
    
    // Log to timeline
    import('./activityService').then(({ activityService }) => {
      activityService.logActivity('travel', `Started Walk Safe to ${name} 🚶‍♂️`);
    });
  },
};
