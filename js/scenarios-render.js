/* ═══════════════════════════════════════════════════════
   scenarios-render.js — Rendu HTML des cartes d'input (achat & location)
   ═══════════════════════════════════════════════════════ */
'use strict';

/** Échappe les caractères HTML pour éviter les injections dans les value= */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── ENTRY POINT ──────────────────────────────────────────────────

function renderAllScenarios() {
  const container = document.getElementById('scenariosContainer');
  if (!container) return;
  container.innerHTML = scenarioList.map(sc => renderScenarioCard(sc)).join('');

  for (const sc of scenarioList) {
    // Wire le sélecteur 3-états Ancien/Neuf/Location
    const typeGroup = document.getElementById(`typeGroup_${sc.id}`);
    if (typeGroup) {
      typeGroup.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          saveAllCurrentValues();
          const newType = btn.dataset.type;
          if (newType === sc.type) return;
          if (newType === 'location') {
            sc.type = 'location';
            delete sc.dpe; delete sc.loans; delete sc.charges; delete sc.moveInDelay;
          } else if (sc.type === 'location') {
            const fresh = createDefaultScenario(newType);
            sc.type    = newType;
            sc.dpe     = fresh.dpe;
            sc.loans   = fresh.loans;
            sc.charges = fresh.charges;
            sc.moveInDelay = fresh.moveInDelay;
          } else {
            sc.type = newType;
          }
          renderAllScenarios();
          recalculate();
        });
      });
    }

    if (sc.type === 'location') continue;

    // Wire les boutons DPE (toggleable)
    const group = document.getElementById(`dpeGroup_${sc.id}`);
    if (!group) continue;
    group.querySelectorAll('.dpe-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.dpe-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Affiche la note uniquement si DPE A + Neuf
        const noteEl = document.getElementById(`dpeNote_${sc.id}`);
        if (noteEl) noteEl.textContent = btn.dataset.dpe === 'A' && sc.type === 'neuf' ? '(−0,1% sur taux banque)' : '';
        recalculate();
      });
    });
  }
}

// ─── SÉLECTEUR DE TYPE ────────────────────────────────────────────

/** Génère le sélecteur de type Ancien/Neuf/Location. */
function renderTypeSelector(sc) {
  const types = [
    { key: 'ancien',   label: 'Ancien' },
    { key: 'neuf',     label: 'Neuf' },
    { key: 'location', label: 'Location' },
  ];
  return `<div class="type-group" id="typeGroup_${sc.id}">
    ${types.map(t => `<button class="type-btn type-btn-${t.key} ${sc.type === t.key ? 'active' : ''}" data-type="${t.key}">${t.label}</button>`).join('')}
  </div>`;
}

// ─── CARTE SCÉNARIO (ACHAT ANCIEN/NEUF) ───────────────────────────

/** Génère le HTML complet d'une carte scénario. */
function renderScenarioCard(sc) {
  if (sc.type === 'location') return renderLocationCard(sc);

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
    ${renderTypeSelector(sc)}
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

  <!-- ── Taux d'endettement ── -->
  <div class="mb-4">
    <label class="label">Taux d'endettement max :
      <span id="drVal_${sc.id}" class="text-blue-400 font-semibold">${sc.debtRatio ?? 35}%</span>
      <span class="text-gray-500 text-xs ml-1">(détermine la mensualité crédit max)</span>
    </label>
    <input type="range" id="dr_${sc.id}" min="20" max="45" step="1" value="${sc.debtRatio ?? 35}"
      oninput="document.getElementById('drVal_${sc.id}').textContent=this.value+'%';recalculate()" />
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
    <button onclick="addLoan('${sc.id}','don')"   class="btn-add btn-add-don">+ Don</button>
  </div>

  <!-- ── Délai avant emménagement ── -->
  <div class="border-t border-gray-700 pt-3 mb-4">
    <p class="section-title" style="margin-bottom:10px">Disponibilité du bien</p>
    <div>
      <label class="label">Délai avant emménagement (mois)
        <span class="text-xs text-gray-400 font-normal"> — ex. VEFA, travaux</span>
      </label>
      <input type="number" id="delay_${sc.id}" class="input-field" value="${sc.moveInDelay ?? 0}"
        min="0" max="60" step="1" oninput="recalculate()" />
    </div>
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

// ─── CARTE SCÉNARIO LOCATION ──────────────────────────────────────

/** Génère le HTML d'une carte scénario de type Location. */
function renderLocationCard(sc) {
  const colorIdx = scenarioList.indexOf(sc) % SCENARIO_COLORS.length;
  const color    = SCENARIO_COLORS[colorIdx];

  const removeBtn = scenarioList.length > 1
    ? `<button onclick="removeScenario('${sc.id}')" class="remove-btn" title="Supprimer ce scénario">×</button>`
    : '';

  return `
<div class="card scenario-card" id="scenarioCard_${sc.id}" style="border-left-color:${color}">

  <div class="flex items-center gap-2 mb-4 flex-wrap">
    <input type="text" id="name_${sc.id}" value="${escHtml(sc.name)}"
      class="scenario-name-input" oninput="recalculate()" />
    ${renderTypeSelector(sc)}
    <span class="badge bg-indigo-900 text-indigo-300">Pas d'achat — ETF</span>
    <div class="ml-auto">${removeBtn}</div>
  </div>

  <p class="text-xs text-gray-400 mb-3">
    Tout le capital initial est placé en ETF. Chaque mois, le différentiel
    <span class="text-indigo-300 font-semibold">budget global − loyer</span>
    est réinvesti au taux d'épargne.
  </p>

  <div class="bg-gray-950 rounded-xl p-3" id="output_${sc.id}">
    <p class="text-gray-600 text-xs text-center py-2">Calcul en cours…</p>
  </div>

</div>`;
}

// ─── CARTE PRÊT (BANQUE / PTZ / AL / DON) ─────────────────────────

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
    <div>
      <label class="label">Différé (ans)</label>
      <input type="number" id="defer_${lid}" class="input-field" value="${loan.deferred}" min="0" max="25" step="1" oninput="recalculate()" />
    </div>
  </div>
</div>`;
  }

  if (loan.type === 'don') {
    const taxPct = loan.taxPct ?? 0;
    const net = (loan.amount || 0) * (1 - taxPct / 100);
    return `
<div class="loan-card loan-don">
  <div class="flex items-center gap-2 mb-3">
    <span class="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Don — Apport additionnel</span>
    ${removeBtn}
  </div>
  <div class="grid grid-cols-2 gap-2">
    <div>
      <label class="label">Montant brut (€)</label>
      <input type="number" id="amount_${lid}" class="input-field" value="${loan.amount}" min="0" step="1000" oninput="recalculate()" />
    </div>
    <div>
      <label class="label">Taxe&nbsp;: <span id="taxPctVal_${lid}" class="text-emerald-400 font-semibold">${taxPct}%</span></label>
      <input type="range" id="taxPct_${lid}" min="0" max="100" step="1" value="${taxPct}"
        oninput="document.getElementById('taxPctVal_${lid}').textContent=this.value+'%';document.getElementById('netVal_${lid}').textContent=(parseFloat(document.getElementById('amount_${lid}').value||0)*(1-this.value/100)).toLocaleString('fr-FR')+' €';recalculate()" />
    </div>
    <div class="col-span-2 text-xs text-emerald-300/80">
      Don net ajouté à l'apport (ce scénario uniquement)&nbsp;: <span id="netVal_${lid}" class="font-semibold text-emerald-300">${Math.round(net).toLocaleString('fr-FR')} €</span>
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
      <label class="label">Différé (ans)</label>
      <input type="number" id="defer_${lid}" class="input-field" value="${loan.deferred}" min="0" max="25" step="1" oninput="recalculate()" />
    </div>
  </div>
</div>`;
  }

  return '';
}
