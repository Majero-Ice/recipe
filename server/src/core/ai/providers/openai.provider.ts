import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { Stream } from 'openai/streaming';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import { AiProvider } from '../interfaces/ai-provider.interface';


@Injectable()
export class OpenAIProvider implements AiProvider {
	private client: OpenAI;

	constructor(@Inject(ConfigService) private config: ConfigService) {
		const apiKey = config.get<string>('OPENAI_API_KEY');
		if (!apiKey) {
			throw new Error(
				'OpenAI configuration missing: set OPENAI_API_KEY in environment variables.',
			);
		}

		this.client = new OpenAI({
			apiKey: apiKey,
			timeout: 60000, // 60 seconds timeout
			maxRetries: 2, // Retry failed requests up to 2 times
		});
	}

	getName(): string {
		return 'openai';
	}

	async isAvailable(): Promise<boolean> {
		try {
			await this.client.models.list();
			return true;
		} catch (error) {
			return false;
		}
	}

	async createEmbeddings(
		texts: string[],
		model: string = 'text-embedding-3-small',
	): Promise<number[][]> {
		if (texts.length === 0) {
			return [];
		}

		try {
			const response = await this.client.embeddings.create({
				model: model,
				input: texts,
			});

			return response.data.map((item) => item.embedding);
		} catch (error) {
			throw new Error(
				`Failed to create embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		}
	}

	getClient(): OpenAI {
		return this.client;
	}

	
	async chat(
		messages: Array<{ role: string; content: string }>,
		model: string = 'gpt-5.2-2025-12-11',
	): Promise<string> {
		if (messages.length === 0) {
			throw new Error('Messages array cannot be empty');
		}

		try {
			const response = await this.client.chat.completions.create({
				model: model,
				messages: messages.map((msg) => ({
					role: msg.role as 'system' | 'user' | 'assistant',
					content: msg.content,
				})),
				temperature: 0.7,
				max_completion_tokens: 2000, // Increased from 1000 to reduce truncation
			});

			const content = response.choices[0]?.message?.content;
			if (!content) {
				throw new Error('Empty response from OpenAI');
			}

			return content;
		} catch (error) {
			throw new Error(
				`Failed to generate chat response: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		}
	}

	/**
	 * Streams chat responses chunk by chunk
	 */
	async *chatStream(
		messages: Array<{ role: string; content: string }>,
		model: string = 'gpt-5.2-2025-12-11',
		useJsonMode: boolean = false,
	): AsyncGenerator<string, void, unknown> {
		if (messages.length === 0) {
			throw new Error('Messages array cannot be empty');
		}

		try {
			const streamOptions = {
				model: model,
				messages: messages.map((msg) => ({
					role: msg.role as 'system' | 'user' | 'assistant',
					content: msg.content,
				})),
				temperature: 0.7,
				max_completion_tokens: 2000,
				stream: true as const,
				...(useJsonMode && { response_format: { type: 'json_object' as const } }),
			};

			const stream = (await this.client.chat.completions.create(
				streamOptions,
			)) as Stream<ChatCompletionChunk>;

			for await (const chunk of stream) {
				const content = chunk.choices[0]?.delta?.content;
				if (content) {
					yield content;
				}
			}
		} catch (error) {
			throw new Error(
				`Failed to stream chat response: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		}
	}
}
