# Vibe 작업 인계

2026-11-06: 사용자 요청에 따라 공유 Supabase에 사용자별 학습 기록 연동 구현.

- 구현 파일: index.html, sw.js, css/cloud.css, js/progress-core.js, js/cloud-progress.js 및 고정 SDK/라이선스.
- 테스트: tests/progress.test.cjs, tests/cloud.test.cjs. 총 10개 통과. 인라인/추가 JS 문법 검사 통과. 원래 학습 데이터 변경 없음.
- DB: vibe-glossary 등록 완료. 기존 공용 스키마/RLS 사용. 실제 RLS 검사 후 시험 데이터 롤백. 기존 학습 기록 변동 없음.
- 인앱 브라우저 localhost:4190에서 게스트 클립/오답/퀴즈/배지 및 새로고침 보존 확인.
- 아직 GitHub 푸시/배포 안 함. 실제 Google 로그인 및 로그인 후 브라우저 동기화 미검증.
- 다음 작업: 사용자 확인을 받아 Supabase Auth의 Vibe 복귀 URL 추가, 명시적 배포 지시 후 원격 최신 여부 확인 및 푸시/Pages 검증.
- 상세 구조/주의점/검증은 docs/SUPABASE.md 참고. 사용자 원본 데이터나 다른 프로젝트를 변경/삭제하지 말 것.
