import { Module } from '@nestjs/common'
import { DecisionRecordService } from './decision-record.service'
import { StorageModule } from '../storage/storage.module'

@Module({
  imports: [StorageModule],
  providers: [DecisionRecordService],
  exports: [DecisionRecordService]
})
export class DecisionModule {}
