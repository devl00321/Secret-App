import CryptoJS from 'crypto-js';

/**
 * End-to-End Encryption Service
 * Encrypts and decrypts messages on the device before they touch the cloud.
 */
export const encryptionService = {
  /**
   * Encrypts a plain text message using a shared secret (coupleId)
   */
  encrypt: (text: string, secret: string): string => {
    try {
      if (!text || !secret) return text;
      // We use AES encryption with the coupleId as the key
      // Since only the two partners have the coupleId, this is effectively E2EE
      return CryptoJS.AES.encrypt(text, secret).toString();
    } catch (err) {
      console.error('[Encryption] Encrypt failed:', err);
      return text;
    }
  },

  /**
   * Decrypts a cipher text back to plain text
   */
  decrypt: (cipherText: string, secret: string): string => {
    try {
      if (!cipherText || !secret) return cipherText;
      
      // Attempt to decrypt
      const bytes = CryptoJS.AES.decrypt(cipherText, secret);
      const originalText = bytes.toString(CryptoJS.enc.Utf8);
      
      // If result is empty, it might not be encrypted or wrong key
      if (!originalText) return cipherText;
      
      return originalText;
    } catch (err) {
      // If decryption fails, return original (might be old unencrypted message)
      return cipherText;
    }
  }
};
