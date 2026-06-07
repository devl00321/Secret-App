import { db, authInstance, serverTimestamp, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, writeBatch, getDocs, query, where } from './firebase';
import { encryptionService } from './encryptionService';
import { useAuthStore } from '../store/useAuthStore';

export interface PartnerProfile {
  id: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string;
  photoURL: string;
  createdAt?: unknown;
  partnerId: string | null;
  coupleId: string | null;
  isOnline: boolean;
  lastMessage?: string;
  gender?: 'Male' | 'Female' | 'Non-binary' | 'Prefer not to say' | '';
  dob?: string; // DD/MM/YYYY — stored encrypted
  profileSetupComplete?: boolean;
  partnerNickname?: string; // stored encrypted
  anniversaryDate?: string; // DD/MM/YYYY — stored encrypted
  publicKey?: string; // ECDH public key — plaintext (safe to expose)
  emergencyContact?: {
    name: string;   // stored encrypted
    phone: string;  // stored encrypted
    updatedAt: string;
  };
  emergencyContacts?: {
    id: string;
    name: string;   // stored encrypted
    phone: string;  // stored encrypted
    priority: number;
    updatedAt: string;
  }[];
  savedPlaces?: any[]; // stored encrypted (array of location objects)
}

// Strict type for allowed couple-level updates (prevents overwriting protected fields)
export interface CoupleUpdateData {
  anniversaryDate?: string;
  savedPlaces?: any[];
  sosActive?: boolean;
  sosLocation?: { latitude: number; longitude: number } | null;
  sosCancelledBy?: string | null;
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Gets the active shared secret — prefers ECDH, falls back to legacy bridge.
 * VUL-6 FIX: Removed hardcoded 'luvv_no_couple'. Callers that need pre-pairing
 * encryption should use encryptionService.getPrePairingSecret() directly (async).
 */
function getActiveSecret(coupleId: string | null): string {
  const { sharedSecret } = useAuthStore.getState();
  if (sharedSecret) return sharedSecret;
  if (coupleId) return encryptionService.getLegacySecret(coupleId);
  // Return the legacy sentinel — actual pre-pairing calls should use
  // encryptionService.getPrePairingSecret() for real per-device key
  return encryptionService.LEGACY_NO_COUPLE_SENTINEL;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const userService = {
  /**
   * Syncs user data with Firestore on login/signup.
   * Does NOT throw errors to prevent blocking app initialization.
   */
  createUserIfNotExists: async (user: any) => {
    try {
      const userRef = doc(db, 'users', user.uid);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 3000)
      );

      const userSnap = await Promise.race([
        getDoc(userRef),
        timeoutPromise,
      ]) as any;

      if (!userSnap.exists()) {
        // Generate ECDH keypair for new user immediately
        const publicKey = await encryptionService.getPublicKey();

        const userData = {
          id: user.uid,
          email: user.email || null,
          phoneNumber: user.phoneNumber || null,
          displayName: user.displayName || 'LUVV User',
          photoURL: user.photoURL || '',
          createdAt: serverTimestamp(),
          partnerId: null,
          coupleId: null,
          isOnline: true,
          profileSetupComplete: false,
          publicKey, // ← ECDH public key uploaded at account creation
        };
        await setDoc(userRef, userData);
        return userData;
      } else {
        await updateDoc(userRef, { isOnline: true });
        return userSnap.data() as PartnerProfile;
      }
    } catch (err) {
      console.warn('[UserService] Sync failed:', err);
      return null;
    }
  },

  getUserData: async (uid: string): Promise<PartnerProfile | null> => {
    try {
      const userSnap = await getDoc(doc(db, 'users', uid));
      const data = userSnap.data() as PartnerProfile;
      if (!data) return null;

      const { coupleId, sharedSecret } = useAuthStore.getState();
      
      // Attempt to load secret directly if store is empty (fixes race condition in RootLayout)
      let secret = sharedSecret;
      if (!secret && coupleId) {
        secret = await encryptionService.loadSharedSecret(coupleId);
      }
      
      // Final fallback to legacy
      if (!secret) {
        secret = getActiveSecret(coupleId);
      }
      
      return await encryptionService.decryptProfileFields(data, secret, coupleId) as PartnerProfile;
    } catch (err) {
      console.warn('[UserService] Get data failed:', err);
      return null;
    }
  },

  /**
   * Helper to decrypt a profile object using the active shared secret.
   */
  decryptProfile: async (data: any): Promise<PartnerProfile> => {
    const { coupleId, sharedSecret } = useAuthStore.getState();
    
    // Attempt to load secret directly if store is empty
    let secret = sharedSecret;
    if (!secret && coupleId) {
      secret = await encryptionService.loadSharedSecret(coupleId);
    }
    
    // Final fallback to legacy
    if (!secret) {
      secret = getActiveSecret(coupleId);
    }
    
    try {
      return await encryptionService.decryptProfileFields(data, secret, coupleId) as PartnerProfile;
    } catch (e) {
      // If primary decryption fails, try the legacy secret explicitly
      const legacySecret = encryptionService.getLegacySecret(coupleId || '');
      if (secret !== legacySecret) {
        try {
          return await encryptionService.decryptProfileFields(data, legacySecret, coupleId) as PartnerProfile;
        } catch (e2) {}
      }
      return data as PartnerProfile;
    }
  },

  updateUserPresence: async (uid: string, isOnline: boolean) => {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, {
        isOnline,
        lastActive: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      // Silent fail for presence
    }
  },

  /**
   * Updates user profile fields — encrypting sensitive fields before write.
   */
  updateUserProfile: async (uid: string, data: Partial<PartnerProfile>) => {
    try {
      const { coupleId } = useAuthStore.getState();
      const secret = getActiveSecret(coupleId);

      const encryptedData = await encryptionService.encryptProfileFields(data, secret);

      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, encryptedData, { merge: true });
    } catch (err) {
      console.warn('[UserService] Profile update failed:', err);
      throw err;
    }
  },

  /**
   * Updates partner nickname — encrypted before write.
   */
  updatePartnerNickname: async (uid: string, nickname: string) => {
    try {
      const { coupleId } = useAuthStore.getState();
      const secret = getActiveSecret(coupleId);

      const encryptedNickname = await encryptionService.encryptField(nickname, secret);
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, { partnerNickname: encryptedNickname }, { merge: true });
    } catch (err) {
      console.warn('[UserService] Nickname update failed:', err);
      throw err;
    }
  },

  updateCoupleData: async (coupleId: string, data: CoupleUpdateData) => {
    try {
      const coupleRef = doc(db, 'couples', coupleId);
      await setDoc(coupleRef, data as any, { merge: true });
    } catch (err) {
      console.warn('[UserService] Couple update failed:', err);
      throw err;
    }
  },

  /**
   * Permanently deletes the user's account and all associated data.
   * Requirement for App Store / Play Store.
   */
  deleteUserAccount: async (uid: string, partnerId: string | null, coupleId: string | null) => {
    try {
      const currentUser = authInstance.currentUser;
      if (!currentUser) {
        throw new Error('No current user found');
      }

      // 1. Purge Invite Codes created by this user
      const codes = await getDocs(query(collection(db, 'inviteCodes'), where('createdBy', '==', uid)));
      if (!codes.empty) {
        const codeBatch = writeBatch(db);
        codes.docs.forEach(docSnap => codeBatch.delete(docSnap.ref));
        await codeBatch.commit();
      }

      // 2. Clean up Couple Data (Messages, Activities, etc.)
      if (coupleId) {
        const coupleRef = doc(db, 'couples', coupleId);

        const messages = await getDocs(collection(db, 'couples', coupleId, 'messages'));
        if (!messages.empty) {
          const msgBatch = writeBatch(db);
          messages.docs.forEach(docSnap => msgBatch.delete(docSnap.ref));
          await msgBatch.commit();
        }

        const activities = await getDocs(collection(db, 'couples', coupleId, 'activities'));
        if (!activities.empty) {
          const actBatch = writeBatch(db);
          activities.docs.forEach(docSnap => actBatch.delete(docSnap.ref));
          await actBatch.commit();
        }

        await deleteDoc(coupleRef);
      }

      // 3. Unlink Partner
      if (partnerId) {
        const partnerRef = doc(db, 'users', partnerId);
        // This setDoc will now pass rules thanks to the partner update rule
        await setDoc(partnerRef, {
          partnerId: null,
          coupleId: null,
          partnerNickname: null,
        }, { merge: true });
      }

      // 4. Delete User Profile document
      const userRef = doc(db, 'users', uid);
      await deleteDoc(userRef);

      // 5. FINALLY Delete the Firebase Auth User
      // This MUST be last because subsequent Firestore calls will lose permissions once deleted.
      await currentUser.delete();

      return true;
    } catch (err) {
      console.error('[UserService] Full account deletion failed:', err);
      throw err;
    }
  },

  // Exposed for components that need to decrypt profile data received from Firestore
  decryptProfileFields: (data: any, secret: string, coupleId?: string | null) => encryptionService.decryptProfileFields(data, secret, coupleId),
  encryptProfileFields: (data: any, secret: string) => encryptionService.encryptProfileFields(data, secret),
};
