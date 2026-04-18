// MODULE 1 — Vision Understanding Agent
// Requirement 3.1: caption · objects · scene description · ≥2 VQA answers
// Input:  base64 image + MIME type
// Output: { caption, objects[], scene_description, vqa[], quality_warning }

import { callOpenAI, parseJSON } from './api.js';

export async function runVisionAgent(apiKey, imageBase64, mimeType) {
  const system =
    'You are a vision analysis agent. Analyze images carefully and return ONLY valid JSON — no markdown fences, no extra text.';

  const userContent = [
    {
      type: 'image_url',
      image_url: { url: `data:${mimeType};base64,${imageBase64}` },
    },
    {
      type: 'text',
      text: `Analyze this image thoroughly. Return exactly this JSON (no markdown, no fences):
{
  "caption": "One clear sentence describing the image",
  "objects": ["object1", "object2", "object3"],
  "scene_description": "Two to three sentences describing the setting, context, and visual composition",
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
Generate questions that are relevant to THIS specific image, not generic questions.
If the image is blurry, very dark, or too low-resolution to analyze, set quality_warning to a short warning string describing the issue.`,
    },
  ];

  const raw = await callOpenAI(apiKey, system, userContent);
  return parseJSON(raw);
}
