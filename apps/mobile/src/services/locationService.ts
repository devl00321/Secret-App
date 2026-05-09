import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import firestore from '@react-native-firebase/firestore';
import { db, auth } from './firebase';
import { useLocationStore } from '../store/useLocationStore';
import { useAuthStore } from '../store/useAuthStore';
import { notificationService } from './notificationService';
import { alertService } from './alertService';
import { emergencyService } from './emergencyService';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

const LOCATION_TASK_NAME = 'background-location-task';
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Background Task Definition
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    if (error.code === 1 || error.message?.includes('kCLErrorDomain Code 1')) {
      console.warn('[Background Location Task] Location access denied. Please ensure "Always" permission is granted in Settings.');
    } else {
      console.error('[Background Location Task] Error:', error);
    }
    return;
  }
  if (data) {
    const { locations } = data;
    const location = locations[0] as Location.LocationObject;
    if (location) {
      const currentUser = auth().currentUser;
      const userId = currentUser?.uid;
      if (userId) {
        try {
          const userRef = db.collection('users').doc(userId);
          // Use set+merge instead of update — update throws [not-found] if the
          // document doesn't exist yet in the background task context
          await userRef.set({
            location: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              heading: location.coords.heading,
              speed: location.coords.speed,
              timestamp: Date.now(),
            }
          }, { merge: true });
        } catch (err) {
          // Silent fail — background task errors should never crash the app
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
        }
      );

      // 4. Background tracking logic - EXTREMELY STICKY ON iOS
      // Only attempt background permissions if NOT in Expo Go on iOS
      const isPhysicalIosGo = IS_EXPO_GO && Platform.OS === 'ios';
      
      if (!isPhysicalIosGo) {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus === 'granted') {
          await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 60000,
            distanceInterval: 50,
            foregroundService: {
              notificationTitle: "Luvv is active",
              notificationBody: "Sharing location with your partner",
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
    const userId = auth().currentUser?.uid;
    if (!userId) return;

    try {
      const userRef = db.collection('users').doc(userId);
      const battery = await Battery.getPowerStateAsync();
      
      await userRef.update({
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          heading: location.coords.heading,
          speed: location.coords.speed,
          timestamp: Date.now(),
        },
        status: {
          batteryLevel: Math.round(battery.batteryLevel * 100),
          isCharging: battery.batteryState === Battery.BatteryState.CHARGING,
          lastSeen: Date.now(),
        }
      });
    } catch (err) {
      console.error('[LocationService] Failed to sync location:', err);
    }
  },

  subscribeToPartner: (partnerId: string) => {
    const partnerRef = db.collection('users').doc(partnerId);
    return partnerRef.onSnapshot((doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data && data.location) {
          useLocationStore.getState().setPartnerLocation({
            ...data.location,
            isSharing: data.isSharingLocation ?? true, 
          });
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
    const userId = auth().currentUser?.uid;
    if (!userId) return;
    
    const savedPlaces = useLocationStore.getState().savedPlaces;
    try {
      const userRef = db.collection('users').doc(userId);
      await userRef.update({ savedPlaces });
    } catch (err) {
      console.error('[LocationService] Failed to sync saved places:', err);
    }
  },

  syncTripStatus: async () => {
    const userId = auth().currentUser?.uid;
    if (!userId) return;

    const { isTripActive, destination } = useLocationStore.getState();
    try {
      const userRef = db.collection('users').doc(userId);
      await userRef.update({
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
    if (!partnerId || !user) return;

    try {
      const partnerRef = db.collection('users').doc(partnerId);
      await partnerRef.update({
        incomingPing: {
          from: user.uid,
          timestamp: Date.now(),
          type: 'heartbeat'
        }
      });
    } catch (err) {
      console.error('[LocationService] Failed to send ping:', err);
    }
  },

  subscribeToIncomingPings: (userId: string, onPing: (ping: any) => void) => {
    if (!userId) return () => {};
    const userRef = db.collection('users').doc(userId);
    let lastHandledPingTime = 0;

    return userRef.onSnapshot((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (!data || !data.incomingPing) return;
        
        const { timestamp } = data.incomingPing;

        // Ensure we only handle new pings
        if (timestamp > lastHandledPingTime) {
          console.log('[LocationService] New direct ping detected!', data.incomingPing);
          onPing(data.incomingPing);
          lastHandledPingTime = timestamp;
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
    const coupleRef = db.collection('couples').doc(coupleId);
    return coupleRef.onSnapshot((snapshot) => {
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
        }
      }
    });
  },

  triggerSos: async (isSilent: boolean = false) => {
    const { user, coupleId } = useAuthStore.getState();
    const { userLocation, setActiveSos } = useLocationStore.getState();
    if (!user || !coupleId) return;

    const sosData = {
      isActive: true,
      triggeredBy: user.uid,
      startTime: Date.now(),
      location: userLocation ? {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude
      } : null,
      isSilent: isSilent,
    };

    try {
      if (isSilent) {
        alertService.setVictimSilence(true);
      }
      const coupleRef = db.collection('couples').doc(coupleId);
      await coupleRef.update({ activeSos: sosData });
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
      const coupleRef = db.collection('couples').doc(coupleId);
      await coupleRef.update({ activeSos: null });
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
    const userId = auth().currentUser?.uid;
    if (!userId) return;

    const { walkSafe } = useLocationStore.getState();
    try {
      const userRef = db.collection('users').doc(userId);
      await userRef.update({
        walkSafe: walkSafe ? {
          isActive: walkSafe.isActive,
          destinationName: walkSafe.destination?.name || null,
          deadline: walkSafe.deadline,
          status: walkSafe.status,
          lastCheckDistance: walkSafe.lastCheckDistance,
          path: walkSafe.path || [],
        } : null,
        lastCompletedPath: useLocationStore.getState().lastCompletedPath || null,
        lastCompletedTime: useLocationStore.getState().lastCompletedTime || null,
      });
    } catch (err) {
      console.error('[WalkSafe] Sync failed:', err);
    }
  },
};
