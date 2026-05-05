import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  ConfirmationResult
} from 'firebase/auth';
import { auth } from './firebase';

export const authService = {
  /**
   * Login with email and password
   */
  login: async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Signup with email and password
   */
  signup: async (email: string, password: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Logout the current user
   */
  logout: async () => {
    try {
      await signOut(auth);
    } catch (error) {
      throw error;
    }
  },

  /**
   * Sign in with phone number (triggers OTP)
   */
  signInWithPhone: async (phoneNumber: string, recaptchaVerifier: any): Promise<ConfirmationResult> => {
    try {
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      return confirmation;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Verify OTP code
   */
  verifyOTP: async (confirmationResult: ConfirmationResult, code: string) => {
    try {
      const userCredential = await confirmationResult.confirm(code);
      return userCredential.user;
    } catch (error) {
      throw error;
    }
  }
};
