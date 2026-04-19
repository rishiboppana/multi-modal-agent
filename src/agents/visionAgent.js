// MODULE 1 — Vision Understanding Agent
// Requirement 3.1: caption · objects · scene description · ≥2 VQA answers
// Input:  base64 image + MIME type + optional focusHint (from critique agent on retry)
// Output: { caption, objects[], scene_description, vqa[], quality_warning }

import { callOpenAI, parseJSON } from './api.js';

export async function runVisionAgent(apiKey, imageBase64, mimeType, focusHint = null) {
  const system =
    'You are a vision analysis agent. Analyze images carefully and return ONLY valid JSON — no markdown fences, no extra text.';

  const focusSection = focusHint
    ? `\nPrevious analysis was insufficient. Focus especially on: ${focusHint}\nBe more precise and thorough in those areas.\n`
    : '';

  const userContent = [
    {
      type: 'image_url',
      image_url: { url: `data:${mimeType};base64,${imageBase64}` },
    },
    {
      type: 'text',
      text: `Analyze this image thoroughly.${focusSection}
Return exactly this JSON (no markdown, no fences):
{
  "caption": "One clear sentence describing the image",
  "objects": ["object1", "object2", "object3"],
  "scene_description": "Two to three sentences describing the setting, context, and visual composition",
  "art_style": {
    "medium": "Exact rendering medium — e.g. flat 2D cartoon illustration, 3D CGI render, oil painting, watercolor, photorealistic photo, pencil sketch, pixel art",
    "line_style": "Describe the outlines — e.g. bold black outlines, soft edges, no outlines, thin ink lines",
    "color_style": "Describe color treatment — e.g. flat solid colors, gradient shading, painterly blending, muted palette",
    "rendering": "Overall look — e.g. classic Disney 2D animation, Pixar 3D, anime, comic book, children's book illustration",
    "negative_styles": "List styles this image is NOT — e.g. NOT photorealistic, NOT 3D rendered, NOT watercolor"
  },
  "subject_details": {
    "body": "Full body description: exact shape, proportions, skin/fur color, body outline",
    "head_face": "Head shape, ear shape/color, eye style, nose, mouth, expression",
    "clothing": "Every clothing item with exact colors, patterns, buttons, accessories",
    "hands_feet": "Hand style (gloves, claws, etc.) and feet/shoes with exact colors",
    "pose": "Exact stance, arm position, leg position"
  },
  "background": "Background description — color, setting, any elements present",
  "vqa": [
    {
      "question": "A specific, meaningful question about this particular image's main subject or action",
      "answer": "A detailed answer based on what is visible"
    },
    {
      "question": "A second specific question about the image's environment, mood, or context",
      "answer": "A detailed answer based on what is visible"
    }
  ],
  "quality_warning": null
}
Be extremely precise about art_style and subject_details — these are critical for faithful reproduction.
If the image is blurry, very dark, or too low-resolution to analyze, set quality_warning to a short warning string.`,
    },
  ];

  const raw = await callOpenAI(apiKey, system, userContent);
  return parseJSON(raw);
}
