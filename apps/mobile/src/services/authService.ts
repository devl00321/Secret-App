import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  updateProfile,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithCredential,
  ConfirmationResult
} from 'firebase/auth';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { auth } from './firebase';

export const authService = {
  signup: async (email: string, password: string, displayName?: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(userCredential.user, { displayName });
    }
    return userCredential.user;
  },

  login: async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
    return userCredential.user;
  },

  signInWithPhone: async (
    phoneNumber: string,
    recaptchaVerifier: FirebaseRecaptchaVerifierModal | null
  ): Promise<ConfirmationResult> => {
    if (!recaptchaVerifier) {
      throw new Error('Phone verification is not ready yet. Please try again.');
    }

    return await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
  },

  verifyOTP: async (confirmationResult: ConfirmationResult, code: string) => {
    const userCredential = await confirmationResult.confirm(code);
    return userCredential.user;
  },

  signInWithGoogle: async (idToken: string) => {
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);
    return userCredential.user;
  },

  logout: async () => {
    await signOut(auth);
  }
};
