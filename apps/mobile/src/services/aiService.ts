import { getFunctions, httpsCallable } from 'firebase/functions';

export interface SafetyContext {
  latitude: number;
  longitude: number;
  batteryLevel: number;
  isCharging: boolean;
  timeOfDay: string;
  isNavigating: boolean;
  partnerName: string;
}

export interface AIInsight {
  status: 'safe' | 'warning' | 'alert';
  message: string;
  suggestion?: string;
  reason?: string;
}

export const aiService = {
  /**
   * Analyzes the current safety context using the secure Firebase Cloud Function.
   */
  analyzeSafetyContext: async (context: SafetyContext): Promise<AIInsight> => {
    try {
      const functions = getFunctions();
      const analyzeFn = httpsCallable<SafetyContext, AIInsight>(functions, 'analyzeSafetyContext');
      const result = await analyzeFn(context);
      return result.data;
    } catch (error) {
      console.warn('[AIService] Cloud Function analysis failed:', error);
      return aiService.getFallbackInsight(context);
    }
  },

  /**
   * Simple rule-based fallback if AI is unavailable.
   */
  getFallbackInsight: (context: SafetyContext): AIInsight => {
    const isLate = context.timeOfDay.includes('PM') || parseInt(context.timeOfDay) < 6;
    const isLowBattery = context.batteryLevel < 0.2;

    if (isLowBattery && isLate) {
      return {
        status: 'warning',
        message: `${context.partnerName}'s battery is low and it's late.`,
        suggestion: "Remind them to charge or head home.",
        reason: "Low battery at night"
      };
    }

    if (context.isNavigating) {
      return {
        status: 'safe',
        message: `${context.partnerName} is on their way to you.`,
        reason: "Active navigation"
      };
    }

    return {
      status: 'safe',
      message: `${context.partnerName} seems to be doing fine.`,
      reason: "Normal status"
    };
  }
};
