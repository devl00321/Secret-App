import { create } from 'zustand';
import { User, ConfirmationResult } from 'firebase/auth';
import { authService } from '../services/authService';
import { PartnerProfile } from '../services/userService';

interface AuthState {
  user: User | null;
  partner: (PartnerProfile & { lastMessage: string }) | null;
  coupleId: string | null;
  loading: boolean;
  authMethod: 'phone' | 'email' | 'google' | null;
  confirmationResult: ConfirmationResult | null;
  setUser: (user: User | null) => void;
  setPartner: (partner: PartnerProfile | null) => void;
  setCoupleId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setAuthMethod: (method: 'phone' | 'email' | 'google' | null) => void;
  setConfirmationResult: (result: ConfirmationResult | null) => void;
  logout: () => Promise<void>;
  // Derived state
  isPaired: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  partner: null,
  coupleId: null,
  loading: true,
  authMethod: null,
  confirmationResult: null,
  setUser: (user) => set({ user }),
  setPartner: (partner) => set({ 
    partner: partner
      ? {
          ...partner,
          isOnline: Boolean(partner.isOnline),
          lastMessage: partner.lastMessage || 'Click to start chatting! ❤️',
        }
      : null,
  }),
  setCoupleId: (coupleId) => set({ coupleId }),
  setLoading: (loading) => set({ loading }),
  setAuthMethod: (authMethod) => set({ authMethod }),
  setConfirmationResult: (confirmationResult) => set({ confirmationResult }),
  isPaired: () => !!get().coupleId,
  logout: async () => {
    try {
      await authService.logout();
      set({ user: null, partner: null, coupleId: null, authMethod: null, confirmationResult: null });
    } catch (error) {
      console.log('Logout Error:', error);
    }
  },
}));
