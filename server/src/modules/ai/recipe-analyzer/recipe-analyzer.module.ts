import { Module } from '@nestjs/common';
import { CoreModule } from '../../../core/core.module';
import { RecipeAnalyzerService } from './recipe-analyzer.service';

@Module({
	imports: [CoreModule],
	providers: [RecipeAnalyzerService],
	exports: [RecipeAnalyzerService],
})
export class RecipeAnalyzerModule {}

