/*
역할: Gateway가 전달한 대화 요청의 업무 처리 순서를 관리한다.
전체 흐름: ChatsGateway → ChatsService → Repository 또는 AnalysisService
 */
import { Injectable } from '@nestjs/common';
import { AnalysisService } from '../analysis/analysis.service';

@Injectable()
export class ChatsService {
  private readonly analysisService: AnalysisService;

  // NestJS DI 컨테이너가 AnalysisService 객체를 생성자에 주입한다.
  constructor(analysisService: AnalysisService) {
    this.analysisService = analysisService;
  }

  // 대화 이벤트 메서드 구현 시 Repository 저장과
  // this.analysisService의 AI 분석 메서드 호출이 이 위치에 추가된다.
}
