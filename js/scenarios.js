/* ═══════════════════════════════════════════════════════
   scenarios.js — État, rendu et calcul des scénarios
   ═══════════════════════════════════════════════════════ */
'use strict';

// ─── ÉTAT ─────────────────────────────────────────────────────────

let scenarioList = [];
let _scCounter   = 0;
let _lnCounter   = 0;

const LOAN_DEFAULTS = {
  banque_ancien: { rate: 3.5, duration: 20, insurance: 0.3, agencyPct: 5, guaranteePct: 1, fileFee: 500, brokerFee: 2000 },
  banque_neuf:   { rate: 3.3, duration: 20, insurance: 0.3, agencyPct: 0, guaranteePct: 1, fileFee: 500, brokerFee: 0 },
  ptz:           { amount: 75000, duration: 20, deferred: 0 },
  al:            { amount: 30000, rate: 1.0, duration: 20, deferred: 120 },
};

// ─── HELPERS INTERNES ──────────────────────────────────────────────

function newScId() { return `sc${_scCounter++}`; }
function newLnId() { return `ln${_lnCounter++}`; }

/** Lit une valeur numérique depuis le DOM (retourne fallback si absent). */
function domNum(id, fallback) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  const v = parseFloat(el.value);
  return isNaN(v) ? fallback : v;
}

function createLoan(type, scType) {
  const id = newLnId();
  if (type === 'banque') {
    const defs = scType === 'neuf' ? LOAN_DEFAULTS.banque_neuf : LOAN_DEFAULTS.banque_ancien;
    return { id, type: 'banque', ...defs };
  }
  if (type === 'ptz') return { id, type: 'ptz', ...LOAN_DEFAULTS.ptz };
  if (type === 'al')  return { id, type: 'al',  ...LOAN_DEFAULTS.al  };
  return null;
}

function createDefaultScenario(type) {
  const id   = newScId();
  const isNew = type === 'neuf';
  return {
    id,
    name:   `Scénario ${String.fromCharCode(65 + scenarioList.length)}`,
    type,
    dpe:    isNew ? 'A' : 'C',
    loans:  [createLoan('banque', type)],
    charges: {
      coOwnership:  150,
      homeInsurance: 30,
      worksPct:     isNew ? 0.5 : 0.75,
      taxMonths:    1,
    },
  };
}

// ─── PERSISTANCE DES VALEURS (DOM → état) ─────────────────────────

function saveCurrentValues(scId) {
  const sc = scenarioList.find(s => s.id === scId);
  if (!sc) return;

  // Type
  const typeEl = document.getElementById(`type_${scId}`);
  if (typeEl) sc.type = typeEl.checked ? 'neuf' : 'ancien';

  // DPE
  const dpeActive = document.querySelector(`#dpeGroup_${scId} .dpe-btn.active`);
  if (dpeActive) sc.dpe = dpeActive.dataset.dpe;

  // Nom
  const nameEl = document.getElementById(`name_${scId}`);
  if (nameEl) sc.name = nameEl.value || sc.name;

  // Charges
  sc.charges.coOwnership  = domNum(`co_${scId}`,  sc.charges.coOwnership);
  sc.charges.homeInsurance= domNum(`hi_${scId}`,  sc.charges.homeInsurance);
  sc.charges.worksPct     = domNum(`wp_${scId}`,  sc.charges.worksPct);
  sc.charges.taxMonths    = domNum(`tm_${scId}`,  sc.charges.taxMonths);

  // Prêts
  for (const loan of sc.loans) {
    const lid = loan.id;
    if (loan.type === 'banque') {
      loan.rate        = domNum(`rate_${lid}`,   loan.rate);
      loan.duration    = domNum(`dur_${lid}`,    loan.duration);
      loan.insurance   = domNum(`ins_${lid}`,    loan.insurance);
      loan.agencyPct   = domNum(`agency_${lid}`, loan.agencyPct   ?? 0);
      loan.guaranteePct= domNum(`guar_${lid}`,   loan.guaranteePct?? 1);
      loan.fileFee     = domNum(`file_${lid}`,   loan.fileFee     ?? 500);
      loan.brokerFee   = domNum(`broker_${lid}`, loan.brokerFee   ?? 0);
    } else if (loan.type === 'ptz') {
      loan.amount   = domNum(`amount_${lid}`, loan.amount);
      loan.duration = domNum(`dur_${lid}`,    loan.duration);
      loan.deferred = domNum(`defer_${lid}`,  loan.deferred);
    } else if (loan.type === 'al') {
      loan.amount   = domNum(`amount_${lid}`, loan.amount);
      loan.rate     = domNum(`rate_${lid}`,   loan.rate);
      loan.duration = domNum(`dur_${lid}`,    loan.duration);
      loan.deferred = domNum(`defer_${lid}`,  loan.deferred);
    }
  }
}

function saveAllCurrentValues() {
  for (const sc of scenarioList) saveCurrentValues(sc.id);
}

// ─── OPÉRATIONS STRUCTURELLES (globales pour onclick HTML) ────────

function addScenario(type = 'ancien') {
  const sc = createDefaultScenario(type);
  scenarioList.push(sc);
  renderAllScenarios();
  recalculate();
}

function removeScenario(scId) {
  if (scenarioList.length <= 1) return;
  saveAllCurrentValues();
  scenarioList = scenarioList.filter(s => s.id !== scId);
  renderAllScenarios();
  recalculate();
}

function addLoan(scId, loanType) {
  saveAllCurrentValues();
  const sc = scenarioList.find(s => s.id === scId);
  if (!sc) return;
  const loan = createLoan(loanType, sc.type);
  if (loan) sc.loans.push(loan);
  renderAllScenarios();
  recalculate();
}

function removeLoan(scId, loanId) {
  saveAllCurrentValues();
  const sc = scenarioList.find(s => s.id === scId);
  if (!sc || sc.loans.length <= 1) return;
  sc.loans = sc.loans.filter(l => l.id !== loanId);
  renderAllScenarios();
  recalculate();
}

// ─── RENDU HTML ───────────────────────────────────────────────────

function renderAllScenarios() {
  const container = document.getElementById('scenariosContainer');
  if (!container) return;
  container.innerHTML = scenarioList.map(sc => renderScenarioCard(sc)).join('');

  // Wire les boutons DPE (toggleable)
  for (const sc of scenarioList) {
    const group = document.getElementById(`dpeGroup_${sc.id}`);
    if (!group) continue;
    group.querySelectorAll('.dpe-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.dpe-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Affiche la note uniquement si DPE A + Neuf
        const typeEl = document.getElementById(`type_${sc.id}`);
        const isNew  = typeEl ? typeEl.checked : sc.type === 'neuf';
        const noteEl = document.getElementById(`dpeNote_${sc.id}`);
        if (noteEl) noteEl.textContent = btn.dataset.dpe === 'A' && isNew ? '(−0,1% sur taux banque)' : '';
        recalculate();
      });
    });

    // Wire le toggle Ancien/Neuf
    const typeEl = document.getElementById(`type_${sc.id}`);
    if (typeEl) {
      typeEl.addEventListener('change', () => {
        saveAllCurrentValues();
        sc.type = typeEl.checked ? 'neuf' : 'ancien';
        // Mise à jour de la note DPE sans reset de la sélection
        const dpeActive = document.querySelector(`#dpeGroup_${sc.id} .dpe-btn.active`);
        const currentDpe = dpeActive ? dpeActive.dataset.dpe : sc.dpe;
        const noteEl = document.getElementById(`dpeNote_${sc.id}`);
        if (noteEl) noteEl.textContent = currentDpe === 'A' && sc.type === 'neuf' ? '(−0,1% sur taux banque)' : '';
        recalculate();
      });
    }
  }
}

/** Génère le HTML complet d'une carte scénario. */
function renderScenarioCard(sc) {
  const colorIdx = scenarioList.indexOf(sc) % SCENARIO_COLORS.length;
  const color    = SCENARIO_COLORS[colorIdx];
  const isNew    = sc.type === 'neuf';

  const dpeOptions = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

  const dpeColor = {
    A: 'bg-green-800 text-green-200',
    B: 'bg-green-700 text-green-100',
    C: 'bg-lime-700 text-lime-100',
    D: 'bg-yellow-700 text-yellow-100',
    E: 'bg-orange-700 text-orange-100',
    F: 'bg-red-700 text-red-100',
    G: 'bg-red-900 text-red-200',
  };

  const notaryBadge = isNew
    ? '<span class="badge bg-emerald-900 text-emerald-300">Frais notaire 3%</span>'
    : '<span class="badge bg-amber-900 text-amber-300">Frais notaire 7,5%</span>';

  const removeBtn = scenarioList.length > 1
    ? `<button onclick="removeScenario('${sc.id}')" class="remove-btn" title="Supprimer ce scénario">×</button>`
    : '';

  return `
<div class="card scenario-card" id="scenarioCard_${sc.id}" style="border-left-color:${color}">

  <!-- ── En-tête ── -->
  <div class="flex items-center gap-2 mb-4 flex-wrap">
    <input type="text" id="name_${sc.id}" value="${escHtml(sc.name)}"
      class="scenario-name-input" oninput="recalculate()" />
    <div class="flex items-center gap-1.5 ml-1">
      <span class="text-xs text-amber-400 font-medium">Ancien</span>
      <label class="toggle-switch">
        <input type="checkbox" id="type_${sc.id}" ${isNew ? 'checked' : ''} />
        <div class="toggle-track"></div>
      </label>
      <span class="text-xs text-emerald-400 font-medium">Neuf</span>
    </div>
    ${notaryBadge}
    <div class="ml-auto">${removeBtn}</div>
  </div>

  <!-- ── DPE ── -->
  <div class="mb-4">
    <label class="label">Classe DPE <span id="dpeNote_${sc.id}" class="text-emerald-400 text-xs">${isNew && sc.dpe === 'A' ? '(−0,1% sur taux banque)' : ''}</span></label>
    <div class="flex gap-1.5 flex-wrap" id="dpeGroup_${sc.id}">
      ${dpeOptions.map(d => `
        <button class="dpe-btn ${dpeColor[d]} ${sc.dpe === d ? 'active' : ''}" data-dpe="${d}">${d}</button>
      `).join('')}
    </div>
  </div>

  <!-- ── Prêts ── -->
  <div class="space-y-3 mb-3" id="loansContainer_${sc.id}">
    ${sc.loans.map(loan => renderLoanCard(loan, sc)).join('')}
  </div>

  <!-- ── Boutons ajout prêt ── -->
  <div class="flex gap-2 mb-4 flex-wrap">
    <button onclick="addLoan('${sc.id}','banque')" class="btn-add btn-add-banque">+ Prêt Banque</button>
    <button onclick="addLoan('${sc.id}','ptz')"   class="btn-add btn-add-ptz">+ PTZ</button>
    <button onclick="addLoan('${sc.id}','al')"    class="btn-add btn-add-al">+ Action Logement</button>
  </div>

  <!-- ── Charges récurrentes ── -->
  <div class="border-t border-gray-700 pt-3 mb-4">
    <p class="section-title" style="margin-bottom:10px">Charges récurrentes</p>
    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="label">Copropriété (€/mois)</label>
        <input type="number" id="co_${sc.id}" class="input-field" value="${sc.charges.coOwnership}"
          min="0" step="10" oninput="recalculate()" />
      </div>
      <div>
        <label class="label">Assurance hab. (€/mois)</label>
        <input type="number" id="hi_${sc.id}" class="input-field" value="${sc.charges.homeInsurance}"
          min="0" step="5" oninput="recalculate()" />
      </div>
      <div>
        <label class="label">Provision travaux (%/an)</label>
        <input type="number" id="wp_${sc.id}" class="input-field" value="${sc.charges.worksPct}"
          min="0" max="3" step="0.05" oninput="recalculate()" />
      </div>
      <div>
        <label class="label">Taxe foncière : <span id="tmVal_${sc.id}" class="text-blue-400 font-semibold">${sc.charges.taxMonths}</span>&nbsp;mois/an</label>
        <input type="range" id="tm_${sc.id}" min="0" max="3" step="0.25" value="${sc.charges.taxMonths}"
          oninput="document.getElementById('tmVal_${sc.id}').textContent=this.value;recalculate()" />
      </div>
    </div>
  </div>

  <!-- ── Résultats détaillés ── -->
  <div class="bg-gray-950 rounded-xl p-3" id="output_${sc.id}">
    <p class="text-gray-600 text-xs text-center py-2">Calcul en cours…</p>
  </div>

</div>`;
}

/** Génère le HTML d'un prêt selon son type. */
function renderLoanCard(loan, sc) {
  const sid     = sc.id;
  const lid     = loan.id;
  const canRemove = sc.loans.length > 1;
  const removeBtn = canRemove
    ? `<button onclick="removeLoan('${sid}','${lid}')" class="remove-btn text-sm ml-auto">× Retirer</button>`
    : '';

  if (loan.type === 'banque') {
    const isNew = sc.type === 'neuf';
    return `
<div class="loan-card loan-banque">
  <div class="flex items-center gap-2 mb-3">
    <span class="text-xs font-semibold text-amber-300 uppercase tracking-wider">Prêt Bancaire</span>
    ${removeBtn}
  </div>
  <div class="grid grid-cols-2 gap-2">
    <div>
      <label class="label">Taux&nbsp;: <span id="rateVal_${lid}" class="text-amber-400 font-semibold">${loan.rate}%</span></label>
      <input type="range" id="rate_${lid}" min="0.5" max="8" step="0.05" value="${loan.rate}"
        oninput="document.getElementById('rateVal_${lid}').textContent=parseFloat(this.value).toFixed(2)+'%';recalculate()" />
    </div>
    <div>
      <label class="label">Durée (ans)</label>
      <input type="number" id="dur_${lid}" class="input-field" value="${loan.duration}" min="5" max="30" oninput="recalculate()" />
    </div>
    <div>
      <label class="label">Assurance&nbsp;: <span id="insVal_${lid}" class="text-amber-400 font-semibold">${loan.insurance}%</span></label>
      <input type="range" id="ins_${lid}" min="0.05" max="1" step="0.01" value="${loan.insurance}"
        oninput="document.getElementById('insVal_${lid}').textContent=parseFloat(this.value).toFixed(2)+'%';recalculate()" />
    </div>
    <div>
      <label class="label">Garantie (%)</label>
      <input type="number" id="guar_${lid}" class="input-field" value="${loan.guaranteePct ?? 1}" min="0" max="3" step="0.1" oninput="recalculate()" />
    </div>
    ${isNew ? '' : `
    <div>
      <label class="label">Frais agence (%)</label>
      <input type="number" id="agency_${lid}" class="input-field" value="${loan.agencyPct ?? 5}" min="0" max="15" step="0.5" oninput="recalculate()" />
    </div>
    <div>
      <label class="label">Courtier (€)</label>
      <input type="number" id="broker_${lid}" class="input-field" value="${loan.brokerFee ?? 2000}" min="0" step="100" oninput="recalculate()" />
    </div>`}
    <div>
      <label class="label">Frais dossier (€)</label>
      <input type="number" id="file_${lid}" class="input-field" value="${loan.fileFee ?? 500}" min="0" step="100" oninput="recalculate()" />
    </div>
  </div>
</div>`;
  }

  if (loan.type === 'ptz') {
    return `
<div class="loan-card loan-ptz">
  <div class="flex items-center gap-2 mb-3">
    <span class="text-xs font-semibold text-blue-300 uppercase tracking-wider">PTZ — Prêt à Taux Zéro</span>
    ${removeBtn}
  </div>
  <div class="grid grid-cols-2 gap-2">
    <div>
      <label class="label">Montant PTZ (€)</label>
      <input type="number" id="amount_${lid}" class="input-field" value="${loan.amount}" min="0" step="1000" oninput="recalculate()" />
    </div>
    <div>
      <label class="label">Durée (ans)</label>
      <input type="number" id="dur_${lid}" class="input-field" value="${loan.duration}" min="5" max="25" oninput="recalculate()" />
    </div>
    <div class="col-span-2">
      <label class="label">Différé&nbsp;: <span id="deferVal_${lid}" class="text-blue-400 font-semibold">${loan.deferred}&nbsp;mois</span></label>
      <input type="range" id="defer_${lid}" min="0" max="120" step="12" value="${loan.deferred}"
        oninput="document.getElementById('deferVal_${lid}').textContent=this.value+'\u00a0mois';recalculate()" />
    </div>
  </div>
</div>`;
  }

  if (loan.type === 'al') {
    return `
<div class="loan-card loan-al">
  <div class="flex items-center gap-2 mb-3">
    <span class="text-xs font-semibold text-purple-300 uppercase tracking-wider">Action Logement</span>
    ${removeBtn}
  </div>
  <div class="grid grid-cols-2 gap-2">
    <div>
      <label class="label">Montant AL (€)</label>
      <input type="number" id="amount_${lid}" class="input-field" value="${loan.amount}" min="0" step="1000" oninput="recalculate()" />
    </div>
    <div>
      <label class="label">Taux&nbsp;: <span id="rateVal_${lid}" class="text-purple-400 font-semibold">${loan.rate}%</span></label>
      <input type="range" id="rate_${lid}" min="0" max="3" step="0.1" value="${loan.rate}"
        oninput="document.getElementById('rateVal_${lid}').textContent=parseFloat(this.value).toFixed(1)+'%';recalculate()" />
    </div>
    <div>
      <label class="label">Durée (ans)</label>
      <input type="number" id="dur_${lid}" class="input-field" value="${loan.duration}" min="5" max="25" oninput="recalculate()" />
    </div>
    <div>
      <label class="label">Différé&nbsp;: <span id="deferVal_${lid}" class="text-purple-400 font-semibold">${loan.deferred}&nbsp;mois</span></label>
      <input type="range" id="defer_${lid}" min="0" max="120" step="12" value="${loan.deferred}"
        oninput="document.getElementById('deferVal_${lid}').textContent=this.value+'\u00a0mois';recalculate()" />
    </div>
  </div>
</div>`;
  }

  return '';
}

/** Échappe les caractères HTML pour éviter les injections dans les value= */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── LECTURE DES VALEURS DEPUIS LE DOM ────────────────────────────

/** Lit les valeurs actuelles d'un scénario depuis le DOM. */
function readScenarioValues(sc) {
  const sid  = sc.id;
  const typeEl = document.getElementById(`type_${sid}`);
  const type   = typeEl ? (typeEl.checked ? 'neuf' : 'ancien') : sc.type;

  const dpeActive = document.querySelector(`#dpeGroup_${sid} .dpe-btn.active`);
  const dpe       = dpeActive ? dpeActive.dataset.dpe : sc.dpe;

  const nameEl = document.getElementById(`name_${sid}`);
  const name   = nameEl ? (nameEl.value || sc.name) : sc.name;

  const charges = {
    coOwnership:   domNum(`co_${sid}`,  sc.charges.coOwnership),
    homeInsurance: domNum(`hi_${sid}`,  sc.charges.homeInsurance),
    worksPct:      domNum(`wp_${sid}`,  sc.charges.worksPct),
    taxMonths:     domNum(`tm_${sid}`,  sc.charges.taxMonths),
  };

  const loans = sc.loans.map(loan => readLoanValues(loan));
  return { id: sid, name, type, dpe, loans, charges };
}

function readLoanValues(loan) {
  const lid = loan.id;
  if (loan.type === 'banque') {
    return {
      id: lid, type: 'banque',
      rate:        domNum(`rate_${lid}`,   loan.rate),
      duration:    domNum(`dur_${lid}`,    loan.duration),
      insurance:   domNum(`ins_${lid}`,    loan.insurance),
      agencyPct:   domNum(`agency_${lid}`, loan.agencyPct   ?? 0),
      guaranteePct:domNum(`guar_${lid}`,   loan.guaranteePct?? 1),
      fileFee:     domNum(`file_${lid}`,   loan.fileFee     ?? 500),
      brokerFee:   domNum(`broker_${lid}`, loan.brokerFee   ?? 0),
    };
  }
  if (loan.type === 'ptz') {
    return {
      id: lid, type: 'ptz',
      amount:   domNum(`amount_${lid}`, loan.amount),
      duration: domNum(`dur_${lid}`,    loan.duration),
      deferred: domNum(`defer_${lid}`,  loan.deferred),
    };
  }
  if (loan.type === 'al') {
    return {
      id: lid, type: 'al',
      amount:   domNum(`amount_${lid}`, loan.amount),
      rate:     domNum(`rate_${lid}`,   loan.rate),
      duration: domNum(`dur_${lid}`,    loan.duration),
      deferred: domNum(`defer_${lid}`,  loan.deferred),
    };
  }
  return { ...loan };
}

// ─── CALCUL D'UN SCÉNARIO ─────────────────────────────────────────

/**
 * Calcule tous les indicateurs d'un scénario à partir de ses paramètres
 * et des inputs globaux.
 *
 * @returns {object} { V, bankPrincipal, ptzAmount, alAmount, totalMonthly,
 *   totalChargesMonthly, taxMonthly, remainingIncome, creditCost, realCost,
 *   wealthSeries, schedule } ou null si données insuffisantes.
 */
function calcScenario(scValues, globalInputs) {
  const { type, dpe, loans, charges } = scValues;
  const isNew = type === 'neuf';

  // Trouve le prêt bancaire principal (premier de type 'banque')
  const bankLoan = loans.find(l => l.type === 'banque');
  if (!bankLoan) return null;

  // Bonus DPE A sur le neuf : −0,1%
  let bankRate = bankLoan.rate;
  if (isNew && dpe === 'A') bankRate = Math.max(0.1, bankRate - 0.1);

  const bankMonths  = Math.round(bankLoan.duration) * 12;
  const agencyPct   = isNew ? 0 : (bankLoan.agencyPct ?? 5);
  const brokerFee   = isNew ? 0 : (bankLoan.brokerFee ?? 2000);
  const fixedFees   = (bankLoan.fileFee ?? 500) + brokerFee;

  // Prêts aidés (PTZ, AL)
  const ptzLoan = loans.find(l => l.type === 'ptz');
  const alLoan  = loans.find(l => l.type === 'al');

  const ptzAmount  = ptzLoan ? ptzLoan.amount : 0;
  const ptzMonths  = ptzLoan ? Math.round(ptzLoan.duration) * 12 : 0;
  const ptzDeferred= ptzLoan ? Math.round(ptzLoan.deferred) : 0;
  const ptzMonthlyPmt = ptzAmount > 0 && ptzMonths > 0 ? ptzAmount / ptzMonths : 0;

  const alAmount   = alLoan ? alLoan.amount : 0;
  const alRate     = alLoan ? alLoan.rate : 0;
  const alMonths   = alLoan ? Math.round(alLoan.duration) * 12 : 0;
  const alDeferred = alLoan ? Math.round(alLoan.deferred) : 0;
  const alMonthlyPmt = alAmount > 0 && alMonths > 0 ? monthlyPayment(alAmount, alRate, alMonths) : 0;

  // Tableau des prêts aidés pour le lissage
  const auxLoans = [];
  if (ptzAmount > 0) {
    auxLoans.push({
      principal: ptzAmount, rate: 0, monthlyPmt: ptzMonthlyPmt,
      startMonth: ptzDeferred, endMonth: ptzDeferred + ptzMonths,
    });
  }
  if (alAmount > 0) {
    auxLoans.push({
      principal: alAmount, rate: alRate, monthlyPmt: alMonthlyPmt,
      startMonth: alDeferred, endMonth: alDeferred + alMonths,
    });
  }

  // Calcul itératif (3 passes) pour convergence avec la provision travaux
  // Capacité de remboursement bancaire = salaire × taux d'endettement uniquement.
  // Les charges annexes (copropriété, taxe foncière, travaux…) n'entrent PAS dans
  // ce calcul — elles réduisent seulement le reste à vivre.
  const avail = availableForLoan(globalInputs.netSalary, globalInputs.debtRatio);

  // avail est constant (indépendant de V) → un seul calcul suffit
  const smoothed = computeSmoothedSchedule({
    targetMonthly: avail,
    bankRate, bankMonths,
    borrowerInsurancePct: bankLoan.insurance,
    auxLoans,
  });
  const maxTotalLoan = smoothed.bankPrincipal + ptzAmount + alAmount;
  const V = findMaxPropertyPrice(
    globalInputs.maxContribution, maxTotalLoan, isNew,
    agencyPct, bankLoan.guaranteePct ?? 1, fixedFees
  );

  const bankPrincipal = smoothed.bankPrincipal;
  const totalMonthly  = avail;

  // Charges et reste à vivre
  const worksMonthly        = charges.worksPct / 100 * V / 12;
  const taxMonthly          = totalMonthly * charges.taxMonths / 12;
  const totalChargesMonthly = charges.coOwnership + charges.homeInsurance + worksMonthly;
  const remainingIncome     = globalInputs.netSalary - totalMonthly - totalChargesMonthly - taxMonthly;

  // Coût total du crédit
  const bankPaid  = smoothed.schedule.reduce((s, e) => s + e.bankPmt + e.insMonthly, 0);
  const alPaid    = alMonthlyPmt * alMonths;
  const totalPaid = bankPaid + alPaid + ptzAmount;
  const creditCost= Math.max(0, totalPaid - (bankPrincipal + ptzAmount + alAmount));
  const realCost  = realCostPresentValue(totalMonthly, bankMonths, globalInputs.inflationRate);

  // Épargne résiduelle (capital non utilisé comme apport)
  const residualSavings = Math.max(0, globalInputs.totalCapital - globalInputs.maxContribution);

  // Étend l'échéancier jusqu'à la durée de simulation
  const simMonths  = globalInputs.simYears * 12;
  const extSchedule = [...smoothed.schedule];
  const lastEntry  = extSchedule[extSchedule.length - 1] || { totalBalance: 0 };
  while (extSchedule.length < simMonths) {
    extSchedule.push({ ...lastEntry, bankBalance: 0, totalBalance: 0, bankPmt: 0, insMonthly: 0, otherPmt: 0 });
  }

  const wealthSeries = buildPurchaseWealthSeries(
    V, extSchedule, residualSavings,
    globalInputs.propertyGrowthRate, globalInputs.savingsReturnRate, globalInputs.simYears
  );

  // ─── Données détaillées ───────────────────────────────────────────

  // Frais d'acquisition
  const nfDisplay = notaryFees(V, isNew);
  const afDisplay = isNew ? 0 : agencyFees(V, agencyPct);
  const gfDisplay = guaranteeFees(bankPrincipal, bankLoan.guaranteePct ?? 1);
  const acquisition = {
    propertyPrice: V,
    notaryFees:    nfDisplay,
    agencyFees:    afDisplay,
    guaranteeFees: gfDisplay,
    fileFee:       bankLoan.fileFee ?? 500,
    brokerFee:     isNew ? 0 : (bankLoan.brokerFee ?? 2000),
    totalFees:     nfDisplay + afDisplay + gfDisplay + fixedFees,
    totalCost:     V + nfDisplay + afDisplay + gfDisplay + fixedFees,
    apport:        globalInputs.maxContribution,
    totalBorrowed: bankPrincipal + ptzAmount + alAmount,
  };

  // Budget mensuel
  const monthly = {
    coOwnership:   charges.coOwnership,
    homeInsurance: charges.homeInsurance,
    works:         worksMonthly,
    tax:           taxMonthly,
    debtRatioPct:  totalMonthly / Math.max(1, globalInputs.netSalary) * 100,
  };

  // Analyse prêt bancaire
  const bankPayments      = smoothed.schedule.map(e => e.bankPmt + e.insMonthly);
  const bankTotalPaid     = bankPayments.reduce((a, b) => a + b, 0);
  const bankMonthlyIns    = bankPrincipal * bankLoan.insurance / 100 / 12;
  const bankTotalIns      = bankMonthlyIns * bankMonths;
  const bankTotalInterest = Math.max(0, bankTotalPaid - bankPrincipal - bankTotalIns);
  const bankRealCostPV    = realCostVariablePV(bankPayments, globalInputs.inflationRate);
  const bankInflationGain = Math.max(0, bankTotalPaid - bankRealCostPV);
  const lastBankPmt       = bankPayments[bankMonths - 1] || bankPayments[0] || 0;
  const bankAnalysis = {
    principal:              bankPrincipal,
    rate:                   bankRate,
    duration:               Math.round(bankLoan.duration),
    months:                 bankMonths,
    avgAmortMonthly:        bankMonths > 0 ? bankTotalPaid / bankMonths - bankMonthlyIns : 0,
    monthlyInsurance:       bankMonthlyIns,
    totalPaid:              bankTotalPaid,
    totalInterest:          bankTotalInterest,
    totalInsurance:         bankTotalIns,
    realCostPV:             bankRealCostPV,
    inflationGain:          bankInflationGain,
    lastMonthlyInTodayEuros: lastBankPmt / Math.pow(1 + globalInputs.inflationRate / 100, Math.round(bankLoan.duration)),
    realRate:               bankRate - globalInputs.inflationRate,
    inflationRate:          globalInputs.inflationRate,
  };

  // Analyse PTZ
  const ptzAnalysis = ptzAmount > 0 ? {
    principal:  ptzAmount,
    duration:   Math.round(ptzLoan.duration),
    months:     ptzMonths,
    deferred:   ptzDeferred,
    monthlyPmt: ptzMonthlyPmt,
    economy:    Math.max(0, monthlyPayment(ptzAmount, bankRate, ptzMonths) * ptzMonths - ptzAmount),
  } : null;

  // Analyse Action Logement
  const alTotalPaid     = alMonthlyPmt * alMonths;
  const alTotalInterest = Math.max(0, alTotalPaid - alAmount);
  const alAnalysis = alAmount > 0 ? {
    principal:     alAmount,
    rate:          alRate,
    duration:      Math.round(alLoan.duration),
    months:        alMonths,
    deferred:      alDeferred,
    monthlyPmt:    alMonthlyPmt,
    totalPaid:     alTotalPaid,
    totalInterest: alTotalInterest,
    economy:       Math.max(0, monthlyPayment(alAmount, bankRate, alMonths) * alMonths - alTotalPaid),
  } : null;

  // Prévision patrimoniale
  const finalPropertyValue = V * Math.pow(1 + globalInputs.propertyGrowthRate / 100, globalInputs.simYears);
  const finalDebt          = extSchedule[extSchedule.length - 1]?.totalBalance || 0;
  const finalSavings       = residualSavings * Math.pow(1 + globalInputs.savingsReturnRate / 100, globalInputs.simYears);
  const forecast = {
    simYears:           globalInputs.simYears,
    finalPropertyValue,
    propertyGain:       finalPropertyValue - V,
    finalDebt,
    finalSavings,
    residualSavings,
    finalWealth:        wealthSeries[wealthSeries.length - 1] || 0,
  };

  return {
    V, bankPrincipal, ptzAmount, alAmount, totalMonthly,
    totalChargesMonthly, taxMonthly, remainingIncome,
    creditCost, realCost, wealthSeries, schedule: extSchedule,
    acquisition, monthly, bankAnalysis, ptzAnalysis, alAnalysis, forecast,
  };
}

// ─── RENDU DES RÉSULTATS ──────────────────────────────────────────

function renderScenarioResults(scId, result) {
  const container = document.getElementById(`output_${scId}`);
  if (!container) return;

  if (!result) {
    container.innerHTML = '<p class="text-gray-600 text-xs text-center py-3">Données insuffisantes</p>';
    return;
  }

  const { V, totalMonthly, remainingIncome,
          acquisition, monthly, bankAnalysis,
          ptzAnalysis, alAnalysis, forecast } = result;

  // Couleur du scénario (pour accent sur le budget)
  const scIdx  = scenarioList.findIndex(s => s.id === scId);
  const accent = SCENARIO_COLORS[scIdx % SCENARIO_COLORS.length] || '#f59e0b';

  // Couleur reste à vivre
  const riColor = remainingIncome >= 800 ? '#34d399' : remainingIncome >= 400 ? '#fbbf24' : '#f87171';

  // Helpers locaux
  const row  = (label, val, cls = '')       => `<div class="dr"><span>${label}</span><span class="${cls}">${val}</span></div>`;
  const sub  = (label, val, cls = '')       => `<div class="dr sub"><span>${label}</span><span class="${cls}">${val}</span></div>`;
  const tot  = (label, val, cls = '')       => `<div class="dr tot"><span>${label}</span><span class="${cls}">${val}</span></div>`;
  const sep  = ()                           => `<div class="dr-sep"></div>`;
  const sec  = (title, body)               => `<div class="ds"><p class="dt">${title}</p>${body}</div>`;
  const fmtPct = v => v.toFixed(2) + '%';
  const fmtAns = v => v + ' an' + (v > 1 ? 's' : '');

  // ── 1. Synthèse rapide ──────────────────────────────────────────
  const synthese = `
    <div class="ds-kpi">
      <div class="kpi">
        <span class="kpi-sub">Prix du bien</span>
        <span class="kpi-val" style="color:${accent}">${fmt(V)}</span>
      </div>
      <div class="kpi">
        <span class="kpi-sub">Mensualité totale</span>
        <span class="kpi-val">${fmt(totalMonthly)}<span class="kpi-unit">/mois</span></span>
      </div>
      <div class="kpi">
        <span class="kpi-sub">Reste à vivre</span>
        <span class="kpi-val" style="color:${riColor}">${fmt(remainingIncome)}<span class="kpi-unit">/mois</span></span>
      </div>
      <div class="kpi">
        <span class="kpi-sub">Taux endettement</span>
        <span class="kpi-val">${monthly.debtRatioPct.toFixed(1)}<span class="kpi-unit">%</span></span>
      </div>
    </div>`;

  // ── 2. Frais d'acquisition ──────────────────────────────────────
  const acqBody =
    row('Prix du bien', fmt(acquisition.propertyPrice), 'text-white font-semibold') +
    (acquisition.notaryFees   > 0 ? sub(`+ Frais de notaire (${acquisition.notaryFees / V * 100 | 0}%)`, fmt(acquisition.notaryFees), 'text-red-300') : '') +
    (acquisition.agencyFees   > 0 ? sub('+ Frais d\'agence', fmt(acquisition.agencyFees), 'text-red-300') : '') +
    (acquisition.guaranteeFees> 0 ? sub('+ Frais de garantie', fmt(acquisition.guaranteeFees), 'text-red-300') : '') +
    (acquisition.fileFee      > 0 ? sub('+ Frais de dossier', fmt(acquisition.fileFee), 'text-red-300') : '') +
    (acquisition.brokerFee    > 0 ? sub('+ Courtier', fmt(acquisition.brokerFee), 'text-red-300') : '') +
    tot('= Coût total acquisition', fmt(acquisition.totalCost)) +
    sep() +
    sub('− Apport personnel', '−' + fmt(acquisition.apport), 'text-blue-300') +
    tot('= Total emprunté', fmt(acquisition.totalBorrowed), 'text-blue-300') +
    (acquisition.totalBorrowed > 0 ? sub('Levier (emprunt / apport)', (acquisition.totalBorrowed / Math.max(1, acquisition.apport)).toFixed(1) + '×') : '');
  const acqSection = sec('Frais d\'acquisition', acqBody);

  // ── 3. Budget mensuel ───────────────────────────────────────────
  const totalMensuel = totalMonthly + monthly.coOwnership + monthly.homeInsurance + monthly.works + monthly.tax;
  const budgetBody =
    row('Mensualité crédit (lissée)', fmt(totalMonthly) + '/mois') +
    (monthly.coOwnership  > 0 ? sub('+ Copropriété', fmt(monthly.coOwnership) + '/mois') : '') +
    (monthly.homeInsurance> 0 ? sub('+ Assurance habitation', fmt(monthly.homeInsurance) + '/mois') : '') +
    (monthly.works        > 0 ? sub('+ Provision travaux', fmt(monthly.works) + '/mois') : '') +
    (monthly.tax          > 0 ? sub('+ Taxe foncière (proratisée)', fmt(monthly.tax) + '/mois') : '') +
    tot('= Total mensuel (crédit + charges)', fmt(totalMensuel) + '/mois') +
    sep() +
    row('Salaire net', fmt(monthly.debtRatioPct > 0 ? totalMonthly / (monthly.debtRatioPct / 100) : 0) + '/mois') +
    row('Taux d\'endettement effectif (crédit seul)', fmtPct(monthly.debtRatioPct),
        monthly.debtRatioPct > 35 ? 'text-red-400' : monthly.debtRatioPct > 30 ? 'text-yellow-400' : 'text-emerald-400') +
    tot('Reste à vivre', fmt(remainingIncome) + '/mois', remainingIncome >= 800 ? 'text-emerald-400' : remainingIncome >= 400 ? 'text-yellow-400' : 'text-red-400');
  const budgetSection = sec('Budget mensuel', budgetBody);

  // ── 4. Analyse prêt bancaire ────────────────────────────────────
  const ba = bankAnalysis;
  const bankBody =
    row('Capital emprunté', fmt(ba.principal)) +
    row('Taux nominal / Durée', fmtPct(ba.rate) + ' / ' + fmtAns(ba.duration)) +
    sep() +
    sub('Mensualité d\'amortissement (moy.)', fmt(ba.avgAmortMonthly) + '/mois') +
    sub('Assurance emprunteur', fmt(ba.monthlyInsurance) + '/mois') +
    tot('Mensualité banque totale (moy.)', fmt(ba.avgAmortMonthly + ba.monthlyInsurance) + '/mois') +
    sep() +
    row('Coût total nominal', fmt(ba.totalPaid), 'text-red-400') +
    sub('dont intérêts purs', fmt(ba.totalInterest), 'text-red-300') +
    sub('dont assurance emprunteur', fmt(ba.totalInsurance), 'text-orange-300') +
    sub('Ratio intérêts / capital', (ba.totalInterest / Math.max(1, ba.principal) * 100).toFixed(1) + '%', 'text-red-300') +
    sep() +
    row('Coût réel actualisé (€ d\'aujourd\'hui)', fmt(ba.realCostPV), 'text-orange-400') +
    tot('Gain grâce à l\'inflation', '+' + fmt(ba.inflationGain), 'text-emerald-400') +
    sub('L\'inflation efface ' + (ba.inflationGain / Math.max(1, ba.totalPaid) * 100).toFixed(1) + '% du coût nominal', '') +
    sep() +
    row('Taux d\'intérêt réel (nominal − inflation)', fmtPct(ba.realRate),
        ba.realRate < 0 ? 'text-emerald-400' : ba.realRate < 1 ? 'text-yellow-400' : 'text-orange-400') +
    row('Votre dernière mensualité en € d\'aujourd\'hui', fmt(ba.lastMonthlyInTodayEuros) + '/mois', 'text-blue-300') +
    sub('(pouvoir d\'achat réel de votre versement dans ' + fmtAns(ba.duration) + ')', '');
  const bankSection = sec(`Analyse — Prêt Bancaire (${fmtPct(ba.rate)}, ${fmtAns(ba.duration)})`, bankBody);

  // ── 5. Analyse PTZ ─────────────────────────────────────────────
  let ptzSection = '';
  if (ptzAnalysis) {
    const pa = ptzAnalysis;
    const ptzBody =
      row('Capital PTZ', fmt(pa.principal)) +
      row('Taux / Durée', '0% / ' + fmtAns(pa.duration)) +
      (pa.deferred > 0 ? row('Différé', pa.deferred + ' mois') : '') +
      row('Mensualité', fmt(pa.monthlyPmt) + '/mois') +
      row('Coût total (intérêts = 0)', fmt(pa.principal), 'text-emerald-400') +
      sep() +
      tot('Économie vs emprunt au taux banque (' + fmtPct(bankAnalysis.rate) + ')', '+' + fmt(pa.economy), 'text-emerald-400') +
      sub('Correspond aux intérêts que vous n\'aurez pas à payer', '');
    ptzSection = sec('Analyse — PTZ (0%, ' + fmtAns(pa.duration) + (pa.deferred > 0 ? ', différé ' + pa.deferred + ' mois' : '') + ')', ptzBody);
  }

  // ── 6. Analyse Action Logement ─────────────────────────────────
  let alSection = '';
  if (alAnalysis) {
    const aa = alAnalysis;
    const alBody =
      row('Capital Action Logement', fmt(aa.principal)) +
      row('Taux / Durée', fmtPct(aa.rate) + ' / ' + fmtAns(aa.duration)) +
      (aa.deferred > 0 ? row('Différé', aa.deferred + ' mois') : '') +
      row('Mensualité', fmt(aa.monthlyPmt) + '/mois') +
      row('Coût total nominal', fmt(aa.totalPaid), 'text-red-400') +
      sub('dont intérêts', fmt(aa.totalInterest), 'text-red-300') +
      sep() +
      tot('Économie vs emprunt au taux banque (' + fmtPct(bankAnalysis.rate) + ')', '+' + fmt(aa.economy), 'text-emerald-400');
    alSection = sec('Analyse — Action Logement (' + fmtPct(aa.rate) + ', ' + fmtAns(aa.duration) + (aa.deferred > 0 ? ', différé ' + aa.deferred + ' mois' : '') + ')', alBody);
  }

  // ── 7. Prévision patrimoniale ───────────────────────────────────
  const fo = forecast;
  const forecastBody =
    row('Épargne résiduelle (capital hors apport)', fmt(fo.residualSavings)) +
    sub('→ après ' + fmtAns(fo.simYears) + ' au taux épargne', fmt(fo.finalSavings), 'text-blue-300') +
    sep() +
    row('Prix du bien aujourd\'hui', fmt(V)) +
    sub('→ valeur dans ' + fmtAns(fo.simYears) + ' (+' + fmt(fo.propertyGain) + ')', fmt(fo.finalPropertyValue), 'text-white') +
    (fo.finalDebt > 0
      ? sub('− Capital restant dû', '−' + fmt(fo.finalDebt), 'text-red-300')
      : sub('Prêt entièrement remboursé ✓', '', 'text-emerald-400')) +
    sub('− Frais de revente estimés (6%)', '−' + fmt(fo.finalPropertyValue * 0.06), 'text-red-300') +
    (fo.finalSavings > 0 ? sub('+ Épargne résiduelle revalorisée', '+' + fmt(fo.finalSavings), 'text-blue-300') : '') +
    tot('Patrimoine net estimé à ' + fmtAns(fo.simYears), fmt(fo.finalWealth), 'text-emerald-400');
  const forecastSection = sec('Prévision patrimoniale à ' + fmtAns(fo.simYears), forecastBody);

  container.innerHTML = synthese + acqSection + budgetSection + bankSection + ptzSection + alSection + forecastSection;
}
