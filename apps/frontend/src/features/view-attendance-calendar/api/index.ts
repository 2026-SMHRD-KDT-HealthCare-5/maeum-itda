import { fetchConversationCalendar } from '../../../entities/conversation'

// UC-13: 이 달에 대화를 나눈 날짜 목록을 조회한다. 시니어 이전 대화 기록 조회
// 화면(entities/conversation)이 쓰는 캘린더 조회를 그대로 재사용한다 — 같은
// 데이터(그 달의 대화 존재 날짜)라 별도 엔드포인트가 필요 없다.
export { fetchConversationCalendar }
