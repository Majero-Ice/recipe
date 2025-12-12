import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { CoreModule } from 'src/core/core.module';
import { RecipeAnalyzerModule } from '../recipe-analyzer/recipe-analyzer.module';

@Module({
	imports: [CoreModule, RecipeAnalyzerModule],
	controllers: [ChatController],
	providers: [ChatService],
	exports: [ChatService],
})
export class ChatModule {}


