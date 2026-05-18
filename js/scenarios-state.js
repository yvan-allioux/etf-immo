/* ═══════════════════════════════════════════════════════
   scenarios-state.js — État, défauts, persistance DOM, chargement
   ═══════════════════════════════════════════════════════ */
'use strict';

// ─── ÉTAT ─────────────────────────────────────────────────────────

let scenarioList = [];
let _scCounter   = 0;
let _lnCounter   = 0;

const LOAN_DEFAULTS = {
  banque_ancien: { rate: 3.5, duration: 20, insurance: 0.3, agencyPct: 5, guaranteePct: 1, fileFee: 500, brokerFee: 2000 },
  banque_neuf:   { rate: 3.3, duration: 20, insurance: 0.3, agencyPct: 0, guaranteePct: 1, fileFee: 500, brokerFee: 0 },
  ptz:           { amount: 75000, duration: 20, deferred: 10 },
  al:            { amount: 30000, rate: 1.0, duration: 20, deferred: 0 },
  don:           { amount: 50000, taxPct: 0 },
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
  if (type === 'don') return { id, type: 'don', ...LOAN_DEFAULTS.don };
  return null;
}

function createDefaultScenario(type) {
  const id    = newScId();
  const name  = `Scénario ${String.fromCharCode(65 + scenarioList.length)}`;
  if (type === 'location') {
    return { id, name, type: 'location' };
  }
  const isNew = type === 'neuf';
  return {
    id,
    name,
    type,
    dpe:    isNew ? 'A' : 'C',
    debtRatio: 35,
    loans:  [createLoan('banque', type)],
    charges: {
      coOwnership:  150,
      homeInsurance: 30,
      worksPct:     isNew ? 0.5 : 0.75,
      taxMonths:    1,
    },
    moveInDelay: 0,
  };
}

// ─── PERSISTANCE DES VALEURS (DOM → état) ─────────────────────────

function saveCurrentValues(scId) {
  const sc = scenarioList.find(s => s.id === scId);
  if (!sc) return;

  // Type (sélecteur 3-états Ancien/Neuf/Location)
  const typeActive = document.querySelector(`#typeGroup_${scId} .type-btn.active`);
  if (typeActive) sc.type = typeActive.dataset.type;

  // Nom
  const nameEl = document.getElementById(`name_${scId}`);
  if (nameEl) sc.name = nameEl.value || sc.name;

  if (sc.type === 'location') return;

  // DPE
  const dpeActive = document.querySelector(`#dpeGroup_${scId} .dpe-btn.active`);
  if (dpeActive) sc.dpe = dpeActive.dataset.dpe;

  // Taux d'endettement
  sc.debtRatio = domNum(`dr_${scId}`, sc.debtRatio ?? 35);

  // Charges
  sc.charges.coOwnership  = domNum(`co_${scId}`,  sc.charges.coOwnership);
  sc.charges.homeInsurance= domNum(`hi_${scId}`,  sc.charges.homeInsurance);
  sc.charges.worksPct     = domNum(`wp_${scId}`,  sc.charges.worksPct);
  sc.charges.taxMonths    = domNum(`tm_${scId}`,  sc.charges.taxMonths);
  sc.moveInDelay          = domNum(`delay_${scId}`, sc.moveInDelay ?? 0);

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
    } else if (loan.type === 'don') {
      loan.amount = domNum(`amount_${lid}`, loan.amount);
      loan.taxPct = domNum(`taxPct_${lid}`, loan.taxPct ?? 0);
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

// ─── CHARGEMENT DEPUIS DONNÉES SÉRIALISÉES ────────────────────────

/**
 * Reconstruit scenarioList depuis des données désérialisées.
 * Appelé par deserializeState() dans main.js lors du chargement d'un lien partagé.
 *
 * @param {Array}  scenariosData     - tableau de scénarios sérialisés
 * @param {number} [legacyDebtRatio] - debtRatio global des versions ≤ v:3 à
 *   propager aux scénarios d'achat qui n'ont pas de `dr` propre
 */
function loadScenariosFromData(scenariosData, legacyDebtRatio) {
  scenarioList.length = 0;
  _scCounter = 0;
  _lnCounter = 0;

  for (const sd of scenariosData) {
    if (sd.t === 'location') {
      scenarioList.push({ id: newScId(), name: sd.n, type: 'location' });
      continue;
    }
    const sc = {
      id:   newScId(),
      name: sd.n,
      type: sd.t,
      dpe:  sd.d,
      debtRatio: sd.dr ?? legacyDebtRatio ?? 35,
      charges: {
        coOwnership:   sd.ch[0],
        homeInsurance: sd.ch[1],
        worksPct:      sd.ch[2],
        taxMonths:     sd.ch[3],
      },
      moveInDelay: sd.del ?? 0,
      loans: [],
    };
    for (const ld of sd.ln) {
      const lid = newLnId();
      if      (ld[0] === 'b') sc.loans.push({ id: lid, type: 'banque', rate: ld[1], duration: ld[2], insurance: ld[3], agencyPct: ld[4], guaranteePct: ld[5], fileFee: ld[6], brokerFee: ld[7] });
      else if (ld[0] === 'p') sc.loans.push({ id: lid, type: 'ptz',   amount: ld[1], duration: ld[2], deferred: ld[3] });
      else if (ld[0] === 'a') sc.loans.push({ id: lid, type: 'al',    amount: ld[1], rate: ld[2], duration: ld[3], deferred: ld[4] });
      else if (ld[0] === 'd') sc.loans.push({ id: lid, type: 'don',   amount: ld[1], taxPct:   ld[2] });
    }
    scenarioList.push(sc);
  }

  renderAllScenarios();
}

// ─── LECTURE DES VALEURS DEPUIS LE DOM ────────────────────────────

/** Lit les valeurs actuelles d'un scénario depuis le DOM. */
function readScenarioValues(sc) {
  const sid  = sc.id;
  const typeActive = document.querySelector(`#typeGroup_${sid} .type-btn.active`);
  const type   = typeActive ? typeActive.dataset.type : sc.type;

  const nameEl = document.getElementById(`name_${sid}`);
  const name   = nameEl ? (nameEl.value || sc.name) : sc.name;

  if (type === 'location') {
    return { id: sid, name, type: 'location' };
  }

  const dpeActive = document.querySelector(`#dpeGroup_${sid} .dpe-btn.active`);
  const dpe       = dpeActive ? dpeActive.dataset.dpe : sc.dpe;
  const debtRatio = domNum(`dr_${sid}`, sc.debtRatio ?? 35);

  const charges = {
    coOwnership:   domNum(`co_${sid}`,  sc.charges.coOwnership),
    homeInsurance: domNum(`hi_${sid}`,  sc.charges.homeInsurance),
    worksPct:      domNum(`wp_${sid}`,  sc.charges.worksPct),
    taxMonths:     domNum(`tm_${sid}`,  sc.charges.taxMonths),
  };

  const loans = sc.loans.map(loan => readLoanValues(loan));
  const moveInDelay = domNum(`delay_${sid}`, sc.moveInDelay ?? 0);
  return { id: sid, name, type, dpe, debtRatio, loans, charges, moveInDelay };
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
      deferred: domNum(`defer_${lid}`,  loan.deferred) * 12,  // ans → mois
    };
  }
  if (loan.type === 'al') {
    return {
      id: lid, type: 'al',
      amount:   domNum(`amount_${lid}`, loan.amount),
      rate:     domNum(`rate_${lid}`,   loan.rate),
      duration: domNum(`dur_${lid}`,    loan.duration),
      deferred: domNum(`defer_${lid}`,  loan.deferred) * 12,  // ans → mois
    };
  }
  if (loan.type === 'don') {
    return {
      id: lid, type: 'don',
      amount: domNum(`amount_${lid}`, loan.amount),
      taxPct: domNum(`taxPct_${lid}`, loan.taxPct ?? 0),
    };
  }
  return { ...loan };
}
