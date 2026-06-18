import { Module } from '@nestjs/common'
import { RoomService, RoomState } from './room.service'
import { IssueLedgerModule } from '../issues/issue-ledger.module'
import { DecisionModule } from '../decision/decision.module'
import { ConsensusModule } from '../consensus/consensus.module'

@Module({
  imports: [IssueLedgerModule, DecisionModule, ConsensusModule],
  providers: [RoomService, RoomState],
  exports: [RoomService, RoomState]
})
export class RoomModule {}
