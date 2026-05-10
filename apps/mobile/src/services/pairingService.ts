import * as Crypto from 'expo-crypto';
import { db, serverTimestamp, doc, setDoc, FirestoreTimestamp, runTransaction } from './firebase';

const INVITE_CODE_LENGTH = 6;
const INVITE_EXPIRY_MINUTES = 10;

const generateSecureInviteCode = () => {
  const bytes = Crypto.getRandomBytes(INVITE_CODE_LENGTH);

  return Array.from(bytes, (value) => (value % 10).toString()).join('');
};

export const pairingService = {
  /**
   * Generates a 6-digit random code and stores it in inviteCodes
   */
  createInviteCode: async (userId: string) => {
    const code = generateSecureInviteCode();
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + INVITE_EXPIRY_MINUTES);

    try {
      // Direct write with a 5-second timeout
      const codeRef = doc(db, 'inviteCodes', code);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timed out. Please check your internet.')), 5000)
      );

      await Promise.race([
        setDoc(codeRef, {
          code,
          createdBy: userId,
          createdAt: serverTimestamp(),
          expiresAt: FirestoreTimestamp.fromDate(expiryDate),
          isUsed: false
        }),
        timeoutPromise
      ]);

      return { code, expiresAt: expiryDate };
    } catch (err: any) {
      console.error('[PairingService] Failed to create code:', err);
      throw new Error(err.message || 'Check your internet connection and try again.');
    }
  },

  /**
   * Joins a couple using an invite code
   */
  joinWithCode: async (code: string, currentUserId: string) => {
    const normalizedCode = code.replace(/\D/g, '').slice(0, INVITE_CODE_LENGTH);

    if (normalizedCode.length !== INVITE_CODE_LENGTH) {
      throw new Error('Please enter a valid 6-digit code.');
    }

    return await runTransaction(db, async (transaction) => {
      const codeRef = doc(db, 'inviteCodes', normalizedCode);
      const codeSnap = await transaction.get(codeRef);

      if (!codeSnap.exists) {
        throw new Error('Invalid code. Please check and try again.');
      }

      const data = codeSnap.data() as any;
      const now = new Date();

      if (data.isUsed) {
        throw new Error('This code has already been used.');
      }

      if (data.expiresAt.toDate() < now) {
        throw new Error('This code has expired.');
      }

      if (data.createdBy === currentUserId) {
        throw new Error('You cannot join your own code.');
      }

      const currentUserRef = doc(db, 'users', currentUserId);
      const creatorUserRef = doc(db, 'users', data.createdBy);
      const currentUserSnap = await transaction.get(currentUserRef);
      const creatorUserSnap = await transaction.get(creatorUserRef);

      if (!currentUserSnap.exists || !creatorUserSnap.exists) {
        throw new Error('We could not find both user profiles. Please try again.');
      }

      if (currentUserSnap.data()?.coupleId || creatorUserSnap.data()?.coupleId) {
        throw new Error('One of these accounts is already paired.');
      }

      const coupleId = [data.createdBy, currentUserId].sort().join('_');
      const coupleRef = doc(db, 'couples', coupleId);

      transaction.set(coupleRef, {
        id: coupleId,
        users: [data.createdBy, currentUserId],
        createdAt: serverTimestamp(),
      });

      transaction.set(
        currentUserRef,
        {
          partnerId: data.createdBy,
          coupleId,
        },
        { merge: true }
      );

      transaction.set(
        creatorUserRef,
        {
          partnerId: currentUserId,
          coupleId,
        },
        { merge: true }
      );

      transaction.set(
        codeRef,
        {
          isUsed: true,
          usedBy: currentUserId,
          usedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // ── LOG TO TIMELINE ──
      // This happens after the transaction technically, but we use the service
      import('./activityService').then(({ activityService }) => {
        activityService.logActivity('anniversary', 'We started our journey together! ❤️', {
          isPairingEvent: true
        });
      });

      return { coupleId, partnerId: data.createdBy };
    });
  }
};
