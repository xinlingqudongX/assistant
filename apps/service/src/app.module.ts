import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { WsModule } from './ws/ws.module'
import { ConsensusModule } from './consensus/consensus.module'
import { DecisionModule } from './decision/decision.module'
import { IssueLedgerModule } from './issues/issue-ledger.module'
import { ParticipantModule } from './participants/participant.module'
import { RoomModule } from './room/room.module'
import { StorageModule } from './storage/storage.module'
import { McpModule } from './mcp/mcp.module'
import { DecisionApiModule } from './decision-api/decision-api.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    WsModule,
    ConsensusModule,
    DecisionModule,
    IssueLedgerModule,
    ParticipantModule,
    RoomModule,
    StorageModule,
    McpModule,
    DecisionApiModule
  ]
})
export class AppModule {}
