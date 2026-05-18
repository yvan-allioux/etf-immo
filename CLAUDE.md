# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build step, no dependencies to install. Open `index.html` directly in a browser, or serve with any static HTTP server:

```bash
python -m http.server 8080
```

There are no tests, no linter, and no package manager in this project.

## Architecture

Pure vanilla JS single-page app — no bundler, no framework, no modules. Scripts are loaded via `<script>` tags in this exact order (each file depends on globals from the previous):

1. `js/finance.js` — pure math functions, no DOM access. Exports globals: `fmt`, `monthlyPayment`, `remainingBalance`, `findMaxPropertyPrice`, `computeSmoothedSchedule`, `buildPurchaseWealthSeries`, `buildLocationWealthSeries`, `realCostPresentValue`, `realCostVariablePV`
2. `js/chart-manager.js` — Chart.js wrapper. Exports globals: `SCENARIO_COLORS`, `initChart`, `updateChart`
3. `js/scenarios-state.js` — scenario state, defaults, structural ops, DOM persistence, loading. Exports globals: `scenarioList`, `LOAN_DEFAULTS`, `createDefaultScenario`, `addScenario`, `removeScenario`, `addLoan`, `removeLoan`, `saveCurrentValues`, `saveAllCurrentValues`, `readScenarioValues`, `loadScenariosFromData`
4. `js/scenarios-calc.js` — pure per-scenario calculation. Exports globals: `calcScenario`, `calcLocationScenario`
5. `js/scenarios-render.js` — input card rendering (Ancien/Neuf/Location + loans). Exports globals: `renderAllScenarios`, `renderScenarioCard`, `renderLocationCard`, `renderLoanCard`, `renderTypeSelector`, `escHtml`
6. `js/scenarios-results.js` — result-panel rendering. Exports globals: `renderScenarioResults`, `renderLocationResults`
7. `js/main.js` — orchestration, slider sync, share/deserialize, `recalculate()` entrypoint, `DOMContentLoaded` init

## Key data flow

**Source of truth split:**
- `scenarioList[]` in `scenarios-state.js` holds structural state (which scenarios exist, which loans, per-scenario `debtRatio`)
- The **DOM** is the source of truth for current input values
- Before any structural re-render, `saveAllCurrentValues()` must be called to flush DOM → `scenarioList`

**Recalculate flow** (`main.js:recalculate`):
1. Read global inputs from DOM (including `investmentPct` → `monthlyBudget`)
2. For each scenario: `readScenarioValues()` → `calcScenario()` → `renderScenarioResults()` (dispatches to `renderLocationResults()` if `type==='location'`)
3. `updateChart()` with all wealth series (location scenarios get a dashed border)
4. Compute breakeven year for purchase scenarios vs first Location scenario

**Scenario types:**
- `ancien` / `neuf` — full purchase scenario (loans, charges, DPE, per-scenario `debtRatio`)
- `location` — no purchase; entire `totalCapital` placed in ETF, monthly `monthlyBudget − rent` reinvested

**ETF complémentaire:** for purchase scenarios, the unused part of `monthlyBudget` (= `netSalary × investmentPct%`) — i.e. `monthlyBudget − mensualité − charges propriétaire` — is invested monthly in ETF on top of the residual savings. Clamped to 0 with a warning when negative.

**Share/restore:** `serializeState()` produces a compact versioned JSON (current `v:4`) encoded as Base64 in the URL hash. `deserializeState()` accepts `v:1` through `v:4`; for `v:1/2/3` (single global `debtRatio`), that value is propagated to all purchase scenarios via the `legacyDebtRatio` argument to `loadScenariosFromData`.

## Key algorithms (all in `finance.js`)

- **`findMaxPropertyPrice`**: bisection (60 iterations) to resolve the circular dependency between property price and acquisition fees. Takes `auxLoanTotal` (PTZ + AL) so guarantee fees are computed only on the bank portion.
- **`computeSmoothedSchedule`**: bisection (70 iterations) to find the bank principal such that the loan amortizes exactly to zero despite variable monthly payments during PTZ/AL active periods
- **`buildPurchaseWealthSeries`**: monthly compounding with `etfMonthly` add-on each month plus property revaluation + remaining debt + resale fees at each year-end
- **`buildLocationWealthSeries`**: monthly compounding of `initialPortfolio` plus `max(0, monthlyBudget − rent)` each month, with rent inflation each year
- **Debt ratio**: per-scenario, only the credit installment (amortization + interest + borrower insurance) counts toward the limit — condo fees, property tax, and maintenance provisions only affect remaining income

## CSS

Tailwind CSS via CDN (dark mode via `class` strategy, `<html class="dark">`). Custom styles in `css/style.css` for components: `.card`, `.input-field`, `.label`, `.btn-*`, `.loan-card`, `.dpe-btn`, `.toggle-switch`, `.dr`/`.dr-sep`/`.ds`/`.ds-kpi`/`.kpi` (detail rows and KPI grid used in result panels).
