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

1. `js/finance.js` — pure math functions, no DOM access. Exports globals: `fmt`, `monthlyPayment`, `remainingBalance`, `findMaxPropertyPrice`, `computeSmoothedSchedule`, `buildPurchaseWealthSeries`, `buildTenantWealthSeries`, `realCostPresentValue`, `realCostVariablePV`
2. `js/chart-manager.js` — Chart.js wrapper. Exports globals: `SCENARIO_COLORS`, `initChart`, `updateChart`
3. `js/scenarios.js` — scenario state, DOM rendering, and per-scenario calculation. Exports globals: `scenarioList`, `addScenario`, `removeScenario`, `addLoan`, `removeLoan`, `saveAllCurrentValues`, `readScenarioValues`, `calcScenario`, `renderAllScenarios`, `renderScenarioResults`, `loadScenariosFromData`
4. `js/main.js` — orchestration, slider sync, share/deserialize, `recalculate()` entrypoint, `DOMContentLoaded` init

## Key data flow

**Source of truth split:**
- `scenarioList[]` in `scenarios.js` holds structural state (which scenarios exist, which loans)
- The **DOM** is the source of truth for current input values
- Before any structural re-render, `saveAllCurrentValues()` must be called to flush DOM → `scenarioList`

**Recalculate flow** (`main.js:recalculate`):
1. Read global inputs from DOM
2. For each scenario: `readScenarioValues()` → `calcScenario()` → `renderScenarioResults()`
3. Build tenant wealth series using the first valid scenario as reference
4. `updateChart()` with all series + tenant series
5. Compute and display breakeven year

**Share/restore:** `serializeState()` produces a compact versioned JSON (v:1) encoded as Base64 in the URL hash. `deserializeState()` restores it on page load.

## Key algorithms (all in `finance.js`)

- **`findMaxPropertyPrice`**: bisection (60 iterations) to resolve the circular dependency between property price and acquisition fees
- **`computeSmoothedSchedule`**: bisection (70 iterations) to find the bank principal such that the loan amortizes exactly to zero despite variable monthly payments during PTZ/AL active periods
- **Debt ratio**: only the credit installment (amortization + interest + borrower insurance) counts toward the 35% limit — condo fees, property tax, and maintenance provisions only affect remaining income

## CSS

Tailwind CSS via CDN (dark mode via `class` strategy, `<html class="dark">`). Custom styles in `css/style.css` for components: `.card`, `.input-field`, `.label`, `.btn-*`, `.loan-card`, `.dpe-btn`, `.toggle-switch`, `.dr`/`.dr-sep`/`.ds`/`.ds-kpi`/`.kpi` (detail rows and KPI grid used in result panels).
