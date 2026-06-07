import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  biometricLockEnabled: boolean;
  setBiometricLockEnabled: (enabled: boolean) => void;
  readReceiptsEnabled: boolean;
  setReadReceiptsEnabled: (enabled: boolean) => void;
  // Other settings can go here
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  relationshipAiEnabled: boolean;
  setRelationshipAiEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      biometricLockEnabled: false,
      setBiometricLockEnabled: (enabled) => set({ biometricLockEnabled: enabled }),
      readReceiptsEnabled: true,
      setReadReceiptsEnabled: (enabled) => set({ readReceiptsEnabled: enabled }),
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      relationshipAiEnabled: true,
      setRelationshipAiEnabled: (enabled) => set({ relationshipAiEnabled: enabled }),
    }),
    {
      name: 'luvv-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
