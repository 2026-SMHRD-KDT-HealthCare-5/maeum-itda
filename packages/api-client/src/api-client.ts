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
     * @summary 무한 스크롤
     * @request GET:/chats/messages
     * @secure
     */
    chatsControllerGetMessages: (
      query?: {
        /**
         * 이 ID보다 오래된 메시지를 조회한다.
         * @example 101
         */
        cursor?: number;
        /**
         * 조회 개수(기본 30, 최소 1, 최대 100)
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
  };
  analysis = {
    /**
     * No description
     *
     * @tags 4. 음성 분석
     * @name AnalysisControllerGetStatus
     * @summary 메시지의 음성 분석 상태 조회
     * @request GET:/analysis/audio/{messageId}/status
     */
    analysisControllerGetStatus: (
      messageId: number,
      params: RequestParams = {},
    ) =>
      this.request<VoiceAnalysisStatusResponseDto, ApiErrorResponseDto>({
        path: `/analysis/audio/${messageId}/status`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags 4. 음성 분석
     * @name AnalysisControllerRetry
     * @summary 메모리에 대기 중인 질문별 음성 분석 재시도
     * @request POST:/analysis/audio/question/{questionMessageId}/retry
     */
    analysisControllerRetry: (
      questionMessageId: number,
      params: RequestParams = {},
    ) =>
      this.request<RetryAudioAnalysisResponseDto, ApiErrorResponseDto>({
        path: `/analysis/audio/question/${questionMessageId}/retry`,
        method: "POST",
        format: "json",
        ...params,
      }),
  };
  connections = {
    /**
     * No description
     *
     * @tags 5. 보호자-시니어 연결
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
     * @tags 5. 보호자-시니어 연결
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
     * @tags 5. 보호자-시니어 연결
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
     * @tags 5. 보호자-시니어 연결
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
     * @tags 5. 보호자-시니어 연결
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
     * @tags 5. 보호자-시니어 연결
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
}
