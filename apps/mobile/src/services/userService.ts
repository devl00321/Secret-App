import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { User } from 'firebase/auth';

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
}

export const userService = {
  createUserIfNotExists: async (user: User) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          id: user.uid,
          email: user.email || null,
          phoneNumber: user.phoneNumber || null,
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          createdAt: serverTimestamp(),
          partnerId: null,
          coupleId: null,
          isOnline: true,
        });
      } else {
        // Ensure online status on login
        await setDoc(userRef, { isOnline: true }, { merge: true });
      }
    } catch (err) {
      console.warn('User sync failed (likely offline):', err);
      // Don't throw, let the app continue with whatever state it has
    }
  },

  getUserData: async (uid: string): Promise<PartnerProfile | null> => {
    try {
      const userSnap = await getDoc(doc(db, 'users', uid));
      return userSnap.exists() ? (userSnap.data() as PartnerProfile) : null;
    } catch (err) {
      console.warn('Get user data failed (likely offline):', err);
      return null;
    }
  },

  updateUserPresence: async (uid: string, isOnline: boolean) => {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, { isOnline }, { merge: true });
    } catch (err) {
      console.warn('Presence update failed (likely offline):', err);
    }
  }
};
