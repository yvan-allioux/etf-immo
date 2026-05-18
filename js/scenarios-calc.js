/* ═══════════════════════════════════════════════════════
   scenarios-calc.js — Calcul d'un scénario (achat & location)
   ═══════════════════════════════════════════════════════ */
'use strict';

/**
 * Calcule tous les indicateurs d'un scénario à partir de ses paramètres
 * et des inputs globaux.
 *
 * @returns {object} { V, bankPrincipal, ptzAmount, alAmount, totalMonthly,
 *   totalChargesMonthly, taxMonthly, remainingIncome, creditCost, realCost,
 *   wealthSeries, schedule } ou null si données insuffisantes.
 */
function calcScenario(scValues, globalInputs) {
  if (scValues.type === 'location') return calcLocationScenario(scValues, globalInputs);

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

  // Dons (n'entrent pas dans l'amortissement — uniquement dans la contribution)
  const giftLoans   = loans.filter(l => l.type === 'don');
  const giftGross   = giftLoans.reduce((s, g) => s + (g.amount || 0), 0);
  const giftNet     = giftLoans.reduce((s, g) => s + (g.amount || 0) * (1 - (g.taxPct || 0) / 100), 0);

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

  // Capacité de remboursement bancaire = salaire × taux d'endettement uniquement.
  // Les charges annexes (copropriété, taxe foncière, travaux…) n'entrent PAS dans
  // ce calcul — elles réduisent seulement le reste à vivre.
  const debtRatio = scValues.debtRatio ?? 35;
  const avail = availableForLoan(globalInputs.netSalary, debtRatio);

  // avail est constant (indépendant de V) → un seul calcul suffit
  const smoothed = computeSmoothedSchedule({
    targetMonthly: avail,
    bankRate, bankMonths,
    borrowerInsurancePct: bankLoan.insurance,
    auxLoans,
  });
  const maxTotalLoan = smoothed.bankPrincipal + ptzAmount + alAmount;
  const V = findMaxPropertyPrice(
    globalInputs.maxContribution + giftNet, maxTotalLoan, isNew,
    agencyPct, bankLoan.guaranteePct ?? 1, fixedFees,
    ptzAmount + alAmount
  );

  const bankPrincipal = smoothed.bankPrincipal;
  const totalMonthly  = avail;

  // Charges et reste à vivre
  const worksMonthly        = charges.worksPct / 100 * V / 12;
  const taxMonthly          = totalMonthly * charges.taxMonths / 12;
  const totalChargesMonthly = charges.coOwnership + charges.homeInsurance + worksMonthly;
  const remainingIncome     = globalInputs.netSalary - totalMonthly - totalChargesMonthly - taxMonthly;

  // ETF complémentaire mensuel = budget global − mensualité − charges propriétaire
  const monthlyBudget   = globalInputs.monthlyBudget ?? (globalInputs.netSalary * (globalInputs.investmentPct ?? 70) / 100);
  const etfMonthlyRaw   = monthlyBudget - totalMonthly - totalChargesMonthly - taxMonthly;
  const etfMonthly      = Math.max(0, etfMonthlyRaw);
  const budgetOverflow  = etfMonthlyRaw < 0;

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

  const decotePct = globalInputs.decote ?? 0;
  const moveInDelayMonths = scValues.moveInDelay ?? 0;
  const totalRentDuringDelay = moveInDelayMonths * globalInputs.currentRent;
  const wealthSeries = buildPurchaseWealthSeries(
    V, extSchedule, residualSavings,
    globalInputs.propertyGrowthRate, globalInputs.savingsReturnRate, globalInputs.simYears,
    decotePct, moveInDelayMonths, globalInputs.currentRent,
    etfMonthly
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
    giftGross,
    giftNet,
    apportTotal:   globalInputs.maxContribution + giftNet,
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
  const effectiveV         = V * (1 - decotePct / 100);
  const finalPropertyValue = effectiveV * Math.pow(1 + globalInputs.propertyGrowthRate / 100, globalInputs.simYears);
  const finalDebt          = extSchedule[extSchedule.length - 1]?.totalBalance || 0;
  const finalSavings       = residualSavings * Math.pow(1 + globalInputs.savingsReturnRate / 100, globalInputs.simYears);
  // Valeur finale de l'ETF complémentaire (versements mensuels capitalisés au taux d'épargne)
  const mRate              = globalInputs.savingsReturnRate / 100 / 12;
  const totalMonthsSim     = globalInputs.simYears * 12;
  const etfFinal           = mRate === 0
    ? etfMonthly * totalMonthsSim
    : etfMonthly * (Math.pow(1 + mRate, totalMonthsSim) - 1) / mRate;
  const forecast = {
    simYears:           globalInputs.simYears,
    propertyPrice:      V,
    effectiveV,
    decotePct,
    decoteLoss:         V - effectiveV,
    finalPropertyValue,
    propertyGain:       finalPropertyValue - effectiveV,
    finalDebt,
    finalSavings,
    residualSavings,
    etfMonthly,
    etfFinal,
    finalWealth:        wealthSeries[wealthSeries.length - 1] || 0,
  };

  return {
    type: 'achat',
    V, bankPrincipal, ptzAmount, alAmount, totalMonthly,
    totalChargesMonthly, taxMonthly, remainingIncome,
    creditCost, realCost, wealthSeries, schedule: extSchedule,
    acquisition, monthly, bankAnalysis, ptzAnalysis, alAnalysis, forecast,
    moveInDelayMonths, totalRentDuringDelay,
    currentRent: globalInputs.currentRent,
    monthlyBudget, etfMonthly, etfMonthlyRaw, budgetOverflow,
    investmentPct: globalInputs.investmentPct,
  };
}

// ─── CALCUL D'UN SCÉNARIO LOCATION (PAS D'ACHAT) ──────────────────

function calcLocationScenario(scValues, globalInputs) {
  const rent             = globalInputs.currentRent;
  const monthlyBudget    = globalInputs.monthlyBudget ?? (globalInputs.netSalary * (globalInputs.investmentPct ?? 70) / 100);
  const etfMonthlyRaw    = monthlyBudget - rent;
  const etfMonthly       = Math.max(0, etfMonthlyRaw);
  const budgetOverflow   = etfMonthlyRaw < 0;
  const initialPortfolio = globalInputs.totalCapital;
  const remainingIncome  = globalInputs.netSalary - rent - etfMonthly;

  const wealthSeries = buildLocationWealthSeries(
    initialPortfolio, monthlyBudget, rent,
    globalInputs.inflationRate, globalInputs.savingsReturnRate, globalInputs.simYears
  );

  const monthlyRate = globalInputs.savingsReturnRate / 100 / 12;
  const totalMonths = globalInputs.simYears * 12;
  const capitalAlone= initialPortfolio * Math.pow(1 + monthlyRate, totalMonths);
  const finalWealth = wealthSeries[wealthSeries.length - 1] || 0;
  const finalRent   = rent * Math.pow(1 + globalInputs.inflationRate / 100, globalInputs.simYears);

  return {
    type: 'location',
    wealthSeries,
    investmentPct: globalInputs.investmentPct,
    monthlyBudget,
    currentRent: rent,
    finalRent,
    etfMonthly,
    etfMonthlyRaw,
    budgetOverflow,
    remainingIncome,
    initialPortfolio,
    capitalAlone,
    finalWealth,
    simYears: globalInputs.simYears,
    savingsReturnRate: globalInputs.savingsReturnRate,
    inflationRate: globalInputs.inflationRate,
  };
}
