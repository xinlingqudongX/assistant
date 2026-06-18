import { Module, forwardRef } from '@nestjs/common'
import { ParticipantService } from './participant.service'
import { StorageModule } from '../storage/storage.module'
import { WsModule } from '../ws/ws.module'

@Module({
  imports: [StorageModule, forwardRef(() => WsModule)],
  providers: [ParticipantService],
  exports: [ParticipantService]
})
export class ParticipantModule {}
