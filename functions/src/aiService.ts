import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

const getFallbackInsight = (context: SafetyContext): AIInsight => {
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
};

export const analyzeSafetyContext = onCall(async (request) => {
  const context = request.data as SafetyContext;
  if (!context) {
    throw new HttpsError('invalid-argument', 'The function must be called with a valid SafetyContext.');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[AIService] GEMINI_API_KEY is not set. Using fallback.');
    return getFallbackInsight(context);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `
      You are "Luvv Guard", a protective AI for a couples' safety app. 
      Analyze the following context and provide a brief safety insight for the partner.
      Context:
      - Current User Battery: ${Math.round(context.batteryLevel * 100)}% (${context.isCharging ? 'Charging' : 'Not charging'})
      - Time: ${context.timeOfDay}
      - Navigating: ${context.isNavigating ? 'Yes' : 'No'}
      - User's Location: ${context.latitude}, ${context.longitude}
      - Partner's Name: ${context.partnerName}

      IMPORTANT: Return ONLY a valid JSON object. No markdown, no explanation.
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
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return getFallbackInsight(context);
  } catch (error) {
    console.error('[AIService] Gemini analysis failed:', error);
    return getFallbackInsight(context);
  }
});
