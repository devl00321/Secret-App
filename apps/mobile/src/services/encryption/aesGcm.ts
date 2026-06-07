/**
 * AES-256-GCM encrypt/decrypt using react-native-quick-crypto (native OpenSSL).
 * Output format (Base64): [salt 16B] [iv 12B] [ciphertext + 16B auth tag]
 * Fresh random salt+IV per call — identical plaintexts produce different ciphertexts.
 */
import crypto from 'react-native-quick-crypto';
import { uint8ToBase64, base64ToUint8 } from './encoding';

export function aesEncrypt(plaintext: string, secret: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const salt = crypto.randomBytes(16);
      const iv = crypto.randomBytes(12);
      
      crypto.pbkdf2(secret, salt, 100000, 32, 'sha256', (err, key) => {
        if (err) return reject(err);
        try {
          const cipher = crypto.createCipheriv('aes-256-gcm', key as any, iv);
          const encrypted = new Uint8Array(cipher.update(plaintext, 'utf8'));
          const finalBuf = new Uint8Array(cipher.final());
          const authTag = new Uint8Array(cipher.getAuthTag());
          const saltArr = new Uint8Array(salt);
          const ivArr = new Uint8Array(iv);

          const packed = new Uint8Array(saltArr.length + ivArr.length + encrypted.length + finalBuf.length + authTag.length);
          let offset = 0;
          packed.set(saltArr, offset); offset += saltArr.length;
          packed.set(ivArr, offset);   offset += ivArr.length;
          packed.set(encrypted, offset); offset += encrypted.length;
          packed.set(finalBuf, offset);  offset += finalBuf.length;
          packed.set(authTag, offset);

          resolve(uint8ToBase64(packed));
        } catch (innerErr) {
          reject(innerErr);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

export function aesDecrypt(cipherBase64: string, secret: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const packed = base64ToUint8(cipherBase64);
      const salt = packed.slice(0, 16);
      const iv = packed.slice(16, 28);
      const cipherBytes = packed.slice(28);

      if (cipherBytes.length < 16) return reject(new Error('Invalid ciphertext length'));

      const actualCiphertext = cipherBytes.slice(0, cipherBytes.length - 16);
      const authTag = cipherBytes.slice(cipherBytes.length - 16);
      
      crypto.pbkdf2(secret, salt, 100000, 32, 'sha256', (err, key) => {
        if (err) return reject(err);
        try {
          const decipher = crypto.createDecipheriv('aes-256-gcm', key as any, iv);
          decipher.setAuthTag(authTag as any);
          let decrypted = decipher.update(actualCiphertext as any, undefined as any, 'utf8') as any as string;
          decrypted += decipher.final('utf8') as any as string;

          resolve(decrypted);
        } catch (innerErr) {
          reject(innerErr);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}
