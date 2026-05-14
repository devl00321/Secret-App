import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { authService } from '../services/authService';
import { PartnerProfile } from '../services/userService';
import { db, doc, onSnapshot } from '../services/firebase';
import { encryptionService } from '../services/encryptionService';
import { encryptedStorage } from '../services/secureStorage';

interface AuthState {
  user: FirebaseAuthTypes.User | null;
  currentUserProfile: PartnerProfile | null;
  partner: (PartnerProfile & { lastMessage: string; lastActive?: any }) | null;
  coupleId: string | null;
  sharedSecret: string | null; // In-memory only — never persisted
  loading: boolean;
  authMethod: 'phone' | 'email' | 'google' | null;
  confirmationResult: FirebaseAuthTypes.ConfirmationResult | null;
  setUser: (user: FirebaseAuthTypes.User | null) => void;
  setCurrentUserProfile: (profile: PartnerProfile | null) => void;
  setPartner: (partner: PartnerProfile | null) => void;
  subscribeToPartner: (partnerId: string) => () => void;
  setCoupleId: (id: string | null) => void;
  setSharedSecret: (secret: string | null) => void;
  loadSharedSecret: (coupleId: string) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setAuthMethod: (method: 'phone' | 'email' | 'google' | null) => void;
  setConfirmationResult: (result: FirebaseAuthTypes.ConfirmationResult | null) => void;
  logout: () => Promise<void>;
  isPaired: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      currentUserProfile: null,
      partner: null,
      coupleId: null,
      sharedSecret: null, // Never persisted — always loaded fresh from SecureStore
      loading: true,
      authMethod: null,
      confirmationResult: null,

      setUser: (user) => set({ user }),
      setCurrentUserProfile: (profile) => set({ currentUserProfile: profile }),

      setPartner: (partner) =>
        set({
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
                id: partnerId,
                isOnline: Boolean(data.isOnline),
                lastMessage: state.partner?.lastMessage || 'Click to start chatting! ❤️',
              },
            }));
          }
        });

        return unsubscribe;
      },

      setCoupleId: (coupleId) => set({ coupleId }),

      setSharedSecret: (secret) => set({ sharedSecret: secret }),

      /**
       * Loads the ECDH shared secret from hardware-backed SecureStore.
       * Falls back to the legacy coupleId-derived secret for backward compatibility.
       * Called once on app startup after the user is authenticated.
       */
      loadSharedSecret: async (coupleId: string) => {
        try {
          // Try the proper ECDH secret first
          const ecdhSecret = await encryptionService.loadSharedSecret(coupleId);
          if (ecdhSecret) {
            set({ sharedSecret: ecdhSecret });
            console.log('[AuthStore] ✅ ECDH shared secret loaded from SecureStore.');
            
            const { currentUserProfile, partner, coupleId } = get();
            if (currentUserProfile) {
              const decrypted = await encryptionService.decryptProfileFields(currentUserProfile, ecdhSecret);
              set({ currentUserProfile: decrypted });
            }
            if (partner) {
              const decrypted = await encryptionService.decryptProfileFields(partner, ecdhSecret);
              set({ partner: decrypted });
            }

            return;
          }

          // Fall back to the legacy bridge secret for already-paired users
          const legacySecret = encryptionService.getLegacySecret(coupleId);
          set({ sharedSecret: legacySecret });
          console.warn('[AuthStore] ⚠️ No ECDH secret found — using legacy bridge secret.');
          
          // Re-decrypt current profiles with the loaded secret
          const { currentUserProfile, partner } = get();
          if (currentUserProfile) {
            const decrypted = await encryptionService.decryptProfileFields(currentUserProfile, legacySecret);
            set({ currentUserProfile: decrypted });
          }
          if (partner) {
            const decrypted = await encryptionService.decryptProfileFields(partner, legacySecret);
            set({ partner: decrypted });
          }
        } catch (err) {
          console.error('[AuthStore] loadSharedSecret failed:', err);
          // Always have a fallback
          const legacySecret = encryptionService.getLegacySecret(coupleId);
          set({ sharedSecret: legacySecret });
        }
      },

      setLoading: (loading) => set({ loading }),
      setAuthMethod: (authMethod) => set({ authMethod }),
      setConfirmationResult: (confirmationResult) => set({ confirmationResult }),

      isPaired: () => !!get().coupleId,

      logout: async () => {
        try {
          await authService.logout();
          set({
            user: null,
            currentUserProfile: null,
            partner: null,
            coupleId: null,
            sharedSecret: null,
            authMethod: null,
            confirmationResult: null,
          });
        } catch (error) {
          console.log('Logout Error:', error);
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => encryptedStorage),
      partialize: (state) => ({
        currentUserProfile: state.currentUserProfile,
        partner: state.partner,
        coupleId: state.coupleId,
        authMethod: state.authMethod,
        // ⚠️ sharedSecret is intentionally EXCLUDED — it must never be persisted
        //    to AsyncStorage. It is always loaded fresh from SecureStore.
      }),
    }
  )
);
