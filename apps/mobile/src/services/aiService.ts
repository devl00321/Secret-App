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

const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'couple-app-60de2';
const REGION = 'asia-south2';
const FUNCTION_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/analyzeSafetyContext`;

export const aiService = {
  /**
   * Analyzes the current safety context using the secure Firebase Cloud Function.
   * Falls back gracefully to rule-based insight if offline or function is uncallable.
   */
  analyzeSafetyContext: async (context: SafetyContext): Promise<AIInsight> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: context }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        if (json?.result) {
          return json.result as AIInsight;
        }
      }

      return aiService.getFallbackInsight(context);
    } catch {
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
