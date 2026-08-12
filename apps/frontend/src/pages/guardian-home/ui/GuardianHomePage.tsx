import { daysSinceConnected } from '../../../entities/connection'
import { EmotionScoreCard, RecommendedActionCard } from '../../../entities/report'
import { Card } from '../../../shared/ui'
import daseulGuideImage from '../../../shared/assets/character/character-daseul-guide.png'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import { EmotionTrendChart } from '../../../widgets/emotion-trend-chart'
import styles from './GuardianHomePage.module.css'

// GUARDIAN_HOME_01 (UC-08) — 결정사항 로그 §7에서 "오늘의 정서 지수"/"다슬이의
// 한마디" 카드를 추가했다. 실제 API 연결 전이라 시니어/보호자 이름, 연결일,
// 오늘의 리포트는 페이지 로컬 mock 데이터로 둔다.
const mockGuardianName = '홍길동'
const mockSeniorName = '김순자'
const mockConnectedAt = '2025-03-01T00:00:00.000Z'
const mockTodayReport = {
  emotionScore: 93,
  emotionLevel: '좋음' as const,
  comment: '오늘은 어르신의 목소리가 밝고 활기가 느껴졌어요.',
  recommendedAction:
    '오늘은 산책 얘기를 많이 하셨어요. 통화하실 때 요즘 날씨나 동네 산책길 이야기를 여쭤보시면 좋아하실 것 같아요.',
}

export function GuardianHomePage() {
  const daysTogether = daysSinceConnected(mockConnectedAt)

  return (
    <>
      <main className={styles.page}>
        <header className={styles.greeting}>
          <h1>{mockGuardianName}님 안녕하세요.</h1>
          <p>
            {mockSeniorName} 어르신과 함께한 지 {daysTogether}일 되었어요!
          </p>
        </header>

        <section className={styles.recommendation} aria-label="다솔이의 한마디">
          <img className={styles.guideCharacter} src={daseulGuideImage} alt="" />
          <Card className={styles.recommendationCard}>
            <RecommendedActionCard action={mockTodayReport.recommendedAction} variant="dashboard" />
          </Card>
        </section>

        <Card className={styles.scoreCard}>
          <EmotionScoreCard
            detailsHref="/guardian/report"
            title="오늘의 정서 지수"
            score={mockTodayReport.emotionScore}
            level={mockTodayReport.emotionLevel}
            comment={mockTodayReport.comment}
            variant="dashboard"
          />
        </Card>

        <EmotionTrendChart detailsHref="/guardian/report/weekly/2025-06-01" />
      </main>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </>
  )
}
