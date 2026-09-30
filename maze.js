'use strict';
// maze.js – 칸 연결 계산, 한붓길 찾기, 번호 붙이기 (화면을 다루는 코드 없음)
// 원리: 모든 칸을 한 번씩만 지나며 이웃한 칸으로만 이어지는 길을 무작위로 찾고,
//       그 길 순서대로 1, 2, 3 … 을 적는다.

const SHAPES = [
  { id: 'square', name: '네모 (기존 형태)', dirs: '4방향', level: 2, build: shapeSquare },
  { id: 'brick', name: '벽돌 쌓기', dirs: '최대 6방향', level: 2, build: shapeBrick },
  { id: 'hex', name: '육각형 벌집', dirs: '6방향', level: 3, build: shapeHex },
  { id: 'tri', name: '삼각형 조각', dirs: '3방향', level: 1, build: shapeTri },
  { id: 'polar', name: '원형 과녁', dirs: '고리 따라 + 안팎', level: 2, build: shapePolar },
  { id: 'spiral', name: '달팽이 나선', dirs: '4방향', level: 1, build: shapeSpiral },
  { id: 'heart', name: '하트 실루엣', dirs: '4방향', level: 2, build: shapeHeart },
  { id: 'star', name: '별 실루엣', dirs: '4방향', level: 2, build: shapeStar },
  { id: 'tree', name: '나무 실루엣', dirs: '4방향', level: 2, build: shapeTree },
  { id: 'voronoi', name: '조각보 (불규칙 칸)', dirs: '제각각', level: 3, build: shapeVoronoi },
  { id: 'stones', name: '징검다리 (점과 선)', dirs: '선으로 이어진 곳만', level: 2, build: shapeStones }
];

// ---------- 순서(수열) ----------
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const cycleOf = (list, n) => range(n, i => list[i % list.length]);

// 원주율 자릿수 (마친 공식 π = 16·arctan(1/5) − 4·arctan(1/239), 큰 수 계산)
function piDigits(count) {
  const scale = 10n ** BigInt(count + 10);
  const arctanInv = x => {
    const X = BigInt(x), X2 = X * X;
    let term = scale / X, sum = term, k = 1n, sign = -1n;
    while (term !== 0n) {
      term /= X2;
      sum += sign * (term / (2n * k + 1n));
      sign = -sign; k++;
    }
    return sum;
  };
  return (16n * arctanInv(5) - 4n * arctanInv(239)).toString().slice(0, count);
}

// 자연상수 e 자릿수 (e = 1/0! + 1/1! + 1/2! + …)
function eDigits(count) {
  const scale = 10n ** BigInt(count + 10);
  let term = scale, sum = 0n, k = 1n;
  while (term !== 0n) { sum += term; term /= k; k++; }
  return sum.toString().slice(0, count);
}

function primes(n) {
  const list = [];
  for (let x = 2; list.length < n; x++) {
    if (list.every(p => p * p > x || x % p !== 0)) list.push(x);
  }
  return list.map(String);
}

// 소수점 아래를 4자리씩 띄어 쓰기: 3.1415 9265 3589 …
function groupDecimals(digits) {
  return digits[0] + '.' + (digits.slice(1).match(/.{1,4}/g) || []).join(' ');
}

const FIB = (() => { const f = [1, 1]; while (f.length < 30) f.push(f[f.length - 1] + f[f.length - 2]); return f.map(String); })();
const POW2 = range(21, i => String(2 ** i));
const FACT_MAX = 10;

// 팩토리얼: n! → n → n−1 → … → 1 → 결과 (1!은 1! → 1), 10! 다음은 다시 1!
function factorialTokens(n) {
  const out = [];
  for (let k = 1; out.length < n; k = k === FACT_MAX ? 1 : k + 1) {
    let f = 1n;
    for (let j = 2n; j <= BigInt(k); j++) f *= j;
    out.push(k + '!');
    if (k > 1) for (let j = k; j >= 1; j--) out.push(String(j));
    out.push(f.toString());
  }
  return out.slice(0, n);
}

function factorialHint(labels) {
  const ks = [];
  labels.forEach(t => {
    if (t.endsWith('!')) { const k = parseInt(t, 10); if (!ks.includes(k)) ks.push(k); }
  });
  ks.sort((a, b) => a - b);
  const parts = ks.map(k => {
    let f = 1n;
    for (let j = 2n; j <= BigInt(k); j++) f *= j;
    return k === 1 ? '1! = 1' : `${k}! = ${range(k, i => k - i).join('×')} = ${f}`;
  });
  return { title: '팩토리얼 (n!)', lines: parts, note: `칸 순서: 3! → 3 → 2 → 1 → 6 처럼 곱하는 수를 차례로 지나 결과로 가요.${ks.length === FACT_MAX ? ' 10! 다음에는 다시 1!부터.' : ''}` };
}

// make(n): 칸 n개에 들어갈 글자 목록, hint(labels): 문제지 위에 보여 줄 참고표, ref: 참고표를 보며 푸는 순서
const SEQUENCES = [
  { id: 'one', group: '기본', name: '1씩 세기', make: n => range(n, i => String(i + 1)) },
  { id: 'two', group: '기본', name: '2씩 뛰어 세기', make: n => range(n, i => String(2 * (i + 1))) },
  { id: 'five', group: '기본', name: '5씩 뛰어 세기', make: n => range(n, i => String(5 * (i + 1))) },
  { id: 'down', group: '기본', name: '거꾸로 세기', make: n => range(n, i => String(n - i)) },
  { id: 'abc', group: '기본', name: '알파벳 A→Z (반복)', make: n => range(n, i => String.fromCharCode(65 + i % 26)), cycle: 'A→B→…→Z' },
  { id: 'kor', group: '기본', name: '자음 ㄱ→ㅎ (반복)', make: n => cycleOf([...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'], n), cycle: 'ㄱ→ㄴ→…→ㅎ' },

  { id: 'prime', group: '수학 수열', name: '소수 (2, 3, 5, 7 …)', make: primes,
    hint: () => ({ title: '소수', lines: ['1과 자기 자신으로만 나누어떨어지는 수 (2, 3, 5, 7, 11, …)'] }) },
  { id: 'square', group: '수학 수열', name: '제곱수 (1, 4, 9 …)', make: n => range(n, i => String((i + 1) ** 2)),
    hint: () => ({ title: '제곱수', lines: ['1×1, 2×2, 3×3, 4×4 … → 1, 4, 9, 16, …'] }) },
  { id: 'triangle', group: '수학 수열', name: '삼각수 (1, 3, 6, 10 …)', make: n => range(n, i => String((i + 1) * (i + 2) / 2)),
    hint: () => ({ title: '삼각수', lines: ['1, 1+2, 1+2+3, 1+2+3+4 … → 1, 3, 6, 10, …'] }) },
  { id: 'fib', group: '수학 수열', name: '피보나치 (1, 1, 2, 3, 5 …)', make: n => cycleOf(FIB, n), ref: true,
    hint: labels => ({ title: '피보나치 수열 (앞의 두 수를 더해요)', lines: [FIB.slice(0, Math.min(labels.length, FIB.length)).join(', ')], note: labels.length > FIB.length ? `${FIB[FIB.length - 1]} 다음에는 다시 1, 1, 2 …부터.` : '' }) },
  { id: 'pow2', group: '수학 수열', name: '2의 거듭제곱 (1, 2, 4, 8 …)', make: n => cycleOf(POW2, n), ref: true,
    hint: labels => ({ title: '2의 거듭제곱 (2를 계속 곱해요)', lines: [POW2.slice(0, Math.min(labels.length, POW2.length)).join(', ')], note: labels.length > POW2.length ? `${POW2[POW2.length - 1]} 다음에는 다시 1부터.` : '' }) },
  { id: 'pi', group: '수학 수열', name: '원주율 π (3.1415 …)', make: n => [...piDigits(n)], ref: true,
    hint: labels => ({ title: '원주율 π', lines: [groupDecimals(labels.join(''))], big: true }) },
  { id: 'e', group: '수학 수열', name: '자연상수 e (2.7182 …)', make: n => [...eDigits(n)], ref: true,
    hint: labels => ({ title: '자연상수 e', lines: [groupDecimals(labels.join(''))], big: true }) },
  { id: 'fact', group: '수학 수열', name: '팩토리얼 n! (1!, 2!, 3! …)', make: factorialTokens, ref: true, hint: factorialHint }
];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 모양을 A4 한 장에 맞는 크기(가로 600, 세로 760 이내)로 키우거나 줄인다.
function normalize(raw, maxW = 600, maxH = 760) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const each = p => {
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
  };
  raw.cells.forEach(c => c.poly.forEach(each));
  (raw.walls || []).forEach(w => w.forEach(each));
  const s = Math.min(maxW / (maxX - minX), maxH / (maxY - minY));
  const f = p => [(p[0] - minX) * s, (p[1] - minY) * s];
  raw.cells.forEach(c => {
    c.poly = c.poly.map(f);
    c.center = c.center ? f(c.center) : polyCentroid(c.poly);
  });
  raw.walls = (raw.walls || []).map(w => w.map(f));
  raw.width = (maxX - minX) * s;
  raw.height = (maxY - minY) * s;
}

// 두 선분이 한 직선 위에서 겹치는 길이
function segOverlap(A, B, C, D, eps) {
  const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
  if (L < 1e-9) return 0;
  const ux = dx / L, uy = dy / L;
  const off = P => Math.abs((P[0] - A[0]) * uy - (P[1] - A[1]) * ux);
  if (off(C) > eps || off(D) > eps) return 0;
  const tc = (C[0] - A[0]) * ux + (C[1] - A[1]) * uy;
  const td = (D[0] - A[0]) * ux + (D[1] - A[1]) * uy;
  return Math.max(0, Math.min(L, Math.max(tc, td)) - Math.max(0, Math.min(tc, td)));
}

// 변을 minLen 이상 맞대고 있는 칸끼리 이웃으로 본다. (꼭짓점만 닿으면 이웃 아님)
function geometricAdjacency(cells, minLen = 6, eps = 0.5) {
  const n = cells.length, adj = cells.map(() => []);
  const radius = cells.map(c => Math.max(...c.poly.map(p => Math.hypot(p[0] - c.center[0], p[1] - c.center[1]))));
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const d = Math.hypot(cells[a].center[0] - cells[b].center[0], cells[a].center[1] - cells[b].center[1]);
      if (d > (radius[a] + radius[b]) * 1.02) continue;
      const P = cells[a].poly, Q = cells[b].poly;
      let shared = 0;
      for (let i = 0; i < P.length; i++) {
        for (let j = 0; j < Q.length; j++) {
          shared += segOverlap(P[i], P[(i + 1) % P.length], Q[j], Q[(j + 1) % Q.length], eps);
        }
      }
      if (shared >= minLen) { adj[a].push(b); adj[b].push(a); }
    }
  }
  return adj;
}

// 한붓길이 불가능해지는 칸 정리
//  - 이웃이 1개 이하인 칸(삐죽 튀어나온 칸) 제거
//  - 가장 큰 덩어리만 남김
//  - 체스판처럼 두 색으로 칠해지는 모양이면 두 색 개수 차이를 1 이하로 맞춤
function cleanGraph(adj, keep) {
  const n = adj.length, alive = new Array(n).fill(true);
  const deg = i => adj[i].reduce((s, j) => s + (alive[j] ? 1 : 0), 0);

  function prune() {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < n; i++) {
        if (alive[i] && i !== keep && deg(i) < 2) { alive[i] = false; changed = true; }
      }
    }
  }

  function componentOf(s) {
    const seen = new Set([s]), q = [s];
    while (q.length) {
      const u = q.pop();
      for (const v of adj[u]) if (alive[v] && !seen.has(v)) { seen.add(v); q.push(v); }
    }
    return seen;
  }

  function isConnected() {
    const first = alive.indexOf(true);
    if (first < 0) return true;
    return componentOf(first).size === alive.filter(Boolean).length;
  }

  prune();
  // 가장 큰 덩어리만 남기기
  let best = null;
  const done = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (!alive[i] || done[i]) continue;
    const comp = componentOf(i);
    comp.forEach(v => { done[v] = true; });
    if (!best || comp.size > best.size) best = comp;
  }
  for (let i = 0; i < n; i++) if (!best || !best.has(i)) alive[i] = false;
  prune();

  // 두 색 칠하기 (불가능하면 null)
  const color = new Array(n).fill(-1);
  let bipartite = true;
  for (let s = 0; s < n && bipartite; s++) {
    if (!alive[s] || color[s] >= 0) continue;
    color[s] = 0;
    const q = [s];
    while (q.length && bipartite) {
      const u = q.pop();
      for (const v of adj[u]) {
        if (!alive[v]) continue;
        if (color[v] < 0) { color[v] = 1 - color[u]; q.push(v); }
        else if (color[v] === color[u]) { bipartite = false; break; }
      }
    }
  }

  let startColor = null;
  if (bipartite) {
    for (let guard = 0; guard < 60; guard++) {
      let c0 = 0, c1 = 0;
      for (let i = 0; i < n; i++) if (alive[i]) (color[i] === 0 ? c0++ : c1++);
      const diff = c0 - c1;
      if (Math.abs(diff) <= 1) { if (diff !== 0) startColor = diff > 0 ? 0 : 1; break; }
      const major = diff > 0 ? 0 : 1;
      // 많은 쪽 색에서, 지워도 이웃이 2개 이상 남는 가장자리 칸부터 지움
      const cand = shuffle([...Array(n).keys()].filter(i =>
        alive[i] && i !== keep && color[i] === major &&
        adj[i].every(j => !alive[j] || deg(j) >= 3)
      )).sort((a, b) => deg(a) - deg(b));
      let removed = false;
      for (const c of cand) {
        alive[c] = false;
        if (isConnected()) { removed = true; break; }
        alive[c] = true;
      }
      if (!removed) break;
    }
  }

  const ids = [], map = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) if (alive[i]) { map[i] = ids.length; ids.push(i); }
  const newAdj = ids.map(i => adj[i].filter(j => alive[j]).map(j => map[j]));
  const starts = startColor === null ? null : ids.map((old, k) => (color[old] === startColor ? k : -1)).filter(k => k >= 0);
  return { ids, adj: newAdj, starts, keep: keep >= 0 ? map[keep] : -1 };
}

// 모든 칸을 한 번씩 지나는 길(한붓길) 찾기. 못 찾으면 null
function hamiltonPath(adj, starts, tries = 300, budget = 5000) {
  const n = adj.length;
  if (n === 0) return null;
  const adjSet = adj.map(a => new Set(a));
  const minDeg = Math.min(...adj.map(a => a.length));
  const lowCells = [...Array(n).keys()].filter(i => adj[i].length === minDeg);

  for (let t = 0; t < tries; t++) {
    let start;
    if (starts && starts.length) start = starts[Math.floor(Math.random() * starts.length)];
    else start = Math.random() < 0.5 ? lowCells[Math.floor(Math.random() * lowCells.length)] : Math.floor(Math.random() * n);
    const path = tryPath(start);
    if (path) return path;
  }
  return null;

  function tryPath(start) {
    const visited = new Uint8Array(n), freeDeg = adj.map(a => a.length), path = [];
    let steps = 0;
    const mark = v => { visited[v] = 1; path.push(v); for (const w of adj[v]) freeDeg[w]--; };
    const unmark = v => { visited[v] = 0; path.pop(); for (const w of adj[v]) freeDeg[w]++; };

    // 앞으로 남은 칸들로 길을 이어갈 가능성이 있는지 미리 검사 (막다른 칸, 끊긴 덩어리)
    function feasible(head, remaining) {
      if (remaining === 0) return true;
      let ends = 0;
      for (let w = 0; w < n; w++) {
        if (visited[w]) continue;
        const d = freeDeg[w] + (adjSet[head].has(w) ? 1 : 0);
        if (d === 0) return false;
        if (d === 1 && ++ends > 1) return false;
      }
      const seen = new Uint8Array(n), q = [];
      for (const v of adj[head]) if (!visited[v]) { seen[v] = 1; q.push(v); }
      if (!q.length) return false;
      let cnt = 0;
      while (q.length) {
        const u = q.pop(); cnt++;
        for (const v of adj[u]) if (!visited[v] && !seen[v]) { seen[v] = 1; q.push(v); }
      }
      return cnt === remaining;
    }

    function dfs(head) {
      if (path.length === n) return true;
      if (++steps > budget) return false;
      // 갈 곳이 적은 칸부터 먼저 가 본다 (같으면 무작위)
      const cand = shuffle(adj[head].filter(v => !visited[v])).sort((a, b) => freeDeg[a] - freeDeg[b]);
      for (const v of cand) {
        mark(v);
        if (feasible(v, n - path.length) && dfs(v)) return true;
        unmark(v);
        if (steps > budget) return false;
      }
      return false;
    }

    mark(start);
    return dfs(start) ? path.slice() : null;
  }
}

// 징검다리: 정답 길 + 일부 다른 연결선을 보여준다
function stoneLinks(adj, path) {
  const onPath = new Set();
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i], b = path[i + 1];
    onPath.add(Math.min(a, b) + '-' + Math.max(a, b));
  }
  const links = [];
  adj.forEach((nb, a) => nb.forEach(b => {
    if (b < a) return;
    if (onPath.has(a + '-' + b) || Math.random() < 0.5) links.push([a, b]);
  }));
  return links;
}

// 칸 안쪽 여유 반지름 (숫자 크기 정할 때 사용)
function roomInPoly(poly, pt) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i], B = poly[(i + 1) % poly.length];
    const dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy;
    let t = L2 ? ((pt[0] - A[0]) * dx + (pt[1] - A[1]) * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(pt[0] - A[0] - t * dx, pt[1] - A[1] - t * dy));
  }
  return best;
}

// 미로 하나 만들기
function buildMaze(shapeId, seqId) {
  const shape = SHAPES.find(s => s.id === shapeId);
  const seq = SEQUENCES.find(s => s.id === seqId) || SEQUENCES[0];
  for (let attempt = 0; attempt < 6; attempt++) {
    const raw = shape.build();
    normalize(raw);
    const adj0 = raw.adj || geometricAdjacency(raw.cells);
    const g = cleanGraph(adj0, raw.fixedStart ?? -1);
    const cells = g.ids.map(i => raw.cells[i]);
    const path = hamiltonPath(g.adj, raw.fixedStart != null ? [g.keep] : g.starts);
    if (!path) continue;
    if (raw.reverse) path.reverse();

    const order = new Array(cells.length);
    path.forEach((c, i) => { order[c] = i; });
    const seqLabels = seq.make(cells.length);  // 길 순서대로의 글자
    return {
      shape, seq, cells, path, order, seqLabels,
      adj: g.adj,
      labels: cells.map((_, c) => seqLabels[order[c]]),
      hint: seq.hint ? seq.hint(seqLabels) : null,
      walls: raw.walls,
      kind: raw.kind || 'cells',
      links: raw.kind === 'nodes' ? stoneLinks(g.adj, path) : null,
      width: raw.width, height: raw.height
    };
  }
  return null;
}

// 브라우저가 아닌 곳(자동 테스트)에서도 쓸 수 있게 내보내기
if (typeof module !== 'undefined') {
  module.exports = { SHAPES, SEQUENCES, buildMaze, roomInPoly, piDigits, eDigits, factorialTokens };
}
