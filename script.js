function getOrCreateUserId() {
    let id = localStorage.getItem('apx_uid');
    if (!id) {
      id = 'usr_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('apx_uid', id);
    }
    return id;
  }

  const UID = getOrCreateUserId();
  const SKEY = 'apx_data_' + UID; // each user's data is stored under their own key

  function loadState() {
    const raw = localStorage.getItem(SKEY);
    if (raw) return JSON.parse(raw);
    return { ex: [], meals: [], wts: [], water: 0, waterDate: '', streak: 0, lastDay: '', wk: [0, 0, 0, 0, 0, 0, 0], pbs: {} };
  }

  let S = loadState();
  const save = () => localStorage.setItem(SKEY, JSON.stringify(S));

  // ════════════════════════════════════════════
  //  MIDNIGHT DAILY RESET
  //  Resets water intake every day at 12:00 AM
  //  Meals and exercises auto-filter by isToday()
  //  so they visually reset without deletion.
  // ════════════════════════════════════════════
  function dailyReset() {
    const todayStr = new Date().toDateString();
    if (S.waterDate !== todayStr) {
      S.water = 0;
      S.waterDate = todayStr;
      save();
      // Re-render nutrition if already on that page
      if (document.getElementById('pg-nutrition').classList.contains('on')) renderNut();
      if (document.getElementById('pg-dash').classList.contains('on')) renderDash();
    }
  }

  function scheduleNextMidnightReset() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 100); // next midnight + 100ms buffer
    const msUntilMidnight = midnight - now;
    setTimeout(() => {
      dailyReset();
      scheduleNextMidnightReset(); // reschedule for following midnight
    }, msUntilMidnight);
  }

  // ════════════════════════════════════════════
  //  UTILITIES
  // ════════════════════════════════════════════
  const isToday = d => {
    const a = new Date(d),
    b = new Date();
    return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  };

  function toast(m, type = 'ok', t = 2800) {
    const el = document.getElementById('toast');
    el.textContent = m; el.className = 'toast ' + type + ' show';
    setTimeout(() => el.classList.remove('show'), t);
  }

  // ── Streak logic ──
  function checkStreak() {
    const today = new Date().toDateString();
    if (S.lastDay === today) return;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    S.streak = S.lastDay === yesterday ? S.streak + 1 : 1;
    S.lastDay = today;
    save();
  }

  // ════════════════════════════════════════════
  //  NAV
  // ════════════════════════════════════════════
  function go(pg, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
    document.querySelectorAll('.ni').forEach(n => n.classList.remove('on'));
    document.getElementById('pg-' + pg).classList.add('on');
    if (el) el.classList.add('on');
    ({
      dash: renderDash,
      workout: renderWorkout,
      nutrition: renderNut,
      progress: renderProg,
      coach: renderCoach
    })[pg]?.();
    document.getElementById('sb').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
  }

  function toggleSb() {
    document.getElementById('sb').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('show');
  }

  // ════════════════════════════════════════════
  //  VISITOR COUNTER  (CounterAPI v1 — no auth)
  // ════════════════════════════════════════════
  async function trackVisit() {
    try {
      const r = await fetch('https://api.counterapi.dev/v1/apex-fitness-tracker-2025/visits/up');
      const d = await r.json();
      const v = d.value ?? d.count ?? d.result;
      if (v != null) document.getElementById('visCount').textContent = Number(v).toLocaleString();
    }
    catch { document.getElementById('visCount').textContent = '—'; }
  }

  // ════════════════════════════════════════════
  //  DASHBOARD
  // ════════════════════════════════════════════
  function renderDash() {
    document.getElementById('dashDate').textContent = new Date().toLocaleDateString('en-IN',
    {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const te = S.ex.filter(e => isToday(e.date)), tm = S.meals.filter(m => isToday(m.date));
    const cal = te.reduce((s, e) => s + (e.cal || 0), 0);
    const prot = tm.reduce((s, m) => s + (m.p || 0), 0);

    const lw = S.wts.length ? S.wts[S.wts.length - 1].v : '--';
    document.getElementById('sc-cal').innerHTML = cal + '<span class="u"> kcal</span>';
    document.getElementById('sc-cal-n').textContent = cal > 0 ? '↑ ' + cal + ' burned today' : 'Start training!';
    document.getElementById('sc-wo').innerHTML = te.length + '<span class="u"> today</span>';
    document.getElementById('sc-wo-n').textContent = te.length ? '↑ Great work!' : 'No workouts yet';
    document.getElementById('sc-prot').innerHTML = prot + '<span class="u"> g</span>';
    document.getElementById('sc-prot-n').textContent = prot >= 150 ? '✓ Goal reached!' : (150 - prot) + 'g to goal';
    document.getElementById('sc-bw').innerHTML = lw + '<span class="u"> kg</span>';
    document.getElementById('streakNum').textContent = S.streak;


    const days = [...S.wk], ti = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
    days[ti] = cal;
    const mx = Math.max(...days, 1);
    document.getElementById('weekBars').innerHTML = days.map((d, i) => `<div class="bc"><div class="bf ${i === ti ? 'now' : ''}"
      style="height:${Math.max(5, (d / mx) * 100)}%;width:72%;"></div></div>`).join('');
    document.getElementById('weekTotal').textContent = days.reduce((a, b) => a + b, 0) + ' kcal this week';
    const carb = tm.reduce((s, m) => s + (m.c || 0), 0), fat = tm.reduce((s, m) => s + (m.f || 0), 0);
    drawRing(prot, carb, fat);
  }
  function drawRing(p, c, f) {
    const tot = p + c + f || 1,
    r = 42,
    cx = 55,
    cy = 55,
    sw = 12, 
    circ = 2 * Math.PI * r;
    const segs = [
      {
        v: p, col: '#1fd6a0',
        lbl: 'Protein'
      },
      {
        v: c,
        col: '#ff6b2b',
        lbl: 'Carbs'
      },
      {
        v: f,
        col: '#ffaa22',
        lbl: 'Fat'
      }
    ];
    let off = 0, svg = document.getElementById('macroRing');
    svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1c2040" stroke-width="${sw}"/>`;
    segs.forEach(s => { 
      const len = (s.v / tot) * circ,
      el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      el.setAttribute('cx', cx);
      el.setAttribute('cy', cy);
      el.setAttribute('r', r);
      el.setAttribute('fill', 'none');
      el.setAttribute('stroke', s.col);
      el.setAttribute('stroke-width', sw);
      el.setAttribute('stroke-dasharray', `${len} ${circ - len}`);
      el.setAttribute('stroke-dashoffset', circ / 4 - off);
      el.setAttribute('stroke-linecap', 'round');
      svg.appendChild(el);
      off += len;
    });
    document.getElementById('ringLabels').innerHTML = segs.map(s => `<div class="rr"><div class="rr-dot" style="background:${s.col}"></div><div class="rr-nm">${s.lbl}</div><div style="font-weight:600;color:${s.col}">${s.v}g</div></div>`).join('');
  }

  // ════════════════════════════════════════════
  //  WORKOUT
  // ════════════════════════════════════════════
  function addEx() {
    const n = document.getElementById('exName').value.trim();
    if (!n) {
      toast('Enter exercise name', 'err');
      return;
    }
    const ex = { 
      id: Date.now(),
      name: n,
      sets: +document.getElementById('exSets').value || 3,
      reps: +document.getElementById('exReps').value || 10,
      wt: +document.getElementById('exWt').value || 0,
      cat: document.getElementById('exCat').value,
      date: new Date().toISOString() 
    };

    ex.cal = Math.round(ex.cat.includes('Cardio') ? ex.reps * 5 : ex.sets * ex.reps * (ex.wt * 0.05));
    
    const k = n.toLowerCase(), vol = ex.wt * ex.sets * ex.reps;
    
    if (!S.pbs[k] || vol > S.pbs[k].vol) S.pbs[k] = {
      name: n,
      wt: ex.wt,
      sets: ex.sets,
      reps: ex.reps,
      vol,
      date: ex.date
    };
    S.ex.push(ex);
    const ti = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
    S.wk[ti] = (S.wk[ti] || 0) + ex.cal;
    save();
    renderWorkout();
    toast('✓ ' + n + ' logged — ~' + ex.cal + ' kcal', 'ok');
    ['exName', 'exSets', 'exReps', 'exWt'].forEach(id => document.getElementById(id).value = '');
  }
  function delEx(id) {
    S.ex = S.ex.filter(e => e.id !== id);
    save();renderWorkout(); }
  function renderWorkout() {
    const te = S.ex.filter(e => isToday(e.date)), tc = te.reduce((s, e) => s + (e.cal || 0), 0);
    document.getElementById('calBurn').textContent = tc + ' kcal';
    const emo = c => c?.includes('Cardio') ? '🏃' : c?.includes('Flex') ? '🧘' : c?.includes('HIIT') ? '⚡' : '💪';
    document.getElementById('exList').innerHTML = te.length ? te.map(e => `<div class="ex-item"><div class="ex-ico">${emo(e.cat)}</div><div style="flex:1"><div class="ex-n">${e.name}</div><div class="ex-m">${e.cat} · ${e.sets}×${e.reps}${e.wt ? ' @ ' + e.wt + 'kg' : ''}</div></div><div class="ex-k">${e.cal} kcal</div><button class="del" onclick="delEx(${e.id})">✕</button></div>`).join('') : '<div style="color:var(--mut);font-size:.84rem;text-align:center;padding:2rem 0;opacity:.6;">No exercises logged yet 🏋️</div>';
    const pbs = Object.values(S.pbs).slice(0, 8);
    document.getElementById('prGrid').innerHTML = pbs.length ? pbs.map(p => `<div class="card-sm" style="text-align:center;"><div style="font-size:.58rem;color:var(--mut);letter-spacing:.12em;margin-bottom:.2rem;">RECORD</div><div style="font-weight:600;font-size:.8rem;margin-bottom:.22rem;">${p.name}</div><div style="font-family:'Syne';font-size:1.2rem;font-weight:800;color:var(--ora);">${p.wt || 0}kg</div><div style="font-size:.62rem;color:var(--mut);">${p.sets}×${p.reps}</div></div>`).join('') : '<div style="color:var(--mut);font-size:.84rem;opacity:.6;">Log workouts to build records!</div>';
  }

  // ════════════════════════════════════════════
  //  API NINJAS — NUTRITION SEARCH
  // ════════════════════════════════════════════
  // ── Built-in nutrition database (per 100g unless noted) ──
const FOOD_DB = [
// Proteins
{
  k: ['egg', 'eggs', 'boiled egg', 'fried egg', 'scrambled egg'],
  name: 'Egg (1 large)',
  serving_size_g: 60,
  calories: 78,
  protein_g: 6,
  carbohydrates_total_g: 1,
  fat_total_g: 5
},
{
  k: ['chicken breast', 'chicken', 'grilled chicken', 'boiled chicken'],
  name: 'Chicken Breast (100g)',
  serving_size_g: 100,
  calories: 165,
  protein_g: 31,
  carbohydrates_total_g: 0,
  fat_total_g: 4
},
{
  k: ['chicken leg', 'chicken thigh', 'chicken drumstick'],
  name: 'Chicken Thigh (100g)',
  serving_size_g: 100,
  calories: 209,
  protein_g: 26,
  carbohydrates_total_g: 0,
  fat_total_g: 11
},
{
  k: ['tuna', 'canned tuna', 'tuna fish'],
  name: 'Tuna (100g)',
  serving_size_g: 100,
  calories: 116,
  protein_g: 26,
  carbohydrates_total_g: 0,
  fat_total_g: 1
},
{
  k: ['salmon', 'grilled salmon', 'baked salmon'],
  name: 'Salmon (100g)',
  serving_size_g: 100,
  calories: 208,
  protein_g: 20,
  carbohydrates_total_g: 0,
  fat_total_g: 13
},
{
  k: ['paneer'],
  name: 'Paneer (100g)',
  serving_size_g: 100,
  calories: 265,
  protein_g: 18,
  carbohydrates_total_g: 3,
  fat_total_g: 20
},
{
  k: ['tofu'],
  name: 'Tofu (100g)',
  serving_size_g: 100,
  calories: 76,
  protein_g: 8,
  carbohydrates_total_g: 2,
  fat_total_g: 5
},
{
  k: ['protein shake', 'whey protein', 'protein powder'],
  name: 'Protein Shake (1 scoop)',
  serving_size_g: 35,
  calories: 130,
  protein_g: 25,
  carbohydrates_total_g: 4,
  fat_total_g: 2
},
{
  k: ['beef', 'ground beef', 'minced beef'],
  name: 'Beef (100g)',
  serving_size_g: 100,
  calories: 250,
  protein_g: 26,
  carbohydrates_total_g: 0,
  fat_total_g: 17
},
{
  k: ['mutton', 'lamb'],
  name: 'Mutton (100g)',
  serving_size_g: 100,
  calories: 258,
  protein_g: 25,
  carbohydrates_total_g: 0,
  fat_total_g: 17
},
{
  k: ['fish', 'white fish', 'tilapia', 'cod'],
  name: 'White Fish (100g)',
  serving_size_g: 100,
  calories: 96,
  protein_g: 20,
  carbohydrates_total_g: 0,
  fat_total_g: 2
},
// Dairy
{
  k: ['milk', 'whole milk', 'full fat milk'],
  name: 'Whole Milk (200ml)',
  serving_size_g: 200,
  calories: 122,
  protein_g: 6,
  carbohydrates_total_g: 9,
  fat_total_g: 7
},
{
  k: ['greek yogurt', 'greek yoghurt', 'curd', 'dahi'],
  name: 'Greek Yogurt / Curd (150g)',
  serving_size_g: 150,
  calories: 130,
  protein_g: 12,
  carbohydrates_total_g: 8,
  fat_total_g: 5
},
{
  k: ['cheese', 'cheddar'],
  name: 'Cheese (30g)',
  serving_size_g: 30,
  calories: 120,
  protein_g: 7,
  carbohydrates_total_g: 0,
  fat_total_g: 10
},
// Carbs / Grains
{
  k: ['rice', 'white rice', 'boiled rice', 'cooked rice', 'steamed rice'],
  name: 'White Rice (1 cup cooked)',
  serving_size_g: 186,
  calories: 242,
  protein_g: 4,
  carbohydrates_total_g: 53,
  fat_total_g: 0
},
{
  k: ['brown rice'],
  name: 'Brown Rice (1 cup cooked)',
  serving_size_g: 195,
  calories: 216,
  protein_g: 5,
  carbohydrates_total_g: 45,
  fat_total_g: 2
},
{
  k: ['roti', 'chapati', 'wheat roti'],
  name: 'Roti / Chapati (1 piece)',
  serving_size_g: 40,
  calories: 104,
  protein_g: 3,
  carbohydrates_total_g: 18,
  fat_total_g: 3
},
{
  k: ['paratha'],
  name: 'Paratha (1 piece)',
  serving_size_g: 70,
  calories: 200,
  protein_g: 4,
  carbohydrates_total_g: 28,
  fat_total_g: 8
},
{
  k: ['bread', 'white bread', 'toast'],
  name: 'White Bread (1 slice)',
  serving_size_g: 30,
  calories: 79,
  protein_g: 3,
  carbohydrates_total_g: 15,
  fat_total_g: 1
},
{
  k: ['brown bread', 'whole wheat bread', 'multigrain bread'],
  name: 'Brown Bread (1 slice)',
  serving_size_g: 32,
  calories: 81,
  protein_g: 4,
  carbohydrates_total_g: 14,
  fat_total_g: 1
},
{
  k: ['oats', 'oatmeal', 'porridge'],
  name: 'Oats (1 cup cooked)',
  serving_size_g: 234,
  calories: 166,
  protein_g: 6,
  carbohydrates_total_g: 28,
  fat_total_g: 4
},
{
  k: ['pasta', 'spaghetti', 'noodles'],
  name: 'Pasta (1 cup cooked)',
  serving_size_g: 140,
  calories: 220,
  protein_g: 8,
  carbohydrates_total_g: 43,
  fat_total_g: 1
},
{
  k: ['potato', 'boiled potato', 'aloo'],
  name: 'Potato (1 medium)',
  serving_size_g: 150,
  calories: 130,
  protein_g: 3,
  carbohydrates_total_g: 30,
  fat_total_g: 0
},
{
  k: ['sweet potato'],
  name: 'Sweet Potato (1 medium)',
  serving_size_g: 150,
  calories: 135,
  protein_g: 2,
  carbohydrates_total_g: 31,
  fat_total_g: 0
},
{
  k: ['dal', 'lentils', 'daal', 'toor dal', 'moong dal'],
  name: 'Dal (1 cup cooked)',
  serving_size_g: 198,
  calories: 230,
  protein_g: 18,
  carbohydrates_total_g: 40,
  fat_total_g: 1
},
// Fats
{
  k: ['avocado'],
  name: 'Avocado (half)',
  serving_size_g: 100,
  calories: 160,
  protein_g: 2,
  carbohydrates_total_g: 9,
  fat_total_g: 15
},
{
  k: ['peanut butter', 'almond butter'],
  name: 'Peanut Butter (2 tbsp)',
  serving_size_g: 32,
  calories: 190,
  protein_g: 8,
  carbohydrates_total_g: 7,
  fat_total_g: 16
},
{
  k: ['almonds', 'almond'],
  name: 'Almonds (handful)',
  serving_size_g: 28,
  calories: 164,
  protein_g: 6,
  carbohydrates_total_g: 6,
  fat_total_g: 14
},
{
  k: ['peanuts', 'groundnuts'],
  name: 'Peanuts (handful)',
  serving_size_g: 28,
  calories: 161,
  protein_g: 7,
  carbohydrates_total_g: 5,
  fat_total_g: 14
},
{
  k: ['olive oil', 'oil', 'cooking oil'],
  name: 'Olive Oil (1 tbsp)',
  serving_size_g: 14,
  calories: 119,
  protein_g: 0,
  carbohydrates_total_g: 0,
  fat_total_g: 14
},
// Fruits
{
  k: ['banana'],
  name: 'Banana (1 medium)',
  serving_size_g: 120,
  calories: 105,
  protein_g: 1,
  carbohydrates_total_g: 27,
  fat_total_g: 0
},
{
  k: ['apple'],
  name: 'Apple (1 medium)',
  serving_size_g: 182,
  calories: 95,
  protein_g: 0,
  carbohydrates_total_g: 25,
  fat_total_g: 0
},
{
  k: ['orange'],
  name: 'Orange (1 medium)',
  serving_size_g: 131,
  calories: 62,
  protein_g: 1,
  carbohydrates_total_g: 15,
  fat_total_g: 0
},
{
  k: ['mango'],
  name: 'Mango (1 cup sliced)',
  serving_size_g: 165,
  calories: 107,
  protein_g: 1,
  carbohydrates_total_g: 28,
  fat_total_g: 0
},
// Vegetables
{
  k: ['broccoli'],
  name: 'Broccoli (1 cup)',
  serving_size_g: 91,
  calories: 31,
  protein_g: 3,
  carbohydrates_total_g: 6,
  fat_total_g: 0
},
{
  k: ['spinach', 'palak'],
  name: 'Spinach (1 cup)',
  serving_size_g: 30,
  calories: 7,
  protein_g: 1,
  carbohydrates_total_g: 1,
  fat_total_g: 0
},
{
  k: ['salad', 'green salad', 'mixed salad'],
  name: 'Mixed Salad (1 bowl)',
  serving_size_g: 150,
  calories: 35,
  protein_g: 2,
  carbohydrates_total_g: 6,
  fat_total_g: 1
},
// Popular meals
{
  k: ['chicken and rice', 'chicken rice'],
  name: 'Chicken & Rice (meal)',
  serving_size_g: 350,
  calories: 450,
  protein_g: 40,
  carbohydrates_total_g: 52,
  fat_total_g: 5
},
{
  k: ['biryani', 'chicken biryani'],
  name: 'Chicken Biryani (1 serving)',
  serving_size_g: 300,
  calories: 450,
  protein_g: 22,
  carbohydrates_total_g: 58,
  fat_total_g: 14
},
{
  k: ['pizza', 'cheese pizza'],
  name: 'Pizza (1 slice)',
  serving_size_g: 107,
  calories: 285,
  protein_g: 12,
  carbohydrates_total_g: 36,
  fat_total_g: 10
},
{
  k: ['burger', 'hamburger', 'cheeseburger'],
  name: 'Burger (1)',
  serving_size_g: 200,
  calories: 540,
  protein_g: 25,
  carbohydrates_total_g: 45,
  fat_total_g: 28
},
{
  k: ['sandwich', 'sub'],
  name: 'Sandwich (1)',
  serving_size_g: 200,
  calories: 340,
  protein_g: 16,
  carbohydrates_total_g: 44,
  fat_total_g: 10
},
{
  k: ['samosa'],
  name: 'Samosa (1)',
  serving_size_g: 100,
  calories: 262,
  protein_g: 5,
  carbohydrates_total_g: 32,
  fat_total_g: 13
},
{
  k: ['idli'],
  name: 'Idli (2 pieces)',
  serving_size_g: 120,
  calories: 130,
  protein_g: 5,
  carbohydrates_total_g: 26,
  fat_total_g: 1
},
{
  k: ['dosa', 'masala dosa'],
  name: 'Dosa (1)',
  serving_size_g: 150,
  calories: 168,
  protein_g: 5,
  carbohydrates_total_g: 30,
  fat_total_g: 4
},
{
  k: ['upma'],
  name: 'Upma (1 bowl)',
  serving_size_g: 200,
  calories: 210,
  protein_g: 5,
  carbohydrates_total_g: 34,
  fat_total_g: 6
},
{
  k: ['poha'],
  name: 'Poha (1 bowl)',
  serving_size_g: 200,
  calories: 250,
  protein_g: 5,
  carbohydrates_total_g: 45,
  fat_total_g: 6
},
{
  k: ['dal rice', 'dal and rice'],
  name: 'Dal Rice (1 plate)',
  serving_size_g: 400,
  calories: 450,
  protein_g: 18,
  carbohydrates_total_g: 85,
  fat_total_g: 4
},
// Beverages
{
  k: ['coffee', 'black coffee'],
  name: 'Black Coffee',
  serving_size_g: 240,
  calories: 2,
  protein_g: 0,
  carbohydrates_total_g: 0,
  fat_total_g: 0
},
{
  k: ['tea', 'chai', 'milk tea'],
  name: 'Milk Tea / Chai (1 cup)',
  serving_size_g: 240,
  calories: 60,
  protein_g: 2,
  carbohydrates_total_g: 8,
  fat_total_g: 2
},
{
  k: ['orange juice', 'fruit juice'],
  name: 'Orange Juice (1 glass)',
  serving_size_g: 240,
  calories: 111,
  protein_g: 2,
  carbohydrates_total_g: 26,
  fat_total_g: 0
}
];

  function lookupFood(query) {
    const q = query.toLowerCase().trim();
    // Try to extract a number prefix like "2 eggs", "3 rotis"
    const numMatch = q.match(/^(\d+\.?\d*)\s+(.+)/);
    const multiplier = numMatch ? parseFloat(numMatch[1]) : 1;
    const foodTerm = numMatch ? numMatch[2] : q;

    // Score each food entry
    let best = null, bestScore = 0;
    for (const food of FOOD_DB) {
      for (const kw of food.k) {
        if (foodTerm.includes(kw) || kw.includes(foodTerm)) {
          const score = kw.length;
          if (score > bestScore) { bestScore = score; best = food; }
        }
      }
    }
    if (!best) return null;
    // Scale by multiplier
    return {
      name: multiplier !== 1 ? `${multiplier}× ${best.name}` : best.name,
      serving_size_g: Math.round(best.serving_size_g * multiplier),
      calories: Math.round(best.calories * multiplier),
      protein_g: Math.round(best.protein_g * multiplier),
      carbohydrates_total_g: Math.round(best.carbohydrates_total_g * multiplier),
      fat_total_g: Math.round(best.fat_total_g * multiplier)
    };
  }

  function searchFood() {
    const q = document.getElementById('foodQuery').value.trim();
    if (!q) { toast('Type a food to search', 'err'); return; }
    const res = document.getElementById('foodResults'); res.innerHTML = ''; res.classList.remove('show');

    // Split query by commas, "and", "&", "+" to handle compound meals
    const parts = q.split(/,|\band\b|&|\+/i).map(s => s.trim()).filter(Boolean);
    const data = [];
    const notFound = [];

    for (const part of parts) {
      const result = lookupFood(part);
      if (result) data.push(result);
      else notFound.push(part);
    }

    if (!data.length) {
      toast('Food not recognised — try: "2 eggs", "chicken breast", "1 cup rice"', 'err', 4000);
      return;
    }
    if (notFound.length) toast(`"${notFound.join(', ')}" not found — other items loaded`, 'err', 3500);

    res.innerHTML = data.map((item, i) => `
      <div class="food-result-item" onclick="selectFood(${i})">
        <div class="food-result-name">${item.name} <span style="font-size:.68rem;color:var(--mut);">(${item.serving_size_g}g)</span></div>
        <div class="food-result-meta">🔥 ${item.calories} kcal &nbsp;·&nbsp; 🥩 ${item.protein_g}g protein &nbsp;·&nbsp; 🍞 ${item.carbohydrates_total_g}g carbs &nbsp;·&nbsp; 🥑 ${item.fat_total_g}g fat</div>
      </div>`).join('');
    res.classList.add('show');
    window._foodData = data;

    const tot = data.reduce((a, item) => ({ cal: a.cal + item.calories, p: a.p + item.protein_g, c: a.c + item.carbohydrates_total_g, f: a.f + item.fat_total_g }), { cal: 0, p: 0, c: 0, f: 0 });
    document.getElementById('mealName').value = q;
    document.getElementById('mealCal').value = tot.cal;
    document.getElementById('mealProt').value = tot.p;
    document.getElementById('mealCarb').value = tot.c;
    document.getElementById('mealFat').value = tot.f;
    toast('✓ Macros calculated!', 'ok');
  }
  function selectFood(i) {
    const item = window._foodData[i];
    document.getElementById('mealName').value = item.name;
    document.getElementById('mealCal').value = Math.round(item.calories);
    document.getElementById('mealProt').value = Math.round(item.protein_g);
    document.getElementById('mealCarb').value = Math.round(item.carbohydrates_total_g);
    document.getElementById('mealFat').value = Math.round(item.fat_total_g);
    document.getElementById('foodResults').classList.remove('show');
    toast('✓ ' + item.name + ' selected', 'ok');
  }
  // close dropdown on outside click
  document.addEventListener('click', e => { if (!e.target.closest('.food-search-box')) document.getElementById('foodResults').classList.remove('show'); });

  // ════════════════════════════════════════════
  //  NUTRITION
  // ════════════════════════════════════════════
  function addMeal() {
    const n = document.getElementById('mealName').value.trim(); if (!n) { toast('Enter meal name', 'err'); return; }
    const m = { id: Date.now(), name: n, cal: +document.getElementById('mealCal').value || 0, p: +document.getElementById('mealProt').value || 0, c: +document.getElementById('mealCarb').value || 0, f: +document.getElementById('mealFat').value || 0, date: new Date().toISOString() };
    S.meals.push(m); save(); renderNut(); toast('✓ ' + n + ' logged!', 'ok');
    ['mealName', 'mealCal', 'mealProt', 'mealCarb', 'mealFat', 'foodQuery'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('foodResults').classList.remove('show');
  }
  function addWater() { S.water = (S.water || 0) + .25; S.waterDate = new Date().toDateString(); save(); renderNut(); toast('💧 +250ml water', 'ok'); }
  function delMeal(id) { S.meals = S.meals.filter(m => m.id !== id); save(); renderNut(); }
  function renderNut() {
    document.getElementById('nutApiStatus').textContent = 'API ready ✓';
    document.getElementById('nutApiStatus').style.color = 'var(--grn)';
    const tm = S.meals.filter(m => isToday(m.date));
    const t = tm.reduce((a, m) => ({ cal: a.cal + (m.cal || 0), p: a.p + (m.p || 0), c: a.c + (m.c || 0), f: a.f + (m.f || 0) }), { cal: 0, p: 0, c: 0, f: 0 });
    document.getElementById('nutCal').textContent = t.cal;
    document.getElementById('nutProt').textContent = t.p + 'g';
    document.getElementById('nutCarb').textContent = t.c + 'g';
    document.getElementById('nutFat').textContent = t.f + 'g';
    document.getElementById('nutWater').textContent = (S.water || 0).toFixed(2) + 'L';
    document.getElementById('mealCount').textContent = tm.length + ' meals';
    document.getElementById('mealList').innerHTML = tm.length ? tm.map(m => `<div class="ex-item"><div class="ex-ico">🍽️</div><div style="flex:1"><div class="ex-n">${m.name}</div><div class="ex-m">${m.cal} kcal · P:${m.p}g C:${m.c}g F:${m.f}g</div></div><button class="del" onclick="delMeal(${m.id})">✕</button></div>`).join('') : '<div style="color:var(--mut);font-size:.84rem;opacity:.6;text-align:center;padding:1.5rem 0;">No meals logged 🥗</div>';
    const tot2 = t.p + t.c + t.f || 1;
    document.getElementById('macroBars').innerHTML = [['Protein', t.p, '#1fd6a0'], ['Carbs', t.c, '#ff6b2b'], ['Fat', t.f, '#ffaa22']].map(([n, v, col]) => `<div class="mbr"><div class="mbr-nm">${n}</div><div class="mbr-tr"><div class="mbr-fi" style="width:${Math.min(100, (v / tot2) * 100)}%;background:${col};"></div></div><div class="mbr-pc" style="color:${col};font-size:.7rem;min-width:30px;text-align:right;">${v}g</div></div>`).join('');
  }

  // ════════════════════════════════════════════
  //  PROGRESS
  // ════════════════════════════════════════════
  function logW() {
    const v = parseFloat(document.getElementById('bwInp').value);
    if (!v || v < 10 || v > 400) { toast('Enter valid weight (30–300 kg)', 'err'); return; }
    S.wts.push({ v, date: new Date().toISOString() }); save(); renderProg(); toast('✓ ' + v + 'kg logged!', 'ok');
    document.getElementById('bwInp').value = '';
  }
  function renderProg() {
    const ws = S.wts, latest = ws.length ? ws[ws.length - 1].v : null;
    document.getElementById('bwBadge').textContent = latest ? latest + ' kg' : '-- kg';
    const svg = document.getElementById('wSvg'); svg.innerHTML = '';
    if (ws.length >= 2) {
      const vals = ws.slice(-14).map(w => w.v), mn = Math.min(...vals) - 2, mx = Math.max(...vals) + 2;
      const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 360},${120 - ((v - mn) / (mx - mn)) * 110}`).join(' ');
      svg.innerHTML = `<defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff6b2b" stop-opacity=".18"/><stop offset="100%" stop-color="#ff6b2b" stop-opacity="0"/></linearGradient></defs><polygon points="0,120 ${pts} 360,120" fill="url(#wg)"/><polyline points="${pts}" fill="none" stroke="#ff6b2b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` + vals.map((v, i) => `<circle cx="${(i / (vals.length - 1)) * 360}" cy="${120 - ((v - mn) / (mx - mn)) * 110}" r="4" fill="#ff6b2b"/>`).join('');
    } else { svg.innerHTML = `<text x="180" y="65" fill="#434d7a" text-anchor="middle" font-family="Outfit" font-size="13">${ws.length === 1 ? 'Log more entries to see trend' : 'No weight data yet'}</text>`; }
    const pbs = Object.values(S.pbs).sort((a, b) => b.vol - a.vol).slice(0, 5);
    document.getElementById('pbList').innerHTML = pbs.length ? pbs.map((p, i) => `<div class="pb-item"><div class="pb-r">${['🥇', '🥈', '🥉', '4', '5'][i]}</div><div style="flex:1"><div style="font-size:.86rem;font-weight:500;">${p.name}</div><div style="font-size:.74rem;color:var(--grn);">${p.wt}kg × ${p.sets}×${p.reps}</div></div><div style="font-size:.68rem;color:var(--mut);">${new Date(p.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</div></div>`).join('') : '<div style="color:var(--mut);font-size:.84rem;opacity:.6;">Log workouts to set records 🏆</div>';
    const sess = {}; S.ex.forEach(e => { const d = e.date.split('T')[0]; if (!sess[d]) sess[d] = { n: 0, cal: 0 }; sess[d].n++; sess[d].cal += (e.cal || 0); });
    document.getElementById('totalSess').textContent = Object.keys(sess).length + ' sessions';
    document.getElementById('sessGrid').innerHTML = Object.entries(sess).sort((a, b) => new Date(b[0]) - new Date(a[0])).slice(0, 12).map(([d, data]) => `<div class="card-sm" style="text-align:center;"><div style="font-size:.62rem;color:var(--mut);margin-bottom:.2rem;">${new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</div><div style="font-family:'Syne';font-size:1.35rem;font-weight:800;color:var(--ora);">${data.cal}</div><div style="font-size:.62rem;color:var(--mut);">kcal · ${data.n} ex</div></div>`).join('') || '<div style="color:var(--mut);font-size:.84rem;opacity:.6;">No sessions logged yet.</div>';
  }

  // ════════════════════════════════════════════
  //  COACH (rule-based)
  // ════════════════════════════════════════════
  const TIPS = ['Progressive overload: add weight or reps every 1–2 weeks.', 'Sleep 7–9 hours — muscles grow during recovery, not training.', 'Protein within 30 mins post-workout speeds muscle repair.', 'Stay hydrated — aim for at least 2L of water daily.', 'Compound lifts give the most return per session.', 'Track your workouts — what gets measured gets improved.', 'Rest days are growth days. Muscles need time to rebuild.', 'Consistency beats intensity. Show up every day.', 'Eat protein first at meals to hit your daily target easier.', 'Warm up properly — 5 mins saves 5 weeks of injury.'];

  function getReply(q) {
    const te = S.ex.filter(e => isToday(e.date)), tm = S.meals.filter(m => isToday(m.date));
    const cal = te.reduce((s, e) => s + (e.cal || 0), 0), prot = tm.reduce((s, m) => s + (m.p || 0), 0), water = S.water || 0;
    const lw = q.toLowerCase();
    if (lw.includes('workout plan') || lw.includes('today\'s plan')) {
      if (te.length) return `You've already logged ${te.length} exercise(s) today, burning ${cal} kcal 💪 Consider adding accessory work or a stretch session. Keep going!`;
      return `Today's plan:\n• Squat — 4×8 at your working weight\n• Bench Press — 3×10\n• Barbell Row — 3×10\n• Plank — 3×45s\n\nAim for 60–75 mins. Log each set as you go!`;
    }
    if (lw.includes('nutrition') || lw.includes('food') || lw.includes('eating')) {
      if (!tm.length) return `No meals logged yet! 🥗 Start with a protein-rich meal — aim for 30–40g in your first sitting.`;
      if (prot < 80) return `You've logged ${tm.length} meals (${tm.reduce((s, m) => s + m.cal, 0)} kcal) but only ${prot}g protein. Add chicken, eggs, Greek yogurt, or a shake to hit 150g!`;
      if (prot >= 150) return `Excellent nutrition day! ✅ ${prot}g protein and ${tm.reduce((s, m) => s + m.cal, 0)} kcal. Time carbs around your workouts for best performance.`;
      return `Good progress! ${prot}g protein from ${tm.length} meal(s). You need ${150 - prot}g more to hit your goal. Keep logging!`;
    }
    if (lw.includes('progress') || lw.includes('improve')) {
      const pbCount = Object.keys(S.pbs).length;
      if (!pbCount) return `Log workouts consistently for 2 weeks first. Data is your best coach — start tracking today!`;
      return `You have ${pbCount} personal record(s)! 🏆 To keep improving:\n• Add 2.5–5kg every 1–2 weeks\n• Prioritise sleep and protein\n• Deload every 4th week`;
    }
    if (lw.includes('motivat')) {
      const m = ['You are already ahead of everyone still on the couch 🔥', 'Progress is progress, no matter how small. Keep logging.', 'The best version of you is built one session at a time.', 'Champions adapt. Let\'s go! 💪', 'Every rep is a vote for the person you\'re becoming.'];
      return m[Math.floor(Math.random() * m.length)];
    }
    if (lw.includes('water')) {
      if (water >= 2) return `Hydration goal hit ✅ You've had ${water.toFixed(2)}L today. On hard training days aim for 3L.`;
      return `You've had ${water.toFixed(2)}L today. Aim for at least 2L daily — use the +250ml button in Nutrition to track it!`;
    }
    if (lw.includes('strongest') || lw.includes('best exercise') || lw.includes('best lift')) {
      const pbs = Object.values(S.pbs).sort((a, b) => b.vol - a.vol);
      if (!pbs.length) return `Log some workouts first and I'll tell you your strongest lift!`;
      return `Your strongest lift by volume is ${pbs[0].name} — ${pbs[0].wt}kg × ${pbs[0].sets}×${pbs[0].reps} 🏆 Keep pushing with progressive overload!`;
    }
    return TIPS[Math.floor(Math.random() * TIPS.length)];
  }
  function addChatMsg(role, txt) {
    const c = document.getElementById('chatMsgs'), d = document.createElement('div');
    d.className = 'msg ' + (role === 'user' ? 'u' : 'a');
    const t = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    d.innerHTML = `<div class="bub">${txt.replace(/\n/g, '<br>')}</div><div class="msg-t">${t}</div>`;
    c.appendChild(d); c.scrollTop = c.scrollHeight;
  }
  function ask(custom) {
    const inp = document.getElementById('chatInp'), msg = custom || inp.value.trim(); if (!msg) return; inp.value = '';
    addChatMsg('user', msg);
    setTimeout(() => addChatMsg('ai', getReply(msg)), 380);
  }
  function renderCoach() {
    const te = S.ex.filter(e => isToday(e.date)), tm = S.meals.filter(m => isToday(m.date));
    const chks = [{ l: 'Log a workout', d: te.length > 0 }, { l: '150g+ protein', d: tm.reduce((s, m) => s + (m.p || 0), 0) >= 150 }, { l: 'Log 2+ meals', d: tm.length >= 2 }, { l: '2L+ water', d: (S.water || 0) >= 2 }, { l: 'Log body weight', d: S.wts.some(w => isToday(w.date)) }];
    document.getElementById('checks').innerHTML = chks.map(c => `<div class="chk-item"><div class="chk-box ${c.d ? 'done' : ''}">${c.d ? '✓' : ''}</div><div style="${c.d ? 'color:var(--mut);text-decoration:line-through;' : ''}">${c.l}</div></div>`).join('');
    document.getElementById('dailyTip').textContent = TIPS[new Date().getDate() % TIPS.length];
    const cal = te.reduce((s, e) => s + (e.cal || 0), 0), prot = tm.reduce((s, m) => s + (m.p || 0), 0);
    document.getElementById('quickStats').innerHTML = `Workouts today: <strong style="color:var(--txt)">${te.length}</strong><br>Cal burned: <strong style="color:var(--ora)">${cal}</strong><br>Cal eaten: <strong style="color:var(--txt)">${tm.reduce((s, m) => s + m.cal, 0)}</strong><br>Protein: <strong style="color:var(--grn)">${prot}g</strong><br>Water: <strong style="color:#38bdf8">${(S.water || 0).toFixed(2)}L</strong><br>Streak: <strong style="color:var(--ora)">${S.streak} days</strong>`;
  }

  // ════════════════════════════════════════════
  //  FEEDBACK
  // ════════════════════════════════════════════
  let fbRating = 0, fbCat = 'General';
  // Feedback is shared across users (stored globally, not per-user)
  const fbData = JSON.parse(localStorage.getItem('apxFb') || '[]');
  const pollData = JSON.parse(localStorage.getItem('apxPoll') || '{"y":0,"n":0}');
  function rate(v) { fbRating = v; const lbls = ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent 🤩']; document.getElementById('rateLbl').textContent = lbls[v]; document.querySelectorAll('.star').forEach(s => s.classList.toggle('on', +s.dataset.v <= v)); }
  function pickCat(el, cat) { fbCat = cat; document.querySelectorAll('#catChips .chip').forEach(c => c.classList.remove('on')); el.classList.add('on'); }
  function submitFb() {
    const msg = document.getElementById('fbMsg').value.trim(); if (!msg) { toast('Write a message first', 'err'); return; }
    const name = document.getElementById('fbName').value.trim() || 'Anonymous';
    fbData.push({ name, rating: fbRating, cat: fbCat, msg, time: new Date().toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) });
    localStorage.setItem('apxFb', JSON.stringify(fbData)); renderFbLog();
    document.getElementById('fbMsg').value = ''; document.getElementById('fbName').value = ''; fbRating = 0;
    document.querySelectorAll('.star').forEach(s => s.classList.remove('on')); document.getElementById('rateLbl').textContent = 'Click to rate';
    toast('✓ Thanks for your feedback!', 'ok');
  }
  function renderFbLog() {
    const el = document.getElementById('fbLog');
    if (!fbData.length) 
    { el.innerHTML = '<div style="color:var(--mut);font-size:.78rem;opacity:.7;">No submissions yet.</div>'; return; 

    }
    el.innerHTML = fbData.slice(-4).reverse().map(f => `<div class="fb-entry"><div style="display:flex;justify-content:space-between;margin-bottom:.18rem;"><span style="font-weight:600;color:var(--txt);">${f.name}</span><span style="font-size:.62rem;color:var(--mut);">${f.time}</span></div><div style="font-size:.68rem;color:var(--ora);margin-bottom:.15rem;">${'★'.repeat(f.rating || 0)} · ${f.cat}</div><div style="color:var(--mut);">${f.msg.slice(0, 80)}${f.msg.length > 80 ? '…' : ''}</div></div>`).join('');
  }
  function poll(v) { pollData[v]++; localStorage.setItem('apxPoll', JSON.stringify(pollData)); const tot = pollData.y + pollData.n; document.getElementById('pollRes').textContent = `👍 ${Math.round(pollData.y / tot * 100)}%  👎 ${Math.round(pollData.n / tot * 100)}%  (${tot} votes)`; toast('Vote recorded! 🙌', 'ok'); }

  // ════════════════════════════════════════════
  //  INIT
  // ════════════════════════════════════════════
  checkStreak();
  dailyReset();           // reset water if new day
  scheduleNextMidnightReset(); // schedule future resets at 12:00 AM
  document.getElementById('userIdTag').textContent = UID;
  renderDash(); renderWorkout(); renderNut(); renderProg(); renderFbLog();
  if (pollData.y + pollData.n) { const tot = pollData.y + pollData.n; document.getElementById('pollRes').textContent = `👍 ${Math.round(pollData.y / tot * 100)}%  👎 ${Math.round(pollData.n / tot * 100)}%  (${tot} votes)`; }
  trackVisit(); // hit CounterAPI on load
