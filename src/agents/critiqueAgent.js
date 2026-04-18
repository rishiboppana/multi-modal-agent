// MODULE 4 — Critique & Evaluation Agent
// Requirement 3.4: visual relevance · prompt faithfulness · transformation quality ·
//                  CLIP similarity estimate · ACCEPT/REVISE verdict
// Input:  apiKey + original image (base64) + generated image URL + refined prompt
// Output: { visual_relevance, prompt_faithfulness, transformation_quality,
//           clip_similarity_estimate, critique, verdict, revision_suggestion }

import { callOpenAI, parseJSON } from './api.js';

export async function runCritiqueAgent(apiKey, originalBase64, mimeType, generatedImageUrl, refinedPrompt) {
  const system =
    'You are a quality evaluation agent for AI-generated images. Return ONLY valid JSON, no markdown fences.';

  const userContent = [
    {
      type: 'image_url',
      image_url: { url: `data:${mimeType};base64,${originalBase64}` },
    },
    {
      type: 'image_url',
      image_url: { url: generatedImageUrl },
    },
    {
      type: 'text',
      text: `You are shown two images: IMAGE 1 is the ORIGINAL uploaded image, IMAGE 2 is the AI-GENERATED output.
The generation prompt was: "${refinedPrompt}"

Evaluate IMAGE 2 and return exactly this JSON (no markdown):
{
  "visual_relevance": 7,
  "prompt_faithfulness": 8,
  "transformation_quality": 7,
  "clip_similarity_estimate": 0.65,
  "critique": "Two to three sentences of specific, actionable critique",
  "verdict": "ACCEPT",
  "revision_suggestion": null
}

Scoring rules:
- visual_relevance (1–10): how well the generated image relates to the original's subject/content
- prompt_faithfulness (1–10): how accurately it follows the refined prompt
- transformation_quality (1–10): overall quality of the transformation or generation
- clip_similarity_estimate (0.0–1.0): your best estimate of semantic similarity between both images
- verdict: "ACCEPT" only if ALL three scores are ≥ 6, otherwise "REVISE"
- revision_suggestion: null when verdict is ACCEPT; otherwise one specific suggestion to improve`,
    },
  ];

  const raw = await callOpenAI(apiKey, system, userContent);
  return parseJSON(raw);
}
