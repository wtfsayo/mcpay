import { generateText } from "ai";
import { gateway } from "@vercel/ai-sdk-gateway";

export const agent = async (prompt: string) => {
  const text = await generateText({
    model: gateway("gpt-4o-mini"),
    prompt,
  });
  return text.text;
};