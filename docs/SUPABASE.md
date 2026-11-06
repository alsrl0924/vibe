# Vibe 사용자별 기록 연동

2026-11-06 구현. 저장소 기준 커밋: 9180ec9041aded607b604a31280f54d871c3bad7.

## 연결 구조

- 공용 프로젝트: lkokgqqhsppezflqkbgx (네트워크관리사 문제은행).
- 기존 public.study_apps와 public.app_progress를 재사용. 새 DB/프로젝트/테이블 없음.
- 앱 ID: vibe-glossary. (app_id,user_id) 기본키와 사용자 소유권 RLS를 사용.
- 코드의 sb_publishable 키는 브라우저 공개용 키. service_role/secret 키 사용 금지.
- 앱 레지스트리 등록은 완료. 재실행 스크립트: supabase/register-vibe.sql.

## 사용자 동작

상단 로그인 → Google로 계속하기. 로그인하면 오답 횟수, 클립, 퀴즈 완료 기록, 배지, 연속 학습일을 계정별로 저장한다. 게스트도 기존처럼 기기에 저장한다.

기존 게스트 기록은 자동으로 계정에 넣지 않는다. 계정 메뉴의 '이 기기의 기존 기록 가져오기'를 사용자가 확인한 경우에만 합치며, 게스트 원본은 남긴다. 이전 버전 최초 기록은 vibe_pre_cloud_backup_v1에도 남긴다. 기존 버전이 이미 삭제한 최근 10회 이전 이력은 복원할 수 없다. 새 버전은 완료한 전체 퀴즈 이력을 보관하고 화면에는 최근 10회만 표시한다.

## 저장 및 충돌 처리

- 인증 저장 키: vibe-lkokgqqhsppezflqkbgx-auth-v1. 다른 앱 인증 키와 구분한다.
- 게스트: vibe_progress_state / 이전 vibe_guest_state.
- 계정 스냅샷: vibe_progress_user_<uid>.
- 계정 변경 로그: vibe_cloud_events_v2_<uid>. 계정 변경 시 화면을 다시 불러온다.
- 변경마다 UUID 이벤트를 기기에 먼저 저장한다. 오답 증가/감소, 클립 추가/제거, 퀴즈 완료, 배지, 출석을 병합한다.
- 원격 저장 시 app_id와 user_id 모두 필터링하고 updated_at 일치 조건으로 갱신한다. 충돌/최초 삽입 경쟁은 최대 5회 재조회·병합한다. 실패하면 기기 기록을 보존하고 재시도를 안내한다.
- 계정 내 서로 다른 기기의 이벤트는 합친다. 같은 클립의 상반된 수정은 기기 시각과 이벤트 ID 순서로 결정한다. 시계가 크게 어긋난 기기에서는 최종 클립 상태가 의도와 다를 수 있다.
- 연속 학습일은 가장 최근 날짜의 기록을 기준으로 한다. 서로 다른 기기가 오프라인에서 따로 쌓은 출석을 달력 단위로 재계산하지는 않는다.
- 옛 퀴즈에는 절대시각/ID가 없다. 동일한 항목은 최대 중복 횟수를 보존해 재가져오기 중복을 막는다. 서로 다른 기기의 완전히 동일한 옛 퀴즈는 구별할 수 없다. 기존 기기 기록의 순서는 유지한다.
- 이벤트/이력은 누적된다. 브라우저 저장 용량 초과나 서버 오류 시 계정 메뉴 상태를 확인한다.
- 서비스 워커는 Vibe 파일만 캐시하고 인증/API 응답은 캐시하지 않는다. 다른 앱 캐시는 삭제하지 않는다.

## 라이브러리

@supabase/supabase-js 2.118.0 공식 npm 패키지의 dist/umd/supabase.js를 js/supabase-2.118.0.js로 고정 보관. MIT 라이선스는 js/SUPABASE-LICENSE. 런타임 CDN 불필요.
SHA256: ee3be8de192b97cb1d73d1e95d6b82bb1f6b658c0f97c4ef757fc331996ed3d3.
공식 2026-11-06 changelog 확인: CLI v3 기본 로컬 대상 변경, 구형 TLS cipher 중단 등이 있으나 이 브라우저 SDK 통합에서 CLI 업그레이드나 TLS 설정 변경은 하지 않음.

## 검증 결과

- node --test tests/progress.test.cjs tests/cloud.test.cjs: 10/10 통과.
- 계정/게스트 분리, 동시 저장 CAS 재시도, 오프라인 재전송, 계정 변경, 구기록 중복/순서, 클립 해제, 오답 감소, 서비스 워커 캐시 격리 검사.
- HTML 인라인 2개 및 추가 JS 3개 문법 검사 통과.
- 용어/문제 데이터 영역 SHA256: dc67589854c333d6efbf19dc35447c25e8b89b2521b520c8b8d6452fa1fe5c95. 원본과 동일.
- 실제 DB 트랜잭션 검사: 소유자 읽기 허용, 타 사용자 조회/갱신/삽입 차단. 시험 데이터는 ROLLBACK.
- 기존 app_progress 4행 fingerprint b2ca1b05b95bf24664a4bda76362a3ed가 검사 전후 동일. Vibe 실제 사용자 기록은 아직 0건.
- 인앱 브라우저 localhost:4190: 로그인 안내, 클립 저장, 오답, 퀴즈 완료, 배지, 새로고침 후 통계 유지 확인. 실제 Google OAuth 왕복은 아직 미검증.

## 배포 결과 및 남은 확인

1. 완료: 승인 후 Supabase Auth Redirect URLs에 https://alsrl0924.github.io/vibe/ 추가. 기존 Site URL과 다른 앱 허용 주소는 유지.
2. 완료: 사용자 배포 지시 후 main에 d912ce656dd3e2a7ef7782b816391ff36122a951 반영. Pages 실행 42210976726 성공, 실제 사이트 로그인 화면 및 Google 연결 확인.
3. 남음: 브라우저의 Google 계정이 로그아웃 상태여서 실제 로그인 왕복은 미검증. 배포 사이트에서 사용자가 Google 로그인한 뒤 계정 기록 저장/새로고침/다른 기기 동기화를 확인.

## 기존 프로젝트 진단 결과

이번 작업은 앱 레지스트리 행만 추가했고 스키마/함수/정책은 변경하지 않았다. 기존 진단에는 관리용 study_apps와 migration_import_chunks의 RLS 정책 없음(INFO), rls_auto_enable 함수의 anon/authenticated 실행 가능 경고, 비밀번호 유출 방지 비활성 경고가 있었다. 이번 기능과 별개인 기존 설정은 바꾸지 않았다.
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## 롤백

배포 코드만 이전 커밋으로 되돌릴 수 있다. 기존 게스트 키는 그대로이며 계정 기록/앱 등록은 삭제하지 않는다. 새 버전에서 생성한 계정별 기록은 이전 버전 UI에는 보이지 않지만 기기와 DB에 남는다. 다른 앱이나 사용자 기록을 삭제하는 SQL은 실행하지 않는다.
