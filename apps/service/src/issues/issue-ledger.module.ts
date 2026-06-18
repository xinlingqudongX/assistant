import { Module } from '@nestjs/common'
import { IssueLedgerService } from './issue-ledger.service'
import { StorageModule } from '../storage/storage.module'

@Module({
  imports: [StorageModule],
  providers: [IssueLedgerService],
  exports: [IssueLedgerService]
})
export class IssueLedgerModule {}
