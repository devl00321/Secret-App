/**
 * ECDH P-256 key pair generation, shared secret derivation, and device-local key management.
 * Private keys are stored exclusively in expo-secure-store (hardware-backed keychain).
 */
import * as SecureStore from 'expo-secure-store';
import crypto from 'react-native-quick-crypto';
import { uint8ToHex, hexToUint8 } from './encoding';

const subtle = crypto.subtle;

const PRIVATE_KEY_STORE_KEY = 'luvv_ecdh_private_key_v1';
const LOCAL_DEVICE_KEY = 'luvv_local_device_key_v1';

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export async function secureStoreGetWithRetry(key: string, retries = 3): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      return await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
    } catch (err: any) {
      const isLocked = (err.message || '').includes('User interaction') || (err.cause?.message || '').includes('User interaction');
      if (isLocked && i < retries - 1) {
        console.warn(`[Encryption] Keychain locked, retrying... (${i + 1}/${retries})`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
  return null;
}

export async function generateKeyPair(): Promise<{ publicKeyB64: string; privateKeyB64: string }> {
  const keyPair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']) as any;
  const publicJwk = await subtle.exportKey('jwk', keyPair.publicKey);
  const privateJwk = await subtle.exportKey('jwk', keyPair.privateKey);
  return {
    publicKeyB64: btoa(JSON.stringify(publicJwk)),
    privateKeyB64: btoa(JSON.stringify(privateJwk)),
  };
}

export async function deriveSharedSecret(myPrivateKeyB64: string, partnerPublicKeyB64: string): Promise<string> {
  const myPrivateJwk = JSON.parse(atob(myPrivateKeyB64));
  const partnerPublicJwk = JSON.parse(atob(partnerPublicKeyB64));

  const privateKey = await crypto.subtle.importKey('jwk', myPrivateJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const partnerPublicKey = await crypto.subtle.importKey('jwk', partnerPublicJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: partnerPublicKey }, privateKey, 256);

  return uint8ToHex(new Uint8Array(sharedBits));
}

export async function getOrCreateDeviceKey(): Promise<string> {
  let key = await secureStoreGetWithRetry(LOCAL_DEVICE_KEY);
  if (!key) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32)) as Uint8Array;
    key = uint8ToHex(randomBytes);
    await SecureStore.setItemAsync(LOCAL_DEVICE_KEY, key, SECURE_STORE_OPTIONS);
  }
  return key;
}

export { PRIVATE_KEY_STORE_KEY, SECURE_STORE_OPTIONS };
