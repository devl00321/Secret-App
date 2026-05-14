import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini AI SDK
const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY || '');

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
   * Analyzes the current safety context using Gemini AI to provide proactive insights.
   */
  analyzeSafetyContext: async (context: SafetyContext): Promise<AIInsight> => {
    try {
      if (!process.env.EXPO_PUBLIC_GEMINI_API_KEY) {
        return aiService.getFallbackInsight(context);
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

      const prompt = `
        You are "Luvv Guard", a protective AI for a couples' safety app. 
        Analyze the following context and provide a brief safety insight for the partner.
        Context:
        - Current User Battery: ${Math.round(context.batteryLevel * 100)}% (${context.isCharging ? 'Charging' : 'Not charging'})
        - Time: ${context.timeOfDay}
        - Navigating: ${context.isNavigating ? 'Yes' : 'No'}
        - User's Location: ${context.latitude}, ${context.longitude}
        - Partner's Name: ${context.partnerName}

        Return a JSON object with:
        {
          "status": "safe" | "warning" | "alert",
          "message": "A short, reassuring or informative message for the partner (max 15 words)",
          "suggestion": "Optional proactive suggestion (max 10 words)",
          "reason": "Internal reason for this status"
        }
        Be protective but not alarmist. If it's late and battery is low, use "warning". If everything is normal, use "safe".
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Clean the response in case it contains markdown code blocks
      const cleanedJson = text.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanedJson);
    } catch (error) {
      console.warn('[AIService] Gemini analysis failed:', error);
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
