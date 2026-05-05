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
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
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

      setUserLocation: (userLocation) => set({ userLocation }),
      setPartnerLocation: (partnerLocation) => set({ partnerLocation }),
      setSharing: (isSharing) => set({ isSharing }),
      setSharingDuration: (sharingDuration) => set({ sharingDuration }),
      setTripActive: (isTripActive, destination) => set({ isTripActive, destination: destination || null }),
      updateMetrics: (distanceToPartner, etaToPartner) => set({ distanceToPartner, etaToPartner }),
      
      setPartnerSavedPlaces: (partnerSavedPlaces) => set({ partnerSavedPlaces }),
      setPartnerTrip: (partnerTrip) => set({ partnerTrip }),

      addSavedPlace: (place) => set((state) => ({
        savedPlaces: [...state.savedPlaces, { ...place, id: Math.random().toString(36).substring(7) }]
      })),
      
      removeSavedPlace: (id) => set((state) => ({
        savedPlaces: state.savedPlaces.filter(p => p.id !== id)
      })),
      
      updateSavedPlace: (id, place) => set((state) => ({
        savedPlaces: state.savedPlaces.map(p => p.id === id ? { ...p, ...place } : p)
      })),
    }),
    {
      name: 'location-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        savedPlaces: state.savedPlaces,
        sharingDuration: state.sharingDuration,
        isSharing: state.isSharing
      }),
    }
  )
);
