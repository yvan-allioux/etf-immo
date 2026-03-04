/* ═══════════════════════════════════════════════════════
   finance.js — Fonctions mathématiques pures (pas de DOM)
   ═══════════════════════════════════════════════════════ */
'use strict';

// ─── UTILITAIRES ─────────────────────────────────────────────────

const fmt = n => isFinite(n) ? Math.round(n).toLocaleString('fr-FR') + '\u00a0€' : '—';

// ─── AMORTISSEMENT ───────────────────────────────────────────────

/**
 * Mensualité d'un prêt amortissable classique.
 */
function monthlyPayment(principal, annualRatePct, months) {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / months;
  const pow = Math.pow(1 + r, months);
  return principal * r * pow / (pow - 1);
}

/**
 * Capital restant dû après k mensualités.
 */
function remainingBalance(principal, annualRatePct, months, k) {
  if (principal <= 0 || k >= months) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal * Math.max(0, 1 - k / months);
  const M = monthlyPayment(principal, annualRatePct, months);
  const pow = Math.pow(1 + r, k);
  return Math.max(0, principal * pow - M * (pow - 1) / r);
}

// ─── FRAIS D'ACQUISITION ─────────────────────────────────────────

function notaryFees(V, isNew)       { return V * (isNew ? 0.03 : 0.075); }
function agencyFees(V, pct)         { return V * pct / 100; }
function guaranteeFees(loan, pct)   { return loan * pct / 100; }

// ─── SOLVEUR BUDGET MAX (BISECTION) ──────────────────────────────

/**
 * Trouve le prix max du bien V tel que :
 *   V + fraisNotaire(V) + fraisAgence(V) + fraisGarantie(emprunt) + fraisFixés = apport + empruntMax
 *
 * Résout la dépendance circulaire par bisection (~60 itérations, précision < 0,50 €).
 */
function findMaxPropertyPrice(contribution, maxLoan, isNew, agencyPct, guaranteePct, fixedFees) {
  const totalAvailable = contribution + maxLoan;
  if (totalAvailable <= 0) return 0;
  let lo = 0, hi = totalAvailable;

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const nf = notaryFees(mid, isNew);
    const af = agencyFees(mid, agencyPct);
    const loanNeeded = Math.max(0, mid + nf + af + fixedFees - contribution);
    const gf = guaranteeFees(loanNeeded, guaranteePct);
    const totalCost = mid + nf + af + gf + fixedFees;
    if (Math.abs(totalCost - totalAvailable) < 0.5) return mid;
    if (totalCost > totalAvailable) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

// ─── CAPACITÉ D'EMPRUNT ──────────────────────────────────────────

function grossCapacity(netSalary, debtRatioPct) {
  return netSalary * debtRatioPct / 100;
}

/**
 * Mensualité maximale accordée par la banque = salaire × taux d'endettement.
 * La banque ne regarde QUE la mensualité crédit (capital + intérêts + assurance
 * emprunteur). Les charges de copropriété, taxe foncière, travaux, etc. n'entrent
 * PAS dans le calcul du taux d'endettement bancaire — elles impactent uniquement
 * le reste à vivre.
 */
function availableForLoan(netSalary, debtRatioPct) {
  return grossCapacity(netSalary, debtRatioPct);
}

/**
 * Principal maximum à partir d'une mensualité disponible.
 * Tient compte de l'assurance emprunteur (% du capital par mois).
 */
function maxLoanFromMonthly(available, annualRatePct, months, borrowerInsurancePct) {
  if (available <= 0 || months <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const ins = borrowerInsurancePct / 100 / 12;
  const amortFactor = r === 0
    ? (1 / months)
    : (r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1));
  return available / (amortFactor + ins);
}

// ─── LISSAGE MULTI-PRÊTS ─────────────────────────────────────────

/**
 * Calcule un échéancier lissé pour le prêt bancaire principal + N prêts aidés.
 *
 * L'objectif est une mensualité globale CONSTANTE = targetMonthly.
 * Le prêt banque ajuste sa mensualité en fonction des périodes où les
 * prêts aidés sont actifs, de façon à ne jamais dépasser targetMonthly.
 *
 * @param {object} params
 * @param {number}   params.targetMonthly       - mensualité globale cible (toutes charges prêt incluses)
 * @param {number}   params.bankRate             - taux annuel banque (%)
 * @param {number}   params.bankMonths           - durée banque en mois
 * @param {number}   params.borrowerInsurancePct - assurance emprunteur (% du capital/an)
 * @param {Array}    params.auxLoans             - prêts aidés :
 *   { principal, rate (%), monthlyPmt, startMonth, endMonth }
 *
 * @returns {{ bankPrincipal: number, schedule: Array }}
 *   schedule[t] = { bankPmt, insMonthly, otherPmt, totalPmt, bankBalance, totalBalance }
 */
function computeSmoothedSchedule({ targetMonthly, bankRate, bankMonths, borrowerInsurancePct, auxLoans }) {
  const insRate = borrowerInsurancePct / 100 / 12;
  const bankR   = bankRate / 100 / 12;

  // Mensualités des prêts aidés mois par mois
  const otherPmts = new Float64Array(bankMonths);
  for (const loan of auxLoans) {
    const start = Math.max(0, loan.startMonth);
    const end   = Math.min(loan.endMonth, bankMonths);
    for (let t = start; t < end; t++) {
      otherPmts[t] += loan.monthlyPmt;
    }
  }

  // Bisection : trouve le principal banque B tel que le prêt s'amortisse à 0
  function finalBankBalance(B) {
    let bal = B;
    for (let t = 0; t < bankMonths; t++) {
      const pmt      = Math.max(0, targetMonthly - otherPmts[t] - B * insRate);
      const interest = bal * bankR;
      const amort    = pmt - interest;
      if (amort <= 0) bal += interest;          // sous-amortissement
      else            bal  = Math.max(0, bal - amort);
    }
    return bal;
  }

  const maxB = maxLoanFromMonthly(targetMonthly, bankRate, bankMonths, borrowerInsurancePct);
  let lo = 0, hi = maxB * 1.5;
  for (let i = 0; i < 70; i++) {
    const mid = (lo + hi) / 2;
    const fb  = finalBankBalance(mid);
    if (Math.abs(fb) < 0.5) { lo = hi = mid; break; }
    if (fb > 0) hi = mid; else lo = mid;
  }
  const bankPrincipal = (lo + hi) / 2;
  const insMonthly    = bankPrincipal * insRate;

  // Construit l'échéancier complet mois par mois
  const schedule = [];
  let bankBalance = bankPrincipal;

  for (let t = 0; t < bankMonths; t++) {
    const bankPmt  = Math.max(0, targetMonthly - otherPmts[t] - insMonthly);
    const interest = bankBalance * bankR;
    bankBalance    = Math.max(0, bankBalance - Math.max(0, bankPmt - interest));
    schedule.push({
      bankPmt,
      insMonthly,
      otherPmt:    otherPmts[t],
      totalPmt:    bankPmt + otherPmts[t] + insMonthly,
      bankBalance,
      totalBalance: bankBalance, // les soldes des prêts aidés sont ajoutés juste après
    });
  }

  // Ajoute les soldes restants des prêts aidés au totalBalance
  for (const loan of auxLoans) {
    let bal = loan.principal;
    const r = (loan.rate || 0) / 100 / 12;
    for (let t = 0; t < bankMonths; t++) {
      if (t >= loan.startMonth && t < loan.endMonth) {
        const interest = bal * r;
        const amort    = Math.max(0, loan.monthlyPmt - interest);
        bal = Math.max(0, bal - amort);
      } else if (t >= loan.endMonth) {
        bal = 0;
      }
      // t < startMonth → bal = principal (différé)
      schedule[t].totalBalance += bal;
    }
  }

  return { bankPrincipal, schedule };
}

// ─── SÉRIES DE PATRIMOINE ────────────────────────────────────────

/**
 * Patrimoine net annuel pour un scénario achat.
 * = valeur du bien (revalorisée) − dette restante − frais de revente (6%) + épargne résiduelle
 *
 * @param {number} decotePct - Décote immédiate à l'achat (%, ex: 15 pour 15%).
 *   Représente la perte de valeur de marché dès l'acquisition (TVA neuf,
 *   marges promoteur, frais de commercialisation). La croissance s'applique
 *   ensuite sur la valeur après décote.
 */
function buildPurchaseWealthSeries(V, schedule, residualSavings, propertyGrowthRate, savingsReturnRate, simYears, decotePct = 0) {
  const series = [];
  let propVal = V * (1 - decotePct / 100);
  let savings = residualSavings;

  for (let year = 1; year <= simYears; year++) {
    propVal *= (1 + propertyGrowthRate / 100);
    savings *= (1 + savingsReturnRate / 100);
    const idx          = Math.min(year * 12, schedule.length) - 1;
    const remainingDebt = schedule[Math.max(0, idx)].totalBalance;
    const resaleFees   = propVal * 0.06;
    series.push(propVal - remainingDebt - resaleFees + savings);
  }
  return series;
}

/**
 * Patrimoine net annuel pour le scénario locataire.
 * Le locataire place son apport initial + le différentiel mensuel (mensualité achat − loyer).
 * Boucle mensuelle pour les intérêts composés.
 */
function buildTenantWealthSeries(initialSavings, purchaseMonthly, purchaseCharges, currentRent, inflationRate, savingsReturnRate, simYears) {
  const series      = [];
  const monthlyRate = savingsReturnRate / 100 / 12;
  let portfolio     = initialSavings;
  let rent          = currentRent;

  for (let year = 1; year <= simYears; year++) {
    for (let m = 0; m < 12; m++) {
      portfolio *= (1 + monthlyRate);
      const diff = (purchaseMonthly + purchaseCharges) - rent;
      if (diff > 0) portfolio += diff;
    }
    rent *= (1 + inflationRate / 100);
    series.push(portfolio);
  }
  return series;
}

/**
 * Valeur actualisée des mensualités (coût réel après inflation).
 */
function realCostPresentValue(monthlyPmt, months, annualInflation) {
  const r = annualInflation / 100 / 12;
  let pv  = 0;
  for (let t = 0; t < months; t++) {
    pv += monthlyPmt / Math.pow(1 + r, t + 1);
  }
  return pv;
}

/**
 * Valeur actualisée d'un flux de paiements variables (tableau).
 * Chaque paiement payments[t] est actualisé au taux d'inflation mensuel.
 */
function realCostVariablePV(payments, annualInflation) {
  const r = annualInflation / 100 / 12;
  return payments.reduce((pv, pmt, t) => pv + pmt / Math.pow(1 + r, t + 1), 0);
}
