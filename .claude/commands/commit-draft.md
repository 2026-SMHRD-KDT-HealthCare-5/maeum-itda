---
description: diff를 검토해 커밋 그룹과 Conventional Commit 메시지 초안을 만들고, 승인 후에만 커밋한다
argument-hint: [커밋 범위나 의도에 대한 설명 (선택)]
---

CLAUDE.md의 "커밋 전 승인" 규칙과 AGENTS.md의 커밋 절차를 실행한다. 이 명령이 끝나기 전까지 `git commit`을 실행하지 않는다.

1. `git branch --show-current`, `git status --short`, `git diff`, `git diff --staged`로 현재 브랜치·워킹트리·변경사항을 파악한다.
2. 현재 브랜치가 `dev`이면 커밋을 진행하지 말고 브랜치 규칙을 안내한 뒤 `/branch-check`로 feature 브랜치부터 만들 것을 제안하고 여기서 멈춘다.
3. 변경사항을 사용자가 이미 만들어둔 것과 이번 세션에서 만든 것으로 구분한다. 사용자 소유 변경사항을 임의로 같은 커밋에 섞지 않는다.
4. 논리적 단위로 diff를 그룹핑한다(예: 기능 구현과 포맷팅/설정 변경은 분리, 서로 다른 화면/모듈 작업은 분리).
5. 변경된 파일 중 지원 대상은 포맷팅하고 `pnpm format:check`로 확인한다. 변경 범위에 맞는 검증을 실행한다(frontend 변경 시 `pnpm --filter frontend lint`/`pnpm --filter frontend build`, backend 변경 시 `pnpm --filter backend test`, 여러 워크스페이스에 걸치면 `pnpm lint`/`pnpm build`). `git commit` 자체는 이미 husky pre-commit(`lint-staged`)이 한 번 더 검증하므로 이 단계를 생략하지는 않되 중복 걱정은 하지 않는다.
6. 각 커밋 그룹마다 Conventional Commit 접두사(`feat`/`fix`/`refactor`/`style`/`docs`/`chore`) 기준 메시지 초안을 작성한다. `$ARGUMENTS`가 주어졌으면 의도 파악에 참고한다.
7. 커밋 그룹 분할안과 각 메시지 초안(그리고 브랜치 이동이 필요하면 그 계획도 함께)을 사용자에게 제시하고 승인을 받는다. 승인 전에는 `git add`/`git commit`을 실행하지 않는다.
8. 승인 후에만 그룹별로 스테이징하고 커밋한다(메시지는 HEREDOC으로 작성).
9. 완료 후 커밋 해시, 각 커밋에 포함된 파일, 실행한 검증과 결과를 보고한다.
