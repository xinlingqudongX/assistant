import { Module } from '@nestjs/common'
import { ConsensusService } from './consensus.service'
import { ProposalService } from './proposal.service'
import { PromptBuilderService } from './prompt-builder.service'
import { ParticipantModule } from '../participants/participant.module'

@Module({
  imports: [ParticipantModule],
  providers: [ConsensusService, ProposalService, PromptBuilderService],
  exports: [ConsensusService, ProposalService, PromptBuilderService]
})
export class ConsensusModule {}
