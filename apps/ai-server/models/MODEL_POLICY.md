# 감정분류 모델 정책

## 1. 라벨 순서

텍스트 모델, 음성 모델, 통합 모델과 모든 내부 처리에서 다음 순서를 동일하게 사용한다.

```text
happy, angry, sad, anxious, neutral
```

라벨 순서가 다른 체크포인트를 연결할 때는 이 순서로 명시적으로 변환한 뒤 사용한다.

## 2. 모델 내부 상세 결과

감정분류 모듈은 다음 형태의 상세 결과를 생성한다.

```json
{
  "dominant_emotion": "anxious",
  "emotion": {
    "happy": 0.169497,
    "angry": 0.160008,
    "sad": 0.187288,
    "anxious": 0.285765,
    "neutral": 0.197441
  },
  "text_emotion": {
    "happy": 0.1,
    "angry": 0.08,
    "sad": 0.12,
    "anxious": 0.55,
    "neutral": 0.15
  },
  "voice_emotion": {
    "happy": 0.01,
    "angry": 0.02,
    "sad": 0.92,
    "anxious": 0.03,
    "neutral": 0.02
  },
  "method": "classwise_temperature_scaled_weighted_sum",
  "parameters_status": "candidate_before_final_test"
}
```

- `emotion`은 텍스트·음성 결과를 통합한 최종 확률이다.
- `dominant_emotion`은 최종 확률이 가장 높은 라벨이다.
- `text_emotion`과 `voice_emotion`은 각 모델의 개별 결과다.
- 한쪽 모델이 실패하거나 실행되지 않았다면 해당 필드는 빈 객체가 아니라 `null`을 사용한다.
- 확률 합은 부동소수점 오차를 허용하여 `1.0`에 근접한 값으로 검증한다. 예를 들어 `0.9999999`는 정상으로 인정한다.
- 상세 결과는 기본적으로 파일이나 로그에 저장하지 않는다. 오류 분석이 필요할 때 직접 확인한다.

## 3. 다른 AI 서버 모듈에 전달하는 결과

LLM 등 다른 내부 모듈에는 모델 구현 세부사항을 제외하고 다음 요약만 전달한다.

```json
{
  "dominant_emotion": "anxious",
  "emotion": {
    "happy": 0.169497,
    "angry": 0.160008,
    "sad": 0.187288,
    "anxious": 0.285765,
    "neutral": 0.197441
  }
}
```

## 4. 백엔드 전달 정책

- 백엔드에는 감정 확률 수치를 전달하지 않는다.
- 백엔드와 주고받는 JSON 필드명은 camelCase를 사용한다.
- 백엔드가 받을 감정 필드는 `dominantEmotion`으로 한다.
- 기존 `sentimentLabel` 등 최종 백엔드 계약 변경은 백엔드 담당자가 반영한다.

예시:

```json
{
  "dominantEmotion": "sad"
}
```

## 5. 임시 테스트 모드

실제 모델을 연결하기 전까지 `EMOTION_MODE=test`를 사용한다.

테스트 모드에서는 오류 없이 전체 파이프라인을 검증할 수 있도록 다음 고정값을 반환한다.

```json
{
  "dominant_emotion": "sad",
  "emotion": {
    "happy": 0.0,
    "angry": 0.0,
    "sad": 1.0,
    "anxious": 0.0,
    "neutral": 0.0
  },
  "text_emotion": null,
  "voice_emotion": null,
  "method": "fixed_test_value",
  "parameters_status": "test"
}
```

테스트 모드는 실제 모델 추론 성공을 의미하지 않는다. 실제 모델 연결 후에는 모델 모드로 전환하여 별도로 검증한다.

## 6. 모델 실패와 동률 처리

- 텍스트·음성 모델 중 하나만 성공하면 성공한 모델 결과로 계속 진행한다.
- 실패한 모델의 개별 결과는 `null`로 표시한다.
- 실제 모델 모드에서 두 모델이 모두 실패하면 테스트 고정값으로 자동 전환하지 않고 오류 정책에 따라 처리한다.
- 최종 통합 확률의 최댓값이 동률이면 텍스트 모델 결과를 우선하여 결정한다.
- 텍스트 결과로도 동률을 해소하지 못하면 공통 라벨 순서에서 먼저 나오는 라벨을 선택한다.

## 7. 테스트 정책

본 감정분류 코드를 변경하면 관련 테스트도 반드시 함께 변경한다.

테스트에서는 최소한 다음을 검증한다.

- 다섯 라벨의 이름과 순서
- 최종 확률 합이 허용 오차 내에서 `1.0`인지 여부
- `dominant_emotion`과 최댓값 라벨의 일치
- 테스트 모드에서 `sad=1.0` 고정값 반환
- 한쪽 모델 실패 시 해당 상세 결과가 `null`인지 여부
- 최종 확률 동률 시 텍스트 결과 우선
- 내부 snake_case와 백엔드 camelCase 계약의 구분

