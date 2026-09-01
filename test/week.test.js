/* 주차 계산 테스트 — 의존성 없음.  실행: node test/week.test.js
 *
 * index.html 의 @pure 블록을 그대로 떼어 검사한다. 사본을 만들지 않는 이유는
 * 사본이 곧 원본과 갈라지기 때문이다. 배포되는 코드 자체를 검사한다.
 *
 * 왜 이 함수들만인가: 화면에 가장 크게 뜨는 숫자(주 · 일 · D-)가 여기서 나오고,
 * 틀려도 예외가 안 나고 그냥 다른 숫자가 보인다. 눈으로는 못 잡는다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/\/\* @pure:start[\s\S]*?\/\* @pure:end \*\//);
if (!m) {
  console.error('index.html 에서 @pure 블록을 찾지 못했다. 마커가 지워졌는지 확인할 것.');
  process.exit(1);
}
const api = ['DAY','DOW','midnight','parseDay','ymd','addDays','daysBetween','weeksFrom','ddayTo','fmtDay','weekStartKey'];
const F = new Function(m[0] + '\nreturn {' + api.join(',') + '};')();

/* 화면 문구 표 — 주차마다 빠진 칸이 있으면 그 주에 상자가 통째로 사라진다.
   에러가 아니라 '없는 화면'으로 나타나므로 눈으로는 안 잡힌다. */
const tm = html.match(/var WEEKLY = \{[\s\S]*?\n  \};[\s\S]*?var DONT = \[[\s\S]*?\n  \];[\s\S]*?\n  \}/);
if (!tm) {
  console.error('index.html 에서 WEEKLY/DONT 를 찾지 못했다.');
  process.exit(1);
}
const T = new Function(tm[0] + '\nreturn {WEEKLY, DONT, dontFor};')();

/* 병원·조리원 문구 표 */
const pm = html.match(/var ST = \[[\s\S]*?\];[\s\S]*?var ASK = \{[\s\S]*?\n  \};/);
if (!pm) {
  console.error('index.html 에서 ST/ASK 를 찾지 못했다.');
  process.exit(1);
}
const P = new Function(pm[0] + '\nreturn {ST, ASK};')();

/* 추천 표 — 행정 항목이 여기 산다. 문구가 바뀌면 이미 담은 항목과 짝이 안 맞아
   추천이 다시 뜬다(suggestHave 가 문구로 비교한다). 그래서 문구 자체를 검사한다. */
const sm = html.match(/var SUGGEST = \[[\s\S]*?\n  \];/);
if (!sm) {
  console.error('index.html 에서 SUGGEST 를 찾지 못했다.');
  process.exit(1);
}
const G = new Function(sm[0] + '\nreturn {SUGGEST};')();

let pass = 0, fail = 0;
function eq(actual, expected, what) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { pass++; return; }
  fail++;
  console.error('  FAIL  ' + what + '\n        기대 ' + b + '\n        실제 ' + a);
}
function group(name, fn) { console.log(name); fn(); }

/* 실제 값. LMP 2026-07-23 · 예정일 2027-04-29 (네겔레 +280일) */
const LMP = F.parseDay('2026-07-23');
const EDD = F.parseDay('2027-04-29');

group('네겔레 규칙', () => {
  eq(F.ymd(F.addDays(LMP, 280)), '2027-04-29', 'LMP + 280일 = 예정일');
  eq(F.daysBetween(LMP, EDD), 280, '두 날짜 사이가 정확히 280일');
});

group('주차', () => {
  eq(F.weeksFrom(LMP, F.parseDay('2026-07-23')), {w:0, d:0, n:0},   '시작일은 0주 0일');
  eq(F.weeksFrom(LMP, F.parseDay('2026-08-27')), {w:5, d:0, n:35},  '35일째 = 5주 0일 (주차가 바뀌는 날)');
  eq(F.weeksFrom(LMP, F.parseDay('2026-08-28')), {w:5, d:1, n:36},  '36일째 = 5주 1일');
  eq(F.weeksFrom(LMP, F.parseDay('2026-09-02')), {w:5, d:6, n:41},  '41일째 = 5주 6일 (경계 직전)');
  eq(F.weeksFrom(LMP, F.parseDay('2026-09-03')), {w:6, d:0, n:42},  '42일째 = 6주 0일 (경계)');
  eq(F.weeksFrom(LMP, EDD).w, 40,                                    '예정일은 40주');
});

group('주차 경계는 7일마다 정확히 한 번', () => {
  let turns = 0;
  for (let i = 0; i <= 280; i++) if (F.weeksFrom(LMP, F.addDays(LMP, i)).d === 0) turns++;
  eq(turns, 41, '0~280일 사이 주차 전환일이 41번 (0주~40주)');
});

group('LMP 이전 (달력에서 과거 달로 넘길 때)', () => {
  eq(F.daysBetween(LMP, F.parseDay('2026-07-22')), -1, '하루 전은 -1');
  eq(F.weeksFrom(LMP, F.parseDay('2026-07-22')).d, 6,  '음수여도 요일 자리가 음수로 새지 않는다');
  eq(F.weeksFrom(LMP, F.parseDay('2026-07-22')).w, -1, '음수 주차는 음수로 (UI 가 n>=0 으로 거른다)');
});

group('D-', () => {
  eq(F.ddayTo(EDD, F.parseDay('2026-08-28')), 244, '2026-08-28 은 D-244');
  eq(F.ddayTo(EDD, EDD), 0,                        '예정일 당일은 D-0');
  eq(F.ddayTo(EDD, F.parseDay('2027-04-30')), -1,  '예정일이 지나면 음수');
});

group('월말·윤년·월 넘김', () => {
  eq(F.ymd(F.addDays(F.parseDay('2026-08-31'), 1)), '2026-09-01', '8월 31일 다음날');
  eq(F.ymd(F.addDays(F.parseDay('2026-12-31'), 1)), '2027-01-01', '연말 넘김');
  eq(F.ymd(F.addDays(F.parseDay('2028-02-28'), 1)), '2028-02-29', '윤년 2월 29일');
  eq(F.daysBetween(F.parseDay('2028-02-28'), F.parseDay('2028-03-01')), 2, '윤년 2월을 건너뛰지 않는다');
});

group('하루 안의 시각이 결과를 바꾸지 않는다', () => {
  const noon = new Date(2026, 7, 28, 13, 45, 30);   // 8월 28일 13:45
  const late = new Date(2026, 7, 28, 23, 59, 59);
  eq(F.weeksFrom(LMP, noon), F.weeksFrom(LMP, late), '같은 날이면 시각이 달라도 같은 주차');
  eq(F.ymd(F.midnight(late)), '2026-08-28', 'midnight 이 날짜를 밀지 않는다');
});

group('표기', () => {
  eq(F.fmtDay('2026-08-28'), '08.28 금', '날짜 + 요일');
  eq(F.fmtDay('2027-04-29'), '04.29 목', '예정일 요일');
  eq(F.DOW.length, 7, '요일 배열 7개');
});

group('주차 시작일 — 구간째 담을 자리', () => {
  eq(F.weekStartKey(LMP, 0), '2026-07-23', '0주는 LMP 당일');
  eq(F.weekStartKey(LMP, 5), '2026-08-27', '5주 시작일');
  eq(F.weekStartKey(LMP, 8), '2026-09-17', '8주 시작일 (달을 넘김)');
  eq(F.weekStartKey(LMP, 20), '2026-12-10', '20주 시작일');
  eq(F.weekStartKey(LMP, 24), '2027-01-07', '24주 시작일 (해를 넘김)');
  eq(F.weekStartKey(LMP, 40), '2027-04-29', '40주 시작일이 곧 예정일');
  // 시작일은 반드시 그 주차의 0일째다. 어긋나면 담은 항목이 옆 주차로 샌다.
  [5, 8, 11, 14, 20, 24, 28, 32, 36].forEach(w => {
    const d = F.parseDay(F.weekStartKey(LMP, w));
    eq(F.weeksFrom(LMP, d).w, w, w + '주 시작일의 주차는 ' + w);
    eq(F.weeksFrom(LMP, d).d, 0, w + '주 시작일은 0일째');
  });
});

group('하지 말 것 — 주차마다 빈 칸이 없어야 한다', () => {
  const weeks = Object.keys(T.WEEKLY).map(Number).sort((a, b) => a - b);
  eq(weeks[0], 5, '몸 설명은 5주부터');
  eq(weeks[weeks.length - 1], 40, '몸 설명은 40주까지');
  // 몸 설명이 있는 주에는 반드시 하지 말 것도 있어야 한다.
  eq(weeks.filter(w => !T.dontFor(w)), [], '하지 말 것이 비어 있는 주');
  // 구간이 겹치거나 벌어지면 안 된다.
  for (let i = 1; i < T.DONT.length; i++) {
    eq(T.DONT[i].a, T.DONT[i - 1].b + 1, T.DONT[i - 1].b + '주 다음은 바로 이어진다');
  }
  eq(T.DONT.length, 9, '구간 9개');
  eq(T.dontFor(4), null, '4주는 범위 밖');
  eq(T.dontFor(45), null, '45주는 범위 밖');
  eq(T.dontFor(44), T.dontFor(36), '36~44주는 한 구간');
  eq(new Set(T.DONT.map(d => d.t)).size, 9, '아홉 문구가 서로 다르다');
});

group('병원 · 조리원', () => {
  eq(P.ST.length, 5, '상태 5단계');
  eq(P.ST[0], '미확인', '처음은 미확인 — 확인 안 한 것이 확인된 것처럼 보이면 안 된다');
  eq(new Set(P.ST).size, 5, '상태 이름이 서로 다르다');
  // 상태는 눌러서 도는데, 한 바퀴 뒤 제자리로 와야 한다.
  let s = 0;
  for (let i = 0; i < P.ST.length; i++) s = (s + 1) % P.ST.length;
  eq(s, 0, '한 바퀴 돌면 처음으로');
  // 종류마다 물어볼 것이 있어야 한다. 없으면 그 탭에서 목록이 빈 채로 열린다.
  eq(Object.keys(P.ASK).sort(), ['b', 'c'], '분만·조리원 두 종류');
  eq(P.ASK.b.length > 0 && P.ASK.c.length > 0, true, '양쪽 다 비어 있지 않다');
  eq(P.ASK.b.some(t => t.includes('분만실')), true, '분만은 분만실 운영부터 묻는다');
});

console.log('');
group('추천 — 구조', () => {
  eq(G.SUGGEST.length, 9, '구간 9개');
  const all = [];
  G.SUGGEST.forEach(b => b.l.forEach(s => all.push(s)));
  eq(all.every(s => s && typeof s === 'object' && !Array.isArray(s)),
     true, '항목은 전부 객체다 (문자열이면 담을 때 t 가 undefined 가 된다)');
  eq(all.every(s => typeof s.t === 'string' && s.t.length > 0),
     true, '항목마다 문구 t 가 있다');
  eq(new Set(all.map(s => s.t)).size, all.length,
     '문구가 전부 다르다 — 겹치면 한쪽을 담았을 때 다른 쪽도 사라진다');
});

group('추천 — 마감 주차 w', () => {
  // w 는 '이 항목의 기한이 걸린 주차'다. 구간 밖으로 새면 담은 항목이
  // 엉뚱한 달의 달력에 붙는다. 에러가 안 나고 날짜만 틀린다.
  G.SUGGEST.forEach(b => b.l.forEach(s => {
    if (s.w === undefined) return;
    eq(Number.isInteger(s.w), true, '[' + s.t + '] w 는 정수');
    eq(s.w >= b.a && s.w <= b.b, true,
       '[' + s.t + '] w=' + s.w + ' 가 구간 ' + b.a + '~' + b.b + ' 안에 있다');
  }));
  // w 가 실제로 달력의 어느 날이 되는지. 이 변환이 틀리면 전부 하루씩 밀린다.
  eq(F.weekStartKey(LMP, 6), '2026-09-03', '6주 마감 = 2026-09-03');
  eq(F.weekStartKey(LMP, 12), '2026-10-15', '12주 = 2026-10-15 (보건소 엽산제 창이 닫히는 주)');
});

group('추천 — 행정 항목은 출처를 갖는다', () => {
  // 🔴 지어낸 제도를 넣지 않기 위한 게이트다. src 가 없으면 그 항목은
  // 근거 없이 들어온 것이고, 위키 규칙으로 치면 출처 없는 숫자와 같다.
  const dated = [];
  G.SUGGEST.forEach(b => b.l.forEach(s => { if (s.w !== undefined) dated.push(s); }));
  eq(dated.length > 0, true, '마감이 걸린 항목이 하나 이상 있다');
  eq(dated.every(s => typeof s.src === 'string' && s.src.length > 0),
     true, '마감이 걸린 항목은 전부 출처 src 가 있다');
});

group('🔴 추천 — 이미 담긴 문구는 바꾸지 않는다', () => {
  // suggestHave() 는 문구를 통째로 비교한다. 문구를 한 글자만 고쳐도
  // 이미 담아 둔 항목과 짝이 안 맞아 추천 칩이 되살아난다 — 지운 것도 되살아난다.
  // 아래는 실제 방(2026-09-01 실측)에 담겨 있는, 추천에서 나온 문구다.
  // 다듬고 싶으면 문구를 바꾸는 게 아니라 새 항목을 추가할 것.
  const all = [];
  G.SUGGEST.forEach(b => b.l.forEach(s => all.push(s.t)));
  [
    '산부인과 다음 예약 같이 잡기',
    '임신확인서 받으면 바로 사진 찍어두기',
    '냉장고에서 냄새나는 것 치우기',
    '무거운 건 내가 들기'
  ].forEach(t => eq(all.includes(t), true, '["' + t + '"] 가 그대로 있다'));
});

group('추천 — 마감이 달력의 어느 날이 되는가', () => {
  // 이 표가 곧 화면이다. 여기서 하루라도 밀리면 기한이 거짓으로 표시되고,
  // 예외는 안 난다. 그래서 실제로 찍힐 날짜를 값으로 박아 둔다.
  const on = {};
  G.SUGGEST.forEach(b => b.l.forEach(s => {
    if (s.w !== undefined) on[s.t] = F.weekStartKey(LMP, s.w);
  }));
  eq(on['국민행복카드 신청 — 진료비 100만원, 출산 전 아무 때나'], '2026-09-03', '국민행복카드 = 6주');
  eq(on['맘편한임신 원스톱 신청 (정부24) — 임신확인서 나오면 바로'], '2026-09-03', '맘편한임신 = 6주');
  eq(on['배우자 출산휴가 20일 — 유급, 출산일부터 120일 안에, 3회 분할'], '2027-02-18', '배우자 출산휴가 = 30주');
  eq(on['출생신고 + 첫만남이용권 한 번에 (행복출산 원스톱)'], '2027-04-29', '출생신고 = 40주 = 예정일');
  // 마감일은 전부 실제 달력 날짜여야 한다. 하나라도 깨지면 그 항목이 달력에서 사라진다.
  Object.keys(on).forEach(t => {
    eq(/^\d{4}-\d{2}-\d{2}$/.test(on[t]), true, '[' + t.slice(0, 14) + '…] 날짜 형식');
    eq(F.ymd(F.parseDay(on[t])), on[t], '[' + t.slice(0, 14) + '…] 파싱해도 같은 날');
  });
});

group('🔴 공개 저장소 — 소스에 사는 곳과 회사가 없다', () => {
  // 이 저장소는 공개다. 지자체·회사 항목을 소스에 넣으면 거주지와 직장이 공개된다.
  // 🔴 금지어를 여기 적으면 안 된다 — 목록 자체가 사는 곳을 말해 버린다.
  //    (첫 판이 정확히 그랬다.) 그래서 개별 이름이 아니라 '부류'로 검사한다.
  const SI = '서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주';
  const GU = '종로|중구|용산|성동|광진|동대문|중랑|성북|강북|도봉|노원|은평|서대문|마포'
           + '|양천|강서|구로|금천|영등포|동작|관악|서초|강남|송파|강동';
  [
    [new RegExp('(' + SI + ')(시|특별시|광역시|도)'), '광역시·도 이름'],
    [new RegExp('(' + GU + ')구'),                     '자치구 이름'],
    // 동·읍·면은 검사하지 않는다 — 한국어 산문과 구분이 안 된다("있으면" 이 걸렸다).
    // 주소가 새면 거의 항상 구·보건소·주민센터가 같이 붙으므로 나머지가 잡는다.
    [/0d{1,2}-d{3,4}-d{4}/,                        '전화번호'],
    [/보건소|주민센터|구청/,                             '관공서 이름']
  ].forEach(([re, what]) => {
    const hit = html.match(re);
    eq(hit ? hit[0] : null, null, '소스에 ' + what + ' 가 없다');
  });
});
if (fail) { console.error('실패 ' + fail + ' / 통과 ' + pass); process.exit(1); }
console.log('통과 ' + pass + '개. 전부 성공.');
