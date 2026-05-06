import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, ConfirmationResult } from 'firebase/auth';
import { authService } from '../services/authService';
import { PartnerProfile } from '../services/userService';

interface AuthState {
  user: User | null;
  currentUserProfile: PartnerProfile | null;
  partner: (PartnerProfile & { lastMessage: string; lastActive?: any }) | null;
  coupleId: string | null;
  loading: boolean;
  authMethod: 'phone' | 'email' | 'google' | null;
  confirmationResult: ConfirmationResult | null;
  setUser: (user: User | null) => void;
  setCurrentUserProfile: (profile: PartnerProfile | null) => void;
  setPartner: (partner: PartnerProfile | null) => void;
  subscribeToPartner: (partnerId: string) => () => void;
  setCoupleId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setAuthMethod: (method: 'phone' | 'email' | 'google' | null) => void;
  setConfirmationResult: (result: ConfirmationResult | null) => void;
  logout: () => Promise<void>;
  isPaired: () => boolean;
}

import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      currentUserProfile: null,
      partner: null,
      coupleId: null,
      loading: true,
      authMethod: null,
      confirmationResult: null,
      setUser: (user) => set({ user }),
      setCurrentUserProfile: (profile) => set({ currentUserProfile: profile }),
      setPartner: (partner) => set({ 
        partner: partner
          ? {
              ...partner,
              isOnline: Boolean(partner.isOnline),
              lastMessage: partner.lastMessage || 'Click to start chatting! ❤️',
            }
          : null,
      }),
      subscribeToPartner: (partnerId) => {
        if (!partnerId) return () => {};
        
        const unsubscribe = onSnapshot(doc(db, 'users', partnerId), (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as PartnerProfile;
            set((state) => ({
              partner: {
                ...state.partner,
                ...data,
                isOnline: Boolean(data.isOnline),
                lastMessage: state.partner?.lastMessage || 'Click to start chatting! ❤️',
              }
            }));
          }
        });
        
        return unsubscribe;
      },
      setCoupleId: (coupleId) => set({ coupleId }),
      setLoading: (loading) => set({ loading }),
      setAuthMethod: (authMethod) => set({ authMethod }),
      setConfirmationResult: (confirmationResult) => set({ confirmationResult }),
      isPaired: () => !!get().coupleId,
      logout: async () => {
        try {
          await authService.logout();
          set({ user: null, currentUserProfile: null, partner: null, coupleId: null, authMethod: null, confirmationResult: null });
        } catch (error) {
          console.log('Logout Error:', error);
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentUserProfile: state.currentUserProfile,
        partner: state.partner,
        coupleId: state.coupleId,
        authMethod: state.authMethod,
      }),
    }
  )
);
