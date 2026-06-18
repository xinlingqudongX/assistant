import { Module } from '@nestjs/common'
import { SQLiteService } from './sqlite.service'

@Module({
  providers: [SQLiteService],
  exports: [SQLiteService]
})
export class StorageModule {}
