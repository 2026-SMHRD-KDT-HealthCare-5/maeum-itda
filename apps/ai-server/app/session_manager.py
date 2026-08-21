"""
LLM에 전달할 대화 문맥 자료구조와 메모리 매니저.

- 현재 REST 배치 분석은 요청마다 임시 SessionState를 생성한다.
- prev_session_summary와 pending_scale_items는 향후 REST 계약에서 문맥을 받을 때 사용한다.
- SessionManager는 지속 문맥이 다시 필요할 때 사용할 수 있도록 유지한다.
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SessionState:
    session_id: str
    user_id: str
    prev_session_summary: str = ""
    pending_scale_items: dict[str, list[str]] = field(default_factory=dict)
    conversation_turns: list[dict[str, str]] = field(default_factory=list)

    def history_as_text(self) -> str:
        """LLM 프롬프트에 넣을 대화 히스토리 텍스트.

        [2026-08-21 수정] 이전에는 최근 8개로 잘라 넘겼으나, 백엔드
        (AnalysisContextRepository)가 이미 "오늘 대화 전체"를 보내는 것으로
        바뀐 지 오래라(주석 참고) 여기서 다시 자르면 그 확장이 무의미해진다 —
        오늘 대화가 길어질수록 LLM이 앞서 나온 화제·이미 물어본 질문을 잊고
        똑같은 질문을 반복하는 문제가 실제로 관찰됐다. 비정상적으로 큰
        페이로드에 대한 안전장치는 main.py의 MAX_CONVERSATION_TURNS가 담당하므로
        여기서 추가로 자르지 않는다.
        """
        if not self.conversation_turns:
            return ""
        labels = {"SENIOR": "시니어", "AI": "AI"}
        return "\n".join(
            f"{labels[turn['speakerType']]}: {turn['content']}"
            for turn in self.conversation_turns
        )


class SessionManager:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionState] = {}

    def create(self, session_id: str, user_id: str, prev_summary: str,
               pending_scale_items: dict[str, list[str]]) -> SessionState:
        state = SessionState(
            session_id=session_id,
            user_id=user_id,
            prev_session_summary=prev_summary,
            pending_scale_items=pending_scale_items,
        )
        self._sessions[session_id] = state
        return state

    def get(self, session_id: str) -> Optional[SessionState]:
        return self._sessions.get(session_id)

    def remove(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)


# 프로세스 전역 싱글턴 (AI 서버가 단일 워커로 뜬다는 전제.
# 멀티 워커/프로세스로 스케일링하려면 Redis 등 외부 스토어로 교체 필요)
session_manager = SessionManager()
