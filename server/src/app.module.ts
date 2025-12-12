import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ChatModule } from "./modules/ai/chat/chat.module";
import { RecipeFlowModule } from "./modules/ai/recipe-flow/recipe-flow.module";
import { CoreModule } from "./core/core.module";

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
	CoreModule,
	ChatModule,
	RecipeFlowModule,
	
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}