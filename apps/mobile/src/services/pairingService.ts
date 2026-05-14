import * as Crypto from 'expo-crypto';
import { db, serverTimestamp, doc, setDoc, FirestoreTimestamp, runTransaction, getDoc, updateDoc } from './firebase';
import { encryptionService } from './encryptionService';

const INVITE_CODE_LENGTH = 6;
const INVITE_EXPIRY_MINUTES = 10;

const generateSecureInviteCode = () => {
  const bytes = Crypto.getRandomBytes(INVITE_CODE_LENGTH);
  return Array.from(bytes, (value) => (value % 10).toString()).join('');
};

export const pairingService = {
  /**
   * Generates a 6-digit random code and stores it in inviteCodes.
   * Also initialises the user's ECDH keypair and uploads the public key.
   */
  createInviteCode: async (userId: string) => {
    const code = generateSecureInviteCode();
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + INVITE_EXPIRY_MINUTES);

    try {
      // ── Phase 1: Ensure this user has an ECDH keypair ──
      // getPublicKey() will generate one if it doesn't exist yet
      const publicKey = await encryptionService.getPublicKey();

      // Upload public key to Firestore (safe to expose — it's a public key)
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, { publicKey }, { merge: true });

      // ── Phase 2: Write the invite code ──
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
          isUsed: false,
        }),
        timeoutPromise,
      ]);

      return { code, expiresAt: expiryDate };
    } catch (err: any) {
      console.error('[PairingService] Failed to create code:', err);
      throw new Error(err.message || 'Check your internet connection and try again.');
    }
  },

  /**
   * Joins a couple using an invite code.
   * After a successful join, derives the ECDH shared secret and stores it
   * securely on-device via expo-secure-store.
   */
  joinWithCode: async (code: string, currentUserId: string) => {
    const normalizedCode = code.replace(/\D/g, '').slice(0, INVITE_CODE_LENGTH);

    if (normalizedCode.length !== INVITE_CODE_LENGTH) {
      throw new Error('Please enter a valid 6-digit code.');
    }

    // ── Phase 1: Ensure the joining user also has an ECDH keypair ──
    const myPublicKey = await encryptionService.getPublicKey();
    const userRef = doc(db, 'users', currentUserId);
    await setDoc(userRef, { publicKey: myPublicKey }, { merge: true });

    const result = await runTransaction(db, async (transaction) => {
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

      // Capture the partner's public key BEFORE transaction ends
      const partnerPublicKey: string | undefined = creatorUserSnap.data()?.publicKey;

      transaction.set(coupleRef, {
        id: coupleId,
        users: [data.createdBy, currentUserId],
        createdAt: serverTimestamp(),
      });

      transaction.set(
        currentUserRef,
        { partnerId: data.createdBy, coupleId },
        { merge: true }
      );

      transaction.set(
        creatorUserRef,
        { partnerId: currentUserId, coupleId },
        { merge: true }
      );

      transaction.set(
        codeRef,
        { isUsed: true, usedBy: currentUserId, usedAt: serverTimestamp() },
        { merge: true }
      );

      return { coupleId, partnerId: data.createdBy, partnerPublicKey };
    });

    // ── Phase 2: Derive and store shared secret (outside transaction) ──
    if (result.partnerPublicKey) {
      try {
        await encryptionService.establishSharedSecret(result.coupleId, result.partnerPublicKey);
        console.log('[PairingService] ✅ Shared secret established. E2EE is active.');
      } catch (secretErr) {
        // Non-fatal — app will fall back to legacy mode
        console.error('[PairingService] ⚠️ Failed to derive shared secret:', secretErr);
      }
    } else {
      console.warn('[PairingService] Partner has no public key — ECDH not possible. Legacy mode active.');
    }

    // ── Phase 3: Also establish secret for the CREATOR's side ──
    // We need to trigger the creator's device to derive the secret too.
    // We do this by writing a signal field to the couple document.
    // The creator's app (already open) will react to this and derive their secret.
    try {
      const coupleRef = doc(db, 'couples', result.coupleId);
      await setDoc(coupleRef, { keyExchangeSignal: Date.now() }, { merge: true });
    } catch (_) {}

    // ── Log to Timeline ──
    import('./activityService').then(({ activityService }) => {
      activityService.logActivity('anniversary', 'We started our journey together! ❤️', {
        isPairingEvent: true,
      });
    });

    return { coupleId: result.coupleId, partnerId: result.partnerId };
  },

  /**
   * Called by the invite CODE CREATOR's device when it detects
   * the keyExchangeSignal on the couple document.
   * This derives the shared secret on the creator's side.
   */
  finalizeKeyExchange: async (coupleId: string, myUserId: string) => {
    try {
      // Get partner's user ID from couple document
      const coupleSnap = await getDoc(doc(db, 'couples', coupleId));
      if (!coupleSnap.exists()) return;

      const users: string[] = coupleSnap.data()?.users || [];
      const partnerId = users.find((id) => id !== myUserId);
      if (!partnerId) return;

      // Fetch partner's public key
      const partnerSnap = await getDoc(doc(db, 'users', partnerId));
      const partnerPublicKey: string | undefined = partnerSnap.data()?.publicKey;

      if (!partnerPublicKey) {
        console.warn('[PairingService] Partner has no public key yet.');
        return;
      }

      await encryptionService.establishSharedSecret(coupleId, partnerPublicKey);
      console.log('[PairingService] ✅ Creator side — shared secret derived. E2EE active!');

      // Clear the signal
      await updateDoc(doc(db, 'couples', coupleId), { keyExchangeSignal: null });
    } catch (err) {
      console.error('[PairingService] finalizeKeyExchange failed:', err);
    }
  },
};
