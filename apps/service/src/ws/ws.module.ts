import { Module } from '@nestjs/common'
import { WsGateway } from './ws.gateway'
import { WsMessageRouterService } from './ws-message-router.service'
import { WsAuthService } from './ws-auth.service'
import { WsSenderService } from './ws-sender.service'
import { ExtensionMessageService } from './extension-message.service'
import { ParticipantModule } from '../participants/participant.module'
import { RoomModule } from '../room/room.module'
import { IssueLedgerModule } from '../issues/issue-ledger.module'
import { ConsensusModule } from '../consensus/consensus.module'

@Module({
  imports: [
    ParticipantModule,
    RoomModule,
    IssueLedgerModule,
    ConsensusModule
  ],
  providers: [
    WsGateway,
    WsMessageRouterService,
    WsAuthService,
    WsSenderService,
    ExtensionMessageService
  ],
  exports: [ExtensionMessageService, WsSenderService]
})
export class WsModule {}
