import { useState, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════
// MODULE 0 — API CONSTANTS & SHARED HELPERS
// ═══════════════════════════════════════════════════════════════

const OPENAI_MODEL = 'gpt-4o';
const OPENAI_BASE  = 'https://api.openai.com/v1/chat/completions';

async function callOpenAI(apiKey, systemPrompt, userContent) {
  const res = await fetch(OPENAI_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent  },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

function parseJSON(raw) {
  try { return JSON.parse(raw); }
  catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Could not parse JSON from model response');
  }
}

// ═══════════════════════════════════════════════════════════════
// MODULE 1 — VISION UNDERSTANDING AGENT
// Requirement 3.1: caption · objects · scene · ≥2 VQA answers
// ═══════════════════════════════════════════════════════════════

async function runVisionAgent(apiKey, imageBase64, mimeType) {
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
If the image is blurry, very dark, or too low-resolution to analyze, set quality_warning to a short warning string.`,
    },
  ];

  const raw = await callOpenAI(apiKey, system, userContent);
  return parseJSON(raw);
}

// ═══════════════════════════════════════════════════════════════
// MODULE 2 — PROMPT ENGINEERING AGENT
// Requirement 3.2: rewrite · enrich · preserve intent
// ═══════════════════════════════════════════════════════════════

async function runPromptAgent(apiKey, userInstruction, visionOutput) {
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

Vision analysis context:
${JSON.stringify(visionOutput, null, 2)}

Rewrite the user request into a precise, detailed image-generation prompt that incorporates the visual context above.
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
If the user's request is genuinely ambiguous or contradictory, set ambiguity_flag to an explanation and set refined_prompt to null.`;

  const raw = await callOpenAI(apiKey, system, userContent);
  return parseJSON(raw);
}

// ═══════════════════════════════════════════════════════════════
// MODULE 3 — IMAGE GENERATION AGENT (OpenAI DALL-E 3)
// Requirement 3.3: generate image · log config · support stylization
// ═══════════════════════════════════════════════════════════════

async function runGenerationAgent(apiKey, refinedPrompt) {
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

// ═══════════════════════════════════════════════════════════════
// MODULE 4 — CRITIQUE & EVALUATION AGENT
// Requirement 3.4: visual relevance · faithfulness · quality ·
//                  CLIP estimate · rubric · ACCEPT/REVISE verdict
// ═══════════════════════════════════════════════════════════════

async function runCritiqueAgent(apiKey, originalBase64, mimeType, generatedImageUrl, refinedPrompt) {
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

// ═══════════════════════════════════════════════════════════════
// UI COMPONENTS — Black & White theme
// ═══════════════════════════════════════════════════════════════

// Status indicator: monochrome only
function StatusDot({ status }) {
  if (status === 'running') return (
    <span className="flex items-center gap-1.5 text-xs text-white font-medium">
      <span className="w-2 h-2 rounded-full bg-white inline-block animate-pulse" />
      Running
    </span>
  );
  if (status === 'done') return (
    <span className="flex items-center gap-1.5 text-xs text-white font-medium">
      <span className="w-2 h-2 rounded-full bg-white inline-block" />
      Done
    </span>
  );
  return <span className="w-2 h-2 rounded-full border border-zinc-600 inline-block" />;
}

// Mono score bar — white fill on dark track
function ScoreBar({ label, value, max = 10 }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="text-white font-mono">{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-white rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// Collapsible agent panel — monochrome borders
function AgentPanel({ number, title, status, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-zinc-800 rounded-lg mb-4 bg-zinc-950">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left cursor-pointer hover:bg-zinc-900 transition-colors rounded-t-lg"
      >
        <span className="text-xs font-bold border border-zinc-600 text-zinc-300 px-2 py-0.5 rounded font-mono shrink-0">
          {number}
        </span>
        <span className="font-medium text-white flex-1 text-sm">{title}</span>
        <StatusDot status={status} />
        <span className="text-zinc-600 text-xs ml-2">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-zinc-800">
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
}

function Spinner({ message = 'Processing…' }) {
  return (
    <div className="flex items-center gap-2 text-zinc-400 text-sm py-1">
      <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      {message}
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div className="border border-zinc-600 bg-zinc-900 rounded px-4 py-3 text-zinc-300 text-sm mt-2">
      <span className="text-white font-bold">Error: </span>{message}
    </div>
  );
}

function WarnBox({ message }) {
  return (
    <div className="border border-zinc-500 bg-zinc-900 rounded px-4 py-3 text-zinc-300 text-sm mt-2">
      <span className="text-white font-bold">Warning: </span>{message}
    </div>
  );
}

function Tag({ text }) {
  return (
    <span className="inline-block text-xs border border-zinc-700 text-zinc-400 rounded px-2 py-0.5 mr-1 mb-1 font-mono">
      {text}
    </span>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2 font-mono">{children}</p>
  );
}

// ─── Workflow diagram showing agent communication ─────────────────────────────

function WorkflowDiagram({ stage }) {
  const stages = ['vision', 'prompt', 'generation', 'critique'];
  const labels  = ['Vision\nAgent', 'Prompt\nEngineer', 'Image\nGenerator', 'Critique\nAgent'];
  const order   = ['idle', ...stages, 'done'];
  const currentIdx = order.indexOf(stage);

  return (
    <div className="border border-zinc-800 rounded-lg bg-zinc-950 px-5 py-4 mb-6">
      <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-4">Pipeline Orchestration</p>
      <div className="flex items-center gap-0 overflow-x-auto">
        {stages.map((s, i) => {
          const stageIdx = order.indexOf(s);
          const isDone    = stage === 'done' || (stage !== 'idle' && stageIdx < currentIdx);
          const isRunning = stage === s;
          const isPending = !isDone && !isRunning;
          return (
            <div key={s} className="flex items-center">
              <div className={`flex flex-col items-center px-4 py-2 rounded border transition-all ${
                isRunning ? 'border-white bg-white text-black'
                : isDone  ? 'border-zinc-500 bg-zinc-900 text-white'
                : 'border-zinc-800 bg-zinc-950 text-zinc-600'
              }`}>
                <span className="text-xs font-mono font-bold">0{i + 1}</span>
                <span className="text-xs text-center whitespace-pre-line leading-tight mt-0.5">{labels[i]}</span>
                {isDone    && <span className="text-xs mt-1">✓</span>}
                {isRunning && <span className="text-xs mt-1 animate-pulse">●</span>}
              </div>
              {i < stages.length - 1 && (
                <div className={`w-8 h-px mx-1 ${isDone ? 'bg-zinc-500' : 'bg-zinc-800'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Preset Test Cases (matching 3.5.4 use cases exactly) ────────────────────

const PRESETS = [
  {
    label: 'A — Captioning & VQA',
    instruction: 'Generate a detailed caption for this image and answer key visual questions about its content.',
  },
  {
    label: 'B — Style Transfer',
    instruction: 'Transform this image into a watercolor painting with soft brushstrokes and painterly texture.',
  },
  {
    label: 'C — Enhancement',
    instruction: 'Enhance this as a professional studio-quality photo with balanced lighting and sharp detail.',
  },
];

// ═══════════════════════════════════════════════════════════════
// MAIN APP — ORCHESTRATOR
// Requirement 3.5: modular · orchestration · 3 test cases · failure handling
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const [apiKey,       setApiKey]       = useState('');
  const [showKey,      setShowKey]      = useState(false);
  const [imageBase64,  setImageBase64]  = useState(null);
  const [imageMime,    setImageMime]    = useState('image/jpeg');
  const [imagePreview, setImagePreview] = useState(null);
  const [instruction,  setInstruction]  = useState('');

  const [stage,          setStage]          = useState('idle');
  const [errors,         setErrors]         = useState({});
  const [visionResult,   setVisionResult]   = useState(null);
  const [promptResult,   setPromptResult]   = useState(null);
  const [genResult,      setGenResult]      = useState(null);
  const [critiqueResult, setCritiqueResult] = useState(null);
  const [rubricsHistory, setRubricsHistory] = useState([]);

  const fileRef = useRef();

  function agentStatus(agentStage) {
    const order = ['vision', 'prompt', 'generation', 'critique'];
    const ci = order.indexOf(stage);
    const ai = order.indexOf(agentStage);
    if (stage === 'idle') return 'idle';
    if (stage === 'done') return 'done';
    if (agentStage === stage) return 'running';
    if (ai < ci) return 'done';
    return 'idle';
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors(err => ({ ...err, upload: 'Please upload an image file (PNG, JPG, WEBP, GIF).' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setImagePreview(dataUrl);
      const [header, b64] = dataUrl.split(',');
      const mime = header.match(/:(.*?);/)[1];
      setImageBase64(b64);
      setImageMime(mime);
    };
    reader.readAsDataURL(file);
    setErrors(err => ({ ...err, upload: null }));
  }

  // ── Orchestrator: runs all 4 agents in sequence ──────────────────────────────
  async function runPipeline() {
    if (!apiKey.trim())      { setErrors(e => ({ ...e, pipeline: 'Please enter your OpenAI API key.' })); return; }
    if (!imageBase64)        { setErrors(e => ({ ...e, pipeline: 'Please upload an image.' })); return; }
    if (!instruction.trim()) { setErrors(e => ({ ...e, pipeline: 'Please enter an instruction.' })); return; }

    setErrors({});
    setVisionResult(null);
    setPromptResult(null);
    setGenResult(null);
    setCritiqueResult(null);

    // Agent 1 — Vision Understanding
    setStage('vision');
    let vision;
    try {
      vision = await runVisionAgent(apiKey, imageBase64, imageMime);
      setVisionResult(vision);
      if (vision.quality_warning) {
        setErrors(e => ({ ...e, vision: vision.quality_warning }));
      }
    } catch (err) {
      setErrors(e => ({ ...e, vision: `Vision agent failed: ${err.message}` }));
      setStage('idle');
      return;
    }

    // Agent 2 — Prompt Engineering
    setStage('prompt');
    let promptRes;
    try {
      promptRes = await runPromptAgent(apiKey, instruction, vision);
      setPromptResult(promptRes);
      if (promptRes.ambiguity_flag) {
        setErrors(e => ({ ...e, prompt: promptRes.ambiguity_flag }));
        setStage('idle');
        return;
      }
    } catch (err) {
      setErrors(e => ({ ...e, prompt: `Prompt agent failed: ${err.message}` }));
      setStage('idle');
      return;
    }

    // Agent 3 — Image Generation
    setStage('generation');
    let gen;
    try {
      gen = await runGenerationAgent(apiKey, promptRes.refined_prompt);
      setGenResult(gen);
    } catch (err) {
      setErrors(e => ({
        ...e,
        generation: `${err.message}. You can retry with the refined prompt: "${promptRes.refined_prompt}"`,
      }));
      setStage('idle');
      return;
    }

    // Agent 4 — Critique & Evaluation
    setStage('critique');
    try {
      const critique = await runCritiqueAgent(
        apiKey, imageBase64, imageMime, gen.imageUrl, promptRes.refined_prompt
      );
      setCritiqueResult(critique);
      setRubricsHistory(h => [
        ...h,
        {
          n: h.length + 1,
          instruction: instruction.slice(0, 45) + (instruction.length > 45 ? '…' : ''),
          visual_relevance:      critique.visual_relevance,
          prompt_faithfulness:   critique.prompt_faithfulness,
          transformation_quality: critique.transformation_quality,
          clip:    (critique.clip_similarity_estimate * 100).toFixed(0) + '%',
          verdict: critique.verdict,
        },
      ]);
    } catch (err) {
      setErrors(e => ({ ...e, critique: `Critique agent failed: ${err.message}` }));
      setStage('idle');
      return;
    }

    setStage('done');
  }

  const running = !['idle', 'done'].includes(stage);

  return (
    <div className="min-h-screen bg-black text-white font-sans">

      {/* ── Header ── */}
      <header className="border-b border-zinc-800 bg-black sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Multi-Modal AI Pipeline</h1>
            <p className="text-xs text-zinc-500 mt-0.5 font-mono">
              Vision → Prompt Engineer → Image Generator → Critique
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="sk-… OpenAI API key"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="text-xs bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white placeholder-zinc-600 w-56 focus:outline-none focus:border-white font-mono"
            />
            <button
              onClick={() => setShowKey(s => !s)}
              className="text-xs text-zinc-500 hover:text-white border border-zinc-800 px-2 py-1.5 rounded transition-colors"
            >
              {showKey ? 'hide' : 'show'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-5">

        {/* ── Workflow Diagram ── */}
        <WorkflowDiagram stage={stage} />

        {/* ── Input Row ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Image Upload */}
          <div className="border border-zinc-800 rounded-lg bg-zinc-950 p-5">
            <SectionLabel>Input Image</SectionLabel>
            <div
              onClick={() => fileRef.current?.click()}
              className="border border-dashed border-zinc-700 rounded h-52 flex items-center justify-center cursor-pointer hover:border-white transition-colors overflow-hidden"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="uploaded" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center text-zinc-600">
                  <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs">Click to upload</p>
                  <p className="text-xs mt-1 text-zinc-700">PNG · JPG · WEBP · GIF</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
            {errors.upload && <ErrorBox message={errors.upload} />}
          </div>

          {/* Instruction + Controls */}
          <div className="border border-zinc-800 rounded-lg bg-zinc-950 p-5 flex flex-col">
            <SectionLabel>Instruction</SectionLabel>
            <textarea
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              placeholder="Describe the transformation or analysis you want…"
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white placeholder-zinc-600 text-sm resize-none focus:outline-none focus:border-white min-h-[80px]"
            />

            {/* Test Case Presets — maps to req 3.5.4 (a)(b)(c) */}
            <div className="mt-3">
              <p className="text-xs text-zinc-600 font-mono mb-2">Test cases (req 3.5.4):</p>
              <div className="flex flex-col gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => setInstruction(p.instruction)}
                    className="text-left text-xs border border-zinc-800 hover:border-zinc-500 text-zinc-400 hover:text-white rounded px-3 py-1.5 transition-colors font-mono"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={runPipeline}
              disabled={running}
              className="mt-4 w-full bg-white text-black font-bold rounded py-2.5 text-sm hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {running
                ? `Running Agent ${['vision','prompt','generation','critique'].indexOf(stage) + 1} — ${stage}…`
                : 'Run Pipeline'}
            </button>
            {errors.pipeline && <ErrorBox message={errors.pipeline} />}
          </div>
        </div>

        {/* ════════════════════════════════════════════
            AGENT 01 — Vision Understanding
            Req 3.1: caption · objects · scene · VQA
            ════════════════════════════════════════════ */}
        <AgentPanel number="01" title="Vision Understanding Agent" status={agentStatus('vision')}>
          {agentStatus('vision') === 'running' && <Spinner />}
          {errors.vision && <WarnBox message={errors.vision} />}
          {visionResult ? (
            <div className="space-y-4">
              <div>
                <SectionLabel>Caption</SectionLabel>
                <p className="text-sm text-zinc-200">{visionResult.caption}</p>
              </div>
              <div>
                <SectionLabel>Key Objects / Entities</SectionLabel>
                <div>{visionResult.objects?.map(o => <Tag key={o} text={o} />)}</div>
              </div>
              <div>
                <SectionLabel>Scene Description</SectionLabel>
                <p className="text-sm text-zinc-300 leading-relaxed">{visionResult.scene_description}</p>
              </div>
              <div>
                <SectionLabel>Visual Q&amp;A</SectionLabel>
                <div className="space-y-2">
                  {visionResult.vqa?.map((qa, i) => (
                    <div key={i} className="border border-zinc-800 rounded bg-zinc-900 px-4 py-3">
                      <p className="text-xs text-zinc-400 mb-1">Q{i+1}: {qa.question}</p>
                      <p className="text-sm text-white">A: {qa.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">Upload an image and run the pipeline to see visual analysis.</p>
          )}
        </AgentPanel>

        {/* ════════════════════════════════════════════
            AGENT 02 — Prompt Engineering
            Req 3.2: rewrite · enrich · preserve intent
            ════════════════════════════════════════════ */}
        <AgentPanel number="02" title="Prompt Engineering Agent" status={agentStatus('prompt')}>
          {agentStatus('prompt') === 'running' && <Spinner />}
          {errors.prompt && <ErrorBox message={errors.prompt} />}
          {promptResult ? (
            <div className="space-y-4">
              <div>
                <SectionLabel>Refined Prompt</SectionLabel>
                <div className="border border-zinc-700 rounded bg-zinc-900 px-4 py-3 text-sm text-white font-mono leading-relaxed">
                  {promptResult.refined_prompt}
                </div>
              </div>
              <div>
                <SectionLabel>Enrichments Added</SectionLabel>
                <ul className="space-y-1">
                  {promptResult.enrichments?.map((e, i) => (
                    <li key={i} className="text-sm text-zinc-300 flex gap-2">
                      <span className="text-zinc-600 font-mono shrink-0">—</span>
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <SectionLabel>Original Intent Preserved</SectionLabel>
                <p className="text-sm text-zinc-300">{promptResult.preserved_intent}</p>
              </div>
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">Waiting for Agent 01 to complete.</p>
          )}
        </AgentPanel>

        {/* ════════════════════════════════════════════
            AGENT 03 — Image Generation
            Req 3.3: generate · mode · config log
            ════════════════════════════════════════════ */}
        <AgentPanel number="03" title="Image Generation Agent — DALL-E 3" status={agentStatus('generation')}>
          {agentStatus('generation') === 'running' && (
            <Spinner message="Generating image with DALL-E 3 — this takes about 10–20 s…" />
          )}
          {errors.generation && <ErrorBox message={errors.generation} />}
          {genResult ? (
            <div className="space-y-4">
              <div>
                <SectionLabel>Generation Config</SectionLabel>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {[
                    { k: 'Model',   v: genResult.model },
                    { k: 'Mode',    v: genResult.mode },
                    { k: 'Quality', v: genResult.quality },
                    { k: 'Style',   v: genResult.style },
                    { k: 'Size',    v: genResult.size },
                  ].map(({ k, v }) => (
                    <div key={k} className="border border-zinc-800 rounded px-3 py-2 text-center">
                      <p className="text-xs text-zinc-500 font-mono">{k}</p>
                      <p className="text-xs text-white font-mono mt-0.5">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <SectionLabel>Generated Image</SectionLabel>
                <div className="flex justify-center border border-zinc-800 rounded bg-zinc-900 p-3">
                  <img
                    src={genResult.imageUrl}
                    alt="AI Generated"
                    className="rounded max-h-96"
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">Waiting for Agent 02 to complete.</p>
          )}
        </AgentPanel>

        {/* ════════════════════════════════════════════
            AGENT 04 — Critique & Evaluation
            Req 3.4: relevance · faithfulness · CLIP · rubric · verdict
            ════════════════════════════════════════════ */}
        <AgentPanel number="04" title="Critique & Evaluation Agent" status={agentStatus('critique')}>
          {agentStatus('critique') === 'running' && <Spinner />}
          {errors.critique && <ErrorBox message={errors.critique} />}
          {critiqueResult ? (
            <div className="space-y-5">

              {/* Scores */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <SectionLabel>Automatic Evaluation Scores</SectionLabel>
                  <ScoreBar label="Visual Relevance"        value={critiqueResult.visual_relevance} />
                  <ScoreBar label="Prompt Faithfulness"     value={critiqueResult.prompt_faithfulness} />
                  <ScoreBar label="Transformation Quality"  value={critiqueResult.transformation_quality} />
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">CLIP Similarity Estimate</span>
                      <span className="text-white font-mono">
                        {(critiqueResult.clip_similarity_estimate * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-zinc-400 rounded-full transition-all duration-700"
                        style={{ width: `${critiqueResult.clip_similarity_estimate * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Verdict */}
                <div className="flex flex-col gap-3">
                  <div>
                    <SectionLabel>Verdict</SectionLabel>
                    <div className={`border rounded px-4 py-4 text-center font-bold text-xl font-mono ${
                      critiqueResult.verdict === 'ACCEPT'
                        ? 'border-white bg-white text-black'
                        : 'border-zinc-500 bg-zinc-900 text-white'
                    }`}>
                      {critiqueResult.verdict === 'ACCEPT' ? '✓ ACCEPT' : '✗ REVISE'}
                    </div>
                  </div>
                  {critiqueResult.revision_suggestion && (
                    <div className="border border-zinc-600 bg-zinc-900 rounded px-4 py-3">
                      <SectionLabel>Revision Suggestion</SectionLabel>
                      <p className="text-sm text-zinc-200">{critiqueResult.revision_suggestion}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Side-by-side comparison */}
              {genResult && (
                <div>
                  <SectionLabel>Side-by-Side Comparison</SectionLabel>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-zinc-800 rounded bg-zinc-900 p-2">
                      <p className="text-xs text-zinc-500 font-mono text-center mb-2">Original</p>
                      <img src={imagePreview} alt="Original" className="rounded w-full object-contain max-h-52" />
                    </div>
                    <div className="border border-zinc-800 rounded bg-zinc-900 p-2">
                      <p className="text-xs text-zinc-500 font-mono text-center mb-2">Generated</p>
                      <img src={genResult.imageUrl} alt="Generated" className="rounded w-full object-contain max-h-52" />
                    </div>
                  </div>
                </div>
              )}

              {/* Critique text */}
              <div>
                <SectionLabel>Detailed Critique</SectionLabel>
                <p className="text-sm text-zinc-300 leading-relaxed">{critiqueResult.critique}</p>
              </div>
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">Waiting for Agent 03 to complete.</p>
          )}
        </AgentPanel>

        {/* ════════════════════════════════════════════
            HUMAN EVALUATION RUBRIC TABLE
            Req 3.4: rubric across 3–5 examples
            ════════════════════════════════════════════ */}
        {rubricsHistory.length > 0 && (
          <div className="border border-zinc-800 rounded-lg bg-zinc-950 p-5">
            <SectionLabel>Human Evaluation Rubric — Run History ({rubricsHistory.length} example{rubricsHistory.length > 1 ? 's' : ''})</SectionLabel>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-2 px-3 text-zinc-500">#</th>
                    <th className="text-left py-2 px-3 text-zinc-500">Instruction</th>
                    <th className="text-center py-2 px-3 text-zinc-500">Visual</th>
                    <th className="text-center py-2 px-3 text-zinc-500">Faithfulness</th>
                    <th className="text-center py-2 px-3 text-zinc-500">Quality</th>
                    <th className="text-center py-2 px-3 text-zinc-500">CLIP</th>
                    <th className="text-center py-2 px-3 text-zinc-500">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {rubricsHistory.map((row) => (
                    <tr key={row.n} className="border-b border-zinc-900 hover:bg-zinc-900 transition-colors">
                      <td className="py-2 px-3 text-zinc-600">{row.n}</td>
                      <td className="py-2 px-3 text-zinc-300 max-w-xs">{row.instruction}</td>
                      <td className="py-2 px-3 text-center text-white">{row.visual_relevance}/10</td>
                      <td className="py-2 px-3 text-center text-white">{row.prompt_faithfulness}/10</td>
                      <td className="py-2 px-3 text-center text-white">{row.transformation_quality}/10</td>
                      <td className="py-2 px-3 text-center text-white">{row.clip}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`font-bold px-2 py-0.5 rounded ${
                          row.verdict === 'ACCEPT'
                            ? 'bg-white text-black'
                            : 'border border-zinc-500 text-zinc-300'
                        }`}>
                          {row.verdict}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-900 mt-8 py-4 text-center text-xs text-zinc-700 font-mono">
        Lab 2 · Multi-Modal Agent Pipeline · Agents 01/02/03/04: OpenAI ({OPENAI_MODEL} · DALL-E 3)
      </footer>
    </div>
  );
}
