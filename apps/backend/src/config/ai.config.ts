/*
역할: FastAPI 음성 분석 REST API 주소를 환경변수에서 읽는 기준을 설명한다.
사용 환경변수: AI_BASE_URL (예: http://localhost:8000)
연결 경로: /analysis/audio/batch, /tts/synthesize, /reports/daily-summary
로컬과 배포 환경은 같은 키를 사용하고 실제 값만 각 환경의 비밀 설정에서 주입한다.
*/
export const AI_BASE_URL_ENV = 'AI_BASE_URL';
