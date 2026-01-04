
import { GoogleGenAI, Type } from "@google/genai";
import { MediaType, DetectionResult, Verdict, GroundingSource } from "../types";

export const analyzeMedia = async (
  type: MediaType,
  data: string, // Base64 data for files, or URL string
  mimeType?: string
): Promise<DetectionResult> => {
  // Ensure the key exists in the current execution context (injected via window.aistudio or process.env)
  if (!process.env.API_KEY) {
    throw new Error("AUTH_ERROR: Digital Signature (API Key) is missing. Link a GCP Project via the SOC Control Panel.");
  }

  // CRITICAL: Instantiate inside the call to pick up the latest selected key from window.aistudio session
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemPrompt = `
    You are a Senior Digital Forensics SOC Analyst specialized in AI Manipulation and Cyber Threat Intelligence.
    Your objective is to provide a high-confidence verdict on whether the provided media or link is REAL/SAFE or AI-GENERATED/MALICIOUS.

    SIGNAL NAMING CONVENTION (USE THESE EXACT NAMES in signal_contributions):
    - AUDIO: "Spectral Gaps", "Pitch Inconsistency", "Frequency Anomalies"
    - VIDEO: "Lip-Sync Alignment", "Blink Patterns", "Temporal Artifacts", "Lighting Consistency"
    - IMAGE: "GAN Geometry", "Lighting Consistency", "Frequency Anomalies"
    - URL: "Redirect Chains", "WHOIS Anomalies", "Certificate Trust"

    Always return structured JSON.
  `;

  const prompt = type === MediaType.URL 
    ? `Perform a deep cyber forensic scan on the URL: ${data}. Evaluate domain reputation via grounding.`
    : `Perform a deep forensic analysis on this asset for AI cloning or GAN-generation artifacts.`;

  const contents = type === MediaType.URL ? { parts: [{ text: prompt }] } : {
    parts: [
      { inlineData: { data, mimeType: mimeType || (type === MediaType.VIDEO ? 'video/mp4' : 'image/png') } },
      { text: prompt }
    ]
  };

  try {
    const config: any = {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          media_type: { type: Type.STRING },
          confidence_score: { type: Type.NUMBER },
          verdict: { type: Type.STRING },
          signals_detected: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          signal_contributions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                contribution_score: { type: Type.NUMBER }
              },
              required: ["name", "contribution_score"]
            }
          },
          recommendation: { type: Type.STRING },
          forensic_analysis: { type: Type.STRING }
        },
        required: ["media_type", "confidence_score", "verdict", "signals_detected", "recommendation", "forensic_analysis"]
      }
    };

    if (type === MediaType.URL) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents,
      config
    });

    if (!response.text) throw new Error("EMPTY_FORENSIC_STREAM");

    const result = JSON.parse(response.text);

    // Extract grounding sources from Search Grounding
    const groundingSources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          groundingSources.push({
            title: chunk.web.title || "Threat Intel Source",
            uri: chunk.web.uri
          });
        }
      });
    }

    return {
      ...result,
      media_type: type,
      verdict: result.verdict as Verdict,
      grounding_sources: groundingSources.length > 0 ? groundingSources : undefined
    };
  } catch (error: any) {
    // Specific trap for orphaned API project references or deleted keys
    if (error.message?.includes("entity was not found") || error.message?.includes("API_KEY_INVALID")) {
      throw new Error("UPLINK_TERMINATED: The linked GCP forensic project is no longer valid. Reset Uplink.");
    }
    throw new Error(`ENGINE_FAILURE: ${error.message || "Unknown anomaly"}`);
  }
};
