# 현재 작업: 공통 앱 메뉴·로그인 공유

2026-11-07 구현·로컬 검증 완료. 아직 푸시/배포하지 않음. 상세는 docs/SHARED_LOGIN.md. 기존 배포 사이트는 아래 2026-11-06 상태이며, 새 기능의 실제 Google 로그인은 배포 후 확인해야 함.

# Vibe 작업 인계

2026-11-06: 공용 Supabase 사용자별 기록 연동 구현 및 배포 완료.

- 사이트: https://alsrl0924.github.io/vibe/
- 연동 코드 커밋: d912ce656dd3e2a7ef7782b816391ff36122a951.
- Pages 검증: https://github.com/alsrl0924/vibe/actions/runs/42210976726 (success).
- 공용 Supabase lkokgqqhsppezflqkbgx, 앱 ID vibe-glossary. 기존 테이블/RLS 재사용. 앱 등록과 Vibe 로그인 복귀 주소 추가 완료.
- 자동 검사 10개, 문법 검사, 원본 학습 데이터 동일성, 실제 DB RLS 검사 통과. 기존 app_progress 4행 불변.
- 브라우저: 실제 배포 사이트 로그인 버튼/안내 및 Google 로그인 화면 연결 확인. 로컬에서 클립/오답/퀴즈/배지 새로고침 보존 확인.
- 미검증: Google 계정이 로그아웃되어 있어 실제 로그인 왕복 및 로그인 후 클라우드 동기화는 아직 확인하지 못함.
- 다음 작업: 사용자가 배포 사이트에서 Google 로그인한 후 기록 저장·새로고침·다른 기기 동기화 확인. 게스트 기록 가져오기는 사용자 선택으로만 수행.
- 상세: docs/SUPABASE.md. 다른 앱/사용자 기록을 변경하거나 삭제하지 말 것.
