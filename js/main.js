/* ═══════════════════════════════════════════════════════
   main.js — Initialisation et orchestration
   ═══════════════════════════════════════════════════════ */
'use strict';

// ─── LECTURE DES INPUTS GLOBAUX ───────────────────────────────────

function readGlobalInputs() {
  const g = id => {
    const el = document.getElementById(id);
    return el ? (parseFloat(el.value) || 0) : 0;
  };
  return {
    netSalary:         g('netSalary'),
    totalCapital:      g('totalCapital'),
    maxContribution:   g('maxContribution'),
    currentRent:       g('currentRent'),
    debtRatio:         g('debtRatio'),
    inflationRate:     g('inflationRate'),
    propertyGrowthRate:g('propertyGrowthRate'),
    savingsReturnRate: g('savingsReturnRate'),
    simYears:          Math.max(1, Math.round(g('simYears'))),
  };
}

// ─── SYNCHRONISATION DES SLIDERS ──────────────────────────────────

function initGlobalSliders() {
  const pairs = [
    ['debtRatio',          'debtRatioVal',  v => v + '%'],
    ['inflationRate',      'inflationVal',  v => parseFloat(v).toFixed(1) + '%'],
    ['propertyGrowthRate', 'growthVal',     v => parseFloat(v).toFixed(1) + '%'],
    ['savingsReturnRate',  'savingsVal',    v => parseFloat(v).toFixed(1) + '%'],
    ['simYears',           'simYearsVal',   v => v + ' ans'],
  ];
  for (const [inputId, spanId, formatter] of pairs) {
    const input = document.getElementById(inputId);
    const span  = document.getElementById(spanId);
    if (!input || !span) continue;
    const update = () => { span.textContent = formatter(input.value); };
    update();
    input.addEventListener('input', update);
  }
}

// ─── RENDU ANALYSE LOCATAIRE ──────────────────────────────────────

function renderTenantAnalysis(initialSavings, purchaseMonthly, purchaseCharges, currentRent, inflationRate, savingsReturnRate, simYears, tenantSeries) {
  const container = document.getElementById('tenantAnalysis');
  if (!container) return;

  if (!tenantSeries || tenantSeries.length === 0) { container.innerHTML = ''; return; }

  const row    = (label, val, cls = '') => `<div class="dr"><span>${label}</span><span class="${cls}">${val}</span></div>`;
  const sub    = (label, val, cls = '') => `<div class="dr sub"><span>${label}</span><span class="${cls}">${val}</span></div>`;
  const tot    = (label, val, cls = '') => `<div class="dr tot"><span>${label}</span><span class="${cls}">${val}</span></div>`;
  const sep    = ()                     => `<div class="dr-sep"></div>`;
  const sec    = (title, body)          => `<div class="ds"><p class="dt">${title}</p>${body}</div>`;
  const fmtPct = v => v.toFixed(2) + '%';
  const fmtAns = v => v + ' an' + (v > 1 ? 's' : '');

  const monthlyRate    = savingsReturnRate / 100 / 12;
  const totalMonths    = simYears * 12;
  const purchaseTotal  = purchaseMonthly + purchaseCharges;
  const diffYear1      = Math.max(0, purchaseTotal - currentRent);
  const finalRent      = currentRent * Math.pow(1 + inflationRate / 100, simYears);
  const diffFinal      = Math.max(0, purchaseTotal - finalRent);
  const finalWealth    = tenantSeries[tenantSeries.length - 1] || 0;
  const capitalAlone   = initialSavings * Math.pow(1 + monthlyRate, totalMonths);
  const capitalGain    = capitalAlone - initialSavings;
  const flowContrib    = Math.max(0, finalWealth - capitalAlone);

  // ── KPI ──────────────────────────────────────────────────────────
  const synthese = `
    <div class="ds-kpi">
      <div class="kpi">
        <span class="kpi-sub">Capital initial placé</span>
        <span class="kpi-val" style="color:#818cf8">${fmt(initialSavings)}</span>
      </div>
      <div class="kpi">
        <span class="kpi-sub">Loyer actuel</span>
        <span class="kpi-val">${fmt(currentRent)}<span class="kpi-unit">/mois</span></span>
      </div>
      <div class="kpi">
        <span class="kpi-sub">Épargne mensuelle (an 1)</span>
        <span class="kpi-val">${diffYear1 > 0 ? fmt(diffYear1) + '<span class="kpi-unit">/mois</span>' : '—'}</span>
      </div>
      <div class="kpi">
        <span class="kpi-sub">Patrimoine à ${fmtAns(simYears)}</span>
        <span class="kpi-val" style="color:#818cf8">${fmt(finalWealth)}</span>
      </div>
    </div>`;

  // ── Section 1 : Capital de départ ─────────────────────────────────
  const capitalSection = sec('Capital de départ — Intérêts composés',
    row('Capital initial investi', fmt(initialSavings)) +
    row('Rendement annuel', fmtPct(savingsReturnRate)) +
    sub('Taux mensuel équivalent : ' + fmtPct(savingsReturnRate / 12) + ' / mois', '') +
    sep() +
    sub('Formule : ' + fmt(initialSavings) + ' × (1 + ' + fmtPct(savingsReturnRate / 12) + ')^' + totalMonths + ' mois', '') +
    tot('Capital seul après ' + fmtAns(simYears), fmt(capitalAlone), 'text-blue-300') +
    sub('Gain intérêts composés : +' + fmt(capitalGain), '', 'text-emerald-400')
  );

  // ── Section 2 : Flux mensuels ─────────────────────────────────────
  let flowBody =
    row('Mensualité crédit (scénario de référence)', fmt(purchaseMonthly) + '/mois') +
    (purchaseCharges > 0 ? sub('+ Charges propriétaire (copropriété, taxe, travaux)', fmt(purchaseCharges) + '/mois') : '') +
    tot('Total coût mensuel propriétaire', fmt(purchaseTotal) + '/mois') +
    sep() +
    row('− Loyer (an 1)', '−' + fmt(currentRent) + '/mois', 'text-orange-300');

  if (diffYear1 > 0) {
    flowBody +=
      tot('= Différentiel investi mensuellement (an 1)', '+' + fmt(diffYear1) + '/mois', 'text-emerald-400') +
      sub('Réinvesti chaque mois au taux ' + fmtPct(savingsReturnRate) + '/an', '') +
      sep() +
      row('Évolution du loyer (inflation ' + fmtPct(inflationRate) + '/an)', '') +
      sub('Loyer à l\'an 1 : ' + fmt(currentRent) + '/mois', '') +
      sub('Loyer à l\'an ' + simYears + ' : ' + fmt(finalRent) + '/mois', '', 'text-orange-300') +
      (diffFinal > 0
        ? sub('Différentiel à l\'an ' + simYears + ' : +' + fmt(diffFinal) + '/mois (réduit par l\'inflation)', '', 'text-yellow-400')
        : sub('À terme, le loyer dépasse les charges propriétaire → différentiel nul', '', 'text-yellow-400'));
  } else {
    flowBody +=
      tot('= Différentiel', '0 €/mois', 'text-gray-500') +
      sub('Loyer actuel ≥ charges propriétaire → aucune épargne supplémentaire', '') +
      sub('Le locataire capitalise uniquement via son apport initial', '');
  }
  const flowSection = sec('Flux mensuels — Différentiel vs scénario propriétaire', flowBody);

  // ── Section 3 : Décomposition ──────────────────────────────────────
  const decompSection = sec('Décomposition du patrimoine final',
    row('Capital initial revalorisé (intérêts composés)', fmt(capitalAlone), 'text-blue-300') +
    (flowContrib > 0
      ? row('+ Accumulation des versements mensuels', '+' + fmt(flowContrib), 'text-emerald-400')
      : '') +
    tot('= Patrimoine locataire total à ' + fmtAns(simYears), fmt(finalWealth), 'text-indigo-300')
  );

  // ── Section 4 : Jalons ─────────────────────────────────────────────
  const milestoneYears = [5, 10, 15, 20, 25, 30].filter(y => y <= simYears && tenantSeries[y - 1] !== undefined);
  let milestonesSection = '';
  if (milestoneYears.length > 1) {
    const msBody = milestoneYears.map(y =>
      y < simYears
        ? row('Patrimoine à ' + fmtAns(y), fmt(tenantSeries[y - 1]), 'text-indigo-300')
        : tot('Patrimoine à ' + fmtAns(y), fmt(tenantSeries[y - 1]), 'text-indigo-300')
    ).join('');
    milestonesSection = sec('Évolution du patrimoine locataire', msBody);
  }

  container.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-sm font-semibold text-white">Scénario locataire — Détail du calcul</h2>
      <span class="badge" style="background:#1e1b4b; color:#818cf8;">Location (courbe pointillée)</span>
    </div>
    ${synthese}${capitalSection}${flowSection}${decompSection}${milestonesSection}`;
}

// ─── ORCHESTRATION PRINCIPALE ─────────────────────────────────────

function recalculate() {
  try {
    const globalInputs = readGlobalInputs();

    // Calcul de tous les scénarios
    const computed = scenarioList.map(sc => {
      const scValues = readScenarioValues(sc);
      const result   = calcScenario(scValues, globalInputs);
      return { sc, scValues, result };
    });

    // Mise à jour des résultats dans le DOM
    for (const { sc, result } of computed) {
      renderScenarioResults(sc.id, result);
    }

    // Scénario locataire : référence = premier scénario ayant un résultat
    const ref = computed.find(c => c.result !== null);
    const tenantSeries = ref
      ? buildTenantWealthSeries(
          globalInputs.maxContribution,
          ref.result.totalMonthly,
          ref.result.totalChargesMonthly + ref.result.taxMonthly,
          globalInputs.currentRent,
          globalInputs.inflationRate,
          globalInputs.savingsReturnRate,
          globalInputs.simYears
        )
      : [];

    // Mise à jour du graphique
    const wealthSeriesArray = computed.map(c => c.result?.wealthSeries || []);
    const names             = computed.map(c => c.scValues.name);
    updateChart(wealthSeriesArray, names, tenantSeries, globalInputs.simYears);

    // Année de croisement (breakeven)
    const breakevenLines = [];
    for (const { scValues, result } of computed) {
      if (!result) continue;
      for (let i = 0; i < Math.min(result.wealthSeries.length, tenantSeries.length); i++) {
        if (result.wealthSeries[i] >= tenantSeries[i]) {
          breakevenLines.push(`${scValues.name} dépasse Location à l'an ${i + 1}`);
          break;
        }
      }
    }
    const beEl = document.getElementById('breakevenInfo');
    if (beEl) {
      beEl.textContent = breakevenLines.length > 0
        ? breakevenLines.join(' · ')
        : "L'investissement locataire domine sur toute la période simulée.";
    }

    // Détail calcul scénario locataire
    renderTenantAnalysis(
      globalInputs.maxContribution,
      ref ? ref.result.totalMonthly : 0,
      ref ? ref.result.totalChargesMonthly + ref.result.taxMonthly : 0,
      globalInputs.currentRent,
      globalInputs.inflationRate,
      globalInputs.savingsReturnRate,
      globalInputs.simYears,
      tenantSeries
    );

  } catch (e) {
    console.error('[Simulateur] Erreur de calcul :', e);
  }
}

// ─── INITIALISATION ───────────────────────────────────────────────

function init() {
  initChart();
  initGlobalSliders();

  // Crée un scénario de base par défaut
  addScenario();

  // Bouton d'ajout de scénario
  document.getElementById('addScenarioBtn')
    ?.addEventListener('click', () => addScenario());

  // Recalcule à chaque changement des inputs globaux
  document.querySelectorAll('#globalInputs input').forEach(el => {
    el.addEventListener('input', recalculate);
  });
}

document.addEventListener('DOMContentLoaded', init);
