'use strict';
// app.js – 화면 동작 (선택 상자, 버튼, 문제지 그리기)

const SVGNS = 'http://www.w3.org/2000/svg';
const COLOR = { start: '#d9f2d0', end: '#ffd9e0', answer: '#e53935' };

function htmlEl(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

const pts = arr => arr.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');

// 글자 폭을 대략 계산해 칸에 들어가는 글자 크기를 정한다
function fitFont(label, room) {
  const w = [...label].reduce((s, ch) => s + (/[0-9]/.test(ch) ? 0.58 : /[A-Z]/.test(ch) ? 0.7 : /[!.]/.test(ch) ? 0.35 : 1.0), 0);
  return Math.max(7, Math.min(22, room * 1.25, room * 1.8 / w));
}

function guideText(maze) {
  const { seq, labels, path, kind, shape } = maze;
  const first = labels[path[0]], last = labels[path[path.length - 1]];
  let text = seq.ref
    ? `위 표의 순서대로 ${first}에서 출발해, 맞닿은 칸끼리 선을 이어 도착 칸까지 가 보세요.`
    : seq.cycle
      ? `${first}에서 출발해 ${seq.cycle} 순서를 반복하며 도착 칸까지 이어 보세요.`
      : `${first}부터 ${last}까지 순서대로, 맞닿은 칸끼리 선을 이어 보세요.`;
  if (kind === 'nodes') text += ' 선으로 이어진 돌만 건널 수 있어요.';
  if (shape.id === 'spiral') text += ' 굵은 벽은 넘어갈 수 없어요.';
  return text;
}

// 문제지(또는 정답지) 한 장 그리기
// no: 여러 장 만들 때 문제지 번호 (정답지와 짝 맞추기용)
function renderPage(maze, shape, isAnswer, no) {
  const page = htmlEl('section', 'page');
  const head = htmlEl('div', 'sheet-head');
  const h2 = htmlEl('h2', null, shape.name + ' 미로 ');
  if (no) h2.appendChild(htmlEl('span', 'sheet-no', no + '번 '));
  if (isAnswer) h2.appendChild(htmlEl('span', 'answer-tag', '(정답)'));
  head.appendChild(h2);
  head.appendChild(htmlEl('div', 'name-line', '이름: ____________   날짜: ____-__-__'));
  page.appendChild(head);

  if (!maze) {
    page.appendChild(htmlEl('p', 'fail', '이번에는 길을 찾지 못했습니다. [새로 만들기]를 다시 눌러 주세요.'));
    return page;
  }

  if (maze.hint) page.appendChild(renderHint(maze.hint));
  page.appendChild(htmlEl('p', 'guide', guideText(maze)));
  const meta = htmlEl('p', 'meta',
    `칸 ${maze.cells.length}개 · 이동: ${shape.dirs} · 난이도 ${'★'.repeat(shape.level)}${'☆'.repeat(3 - shape.level)}`);
  meta.appendChild(htmlEl('span', 'swatch start'));
  meta.appendChild(document.createTextNode('출발'));
  meta.appendChild(htmlEl('span', 'swatch end'));
  meta.appendChild(document.createTextNode('도착'));
  page.appendChild(meta);

  page.appendChild(drawMaze(maze, isAnswer));
  return page;
}

// 문제지 위쪽 참고표 (원주율 자릿수, 팩토리얼 계산 등)
function renderHint(hint) {
  const box = htmlEl('div', 'hint' + (hint.big ? ' big' : ''));
  box.appendChild(htmlEl('div', 'hint-title', hint.title));
  const body = htmlEl('div', 'hint-body');
  hint.lines.forEach(line => body.appendChild(htmlEl('span', 'hint-item', line)));
  box.appendChild(body);
  if (hint.note) box.appendChild(htmlEl('div', 'hint-note', hint.note));
  return box;
}

function drawMaze(maze, isAnswer) {
  const pad = 14;
  const svg = svgEl('svg', {
    class: 'maze',
    viewBox: `${-pad} ${-pad} ${maze.width + pad * 2} ${maze.height + pad * 2}`
  });
  const startCell = maze.path[0], endCell = maze.path[maze.path.length - 1];
  const fillOf = i => (i === startCell ? COLOR.start : i === endCell ? COLOR.end : '#fff');
  const rooms = [];

  if (maze.kind === 'nodes') {
    // 징검다리: 연결선 → 동그라미
    let minD = Infinity;
    maze.links.forEach(([a, b]) => {
      const A = maze.cells[a].center, B = maze.cells[b].center;
      minD = Math.min(minD, Math.hypot(A[0] - B[0], A[1] - B[1]));
      svgEl('line', { x1: A[0], y1: A[1], x2: B[0], y2: B[1], stroke: '#9a8f80', 'stroke-width': 3 }, svg);
    });
    const R = Math.min(24, minD * 0.36);
    maze.cells.forEach((c, i) => {
      svgEl('circle', { cx: c.center[0], cy: c.center[1], r: R, fill: fillOf(i), stroke: '#444', 'stroke-width': 2 }, svg);
      rooms.push(R * 0.9);
    });
  } else {
    maze.cells.forEach((c, i) => {
      svgEl('polygon', {
        points: pts(c.poly), fill: fillOf(i), stroke: '#222',
        'stroke-width': 1.3, 'stroke-linejoin': 'round'
      }, svg);
      rooms.push(roomInPoly(c.poly, c.center));
    });
    maze.walls.forEach(w => {
      svgEl('polyline', { points: pts(w), fill: 'none', stroke: '#222', 'stroke-width': 4, 'stroke-linecap': 'round' }, svg);
    });
  }

  if (isAnswer) {
    svgEl('polyline', {
      points: pts(maze.path.map(i => maze.cells[i].center)), fill: 'none',
      stroke: COLOR.answer, 'stroke-width': 4, 'stroke-opacity': 0.55,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }, svg);
  }

  maze.cells.forEach((c, i) => {
    const label = maze.labels[i];
    const t = svgEl('text', {
      x: c.center[0], y: c.center[1], 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': fitFont(label, rooms[i]).toFixed(1), fill: '#222'
    }, svg);
    t.textContent = label;
  });
  return svg;
}

// 선택한 모양(또는 전체)으로 문제지 만들기
let generateId = 0;
function generate() {
  const shapeVal = document.getElementById('shapeSelect').value;
  const seqId = document.getElementById('seqSelect').value;
  const countInput = document.getElementById('countInput');
  const count = Math.max(1, Math.min(30, parseInt(countInput.value, 10) || 1));
  countInput.value = count;
  const status = document.getElementById('status');
  const pages = document.getElementById('pages');
  const answers = document.getElementById('answerPages');
  const printBtn = document.getElementById('printBtn');
  status.textContent = '미로를 만드는 중입니다…';
  pages.textContent = '';
  answers.textContent = '';
  toggleAnswers();
  const myId = ++generateId;  // 연달아 누르면 마지막 요청만 그린다

  // 장 수만큼 [새로 만들기]를 누른 것처럼 매번 다른 미로를 만든다. 전체 모양이면 한 벌씩 반복
  const list = shapeVal === 'all' ? SHAPES : SHAPES.filter(s => s.id === shapeVal);
  const jobs = [];
  for (let no = 1; no <= count; no++) list.forEach(shape => jobs.push({ shape, no: count > 1 ? no : 0 }));
  printBtn.disabled = true;

  // 한 장씩 나눠 만들어 화면이 멈추지 않게 한다
  let done = 0, failed = 0;
  const step = () => {
    if (myId !== generateId) return;
    const { shape, no } = jobs[done];
    const maze = buildMaze(shape.id, seqId);
    pages.appendChild(renderPage(maze, shape, false, no));
    if (maze) answers.appendChild(renderPage(maze, shape, true, no));
    else failed++;
    done++;
    if (done < jobs.length) {
      status.textContent = `미로를 만드는 중입니다… ${done} / ${jobs.length}`;
      setTimeout(step, 0);
      return;
    }
    printBtn.disabled = false;
    status.textContent = `문제지 ${jobs.length}장 완성` + (failed ? ` (길을 못 찾은 ${failed}장은 다시 만들어 주세요)` : '') +
      '. 정답지는 문제지 뒤에 같은 번호로 모여 나옵니다.';
  };
  setTimeout(step, 30);
}

// 정답지 체크: 미로는 그대로 두고 정답지만 보이기/숨기기
function toggleAnswers() {
  document.getElementById('answerPages').hidden = !document.getElementById('answerCheck').checked;
}

function init() {
  const shapeSelect = document.getElementById('shapeSelect');
  const all = htmlEl('option', null, '전체 모양 한꺼번에 보기');
  all.value = 'all';
  shapeSelect.appendChild(all);
  SHAPES.forEach(s => {
    const o = htmlEl('option', null, s.name);
    o.value = s.id;
    shapeSelect.appendChild(o);
  });

  const seqSelect = document.getElementById('seqSelect');
  const groups = {};
  SEQUENCES.forEach(s => {
    if (!groups[s.group]) {
      groups[s.group] = document.createElement('optgroup');
      groups[s.group].label = s.group;
      seqSelect.appendChild(groups[s.group]);
    }
    const o = htmlEl('option', null, s.name);
    o.value = s.id;
    groups[s.group].appendChild(o);
  });

  document.getElementById('makeBtn').addEventListener('click', generate);
  document.getElementById('printBtn').addEventListener('click', () => window.print());
  shapeSelect.addEventListener('change', generate);
  seqSelect.addEventListener('change', generate);
  document.getElementById('countInput').addEventListener('change', generate);
  document.getElementById('answerCheck').addEventListener('change', toggleAnswers);
  generate();
}

init();
