import { Module } from '@nestjs/common';
import { RecipeFlowService } from './recipe-flow.service';
import { RecipeFlowController } from './recipe-flow.controller';
import { CoreModule } from 'src/core/core.module';
import { ChatModule } from '../chat/chat.module';

@Module({
	imports: [CoreModule, ChatModule],
	controllers: [RecipeFlowController],
	providers: [RecipeFlowService],
	exports: [RecipeFlowService],
})
export class RecipeFlowModule {}




