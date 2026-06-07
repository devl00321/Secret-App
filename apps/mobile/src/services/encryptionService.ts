/**
 * LUVV — End-to-End Encryption Service (X25519 ECDH + AES-256-GCM)
 * Public API only — core logic lives in ./encryption/ sub-modules.
 */
import * as SecureStore from 'expo-secure-store';
import { aesEncrypt, aesDecrypt } from './encryption/aesGcm';
import {
  generateKeyPair,
  deriveSharedSecret,
  getOrCreateDeviceKey,
  secureStoreGetWithRetry,
  PRIVATE_KEY_STORE_KEY,
  SECURE_STORE_OPTIONS,
} from './encryption/keyDerivation';

const SHARED_SECRET_KEY_PREFIX = 'luvv_shared_secret_v1_';

export const encryptionService = {
  // ── Key Lifecycle ────────────────────────────────────────────────────────

  initializeKeys: async (): Promise<string> => {
    const { publicKeyB64, privateKeyB64 } = await generateKeyPair();
    await SecureStore.setItemAsync(PRIVATE_KEY_STORE_KEY, privateKeyB64, SECURE_STORE_OPTIONS);
    console.log('[Encryption] ✅ New keypair generated.');
    return publicKeyB64;
  },

  getPublicKey: async (): Promise<string> => {
    try {
      const privateKeyB64 = await SecureStore.getItemAsync(PRIVATE_KEY_STORE_KEY, SECURE_STORE_OPTIONS);
      if (!privateKeyB64) return encryptionService.initializeKeys();
      const privateJwk = JSON.parse(atob(privateKeyB64));
      const publicJwk = { kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x, y: privateJwk.y, key_ops: [] };
      return btoa(JSON.stringify(publicJwk));
    } catch {
      return encryptionService.initializeKeys();
    }
  },

  establishSharedSecret: async (coupleId: string, partnerPublicKeyB64: string): Promise<void> => {
    const myPrivateKeyB64 = await secureStoreGetWithRetry(PRIVATE_KEY_STORE_KEY);
    if (!myPrivateKeyB64) throw new Error('[Encryption] No private key found.');
    const sharedSecret = await deriveSharedSecret(myPrivateKeyB64, partnerPublicKeyB64);
    await SecureStore.setItemAsync(`${SHARED_SECRET_KEY_PREFIX}${coupleId}`, sharedSecret, SECURE_STORE_OPTIONS);
    console.log('[Encryption] ✅ Shared secret stored for couple:', coupleId);
  },

  loadSharedSecret: async (coupleId: string): Promise<string | null> => {
    try {
      return await secureStoreGetWithRetry(`${SHARED_SECRET_KEY_PREFIX}${coupleId}`);
    } catch {
      return null;
    }
  },

  getPrePairingSecret: async (): Promise<string> => getOrCreateDeviceKey(),



  // ── Encrypt / Decrypt ────────────────────────────────────────────────────

  encryptField: async (value: string, sharedSecret: string): Promise<string> => {
    try {
      if (!value || !sharedSecret) return value;
      return await aesEncrypt(value, sharedSecret);
    } catch {
      return value;
    }
  },

  decryptField: async (ciphertext: string, sharedSecret: string, coupleId?: string | null): Promise<string> => {
    try {
      if (!ciphertext || !sharedSecret) return ciphertext;

      // 1. Try modern AES-GCM
      return await aesDecrypt(ciphertext, sharedSecret);
    } catch {
      return '';
    }
  },

  encryptObject: async (obj: object, sharedSecret: string): Promise<string> => {
    try {
      if (!obj || !sharedSecret) return '';
      return await aesEncrypt(JSON.stringify(obj), sharedSecret);
    } catch {
      return '';
    }
  },

  decryptObject: async <T>(ciphertext: string, sharedSecret: string): Promise<T | null> => {
    try {
      if (!ciphertext || !sharedSecret) return null;
      const json = await aesDecrypt(ciphertext, sharedSecret);
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  },

  // ── Local Storage Encryption ─────────────────────────────────────────────

  encryptForStorage: async (data: string): Promise<string> => {
    try {
      return await aesEncrypt(data, await getOrCreateDeviceKey());
    } catch {
      return data;
    }
  },

  decryptFromStorage: async (ciphertext: string): Promise<string> => {
    try {
      return await aesDecrypt(ciphertext, await getOrCreateDeviceKey());
    } catch {
      return ciphertext;
    }
  },

  // ── Key Rotation ─────────────────────────────────────────────────────────

  rotateSharedSecret: async (coupleId: string, newPartnerPublicKeyB64: string): Promise<void> => {
    await encryptionService.establishSharedSecret(coupleId, newPartnerPublicKeyB64);
  },

  // ── Profile Field Helpers ─────────────────────────────────────────────────

  encryptProfileFields: async (data: any, sharedSecret: string): Promise<any> => {
    const enc = { ...data };
    if (data.dob) enc.dob = await encryptionService.encryptField(data.dob, sharedSecret);
    if (data.partnerNickname) enc.partnerNickname = await encryptionService.encryptField(data.partnerNickname, sharedSecret);
    if (data.anniversaryDate) enc.anniversaryDate = await encryptionService.encryptField(data.anniversaryDate, sharedSecret);
    if (data.emergencyContact) {
      enc.emergencyContact = {
        ...data.emergencyContact,
        name: await encryptionService.encryptField(data.emergencyContact.name, sharedSecret),
        phone: await encryptionService.encryptField(data.emergencyContact.phone, sharedSecret),
      };
    }
    if (data.emergencyContacts?.length > 0) {
      enc.emergencyContacts = await Promise.all(
        data.emergencyContacts.map(async (c: any) => ({
          ...c,
          name: await encryptionService.encryptField(c.name, sharedSecret),
          phone: await encryptionService.encryptField(c.phone, sharedSecret),
        }))
      );
    }
    return enc;
  },

  decryptProfileFields: async (data: any, sharedSecret: string, fallbackCoupleId?: string | null): Promise<any> => {
    const dec = { ...data };
    const coupleId = fallbackCoupleId || data.coupleId;
    if (data.dob) dec.dob = await encryptionService.decryptField(data.dob, sharedSecret, coupleId);
    if (data.partnerNickname) dec.partnerNickname = await encryptionService.decryptField(data.partnerNickname, sharedSecret, coupleId);
    if (data.anniversaryDate) dec.anniversaryDate = await encryptionService.decryptField(data.anniversaryDate, sharedSecret, coupleId);
    if (data.emergencyContact) {
      dec.emergencyContact = {
        ...data.emergencyContact,
        name: await encryptionService.decryptField(data.emergencyContact.name, sharedSecret, coupleId),
        phone: await encryptionService.decryptField(data.emergencyContact.phone, sharedSecret, coupleId),
      };
    }
    if (data.emergencyContacts?.length > 0) {
      dec.emergencyContacts = await Promise.all(
        data.emergencyContacts.map(async (c: any) => ({
          ...c,
          name: await encryptionService.decryptField(c.name, sharedSecret, coupleId),
          phone: await encryptionService.decryptField(c.phone, sharedSecret, coupleId),
        }))
      );
    }
    if (data.savedPlaces && typeof data.savedPlaces === 'string') {
      dec.savedPlaces = (await encryptionService.decryptObject<any[]>(data.savedPlaces, sharedSecret)) || [];
    }
    return dec;
  },


};
