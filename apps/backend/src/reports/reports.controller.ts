/*
역할: 일간·주간 리포트 REST API 요청을 받는 입구다.
전체 흐름: 브라우저 → ReportsController → ReportsService → Repository → MySQL
*/
import { Controller } from '@nestjs/common';
import { ReportsService } from './reports.service';

// /reports 경로의 HTTP 요청을 이 Controller로 전달한다.
@Controller('reports')
export class ReportsController {
  private readonly reportsService: ReportsService;

  // NestJS DI 컨테이너가 ReportsService 객체를 생성자에 주입한다.
  constructor(reportsService: ReportsService) {
    this.reportsService = reportsService;
  }

  // 리포트 조회 REST API 메서드는 이후 이 클래스에 추가한다.
}
