/* Tool Adoption Forecast — fixed-seed simulation (fictional data).
   Each of 200 employees is Never-tried, Inactive, or Active each week.
   Never -> Active   : first-time activation  (a)
   Active -> Active  : weekly retention       (r)   <- the only thing that changes between scenarios
   Inactive -> Active: reactivation           (q)
   Each run also perturbs a, r and q slightly (assumption uncertainty), using the same
   random numbers in both scenarios so the comparison isolates retention. */
(function (root) {
  var CONFIG = {
    employees: 200,
    tried: 140,
    activeNow: 80,
    goal: 120,
    history: [
      { week: 1, active: 62, tried: 95 },
      { week: 2, active: 80, tried: 140 }
    ],
    runs: 4000,
    seed: 20240611,
    activation: 0.30,
    reactivation: 0.18,
    retention: { baseline: 0.80, improved: 0.90 },
    spread: { activation: 0.20, reactivation: 0.25, retention: 0.03 }
  };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function normal(rng) {
    var u = Math.max(rng(), 1e-12), v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function clip(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function quantile(sorted, p) {
    var i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  }

  function simulate(scenario, cfg) {
    cfg = cfg || CONFIG;
    var r0 = cfg.retention[scenario];
    var N = cfg.employees, inactive0 = cfg.tried - cfg.activeNow;
    var weeks = [[], []]; // week 3, week 4 active counts per run
    var hits = 0;

    for (var run = 0; run < cfg.runs; run++) {
      var rng = mulberry32(cfg.seed + run * 7919);
      var a = clip(cfg.activation * (1 + cfg.spread.activation * normal(rng)), 0.02, 0.9);
      var q = clip(cfg.reactivation * (1 + cfg.spread.reactivation * normal(rng)), 0.01, 0.9);
      var r = clip(r0 + cfg.spread.retention * normal(rng), 0.3, 0.99);

      // 0 = never tried, 1 = tried but inactive, 2 = active this week
      var state = new Uint8Array(N), i, w;
      for (i = 0; i < N; i++) state[i] = i < cfg.activeNow ? 2 : (i < cfg.activeNow + inactive0 ? 1 : 0);

      for (w = 0; w < 2; w++) {
        var active = 0;
        for (i = 0; i < N; i++) {
          var u = rng(), s = state[i];
          if (s === 0) state[i] = u < a ? 2 : 0;
          else if (s === 2) state[i] = u < r ? 2 : 1;
          else state[i] = u < q ? 2 : 1;
          if (state[i] === 2) active++;
        }
        weeks[w].push(active);
      }
      if (weeks[1][run] >= cfg.goal) hits++;
    }

    var out = weeks.map(function (arr, k) {
      var s = arr.slice().sort(function (x, y) { return x - y; });
      return { week: 3 + k, p10: quantile(s, 0.1), p50: quantile(s, 0.5), p90: quantile(s, 0.9) };
    });
    return { scenario: scenario, retention: r0, weeks: out, probability: hits / cfg.runs };
  }

  var api = { CONFIG: CONFIG, simulate: simulate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AdoptionSim = api;
})(typeof window !== 'undefined' ? window : this);
