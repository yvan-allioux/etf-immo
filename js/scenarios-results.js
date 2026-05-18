/* ═══════════════════════════════════════════════════════
   scenarios-results.js — Rendu des panneaux de résultats (achat & location)
   ═══════════════════════════════════════════════════════ */
'use strict';

// Helpers d'affichage partagés
const _row  = (label, val, cls = '')  => `<div class="dr"><span>${label}</span><span class="${cls}">${val}</span></div>`;
const _sub  = (label, val, cls = '')  => `<div class="dr sub"><span>${label}</span><span class="${cls}">${val}</span></div>`;
const _tot  = (label, val, cls = '')  => `<div class="dr tot"><span>${label}</span><span class="${cls}">${val}</span></div>`;
const _sep  = ()                      => `<div class="dr-sep"></div>`;
const _sec  = (title, body)           => `<div class="ds"><p class="dt">${title}</p>${body}</div>`;
const _fmtPct = v => v.toFixed(2) + '%';
const _fmtAns = v => v + ' an' + (v > 1 ? 's' : '');

// ─── RENDU — SCÉNARIO ACHAT ───────────────────────────────────────

function renderScenarioResults(scId, result) {
  const container = document.getElementById(`output_${scId}`);
  if (!container) return;

  if (!result) {
    container.innerHTML = '<p class="text-gray-600 text-xs text-center py-3">Données insuffisantes</p>';
    return;
  }

  if (result.type === 'location') return renderLocationResults(scId, result);

  const { V, totalMonthly, remainingIncome,
          acquisition, monthly, bankAnalysis,
          ptzAnalysis, alAnalysis, forecast,
          monthlyBudget, etfMonthly, budgetOverflow, investmentPct } = result;

  // Couleur du scénario (pour accent sur le budget)
  const scIdx  = scenarioList.findIndex(s => s.id === scId);
  const accent = SCENARIO_COLORS[scIdx % SCENARIO_COLORS.length] || '#f59e0b';

  // Couleur reste à vivre
  const riColor = remainingIncome >= 800 ? '#34d399' : remainingIncome >= 400 ? '#fbbf24' : '#f87171';

  // Alias des helpers
  const row = _row, sub = _sub, tot = _tot, sep = _sep, sec = _sec, fmtPct = _fmtPct, fmtAns = _fmtAns;

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
    (acquisition.giftNet > 0
      ? sub('− Don net (' + fmt(acquisition.giftGross) + ' brut, taxe ' + ((1 - acquisition.giftNet / Math.max(1, acquisition.giftGross)) * 100).toFixed(0) + '%)',
            '−' + fmt(acquisition.giftNet), 'text-emerald-300')
      : '') +
    (acquisition.giftNet > 0
      ? sub('= Apport total (personnel + don)', fmt(acquisition.apportTotal), 'text-blue-200')
      : '') +
    tot('= Total emprunté', fmt(acquisition.totalBorrowed), 'text-blue-300') +
    (acquisition.totalBorrowed > 0 ? sub('Levier (emprunt / apport total)', (acquisition.totalBorrowed / Math.max(1, acquisition.apportTotal)).toFixed(1) + '×') : '');
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
    row(`Budget global investissement (${investmentPct ?? 70}% salaire)`, fmt(monthlyBudget) + '/mois', 'text-blue-300') +
    sub('− Crédit + charges propriétaire', '−' + fmt(totalMensuel) + '/mois') +
    tot('= ETF complémentaire mensuel', fmt(etfMonthly) + '/mois', budgetOverflow ? 'text-red-400' : 'text-emerald-400') +
    (budgetOverflow ? sub('⚠ Scénario dépasse le budget — ETF ramené à 0 €', '', 'text-red-300') : '') +
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

  // ── 7. Impact du délai avant emménagement ──────────────────────
  let delaySection = '';
  if (result.moveInDelayMonths > 0) {
    const dm = result.moveInDelayMonths;
    const delayBody =
      row('Durée du délai', dm + ' mois (' + (dm / 12).toFixed(1) + ' ans)', 'text-orange-300') +
      row('Loyer mensuel payé en double', fmt(result.currentRent) + '/mois', 'text-red-300') +
      tot('Loyers totaux pendant le délai', '−' + fmt(result.totalRentDuringDelay), 'text-red-400') +
      sub('Réduit l\'épargne résiduelle investissable pendant cette période', '');
    delaySection = sec('Impact du délai avant emménagement', delayBody);
  }

  // ── 8. Prévision patrimoniale ───────────────────────────────────
  const fo = forecast;
  const forecastBody =
    row('Épargne résiduelle (capital hors apport)', fmt(fo.residualSavings)) +
    sub('→ après ' + fmtAns(fo.simYears) + ' au taux épargne', fmt(fo.finalSavings), 'text-blue-300') +
    sep() +
    row('Prix d\'achat', fmt(fo.propertyPrice)) +
    (fo.decotePct > 0
      ? sub('− Décote à l\'achat (' + fo.decotePct + '%) — valeur de revente immédiate', '−' + fmt(fo.decoteLoss), 'text-red-300') +
        sub('= Valeur de marché initiale', fmt(fo.effectiveV), 'text-orange-300')
      : '') +
    sub('→ valeur dans ' + fmtAns(fo.simYears) + ' (+' + fmt(fo.propertyGain) + ')', fmt(fo.finalPropertyValue), 'text-white') +
    (fo.finalDebt > 0
      ? sub('− Capital restant dû', '−' + fmt(fo.finalDebt), 'text-red-300')
      : sub('Prêt entièrement remboursé ✓', '', 'text-emerald-400')) +
    sub('− Frais de revente estimés (6%)', '−' + fmt(fo.finalPropertyValue * 0.06), 'text-red-300') +
    (fo.finalSavings > 0 ? sub('+ Épargne résiduelle revalorisée', '+' + fmt(fo.finalSavings), 'text-blue-300') : '') +
    (fo.etfMonthly > 0 ? sub('+ ETF complémentaire (' + fmt(fo.etfMonthly) + '/mois capitalisés)', '+' + fmt(fo.etfFinal), 'text-indigo-300') : '') +
    tot('Patrimoine net estimé à ' + fmtAns(fo.simYears), fmt(fo.finalWealth), 'text-emerald-400');
  const forecastSection = sec('Prévision patrimoniale à ' + fmtAns(fo.simYears), forecastBody);

  container.innerHTML = synthese + acqSection + budgetSection + bankSection + ptzSection + alSection + delaySection + forecastSection;
}

// ─── RENDU — SCÉNARIO LOCATION ────────────────────────────────────

function renderLocationResults(scId, result) {
  const container = document.getElementById(`output_${scId}`);
  if (!container) return;

  const { monthlyBudget, currentRent, finalRent, etfMonthly, budgetOverflow,
          remainingIncome, initialPortfolio, capitalAlone, finalWealth,
          wealthSeries, simYears, savingsReturnRate, inflationRate,
          investmentPct } = result;

  const scIdx  = scenarioList.findIndex(s => s.id === scId);
  const accent = SCENARIO_COLORS[scIdx % SCENARIO_COLORS.length] || '#818cf8';
  const riColor = remainingIncome >= 800 ? '#34d399' : remainingIncome >= 400 ? '#fbbf24' : '#f87171';

  const row = _row, sub = _sub, tot = _tot, sep = _sep, sec = _sec, fmtPct = _fmtPct, fmtAns = _fmtAns;

  // ── 1. Synthèse rapide ─────────────────────────────────────────
  const synthese = `
    <div class="ds-kpi">
      <div class="kpi">
        <span class="kpi-sub">Budget mensuel invest.</span>
        <span class="kpi-val" style="color:${accent}">${fmt(monthlyBudget)}<span class="kpi-unit">/mois</span></span>
      </div>
      <div class="kpi">
        <span class="kpi-sub">Loyer (an 1)</span>
        <span class="kpi-val">${fmt(currentRent)}<span class="kpi-unit">/mois</span></span>
      </div>
      <div class="kpi">
        <span class="kpi-sub">ETF mensuel</span>
        <span class="kpi-val" style="color:${budgetOverflow ? '#f87171' : '#34d399'}">${fmt(etfMonthly)}<span class="kpi-unit">/mois</span></span>
      </div>
      <div class="kpi">
        <span class="kpi-sub">Patrimoine à ${fmtAns(simYears)}</span>
        <span class="kpi-val" style="color:${accent}">${fmt(finalWealth)}</span>
      </div>
    </div>`;

  // ── 2. Flux mensuels ───────────────────────────────────────────
  const flowBody =
    row(`Budget global investissement (${investmentPct ?? 70}% salaire)`, fmt(monthlyBudget) + '/mois', 'text-blue-300') +
    sub('− Loyer (an 1)', '−' + fmt(currentRent) + '/mois', 'text-orange-300') +
    tot('= ETF mensuel net', fmt(etfMonthly) + '/mois', budgetOverflow ? 'text-red-400' : 'text-emerald-400') +
    (budgetOverflow ? sub('⚠ Loyer > budget investissement — ETF ramené à 0 €', '', 'text-red-300') : sub('Réinvesti chaque mois au taux ' + fmtPct(savingsReturnRate) + '/an', '')) +
    sep() +
    row('Salaire net', fmt(investmentPct > 0 ? monthlyBudget / (investmentPct / 100) : 0) + '/mois') +
    tot('Reste à vivre (hors investissement & loyer)', fmt(remainingIncome) + '/mois',
        remainingIncome >= 800 ? 'text-emerald-400' : remainingIncome >= 400 ? 'text-yellow-400' : 'text-red-400');
  const flowSection = sec('Flux mensuels', flowBody);

  // ── 3. Évolution du loyer ──────────────────────────────────────
  const rentSection = sec(`Évolution du loyer (inflation ${fmtPct(inflationRate)}/an)`,
    row(`Loyer à l'an 1`, fmt(currentRent) + '/mois') +
    row(`Loyer à l'an ${simYears}`, fmt(finalRent) + '/mois', 'text-orange-300') +
    sub('Le différentiel mensuel est recalculé chaque année (loyer indexé sur inflation)', '')
  );

  // ── 4. Capital initial ────────────────────────────────────────
  const capitalGain = capitalAlone - initialPortfolio;
  const flowContrib = Math.max(0, finalWealth - capitalAlone);
  const capitalSection = sec('Capital initial — Intérêts composés',
    row('Capital initial placé', fmt(initialPortfolio)) +
    row('Rendement annuel', fmtPct(savingsReturnRate)) +
    sep() +
    sub(`Formule : ${fmt(initialPortfolio)} × (1 + ${fmtPct(savingsReturnRate / 12)})^${simYears * 12} mois`, '') +
    tot(`Capital seul après ${fmtAns(simYears)}`, fmt(capitalAlone), 'text-blue-300') +
    sub('Gain intérêts composés : +' + fmt(capitalGain), '', 'text-emerald-400') +
    (flowContrib > 0
      ? sep() + row('+ Accumulation des versements mensuels', '+' + fmt(flowContrib), 'text-emerald-400')
      : '') +
    tot(`= Patrimoine total à ${fmtAns(simYears)}`, fmt(finalWealth), 'text-indigo-300')
  );

  // ── 5. Jalons ─────────────────────────────────────────────────
  const milestoneYears = [5, 10, 15, 20, 25, 30].filter(y => y <= simYears && wealthSeries[y - 1] !== undefined);
  let milestonesSection = '';
  if (milestoneYears.length > 1) {
    const msBody = milestoneYears.map(y =>
      y < simYears
        ? row(`Patrimoine à ${fmtAns(y)}`, fmt(wealthSeries[y - 1]), 'text-indigo-300')
        : tot(`Patrimoine à ${fmtAns(y)}`, fmt(wealthSeries[y - 1]), 'text-indigo-300')
    ).join('');
    milestonesSection = sec('Jalons patrimoniaux', msBody);
  }

  container.innerHTML = synthese + flowSection + rentSection + capitalSection + milestonesSection;
}
