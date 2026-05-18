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
  const netSalary    = g('netSalary');
  const investmentPct= g('investmentPct') || 70;
  return {
    netSalary,
    totalCapital:      g('totalCapital'),
    maxContribution:   g('maxContribution'),
    currentRent:       g('currentRent'),
    inflationRate:     g('inflationRate'),
    propertyGrowthRate:g('propertyGrowthRate'),
    savingsReturnRate: g('savingsReturnRate'),
    simYears:          Math.max(1, Math.round(g('simYears'))),
    decote:            g('decote'),
    investmentPct,
    monthlyBudget:     netSalary * investmentPct / 100,
  };
}

// ─── SYNCHRONISATION DES SLIDERS ──────────────────────────────────

const SLIDER_PAIRS = [
  ['investmentPct',      'investmentPctVal', v => v + '%'],
  ['inflationRate',      'inflationVal',     v => parseFloat(v).toFixed(1) + '%'],
  ['propertyGrowthRate', 'growthVal',        v => parseFloat(v).toFixed(1) + '%'],
  ['savingsReturnRate',  'savingsVal',       v => parseFloat(v).toFixed(1) + '%'],
  ['simYears',           'simYearsVal',      v => v + ' ans'],
  ['decote',             'decoteVal',        v => parseInt(v) + '%'],
];

/** Met à jour l'affichage des labels de sliders sans déclencher d'événements. */
function syncSliderDisplays() {
  for (const [inputId, spanId, formatter] of SLIDER_PAIRS) {
    const input = document.getElementById(inputId);
    const span  = document.getElementById(spanId);
    if (input && span) span.textContent = formatter(input.value);
  }
}

function initGlobalSliders() {
  for (const [inputId, spanId, formatter] of SLIDER_PAIRS) {
    const input = document.getElementById(inputId);
    const span  = document.getElementById(spanId);
    if (!input || !span) continue;
    const update = () => { span.textContent = formatter(input.value); };
    update();
    input.addEventListener('input', update);
  }
}

// ─── SÉRIALISATION / PARTAGE ──────────────────────────────────────

/**
 * Sérialise l'état complet (inputs globaux + scénarios) en Base64.
 * Format interne compact versionné (v:3, rétro-compatible avec v:1/v:2).
 */
function serializeState() {
  saveAllCurrentValues();
  const g = readGlobalInputs();
  const data = {
    v: 4,
    // Tableau ordonné pour compacité — slot 8 = investmentPct
    g: [g.netSalary, g.totalCapital, g.maxContribution, g.currentRent,
        g.inflationRate, g.propertyGrowthRate, g.savingsReturnRate, g.simYears,
        g.investmentPct],
    sc: scenarioList.map(sc => {
      if (sc.type === 'location') return { n: sc.name, t: 'location' };
      return {
        n:  sc.name,
        t:  sc.type,
        d:  sc.dpe,
        dr: sc.debtRatio ?? 35,
        ch: [sc.charges.coOwnership, sc.charges.homeInsurance, sc.charges.worksPct, sc.charges.taxMonths],
        del: sc.moveInDelay ?? 0,
        ln: sc.loans.map(l => {
          if (l.type === 'banque') return ['b', l.rate, l.duration, l.insurance, l.agencyPct ?? 0, l.guaranteePct ?? 1, l.fileFee ?? 500, l.brokerFee ?? 0];
          if (l.type === 'ptz')   return ['p', l.amount, l.duration, l.deferred];
          if (l.type === 'al')    return ['a', l.amount, l.rate, l.duration, l.deferred];
          if (l.type === 'don')   return ['d', l.amount, l.taxPct ?? 0];
          return [];
        }),
      };
    }),
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

/**
 * Restaure l'état depuis une chaîne Base64 (hash de l'URL).
 * Retourne true si réussi, false sinon.
 */
function deserializeState(encoded) {
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    if (!data || ![1, 2, 3, 4].includes(data.v) || !Array.isArray(data.g) || !Array.isArray(data.sc)) return false;

    // Format global selon la version :
    //   v:1/2/3 → [netSalary, totalCapital, maxContribution, currentRent, debtRatio, inflationRate, propertyGrowthRate, savingsReturnRate, simYears, (investmentPct si v:3)]
    //   v:4     → [netSalary, totalCapital, maxContribution, currentRent, inflationRate, propertyGrowthRate, savingsReturnRate, simYears, investmentPct]
    let legacyDebtRatio;
    let g;
    if (data.v === 4) {
      g = {
        netSalary:         data.g[0], totalCapital:    data.g[1], maxContribution: data.g[2],
        currentRent:       data.g[3], inflationRate:   data.g[4], propertyGrowthRate: data.g[5],
        savingsReturnRate: data.g[6], simYears:        data.g[7], investmentPct:   data.g[8] ?? 70,
      };
    } else {
      legacyDebtRatio = data.g[4];
      g = {
        netSalary:         data.g[0], totalCapital:    data.g[1], maxContribution: data.g[2],
        currentRent:       data.g[3], inflationRate:   data.g[5], propertyGrowthRate: data.g[6],
        savingsReturnRate: data.g[7], simYears:        data.g[8], investmentPct:   data.g[9] ?? 70,
      };
    }

    const inputMap = {
      netSalary: g.netSalary, totalCapital: g.totalCapital, maxContribution: g.maxContribution,
      currentRent: g.currentRent, inflationRate: g.inflationRate,
      propertyGrowthRate: g.propertyGrowthRate, savingsReturnRate: g.savingsReturnRate,
      simYears: g.simYears, investmentPct: g.investmentPct,
    };
    for (const [id, val] of Object.entries(inputMap)) {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.value = val;
    }

    // Met à jour l'affichage des labels de sliders
    syncSliderDisplays();

    // Reconstruit et rend les scénarios (legacyDebtRatio injecté dans chaque scénario d'achat)
    loadScenariosFromData(data.sc, legacyDebtRatio);

    // Calcule tout
    recalculate();
    return true;
  } catch (e) {
    console.error('[Simulateur] Lien de partage invalide :', e);
    return false;
  }
}

/** Sérialise, met à jour le hash de l'URL et copie le lien dans le presse-papier. */
function copyShareLink() {
  const encoded = serializeState();
  const url = location.origin + location.pathname + '#' + encoded;
  history.replaceState(null, '', '#' + encoded);

  const btn = document.getElementById('shareBtn');
  const showCopied = () => {
    if (!btn) return;
    btn.textContent = 'Lien copié !';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Partager'; btn.classList.remove('copied'); }, 2500);
  };

  navigator.clipboard.writeText(url).then(showCopied).catch(() => {
    // Fallback pour les contextes sans clipboard API (fichier local, HTTP)
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
    showCopied();
  });
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

    // Mise à jour du graphique
    const wealthSeriesArray = computed.map(c => c.result?.wealthSeries || []);
    const names             = computed.map(c => c.scValues.name);
    const types             = computed.map(c => c.scValues.type);
    updateChart(wealthSeriesArray, names, types, globalInputs.simYears);

    // Année de croisement : compare chaque scénario d'achat au premier scénario Location
    const locationIdx = computed.findIndex(c => c.scValues.type === 'location' && c.result);
    const beEl = document.getElementById('breakevenInfo');
    if (beEl) {
      if (locationIdx === -1) {
        beEl.textContent = '';
      } else {
        const locSeries = computed[locationIdx].result.wealthSeries;
        const locName   = computed[locationIdx].scValues.name;
        const lines = [];
        computed.forEach((c, i) => {
          if (i === locationIdx || !c.result || c.scValues.type === 'location') return;
          const s = c.result.wealthSeries;
          for (let k = 0; k < Math.min(s.length, locSeries.length); k++) {
            if (s[k] >= locSeries[k]) {
              lines.push(`${c.scValues.name} dépasse ${locName} à l'an ${k + 1}`);
              break;
            }
          }
        });
        beEl.textContent = lines.length > 0
          ? lines.join(' · ')
          : `Aucun scénario d'achat ne dépasse ${locName} sur la période simulée.`;
      }
    }
  } catch (e) {
    console.error('[Simulateur] Erreur de calcul :', e);
  }
}

// ─── INITIALISATION ───────────────────────────────────────────────

function init() {
  initChart();
  initGlobalSliders();

  // Bouton de partage
  document.getElementById('shareBtn')
    ?.addEventListener('click', copyShareLink);

  // Bouton d'ajout de scénario
  document.getElementById('addScenarioBtn')
    ?.addEventListener('click', () => addScenario());

  // Recalcule à chaque changement des inputs globaux
  document.querySelectorAll('#globalInputs input').forEach(el => {
    el.addEventListener('input', recalculate);
  });

  // Chargement depuis un lien partagé (hash URL) ou scénario par défaut
  const hash = location.hash.slice(1);
  if (!hash || !deserializeState(hash)) {
    addScenario();
  }
}

document.addEventListener('DOMContentLoaded', init);
