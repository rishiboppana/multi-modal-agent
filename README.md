# Multi-Modal AI Pipeline

A 4-agent AI pipeline that takes an image + instruction and runs it through Vision → Prompt Engineering → Image Generation → Critique.

## What it does

1. **Agent 01 — Vision**: Analyzes your uploaded image (caption, objects, scene, Q&A)
2. **Agent 02 — Prompt Engineer**: Rewrites your instruction into a detailed generation prompt
3. **Agent 03 — Image Generator**: Generates a new image using DALL-E 3
4. **Agent 04 — Critique**: Scores the generated image and gives an ACCEPT/REVISE verdict

## Requirements

- [Node.js](https://nodejs.org/) v18 or higher
- An OpenAI API key (needs access to `gpt-4o` and `dall-e-3`)

## How to run

```bash
# 1. Clone the repo
git clone <repo-url>
cd Lab2

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Then open `http://localhost:5173` in your browser.

## How to use

1. Paste your OpenAI API key in the top-right field
2. Upload any image
3. Type an instruction (or pick one of the 3 preset test cases)
4. Click **Run Pipeline** and watch each agent complete in sequence

## Project structure

```
src/
  agents/
    api.js              # Shared OpenAI helper
    visionAgent.js      # Agent 01
    promptAgent.js      # Agent 02
    generationAgent.js  # Agent 03
    critiqueAgent.js    # Agent 04
  App.jsx               # Orchestrator + UI
```

## Notes

- Your API key is never stored — it lives in memory only for the current session
- DALL-E 3 image generation takes around 10–20 seconds
- Run all 3 preset test cases to fill the evaluation rubric table
