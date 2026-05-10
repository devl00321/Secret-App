import { GoogleGenerativeAI } from "@google/generative-ai";

// Use public key for Expo client-side calls (Ensure restrictions are set in Google AI Studio)
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export interface EmergencyContext {
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  batteryLevel?: number;
  time: string;
  recentMessages?: string[];
  partnerName: string;
  userName: string;
}

export interface MapIntelligenceContext {
  currentLocation: {
    latitude: number;
    longitude: number;
  };
  history?: Array<{ latitude: number; longitude: number; timestamp: number }>;
  timeOfDay: string;
}

export const aiService = {
  /**
   * Hidden intelligence for SOS/Emergency situations.
   * Analyzes the context to provide the partner with actionable, calm insights.
   */
  async analyzeEmergency(context: EmergencyContext) {
    if (!API_KEY) return null;

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      
      const prompt = `
        You are a safety intelligence system for an app called LUVV. 
        User ${context.userName} has triggered an SOS. 
        Partner ${context.partnerName} is receiving this alert.
        
        CONTEXT:
        - Time: ${context.time}
        - Location: ${context.location.address || 'Unknown coordinates'}
        - Battery: ${context.batteryLevel ? Math.round(context.batteryLevel * 100) + '%' : 'Unknown'}
        - Recent Messages: ${context.recentMessages?.join(' | ') || 'No recent messages'}
        
        TASK:
        Provide a 1-2 sentence high-level summary for the partner. 
        Be extremely calm, helpful, and objective. 
        Identify if there are any environmental risks (late night, low battery, etc.).
        Do NOT mention you are an AI. Speak as the "LUVV Safety Guard".
        
        FORMAT: 
        { "summary": "...", "riskLevel": "low|medium|high", "suggestion": "..." }
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      try {
        // Clean markdown if present
        const jsonStr = text.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonStr);
      } catch (e) {
        return { summary: text, riskLevel: 'medium', suggestion: 'Try to call them immediately.' };
      }
    } catch (error) {
      console.error("[aiService] Emergency analysis failed:", error);
      return null;
    }
  },

  /**
   * Map intelligence for proactive safety.
   * Detects if a location pattern is unusual or if the user is in an unfamiliar area at night.
   */
  async getMapIntelligence(context: MapIntelligenceContext) {
    if (!API_KEY) return null;

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      
      const prompt = `
        Analyze this movement data for a safety app:
        - Current: ${context.currentLocation.latitude}, ${context.currentLocation.longitude}
        - Time: ${context.timeOfDay}
        - Recent History: ${context.history?.length || 0} points recorded.
        
        If this is a late night journey or an unfamiliar path, suggest enabling 'Reach Safely' mode.
        If it seems normal, return null.
        
        FORMAT: { "shouldAlert": boolean, "reason": "...", "action": "enable_safe_reach" }
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      try {
        const jsonStr = text.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonStr);
      } catch (e) {
        return null;
      }
    } catch (error) {
      console.error("[aiService] Map intelligence failed:", error);
      return null;
    }
  }
};
