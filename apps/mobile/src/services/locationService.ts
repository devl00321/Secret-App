import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import { doc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
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
    console.error('[Background Location Task] Error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    const location = locations[0] as Location.LocationObject;
    if (location) {
      const userId = auth.currentUser?.uid;
      if (userId) {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          location: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading,
            speed: location.coords.speed,
            timestamp: Date.now(),
          }
        });
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
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const userRef = doc(db, 'users', userId);
      const battery = await Battery.getPowerStateAsync();
      
      await updateDoc(userRef, {
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
    const partnerRef = doc(db, 'users', partnerId);
    return onSnapshot(partnerRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.location) {
          useLocationStore.getState().setPartnerLocation({
            ...data.location,
            isSharing: data.isSharingLocation ?? true, 
          });
        }
        if (data.savedPlaces) {
          useLocationStore.getState().setPartnerSavedPlaces(data.savedPlaces);
        }
        if (data.trip) {
          useLocationStore.getState().setPartnerTrip(data.trip);
        }
        if (data.walkSafe) {
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

          // Arrived Safely alert (transition from active to null/inactive with status arrived)
          // Handled below in the else block if walkSafe is removed

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
      }
    });
  },

  syncSavedPlaces: async () => {
    const userId = auth.currentUser?.uid;
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
    const userId = auth.currentUser?.uid;
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
    const { coupleId, user } = useAuthStore.getState();
    if (!coupleId || !user) return;

    try {
      const coupleRef = doc(db, 'couples', coupleId);
      await updateDoc(coupleRef, {
        lastPing: {
          from: user.uid,
          timestamp: Date.now(),
          type: 'heartbeat'
        }
      });
    } catch (err) {
      console.error('[LocationService] Failed to send ping:', err);
    }
  },

  subscribeToIncomingPings: (coupleId: string, onPing: (ping: any) => void) => {
    const coupleRef = doc(db, 'couples', coupleId);
    let lastHandledPing = 0;

    return onSnapshot(coupleRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const userId = auth.currentUser?.uid;
        // Only handle pings that were NOT sent by me
        if (data.lastPing && data.lastPing.from !== userId && data.lastPing.timestamp > lastHandledPing) {
          if (Date.now() - data.lastPing.timestamp < 10000) { // 10s window
            onPing(data.lastPing);
          }
          lastHandledPing = data.lastPing.timestamp;
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

  subscribeToCoupleSos: (coupleId: string) => {
    const coupleRef = doc(db, 'couples', coupleId);
    return onSnapshot(coupleRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const activeSos = data.activeSos || null;
        const userId = auth.currentUser?.uid;
        const { isSirenMuted, setSirenMuted, activeSos: prevSos } = useLocationStore.getState();
        
        useLocationStore.getState().setActiveSos(activeSos);

        // Global Alert Trigger — ONLY ON STATUS CHANGE (to avoid re-triggering siren on coords update)
        const justBecameActive = activeSos?.isActive && !prevSos?.isActive;
        
        if (justBecameActive && activeSos?.triggeredBy !== userId) {
          // Only trigger if not muted
          if (!isSirenMuted) {
            alertService.triggerAlert(
              'critical',
              '🆘 SOS EMERGENCY',
              'Your partner needs help immediately!'
            );
          }
        } else if (!activeSos?.isActive && prevSos?.isActive) {
          // Stop siren when SOS is JUST cleared
          alertService.stopSiren();
          setSirenMuted(false); // Reset for next time
        }
      }
    });
  },

  triggerSos: async () => {
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
    };

    try {
      const coupleRef = doc(db, 'couples', coupleId);
      await updateDoc(coupleRef, { activeSos: sosData });
      setActiveSos(sosData);

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

      try {
        await notificationService.sendLocalNotification(
          "🆘 SOS ALERT SENT",
          "Your partner and emergency contacts have been notified."
        );
      } catch (e) {}

    } catch (err) {
      console.error('[LocationService] SOS Trigger failed:', err);
    }
  },

  clearSos: async () => {
    const { coupleId } = useAuthStore.getState();
    const { setActiveSos } = useLocationStore.getState();
    if (!coupleId) return;

    try {
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
      const { walkSafe, userLocation, updateWalkSafe } = useLocationStore.getState();

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
      updateWalkSafe({ lastCheckDistance: distance });

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
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const { walkSafe } = useLocationStore.getState();
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        walkSafe: walkSafe ? {
          isActive: walkSafe.isActive,
          destinationName: walkSafe.destination?.name || null,
          deadline: walkSafe.deadline,
          status: walkSafe.status,
          lastCheckDistance: walkSafe.lastCheckDistance,
        } : null,
      });
    } catch (err) {
      console.error('[WalkSafe] Sync failed:', err);
    }
  },
};
