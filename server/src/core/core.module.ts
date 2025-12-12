import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';

@Global()
@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: [
				'.env.local',
				'.env',
				'../.env.local',
				'../.env',
				'../../.env.local',
				'../../.env'
			],
			cache: true,
		}),
		AiModule.forRootAsyncFromEnv(),
	],
	exports: [AiModule],
})
export class CoreModule {}


