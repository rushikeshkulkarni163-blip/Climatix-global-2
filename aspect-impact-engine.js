/**
 * Aspect Impact Assessment — scoring engine.
 * Pure, DOM-free functions. Kept separate from window.ENTERPRISE (the
 * platform/CRUD layer) and from the page-local C-Score functions in
 * enterprise-assessment.html — this is a distinct, non-blended
 * intelligence layer (Environmental Impact Index, Net Zero Confidence,
 * Greenwashing Risk), never folded into the 8-C_LAYER weighted C-Score.
 */
(function () {
  'use strict';

  const VAGUE_PHRASES = ['we aim', 'we hope', 'we intend', 'working towards', 'plan to',
    'considering', 'exploring', 'looking at', 'various', 'multiple', 'several factors'];

  function dimScore(dimensions, key, value) {
    if (value === undefined || value === null || value === '') return null;
    const dim = dimensions.find(d => d.key === key);
    if (!dim || dim.categorical) return null;
    const opt = dim.opts.find(o => String(o.value) === String(value));
    return opt ? opt.score : null;
  }

  // ── (a) Per sub-aspect severity ───────────────────────────────────
  function computeAspectSeverity(subAspectId, aspectAnswer, dimensions) {
    aspectAnswer = aspectAnswer || {};
    const scored = ['currentImpact', 'trend', 'evidenceConfidence', 'mitigationEffectiveness', 'residualRisk'];
    let sum = 0, answered = 0;
    scored.forEach(key => {
      const s = dimScore(dimensions, key, aspectAnswer[key]);
      if (s !== null) { sum += s; answered++; }
    });
    const severityScore = answered > 0 ? Math.round(sum / answered) : null;
    return {
      subAspectId,
      severityScore,
      residualSeverity: severityScore === null ? null : 100 - severityScore,
      isComplete: answered === scored.length,
      answeredDims: answered,
      totalDims: scored.length,
      materiality: aspectAnswer.materiality || null,
      evidenceConfidence: aspectAnswer.evidenceConfidence || null,
      trend: aspectAnswer.trend || null
    };
  }

  // ── Adaptive question scoring (Climate/Water expanded tier) ────────
  // Response Quality × Evidence Confidence × Question Weight, normalized
  // 0-100. Reuses the sub-aspect's own evidenceConfidence rating as the
  // multiplier rather than a second per-question evidence picker, so this
  // never double-counts against computeAspectSeverity's evidence handling.
  function responseQualityForQuestion(question, rawValue) {
    if (rawValue === undefined || rawValue === null || rawValue === '') return null;
    const type = question.type;
    if (type === 'yesno') return rawValue === 'YES' ? 100 : rawValue === 'NO' ? 0 : null;
    if (type === 'dropdown') {
      const opt = (question.opts || []).find(o => o.label === rawValue);
      return opt ? opt.score : null;
    }
    if (type === 'number') {
      const n = parseFloat(String(rawValue).replace(/,/g, ''));
      if (isNaN(n)) return null;
      return question.unit === '%' ? Math.min(100, Math.max(0, n)) : (n > 0 ? 75 : 5);
    }
    if (type === 'text') {
      const words = String(rawValue).trim().split(/\s+/).filter(Boolean).length;
      const minW = question.minWords || 50;
      return Math.min(100, Math.round((words / minW) * 100));
    }
    return null;
  }

  function computeAdaptiveQuestionScore(question, answerValue, evidenceConfidenceScore) {
    const quality = responseQualityForQuestion(question, answerValue);
    if (quality === null) return null;
    const confidence = (evidenceConfidenceScore === null || evidenceConfidenceScore === undefined) ? 100 : evidenceConfidenceScore;
    const weight = question.weight || 1.0;
    return Math.round(quality * (confidence / 100) * weight);
  }

  function computeAdaptiveTierScore(questions, answers, evidenceConfidenceScore) {
    answers = answers || {};
    let sum = 0, weightTotal = 0, answered = 0;
    (questions || []).forEach(q => {
      const s = computeAdaptiveQuestionScore(q, answers[q.questionId], evidenceConfidenceScore);
      if (s === null) return;
      const weight = q.weight || 1.0;
      sum += s * weight;
      weightTotal += weight;
      answered++;
    });
    return { score: weightTotal > 0 ? Math.round(sum / weightTotal) : null, answered, total: (questions || []).length };
  }

  // ── (b) Category rollup ────────────────────────────────────────────
  // adaptiveScores (optional): map subAspectId -> 0-100 adaptive-question
  // score (from computeAdaptiveTierScore). When present for a sub-aspect,
  // blends 50/50 with the manual severityScore for rollup weighting only —
  // the manual severityScore itself (shown on the card/heatmap) is untouched.
  function computeCategoryRollup(category, aspectAnswers, dimensions, adaptiveScores) {
    const subAspectScores = category.subAspects.map(sa => {
      const severity = computeAspectSeverity(sa.id, aspectAnswers[sa.id], dimensions);
      const adaptive = adaptiveScores ? adaptiveScores[sa.id] : null;
      const finalScore = (adaptive !== null && adaptive !== undefined && severity.severityScore !== null)
        ? Math.round(severity.severityScore * 0.5 + adaptive * 0.5)
        : severity.severityScore;
      return Object.assign({ label: sa.label, finalScore }, severity);
    });
    let weightedSum = 0, weightTotal = 0;
    const trendCounts = { improving: 0, stable: 0, declining: 0, unknown: 0 };
    subAspectScores.forEach(s => {
      if (s.finalScore === null) return;
      const weight = s.materiality === 'double' ? 1.5 : 1.0;
      weightedSum += s.finalScore * weight;
      weightTotal += weight;
      if (s.trend && trendCounts[s.trend] !== undefined) trendCounts[s.trend]++;
    });
    const answered = subAspectScores.filter(s => s.severityScore !== null).length;
    const scored = subAspectScores.filter(s => s.severityScore !== null);
    const weakest = scored.length ? scored.reduce((a, b) => a.severityScore <= b.severityScore ? a : b) : null;
    const strongest = scored.length ? scored.reduce((a, b) => a.severityScore >= b.severityScore ? a : b) : null;
    return {
      categoryId: category.id,
      categoryLabel: category.label,
      categoryScore: weightTotal > 0 ? Math.round(weightedSum / weightTotal) : null,
      subAspectScores,
      answeredCount: answered,
      totalCount: subAspectScores.length,
      weakestSubAspect: weakest,
      strongestSubAspect: strongest,
      trendCounts
    };
  }

  function getEnvironmentalImpactBand(score) {
    if (score === null) return { band: '—', desc: 'No data yet', color: 'var(--text-muted)' };
    if (score >= 80) return { band: 'Strong', desc: 'Well-managed environmental footprint', color: 'var(--green)' };
    if (score >= 60) return { band: 'Adequate', desc: 'Generally controlled, gaps remain', color: 'var(--accent)' };
    if (score >= 40) return { band: 'Weak', desc: 'Material gaps across several aspects', color: 'var(--amber)' };
    return { band: 'Critical', desc: 'Severe, insufficiently mitigated impact', color: 'var(--red)' };
  }

  // ── (c) Environmental Impact Index ────────────────────────────────
  // materialityProfile is optional (backward compatible): when provided
  // (see materiality-client.js / backend/routers/materiality.py), it
  // supplies which categories/sub-aspects are applicable for the company's
  // industry and the dynamic, industry-driven weight for each applicable
  // category — replacing the equal-weighted default used when absent.
  function evidenceConfidenceToScore(dimensions, value) {
    if (!value) return null;
    const dim = (dimensions || []).find(d => d.key === 'evidenceConfidence');
    if (!dim) return null;
    const opt = dim.opts.find(o => o.value === value);
    return opt ? opt.score : null;
  }

  // Builds {subAspectId: adaptiveScore} for one category from the profile's
  // embedded adaptive questions + the user's aspectQuestionAnswers, using
  // each sub-aspect's own evidenceConfidence rating as the score multiplier.
  function buildAdaptiveScoresForCategory(profileCategory, aspectAnswers, aspectQuestionAnswers, dimensions) {
    if (!profileCategory || !aspectQuestionAnswers) return null;
    const scores = {};
    (profileCategory.subAspects || []).forEach(sa => {
      if (!sa.questions || !sa.questions.length) return;
      const evidenceScore = evidenceConfidenceToScore(dimensions, (aspectAnswers[sa.id] || {}).evidenceConfidence);
      const tierResult = computeAdaptiveTierScore(sa.questions, aspectQuestionAnswers[sa.id] || {}, evidenceScore);
      if (tierResult.score !== null) scores[sa.id] = tierResult.score;
    });
    return scores;
  }

  function computeEnvironmentalImpactIndex(categories, aspectAnswers, dimensions, materialityProfile, aspectQuestionAnswers) {
    const profileCategories = materialityProfile && materialityProfile.categories;

    const effectiveCategories = profileCategories
      ? categories
          .map(cat => {
            const pc = profileCategories.find(p => p.categoryId === cat.id);
            if (!pc || pc.applicable === false || !(pc.weightPct > 0)) return null;
            const applicableIds = new Set((pc.subAspects || []).filter(s => s.applicable).map(s => s.id));
            const subAspects = applicableIds.size
              ? cat.subAspects.filter(sa => applicableIds.has(sa.id))
              : cat.subAspects;
            return { cat: { ...cat, subAspects }, weightPct: pc.weightPct, profileCategory: pc };
          })
          .filter(Boolean)
      : categories.map(cat => ({ cat, weightPct: 100 / categories.length, profileCategory: null }));

    const rollups = effectiveCategories.map(ec => computeCategoryRollup(
      ec.cat, aspectAnswers, dimensions,
      buildAdaptiveScoresForCategory(ec.profileCategory, aspectAnswers, aspectQuestionAnswers, dimensions)
    ));
    const weights = effectiveCategories.map(ec => ec.weightPct);

    let weightedSum = 0, weightTotal = 0;
    rollups.forEach((r, i) => {
      if (r.categoryScore === null) return;
      weightedSum += r.categoryScore * weights[i];
      weightTotal += weights[i];
    });
    const overallIndex = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : null;

    const categoryScores = {};
    const categoryWeights = {};
    rollups.forEach((r, i) => { categoryScores[r.categoryId] = r.categoryScore; categoryWeights[r.categoryId] = weights[i]; });

    const totalAspects = effectiveCategories.reduce((s, ec) => s + ec.cat.subAspects.length, 0);
    const answeredAspects = rollups.reduce((s, r) => s + r.answeredCount, 0);
    return {
      overallIndex, categoryScores, categoryWeights, rollups,
      answeredAspects, totalAspects,
      band: getEnvironmentalImpactBand(overallIndex)
    };
  }

  // ── (d) Net Zero Confidence ────────────────────────────────────────
  function classifyNetZeroConfidence(inputs) {
    inputs = inputs || {};
    let score = 0;
    const drivers = [];

    if (inputs.targetExists) { score += 30; drivers.push({ factor: 'Net-zero target adopted', direction: '+', detail: 'A formal net-zero target with a target year has been declared.' }); }
    else { drivers.push({ factor: 'No net-zero target', direction: '-', detail: 'No formal net-zero commitment has been declared.' }); }

    if (inputs.sbtiScore) { score += 25 * (inputs.sbtiScore / 100); drivers.push({ factor: 'Science-based alignment', direction: inputs.sbtiScore >= 55 ? '+' : '-', detail: `Target methodology scores ${inputs.sbtiScore}/100 against SBTi-aligned criteria.` }); }

    if (inputs.transitionStrategyScore) { score += 20 * (inputs.transitionStrategyScore / 100); drivers.push({ factor: 'Transition strategy detail', direction: inputs.transitionStrategyScore >= 55 ? '+' : '-', detail: `Disclosed transition strategy narrative scores ${inputs.transitionStrategyScore}/100 on specificity and quantification.` }); }

    if (inputs.assuranceScore) { score += 15 * (inputs.assuranceScore / 100); drivers.push({ factor: 'GHG inventory assurance', direction: inputs.assuranceScore >= 55 ? '+' : '-', detail: `Emissions inventory assurance level scores ${inputs.assuranceScore}/100.` }); }

    if (inputs.scope12ReductionPct > 0) { score += 10; drivers.push({ factor: 'Demonstrated reduction', direction: '+', detail: `Absolute Scope 1+2 emissions have declined ${inputs.scope12ReductionPct}% since baseline.` }); }

    if (!inputs.scope3Reported) { score -= 15; drivers.push({ factor: 'Scope 3 not inventoried', direction: '-', detail: 'Scope 3 emissions have not been reported, leaving the target boundary incomplete.' }); }

    if (inputs.disclosureScore !== null && inputs.disclosureScore !== undefined && inputs.disclosureScore < 50) { score -= 10; drivers.push({ factor: 'Weak disclosure completeness', direction: '-', detail: 'TCFD/disclosure completeness score is below the threshold expected for a credible transition claim.' }); }

    if (inputs.climateCategoryTrend === 'declining' && inputs.targetExists) { score -= 10; drivers.push({ factor: 'Trend inconsistency', direction: '-', detail: 'A net-zero target is declared, but the Climate aspect category shows a declining trend — evidence of stated commitments outpacing actual performance.' }); }

    score = Math.max(0, Math.min(100, Math.round(score)));
    let band;
    if (score >= 80) band = 'Very High';
    else if (score >= 60) band = 'High';
    else if (score >= 40) band = 'Moderate';
    else if (score >= 20) band = 'Low';
    else band = 'Very Low';

    const positives = drivers.filter(d => d.direction === '+').map(d => d.detail);
    const negatives = drivers.filter(d => d.direction === '-').map(d => d.detail);
    const stripPeriod = s => s.replace(/\.\s*$/, '');
    let explanation = `Net Zero commitment is considered ${band === 'Very High' || band === 'High' ? 'Credible' : band === 'Moderate' ? 'Moderately Credible' : 'Not Yet Credible'}`;
    explanation += positives.length ? ` because ${stripPeriod(positives[0].charAt(0).toLowerCase() + positives[0].slice(1))}` : '';
    explanation += negatives.length ? (positives.length ? `, but ${stripPeriod(negatives[0].charAt(0).toLowerCase() + negatives[0].slice(1))}` : ` because ${stripPeriod(negatives[0].charAt(0).toLowerCase() + negatives[0].slice(1))}`) : '';
    explanation += '.';

    return { score, band, explanation, drivers };
  }

  // ── (e) Greenwashing Risk ──────────────────────────────────────────
  function classifyGreenwashingRisk(inputs, netZeroResult) {
    inputs = inputs || {};
    let score = 0;
    const flags = [];

    if (inputs.transitionStrategyScore >= 55 && inputs.climateEvidenceLowShare > 0.5) {
      score += 25;
      flags.push({ id: 'unsupported_claims', label: 'Unsupported claims', detail: 'Confident transition narrative is not backed by verified or audited evidence across most Climate aspects.', severity: 25 });
    }
    if (inputs.scope12ReductionPct > 0 && !inputs.scope12BaselineReported) {
      score += 25;
      flags.push({ id: 'no_baseline', label: 'No baseline', detail: 'A reduction percentage is claimed but absolute Scope 1/2 baseline emissions have not been disclosed.', severity: 25 });
    }
    if (inputs.offsetLanguageDetected && inputs.climateCategoryTrend !== 'improving') {
      score += 15;
      flags.push({ id: 'offset_heavy', label: 'Offset-heavy strategy', detail: 'Carbon-neutrality language is present alongside a flat or worsening emissions trend, suggesting reliance on offsets over actual reduction.', severity: 15 });
    }
    if (inputs.vaguePhraseCount >= 2) {
      score += 15;
      flags.push({ id: 'vague_target_language', label: 'Vague target language', detail: 'Disclosure text repeatedly uses non-committal language ("working towards", "plan to") instead of measurable commitments.', severity: 15 });
    }
    if (inputs.disclosureScore >= 70 && inputs.climateEvidenceLowShare > 0.5) {
      score += 15;
      flags.push({ id: 'inconsistent_disclosures', label: 'Inconsistent disclosures', detail: 'Formal disclosure completeness is high, but the underlying aspect evidence is mostly estimated or unsupported.', severity: 15 });
    }
    if (netZeroResult && (netZeroResult.band === 'Low' || netZeroResult.band === 'Very Low') && inputs.targetExists) {
      score += 20;
      flags.push({ id: 'net_zero_mismatch', label: 'Net Zero confidence mismatch', detail: `A net-zero target is publicly declared, but the underlying Net Zero Confidence classification is ${netZeroResult.band}.`, severity: 20 });
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    let band;
    if (score >= 75) band = 'Critical';
    else if (score >= 50) band = 'High';
    else if (score >= 25) band = 'Moderate';
    else band = 'Low';

    return { score, band, flags, reasons: flags.map(f => f.detail) };
  }

  // ── (f) AI Intelligence summary (pure aggregation, no new heuristics) ──
  function generateAIIntelligenceSummary(eiiResult, netZeroResult, gwResult, categoryRollups) {
    const allSubAspects = [];
    (categoryRollups || []).forEach(r => {
      r.subAspectScores.forEach(s => { if (s.severityScore !== null) allSubAspects.push(Object.assign({ categoryLabel: r.categoryLabel }, s)); });
    });

    const byResidualDesc = [...allSubAspects].sort((a, b) => b.residualSeverity - a.residualSeverity);
    const topEnvironmentalRisks = byResidualDesc.slice(0, 5);

    const improving = allSubAspects.filter(s => s.trend === 'improving').sort((a, b) => b.severityScore - a.severityScore);
    const declining = allSubAspects.filter(s => s.trend === 'declining').sort((a, b) => a.severityScore - b.severityScore);
    const topPositiveImpacts = improving.slice(0, 5);
    const topNegativeImpacts = declining.slice(0, 5);

    const doubleMaterial = allSubAspects.filter(s => s.materiality === 'double').sort((a, b) => b.residualSeverity - a.residualSeverity);
    const mostMaterialAspects = doubleMaterial.slice(0, 5);
    const leastMaterialAspects = [...allSubAspects].sort((a, b) => a.residualSeverity - b.residualSeverity).slice(0, 5);

    const scoredCategories = (categoryRollups || []).filter(r => r.categoryScore !== null);
    const strongestCategory = scoredCategories.length ? scoredCategories.reduce((a, b) => a.categoryScore >= b.categoryScore ? a : b) : null;
    const weakestCategory = scoredCategories.length ? scoredCategories.reduce((a, b) => a.categoryScore <= b.categoryScore ? a : b) : null;

    const priorityActions = [];
    byResidualDesc.slice(0, 3).forEach(s => {
      priorityActions.push(`Address ${s.label} (${s.categoryLabel}) — residual severity ${s.residualSeverity}/100, mitigation currently insufficient.`);
    });
    if (netZeroResult && (netZeroResult.band === 'Low' || netZeroResult.band === 'Very Low' || netZeroResult.band === 'Moderate')) {
      priorityActions.push('Strengthen net-zero target credibility: close Scope 3 boundary gaps and pursue third-party target validation.');
    }
    if (gwResult && gwResult.band !== 'Low') {
      priorityActions.push('Remediate greenwashing risk flags before external disclosure — see Greenwashing Risk reasons.');
    }

    return {
      topEnvironmentalRisks, topPositiveImpacts, topNegativeImpacts,
      mostMaterialAspects, leastMaterialAspects,
      strongestCategory, weakestCategory,
      netZeroReadinessSummary: netZeroResult ? netZeroResult.explanation : 'Insufficient data to assess net-zero readiness.',
      greenwashingSummary: gwResult && gwResult.reasons.length ? gwResult.reasons.join(' ') : 'No material greenwashing risk indicators detected from current disclosures.',
      priorityActions: priorityActions.slice(0, 5)
    };
  }

  // ── (g) Framework compliance (computed live, never hardcoded) ─────
  function computeFrameworkCompliance(categoryId, categoryRollup, frameworkCrosswalk, evidenceRank) {
    const rows = (frameworkCrosswalk || {})[categoryId] || [];
    // Use the category's weakest sub-aspect evidence as the conservative
    // basis for compliance — a category is only as strong as its worst-evidenced aspect.
    const evidences = (categoryRollup ? categoryRollup.subAspectScores : [])
      .map(s => s.evidenceConfidence).filter(Boolean);
    let categoryRank = null;
    if (evidences.length) {
      categoryRank = Math.min(...evidences.map(e => evidenceRank[e] !== undefined ? evidenceRank[e] : 0));
    }

    return rows.map(row => {
      const requiredRank = evidenceRank[row.minEvidenceForCompliance] !== undefined ? evidenceRank[row.minEvidenceForCompliance] : 3;
      let complianceStatus, gapDescription, recommendation;
      if (categoryRank === null) {
        complianceStatus = 'Not Assessed';
        gapDescription = 'No aspect ratings recorded yet for this category.';
        recommendation = `Complete the ${row.framework} — related aspect ratings to enable a compliance determination.`;
      } else {
        const delta = categoryRank - requiredRank;
        if (delta >= 0) {
          complianceStatus = 'Compliant';
          gapDescription = 'Evidence on file meets or exceeds the required standard.';
          recommendation = 'Maintain current evidence quality; monitor for framework updates.';
        } else if (delta === -1) {
          complianceStatus = 'Partial';
          gapDescription = `Evidence confidence is one level below what ${row.framework} (${row.clause}) expects.`;
          recommendation = `Upgrade supporting evidence toward "${row.minEvidenceForCompliance.replace('_', ' ')}" — e.g. ${row.evidenceRequired}.`;
        } else {
          complianceStatus = 'Gap';
          gapDescription = `Evidence confidence falls materially short of the ${row.framework} (${row.clause}) requirement.`;
          recommendation = `Prioritize obtaining: ${row.evidenceRequired}.`;
        }
      }
      return Object.assign({}, row, { complianceStatus, gapDescription, recommendation });
    });
  }

  window.ASPECT_ENGINE = {
    computeAspectSeverity, computeCategoryRollup, computeEnvironmentalImpactIndex,
    getEnvironmentalImpactBand, classifyNetZeroConfidence, classifyGreenwashingRisk,
    generateAIIntelligenceSummary, computeFrameworkCompliance,
    computeAdaptiveQuestionScore, computeAdaptiveTierScore
  };
})();
