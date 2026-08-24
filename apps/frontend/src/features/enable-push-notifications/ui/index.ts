// 이 feature는 더 이상 자체 UI가 없다 — 웹 푸시 구독을 켜고 끄는 동작이
// "정서 지수 하락 알림"/"안부 알림" 토글(set-notification-threshold,
// set-checkin-reminder)에 내부적으로 흡수됐다. usePushSubscription 훅
// (model/)만 계속 재사용된다.
export {}
