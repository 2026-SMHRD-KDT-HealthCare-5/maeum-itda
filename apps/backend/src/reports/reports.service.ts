/*
역할: 리포트 생성·집계·조회 업무를 처리할 Service다.
전체 흐름: ReportsController → ReportsService → Repository → MySQL
*/
import { Injectable } from '@nestjs/common';

@Injectable()
export class ReportsService {
  // 일간 리포트 조회·생성 메서드와 Repository 호출은 이후 이 클래스에 추가한다.
}
