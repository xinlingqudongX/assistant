import { Module } from '@nestjs/common'
import { DecisionApiController } from './decision-api.controller'
import { DecisionRequestService } from './decision-request.service'
import { RoomModule } from '../room/room.module'
import { ParticipantModule } from '../participants/participant.module'
import { IssueLedgerModule } from '../issues/issue-ledger.module'
import { WsModule } from '../ws/ws.module'
import { DecisionModule } from '../decision/decision.module'

@Module({
  imports: [
    RoomModule,
    ParticipantModule,
    IssueLedgerModule,
    WsModule,
    DecisionModule
  ],
  controllers: [DecisionApiController],
  providers: [DecisionRequestService],
  exports: [DecisionRequestService]
})
export class DecisionApiModule {}
