#!/bin/bash
# 闪卡端到端烟雾测试
# 用法: bash scripts/smoke-test-flashcards.sh
# 前置: dev server 运行在 :3100，已注册 test 用户并配置 provider

BASE=http://localhost:3100
COOKIE_JAR=$(mktemp)

echo "=== 1. 登录 ==="
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$BASE/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "csrfToken=test&email=test@test.com&password=test1234" \
  -o /dev/null -w "HTTP %{http_code}\n"

echo "=== 2. 获取课程列表 ==="
COURSE=$(curl -s -b "$COOKIE_JAR" "$BASE/api/dashboard/stats" | head -1)
echo "$COURSE"

echo "=== 3. 上传测试教材 ==="
DOC=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE/api/library/upload" \
  -F "file=@scripts/test-lesson.md;type=text/markdown" \
  | tee /dev/stderr)
DOC_ID=$(echo "$DOC" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).document.id)}catch(e){console.log('')}})")

if [ -z "$DOC_ID" ]; then
  echo "ERROR: 上传失败，需要先创建 scripts/test-lesson.md"
  exit 1
fi
echo "documentId=$DOC_ID"

echo "=== 4. 生成课程 ==="
JOB=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE/api/courses/generate" \
  -H "Content-Type: application/json" \
  -d "{\"documentId\":\"$DOC_ID\"}")
JOB_ID=$(echo "$JOB" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).jobId||'')})")
echo "jobId=$JOB_ID"

echo "=== 5. 等待课程生成 ==="
for i in $(seq 1 30); do
  STATUS=$(curl -s -b "$COOKIE_JAR" "$BASE/api/jobs/$JOB_ID" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).status||'PENDING')})")
  echo "  [$i] status=$STATUS"
  if [ "$STATUS" = "COMPLETED" ]; then
    OUTPUT=$(curl -s -b "$COOKIE_JAR" "$BASE/api/jobs/$JOB_ID")
    COURSE_ID=$(echo "$OUTPUT" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).output?.courseId||'')})")
    break
  elif [ "$STATUS" = "FAILED" ]; then
    echo "ERROR: 课程生成失败"
    exit 1
  fi
  sleep 2
done

if [ -z "$COURSE_ID" ]; then
  echo "ERROR: 课程生成超时"
  exit 1
fi
echo "courseId=$COURSE_ID"

echo "=== 6. 获取第一个 lesson ==="
COURSE_DATA=$(curl -s -b "$COOKIE_JAR" "$BASE/api/courses/$COURSE_ID")
LESSON_ID=$(echo "$COURSE_DATA" | node -e "process.stdin.on('data',d=>{const c=JSON.parse(d);console.log(c.lessons?.[0]?.id||'')})")
echo "lessonId=$LESSON_ID"

echo "=== 7. 生成闪卡 ==="
CARDS=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE/api/flashcards" \
  -H "Content-Type: application/json" \
  -d "{\"lessonId\":\"$LESSON_ID\"}")
COUNT=$(echo "$CARDS" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).count||0)})")
echo "生成 $COUNT 张闪卡"

if [ "$COUNT" -eq 0 ]; then
  echo "ERROR: 闪卡生成失败"
  exit 1
fi

CARD_ID=$(echo "$CARDS" | node -e "process.stdin.on('data',d=>{const c=JSON.parse(d);console.log(c.flashcards?.[0]?.id||'')})")
echo "第一张 cardId=$CARD_ID"

echo "=== 8. 评分（confidence=5）==="
curl -s -b "$COOKIE_JAR" -X PATCH "$BASE/api/flashcards" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$CARD_ID\",\"confidence\":5}" \
  -w "HTTP %{http_code}\n" -o /dev/null

echo "=== 9. 刷新验证评分已持久化 ==="
VERIFY=$(curl -s -b "$COOKIE_JAR" "$BASE/api/flashcards?lessonId=$LESSON_ID")
CONF=$(echo "$VERIFY" | node -e "process.stdin.on('data',d=>{const c=JSON.parse(d);const card=c.flashcards.find(x=>x.id==='$CARD_ID');console.log(card?.confidence||'NOT FOUND')})")
NEXT=$(echo "$VERIFY" | node -e "process.stdin.on('data',d=>{const c=JSON.parse(d);const card=c.flashcards.find(x=>x.id==='$CARD_ID');console.log(card?.nextReviewAt||'NOT FOUND')})")
echo "confidence=$CONF  nextReviewAt=$NEXT"

if [ "$CONF" != "5" ]; then
  echo "FAIL: 评分未持久化"
  exit 1
fi

echo "=== 10. 修改评分（confidence=2）==="
curl -s -b "$COOKIE_JAR" -X PATCH "$BASE/api/flashcards" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$CARD_ID\",\"confidence\":2}" \
  -w "HTTP %{http_code}\n" -o /dev/null

VERIFY2=$(curl -s -b "$COOKIE_JAR" "$BASE/api/flashcards?lessonId=$LESSON_ID")
CONF2=$(echo "$VERIFY2" | node -e "process.stdin.on('data',d=>{const c=JSON.parse(d);const card=c.flashcards.find(x=>x.id==='$CARD_ID');console.log(card?.confidence||'NOT FOUND')})")
echo "修改后 confidence=$CONF2"

if [ "$CONF2" != "2" ]; then
  echo "FAIL: 评分覆盖写入失败"
  exit 1
fi

rm -f "$COOKIE_JAR"
echo ""
echo "==================="
echo "ALL TESTS PASSED ✅"
echo "==================="
