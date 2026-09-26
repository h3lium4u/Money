import type { AIProvider, AIMessage, AIGenerateOptions, AIGenerateResult } from "../types.ts";

export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  }

  async generateText(messages: AIMessage[], options?: AIGenerateOptions): Promise<AIGenerateResult> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    let model = options?.model || process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
    const timeoutMs = options?.timeoutMs || 10000;
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Extract system instructions and conversation turns
    const systemMessages = messages.filter((m) => m.role === "system");
    const conversationMessages = messages.filter((m) => m.role !== "system");

    const systemInstruction = systemMessages.length > 0
      ? { parts: [{ text: systemMessages.map((m) => m.content).join("\n\n") }] }
      : undefined;

    const contents = conversationMessages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const callModel = async (modelName: string) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      return await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: systemInstruction,
          contents,
          generationConfig: {
            temperature: options?.temperature ?? 0.2,
            maxOutputTokens: options?.maxTokens ?? 1024,
          },
        }),
        signal: controller.signal,
      });
    };

    try {
      let response = await callModel(model);

      // If model is retired or not found, fallback to active flash variants
      if (response.status === 404) {
        const fallbacks = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-flash-latest"];
        for (const fb of fallbacks) {
          if (fb !== model) {
            response = await callModel(fb);
            if (response.ok) {
              model = fb;
              break;
            }
          }
        }
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let message = `Gemini API error HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error?.message) message += `: ${parsed.error.message}`;
        } catch {
          message += `: ${errorText.slice(0, 100)}`;
        }
        throw new Error(message);
      }

      const json = await response.json();
      const content = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const executionTimeMs = Date.now() - startTime;

      return {
        text: content,
        provider: "gemini",
        model,
        executionTimeMs,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new Error(`Gemini request timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  }
}
