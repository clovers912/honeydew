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

console.log('');
if (fail) { console.error('실패 ' + fail + ' / 통과 ' + pass); process.exit(1); }
console.log('통과 ' + pass + '개. 전부 성공.');
