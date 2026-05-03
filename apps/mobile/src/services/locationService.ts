import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import { doc, updateDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { useLocationStore } from '../store/useLocationStore';

const LOCATION_TASK_NAME = 'background-location-task';

// Background Task Definition
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error('[Background Location Task] Error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    const location = locations[0];
    if (location && auth.currentUser) {
      await updateLocationInFirebase(location);
    }
  }
});

async function updateLocationInFirebase(location: Location.LocationObject) {
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  const batteryLevel = await Battery.getBatteryLevelAsync();
  
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      location: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp,
        batteryLevel: Math.round(batteryLevel * 100),
      },
      lastSeen: serverTimestamp(),
    });

    // Check battery and alert
    if (batteryLevel < 0.15) {
      await updateDoc(userRef, {
        batteryStatus: 'critical',
        lastBatteryAlertAt: Date.now(),
      });
    }
  } catch (err) {
    console.error('[LocationService] Failed to update location:', err);
  }
}

export const locationService = {
  requestPermissions: async () => {
    try {
      const { status: existingFgStatus } = await Location.getForegroundPermissionsAsync();
      
      if (existingFgStatus !== 'granted') {
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
          return { foreground: false, background: false };
        }
      }

      const { status: existingBgStatus } = await Location.getBackgroundPermissionsAsync();
      let hasBackground = existingBgStatus === 'granted';

      // Only request background if we don't have it and we're NOT in Expo Go (which causes crashes/warnings)
      if (!hasBackground && !__DEV__) { 
        try {
          const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
          hasBackground = bgStatus === 'granted';
        } catch (bgError) {
          console.warn('Background permission request skipped:', bgError);
        }
      }

      return { foreground: true, background: hasBackground };
    } catch (err) {
      console.error('Permission flow error:', err);
      return { foreground: false, background: false };
    }
  },

  startTracking: async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    // Foreground tracking
    await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced, // Use Balanced for better stability
        timeInterval: 10000, // Update store every 10 seconds to save battery/perf
        distanceInterval: 10,
      },
      (location) => {
        useLocationStore.getState().setUserLocation(location);
        updateLocationInFirebase(location);
      }
    );

    // Background tracking
    try {
      const { background } = await locationService.requestPermissions();
      if (background) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 10000,
          distanceInterval: 5,
          foregroundService: {
            notificationTitle: "Luvv is sharing your location",
            notificationBody: "Keeping you and your partner safe 💙",
            notificationColor: "#FF4B6E",
          },
          pausesUpdatesAutomatically: false,
        });
      }
    } catch (bgError) {
      console.warn('[LocationService] Background tracking could not be started:', bgError);
    }
  },

  stopTracking: async () => {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
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
  }
};
