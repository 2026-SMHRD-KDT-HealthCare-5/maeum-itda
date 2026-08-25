/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface CheckLoginIdResponseDto {
  /**
   * 중복 여부를 확인한 로그인 아이디
   * @example "senior01"
   */
  loginId: string;
  /**
   * 아이디 사용 가능 여부
   * @example true
   */
  available: boolean;
  /**
   * 사용 가능 여부 안내 문구
   * @example "사용할 수 있는 아이디입니다."
   */
  message: string;
}

export interface ApiErrorResponseDto {
  /**
   * HTTP 상태 코드
   * @example 400
   */
  statusCode: number;
  /** 오류 메시지 또는 ValidationPipe가 반환한 메시지 목록 */
  message: string | string[];
  /**
   * HTTP 오류 이름
   * @example "Bad Request"
   */
  error: string;
}

export interface LoginDto {
  /**
   * 로그인 아이디
   * @example "senior01"
   */
  loginId: string;
  /**
   * 비밀번호
   * @example "password123!"
   */
  password: string;
}

export interface AuthenticatedUserResponseDto {
  /**
   * 생성된 사용자 ID
   * @example 1
   */
  userId: number;
  /**
   * 로그인 아이디
   * @example "senior01"
   */
  loginId: string;
  /**
   * 사용자 이름
   * @example "홍길동"
   */
  name: string;
  /**
   * 하이픈을 제외한 휴대전화 번호
   * @example "01012345678"
   */
  phone: string;
  /**
   * 사용자 역할
   * @example "SENIOR"
   */
  role: "SENIOR" | "GUARDIAN";
  /**
   * 회원가입 시각
   * @format date-time
   * @example "2026-08-13T09:00:00.000Z"
   */
  joinedAt: string;
}

export interface LoginResponseDto {
  /** REST와 WebSocket 인증에 사용할 JWT Access Token */
  accessToken: string;
  user: AuthenticatedUserResponseDto;
}

export interface SignUpDto {
  /**
   * 로그인 아이디
   * @example "senior01"
   */
  loginId: string;
  /**
   * 4~72자의 비밀번호
   * @example "password123!"
   */
  password: string;
  /**
   * 비밀번호 확인
   * @example "password123!"
   */
  passwordConfirm: string;
  /**
   * 사용자 이름
   * @example "홍길동"
   */
  name: string;
  /**
   * 휴대폰 번호(하이픈 포함·미포함 허용)
   * @example "010-1234-5678"
   */
  phone: string;
  /**
   * 사용자 역할
   * @example "SENIOR"
   */
  role: "SENIOR" | "GUARDIAN";
  /**
   * 필수 약관 동의 여부
   * @example true
   */
  termsAgreed: boolean;
}

export interface SignUpResponseDto {
  /**
   * 생성된 사용자 ID
   * @example 1
   */
  userId: number;
  /**
   * 로그인 아이디
   * @example "senior01"
   */
  loginId: string;
  /**
   * 사용자 이름
   * @example "홍길동"
   */
  name: string;
  /**
   * 하이픈을 제외한 휴대전화 번호
   * @example "01012345678"
   */
  phone: string;
  /**
   * 사용자 역할
   * @example "SENIOR"
   */
  role: "SENIOR" | "GUARDIAN";
  /**
   * 회원가입 시각
   * @format date-time
   * @example "2026-08-13T09:00:00.000Z"
   */
  joinedAt: string;
}

export interface UserResponseDto {
  /** @example 1 */
  userId: number;
  /** @example "senior01" */
  loginId: string;
  /** @example "김순자" */
  name: string;
  /** @example "01012345678" */
  phone: string;
  /** @example "SENIOR" */
  role: "SENIOR" | "GUARDIAN";
  /**
   * @format date-time
   * @example "2026-08-13T09:00:00.000Z"
   */
  joinedAt: string;
}

export interface UpdateMyProfileDto {
  /**
   * 사용자 이름
   * @example "김순자"
   */
  name?: string;
  /**
   * 휴대폰 번호(하이픈 포함·미포함 허용)
   * @example "010-1234-5678"
   */
  phone?: string;
}

export interface ChatHistoryMessageDto {
  /**
   * 대화 메시지 ID
   * @example 101
   */
  messageId: number;
  /**
   * 발화 주체
   * @example "AI"
   */
  speakerType: "AI" | "SENIOR";
  /**
   * 메시지 내용. STT 처리 전 또는 실패 시 null일 수 있다.
   * @example "오늘 하루는 어땠나요?"
   */
  content: string | null;
  /** STT 처리 상태 */
  sttStatus: "NOT_REQUIRED" | "WAITING" | "PROCESSING" | "COMPLETED" | "FAILED";
  /**
   * 메시지 생성 시각
   * @format date-time
   * @example "2026-08-13T09:00:00.000Z"
   */
  createdAt: string;
}

export interface ChatHistoryPageResponseDto {
  /** 최신순 대화 메시지 목록 */
  messages: ChatHistoryMessageDto[];
  /**
   * 다음 조회에 사용할 cursor. 다음 페이지가 없으면 null
   * @example 72
   */
  nextCursor: object | null;
}

export interface ChatCalendarResponseDto {
  /** @example 2026 */
  year: number;
  /** @example 8 */
  month: number;
  /** @example ["2026-08-03","2026-08-05","2026-08-13"] */
  conversationDates: string[];
}

export interface VoiceAnalysisStatusResponseDto {
  /**
   * 음성 분석 상태 행 ID
   * @example 10
   */
  voiceAnalysisId: number;
  /**
   * 분석 대상 메시지 ID
   * @example 101
   */
  messageId: number;
  /** 음성 분석 처리 상태 */
  processingStatus: "WAITING" | "PROCESSING" | "COMPLETED" | "FAILED";
  /**
   * 분석 완료 시각. 완료 전에는 null
   * @format date-time
   * @example "2026-08-13T09:00:10.000Z"
   */
  analyzedAt: object | null;
  /**
   * 분석 실패 원인. 실패 상태가 아니면 null
   * @example null
   */
  errorMessage: string | null;
}

export interface NextQuestionResponseDto {
  /**
   * 다음 AI 질문 메시지 ID
   * @example 102
   */
  messageId: number;
  /**
   * 다음 질문 생성 작업 ID
   * @example "2c090794-f585-49dc-9588-43aeb3f0f09f"
   */
  generationId: string;
  /**
   * 다음 AI 질문 내용
   * @example "그때 어떤 기분이 드셨나요?"
   */
  content: string;
}

export interface RetryAudioAnalysisResponseDto {
  /**
   * 분석을 완료한 답변 메시지 ID 목록
   * @example [103,104]
   */
  answerMessageIds: number[];
  /** 새로 생성한 다음 질문. 대화 종료 상태이면 null */
  nextQuestion: NextQuestionResponseDto | null;
}

export interface DailyReportCalendarItemDto {
  /** @example 31 */
  reportId: number;
  /** @example "2026-08-13" */
  date: string;
  generationStatus: "WAITING" | "COMPLETED" | "FAILED";
}

export interface WeeklyReportCalendarItemDto {
  /** @example 10 */
  weeklyReportId: number;
  /** @example "2026-08-03" */
  weekStart: string;
  /** @example "2026-08-09" */
  weekEnd: string;
  generationStatus: "WAITING" | "COMPLETED" | "FAILED";
}

export interface ReportCalendarResponseDto {
  /** @example 2026 */
  year: number;
  /** @example 8 */
  month: number;
  dailyReports: DailyReportCalendarItemDto[];
  weeklyReports: WeeklyReportCalendarItemDto[];
}

export interface DailyReportEvidenceResponseDto {
  /** @example 101 */
  messageId: number;
  /** @example "어젯밤에는 잘 주무셨어요?" */
  question?: object | null;
  /** @example "새벽에 한 번 깼지만 괜찮아." */
  answer: string;
  /** @example true */
  isRiskEvidence: boolean;
  /** @example "부정" */
  sentimentLabel?: "긍정" | "보통" | "부정" | null;
  /** @example "불안" */
  scaleLabel?: "우울" | "불안" | "고립" | null;
  /** @format date-time */
  questionCreatedAt?: object | null;
  /** @format date-time */
  answerCreatedAt: string;
}

export interface DailyReportResponseDto {
  /** @example 31 */
  reportId: number;
  /**
   * 연결된 시니어 ID
   * @example 7
   */
  seniorId: number;
  /**
   * 서울 기준 리포트 날짜
   * @example "2026-08-14"
   */
  reportDate: string;
  /**
   * 0~100 정서지수. 데이터가 부족하면 null
   * @min 0
   * @max 100
   * @example 80
   */
  emotionIndex?: object | null;
  /**
   * 하루 대화 한 줄 요약. 생성 전이면 null
   * @example "오늘은 가족과 산책한 이야기를 편안하게 나누셨어요."
   */
  conversationSummary?: string | null;
  /**
   * 보호자에게 제안하는 행동. 생성 전이면 null
   * @example "가벼운 안부 전화를 건네 보세요."
   */
  recommendedAction?: string | null;
  /** @example "COMPLETED" */
  generationStatus: "WAITING" | "COMPLETED" | "FAILED";
  evidences: DailyReportEvidenceResponseDto[];
  /**
   * @format date-time
   * @example "2026-08-15T00:00:00.000Z"
   */
  createdAt: string;
}

export interface WeeklyDailyReportItemDto {
  /** @example 31 */
  reportId?: object | null;
  /** @example "2026-08-03" */
  date: string;
  /**
   * @min 0
   * @max 100
   * @example 75
   */
  emotionIndex?: object | null;
  /** @example "GOOD" */
  emotionLevel?: "BAD" | "NORMAL" | "GOOD" | null;
  /** @example "대화를 편안하게 이어가셨어요." */
  summary?: object | null;
}

export interface WeeklyReportResponseDto {
  /** @example 10 */
  weeklyReportId: number;
  /** @example 9 */
  seniorId: number;
  /** @example "2026-08-03" */
  weekStart: string;
  /** @example "2026-08-09" */
  weekEnd: string;
  dailyReports: WeeklyDailyReportItemDto[];
  /** @example 5 */
  validDays: number;
  /** @example 65 */
  averageScore?: object | null;
  /** @example 93 */
  maxScore?: object | null;
  /** @example 41 */
  minScore?: object | null;
  /** @example "이번 주에는 전반적으로 안정적인 모습을 보이셨어요." */
  weeklySummary: string;
  /** @example "COMPLETED" */
  generationStatus: "WAITING" | "COMPLETED" | "FAILED";
  /**
   * @format date-time
   * @example "2026-08-10T00:10:00.000Z"
   */
  createdAt: string;
  /**
   * @format date-time
   * @example "2026-08-10T00:10:00.000Z"
   */
  updatedAt: string;
}

export interface VapidPublicKeyResponseDto {
  /** 브라우저 pushManager.subscribe()에 전달할 공개키 */
  publicKey: string;
}

export interface PushSubscriptionKeysDto {
  /** 브라우저 PushSubscription의 p256dh 공개키 */
  p256dh: string;
  /** 브라우저 PushSubscription의 auth 인증값 */
  auth: string;
}

export interface UpsertPushSubscriptionDto {
  /**
   * Push Service가 발급한 HTTPS endpoint
   * @example "https://fcm.googleapis.com/fcm/send/example-token"
   */
  endpoint: string;
  /**
   * 브라우저가 제공한 만료 시각(ms). 보통 null
   * @example null
   */
  expirationTime?: object | null;
  keys: PushSubscriptionKeysDto;
}

export interface PushSubscriptionResponseDto {
  /** @example 1 */
  subscriptionId: number;
  /** @example "https://fcm.googleapis.com/fcm/send/example-token" */
  endpoint: string;
  /** @example null */
  expirationTime?: object | null;
  /** @format date-time */
  createdAt: string;
  /** @format date-time */
  updatedAt: string;
}

export interface DeletePushSubscriptionDto {
  /**
   * 해제할 현재 브라우저 PushSubscription endpoint
   * @example "https://fcm.googleapis.com/fcm/send/example-token"
   */
  endpoint: string;
}

export interface NotificationTargetDto {
  type: "DAILY_REPORT" | "WEEKLY_REPORT";
  /** @example 31 */
  reportId?: object | null;
  /** @example "2026-08-13" */
  reportDate?: object | null;
  /** @example 10 */
  weeklyReportId?: object | null;
  /** @example "2026-08-03" */
  weekStart?: object | null;
}

export interface NotificationItemDto {
  /** @example 15 */
  alertId: number;
  type: "EMOTION_INDEX_DROP" | "WEEKLY_REPORT_READY";
  /** @example "정서지수 하락 감지" */
  title: string;
  /** @example "어르신의 정서지수가 설정한 기준보다 낮아요." */
  content: string;
  /** @example false */
  isRead: boolean;
  /**
   * @format date-time
   * @example "2026-08-14T00:31:00.000Z"
   */
  createdAt: string;
  target: NotificationTargetDto;
}

export interface NotificationListResponseDto {
  notifications: NotificationItemDto[];
  /** @example 7 */
  nextCursor?: object | null;
  /** @example 2 */
  unreadCount: number;
}

export interface ConnectionCounterpartResponseDto {
  /** @example 2 */
  userId: number;
  /** @example "guardian01" */
  loginId: string;
  /** @example "김민준" */
  name: string;
  /** @example "GUARDIAN" */
  role: "SENIOR" | "GUARDIAN";
}

export interface ConnectionResponseDto {
  /** @example 10 */
  relationshipId: object | null;
  /** @example "CONNECTED" */
  status: "REQUESTED" | "CONNECTED" | "REJECTED" | "DISCONNECTED" | null;
  /** @format date-time */
  requestedAt: object | null;
  /** @format date-time */
  connectedAt: object | null;
  counterpart: ConnectionCounterpartResponseDto | null;
}

export interface CreateConnectionRequestDto {
  /**
   * 연결할 시니어 로그인 아이디
   * @example "senior01"
   */
  seniorLoginId: string;
}

export interface GuardianDashboardPersonDto {
  /** @example 10 */
  userId: number;
  /** @example "테스트가디언" */
  name: string;
}

export interface GuardianDashboardSeniorDto {
  /** @example 10 */
  userId: number;
  /** @example "테스트가디언" */
  name: string;
  /** @format date-time */
  connectedAt: string;
  /**
   * 연결 승인일을 1일째로 계산한 함께한 일수
   * @example 30
   */
  daysTogether: number;
}

export interface GuardianDashboardDailyReportDto {
  /** @example 9 */
  reportId?: object | null;
  /**
   * @format date
   * @example "2026-08-13"
   */
  reportDate: string;
  /**
   * @min 0
   * @max 100
   * @example 49
   */
  emotionIndex?: object | null;
  /** @example "BAD" */
  emotionLevel?: "BAD" | "NORMAL" | "GOOD" | null;
  /** @example "평소보다 정서지수가 낮게 나타났어요." */
  conversationSummary?: string | null;
  /** @example "가볍게 안부를 확인해 주세요." */
  recommendedAction?: string | null;
  generationStatus?: "WAITING" | "COMPLETED" | "FAILED" | null;
}

export interface GuardianDashboardTrendPointDto {
  /**
   * @format date
   * @example "2026-08-13"
   */
  date: string;
  /**
   * @min 0
   * @max 100
   * @example 49
   */
  emotionIndex?: object | null;
}

export interface GuardianDashboardResponseDto {
  guardian: GuardianDashboardPersonDto;
  senior: GuardianDashboardSeniorDto;
  /**
   * 전날 리포트의 권장 행동. 대화 없음과 분석 데이터 부족은 각각 안내 문구로 구분
   * @example "가볍게 안부를 확인해 주세요."
   */
  dasolMessage: string;
  latestDailyReport: GuardianDashboardDailyReportDto;
  recentSevenDays: GuardianDashboardTrendPointDto[];
}

export interface GuardianAlertSettingResponseDto {
  /**
   * 정서지수 하락 알림 사용 여부
   * @example true
   */
  enabled: boolean;
  /**
   * 정서지수 하락 알림 임계치
   * @min 0
   * @max 100
   * @example 50
   */
  threshold: number;
}

export interface UpdateGuardianAlertSettingDto {
  /**
   * 정서지수 하락 알림 사용 여부
   * @example true
   */
  enabled?: boolean;
  /**
   * 정서지수 하락 알림 임계치
   * @min 0
   * @max 100
   * @example 50
   */
  threshold?: number;
}

export interface SeniorCheckinSettingResponseDto {
  /**
   * 매일 안부 알림 사용 여부
   * @example true
   */
  enabled: boolean;
  /**
   * Asia/Seoul 기준 매일 알림 시각
   * @example "09:00"
   */
  time: string;
}

export interface UpdateSeniorCheckinSettingDto {
  /**
   * 매일 안부 알림 사용 여부
   * @example true
   */
  enabled?: boolean;
  /**
   * Asia/Seoul 기준 매일 알림 시각
   * @pattern ^([01]\d|2[0-3]):[0-5]\d$
   * @example "09:00"
   */
  time?: string;
}

export type QueryParamsType = Record<string | number, any>;
export type ResponseFormat = keyof Omit<Body, "body" | "bodyUsed">;

export interface FullRequestParams extends Omit<RequestInit, "body"> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseFormat;
  /** request body */
  body?: unknown;
  /** base url */
  baseUrl?: string;
  /** request cancellation token */
  cancelToken?: CancelToken;
}

export type RequestParams = Omit<
  FullRequestParams,
  "body" | "method" | "query" | "path"
>;

export interface ApiConfig<SecurityDataType = unknown> {
  baseUrl?: string;
  baseApiParams?: Omit<RequestParams, "baseUrl" | "cancelToken" | "signal">;
  securityWorker?: (
    securityData: SecurityDataType | null,
  ) => Promise<RequestParams | void> | RequestParams | void;
  customFetch?: typeof fetch;
}

export interface HttpResponse<D extends unknown, E extends unknown = unknown>
  extends Response {
  data: D;
  error: E;
}

type CancelToken = Symbol | string | number;

export enum ContentType {
  Json = "application/json",
  JsonApi = "application/vnd.api+json",
  FormData = "multipart/form-data",
  UrlEncoded = "application/x-www-form-urlencoded",
  Text = "text/plain",
}

export class HttpClient<SecurityDataType = unknown> {
  public baseUrl: string = "";
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
  private abortControllers = new Map<CancelToken, AbortController>();
  private customFetch = (...fetchParams: Parameters<typeof fetch>) =>
    fetch(...fetchParams);

  private baseApiParams: RequestParams = {
    credentials: "same-origin",
    headers: {},
    redirect: "follow",
    referrerPolicy: "no-referrer",
  };

  constructor(apiConfig: ApiConfig<SecurityDataType> = {}) {
    Object.assign(this, apiConfig);
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected encodeQueryParam(key: string, value: any) {
    const encodedKey = encodeURIComponent(key);
    return `${encodedKey}=${encodeURIComponent(typeof value === "number" ? value : `${value}`)}`;
  }

  protected addQueryParam(query: QueryParamsType, key: string) {
    return this.encodeQueryParam(key, query[key]);
  }

  protected addArrayQueryParam(query: QueryParamsType, key: string) {
    const value = query[key];
    return value.map((v: any) => this.encodeQueryParam(key, v)).join("&");
  }

  protected toQueryString(rawQuery?: QueryParamsType): string {
    const query = rawQuery || {};
    const keys = Object.keys(query).filter(
      (key) => "undefined" !== typeof query[key],
    );
    return keys
      .map((key) =>
        Array.isArray(query[key])
          ? this.addArrayQueryParam(query, key)
          : this.addQueryParam(query, key),
      )
      .join("&");
  }

  protected addQueryParams(rawQuery?: QueryParamsType): string {
    const queryString = this.toQueryString(rawQuery);
    return queryString ? `?${queryString}` : "";
  }

  private contentFormatters: Record<ContentType, (input: any) => any> = {
    [ContentType.Json]: (input: any) =>
      input !== null && (typeof input === "object" || typeof input === "string")
        ? JSON.stringify(input)
        : input,
    [ContentType.JsonApi]: (input: any) =>
      input !== null && (typeof input === "object" || typeof input === "string")
        ? JSON.stringify(input)
        : input,
    [ContentType.Text]: (input: any) =>
      input !== null && typeof input !== "string"
        ? JSON.stringify(input)
        : input,
    [ContentType.FormData]: (input: any) => {
      if (input instanceof FormData) {
        return input;
      }

      return Object.keys(input || {}).reduce((formData, key) => {
        const property = input[key];
        formData.append(
          key,
          property instanceof Blob
            ? property
            : typeof property === "object" && property !== null
              ? JSON.stringify(property)
              : `${property}`,
        );
        return formData;
      }, new FormData());
    },
    [ContentType.UrlEncoded]: (input: any) => this.toQueryString(input),
  };

  protected mergeRequestParams(
    params1: RequestParams,
    params2?: RequestParams,
  ): RequestParams {
    return {
      ...this.baseApiParams,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...(this.baseApiParams.headers || {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected createAbortSignal = (
    cancelToken: CancelToken,
  ): AbortSignal | undefined => {
    if (this.abortControllers.has(cancelToken)) {
      const abortController = this.abortControllers.get(cancelToken);
      if (abortController) {
        return abortController.signal;
      }
      return void 0;
    }

    const abortController = new AbortController();
    this.abortControllers.set(cancelToken, abortController);
    return abortController.signal;
  };

  public abortRequest = (cancelToken: CancelToken) => {
    const abortController = this.abortControllers.get(cancelToken);

    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(cancelToken);
    }
  };

  public request = async <T = any, E = any>({
    body,
    secure,
    path,
    type,
    query,
    format,
    baseUrl,
    cancelToken,
    ...params
  }: FullRequestParams): Promise<HttpResponse<T, E>> => {
    const secureParams =
      ((typeof secure === "boolean" ? secure : this.baseApiParams.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const queryString = query && this.toQueryString(query);
    const payloadFormatter = this.contentFormatters[type || ContentType.Json];
    const responseFormat = format || requestParams.format;

    return this.customFetch(
      `${baseUrl || this.baseUrl || ""}${path}${queryString ? `?${queryString}` : ""}`,
      {
        ...requestParams,
        headers: {
          ...(requestParams.headers || {}),
          ...(type && type !== ContentType.FormData
            ? { "Content-Type": type }
            : {}),
        },
        signal:
          (cancelToken
            ? this.createAbortSignal(cancelToken)
            : requestParams.signal) || null,
        body:
          typeof body === "undefined" || body === null
            ? null
            : payloadFormatter(body),
      },
    ).then(async (response) => {
      const r = response as HttpResponse<T, E>;
      r.data = null as unknown as T;
      r.error = null as unknown as E;

      const responseToParse = responseFormat ? response.clone() : response;
      const data = !responseFormat
        ? r
        : await responseToParse[responseFormat]()
            .then((data) => {
              if (r.ok) {
                r.data = data;
              } else {
                r.error = data;
              }
              return r;
            })
            .catch((e) => {
              r.error = e;
              return r;
            });

      if (cancelToken) {
        this.abortControllers.delete(cancelToken);
      }

      if (!response.ok) throw data;
      return data;
    });
  };
}

/**
 * @title 마음잇다 API
 * @version 1.0
 * @contact
 *
 * 마음잇다 백엔드 REST API 명세서
 */
export class Api<
  SecurityDataType extends unknown,
> extends HttpClient<SecurityDataType> {
  auth = {
    /**
     * No description
     *
     * @tags 1. 인증 및 회원가입
     * @name AuthControllerCheckLoginId
     * @summary 회원가입 아이디 중복 확인
     * @request GET:/auth/check-login-id
     */
    authControllerCheckLoginId: (
      query: {
        /**
         * 중복 여부를 확인할 로그인 아이디
         * @example "senior01"
         */
        loginId: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<CheckLoginIdResponseDto, ApiErrorResponseDto>({
        path: `/auth/check-login-id`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags 1. 인증 및 회원가입
     * @name AuthControllerLogin
     * @summary 로그인
     * @request POST:/auth/login
     */
    authControllerLogin: (data: LoginDto, params: RequestParams = {}) =>
      this.request<LoginResponseDto, ApiErrorResponseDto>({
        path: `/auth/login`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags 1. 인증 및 회원가입
     * @name AuthControllerSignUp
     * @summary 회원가입
     * @request POST:/auth/signup
     */
    authControllerSignUp: (data: SignUpDto, params: RequestParams = {}) =>
      this.request<SignUpResponseDto, ApiErrorResponseDto>({
        path: `/auth/signup`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  users = {
    /**
     * No description
     *
     * @tags 2. 내 계정 관리
     * @name UsersControllerGetMyProfile
     * @summary 내 정보 조회
     * @request GET:/users/me
     * @secure
     */
    usersControllerGetMyProfile: (params: RequestParams = {}) =>
      this.request<UserResponseDto, ApiErrorResponseDto>({
        path: `/users/me`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags 2. 내 계정 관리
     * @name UsersControllerUpdateMyProfile
     * @summary 내 기본 정보 수정
     * @request PATCH:/users/me
     * @secure
     */
    usersControllerUpdateMyProfile: (
      data: UpdateMyProfileDto,
      params: RequestParams = {},
    ) =>
      this.request<UserResponseDto, ApiErrorResponseDto>({
        path: `/users/me`,
        method: "PATCH",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags 2. 내 계정 관리
     * @name UsersControllerWithdraw
     * @summary 회원 탈퇴
     * @request DELETE:/users/me
     * @secure
     */
    usersControllerWithdraw: (params: RequestParams = {}) =>
      this.request<void, ApiErrorResponseDto>({
        path: `/users/me`,
        method: "DELETE",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags 2. 내 계정 관리
     * @name ProfileSettingsControllerGetGuardianAlertSetting
     * @summary 보호자 알림 수신 여부와 정서지수 임계치 확인
     * @request GET:/users/me/emotion-alert-settings
     * @secure
     */
    profileSettingsControllerGetGuardianAlertSetting: (
      params: RequestParams = {},
    ) =>
      this.request<GuardianAlertSettingResponseDto, ApiErrorResponseDto>({
        path: `/users/me/emotion-alert-settings`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags 2. 내 계정 관리
     * @name ProfileSettingsControllerUpdateGuardianAlertSetting
     * @summary 보호자 알림 수신 여부 또는 정서지수 임계치 변경
     * @request PATCH:/users/me/emotion-alert-settings
     * @secure
     */
    profileSettingsControllerUpdateGuardianAlertSetting: (
      data: UpdateGuardianAlertSettingDto,
      params: RequestParams = {},
    ) =>
      this.request<GuardianAlertSettingResponseDto, ApiErrorResponseDto>({
        path: `/users/me/emotion-alert-settings`,
        method: "PATCH",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags 2. 내 계정 관리
     * @name ProfileSettingsControllerGetSeniorCheckinSetting
     * @summary 시니어 안부 알림 수신 여부와 예약 시간 확인
     * @request GET:/users/me/checkin-reminder-settings
     * @secure
     */
    profileSettingsControllerGetSeniorCheckinSetting: (
      params: RequestParams = {},
    ) =>
      this.request<SeniorCheckinSettingResponseDto, ApiErrorResponseDto>({
        path: `/users/me/checkin-reminder-settings`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags 2. 내 계정 관리
     * @name ProfileSettingsControllerUpdateSeniorCheckinSetting
     * @summary 시니어 안부 알림 수신 여부 또는 예약 시간 변경
     * @request PATCH:/users/me/checkin-reminder-settings
     * @secure
     */
    profileSettingsControllerUpdateSeniorCheckinSetting: (
      data: UpdateSeniorCheckinSettingDto,
      params: RequestParams = {},
    ) =>
      this.request<SeniorCheckinSettingResponseDto, ApiErrorResponseDto>({
        path: `/users/me/checkin-reminder-settings`,
        method: "PATCH",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  chats = {
    /**
     * No description
     *
     * @tags 3. 대화 기록
     * @name ChatsControllerGetMessages
     * @summary 시니어 전체·날짜별 과거 대화 cursor 조회
     * @request GET:/chats/messages
     * @secure
     */
    chatsControllerGetMessages: (
      query?: {
        /**
         * 서울 기준 조회 날짜. 생략하면 전체 과거 대화를 조회한다.
         * @example "2026-08-13"
         */
        date?: string;
        /**
         * 이 메시지 ID보다 오래된 기록을 조회한다.
         * @min 1
         * @example 101
         */
        cursor?: number;
        /**
         * 조회 개수
         * @min 1
         * @max 100
         * @default 30
         * @example 30
         */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<ChatHistoryPageResponseDto, ApiErrorResponseDto>({
        path: `/chats/messages`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags 3. 대화 기록
     * @name ChatsControllerGetCalendar
     * @summary 시니어 대화 존재 날짜 달력 조회
     * @request GET:/chats/calendar
     * @secure
     */
    chatsControllerGetCalendar: (
      query: {
        /**
         * @min 2020
         * @max 2100
         * @example 2026
         */
        year: number;
        /**
         * @min 1
         * @max 12
         * @example 8
         */
        month: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<ChatCalendarResponseDto, ApiErrorResponseDto>({
        path: `/chats/calendar`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),
  };
  analysis = {
    /**
     * No description
     *
     * @tags 4. 음성 분석
     * @name AnalysisControllerGetStatus
     * @summary 메시지의 음성 분석 상태 조회(본인 메시지만)
     * @request GET:/analysis/audio/{messageId}/status
     * @secure
     */
    analysisControllerGetStatus: (
      messageId: number,
      params: RequestParams = {},
    ) =>
      this.request<VoiceAnalysisStatusResponseDto, ApiErrorResponseDto>({
        path: `/analysis/audio/${messageId}/status`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags 4. 음성 분석
     * @name AnalysisControllerRetry
     * @summary 메모리에 대기 중인 질문별 음성 분석 재시도(본인 대화만)
     * @request POST:/analysis/audio/question/{questionMessageId}/retry
     * @secure
     */
    analysisControllerRetry: (
      questionMessageId: number,
      params: RequestParams = {},
    ) =>
      this.request<RetryAudioAnalysisResponseDto, ApiErrorResponseDto>({
        path: `/analysis/audio/question/${questionMessageId}/retry`,
        method: "POST",
        secure: true,
        format: "json",
        ...params,
      }),
  };
  reports = {
    /**
     * No description
     *
     * @tags 5. 리포트
     * @name ReportsControllerGetReportCalendar
     * @summary 보호자 일간·주간 리포트 통합 달력 조회
     * @request GET:/reports/calendar
     * @secure
     */
    reportsControllerGetReportCalendar: (
      query: {
        /**
         * 조회할 연도
         * @min 2020
         * @max 2100
         * @example 2026
         */
        year: number;
        /**
         * 조회할 월
         * @min 1
         * @max 12
         * @example 8
         */
        month: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<ReportCalendarResponseDto, ApiErrorResponseDto>({
        path: `/reports/calendar`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags 5. 리포트
     * @name ReportsControllerGetDailyReport
     * @summary 보호자 일간 정서 리포트 조회
     * @request GET:/reports/daily
     * @secure
     */
    reportsControllerGetDailyReport: (
      query: {
        /**
         * 조회할 서울 기준 리포트 날짜(YYYY-MM-DD)
         * @example "2026-08-14"
         */
        date: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<DailyReportResponseDto, ApiErrorResponseDto>({
        path: `/reports/daily`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags 5. 리포트
     * @name ReportsControllerGetWeeklyReport
     * @summary 보호자 주간 정서 리포트 조회
     * @request GET:/reports/weekly
     * @secure
     */
    reportsControllerGetWeeklyReport: (
      query: {
        /**
         * 서울 기준 조회 주의 월요일(YYYY-MM-DD)
         * @example "2026-08-03"
         */
        weekStart: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<WeeklyReportResponseDto, ApiErrorResponseDto>({
        path: `/reports/weekly`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),
  };
  notifications = {
    /**
     * No description
     *
     * @tags 6. 보호자 알림
     * @name NotificationsControllerGetVapidPublicKey
     * @summary 브라우저 웹 푸시 구독용 VAPID 공개키 조회
     * @request GET:/notifications/push/vapid-public-key
     * @secure
     */
    notificationsControllerGetVapidPublicKey: (params: RequestParams = {}) =>
      this.request<VapidPublicKeyResponseDto, ApiErrorResponseDto>({
        path: `/notifications/push/vapid-public-key`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags 6. 보호자 알림
     * @name NotificationsControllerUpsertPushSubscription
     * @summary 웹 푸시 구독 등록·갱신 (보호자/시니어 공용)
     * @request PUT:/notifications/push-subscriptions
     * @secure
     */
    notificationsControllerUpsertPushSubscription: (
      data: UpsertPushSubscriptionDto,
      params: RequestParams = {},
    ) =>
      this.request<PushSubscriptionResponseDto, ApiErrorResponseDto>({
        path: `/notifications/push-subscriptions`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags 6. 보호자 알림
     * @name NotificationsControllerDeletePushSubscription
     * @summary 현재 브라우저 웹 푸시 구독 해제 (보호자/시니어 공용)
     * @request DELETE:/notifications/push-subscriptions
     * @secure
     */
    notificationsControllerDeletePushSubscription: (
      data: DeletePushSubscriptionDto,
      params: RequestParams = {},
    ) =>
      this.request<void, ApiErrorResponseDto>({
        path: `/notifications/push-subscriptions`,
        method: "DELETE",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags 6. 보호자 알림
     * @name NotificationsControllerGetNotifications
     * @summary 보호자 알림 목록 조회
     * @request GET:/notifications
     * @secure
     */
    notificationsControllerGetNotifications: (params: RequestParams = {}) =>
      this.request<NotificationListResponseDto, ApiErrorResponseDto>({
        path: `/notifications`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags 6. 보호자 알림
     * @name NotificationsControllerMarkAsRead
     * @summary 보호자 알림 한 건 읽음 처리
     * @request PATCH:/notifications/{alertId}/read
     * @secure
     */
    notificationsControllerMarkAsRead: (
      alertId: number,
      params: RequestParams = {},
    ) =>
      this.request<void, ApiErrorResponseDto>({
        path: `/notifications/${alertId}/read`,
        method: "PATCH",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags 6. 보호자 알림
     * @name NotificationsControllerMarkAsUnread
     * @summary 보호자 알림 한 건 읽지 않음으로 되돌리기
     * @request PATCH:/notifications/{alertId}/unread
     * @secure
     */
    notificationsControllerMarkAsUnread: (
      alertId: number,
      params: RequestParams = {},
    ) =>
      this.request<void, ApiErrorResponseDto>({
        path: `/notifications/${alertId}/unread`,
        method: "PATCH",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags 6. 보호자 알림
     * @name NotificationsControllerMarkAllAsRead
     * @summary 보호자 알림 모두 읽음 처리
     * @request PATCH:/notifications/read-all
     * @secure
     */
    notificationsControllerMarkAllAsRead: (params: RequestParams = {}) =>
      this.request<void, ApiErrorResponseDto>({
        path: `/notifications/read-all`,
        method: "PATCH",
        secure: true,
        ...params,
      }),
  };
  connections = {
    /**
     * No description
     *
     * @tags 7. 보호자-시니어 연결
     * @name ConnectionsControllerGetMyConnection
     * @summary 초기 연결 상태 조회
     * @request GET:/connections/me
     * @secure
     */
    connectionsControllerGetMyConnection: (params: RequestParams = {}) =>
      this.request<ConnectionResponseDto, ApiErrorResponseDto>({
        path: `/connections/me`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags 7. 보호자-시니어 연결
     * @name ConnectionsControllerDisconnect
     * @summary 현재 보호자-시니어 연결 해제
     * @request DELETE:/connections/me
     * @secure
     */
    connectionsControllerDisconnect: (params: RequestParams = {}) =>
      this.request<void, ApiErrorResponseDto>({
        path: `/connections/me`,
        method: "DELETE",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags 7. 보호자-시니어 연결
     * @name ConnectionsControllerCreateRequest
     * @summary 보호자가 시니어에게 연결 요청
     * @request POST:/connections/requests
     * @secure
     */
    connectionsControllerCreateRequest: (
      data: CreateConnectionRequestDto,
      params: RequestParams = {},
    ) =>
      this.request<ConnectionResponseDto, ApiErrorResponseDto>({
        path: `/connections/requests`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags 7. 보호자-시니어 연결
     * @name ConnectionsControllerAcceptRequest
     * @summary 시니어가 연결 요청 수락
     * @request POST:/connections/requests/{relationshipId}/accept
     * @secure
     */
    connectionsControllerAcceptRequest: (
      relationshipId: number,
      params: RequestParams = {},
    ) =>
      this.request<ConnectionResponseDto, ApiErrorResponseDto>({
        path: `/connections/requests/${relationshipId}/accept`,
        method: "POST",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags 7. 보호자-시니어 연결
     * @name ConnectionsControllerRejectRequest
     * @summary 시니어가 연결 요청 거절
     * @request POST:/connections/requests/{relationshipId}/reject
     * @secure
     */
    connectionsControllerRejectRequest: (
      relationshipId: number,
      params: RequestParams = {},
    ) =>
      this.request<void, ApiErrorResponseDto>({
        path: `/connections/requests/${relationshipId}/reject`,
        method: "POST",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags 7. 보호자-시니어 연결
     * @name ConnectionsControllerCancelRequest
     * @summary 보호자가 보낸 연결 요청 취소
     * @request DELETE:/connections/requests/{relationshipId}
     * @secure
     */
    connectionsControllerCancelRequest: (
      relationshipId: number,
      params: RequestParams = {},
    ) =>
      this.request<void, ApiErrorResponseDto>({
        path: `/connections/requests/${relationshipId}`,
        method: "DELETE",
        secure: true,
        ...params,
      }),
  };
  guardian = {
    /**
     * No description
     *
     * @tags 8. 보호자 대시보드
     * @name GuardianDashboardControllerGetDashboard
     * @summary 보호자 홈 대시보드 통합 조회
     * @request GET:/guardian/dashboard
     * @secure
     */
    guardianDashboardControllerGetDashboard: (params: RequestParams = {}) =>
      this.request<GuardianDashboardResponseDto, ApiErrorResponseDto>({
        path: `/guardian/dashboard`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),
  };
}
