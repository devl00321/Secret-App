import { auth } from './firebase';

export const authService = {
  /**
   * Login with email and password
   */
  login: async (email: string, password: string) => {
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
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
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
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
      await auth().signOut();
    } catch (error) {
      throw error;
    }
  },

  /**
   * Sign in with phone number (triggers OTP)
   */
  signInWithPhone: async (phoneNumber: string) => {
    try {
      // Native Firebase handles recaptcha automatically
      const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
      return confirmation;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Verify OTP code
   */
  verifyOTP: async (confirmationResult: any, code: string) => {
    try {
      const userCredential = await confirmationResult.confirm(code);
      return userCredential.user;
    } catch (error) {
      throw error;
    }
  }
};
