// MODULE 1.5 — Vision Similarity Agent
// Runs after image generation. Re-analyzes the GENERATED image with GPT-4o vision,
// then compares its structured fields against the ORIGINAL vision analysis field-by-field.
// This gives the loop orchestrator precise, named mismatches to route to the prompt agent,
// instead of relying on the critique agent's subjective impression.
//
// Input:  apiKey + originalVisionOutput (from Agent 01) + generatedImageUrl (from Agent 03)
// Output: {
//   generated_analysis,        — structured vision of the generated image
//   similarity_scores,         — per-field scores 0–10
//   matches[],                 — specific things that ARE correct
//   mismatches[],              — specific named differences (fed back to prompt agent)
//   overall_fidelity_score,    — weighted average 0–10
//   fidelity_verdict,          — HIGH | MEDIUM | LOW
//   prompt_fix_suggestions[]   — actionable fixes targeting each mismatch
// }

import { callOpenAI, parseJSON } from './api.js';

export async function runSimilarityAgent(apiKey, originalVisionOutput, generatedImageUrl) {
  const system =
    'You are a visual fidelity analysis agent. Compare a generated image against a reference analysis and return ONLY valid JSON — no markdown fences, no extra text.';

  const userContent = [
    {
      type: 'image_url',
      image_url: { url: generatedImageUrl },
    },
    {
      type: 'text',
      text: `You are shown the AI-GENERATED IMAGE above.
Compare it against this ORIGINAL IMAGE analysis produced by the Vision Agent:

${JSON.stringify(originalVisionOutput, null, 2)}

TASK: Analyze the generated image using the same structured fields, then score how closely each field matches the original analysis.

Return exactly this JSON (no markdown):
{
  "generated_analysis": {
    "art_style": {
      "medium": "<exact rendering medium you observe in the generated image>",
      "line_style": "<outline and line treatment>",
      "color_style": "<color treatment>",
      "rendering": "<overall rendering style>"
    },
    "subject_summary": "<1–2 sentences: what the generated image actually shows>",
    "objects_present": ["<object1>", "<object2>"]
  },
  "similarity_scores": {
    "art_style_match": <0–10: how closely the generated art style matches the original>,
    "subject_identity_match": <0–10: is the same subject/character clearly present>,
    "clothing_details_match": <0–10: do clothing items, colors, and accessories match>,
    "color_accuracy_match": <0–10: do the specific colors of all elements match>,
    "pose_match": <0–10: does the pose, stance, and body position match>,
    "composition_match": <0–10: is it a single centered subject with correct background>
  },
  "matches": [
    "<specific element that IS correctly reproduced — be precise, e.g. 'white gloves present and correct shape'>"
  ],
  "mismatches": [
    "<specific element that does NOT match — name the field, original value, and generated value. E.g.: 'Shoe color: original=yellow, generated=red'>"
  ],
  "overall_fidelity_score": <0–10: weighted average across all similarity_scores>,
  "fidelity_verdict": "<HIGH if overall ≥ 8, MEDIUM if 5–7, LOW if < 5>",
  "prompt_fix_suggestions": [
    "<one actionable fix per mismatch — tell the prompt agent exactly how to correct it>"
  ]
}

Scoring guidance:
- Score 9–10 only if that specific aspect is nearly identical to the original analysis
- Score 5–7 for partial matches (right category, wrong specific value)
- Score 1–4 for wrong category entirely (e.g. 3D render instead of 2D cartoon)
- Mismatches must be concrete and named — avoid vague statements like "style is different"`,
    },
  ];

  const raw = await callOpenAI(apiKey, system, userContent);
  return parseJSON(raw);
}
