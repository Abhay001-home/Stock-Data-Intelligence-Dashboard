const BASE = '';  // same origin
let companies = [];
let currentSymbol = null;
let currentDays = 30;
let priceChart, returnChart, volChart, compareChart;

// ── Helpers ──
const $ = id => document.getElementById(id);
const loading = show => {$('loading').style.display = show ? 'flex' : 'none'; }
const api = async url => { const r = await fetch(BASE + url); if (!r.ok) throw new Error(await r.text()); return r.json(); }

     function destroyChart(c) { if (c) c.destroy(); }

     function makeChart(id, cfg) {
  const ctx = document.getElementById(id).getContext('2d');
     return new Chart(ctx, cfg);
}

     // ── Load company list ──
     async function loadCompanies() {
  const data = await api('/companies');
     companies = data.companies;
     const list = $('company-list');
     list.innerHTML = '';
     // populate compare dropdown too
     const sel = $('cmp-sym2');
  companies.forEach(c => {
    const el = document.createElement('div');
     el.className = 'company-item';
     el.dataset.symbol = c.symbol;
     el.innerHTML = `<span class="sym">${c.symbol.replace('.NS', '')}</span><span class="name">${c.name}</span>`;
    el.addEventListener('click', () => selectCompany(c.symbol));
     list.appendChild(el);
     const opt = document.createElement('option');
     opt.value = c.symbol; opt.textContent = c.symbol.replace('.NS','') + ' — ' + c.name;
     sel.appendChild(opt);
  });
}

     // ── Load movers ──
     async function loadMovers() {
  try {
    const data = await api('/movers');
     const el = $('movers-list');
     el.innerHTML = '';
    data.top_gainers.slice(0,2).forEach(m => {
          el.innerHTML += `<div class="mover-row"><span>${m.symbol.replace('.NS', '')}</span><span class="up">+${m.change_pct}%</span></div>`;
    });
    data.top_losers.slice(0,2).forEach(m => {
          el.innerHTML += `<div class="mover-row"><span>${m.symbol.replace('.NS', '')}</span><span class="dn">${m.change_pct}%</span></div>`;
    });
  } catch(e) {$('movers-list').innerHTML = '<span style="color:var(--muted);font-size:11px">Unavailable</span>'; }
}

     // ── Select company ──
     async function selectCompany(symbol) {
          currentSymbol = symbol;
  document.querySelectorAll('.company-item').forEach(el => {
          el.classList.toggle('active', el.dataset.symbol === symbol);
  });
     // Set compare sym2 to something different
     const sel = $('cmp-sym2');
     for (let opt of sel.options) { if (opt.value !== symbol) {sel.value = opt.value; break; } }
     await loadDashboard();
}

     // ── Load dashboard data ──
     async function loadDashboard() {
  if (!currentSymbol) return;
     loading(true);
     $('placeholder').style.display = 'none';
     $('dashboard').style.display = 'flex';

     try {
    const [stockData, summary] = await Promise.all([
     api(`/data/${currentSymbol}?days=${currentDays}`),
     api(`/summary/${currentSymbol}`)
     ]);

     // Update header
     $('stock-title').textContent = summary.name + ' (' + currentSymbol.replace('.NS','') + ')';
     $('stock-sub').textContent = summary.sector + ' • Last ' + currentDays + ' days';

    // Metric cards
    const ytdColor = summary.ytd_return >= 0 ? 'var(--green)' : 'var(--red)';
     $('metric-cards').innerHTML = `
     <div class="card"><div class="label">Current Price</div><div class="val">₹${summary.current_price}</div><div class="sub">NSE</div></div>
     <div class="card"><div class="label">52W High</div><div class="val" style="color:var(--green)">₹${summary['52_week_high']}</div></div>
     <div class="card"><div class="label">52W Low</div><div class="val" style="color:var(--red)">₹${summary['52_week_low']}</div></div>
     <div class="card"><div class="label">Avg Close</div><div class="val">₹${summary.avg_close}</div></div>
     <div class="card"><div class="label">YTD Return</div><div class="val" style="color:${ytdColor}">${summary.ytd_return}%</div></div>
     <div class="card"><div class="label">Volatility Score</div><div class="val">${summary.volatility_score}</div><div class="sub">0–100</div></div>
     `;

     const rows = stockData.data;
    const labels = rows.map(r => r.Date);
    const closes = rows.map(r => r.Close);
    const ma7    = rows.map(r => r.MA7 || null);
    const ma30   = rows.map(r => r.MA30 || null);
    const returns= rows.map(r => r.Daily_Return || 0);
    const vols   = rows.map(r => r.Volatility || null);

     // ── Price chart ──
     destroyChart(priceChart);
     priceChart = makeChart('priceChart', {
          type: 'line',
     data: {
          labels,
          datasets: [
     {label: 'Close', data: closes, borderColor: '#58a6ff', borderWidth: 2, pointRadius: 0, fill: true, backgroundColor: 'rgba(88,166,255,0.07)' },
     {label: 'MA7',   data: ma7,    borderColor: '#f0883e', borderWidth: 1.5, pointRadius: 0, borderDash: [4,3] },
     {label: 'MA30',  data: ma30,   borderColor: '#bc8cff', borderWidth: 1.5, pointRadius: 0, borderDash: [6,4] },
     ]
      },
     options: chartOpts('₹')
    });

     // ── Return bar chart ──
     destroyChart(returnChart);
     returnChart = makeChart('returnChart', {
          type: 'bar',
     data: {
          labels,
          datasets: [{
          label: 'Daily Return %',
     data: returns,
          backgroundColor: returns.map(v => v >= 0 ? 'rgba(63,185,80,0.7)' : 'rgba(248,81,73,0.7)'),
        }]
      },
     options: chartOpts('%')
    });

     // ── Volatility chart ──
     destroyChart(volChart);
     volChart = makeChart('volChart', {
          type: 'line',
     data: {
          labels,
          datasets: [{label: 'Volatility', data: vols, borderColor: '#f0883e', borderWidth: 1.5, pointRadius: 0, fill: true, backgroundColor: 'rgba(240,136,62,0.08)' }]
      },
     options: chartOpts('%')
    });

     $('compare-panel').style.display = 'none';
     $('corr-badge').style.display = 'none';
  } catch(e) {
          console.error(e);
     alert('Error loading data: ' + e.message);
  } finally {
          loading(false);
  }
}

// ── Compare ──
$('compare-btn').addEventListener('click', async () => {
  const sym2 = $('cmp-sym2').value;
     const days = $('cmp-days').value;
     if (!currentSymbol || sym2 === currentSymbol) return;
     loading(true);
     try {
    const data = await api(`/compare?symbol1=${currentSymbol}&symbol2=${sym2}&days=${days}`);
     const {prices, correlation, symbol1_stats: s1, symbol2_stats: s2 } = data;

     destroyChart(compareChart);
     compareChart = makeChart('compareChart', {
          type: 'line',
     data: {
          labels: prices.dates,
     datasets: [
     {label: currentSymbol.replace('.NS',''), data: prices[currentSymbol], borderColor: '#58a6ff', borderWidth: 2, pointRadius: 0, yAxisID: 'y1' },
     {label: sym2.replace('.NS',''),           data: prices[sym2],          borderColor: '#3fb950', borderWidth: 2, pointRadius: 0, yAxisID: 'y2' },
     ]
      },
     options: {
          ...chartOpts('₹'),
          scales: {
          x: {ticks: {color: '#8b949e', maxTicksLimit: 8 }, grid: {color: '#21262d' } },
     y1: {type: 'linear', position: 'left',  ticks: {color: '#58a6ff' }, grid: {color: '#21262d' } },
     y2: {type: 'linear', position: 'right', ticks: {color: '#3fb950' }, grid: {drawOnChartArea: false } },
        }
      }
    });

    const corrColor = Math.abs(correlation) > 0.7 ? 'var(--green)' : correlation < 0 ? 'var(--red)' : 'var(--muted)';
     $('corr-badge').innerHTML = `Correlation: <strong style="color:${corrColor}">${correlation}</strong> &nbsp;|&nbsp; ${currentSymbol.replace('.NS', '')} return: <strong>${s1.return_pct}%</strong> &nbsp;|&nbsp; ${sym2.replace('.NS', '')} return: <strong>${s2.return_pct}%</strong>`;
     $('corr-badge').style.display = 'block';
     $('compare-title').textContent = `${currentSymbol.replace('.NS', '')} vs ${sym2.replace('.NS', '')} — Last ${days} days`;
     $('compare-panel').style.display = 'block';
  } catch(e) {alert('Compare error: ' + e.message); }
     finally {loading(false); }
});

// ── Range buttons ──
document.querySelectorAll('.range-btn').forEach(btn => {
          btn.addEventListener('click', () => {
               document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
               btn.classList.add('active');
               currentDays = parseInt(btn.dataset.days);
               loadDashboard();
          });
});

     // ── Chart defaults ──
     function chartOpts(unit) {
  return {
          responsive: true,
     maintainAspectRatio: false,
     interaction: {mode: 'index', intersect: false },
     plugins: {
          legend: {labels: {color: '#8b949e', boxWidth: 12, font: {size: 11 } } },
     tooltip: {backgroundColor: '#161b22', titleColor: '#e6edf3', bodyColor: '#8b949e', borderColor: '#30363d', borderWidth: 1 }
    },
     scales: {
          x: {ticks: {color: '#8b949e', maxTicksLimit: 8 }, grid: {color: '#21262d' } },
     y: {ticks: {color: '#8b949e', callback: v => unit === '₹' ? '₹' + v.toLocaleString() : v.toFixed(2) + unit }, grid: {color: '#21262d' } }
    }
  };
}

// ── Init ──
(async () => {
          await loadCompanies();
     loadMovers();
})();