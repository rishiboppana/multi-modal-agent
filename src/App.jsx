// ORCHESTRATOR — Multi-Modal AI Pipeline
// Req 3.5: modular agents · orchestration · intermediate outputs ·
//          3 test cases · failure handling

import { useState, useRef } from 'react';
import { OPENAI_MODEL }        from './agents/api.js';
import { runVisionAgent }      from './agents/visionAgent.js';
import { runPromptAgent }      from './agents/promptAgent.js';
import { runGenerationAgent }  from './agents/generationAgent.js';
import { runSimilarityAgent }  from './agents/similarityAgent.js';
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
    { key: 'vision',     label: 'Vision\nAgent',      num: '01' },
    { key: 'prompt',     label: 'Prompt\nEngineer',   num: '02' },
    { key: 'generation', label: 'Image\nGenerator',   num: '03' },
    { key: 'similarity', label: 'Similarity\nCheck',  num: '01b' },
    { key: 'critique',   label: 'Critique\nAgent',    num: '04' },
  ];
  const order = ['idle', 'vision', 'prompt', 'generation', 'similarity', 'critique', 'done'];
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
    instruction: 'Analyze and visually represent this image in full detail: identify every key object, describe the scene composition, and create a rich detailed illustration that captures the subject, environment, mood, colors, textures, and spatial relationships exactly as seen.',
  },
  {
    label: 'Use Case B — Style-Guided Transformation',
    instruction: 'Transform this image into a professional watercolor painting — apply wet-on-wet brushstroke technique, soft color bleeding at edges, visible paper grain texture, translucent color washes, a warm painterly palette, and loose gestural marks. Preserve the original subject identity, pose, and composition throughout the transformation.',
  },
  {
    label: 'Use Case C — Prompt-Based Enhancement',
    instruction: 'Enhance this image as a professional studio-quality photograph — apply sharp focus, three-point studio lighting with balanced key and fill lights, cinematic depth of field with soft bokeh, rich color grading, high dynamic range, and RAW-quality post-processing. Keep the exact same subject, pose, and framing.',
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

  // stage: idle | quality-check | vision | prompt | generation | similarity | critique | done
  const [stage,            setStage]            = useState('idle');
  const [errors,           setErrors]           = useState({});
  const [visionResult,     setVisionResult]     = useState(null);
  const [promptResult,     setPromptResult]     = useState(null);
  const [genResult,        setGenResult]        = useState(null);
  const [similarityResult, setSimilarityResult] = useState(null);
  const [critiqueResult,   setCritiqueResult]   = useState(null);
  const [rubricsHistory,   setRubricsHistory]   = useState([]);

  // Loop orchestrator state
  const [loopInfo,      setLoopInfo]      = useState(null); // { attempt, maxAttempts, weakAgent, agentFeedback }
  const [iterationLog,  setIterationLog]  = useState([]);   // per-attempt history

  // Failure handling: quality warning gate
  const [qualityWarning,    setQualityWarning]    = useState(null);
  const [pendingVisionData, setPendingVisionData] = useState(null);

  const fileRef = useRef();

  function agentStatus(agentStage) {
    const order = ['vision', 'prompt', 'generation', 'similarity', 'critique'];
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
    setGenResult(null);    setSimilarityResult(null);
    setCritiqueResult(null);
    setQualityWarning(null);
    setLoopInfo(null);
    setIterationLog([]);
  }

  // Continue pipeline after user acknowledges quality warning
  async function continueAfterWarning() {
    setQualityWarning(null);
    await runFromPromptStage(pendingVisionData);
  }

  // ── Loop Orchestrator ────────────────────────────────────────────────────────
  // Runs up to MAX_ITERATIONS. Each cycle the critique agent diagnoses which
  // upstream agent produced the weakest output and routes targeted feedback to
  // that agent specifically so each retry fixes the right problem.
  async function runFromPromptStage(initialVision) {
    const MAX_ITERATIONS = 5;
    let currentVision        = initialVision;
    let visionFeedback       = null;
    let promptHint           = null;
    let consecutiveGenBlame  = 0;    // tracks how many times in a row generation was blamed
    let prevMinScore         = -1;   // tracks whether scores improved or regressed
    let bestGen              = null; // best result seen so far (highest min score across three dims)
    let bestCritique         = null;

    setIterationLog([]);
    setLoopInfo({ attempt: 1, maxAttempts: MAX_ITERATIONS, weakAgent: null, agentFeedback: null });

    for (let attempt = 1; attempt <= MAX_ITERATIONS; attempt++) {
      // ── Re-run Vision if it was identified as the weak agent ─────────────────
      if (visionFeedback) {
        setStage('vision');
        try {
          currentVision = await runVisionAgent(apiKey, imageBase64, imageMime, visionFeedback);
          setVisionResult(currentVision);
        } catch (err) {
          setErrors(e => ({ ...e, vision: `Vision agent failed: ${err.message}` }));
          setStage('idle');
          return;
        }
        visionFeedback = null;
      }

      // ── Agent 2 — Prompt Engineering ─────────────────────────────────────────
      setStage('prompt');
      let promptRes;
      try {
        promptRes = await runPromptAgent(apiKey, instruction, currentVision, promptHint);
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

      // ── Agent 3 — Image Generation ────────────────────────────────────────────
      setStage('generation');
      let gen;
      try {
        gen = await runGenerationAgent(apiKey, promptRes.refined_prompt, promptRes.mode);
        setGenResult(gen);
      } catch (err) {
        setErrors(e => ({
          ...e,
          generation: `${err.message}. Refined prompt: "${promptRes.refined_prompt}"`,
        }));
        setStage('idle');
        return;
      }

      // ── Agent 1b — Vision Similarity Check ───────────────────────────────────
      // Re-analyzes the generated image and compares it field-by-field against
      // the original vision analysis to produce precise mismatch data.
      setStage('similarity');
      let similarity = null;
      try {
        similarity = await runSimilarityAgent(apiKey, currentVision, gen.imageUrl);
        setSimilarityResult(similarity);
      } catch (err) {
        // Non-fatal — continue without similarity data
        setSimilarityResult(null);
      }

      // ── Agent 4 — Critique & Evaluation ──────────────────────────────────────
      setStage('critique');
      let critique;
      try {
        critique = await runCritiqueAgent(
          apiKey, imageBase64, imageMime, gen.imageUrl, promptRes.refined_prompt, promptRes.mode, similarity
        );

        // Keep the best-scoring result across all attempts so the UI always
        // shows the best output even if a later attempt regresses.
        const minScore = Math.min(
          critique.visual_relevance,
          critique.prompt_faithfulness,
          critique.transformation_quality
        );
        if (minScore > prevMinScore) {
          prevMinScore = minScore;
          bestGen      = gen;
          bestCritique = critique;
        }
        // Always display best result seen so far
        setGenResult(bestGen);
        setCritiqueResult(bestCritique);

        setIterationLog(log => [
          ...log,
          {
            attempt,
            weakAgent:     critique.weak_agent    ?? null,
            agentFeedback: critique.agent_feedback ?? null,
            scores: {
              visual_relevance:       critique.visual_relevance,
              prompt_faithfulness:    critique.prompt_faithfulness,
              transformation_quality: critique.transformation_quality,
              clip:                   critique.clip_similarity_estimate,
            },
            verdict:             critique.verdict,
            revision_suggestion: critique.revision_suggestion ?? null,
            isBest:              minScore === prevMinScore,
          },
        ]);

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

      if (bestCritique.verdict === 'ACCEPT' || attempt >= MAX_ITERATIONS) break;

      // ── Smart weak-agent routing ──────────────────────────────────────────────
      let weakAgent    = critique.weak_agent    ?? 'prompt';
      let agentFeedback = critique.agent_feedback ?? critique.revision_suggestion ?? '';

      // If generation is blamed 2+ times in a row the real problem is the prompt
      // being too complex. Force a prompt simplification instead of adding detail.
      if (weakAgent === 'generation') {
        consecutiveGenBlame++;
        if (consecutiveGenBlame >= 2) {
          weakAgent     = 'prompt';
          agentFeedback = `The previous prompt was too long and complex — DALL-E ignored key details. Rewrite the prompt as 2 short sentences only. Sentence 1: art style + composition guard ("single character, centered, no duplicates"). Sentence 2: one specific requested change. Drop all other detail. ${agentFeedback}`;
          consecutiveGenBlame = 0;
        }
      } else {
        consecutiveGenBlame = 0;
      }

      setLoopInfo({
        attempt: attempt + 1,
        maxAttempts: MAX_ITERATIONS,
        weakAgent,
        agentFeedback,
      });

      if (weakAgent === 'vision') {
        visionFeedback = agentFeedback;
        promptHint     = null;
      } else {
        visionFeedback = null;
        // Prepend concrete similarity mismatches so the prompt agent has named
        // field-level diffs, not just a vague revision suggestion.
        const mismatchContext = similarity?.mismatches?.length
          ? `Similarity check found these specific mismatches: ${similarity.mismatches.join(' | ')}. `
          : '';
        promptHint = mismatchContext + agentFeedback;
      }
    }

    // Ensure UI shows the best result, not the last one
    if (bestGen)      setGenResult(bestGen);
    if (bestCritique) setCritiqueResult(bestCritique);

    setLoopInfo(prev => ({ ...prev, weakAgent: null, agentFeedback: null }));
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
    setGenResult(null);    setSimilarityResult(null);
    setCritiqueResult(null);
    setQualityWarning(null);
    setLoopInfo(null);
    setIterationLog([]);

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

        {/* ── Loop Orchestrator Progress Banner ───────────────────────────────── */}
        {loopInfo && loopInfo.attempt > 1 && stage !== 'idle' && (
          <div className="border border-zinc-600 rounded-lg bg-zinc-900 px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <Label>Loop Orchestrator — Auto-Revision in Progress</Label>
              <span className="text-xs font-mono text-zinc-400">
                Attempt {loopInfo.attempt} / {loopInfo.maxAttempts}
              </span>
            </div>
            <div className="flex gap-1 mb-3">
              {Array.from({ length: loopInfo.maxAttempts }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1.5 rounded-full ${
                    i < loopInfo.attempt - 1 ? 'bg-zinc-400'
                    : i === loopInfo.attempt - 1 ? 'bg-white animate-pulse'
                    : 'bg-zinc-800'
                  }`}
                />
              ))}
            </div>
            {loopInfo.weakAgent && (
              <div className="flex items-start gap-3">
                <span className={`text-xs font-mono font-bold px-2 py-1 rounded border shrink-0 ${
                  loopInfo.weakAgent === 'vision'     ? 'border-zinc-400 text-zinc-200' :
                  loopInfo.weakAgent === 'prompt'     ? 'border-zinc-400 text-zinc-200' :
                                                        'border-zinc-400 text-zinc-200'
                }`}>
                  {loopInfo.weakAgent === 'vision'     ? 'Agent 01 — Vision'
                  : loopInfo.weakAgent === 'prompt'    ? 'Agent 02 — Prompt'
                                                       : 'Agent 03 — Generation'}
                </span>
                <p className="text-xs text-zinc-400 leading-relaxed">{loopInfo.agentFeedback}</p>
              </div>
            )}
          </div>
        )}

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
              <InfoBox label="OUTPUT →" message="imageUrl — passed to Agent 01b (Similarity Check) and Agent 04 (Critique)" />
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">Waiting for Agent 02 to complete.</p>
          )}
        </AgentPanel>

        {/* ── Agent 01b — Vision Similarity Check ──────────────────────────────── */}
        <AgentPanel number="01b" title="Vision Similarity Agent — Fidelity Check" status={agentStatus('similarity')}>
          {agentStatus('similarity') === 'running' && <Spinner message="Re-analyzing generated image and comparing to original…" />}
          {similarityResult ? (
            <div className="space-y-4">
              <InfoBox label="INPUT →" message="Original vision analysis (Agent 01) + Generated image URL (Agent 03)" />

              {/* Fidelity verdict + overall score */}
              <div className="flex items-center gap-4">
                <div className={`border rounded px-4 py-3 text-center font-bold font-mono text-sm ${
                  similarityResult.fidelity_verdict === 'HIGH'   ? 'border-white bg-white text-black' :
                  similarityResult.fidelity_verdict === 'MEDIUM' ? 'border-zinc-400 text-zinc-200' :
                                                                    'border-zinc-600 text-zinc-500'
                }`}>
                  {similarityResult.fidelity_verdict === 'HIGH' ? '✓ HIGH' :
                   similarityResult.fidelity_verdict === 'MEDIUM' ? '~ MEDIUM' : '✗ LOW'} FIDELITY
                </div>
                <div className="text-xs text-zinc-400 font-mono">
                  Overall fidelity score: <span className="text-white font-bold">{similarityResult.overall_fidelity_score}/10</span>
                </div>
              </div>

              {/* Per-field similarity bars */}
              <div>
                <Label>Field-by-Field Similarity (Vision Agent 01 vs Generated Image)</Label>
                {[
                  { label: 'Art Style Match',       value: similarityResult.similarity_scores?.art_style_match },
                  { label: 'Subject Identity',      value: similarityResult.similarity_scores?.subject_identity_match },
                  { label: 'Clothing Details',      value: similarityResult.similarity_scores?.clothing_details_match },
                  { label: 'Color Accuracy',        value: similarityResult.similarity_scores?.color_accuracy_match },
                  { label: 'Pose Match',            value: similarityResult.similarity_scores?.pose_match },
                  { label: 'Composition',           value: similarityResult.similarity_scores?.composition_match },
                ].map(({ label, value }) => value != null && (
                  <ScoreBar key={label} label={label} value={value} />
                ))}
              </div>

              {/* Matches & Mismatches */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {similarityResult.matches?.length > 0 && (
                  <div>
                    <Label>Confirmed Matches</Label>
                    <ul className="space-y-1">
                      {similarityResult.matches.map((m, i) => (
                        <li key={i} className="text-xs text-zinc-300 flex gap-2">
                          <span className="text-zinc-500 shrink-0">✓</span>{m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {similarityResult.mismatches?.length > 0 && (
                  <div>
                    <Label>Detected Mismatches</Label>
                    <ul className="space-y-1">
                      {similarityResult.mismatches.map((m, i) => (
                        <li key={i} className="text-xs text-zinc-400 flex gap-2">
                          <span className="text-zinc-600 shrink-0">✗</span>{m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Prompt fix suggestions */}
              {similarityResult.prompt_fix_suggestions?.length > 0 && (
                <div>
                  <Label>Prompt Fix Suggestions (routed to Agent 02 on retry)</Label>
                  <ul className="space-y-1">
                    {similarityResult.prompt_fix_suggestions.map((s, i) => (
                      <li key={i} className="text-xs text-zinc-400 flex gap-2">
                        <span className="text-zinc-600 shrink-0 font-mono">→</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <InfoBox label="OUTPUT →" message="Similarity scores + mismatches → passed to Agent 04 (Critique) and Agent 02 (Prompt) on retry" />
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">Waiting for Agent 03 to complete.</p>
          )}
        </AgentPanel>

        {/* ── Agent 04 — Critique & Evaluation ─────────────────────────────────
            Req 3.4: relevance · faithfulness · quality · CLIP · verdict         */}
        <AgentPanel number="04" title="Critique & Evaluation Agent" status={agentStatus('critique')}>
          {agentStatus('critique') === 'running' && <Spinner />}
          {errors.critique && <ErrorBox message={errors.critique} />}
          {critiqueResult ? (
            <div className="space-y-5">
              <InfoBox label="INPUT →" message="Original image + Generated image + refined_prompt (Agent 02) + similarity scores (Agent 01b)" />

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
        {/* ── Loop Orchestrator Iteration Log ─────────────────────────────────── */}
        {iterationLog.length > 0 && (
          <div className="border border-zinc-800 rounded-lg bg-zinc-950 p-5">
            <Label>
              Loop Orchestrator — Iteration History ({iterationLog.length} attempt{iterationLog.length > 1 ? 's' : ''})
              {iterationLog[iterationLog.length - 1]?.verdict === 'ACCEPT' ? ' ✓ Converged' : ''}
            </Label>
            <div className="space-y-3 mt-1">
              {iterationLog.map((entry) => (
                <div
                  key={entry.attempt}
                  className={`border rounded px-4 py-3 ${
                    entry.verdict === 'ACCEPT' ? 'border-white bg-zinc-900'
                    : entry.isBest ? 'border-zinc-400 bg-zinc-900'
                    : 'border-zinc-800 bg-zinc-950'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-zinc-300">
                        Attempt {entry.attempt}
                      </span>
                      {entry.isBest && entry.verdict !== 'ACCEPT' && (
                        <span className="text-xs font-mono text-zinc-400 border border-zinc-600 px-1.5 py-0.5 rounded">
                          best so far
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.weakAgent && entry.verdict !== 'ACCEPT' && (
                        <span className="text-xs font-mono border border-zinc-600 text-zinc-400 px-2 py-0.5 rounded">
                          Improving: {entry.weakAgent === 'vision' ? 'Agent 01 Vision' : entry.weakAgent === 'prompt' ? 'Agent 02 Prompt' : 'Agent 03 Generation'}
                        </span>
                      )}
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        entry.verdict === 'ACCEPT' ? 'bg-white text-black' : 'border border-zinc-600 text-zinc-300'
                      }`}>
                        {entry.verdict === 'ACCEPT' ? '✓ ACCEPT' : '✗ REVISE'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs font-mono mb-2">
                    {[
                      { label: 'Visual',       value: entry.scores.visual_relevance,       max: 10 },
                      { label: 'Faithfulness', value: entry.scores.prompt_faithfulness,    max: 10 },
                      { label: 'Quality',      value: entry.scores.transformation_quality, max: 10 },
                      { label: 'CLIP',         value: (entry.scores.clip * 100).toFixed(0) + '%', raw: true },
                    ].map(({ label, value, max, raw }) => (
                      <div key={label} className="text-center">
                        <p className="text-zinc-500">{label}</p>
                        <p className={`font-bold ${
                          raw
                            ? 'text-zinc-200'
                            : value >= 9 ? 'text-white' : value >= 8 ? 'text-zinc-300' : 'text-zinc-500'
                        }`}>
                          {raw ? value : `${value}/${max}`}
                        </p>
                      </div>
                    ))}
                  </div>
                  {entry.agentFeedback && entry.verdict !== 'ACCEPT' && (
                    <p className="text-xs text-zinc-500 leading-relaxed border-t border-zinc-800 pt-2 mt-1">
                      <span className="text-zinc-400">Feedback → </span>{entry.agentFeedback}
                    </p>
                  )}
                </div>
              ))}
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
