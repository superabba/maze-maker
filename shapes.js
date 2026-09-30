'use strict';
// shapes.js – 미로 모양별로 칸(다각형)을 만든다. (화면을 다루는 코드 없음)
// 모든 모양 함수는 다음을 돌려준다.
//   cells      : [{ poly: [[x,y],...], center?: [x,y] }]  칸 모양과 숫자 위치
//   adj        : (선택) 칸끼리 이웃 목록. 없으면 모양에서 자동 계산
//   walls      : (선택) 굵게 그릴 벽 선 [[x,y],...]
//   kind       : (선택) 'nodes' 이면 동그라미+연결선으로 그림
//   fixedStart : (선택) 길 찾기를 반드시 시작할 칸 번호
//   reverse    : (선택) true 이면 찾은 길을 거꾸로 번호 매김 (fixedStart 칸이 도착)

const SQ3 = Math.sqrt(3);

function rand(a, b) { return a + Math.random() * (b - a); }

function rectPoly(x, y, w, h) {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

// 반지름 r 원 위의 점들 (각도 a0 → a1, 양 끝 포함)
function arcPoints(r, a0, a1, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * i / steps;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

// 다각형의 무게중심
function polyCentroid(poly) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length];
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-12) {
    return [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

// 점이 다각형 안에 있는지
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---------- 1. 네모 (기존 형태) ----------
function shapeSquare() {
  const cells = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) cells.push({ poly: rectPoly(c, r, 1, 1) });
  }
  return { cells };
}

// ---------- 2. 벽돌 쌓기 (줄마다 반 칸씩 어긋남) ----------
function shapeBrick() {
  const cells = [], W = 1.6, H = 0.8;
  for (let r = 0; r < 14; r++) {
    const off = r % 2 ? W / 2 : 0;
    for (let c = 0; c < 7; c++) cells.push({ poly: rectPoly(off + c * W, r * H, W, H) });
  }
  return { cells };
}

// ---------- 3. 육각형 벌집 (큰 육각형 모양, 칸 91개) ----------
function shapeHex() {
  const R = 5, cells = [];
  for (let q = -R; q <= R; q++) {
    for (let r = -R; r <= R; r++) {
      if (Math.abs(q + r) > R) continue;
      const cx = SQ3 * (q + r / 2), cy = 1.5 * r;
      const poly = [];
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 180 * (60 * k + 30);
        poly.push([cx + Math.cos(a), cy + Math.sin(a)]);
      }
      cells.push({ poly, center: [cx, cy] });
    }
  }
  return { cells };
}

// ---------- 4. 삼각형 격자 (큰 육각형 모양, 칸 96개) ----------
function shapeTri() {
  const n = 4, h = SQ3 / 2, cells = [];
  const cx = n, cy = n * h;
  for (let r = 0; r < 2 * n; r++) {
    for (let c = -1; c <= 4 * n + 1; c++) {
      const up = (((r + c + n) % 2) + 2) % 2 === 1;
      const x0 = c / 2;
      const poly = up
        ? [[x0, (r + 1) * h], [x0 + 1, (r + 1) * h], [x0 + 0.5, r * h]]
        : [[x0, r * h], [x0 + 1, r * h], [x0 + 0.5, (r + 1) * h]];
      const [gx, gy] = polyCentroid(poly);
      if (Math.abs(gy - cy) <= n * h && Math.abs(gx - cx) + Math.abs(gy - cy) / SQ3 <= n + 1e-9) {
        cells.push({ poly, center: [gx, gy] });
      }
    }
  }
  return { cells };
}

// ---------- 5. 원형 과녁 (가운데가 도착) ----------
function shapePolar() {
  const rings = [8, 14, 20, 26, 31];
  const cells = [{ poly: arcPoints(1, 0, 2 * Math.PI, 36).slice(0, -1), center: [0, 0] }];
  const ringIds = [];
  rings.forEach((cnt, i) => {
    const r0 = i + 1, r1 = i + 2, off = i * 0.37, step = 2 * Math.PI / cnt;
    const ids = [];
    for (let k = 0; k < cnt; k++) {
      const a0 = off + k * step, a1 = a0 + step;
      const m = Math.max(3, Math.ceil(step * r1 * 6));
      const poly = arcPoints(r1, a0, a1, m).concat(arcPoints(r0, a1, a0, m));
      const am = (a0 + a1) / 2, rm = (r0 + r1) / 2;
      ids.push(cells.length);
      cells.push({ poly, center: [rm * Math.cos(am), rm * Math.sin(am)], a0, a1 });
    }
    ringIds.push(ids);
  });

  const adj = cells.map(() => []);
  const link = (a, b) => { adj[a].push(b); adj[b].push(a); };
  ringIds[0].forEach(id => link(0, id));
  ringIds.forEach((ids, i) => {
    ids.forEach((id, k) => link(id, ids[(k + 1) % ids.length]));
    if (i + 1 < ringIds.length) {
      // 바깥 고리와 맞닿은 호의 길이가 충분할 때만 이웃
      ids.forEach(id => ringIds[i + 1].forEach(o => {
        if (angleOverlap(cells[id], cells[o]) * (i + 2) >= 0.15) link(id, o);
      }));
    }
  });
  return { cells, adj, fixedStart: 0, reverse: true };
}

function angleOverlap(A, B) {
  let best = 0;
  for (const s of [-2 * Math.PI, 0, 2 * Math.PI]) {
    best = Math.max(best, Math.min(A.a1, B.a1 + s) - Math.max(A.a0, B.a0 + s));
  }
  return best;
}

// ---------- 6. 나선형 달팽이 (3줄 길이 빙글빙글) ----------
function shapeSpiral() {
  const lanes = 3, K = 33, P = lanes, r0 = 1.2;
  const rad = t => r0 + P * t / (2 * Math.PI);
  const th = [0];
  for (let k = 0; k < K; k++) th.push(th[k] + 1.15 / (rad(th[k]) + P / 2));

  const cells = [], idx = [];
  for (let l = 0; l < lanes; l++) {
    idx.push([]);
    for (let k = 0; k < K; k++) {
      const a0 = th[k], a1 = th[k + 1], m = 6;
      const outer = [], inner = [];
      for (let i = 0; i <= m; i++) {
        const t = a0 + (a1 - a0) * i / m;
        const ro = rad(t) + l + 1, ri = rad(t) + l;
        outer.push([ro * Math.cos(t), ro * Math.sin(t)]);
        inner.unshift([ri * Math.cos(t), ri * Math.sin(t)]);
      }
      const tm = (a0 + a1) / 2, rm = rad(tm) + l + 0.5;
      idx[l].push(cells.length);
      cells.push({ poly: outer.concat(inner), center: [rm * Math.cos(tm), rm * Math.sin(tm)] });
    }
  }

  const adj = cells.map(() => []);
  const link = (a, b) => { adj[a].push(b); adj[b].push(a); };
  for (let l = 0; l < lanes; l++) {
    for (let k = 0; k < K; k++) {
      if (k + 1 < K) link(idx[l][k], idx[l][k + 1]);
      if (l + 1 < lanes) link(idx[l][k], idx[l + 1][k]);
    }
  }

  // 굵은 벽: 안쪽 선, 바깥 선, 시작·끝 막음선
  const tEnd = th[K], inWall = [], outWall = [];
  for (let i = 0; i <= 240; i++) {
    const t = tEnd * i / 240;
    inWall.push([rad(t) * Math.cos(t), rad(t) * Math.sin(t)]);
    outWall.push([(rad(t) + P) * Math.cos(t), (rad(t) + P) * Math.sin(t)]);
  }
  const cap = t => [[rad(t) * Math.cos(t), rad(t) * Math.sin(t)], [(rad(t) + P) * Math.cos(t), (rad(t) + P) * Math.sin(t)]];
  return { cells, adj, walls: [inWall, outWall, cap(0), cap(tEnd)] };
}

// ---------- 7~9. 실루엣 (네모 격자를 그림 모양으로 오려냄) ----------
// mask(u, v): u, v 는 -1~1, v 는 위쪽이 +
function maskedSquareGrid(mask, target) {
  let best = null;
  for (let g = 8; g <= 20; g++) {
    const polys = [];
    let black = 0;
    for (let r = 0; r < g; r++) {
      for (let c = 0; c < g; c++) {
        const u = (c + 0.5) / g * 2 - 1, v = 1 - (r + 0.5) / g * 2;
        if (mask(u, v)) {
          polys.push(rectPoly(c, r, 1, 1));
          if ((r + c) % 2 === 0) black++;
        }
      }
    }
    // 체스판 두 색의 개수 차이가 크면 한붓길이 불가능하므로 점수에 반영
    const imbalance = Math.abs(polys.length - 2 * black);
    const score = Math.abs(polys.length - target) + imbalance * 3;
    if (!best || score < best.score) best = { score, polys };
  }
  return { cells: best.polys.map(poly => ({ poly })) };
}

function shapeHeart() {
  return maskedSquareGrid((u, v) => {
    const x = u * 1.2, y = v * 1.2 + 0.1;
    return Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y <= 0;
  }, 100);
}

function shapeStar() {
  const star = [];
  for (let k = 0; k < 10; k++) {
    const a = Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 0.5 : 1.02;
    star.push([r * Math.cos(a), r * Math.sin(a) - 0.08]);
  }
  return maskedSquareGrid((u, v) => pointInPoly(u, v, star), 100);
}

function shapeTree() {
  const tiers = [[1.0, 0.3, 0.55], [0.6, -0.2, 0.75], [0.15, -0.65, 0.95]];  // [꼭대기, 밑변, 밑변 반폭]
  return maskedSquareGrid((u, v) => {
    if (Math.abs(u) <= 0.2 && v <= -0.65 && v >= -1) return true;  // 줄기
    return tiers.some(([top, base, hw]) => v <= top && v >= base && Math.abs(u) <= hw * (top - v) / (top - base));
  }, 100);
}

// ---------- 10~11. 보로노이 (조각보, 징검다리) ----------
// 반평면 a*x + b*y <= c 쪽만 남기고 자르기
function clipPoly(poly, a, b, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i], Q = poly[(i + 1) % poly.length];
    const fp = a * P[0] + b * P[1] - c, fq = a * Q[0] + b * Q[1] - c;
    if (fp <= 0) out.push(P);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq);
      out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
    }
  }
  return out;
}

function voronoiCell(sites, i, W, H) {
  let poly = rectPoly(0, 0, W, H);
  const p = sites[i];
  for (let j = 0; j < sites.length; j++) {
    if (j === i) continue;
    const q = sites[j];
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 4) continue;
    const a = q[0] - p[0], b = q[1] - p[1];
    const c = (q[0] * q[0] + q[1] * q[1] - p[0] * p[0] - p[1] * p[1]) / 2;
    poly = clipPoly(poly, a, b, c);
  }
  return poly;
}

function voronoi(cols, rows, relax) {
  let sites = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) sites.push([c + 0.5 + rand(-0.45, 0.45), r + 0.5 + rand(-0.45, 0.45)]);
  }
  let polys = null;
  for (let it = 0; it <= relax; it++) {
    polys = sites.map((_, i) => voronoiCell(sites, i, cols, rows));
    if (it < relax) sites = polys.map(polyCentroid);  // 칸 크기를 고르게 다듬기
  }
  return { sites, polys };
}

function shapeVoronoi() {
  const { polys } = voronoi(9, 11, 1);
  return { cells: polys.map(poly => ({ poly })) };
}

function shapeStones() {
  const { sites, polys } = voronoi(8, 10, 2);
  return { cells: polys.map((poly, i) => ({ poly, center: sites[i] })), kind: 'nodes' };
}
