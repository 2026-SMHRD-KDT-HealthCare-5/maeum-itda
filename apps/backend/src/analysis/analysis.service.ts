import { Injectable } from '@nestjs/common';
import { AiClient } from './ai.client';

@Injectable()
export class AnalysisService {
  constructor(private readonly aiClient: AiClient) {}
}
