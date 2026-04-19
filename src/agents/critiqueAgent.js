// MODULE 4 — Critique & Evaluation Agent
// Requirement 3.4: visual relevance · prompt faithfulness · transformation quality ·
//                  CLIP similarity estimate · ACCEPT/REVISE verdict · weak agent diagnosis
// Input:  apiKey + original image (base64) + generated image URL + refined prompt + mode
// Output: { visual_relevance, prompt_faithfulness, transformation_quality,
//           clip_similarity_estimate, critique, verdict, revision_suggestion,
//           weak_agent, agent_feedback }

import { callOpenAI, parseJSON } from './api.js';

// Per-mode scoring criteria injected into the evaluation prompt so the LLM
// applies the right rubric for each use case type.
const MODE_CRITERIA = {
  targeted_edit: `
Use-case: TARGETED EDIT — one detail was changed, everything else must be identical.
- visual_relevance: Does the generated image depict the same subject, style, pose, and all other elements as the original, with only the requested change applied? Full marks (9–10) if yes; deduct heavily if the style changed, the subject changed, or extra elements were altered.
- prompt_faithfulness: Was the specific requested change applied exactly? Full marks if yes; deduct if the change is wrong, missing, or over-applied.
- transformation_quality: Is the overall image well-composed, artifact-free, and visually coherent? Full marks if yes.`,

  style_transformation: `
Use-case: STYLE TRANSFORMATION — subject identity is preserved but the art medium/style is fully changed.
- visual_relevance: Does the generated image preserve the original subject's identity, composition, and pose despite the style change? Do NOT penalize for looking different from the original — that is expected. Full marks if the subject is clearly recognizable.
- prompt_faithfulness: Does the generated image fully exhibit the requested target style? Check for style-specific attributes (e.g. brushstrokes, texture, color treatment). Full marks if 5+ style attributes from the prompt are clearly present.
- transformation_quality: Is the style applied with high artistic quality — consistent, intentional, polished? Full marks for gallery-worthy execution.`,

  photo_enhancement: `
Use-case: PHOTO ENHANCEMENT — same subject and composition, improved professional quality.
- visual_relevance: Does the generated image show the same subject, pose, and framing as the original? Full marks if the subject identity and composition are preserved exactly; deduct if anything changed structurally.
- prompt_faithfulness: Are the professional quality attributes present — sharp focus, balanced lighting, cinematic depth of field, clean post-processing, rich colors? Full marks if all are clearly visible.
- transformation_quality: Does the result look like a professional studio photograph? Would it pass for a magazine shoot? Full marks if yes.`,

  analysis_visualization: `
Use-case: ANALYSIS VISUALIZATION — a rich detailed illustration of the scene, objects, and VQA context.
- visual_relevance: Are all key objects and scene elements from the original image clearly depicted and recognizable? Full marks if the scene is reproduced with high fidelity and all identified objects are visible.
- prompt_faithfulness: Does the illustration clearly answer or depict the context from the VQA and scene description? Full marks if the visual narrative matches the analysis.
- transformation_quality: Is the illustration detailed, well-composed, clearly readable, with all elements well-lit and legible? Full marks for high-detail professional digital illustration quality.`,
};

export async function runCritiqueAgent(apiKey, originalBase64, mimeType, generatedImageUrl, refinedPrompt, mode = null, similarityReport = null) {
  const system =
    'You are a quality evaluation agent for AI-generated images. Return ONLY valid JSON, no markdown fences.';

  const modeCriteria = MODE_CRITERIA[mode] ?? `
Use-case: GENERAL — evaluate image quality, faithfulness to prompt, and relevance to the original.
- visual_relevance: How well does the generated image relate to the original subject and content?
- prompt_faithfulness: How accurately does it follow the refined prompt?
- transformation_quality: Overall visual quality, coherence, and execution.`;

  const similaritySection = similarityReport
    ? `
Similarity Agent pre-analysis (field-by-field comparison of the generated image against the original):
- Overall fidelity score: ${similarityReport.overall_fidelity_score}/10 (${similarityReport.fidelity_verdict})
- Art style match: ${similarityReport.similarity_scores?.art_style_match}/10
- Subject identity match: ${similarityReport.similarity_scores?.subject_identity_match}/10
- Clothing details match: ${similarityReport.similarity_scores?.clothing_details_match}/10
- Color accuracy match: ${similarityReport.similarity_scores?.color_accuracy_match}/10
- Pose match: ${similarityReport.similarity_scores?.pose_match}/10
- Composition match: ${similarityReport.similarity_scores?.composition_match}/10
Confirmed matches: ${similarityReport.matches?.join(' | ') || 'none'}
Confirmed mismatches: ${similarityReport.mismatches?.join(' | ') || 'none'}
Use these as ground-truth facts in your scoring — do not contradict them without visual evidence.
`
    : '';

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
${similaritySection}
${modeCriteria}

Evaluate IMAGE 2 carefully using the use-case criteria above. Return exactly this JSON (no markdown, no placeholder values — fill in your actual scores):
{
  "visual_relevance": <integer 1–10>,
  "prompt_faithfulness": <integer 1–10>,
  "transformation_quality": <integer 1–10>,
  "clip_similarity_estimate": <decimal 0.0–1.0>,
  "critique": "<two to three sentences of specific, actionable critique referencing actual visual observations>",
  "verdict": "<ACCEPT or REVISE>",
  "revision_suggestion": <null or "one specific, actionable improvement sentence">,
  "weak_agent": "<vision | prompt | generation | null>",
  "agent_feedback": "<precise instruction for that agent to fix on the next iteration, or null if ACCEPT>"
}

General scoring rules:
- Score each dimension independently based on what you actually observe — do NOT anchor to any default value
- A result that satisfies its use-case criteria fully deserves 9–10 on that dimension
- clip_similarity_estimate: derive from actual visual comparison — do NOT default to a round number
- verdict: "ACCEPT" only if ALL three integer scores are ≥ 9; otherwise "REVISE"
- revision_suggestion: null when ACCEPT; otherwise one specific, actionable sentence
- weak_agent diagnosis (REVISE only):
    "vision"     → root cause is incomplete/inaccurate image analysis (missing objects, wrong colors, misread style)
    "prompt"     → root cause is the prompt failing to specify the style, subject, or change correctly
    "generation" → root cause is DALL-E ignoring a correct prompt (wrong style output, artifacts, drift)
- Set weak_agent and agent_feedback to null when verdict is ACCEPT

SPECIAL FAILURE PATTERNS — detect these first before scoring:
1. Duplicate/split image: If IMAGE 2 contains more than one copy of the subject, a side-by-side panel, or a grid layout → set visual_relevance=3, weak_agent="generation", agent_feedback="Generate a single centered isolated character only. No duplicates, no comparison layout, no split panels. Restart with a simpler, shorter prompt."
2. Wrong art style: If IMAGE 2 is in a completely different medium than IMAGE 1 (e.g. 3D render instead of 2D cartoon, or photorealistic instead of illustrated) → set visual_relevance=4, weak_agent="prompt", agent_feedback="The art style is completely wrong. Lock the style explicitly: name the exact medium from the original and add NOT 3D rendered, NOT photorealistic."
3. Requested change not applied: If the user's requested change (color, style, etc.) is completely absent in IMAGE 2 → set prompt_faithfulness=3, weak_agent="prompt", agent_feedback="The requested change was not applied at all. Make the specific change the very first instruction in the prompt, before any style description."`,
    },
  ];

  const raw = await callOpenAI(apiKey, system, userContent);
  return parseJSON(raw);
}
