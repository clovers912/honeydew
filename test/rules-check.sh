#!/usr/bin/env bash
# Firebase 규칙 실측 — database.rules.json 을 콘솔에 붙여 넣은 "뒤에" 돌린다.
#
# 왜 필요한가: 규칙은 배포해 봐야 알 수 있고, 틀리면 예외가 아니라
# "쓰기가 조용히 거부됨"으로 나타난다. 앱은 멀쩡해 보이는데 저장만 안 된다.
# 그래서 눈으로 보지 말고 여기서 센다.
#
#   bash test/rules-check.sh
#
# 임시 방을 만들어 검사하고 끝나면 지운다. 실제 방은 건드리지 않는다.
set -u

DB="https://honeydew-61afb-default-rtdb.asia-southeast1.firebasedatabase.app"
ROOM="zz-rulescheck-$(date +%s)-aaaaaaaaaaaa"
U="$DB/rooms/$ROOM"
SHORT="$DB/rooms/short"

pass=0; fail=0

# want=ok  → 거부되면 실패 / want=deny → 통과되면 실패
check(){
  local want="$1" what="$2" method="$3" url="$4" body="${5:-}"
  local out
  if [ -n "$body" ]; then out=$(curl -s -X "$method" "$url" -d "$body")
  else out=$(curl -s -X "$method" "$url"); fi
  local denied=0
  case "$out" in *'"error"'*) denied=1 ;; esac
  if { [ "$want" = ok ] && [ $denied -eq 0 ]; } || { [ "$want" = deny ] && [ $denied -eq 1 ]; }; then
    pass=$((pass+1)); printf '  PASS  %s\n' "$what"
  else
    fail=$((fail+1)); printf '  FAIL  %s\n        → %s\n' "$what" "$(echo "$out" | head -c 160)"
  fi
}

echo "허용돼야 하는 것"
check ok   "방 생성 (lmp·edd·items 전체 쓰기)" PUT "$U.json" \
  '{"lmp":"2026-07-23","edd":"2027-04-29","items":{"-K1":{"t":"첫 항목","d":false,"by":"wife","at":"2026-08-28T00:00:00.000Z"}}}'
check ok   "항목 단위 추가 items/-K2"          PUT "$U/items/-K2.json" \
  '{"t":"두번째","d":false,"by":"me","at":"2026-08-28T00:00:00.000Z","on":"2026-08-28"}'
check ok   "완료 토글 items/-K1/d"             PUT "$U/items/-K1/d.json" 'true'
check ok   "본문 수정 items/-K1/t"             PUT "$U/items/-K1/t.json" '"고친 글"'
check ok   "소프트 삭제 items/-K1/x"           PUT "$U/items/-K1/x.json" 'true'
check ok   "되돌리기 (x 제거)"                 DELETE "$U/items/-K1/x.json"
check ok   "방 읽기"                           GET "$U.json"

echo "막혀야 하는 것"
check deny "짧은 방 읽기"                      GET "$SHORT.json"
check deny "짧은 방 쓰기"                      PUT "$SHORT.json" '{"lmp":"2026-07-23","edd":"2027-04-29"}'
check deny "rooms 전체 목록 조회"              GET "$DB/rooms.json?shallow=true"
check deny "lmp·edd 없는 방"                   PUT "$DB/rooms/zz-nodate-aaaaaaaaaaaaaaaaaaaaaa.json" '{"items":{}}'
check deny "lmp 날짜 형식 위반"                PUT "$U/lmp.json" '"작년쯤"'
check deny "by 가 wife/me 가 아님"             PUT "$U/items/-K3.json" '{"t":"x","by":"stranger"}'
check deny "본문 없는 항목"                    PUT "$U/items/-K4.json" '{"by":"me","d":false}'
check deny "본문 500자 초과"                   PUT "$U/items/-K5.json" \
  "{\"t\":\"$(printf 'a%.0s' $(seq 1 501))\",\"by\":\"me\"}"
check deny "모르는 필드 (items/-K1/evil)"      PUT "$U/items/-K1/evil.json" '"1"'
check deny "방 최상위에 모르는 필드"           PUT "$U/hacked.json" '"1"'

curl -s -X DELETE "$U.json" >/dev/null
echo
if [ $fail -gt 0 ]; then
  echo "실패 $fail / 통과 $pass  — 규칙을 되돌리거나 고칠 것. 앱은 저장이 조용히 안 되는 상태가 된다."
  exit 1
fi
echo "통과 $pass 개. 전부 성공."
