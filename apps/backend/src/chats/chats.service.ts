import { Injectable } from '@nestjs/common';
import { AnalysisService } from '../analysis/analysis.service';

@Injectable()
export class ChatsService {
  constructor(private readonly analysisService: AnalysisService) {}
}
