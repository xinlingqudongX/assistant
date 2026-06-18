import { Module } from '@nestjs/common'
import { McpController } from './mcp.controller'
import { McpToolsService } from './mcp-tools.service'
import { RoomModule } from '../room/room.module'
import { ParticipantModule } from '../participants/participant.module'
import { IssueLedgerModule } from '../issues/issue-ledger.module'
import { DecisionModule } from '../decision/decision.module'
import { ConsensusModule } from '../consensus/consensus.module'

@Module({
  imports: [
    RoomModule,
    ParticipantModule,
    IssueLedgerModule,
    DecisionModule,
    ConsensusModule
  ],
  controllers: [McpController],
  providers: [McpToolsService],
  exports: [McpToolsService]
})
export class McpModule {}
