import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

export interface SavedPlace {
  id: string;
  name: string;
  type: 'home' | 'tuition' | 'school' | 'college' | 'office' | 'hostel' | 'gym' | 'other';
  latitude: number;
  longitude: number;
  radius: number; // in meters
}

export type WalkSafeStatus = 'traveling' | 'warning' | 'overdue' | 'arrived' | 'cancelled';

export interface WalkSafeState {
  isActive: boolean;
  destination: SavedPlace | null;
  startTime: number | null;
  deadline: number | null;
  durationMinutes: number;
  status: WalkSafeStatus;
  lastCheckDistance: number | null; // meters
  path?: { latitude: number; longitude: number }[];
}

interface LocationState {
  userLocation: Location.LocationObject | null;
  partnerLocation: {
    latitude: number;
    longitude: number;
    timestamp: number;
    batteryLevel?: number;
    isSharing: boolean;
    sharingUntil?: number;
    status?: string;
  } | null;
  isSharing: boolean;
  sharingDuration: '15m' | '1h' | 'always';
  isTripActive: boolean;
  destination: { latitude: number; longitude: number; name?: string } | null;
  distanceToPartner: number | null;
  etaToPartner: number | null; // in minutes
  savedPlaces: SavedPlace[];
  partnerSavedPlaces: SavedPlace[];
  partnerTrip: {
    isActive: boolean;
    destination: { latitude: number; longitude: number; name?: string } | null;
  } | null;
  partnerWalkSafe: {
    isActive: boolean;
    destinationName: string | null;
    deadline: number | null;
    status: WalkSafeStatus;
    lastCheckDistance: number | null;
    path?: { latitude: number; longitude: number }[];
  } | null;
  partnerLastCompletedPath: { latitude: number; longitude: number }[] | null;
  partnerLastCompletedTime: number | null;
  activeSos: {
    isActive: boolean;
    triggeredBy: string | null;
    startTime: number | null;
    location: { latitude: number; longitude: number } | null;
    isSilent?: boolean;
  } | null;
  isSirenMuted: boolean;
  walkSafe: WalkSafeState | null;
  lastCompletedPath: { latitude: number; longitude: number }[] | null;
  lastCompletedTime: number | null;
  incomingPing: { from: string; timestamp: number; type: string } | null;
  aiInsight: { summary: string; riskLevel: string; suggestion: string } | null;

  // Actions
  setUserLocation: (location: Location.LocationObject | null) => void;
  setPartnerLocation: (location: any) => void;
  setSharing: (isSharing: boolean) => void;
  setSharingDuration: (duration: '15m' | '1h' | 'always') => void;
  setTripActive: (active: boolean, destination?: { latitude: number; longitude: number; name?: string }) => void;
  updateMetrics: (distance: number, eta: number) => void;
  addSavedPlace: (place: Omit<SavedPlace, 'id'>) => void;
  removeSavedPlace: (id: string) => void;
  updateSavedPlace: (id: string, place: Partial<SavedPlace>) => void;
  setPartnerSavedPlaces: (places: SavedPlace[]) => void;
  setPartnerTrip: (trip: { isActive: boolean; destination: any } | null) => void;
  setPartnerWalkSafe: (walkSafe: any) => void;
  setActiveSos: (sos: LocationState['activeSos']) => void;
  setSirenMuted: (muted: boolean) => void;
  setSavedPlaces: (places: SavedPlace[]) => void;
  startWalkSafe: (destination: SavedPlace, durationMinutes: number) => void;
  updateWalkSafe: (update: Partial<WalkSafeState>) => void;
  addToWalkSafePath: (lat: number, lng: number) => void;
  endWalkSafe: (status: 'arrived' | 'cancelled') => void;
  extendWalkSafe: (extraMinutes: number) => void;
  setIncomingPing: (ping: LocationState['incomingPing']) => void;
  setAiInsight: (insight: LocationState['aiInsight']) => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      userLocation: null,
      partnerLocation: null,
      isSharing: false,
      sharingDuration: 'always',
      isTripActive: false,
      destination: null,
      distanceToPartner: null,
      etaToPartner: null,
      savedPlaces: [],
      partnerSavedPlaces: [],
      partnerTrip: null,
      partnerWalkSafe: null,
      activeSos: null,
      isSirenMuted: false,
      walkSafe: null,
      lastCompletedPath: null,
      lastCompletedTime: null,
      partnerLastCompletedPath: null,
      partnerLastCompletedTime: null,
      incomingPing: null,
      aiInsight: null,

      setUserLocation: (userLocation) => set({ userLocation }),
      setPartnerLocation: (partnerLocation) => set({ partnerLocation }),
      setSharing: (isSharing) => set({ isSharing }),
      setSharingDuration: (sharingDuration) => set({ sharingDuration }),
      setTripActive: (isTripActive, destination) => set({ isTripActive, destination: destination || null }),
      updateMetrics: (distanceToPartner, etaToPartner) => set({ distanceToPartner, etaToPartner }),
      
      setPartnerSavedPlaces: (partnerSavedPlaces) => set({ partnerSavedPlaces }),
      setPartnerTrip: (partnerTrip) => set({ partnerTrip }),
      setPartnerWalkSafe: (partnerWalkSafe) => set({ partnerWalkSafe }),
      setActiveSos: (activeSos) => set({ activeSos }),
      setSirenMuted: (isSirenMuted) => set({ isSirenMuted }),
      setSavedPlaces: (savedPlaces) => set({ savedPlaces }),
      setIncomingPing: (incomingPing) => set({ incomingPing }),
      setAiInsight: (aiInsight) => set({ aiInsight }),

      startWalkSafe: (destination, durationMinutes) => {
        const now = Date.now();
        set({
          walkSafe: {
            isActive: true,
            destination,
            startTime: now,
            deadline: now + durationMinutes * 60 * 1000,
            durationMinutes,
            status: 'traveling',
            lastCheckDistance: null,
            path: get().userLocation ? [{ 
              latitude: get().userLocation!.coords.latitude, 
              longitude: get().userLocation!.coords.longitude 
            }] : []
          },
          // Also activate the generic trip for the map dashboard
          isTripActive: true,
          destination: {
            latitude: destination.latitude,
            longitude: destination.longitude,
            name: destination.name,
          },
        });
      },

      updateWalkSafe: (update) => set((state) => ({
        walkSafe: state.walkSafe ? { ...state.walkSafe, ...update } : null,
      })),

      addToWalkSafePath: (lat, lng) => set((state) => {
        if (!state.walkSafe?.isActive) return state;
        
        const currentPath = state.walkSafe.path || [];
        // Only add if it's different from the last point to avoid duplicates
        const lastPoint = currentPath[currentPath.length - 1];
        if (lastPoint && lastPoint.latitude === lat && lastPoint.longitude === lng) return state;

        const newPath = [...currentPath, { latitude: lat, longitude: lng }].slice(-100); // Cap at 100 points
        return {
          walkSafe: {
            ...state.walkSafe,
            path: newPath
          }
        };
      }),

      endWalkSafe: (status) => set((state) => ({
        lastCompletedPath: status === 'arrived' ? (state.walkSafe?.path || null) : state.lastCompletedPath,
        lastCompletedTime: status === 'arrived' ? Date.now() : state.lastCompletedTime,
        walkSafe: null,
        isTripActive: false,
        destination: null,
      })),

      extendWalkSafe: (extraMinutes) => set((state) => ({
        walkSafe: state.walkSafe ? {
          ...state.walkSafe,
          deadline: (state.walkSafe.deadline || Date.now()) + extraMinutes * 60 * 1000,
          status: 'traveling' as const,
        } : null,
      })),

      addSavedPlace: (place) => {
        const newPlace = { ...place, id: Math.random().toString(36).substring(7) };
        set((state) => ({
          savedPlaces: [...state.savedPlaces, newPlace]
        }));
        // Import and call sync service
        import('../services/locationService').then(m => m.locationService.syncSavedPlaces());
      },
      
      removeSavedPlace: (id) => {
        set((state) => ({
          savedPlaces: state.savedPlaces.filter(p => p.id !== id)
        }));
        import('../services/locationService').then(m => m.locationService.syncSavedPlaces());
      },
      
      updateSavedPlace: (id, place) => {
        set((state) => ({
          savedPlaces: state.savedPlaces.map(p => p.id === id ? { ...p, ...place } : p)
        }));
        import('../services/locationService').then(m => m.locationService.syncSavedPlaces());
      },
    }),
    {
      name: 'location-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        savedPlaces: state.savedPlaces,
        sharingDuration: state.sharingDuration,
        isSharing: state.isSharing,
        walkSafe: state.walkSafe, // Persist so it survives app restart
        lastCompletedPath: state.lastCompletedPath,
        lastCompletedTime: state.lastCompletedTime,
        partnerLastCompletedPath: state.partnerLastCompletedPath,
        partnerLastCompletedTime: state.partnerLastCompletedTime,
      }),
    }
  )
);
