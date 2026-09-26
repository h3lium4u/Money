import { NextResponse } from "next/server";
import { processChatMessage } from "@/lib/ai/orchestrator.ts";
import { z } from "zod";

const chatRequestSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(1000, "Message too long"),
  history: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
  })).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = chatRequestSchema.parse(body);

    const result = await processChatMessage(validated.message, {
      history: validated.history,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[API AI Chat Error]:", error);
    return NextResponse.json(
      { error: "The AI assistant is temporarily unavailable. Please try again later." },
      { status: 500 }
    );
  }
}
