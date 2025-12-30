import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { AI_PROVIDER } from '../../../core/ai/ai.constants';
import type { ChatProvider } from '../../../core/ai/interfaces/ai-provider.interface';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { ChatRole } from './interfaces/chat-message.interface';
import { RecipeAnalyzerService } from '../recipe-analyzer/recipe-analyzer.service';
import type {
	StructuredRecipeDto,
	RecipeBlockDto,
} from '../recipe-analyzer/dto/recipe-block.dto';
import { RecipeBlockType } from '../recipe-analyzer/dto/recipe-block.dto';

/**
 * Сервис для чата с ИИ
 */
@Injectable()
export class ChatService {
	constructor(
		@Inject(AI_PROVIDER) private readonly aiProvider: ChatProvider,
		private readonly recipeAnalyzer: RecipeAnalyzerService,
	) {}

	/**
	 * Генерирует ответ на основе сообщения пользователя
	 * @param request Запрос чата с сообщением и историей
	 * @returns Ответ ассистента
	 */
	async chat(request: ChatRequestDto): Promise<ChatResponseDto> {
		if (!request.message || request.message.trim().length === 0) {
			throw new BadRequestException('Message cannot be empty');
		}

		const model = 'gpt-4o-mini';

		// Формируем историю сообщений
		const messages = this.buildMessages(request.message, request.history);

		// Генерируем ответ через AI провайдер
		const response = await this.aiProvider.chat(messages, model);

		// Note: Recipe analysis is now handled by AI's isRecipe flag in JSON responses
		// For non-streaming endpoint, we still use recipe analyzer as fallback
		const shouldAnalyze = response.length > 50; // Only analyze if message is long enough
		
		let recipeAnalysis;
		if (shouldAnalyze) {
			// Анализируем ответ на предмет рецепта с помощью ИИ
			recipeAnalysis = await this.recipeAnalyzer.analyzeMessage(response);

			// Debug: log analysis result
			console.log('Recipe analysis:', {
				isRecipe: recipeAnalysis.isRecipe,
				blocksCount: recipeAnalysis.blocks.length,
				blocks: recipeAnalysis.blocks,
				messagePreview: response.substring(0, 100),
			});
		} else {
			// Пропускаем анализ для коротких ответов
			recipeAnalysis = {
				isRecipe: false,
				originalMessage: response,
				blocks: [],
			};
		}

		return {
			message: response,
			model: model,
			recipe: recipeAnalysis.isRecipe ? recipeAnalysis : undefined,
		};
	}


	/**
	 * Формирует массив сообщений для API
	 */
	private buildMessages(
		userMessage: string,
		history?: Array<{ role: string; content: string }>,
		useJsonMode: boolean = false,
	): Array<{ role: string; content: string }> {
		const messages: Array<{ role: string; content: string }> = [];

		// Всегда используем JSON режим для структурированных ответов
		// AI сам решает через флаг isRecipe, является ли ответ рецептом
		if (useJsonMode) {
			messages.push({
				role: ChatRole.SYSTEM,
				content: `You are a helpful cooking assistant. 

CRITICAL LANGUAGE REQUIREMENT: You MUST respond in the EXACT same language as the user's message. If the user writes in Russian, respond in Russian. If the user writes in English, respond in English. If the user writes in Spanish, respond in Spanish. Always match the user's language exactly - this includes all text in the JSON response (titles, content, ingredient names, etc.).

You MUST always respond with a valid JSON object in this exact format:

{
  "isRecipe": true or false,
  "blocks": [
    {
      "type": "ingredients",
      "title": "Ingredients",
      "content": "- Item 1 - quantity\\n- Item 2 - quantity\\n- Item 3 - quantity"
    },
    {
      "type": "preparation",
      "title": "Preparation",
      "content": "Step 1: Description\\nStep 2: Description"
    },
    {
      "type": "cooking",
      "title": "Cooking",
      "content": "Step 1: Description\\nStep 2: Description"
    },
    {
      "type": "serving",
      "title": "Serving",
      "content": "Final instructions for serving"
    }
  ]
}

IMPORTANT DECISION RULES:
- Set "isRecipe": true when the user asks HOW to make/cook/prepare/create a dish, food item, meal, or recipe
- Set "isRecipe": true for questions like: "How do I make X?", "How to make X?", "How do I cook X?", "How to cook X?", "Recipe for X", "How to prepare X?", "How to create X?", "How can I make X?"
- Set "isRecipe": true when providing step-by-step instructions for making food, even if the question is phrased casually
- Set "isRecipe": true for ANY request that asks for instructions on how to create or prepare food
- Set "isRecipe": false ONLY for general cooking questions, tips, techniques, or non-recipe content (e.g., "What is baking?", "How does yeast work?", "What is the difference between X and Y?")
- If "isRecipe": true, include all 4 block types: ingredients, preparation, cooking, serving
- If "isRecipe": false, return empty blocks array: "blocks": []

CRITICAL: When in doubt, set "isRecipe": true. It's better to provide a recipe structure than to miss a recipe request.

EXAMPLES:
- "How do I make sandwiches?" → isRecipe: true (providing recipe - user wants instructions)
- "How to make sandwiches?" → isRecipe: true (providing recipe - user wants instructions)
- "How to cook pasta?" → isRecipe: true (providing recipe)
- "Recipe for chocolate cake" → isRecipe: true (providing recipe)
- "How can I prepare a salad?" → isRecipe: true (providing recipe)
- "What is baking?" → isRecipe: false (general knowledge question)
- "How does yeast work?" → isRecipe: false (scientific explanation)
- "What's the difference between baking and frying?" → isRecipe: false (comparison question)

Block types (only used when isRecipe: true):
- "ingredients": List all ingredients with quantities (use bullet points with "-")
- "preparation": Preparation steps (cutting, chopping, mixing, marinating, etc.)
- "cooking": Main cooking steps (boiling, frying, baking, simmering, etc.)
- "serving": Serving instructions, presentation, garnishing

CRITICAL RULES:
1. Return ONLY the JSON object, no additional text before or after
2. Ensure the JSON is valid and complete
3. All strings must be properly escaped (use \\n for line breaks)
4. When isRecipe: true, include all 4 block types in order: ingredients, preparation, cooking, serving
5. When isRecipe: false, set blocks to empty array: []`,
			});
		} else {
			messages.push({
				role: ChatRole.SYSTEM,
				content: `You are a helpful cooking assistant. Provide helpful responses about cooking, recipes, and food. For non-recipe questions, respond with natural, conversational text.

CRITICAL LANGUAGE REQUIREMENT: You MUST respond in the EXACT same language as the user's message. If the user writes in Russian, respond in Russian. If the user writes in English, respond in English. If the user writes in Spanish, respond in Spanish. Always match the user's language exactly.`,
			});
		}

		// Добавляем историю, если есть (исключаем системные сообщения из истории)
		if (history && history.length > 0) {
			const filteredHistory = history.filter((msg) => msg.role !== ChatRole.SYSTEM);
			messages.push(...filteredHistory);
		}

		// Добавляем текущий запрос пользователя
		messages.push({
			role: ChatRole.USER,
			content: userMessage,
		});

		return messages;
	}

	/**
	 * Streams chat response chunk by chunk and parses structured recipe blocks in real-time
	 * @param request Запрос чата с сообщением и историей
	 * @returns Async generator that yields objects with chunk, block, or recipe data
	 */
	async *chatStream(
		request: ChatRequestDto,
	): AsyncGenerator<
		| { type: 'chunk'; data: string }
		| { type: 'block'; data: RecipeBlockDto }
		| { type: 'recipe'; data: StructuredRecipeDto },
		void,
		unknown
	> {
		if (!request.message || request.message.trim().length === 0) {
			throw new BadRequestException('Message cannot be empty');
		}

		const model = 'gpt-4o-mini';

		// Определяем, использовать ли JSON режим (всегда используем для структурированных ответов)
		const useJsonMode = this.shouldUseJsonMode(request.message);

		// Формируем историю сообщений
		const messages = this.buildMessages(request.message, request.history, useJsonMode);

		// Стримим ответ через AI провайдер и накапливаем полное сообщение
		let fullMessage = '';
		let jsonBuffer = '';
		const sentBlockIndices = new Set<number>();

		let isJsonResponse = false;
		let hasFoundBlocks = false;

		for await (const chunk of this.aiProvider.chatStream(
			messages,
			model,
			useJsonMode,
		)) {
			fullMessage += chunk;
			jsonBuffer += chunk;

			// Проверяем, начинается ли ответ с JSON
			if (!isJsonResponse && jsonBuffer.trim().startsWith('{')) {
				isJsonResponse = true;
			}

			if (useJsonMode && isJsonResponse) {
				// Для JSON ответов парсим блоки инкрементально (если isRecipe: true)
				const blocks = this.tryParseJsonBlocks(jsonBuffer);
				if (blocks && blocks.length > 0) {
					hasFoundBlocks = true;
					// Отправляем новые блоки, которые еще не были отправлены
					for (let i = 0; i < blocks.length; i++) {
						if (!sentBlockIndices.has(i)) {
							yield { type: 'block', data: blocks[i] };
							sentBlockIndices.add(i);
						}
					}
				}
				// Если это JSON, но блоки еще не найдены, не отправляем сырые чанки
				// (ждем полного парсинга в конце)
			} else {
				// Обычный текстовый ответ - отправляем чанки
				yield { type: 'chunk', data: chunk };
			}
		}

		// После завершения стриминга пытаемся распарсить полный JSON
		if (useJsonMode && isJsonResponse) {
			try {
				const recipeData = JSON.parse(jsonBuffer.trim());
				if (recipeData.isRecipe === true && recipeData.blocks && Array.isArray(recipeData.blocks) && recipeData.blocks.length > 0) {
					const structuredRecipe: StructuredRecipeDto = {
						isRecipe: true,
						originalMessage: fullMessage,
						blocks: recipeData.blocks.map((block: any) => ({
							type: this.mapBlockType(block.type),
							title: block.title || '',
							content: block.content || '',
						})),
					};

					// Отправляем финальный результат рецепта
					yield { type: 'recipe', data: structuredRecipe };
					return;
				} else if (recipeData.isRecipe === false) {
					// AI определил, что это не рецепт (isRecipe: false)
					// Если блоки не были отправлены, значит это был JSON ответ, но не рецепт
					// В этом случае нужно отправить сообщение как обычный текст
					if (sentBlockIndices.size === 0) {
						// Никаких блоков не было отправлено - это был JSON ответ, но не рецепт
						// Это означает, что AI неправильно определил запрос как не-рецепт
						// Отправляем сообщение пользователю о том, что произошла ошибка
						console.warn('AI incorrectly returned isRecipe: false for what appears to be a recipe request:', recipeData);
						
						// Отправляем сообщение об ошибке вместо сырого JSON
						const errorMessage = 'I apologize, but I couldn\'t generate a recipe for that request. Please try rephrasing your question or asking for a specific recipe.';
						yield { type: 'chunk', data: errorMessage };
					}
				}
			} catch (error) {
				// Если не удалось распарсить JSON, отправляем как обычный текст
				console.warn('Failed to parse recipe JSON:', error);
				// Если это был JSON режим, но парсинг не удался, отправляем накопленное сообщение
				if (sentBlockIndices.size === 0) {
					yield { type: 'chunk', data: fullMessage };
				}
			}
		} else if (fullMessage.trim() && !isJsonResponse) {
			// Если это был не JSON ответ, убеждаемся, что полное сообщение отправлено
			// (хотя оно уже должно было быть отправлено через chunks)
		}
	}

	/**
	 * Определяет, нужно ли использовать JSON режим для структурированных ответов
	 * Теперь всегда используем JSON режим и полагаемся на флаг isRecipe от AI
	 */
	private shouldUseJsonMode(message: string): boolean {
		// Всегда используем JSON режим для возможности структурированных ответов
		// AI сам решает через isRecipe, является ли ответ рецептом
		return true;
	}

	/**
	 * Пытается распарсить JSON блоки инкрементально
	 * Использует более надежный подход для парсинга неполного JSON
	 */
	private tryParseJsonBlocks(jsonBuffer: string): RecipeBlockDto[] | null {
		try {
			// Пытаемся найти массив blocks в JSON
			// Ищем паттерн "blocks": [ ... ]
			const blocksMatch = jsonBuffer.match(/"blocks"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
			if (!blocksMatch) {
				return null;
			}

			const blocksContent = blocksMatch[1];
			// Ищем отдельные объекты блоков, учитывая что JSON может быть неполным
			// Паттерн ищет объекты вида {"type":"...","title":"...","content":"..."}
			const blockPattern =
				/\{\s*"type"\s*:\s*"([^"]+)"\s*,\s*"title"\s*:\s*"([^"]*)"\s*,\s*"content"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
			const blocks: RecipeBlockDto[] = [];
			let match;
			let lastIndex = 0;

			while ((match = blockPattern.exec(blocksContent)) !== null) {
				// Проверяем, что это не частичный матч
				if (match.index >= lastIndex) {
					try {
						// Декодируем экранированные символы в content
						const content = match[3]
							.replace(/\\n/g, '\n')
							.replace(/\\"/g, '"')
							.replace(/\\\\/g, '\\');

						blocks.push({
							type: this.mapBlockType(match[1]),
							title: match[2] || '',
							content: content,
						});
						lastIndex = match.index + match[0].length;
					} catch {
						// Пропускаем некорректные блоки
					}
				}
			}

			return blocks.length > 0 ? blocks : null;
		} catch {
			return null;
		}
	}

	/**
	 * Маппит строковый тип блока в enum
	 */
	private mapBlockType(type: string): RecipeBlockType {
		switch (type.toLowerCase()) {
			case 'ingredients':
				return RecipeBlockType.INGREDIENTS;
			case 'preparation':
				return RecipeBlockType.PREPARATION;
			case 'cooking':
				return RecipeBlockType.COOKING;
			case 'serving':
				return RecipeBlockType.SERVING;
			default:
				return RecipeBlockType.COOKING;
		}
	}
}

