import { Inject, Injectable } from '@nestjs/common';
import { AI_PROVIDER } from './ai.constants';
import type { ChatProvider } from './interfaces/ai-provider.interface';

@Injectable()
export class AiService {
	constructor(@Inject(AI_PROVIDER) private readonly provider: ChatProvider) {}


	getProvider(): ChatProvider {
		return this.provider;
	}

	getProviderName(): string {
		return this.provider.getName();
	}
}
