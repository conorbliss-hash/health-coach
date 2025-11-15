// ==== Prompts.gs ====
// Shorter, delta-first guidance; broadened titles; same output contract for parser

const PROMPT_CHAR_LIMIT = 5500;

function truncatePromptValue(value, maxChars) {
  if (value == null) return '';
  let str = String(value).trim();
  if (!maxChars) return str;
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars).trim();
}

function buildEvaluationPrompt(weekly, trend, scores, goals, ds, capacity, decision) {
  ds = ds || { work:{deltaGoalStr:'—',pctTrendStr:'0%'}, load:{pctTrendStr:'0%', acwr:{ value:null, label:'Data Gaps' }}, steps:{pctTrendStr:'0%',days6k:0,deltaGoalStr:'—'}, sleep:{deltaGoalStr:'—',pctTrendStr:'0%',variability:'N/A', consistency:{ score:null, label:'Data Gaps' }}, rhr:{deltaTrendStr:'+0 bpm'}, missing:{activity:0,sleep:0,rhr:0} };
  capacity = capacity || { label:'Green', reasons:[] };
  decision = decision || { plan:'Sustain', lever:'Maintain; keep steps steady' };

  const fulfil = ds?.fulfilment || {};
  const workFulfil = fulfil.workPct != null ? `${fulfil.workPct}%` : '—';
  const strengthFulfil = fulfil.strengthPct != null ? `${fulfil.strengthPct}%` : '—';
  const fitnessFulfil = fulfil.fitnessPct != null ? `${fulfil.fitnessPct}%` : '—';
  const sleepFulfil = fulfil.sleepPct != null ? `${fulfil.sleepPct}%` : '—';
  const rhrFulfil = fulfil.rhrPct != null ? `${fulfil.rhrPct}%` : '—';
  const strengthProxyTag = fulfil.strengthProxyGoal ? ' (proxy)' : '';

  const sleepConsistencyScore = ds?.sleep?.consistency?.score;
  const sleepConsistencyLabel = ds?.sleep?.consistency?.label || 'Data gaps';
  const rawSleepConsistencyLine = (sleepConsistencyScore != null ? `${sleepConsistencyScore}/100 (${sleepConsistencyLabel})` : sleepConsistencyLabel);
  const sleepConsistencyLine = truncatePromptValue(rawSleepConsistencyLine, 120);

  const acwrLabel = ds?.load?.acwr?.label || 'Data gaps';
  const acwrValue = ds?.load?.acwr ? (ds.load.acwr.value ?? ds.load.acwr.ratio) : null;
  const acwrLine = acwrValue != null ? `${fmtAcwr(acwrValue)} (${acwrLabel})` : acwrLabel;

  const rawDataGapsLine = (ds.missing.activity||0) + (ds.missing.sleep||0) + (ds.missing.rhr||0)
    ? `${ds.missing.activity} (Activity); ${ds.missing.sleep} (Sleep); ${ds.missing.rhr} (RHR)`
    : 'None';
  const dataGapsLine = truncatePromptValue(rawDataGapsLine, 120);

  const capacityReasons = (capacity.reasons || []).filter(Boolean).slice(0, 5).map(r => truncatePromptValue(r, 80));
  const capacityLabel = truncatePromptValue(capacity.label || 'Green', 40);
  const decisionPlan = truncatePromptValue(decision.plan || 'Sustain', 20);
  const decisionLever = truncatePromptValue(decision.lever || 'Maintain; keep steps steady', 140);
  const capacityReasonLine = capacityReasons.length ? ` — ${capacityReasons.join('; ')}` : '';

  const tierOneBlock = `READINESS GATE\n- Sleep Consistency: ${sleepConsistencyLine}\n- Capacity: ${capacity.label || 'Unknown'}${capacityReasonLine}\n- ACWR: ${acwrLine}\n- RHR Δ: ${ds.rhr?.deltaTrendStr || '—'}`;

  const introBlock = 'You are an elite Australian performance coach with a direct, no-nonsense approach. Write concise guidance based on **deltas and trends** (not raw values). Be authoritative but approachable. Do not motivate or encourage—assess and direct. Avoid decimals.';
  const capacityBlock = `CAPACITY & DECISION\n- Capacity: ${capacityLabel}${capacityReasonLine}\n- Decision: ${decisionPlan} — ${decisionLever}`;
  const fulfilBlock = `FULFILMENT VS GOAL\n- Work: ${workFulfil}\n- Strength: ${strengthFulfil}${strengthProxyTag}\n- Fitness: ${fitnessFulfil}\n- Sleep: ${sleepFulfil}\n- Readiness (RHR): ${rhrFulfil}`;

  const deltaWorkLine = truncatePromptValue(`${ds.work.trendGoalStr || '—'} vs goal • ${ds.work.pctTrendStr} vs 4-wk`, 120);
  const deltaStrengthLine = truncatePromptValue(`${ds.load.trendGoalStr || '—'} vs goal • ${ds.load.pctTrendStr} vs 4-wk • ACWR ${acwrLine}`, 150);
  const stepsFloorTarget = goals.stepsFloor || ((typeof CONFIG !== 'undefined' && CONFIG.Steps) ? CONFIG.Steps.fallbackFloor : 6000);
  const deltaStepsLine = truncatePromptValue(`${ds.steps.trendGoalStr || '—'} vs goal • ${ds.steps.pctTrendStr} vs 4-wk • ≥${stepsFloorTarget} on ${ds.steps.days6k}d`, 160);
  const deltaSleepLine = truncatePromptValue(`${ds.sleep.trendGoalStr || '—'} vs goal • ${ds.sleep.pctTrendStr} vs 4-wk • Var ${ds.sleep.variability}`, 150);
  const deltaReadinessLine = truncatePromptValue(`${ds.rhr.deltaTrendStr} vs 4-wk`, 120);
  const deltaBlock = `DELTA SNAPSHOT (4-wk vs Goal • This Week vs 4-wk)\n- Work: ${deltaWorkLine}\n- Strength: ${deltaStrengthLine}\n- Fitness (Steps): ${deltaStepsLine}\n- Sleep: ${deltaSleepLine}\n- Sleep Consistency (SRI proxy): ${sleepConsistencyLine}\n- Readiness (RHR): ${deltaReadinessLine}\n- Data Gaps: ${dataGapsLine}`;

  const scoresBlock = `SCORES (for context only)\n- Performance Index (40/40/20): ${scores.activity}/100\n- Recovery: ${scores.recovery}/100\n- Readiness: ${scores.readiness}/100`;

  const titlingBlock = `TITLING (one short line each)\n- Activity: title explains the weekly output shift and guidance.\n- Recovery: title reflects sleep rhythm and immediate support action.\n- Readiness: title frames body signals and the safest approach for the week.\n- Each title should read like a **decision cue**, not numeric.\n- Each title begins with the goal status (“on goal”, “behind goal”, etc.).\n- No Δ, ≥, ≤, %, ACWR/HRV/SRI in titles.`;

  const instructionsBlock = `# INSTRUCTIONS\n- Inside the JSON, titles must be plain English explanations of what's happening (no numbers, no acronyms).\n- Avoid jargon (e.g., ACWR/HRV). Keep to 10-14 words, active voice.\n- Each title must be actionable (hint the next move, don't restate metrics).\n- Lead each title and recommendation with the goal status before the action.\n- Do not use symbols such as Δ, ≥, ≤, % or acronyms (ACWR, HRV, SRI) in titles or bullets; spell out "percent".\n- Section bullets remain two sentences: what vs goal, then the action ("so what") with a brief where/how clause.\n- Mention the four week trend only when it changes the advice (short clause).\n- Never mention null values, missing data, or data gaps in the output. Work with available information only.`;

  const styleBlock = `STYLE & RULES\n- Tone: Direct, professional Australian coach. Confident and matter-of-fact, not enthusiastic or over-friendly.\n- All JSON string values must be specific and actionable. Cut the fluff.\n- Do not praise consistency or effort. Do not use phrases like "keep it up", "well done", "great job", or "progress will come".\n- State what happened, what it means, and what to do next. No motivational language.\n- Use fulfilment percent (write "percent") and direction; avoid raw values or decimals.\n- Use raw numbers only when they change the recommended action; otherwise use percent words.\n- **INSIGHTS must be an array of exactly 3 sentences**:\n  1) Performance Index using fulfilment %, note bandwidth.\n  2) Sleep fulfilment and stability (consistency/variance).\n  3) Readiness (RHR) status and restate the decision.\n- Do not list granular metrics in INSIGHTS; those appear in section bullets.\n- **RECOMMENDATIONS must include 4–5 items**, each ≤ 14 words, one-step levers for tonight/tomorrow/next week.\n- Do not repeat any recommendation text inside section bullets or titles.\n- Each action includes a short where/how clause (e.g., "via Session A; tempo 3-1-0").\n- Write like you're briefing an athlete who respects straight talk over sugar-coating.\n- If data is incomplete or null, work with what's available. Never draw attention to missing metrics.`;

  const guardrailsBlock = `PUSH/DELOAD GUARDRAILS\n- Green-light a push only when ACWR ≤1.15, Sleep Consistency ≥70, RHR delta ≤3 bpm.\n- Call for a deload when ACWR ≥1.30 with Sleep Consistency <60 or sleep deficit ≥45m.`;

  const outputContractBlock = [
    '# OUTPUT CONTRACT',
    'Return ONLY the following JSON structure (no prose outside the JSON, no extra keys):',
    '{',
    '  "metadata": {',
    '    "version": "1.0",',
    '    "model": "gpt-4o-mini"',
    '  },',
    '  "insights": ["", "", ""],',
    '  "sections": {',
    '    "activity": {',
    '      "title": "",',
    '      "bullets": ["", "", ""],',
    '      "notes": []',
    '    },',
    '    "recovery": {',
    '      "title": "",',
    '      "bullets": ["", ""],',
    '      "notes": []',
    '    },',
    '    "readiness": {',
    '      "title": "",',
    '      "bullets": ["", ""],',
    '      "notes": []',
    '    }',
    '  },',
    '  "recommendations": ["", "", "", ""],',
    '  "decision": {',
    '    "plan": "",',
    '    "lever": "",',
    '    "notes": []',
    '  },',
    '  "warnings": [],',
    '  "prose": ""',
    '}',
    'All arrays may omit optional entries (e.g., notes) but required arrays must contain non-empty strings. Replace placeholder strings with final content only; do not leave empty items.'
  ].join('\n');

  const blocks = [
    tierOneBlock,
    introBlock,
    capacityBlock,
    fulfilBlock,
    deltaBlock,
    scoresBlock,
    titlingBlock,
    instructionsBlock,
    styleBlock,
    guardrailsBlock,
    outputContractBlock
  ];

  let prompt = blocks.join('\n\n');
  if (prompt.length > PROMPT_CHAR_LIMIT) {
    const idx = blocks.indexOf(scoresBlock);
    if (idx !== -1) {
      blocks.splice(idx, 1);
      prompt = blocks.join('\n\n');
    }
  }
  if (prompt.length > PROMPT_CHAR_LIMIT) {
    const idx = blocks.indexOf(deltaBlock);
    if (idx !== -1) {
      blocks.splice(idx, 1);
      prompt = blocks.join('\n\n');
    }
  }

  return prompt;
}

function buildCoachReadPrompt_(facts) {
  const summaryJson = JSON.stringify(facts || {}, null, 2);
  return [
    'You are a seasoned Australian strength and conditioning coach with a no-nonsense military edge.',
    'Speak directly to the athlete. Assess and direct—never motivate or encourage.',
    'Facts and flags for context (do not repeat verbatim; interpret them):',
    '```json',
    summaryJson,
    '```',
    'Write JSON with the following keys, each mapped to an array of short strings:',
    '- "whereYoureAt": 2 or 3 sentences describing how the week felt and what it means.',
    '- "nextOrders": 3 or 4 action directives written like field instructions (start with verbs).',
    '- "tradeOffs": 2 or 3 statements naming key tensions or choices for the coming week.',
    '- "gutChecks": 2 or 3 reflective questions that keep discipline tight.',
    'Rules:',
    '- Australian English, informal but disciplined. Use "mate" where natural.',
    '- Tight sentences (max ~14 words). No digits, %, arrows, or acronyms (ACWR/HRV/SRI).',
    '- NO motivational phrases: "keep it up", "consistency is key", "celebrate wins", "progress will come".',
    '- Focus on behaviour/mindset. Ignore nulls—work with available data. State facts, give orders.',
    '- Output only the JSON object, nothing else.'
  ].join('\\n');
}
