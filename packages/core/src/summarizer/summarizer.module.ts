import { Module } from '@nestjs/common';
import { DailySummarizerService } from './daily-summarizer.service.js';

@Module({
  providers: [DailySummarizerService],
  exports: [DailySummarizerService],
})
export class SummarizerModule {}
