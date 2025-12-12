
import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AI_PROVIDER } from './ai.constants';
import { AiService } from './ai.service';
import { OpenAIProvider } from './providers/openai.provider';
import { AiProvider } from './interfaces/ai-provider.interface';


@Global()
@Module({})
export class AiModule {
	
	static forRootAsyncFromEnv(): DynamicModule {
		const providerFactory = {
			provide: AI_PROVIDER,
			inject: [ConfigService],
			useFactory: (config: ConfigService): AiProvider => {
				const providerName =
					config.get<string>('AI_PROVIDER')?.toLowerCase() || 'openai';

				switch (providerName) {
					case 'openai':
						return new OpenAIProvider(config);
					default:
						throw new Error(
							`Unsupported AI provider: ${providerName}. Supported providers: openai`,
						);
				}
			},
		};

		return {
			module: AiModule,
			imports: [ConfigModule],
			providers: [providerFactory, AiService],
			exports: [AI_PROVIDER, AiService],
		};
	}
}