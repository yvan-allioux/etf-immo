/* ═══════════════════════════════════════════════════════
   chart-manager.js — Gestion du graphique Chart.js
   ═══════════════════════════════════════════════════════ */
'use strict';

const SCENARIO_COLORS = [
  '#f59e0b', // amber  — scénario 1
  '#10b981', // emerald — scénario 2
  '#3b82f6', // blue   — scénario 3
  '#a78bfa', // violet — scénario 4
  '#f97316', // orange — scénario 5
  '#ec4899', // pink   — scénario 6
  '#14b8a6', // teal   — scénario 7
];

let wealthChart = null;

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Initialise le graphique Chart.js.
 * À appeler une seule fois au chargement de la page.
 */
function initChart() {
  const ctx = document.getElementById('wealthChart').getContext('2d');
  wealthChart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false }, // légende custom dans #chartLegend
        tooltip: {
          backgroundColor: '#1f2937',
          borderColor: '#374151',
          borderWidth: 1,
          titleColor: '#f9fafb',
          bodyColor: '#d1d5db',
          padding: 10,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label} : ${fmt(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#6b7280', font: { size: 11 } },
          grid:  { color: '#1f2937' },
        },
        y: {
          ticks: {
            color: '#6b7280',
            font: { size: 11 },
            callback: v => {
              const abs = Math.abs(v);
              if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' M€';
              if (abs >= 1_000)     return (v / 1_000).toFixed(0) + ' k€';
              return v + ' €';
            },
          },
          grid: { color: '#374151' },
        },
      },
    },
  });
}

/**
 * Met à jour le graphique avec les séries de patrimoine de tous les scénarios.
 *
 * @param {number[][]} wealthSeriesArray - tableau de séries (une par scénario)
 * @param {string[]}   names             - noms des scénarios
 * @param {string[]}   types             - types des scénarios ('ancien'|'neuf'|'location')
 * @param {number}     simYears          - durée de simulation
 */
function updateChart(wealthSeriesArray, names, types, simYears) {
  if (!wealthChart) return;

  const labels = Array.from({ length: simYears }, (_, i) => `An ${i + 1}`);
  wealthChart.data.labels = labels;

  const datasets = wealthSeriesArray.map((series, i) => {
    const color    = SCENARIO_COLORS[i % SCENARIO_COLORS.length];
    const isLoc    = types && types[i] === 'location';
    return {
      label:           names[i] || `Scénario ${i + 1}`,
      data:            series,
      borderColor:     color,
      backgroundColor: hexToRgba(color, isLoc ? 0 : 0.08),
      tension:         0.3,
      fill:            !isLoc,
      borderDash:      isLoc ? [4, 3] : [],
      pointRadius:     3,
      borderWidth:     2,
    };
  });

  wealthChart.data.datasets = datasets;
  wealthChart.update('none');

  updateChartLegend(names, types);
}

function updateChartLegend(names, types) {
  const legend = document.getElementById('chartLegend');
  if (!legend) return;

  const items = names.map((name, i) => {
    const color = SCENARIO_COLORS[i % SCENARIO_COLORS.length];
    const isLoc = types && types[i] === 'location';
    const marker = isLoc
      ? `<span style="display:inline-block;width:14px;height:0;border-top:2px dashed ${color};flex-shrink:0"></span>`
      : `<span style="display:inline-block;width:14px;height:3px;background:${color};border-radius:2px;flex-shrink:0"></span>`;
    return `<span class="flex items-center gap-1.5">${marker}<span>${name}</span></span>`;
  });

  legend.innerHTML = items.join('');
}
