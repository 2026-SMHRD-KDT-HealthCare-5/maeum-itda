---
name: fsd-boundary-check
description: apps/frontend의 Feature-Sliced Design 레이어 import 경계(app>pages>widgets>features>entities>shared, 옆 슬라이스 직접 참조 금지, 슬라이스는 최상위 barrel로만 외부 노출)를 정적으로 점검한다. eslint-plugin-boundaries가 아직 없어 관례로만 지켜지는 규칙이므로, frontend에 새 import를 추가한 뒤·PR 올리기 전·사용자가 "FSD 경계 검사"/"import 규칙 확인"을 요청할 때 사용한다.
---

apps/frontend/CLAUDE.md에 정의된 레이어 규칙이 실제 코드에서 지켜지는지 확인한다. 이 저장소는 상대 경로 import를 쓰고 별도 alias가 없다(예: `from '../../entities/user'`).

## 레이어 순서

`app` → `pages` → `widgets` → `features` → `entities` → `shared` (왼쪽이 상위). 각 레이어는 자기보다 엄격히 하위인 레이어만 import할 수 있다.

## 점검할 위반 3종

1. **상위 레이어 역참조** — 하위 레이어 파일이 상위 레이어를 import.
   - `pages/*` 파일이 `app/`을 import
   - `widgets/*` 파일이 `app/` 또는 `pages/`를 import
   - `features/*` 파일이 `app/`, `pages/`, `widgets/`를 import
   - `entities/*` 파일이 `app/`, `pages/`, `widgets/`, `features/`를 import
   - `shared/*` 파일이 그 외 어떤 레이어든 import

2. **같은 레이어 내 옆 슬라이스 직접 참조** — `features/x`가 `features/y`를(또는 `entities/x`가 `entities/y`를) 직접 import. `entities`/`shared`를 거치지 않은 경우 위반.

3. **슬라이스 배럴 우회** — 슬라이스 바깥의 파일이 `features/x`나 `entities/x`의 최상위 `index.ts`가 아니라 `ui/`, `model/`, `api/`, `lib/` 하위 경로를 직접 import. 단 `features/x`/`entities/x` **내부** 파일이 자기 자신의 세그먼트를 참조하는 것은 위반이 아니다.

## 진행 절차

1. `Glob`으로 `apps/frontend/src/**/*.{ts,tsx}` 파일 목록을 얻는다.
2. 파일 경로에서 소속 레이어와(해당되면) 슬라이스 이름을 구한다(예: `src/features/start-conversation/ui/Foo.tsx` → 레이어 `features`, 슬라이스 `start-conversation`).
3. `Grep`으로 각 레이어 디렉터리(`path: apps/frontend/src/<layer>`)에서 import 문을 찾는다. 패턴 예시:
   - 상위 레이어 역참조: `from ['"](\.\./)+((app|pages|widgets|features)/)` 를 해당 레이어보다 하위 레이어들에 대해 각각 실행(예: `entities/` 안에서는 `(app|pages|widgets|features)` 전부, `features/` 안에서는 `(app|pages|widgets)` 만)
   - 슬라이스 배럴 우회: `from ['"](\.\./)+(features|entities)/[a-z0-9-]+/(ui|model|api|lib)/` — 매치된 파일이 그 슬라이스 자기 자신 내부가 아니면 위반
4. 옆 슬라이스 참조는 3의 배럴 우회 검사 결과 중, import 대상 슬라이스 이름이 import하는 파일 자신이 속한 슬라이스 이름과 다르고 같은 레이어인 경우로 판단한다(최상위 barrel import든 세그먼트 직접 import든 상관없이 위반).
5. 발견한 위반을 `파일:줄 — 위반 종류 — import 대상`형태로 정리해서 보고한다. 위반이 없으면 "위반 없음"이라고 짧게 보고한다. 수정까지 자동으로 하지 말고, 어느 레이어로 옮기거나 `entities`/`shared`를 경유해야 하는지 제안만 한다.
