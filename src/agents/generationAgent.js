// MODULE 3 — Image Generation Agent (OpenAI DALL-E 3)
// Requirement 3.3: generate image · stylization mode · log config
// Input:  apiKey + refinedPrompt (from Agent 2)
// Output: { imageUrl, prompt, model, quality, style, size, mode }

export async function runGenerationAgent(apiKey, refinedPrompt) {
  const config = {
    model: 'dall-e-3',
    quality: 'standard',
    style: 'vivid',
    size: '1024x1024',
    mode: 'stylization',
  };

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      prompt: refinedPrompt,
      n: 1,
      size: config.size,
      quality: config.quality,
      style: config.style,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `DALL-E HTTP ${res.status}`);
  }

  const data = await res.json();
  const imageUrl = data.data[0].url;
  return { imageUrl, prompt: refinedPrompt, ...config };
}
