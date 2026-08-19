/*
역할: NestJS가 질문별 복수 음성 답변을 묶어 FastAPI에 전달하고 결과를 받는 계약을 정의한다.
전체 흐름: AudioBinaryHandler → QuestionAnswerQueueService → AnalysisService → AiClient → FastAPI
주의: 이 파일은 FastAPI의 분석 로직을 구현하지 않고 두 서버 사이의 데이터 경계만 정의한다.
*/
import { SentimentLabel } from '../entities/emotion-tag.entity';
import { ScaleType } from '../entities/scale-question-analysis.entity';

// 시니어가 한 질문에 대해 녹음한 음성 한 건이다. 분석이 성공하기 전까지는
// DB에 저장되지 않으므로(결정사항: 분석 실패 시 DB에 흔적을 남기지 않는다)
// 아직 실제 MESSAGE_ID가 없다 — tempAnswerId는 같은 FastAPI 요청·응답
// 안에서만 답변을 구분하는 프로세스 메모리 전용 식별자다.
export interface QueuedAnswerSegment {
  tempAnswerId: number;
  seniorId: number;
  questionMessageId: number;
  generationId: string;
  audioTransferId: string;
  mimeType: string;
  capturedAt: string;
  endType: 'auto' | 'manual';
  audioBuffer: Buffer;
  // false면 저장·개별 분석은 수행하지만 이 묶음으로 새 AI 질문을 생성하지 않는다.
  continueConversation: boolean;
}

// 같은 AI 질문에 연결된 첫 답변과 추가 답변을 순서대로 묶은 분석 단위다.
export interface QuestionAnswerBatch {
  questionMessageId: number;
  seniorId: number;
  generationId: string;
  // false면 종료 직전 답변 분석 결과만 저장하고 다음 AI 질문은 저장·전송하지 않는다.
  continueConversation: boolean;
  answers: QueuedAnswerSegment[];
  // AnalysisService가 FastAPI 호출 직전에 DB 기준 최신 컨텍스트로 채운다.
  pendingScaleItems?: Record<ScaleType, string[]>;
  prevSessionSummary?: string;
  conversationTurns?: ConversationTurn[];
}

export interface ConversationTurn {
  speakerType: 'AI' | 'SENIOR';
  content: string;
}

export interface ScaleAnalysisResult {
  scaleType: ScaleType;
  questionNumber: number;
  // 모든 척도에서 1은 정서 위험 있음, 0은 위험 없음으로 방향을 통일한다.
  analysisScore: 0 | 1;
}

// FastAPI가 음성 한 건마다 반환해야 하는 STT·감성·척도 결과다. messageId는
// 요청 때 보낸 tempAnswerId를 그대로 echo한 값이며(FastAPI 계약 필드명은
// 그대로 유지, apps/ai-server 변경 없음), 아직 실제 DB MESSAGE_ID가 아니다.
export interface AnswerAnalysisResult {
  tempAnswerId: number;
  transcript: string;
  sentimentLabel: SentimentLabel;
  scaleAnalyses: ScaleAnalysisResult[];
}

// FastAPI가 질문별 음성 묶음 전체를 분석한 응답이다.
export interface QuestionAnswerAnalysisResult {
  answers: AnswerAnalysisResult[];
  nextQuestion: string;
  // FastAPI에서 다음 질문 생성은 성공했지만 TTS만 실패한 경우 두 필드는 함께 null이다.
  ttsAudioBase64: string | null;
  ttsMimeType: string | null;
}

export interface TtsAudioResult {
  base64: string;
  mimeType: string;
}

// DB 저장 완료 후 WebSocket으로 다음 질문을 보낼 때 사용하는 NestJS 내부 결과다.
export interface CompletedAudioAnalysis {
  // 다음 질문 유무와 무관하게(늦은 답변 포함) audio:transcript로 그대로 전달한다.
  answerTranscripts: Array<{ messageId: number; content: string }>;
  nextQuestion: {
    messageId: number;
    generationId: string;
    content: string;
  } | null;
  ttsAudio: TtsAudioResult | null;
}

// 재진입 시 오늘 마지막 메시지가 시니어 답변으로 끝난 경우, 새 음성 답변 없이
// 기존 문맥만으로 FastAPI가 생성한 이어가기 질문 결과다.
export interface ContinuationQuestionResult {
  question: string;
  ttsAudio: TtsAudioResult | null;
}
