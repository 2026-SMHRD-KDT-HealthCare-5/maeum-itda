import { Module } from '@nestjs/common';
import { AiClient } from './ai.client';
import { AnalysisService } from './analysis.service';

@Module({
  providers: [AnalysisService, AiClient],
  exports: [AnalysisService],
})
export class AnalysisModule {}
