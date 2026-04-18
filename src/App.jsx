// ORCHESTRATOR — Multi-Modal AI Pipeline
// Req 3.5: modular agents · orchestration · intermediate outputs ·
//          3 test cases · failure handling

import { useState, useRef } from 'react';
import { OPENAI_MODEL }        from './agents/api.js';
import { runVisionAgent }      from './agents/visionAgent.js';
import { runPromptAgent }      from './agents/promptAgent.js';
import { runGenerationAgent }  from './agents/generationAgent.js';
import { runCritiqueAgent }    from './agents/critiqueAgent.js';

// ─── UI Primitives ────────────────────────────────────────────────────────────

function StatusDot({ status }) {
  if (status === 'running') return (
    <span className="flex items-center gap-1.5 text-xs text-white font-mono">
      <span className="w-2 h-2 rounded-full bg-white inline-block animate-pulse" />
      Running
    </span>
  );
  if (status === 'done') return (
    <span className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
      <span className="w-2 h-2 rounded-full bg-white inline-block" />
      Done
    </span>
  );
  return <span className="w-2 h-2 rounded-full border border-zinc-700 inline-block" />;
}

function ScoreBar({ label, value, max = 10 }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="text-white font-mono">{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function AgentPanel({ number, title, status, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-zinc-800 rounded-lg bg-zinc-950">
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
    <div className="border border-zinc-600 bg-zinc-900 rounded px-4 py-3 text-zinc-200 text-sm mt-2">
      <span className="text-white font-bold font-mono">ERROR </span>{message}
    </div>
  );
}

function InfoBox({ label, message }) {
  return (
    <div className="border border-zinc-700 bg-zinc-900 rounded px-4 py-3 text-sm mt-2">
      <span className="text-zinc-400 font-mono text-xs">{label} </span>
      <span className="text-zinc-200">{message}</span>
    </div>
  );
}

function Label({ children }) {
  return <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2 font-mono">{children}</p>;
}

function Tag({ text }) {
  return (
    <span className="inline-block text-xs border border-zinc-700 text-zinc-400 rounded px-2 py-0.5 mr-1 mb-1 font-mono">
      {text}
    </span>
  );
}

// ─── Workflow Diagram (Req 3.5.2 — agent communication) ───────────────────────

function WorkflowDiagram({ stage }) {
  const steps = [
    { key: 'vision',     label: 'Vision\nAgent',     num: '01' },
    { key: 'prompt',     label: 'Prompt\nEngineer',  num: '02' },
    { key: 'generation', label: 'Image\nGenerator',  num: '03' },
    { key: 'critique',   label: 'Critique\nAgent',   num: '04' },
  ];
  const order = ['idle', 'vision', 'prompt', 'generation', 'critique', 'done'];
  const ci    = order.indexOf(stage);

  return (
    <div className="border border-zinc-800 rounded-lg bg-zinc-950 px-5 py-4">
      <Label>Pipeline Orchestration — Agent Communication Flow</Label>
      <div className="flex items-center overflow-x-auto pb-1">
        {steps.map((s, i) => {
          const si       = order.indexOf(s.key);
          const isDone   = stage === 'done' || (stage !== 'idle' && si < ci);
          const isRun    = stage === s.key;
          return (
            <div key={s.key} className="flex items-center shrink-0">
              <div className={`flex flex-col items-center px-4 py-2 rounded border text-center transition-all ${
                isRun  ? 'border-white bg-white text-black'
                : isDone ? 'border-zinc-500 text-white'
                : 'border-zinc-800 text-zinc-600'
              }`}>
                <span className="text-xs font-mono font-bold">{s.num}</span>
                <span className="text-xs whitespace-pre-line leading-tight mt-0.5">{s.label}</span>
                {isDone && <span className="text-xs mt-1 font-mono">✓</span>}
                {isRun  && <span className="text-xs mt-1 animate-pulse">●</span>}
              </div>
              {i < steps.length - 1 && (
                <div className="flex items-center mx-1">
                  <div className={`w-6 h-px ${isDone ? 'bg-zinc-500' : 'bg-zinc-800'}`} />
                  <span className={`text-xs font-mono ${isDone ? 'text-zinc-400' : 'text-zinc-700'}`}>→</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-zinc-600 font-mono mt-3">
        Each agent's output becomes the next agent's input. Results are shown in the panels below.
      </p>
    </div>
  );
}

// ─── Test Case Presets (Req 3.5.4 — three required use cases) ─────────────────

const PRESETS = [
  {
    label: 'Use Case A — Captioning & VQA',
    instruction: 'Generate a detailed caption for this image and answer key visual questions about the subject, environment, and mood.',
  },
  {
    label: 'Use Case B — Style-Guided Transformation',
    instruction: 'Transform this image into a watercolor painting with soft brushstrokes and a painterly aesthetic.',
  },
  {
    label: 'Use Case C — Prompt-Based Enhancement',
    instruction: 'Enhance this as a professional studio-quality photo with balanced lighting, sharp details, and cinematic composition.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [apiKey,       setApiKey]       = useState('');
  const [showKey,      setShowKey]      = useState(false);
  const [imageBase64,  setImageBase64]  = useState(null);
  const [imageMime,    setImageMime]    = useState('image/jpeg');
  const [imagePreview, setImagePreview] = useState(null);
  const [instruction,  setInstruction]  = useState('');

  // stage: idle | quality-check | vision | prompt | generation | critique | done
  const [stage,          setStage]          = useState('idle');
  const [errors,         setErrors]         = useState({});
  const [visionResult,   setVisionResult]   = useState(null);
  const [promptResult,   setPromptResult]   = useState(null);
  const [genResult,      setGenResult]      = useState(null);
  const [critiqueResult, setCritiqueResult] = useState(null);
  const [rubricsHistory, setRubricsHistory] = useState([]);

  // Failure handling: quality warning gate
  const [qualityWarning,    setQualityWarning]    = useState(null);
  const [pendingVisionData, setPendingVisionData] = useState(null);

  const fileRef = useRef();

  function agentStatus(agentStage) {
    const order = ['vision', 'prompt', 'generation', 'critique'];
    const ci = order.indexOf(stage);
    const ai = order.indexOf(agentStage);
    if (stage === 'idle' || stage === 'quality-check') return 'idle';
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
    // Clear previous results when a new image is uploaded
    setVisionResult(null); setPromptResult(null);
    setGenResult(null);    setCritiqueResult(null);
    setQualityWarning(null);
  }

  // Continue pipeline after user acknowledges quality warning
  async function continueAfterWarning() {
    setQualityWarning(null);
    setStage('prompt');
    await runFromPromptStage(pendingVisionData);
  }

  async function runFromPromptStage(vision) {
    // Agent 2 — Prompt Engineering
    // INPUT: userInstruction + vision output from Agent 1
    let promptRes;
    try {
      promptRes = await runPromptAgent(apiKey, instruction, vision);
      setPromptResult(promptRes);
      // Failure: ambiguous instruction
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
    // INPUT: refined_prompt from Agent 2
    setStage('generation');
    let gen;
    try {
      gen = await runGenerationAgent(apiKey, promptRes.refined_prompt);
      setGenResult(gen);
    } catch (err) {
      // Failure: generation error — show refined prompt so user can retry manually
      setErrors(e => ({
        ...e,
        generation: `${err.message}. Refined prompt for manual retry: "${promptRes.refined_prompt}"`,
      }));
      setStage('idle');
      return;
    }

    // Agent 4 — Critique & Evaluation
    // INPUT: original image + generated image URL + refined prompt
    setStage('critique');
    try {
      const critique = await runCritiqueAgent(
        apiKey, imageBase64, imageMime, gen.imageUrl, promptRes.refined_prompt
      );
      setCritiqueResult(critique);
      setRubricsHistory(h => [
        ...h,
        {
          n:                      h.length + 1,
          instruction:            instruction.slice(0, 45) + (instruction.length > 45 ? '…' : ''),
          visual_relevance:       critique.visual_relevance,
          prompt_faithfulness:    critique.prompt_faithfulness,
          transformation_quality: critique.transformation_quality,
          clip:                   (critique.clip_similarity_estimate * 100).toFixed(0) + '%',
          verdict:                critique.verdict,
        },
      ]);
    } catch (err) {
      setErrors(e => ({ ...e, critique: `Critique agent failed: ${err.message}` }));
      setStage('idle');
      return;
    }

    setStage('done');
  }

  // ── Orchestrator entry point ─────────────────────────────────────────────────
  async function runPipeline() {
    // Input validation
    if (!apiKey.trim())      { setErrors(e => ({ ...e, pipeline: 'Please enter your OpenAI API key.' })); return; }
    if (!imageBase64)        { setErrors(e => ({ ...e, pipeline: 'Please upload an image.' })); return; }
    if (!instruction.trim()) { setErrors(e => ({ ...e, pipeline: 'Please enter an instruction.' })); return; }

    setErrors({});
    setVisionResult(null); setPromptResult(null);
    setGenResult(null);    setCritiqueResult(null);
    setQualityWarning(null);

    // Agent 1 — Vision Understanding
    // INPUT: raw image (base64)
    setStage('vision');
    let vision;
    try {
      vision = await runVisionAgent(apiKey, imageBase64, imageMime);
      setVisionResult(vision);

      // Failure: poor quality image — pause and let user decide
      if (vision.quality_warning) {
        setQualityWarning(vision.quality_warning);
        setPendingVisionData(vision);
        setStage('quality-check');
        return;
      }
    } catch (err) {
      setErrors(e => ({ ...e, vision: `Vision agent failed: ${err.message}` }));
      setStage('idle');
      return;
    }

    setStage('prompt');
    await runFromPromptStage(vision);
  }

  const running = !['idle', 'done', 'quality-check'].includes(stage);

  return (
    <div className="min-h-screen bg-black text-white font-sans">

      {/* Header */}
      <header className="border-b border-zinc-800 bg-black sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Multi-Modal AI Pipeline</h1>
            <p className="text-xs text-zinc-500 mt-0.5 font-mono">
              4 independent agent modules · GPT-4o + DALL-E 3
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

        {/* Workflow Diagram */}
        <WorkflowDiagram stage={stage} />

        {/* Input Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Image Upload */}
          <div className="border border-zinc-800 rounded-lg bg-zinc-950 p-5">
            <Label>Input Image</Label>
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

          {/* Instruction */}
          <div className="border border-zinc-800 rounded-lg bg-zinc-950 p-5 flex flex-col">
            <Label>Instruction</Label>
            <textarea
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              placeholder="Describe the transformation or analysis you want…"
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white placeholder-zinc-600 text-sm resize-none focus:outline-none focus:border-white min-h-[72px]"
            />
            {/* Req 3.5.4 — three required use cases as presets */}
            <div className="mt-3">
              <p className="text-xs text-zinc-600 font-mono mb-1.5">Req 3.5.4 test cases:</p>
              <div className="flex flex-col gap-1">
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
              className="mt-3 w-full bg-white text-black font-bold rounded py-2.5 text-sm hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {running
                ? `Running Agent ${['vision','prompt','generation','critique'].indexOf(stage) + 1} — ${stage}…`
                : 'Run Pipeline'}
            </button>
            {errors.pipeline && <ErrorBox message={errors.pipeline} />}
          </div>
        </div>

        {/* Failure Handling — Quality Warning Gate (Req 3.5.5) */}
        {qualityWarning && (
          <div className="border border-zinc-500 rounded-lg bg-zinc-900 px-5 py-4">
            <Label>Failure Handling — Poor Image Quality Detected</Label>
            <p className="text-sm text-zinc-200 mb-4">{qualityWarning}</p>
            <p className="text-xs text-zinc-500 mb-4">
              The pipeline has paused. You can continue with this image anyway, or upload a clearer image and restart.
            </p>
            <div className="flex gap-3">
              <button
                onClick={continueAfterWarning}
                className="bg-white text-black text-sm font-bold px-4 py-2 rounded hover:bg-zinc-200 transition-colors"
              >
                Continue anyway
              </button>
              <button
                onClick={() => { setQualityWarning(null); setStage('idle'); }}
                className="border border-zinc-600 text-zinc-300 text-sm px-4 py-2 rounded hover:border-white hover:text-white transition-colors"
              >
                Cancel — upload better image
              </button>
            </div>
          </div>
        )}

        {/* ── Agent 01 — Vision Understanding ──────────────────────────────────
            Req 3.1: caption · objects · scene · ≥2 contextual VQA answers     */}
        <AgentPanel number="01" title="Vision Understanding Agent" status={agentStatus('vision')}>
          {agentStatus('vision') === 'running' && <Spinner />}
          {errors.vision && <ErrorBox message={errors.vision} />}
          {visionResult ? (
            <div className="space-y-4">
              <InfoBox label="INPUT →" message="Raw image (base64) uploaded by user" />
              <div>
                <Label>Caption</Label>
                <p className="text-sm text-zinc-200">{visionResult.caption}</p>
              </div>
              <div>
                <Label>Key Objects / Entities</Label>
                <div>{visionResult.objects?.map(o => <Tag key={o} text={o} />)}</div>
              </div>
              <div>
                <Label>Scene Description</Label>
                <p className="text-sm text-zinc-300 leading-relaxed">{visionResult.scene_description}</p>
              </div>
              <div>
                <Label>Visual Q&amp;A</Label>
                <div className="space-y-2">
                  {visionResult.vqa?.map((qa, i) => (
                    <div key={i} className="border border-zinc-800 rounded bg-zinc-900 px-4 py-3">
                      <p className="text-xs text-zinc-400 mb-1">Q{i+1}: {qa.question}</p>
                      <p className="text-sm text-white">A: {qa.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
              <InfoBox label="OUTPUT →" message="caption · objects · scene description · VQA — passed to Agent 02" />
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">Upload an image and run the pipeline to see visual analysis.</p>
          )}
        </AgentPanel>

        {/* ── Agent 02 — Prompt Engineering ────────────────────────────────────
            Req 3.2: rewrite · enrich · preserve transformation intent           */}
        <AgentPanel number="02" title="Prompt Engineering Agent" status={agentStatus('prompt')}>
          {agentStatus('prompt') === 'running' && <Spinner />}
          {errors.prompt && <ErrorBox message={errors.prompt} />}
          {promptResult ? (
            <div className="space-y-4">
              <InfoBox label="INPUT →" message={`User instruction + Agent 01 output (caption, objects, scene)`} />
              <div>
                <Label>Refined Prompt</Label>
                <div className="border border-zinc-700 rounded bg-zinc-900 px-4 py-3 text-sm text-white font-mono leading-relaxed">
                  {promptResult.refined_prompt}
                </div>
              </div>
              <div>
                <Label>Enrichments Added</Label>
                <ul className="space-y-1">
                  {promptResult.enrichments?.map((e, i) => (
                    <li key={i} className="text-sm text-zinc-300 flex gap-2">
                      <span className="text-zinc-600 font-mono shrink-0">—</span>{e}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <Label>Original Intent Preserved</Label>
                <p className="text-sm text-zinc-300">{promptResult.preserved_intent}</p>
              </div>
              <InfoBox label="OUTPUT →" message="refined_prompt — passed to Agent 03 for image generation" />
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">Waiting for Agent 01 to complete.</p>
          )}
        </AgentPanel>

        {/* ── Agent 03 — Image Generation ──────────────────────────────────────
            Req 3.3: generate image · stylization mode · log config              */}
        <AgentPanel number="03" title="Image Generation Agent — DALL-E 3" status={agentStatus('generation')}>
          {agentStatus('generation') === 'running' && (
            <Spinner message="Generating image with DALL-E 3 — ~10–20 s…" />
          )}
          {errors.generation && <ErrorBox message={errors.generation} />}
          {genResult ? (
            <div className="space-y-4">
              <InfoBox label="INPUT →" message={`refined_prompt from Agent 02`} />
              <div>
                <Label>Generation Config</Label>
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
                <Label>Generated Image</Label>
                <div className="flex justify-center border border-zinc-800 rounded bg-zinc-900 p-3">
                  <img src={genResult.imageUrl} alt="AI Generated" className="rounded max-h-96" />
                </div>
              </div>
              <InfoBox label="OUTPUT →" message="imageUrl — passed to Agent 04 for critique" />
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">Waiting for Agent 02 to complete.</p>
          )}
        </AgentPanel>

        {/* ── Agent 04 — Critique & Evaluation ─────────────────────────────────
            Req 3.4: relevance · faithfulness · quality · CLIP · verdict         */}
        <AgentPanel number="04" title="Critique & Evaluation Agent" status={agentStatus('critique')}>
          {agentStatus('critique') === 'running' && <Spinner />}
          {errors.critique && <ErrorBox message={errors.critique} />}
          {critiqueResult ? (
            <div className="space-y-5">
              <InfoBox label="INPUT →" message="Original image + Generated image + refined_prompt from Agent 02" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Scores */}
                <div>
                  <Label>Automatic Evaluation (Req 3.4)</Label>
                  <ScoreBar label="Visual Relevance"       value={critiqueResult.visual_relevance} />
                  <ScoreBar label="Prompt Faithfulness"    value={critiqueResult.prompt_faithfulness} />
                  <ScoreBar label="Transformation Quality" value={critiqueResult.transformation_quality} />
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
                  <Label>Verdict</Label>
                  <div className={`border rounded px-4 py-4 text-center font-bold text-xl font-mono ${
                    critiqueResult.verdict === 'ACCEPT'
                      ? 'border-white bg-white text-black'
                      : 'border-zinc-500 bg-zinc-900 text-white'
                  }`}>
                    {critiqueResult.verdict === 'ACCEPT' ? '✓ ACCEPT' : '✗ REVISE'}
                  </div>
                  {critiqueResult.revision_suggestion && (
                    <div className="border border-zinc-600 bg-zinc-900 rounded px-4 py-3">
                      <Label>Revision Suggestion</Label>
                      <p className="text-sm text-zinc-200">{critiqueResult.revision_suggestion}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Side-by-side */}
              {genResult && (
                <div>
                  <Label>Side-by-Side Comparison</Label>
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

              <div>
                <Label>Detailed Critique</Label>
                <p className="text-sm text-zinc-300 leading-relaxed">{critiqueResult.critique}</p>
              </div>
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">Waiting for Agent 03 to complete.</p>
          )}
        </AgentPanel>

        {/* Human Evaluation Rubric — Req 3.4: across 3–5 examples */}
        {rubricsHistory.length > 0 && (
          <div className="border border-zinc-800 rounded-lg bg-zinc-950 p-5">
            <Label>
              Human Evaluation Rubric — {rubricsHistory.length} / 3 required examples
              {rubricsHistory.length < 3 ? ` (run ${3 - rubricsHistory.length} more test case${rubricsHistory.length === 2 ? '' : 's'})` : ' ✓'}
            </Label>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {['#', 'Instruction', 'Visual', 'Faithfulness', 'Quality', 'CLIP', 'Verdict'].map(h => (
                      <th key={h} className={`py-2 px-3 text-zinc-500 font-medium ${h === 'Instruction' ? 'text-left' : 'text-center'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rubricsHistory.map(row => (
                    <tr key={row.n} className="border-b border-zinc-900 hover:bg-zinc-900 transition-colors">
                      <td className="py-2 px-3 text-zinc-600">{row.n}</td>
                      <td className="py-2 px-3 text-zinc-300">{row.instruction}</td>
                      <td className="py-2 px-3 text-center text-white">{row.visual_relevance}/10</td>
                      <td className="py-2 px-3 text-center text-white">{row.prompt_faithfulness}/10</td>
                      <td className="py-2 px-3 text-center text-white">{row.transformation_quality}/10</td>
                      <td className="py-2 px-3 text-center text-white">{row.clip}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`font-bold px-2 py-0.5 rounded ${
                          row.verdict === 'ACCEPT' ? 'bg-white text-black' : 'border border-zinc-500 text-zinc-300'
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
        Lab 2 · 4 Independent Agent Modules · {OPENAI_MODEL} (Vision/Prompt/Critique) · DALL-E 3 (Generation)
      </footer>
    </div>
  );
}
