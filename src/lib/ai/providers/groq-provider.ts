import type { AIProvider, AIMessage, AIGenerateOptions, AIGenerateResult } from "../types.ts";

export class GroqProvider implements AIProvider {
  readonly name = "groq" as const;

  isConfigured(): boolean {
    return Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 0);
  }

  async generateText(messages: AIMessage[], options?: AIGenerateOptions): Promise<AIGenerateResult> {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    const model = options?.model || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
    const timeoutMs = options?.timeoutMs || 10000;
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          temperature: options?.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? 1024,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let message = `Groq API error HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error?.message) message += `: ${parsed.error.message}`;
        } catch {
          message += `: ${errorText.slice(0, 100)}`;
        }
        throw new Error(message);
      }

      const json = await response.json();
      const content = json.choices?.[0]?.message?.content || "";
      const executionTimeMs = Date.now() - startTime;

      return {
        text: content,
        provider: "groq",
        model,
        executionTimeMs,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new Error(`Groq request timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  }
}
