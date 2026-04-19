// MODULE 2 — Prompt Engineering Agent
// Requirement 3.2: rewrite clearly · enrich with visual details · preserve intent
// Input:  userInstruction + visionOutput + optional revisionHint
// Output: { mode, refined_prompt, enrichments[], preserved_intent, ambiguity_flag }
//
// Modes:
//   "targeted_edit"          — change one specific detail, preserve everything else
//   "style_transformation"   — convert to a different art style / medium (watercolor, sketch…)
//   "photo_enhancement"      — boost quality, lighting, sharpness while keeping subject identical
//   "analysis_visualization" — render a rich visual representation of the scene analysis / VQA

import { callOpenAI, parseJSON } from './api.js';

export async function runPromptAgent(apiKey, userInstruction, visionOutput, revisionHint = null) {
  if (!userInstruction.trim()) {
    return {
      mode: null,
      refined_prompt: null,
      enrichments: [],
      preserved_intent: '',
      ambiguity_flag: 'Instruction is empty. Please describe the transformation or analysis you want.',
    };
  }

  const system =
    'You are a prompt engineering agent specializing in image generation. Return ONLY valid JSON, no markdown fences.';

  // On revision: simplify rather than add detail. Longer prompts confuse DALL-E.
  const isSimplifySignal = revisionHint?.toLowerCase().includes('too long') ||
                           revisionHint?.toLowerCase().includes('simplif') ||
                           revisionHint?.toLowerCase().includes('short');

  const revisionSection = revisionHint
    ? isSimplifySignal
      ? `\nPrevious attempt FAILED because the prompt was too complex. SIMPLIFY: rewrite as ≤2 short, clear sentences. Drop all secondary details. Fix: "${revisionHint}"\n`
      : `\nPrevious attempt was REJECTED. Apply this specific fix (do NOT add more detail — keep the same length or shorter): "${revisionHint}"\n`
    : '';

  const background = visionOutput.background ?? 'white or plain background';

  const userContent = `User request: "${userInstruction}"
${revisionSection}
Vision analysis (from Agent 01):
${JSON.stringify(visionOutput, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Classify the request into exactly one mode:

  "targeted_edit"          → user wants ONE specific detail changed (color, single object, texture)
                             while keeping every other visual element identical
  "style_transformation"   → user wants the entire image converted to a different art medium or style
                             (watercolor, oil painting, pencil sketch, anime, comic book, etc.)
  "photo_enhancement"      → user wants professional quality improvements — lighting, sharpness,
                             composition, color grading — while keeping subject and pose identical
  "analysis_visualization" → user wants a detailed visual depiction / illustration of the scene
                             contents, captions, or answers to visual questions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Build refined_prompt using the MANDATORY template for the chosen mode:

── Mode: targeted_edit ──────────────────────────────────────────────────────
  [STYLE LOCK] Exact medium + rendering from art_style.medium and art_style.rendering.
    Append every entry from art_style.negative_styles verbatim as explicit exclusions.
    Form: "<medium>, <rendering style>, <line_style>, <color_style> — NOT <neg1>, NOT <neg2>…"
  [SUBJECT] Describe every visual detail using subject_details exactly — body, head/face,
    clothing (each item with exact colors), hands/feet, pose. Do not paraphrase.
  [CHANGE] One sentence: state only the user-requested change with exact replacement value.
  [LOCK] "All other visual details — art style, outlines, colors, every clothing item,
    pose — must remain exactly as described. Change nothing else."
  [BACKGROUND] Exact background as seen: "${background}"

── Mode: style_transformation ────────────────────────────────────────────────
  [SUBJECT] Describe the subject from subject_details with enough detail to preserve identity.
  [STYLE] Describe the requested target style with maximum specificity:
    - For watercolor: "wet-on-wet technique, visible paper texture, soft color bleeding at edges,
      loose gestural brushstrokes, translucent color washes, warm painterly palette"
    - For oil painting: "thick impasto texture, rich saturated colors, visible brush marks,
      chiaroscuro lighting, museum-quality oil on canvas"
    - For pencil sketch: "graphite pencil on white paper, cross-hatching for shadows,
      clean confident lines, monochrome, hand-drawn"
    - Apply equivalent specificity for any other style the user requests.
  [COMPOSITION] "Preserve the original composition, subject pose, and scene layout."
  [QUALITY] "High artistic quality, gallery-worthy execution."

── Mode: photo_enhancement ───────────────────────────────────────────────────
  [SUBJECT] Describe the subject from subject_details with all visible colors and features.
  [LENS] "Shot on a professional DSLR with an 85mm f/1.8 portrait lens."
  [LIGHTING] "Three-point studio lighting: key light, fill light, and rim light for separation.
    Balanced exposure, no blown highlights, deep shadow detail."
  [QUALITY] "Ultra-sharp focus on the subject, professional RAW post-processing,
    rich color grading, high dynamic range, cinematic depth of field with soft bokeh background."
  [COMPOSITION] "Same subject, same pose, same framing as the original — enhanced, not altered."
  [OUTPUT] "Professional studio-quality photograph, magazine cover quality."

── Mode: analysis_visualization ──────────────────────────────────────────────
  [SCENE] Reproduce the full scene from scene_description and subject_details in rich detail.
  [OBJECTS] Make every object from the objects list clearly and prominently visible.
  [VQA] Visually depict the answers to the VQA questions — e.g. if a VQA asks about mood,
    ensure the lighting, color palette, and composition convey that mood explicitly.
  [STYLE] "Detailed digital illustration, rich colors, clean composition, high clarity,
    all scene elements clearly readable and well-lit."
  [CAPTION] First sentence of the prompt should set the scene: use caption verbatim as context.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL RULES (all modes):
- COMPOSITION GUARD (mandatory first clause for every mode): Begin every refined_prompt with: "Single subject, centered in frame, isolated figure, no duplicate characters, no comparison panels, no split layout."
- Never use vague terms ("cartoon character", "mouse") — always use exact descriptors from vision analysis
- For targeted_edit: the negative_styles list from art_style MUST appear verbatim; keep the prompt to 3 sentences max — DALL-E loses fidelity beyond that
- For style_transformation: name 5+ specific style attributes of the target medium
- For photo_enhancement: include lens, lighting, and post-processing descriptors
- REVISION RULE: if you received a revision hint, keep refined_prompt the SAME LENGTH or SHORTER than the previous attempt — never add more detail on revision, only sharpen what's there

Return exactly this JSON (no markdown):
{
  "mode": "<targeted_edit | style_transformation | photo_enhancement | analysis_visualization>",
  "refined_prompt": "<complete prompt using the template above>",
  "enrichments": [
    "<first key enrichment — e.g. style locked to flat 2D cartoon>",
    "<second key enrichment — e.g. specific watercolor technique descriptors added>",
    "<third key enrichment — e.g. preservation lock applied>"
  ],
  "preserved_intent": "One sentence: how the original user intent is kept intact",
  "ambiguity_flag": null
}
If the request is genuinely ambiguous, set ambiguity_flag to a clear explanation and refined_prompt to null.`;

  const raw = await callOpenAI(apiKey, system, userContent);
  return parseJSON(raw);
}
