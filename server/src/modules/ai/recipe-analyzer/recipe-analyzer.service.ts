import { Injectable, Inject } from '@nestjs/common';
import { AI_PROVIDER } from '../../../core/ai/ai.constants';
import type { ChatProvider } from '../../../core/ai/interfaces/ai-provider.interface';
import { ChatRole } from '../chat/interfaces/chat-message.interface';
import {
	RecipeBlockDto,
	RecipeBlockType,
	StructuredRecipeDto,
} from './dto/recipe-block.dto';

/**
 * Сервис для анализа и структурирования рецептов из ответов ИИ
 * Использует ИИ для определения рецепта и разбиения на блоки
 */
@Injectable()
export class RecipeAnalyzerService {
	constructor(
		@Inject(AI_PROVIDER) private readonly aiProvider: ChatProvider,
	) {}

	/**
	 * Анализирует сообщение с помощью ИИ и возвращает структурированный рецепт
	 */
	async analyzeMessage(message: string): Promise<StructuredRecipeDto> {
		if (!message || message.trim().length === 0) {
			return {
				isRecipe: false,
				originalMessage: message,
				blocks: [],
			};
		}

		const analysisPrompt = `Analyze the following text and determine if it is a cooking recipe. If it is a recipe, extract and structure it into semantic blocks.

IMPORTANT: You MUST return ONLY a valid JSON object. Do not include any additional text, markdown formatting, or code blocks.

Return a JSON object with this exact structure:
{
  "isRecipe": true or false,
  "blocks": [
    {
      "type": "ingredients" | "preparation" | "cooking" | "serving",
      "title": "Section title (can be empty string)",
      "content": "Section content"
    }
  ]
}

Block types:
- "ingredients": List of ingredients needed (with quantities if available)
- "preparation": Preparation steps (cutting, chopping, mixing, marinating, etc.)
- "cooking": Cooking/instruction steps (boiling, frying, baking, etc.)
- "serving": Serving instructions, presentation, garnishing

Rules:
- If the text is NOT a recipe, set "isRecipe" to false and return empty "blocks" array
- If the text IS a recipe, set "isRecipe" to true and extract all relevant sections
- Extract section titles if they exist (e.g., "Ingredients", "Preparation", "Cooking", "Serving")
- If no explicit section titles exist, infer them from content
- Preserve the original content structure
- Each block should contain related content grouped together
- If you can't determine a specific section type, use "cooking" as default

Text to analyze:
${message}`;

		try {
			const analysisResponse = await this.aiProvider.chat(
				[
					{
						role: ChatRole.SYSTEM,
						content:
							'You are a helpful assistant that analyzes cooking recipes. Always respond with valid JSON only, no additional text.',
					},
					{
						role: ChatRole.USER,
						content: analysisPrompt,
					},
				],
				'gpt-5.2-2025-12-11',
			);

			// Парсим JSON ответ
			let analysisResult: {
				isRecipe: boolean;
				blocks: Array<{
					type: string;
					title: string;
					content: string;
				}>;
			};

			try {
				// Пытаемся найти JSON в ответе (на случай, если ИИ добавил дополнительный текст)
				const jsonMatch = analysisResponse.match(/\{[\s\S]*\}/);
				if (jsonMatch) {
					analysisResult = JSON.parse(jsonMatch[0]);
				} else {
					analysisResult = JSON.parse(analysisResponse);
				}
			} catch (parseError) {
				console.error('Failed to parse AI analysis response:', parseError);
				console.error('Response was:', analysisResponse);
				// В случае ошибки парсинга возвращаем как не-рецепт
				return {
					isRecipe: false,
					originalMessage: message,
					blocks: [],
				};
			}

			// Валидация и преобразование результата
			const blocks: RecipeBlockDto[] = [];

			if (analysisResult.blocks && Array.isArray(analysisResult.blocks)) {
				for (const block of analysisResult.blocks) {
					// Валидируем тип блока
					let blockType: RecipeBlockType;
					switch (block.type?.toLowerCase()) {
						case 'ingredients':
							blockType = RecipeBlockType.INGREDIENTS;
							break;
						case 'preparation':
							blockType = RecipeBlockType.PREPARATION;
							break;
						case 'cooking':
							blockType = RecipeBlockType.COOKING;
							break;
						case 'serving':
							blockType = RecipeBlockType.SERVING;
							break;
						default:
							blockType = RecipeBlockType.COOKING;
					}

					blocks.push({
						type: blockType,
						title: block.title || '',
						content: block.content || '',
					});
				}
			}

			return {
				isRecipe: analysisResult.isRecipe === true,
				originalMessage: message,
				blocks,
			};
		} catch (error) {
			console.error('Error analyzing recipe with AI:', error);
			// В случае ошибки возвращаем как не-рецепт
			return {
				isRecipe: false,
				originalMessage: message,
				blocks: [],
			};
		}
	}
}
