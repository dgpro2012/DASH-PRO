
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  isThinking?: boolean;
}

export const AiService = {
  /**
   * Generates a streaming response for the chat.
   * Decides which model to use based on the 'useDeepThink' flag.
   */
  async *streamChat(
    history: ChatMessage[], 
    newMessage: string, 
    contextData: string, 
    useDeepThink: boolean,
    customSystemPrompt: string // Added dynamic prompt support
  ) {
    // 1. Define Model and Config based on mode
    let modelId = 'gemini-3-flash-preview';
    
    // Construct the final instruction combining Persona + Data Context
    const finalSystemInstruction = `${customSystemPrompt}
      
      YOUR DATA CONTEXT:
      You have access to the user's current dashboard data in JSON format provided below.
      Use this data to answer questions accurately. If data is missing, say so.
      
      DATA CONTEXT:
      ${contextData}
    `;

    let config: any = {
      systemInstruction: finalSystemInstruction,
    };

    if (useDeepThink) {
      // THINKING MODE: Complex analysis
      modelId = 'gemini-3-pro-preview';
      config = {
        ...config,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      };
    } else {
      // STANDARD/SEARCH MODE: Fast, up-to-date
      config = {
        ...config,
        tools: [{ googleSearch: {} }], // Enable grounding
      };
    }

    // 2. Prepare History (Gemini format)
    // We limit history to last 10 turns to save tokens, but always keep system context in mind
    const contents = history.slice(-10).map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    }));

    // Add new message
    contents.push({
      role: 'user',
      parts: [{ text: newMessage }]
    });

    try {
      const responseStream = await ai.models.generateContentStream({
        model: modelId,
        contents: contents,
        config: config
      });

      for await (const chunk of responseStream) {
        // Extract text
        const text = chunk.text;
        if (text) yield { type: 'text', content: text };
        
        // Extract grounding (sources)
        const grounding = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (grounding) yield { type: 'grounding', content: grounding };
      }
    } catch (error) {
      console.error("AI Service Error:", error);
      yield { type: 'text', content: "⚠️ PECAS Bot se ha desconectado momentáneamente (API Error). Intenta de nuevo." };
    }
  }
};
