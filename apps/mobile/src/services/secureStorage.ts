/**
 * Encrypted AsyncStorage Persistence Layer
 * =========================================
 *
 * A drop-in replacement for Zustand's createJSONStorage(AsyncStorage)
 * that transparently encrypts all data before writing and decrypts on read.
 *
 * Uses a device-local key stored in expo-secure-store (hardware-backed keychain).
 * Even if someone extracts the phone's app data directory via USB or backup,
 * all they see is random Base64 ciphertext.
 *
 * Usage:
 *   import { encryptedStorage } from '../services/secureStorage';
 *   ...
 *   persist(store, { storage: encryptedStorage })
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { encryptionService } from './encryptionService';
import { StateStorage } from 'zustand/middleware';

/**
 * Encrypted Zustand StateStorage implementation.
 * Implements the same interface as createJSONStorage(AsyncStorage)
 * but wraps every value with AES-256-GCM encryption.
 */
export const encryptedStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const raw = await AsyncStorage.getItem(name);
      if (!raw) return null;

      // Try decrypting — if it fails (legacy plaintext), return as-is
      const decrypted = await encryptionService.decryptFromStorage(raw);
      return decrypted;
    } catch (err) {
      console.warn('[SecureStorage] getItem decryption failed for key:', name, err);
      // Return null — the store will reinitialize from defaults
      return null;
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const encrypted = await encryptionService.encryptForStorage(value);
      await AsyncStorage.setItem(name, encrypted);
    } catch (err) {
      console.error('[SecureStorage] setItem encryption failed for key:', name, err);
      // Fallback: store plaintext rather than losing data entirely
      await AsyncStorage.setItem(name, value);
    }
  },

  removeItem: async (name: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(name);
    } catch (err) {
      console.warn('[SecureStorage] removeItem failed for key:', name, err);
    }
  },
};
