/**
 * locationService — public entry point.
 * All implementation lives in ./location/ sub-modules.
 * Import this service exactly as before: `import { locationService } from './locationService'`
 */

// Side-effect import: registers the background task at module load time
import './location/backgroundTask';

import * as Location from 'expo-location';
import { startTracking, stopTracking, syncLocation } from './location/tracking';
import { subscribeToPartner, syncSavedPlaces, syncTripStatus } from './location/partnerSubscription';
import {
  sendPing,
  subscribeToIncomingPings,
  requestPartnerLocationUpdate,
  subscribeToLocationRequests,
  sendRingRequest,
  subscribeToRingRequests,
  clearRingRequest,
} from './location/pingRingService';
import { subscribeToCoupleSos, triggerSos, clearSos } from './location/sosService';
import { startWalkSafe, startWalkSafeMonitor, stopWalkSafeMonitor, syncWalkSafe } from './location/walkSafeService';
import { haversineDistance } from './location/geoUtils';
import { SavedPlace } from '../store/useLocationStore';

export const locationService = {
  startTracking,
  stopTracking,
  syncLocation,

  subscribeToPartner,
  syncSavedPlaces,
  syncTripStatus,

  sendPing,
  subscribeToIncomingPings,
  requestPartnerLocationUpdate,
  subscribeToLocationRequests,
  sendRingRequest,
  subscribeToRingRequests,
  clearRingRequest,

  subscribeToCoupleSos,
  triggerSos,
  clearSos,

  startWalkSafe,
  startWalkSafeMonitor,
  stopWalkSafeMonitor,
  syncWalkSafe,

  haversineDistance,

  geocode: async (address: string) => {
    try {
      return await Location.geocodeAsync(address);
    } catch (err) {
      console.error('[LocationService] geocode failed:', err);
      return [];
    }
  },
};
