// MODULE 2 — Prompt Engineering Agent
// Requirement 3.2: rewrite clearly · enrich with visual details · preserve intent
// Input:  userInstruction (string) + visionOutput (from Agent 1)
// Output: { refined_prompt, enrichments[], preserved_intent, ambiguity_flag }

import { callOpenAI, parseJSON } from './api.js';

export async function runPromptAgent(apiKey, userInstruction, visionOutput) {
  if (!userInstruction.trim()) {
    return {
      refined_prompt: null,
      enrichments: [],
      preserved_intent: '',
      ambiguity_flag: 'Instruction is empty. Please describe what transformation or analysis you want.',
    };
  }

  const system =
    'You are a prompt engineering agent specializing in image generation. Return ONLY valid JSON, no markdown fences.';

  const userContent = `User request: "${userInstruction}"

Vision analysis context (from Agent 01):
${JSON.stringify(visionOutput, null, 2)}

Rewrite the user request into a precise, detailed image-generation prompt using the visual context above.
Return exactly this JSON (no markdown):
{
  "refined_prompt": "A detailed, specific image-generation prompt (2-4 sentences) that preserves the user's intent and leverages the visual context",
  "enrichments": [
    "Visual detail added from scene analysis",
    "Style or quality enhancement added",
    "Contextual element preserved or enhanced"
  ],
  "preserved_intent": "One sentence explaining how the original user intent was kept intact",
  "ambiguity_flag": null
}
If the user's request is genuinely ambiguous or contradictory, set ambiguity_flag to a clear explanation and set refined_prompt to null.`;

  const raw = await callOpenAI(apiKey, system, userContent);
  return parseJSON(raw);
}
