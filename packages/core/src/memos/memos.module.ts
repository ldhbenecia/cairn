import { Module } from '@nestjs/common';
import { MemoSourceService } from './memo-source.service.js';

@Module({
  providers: [MemoSourceService],
  exports: [MemoSourceService],
})
export class MemosModule {}
