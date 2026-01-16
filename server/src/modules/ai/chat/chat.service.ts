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

@Injectable()
export class ChatService {
	constructor(
		@Inject(AI_PROVIDER) private readonly aiProvider: ChatProvider,
		private readonly recipeAnalyzer: RecipeAnalyzerService,
	) {}

	async chat(request: ChatRequestDto): Promise<ChatResponseDto> {
		if (!request.message || request.message.trim().length === 0) {
			throw new BadRequestException('Message cannot be empty');
		}

		const model = 'gpt-5.2-2025-12-11';

		const messages = this.buildMessages(request.message, request.history, true);

		const response = await this.aiProvider.chat(messages, model);

		let parsedResponse: {
			isRecipe: boolean;
			message?: string;
			blocks?: Array<{
				type: string;
				title: string;
				content: string;
			}>;
		} | null = null;

		try {
			const trimmedResponse = response.trim();
			if (trimmedResponse.startsWith('{')) {
				parsedResponse = JSON.parse(trimmedResponse);
			}
		} catch (error) {
			console.warn('Failed to parse JSON response, using as plain text:', error);
		}

		if (parsedResponse && parsedResponse.isRecipe === true && parsedResponse.blocks && parsedResponse.blocks.length > 0) {
			const structuredRecipe = {
				isRecipe: true,
				originalMessage: parsedResponse.message || response,
				blocks: parsedResponse.blocks.map((block) => ({
					type: this.mapBlockType(block.type),
					title: block.title || '',
					content: block.content || '',
				})),
			};

			return {
				message: parsedResponse.message || response,
				model: model,
				recipe: structuredRecipe,
			};
		}

		if (parsedResponse && parsedResponse.isRecipe === false) {
			return {
				message: parsedResponse.message || response,
				model: model,
				recipe: undefined,
			};
		}

		const shouldAnalyze = response.length > 50;
		let recipeAnalysis;
		if (shouldAnalyze) {
			recipeAnalysis = await this.recipeAnalyzer.analyzeMessage(response);
		} else {
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

	private buildMessages(
		userMessage: string,
		history?: Array<{ role: string; content: string }>,
		useJsonMode: boolean = false,
	): Array<{ role: string; content: string }> {
		const messages: Array<{ role: string; content: string }> = [];

		if (useJsonMode) {
			messages.push({
				role: ChatRole.SYSTEM,
				content: `You are a helpful and friendly cooking assistant. Your main goal is to help users with cooking-related questions and guide them towards recipe generation.

CRITICAL LANGUAGE REQUIREMENT: You MUST respond in the EXACT same language as the user's message. If the user writes in Russian, respond in Russian. If the user writes in English, respond in English. If the user writes in Spanish, respond in Spanish. Always match the user's language exactly - this includes all text in the JSON response (titles, content, ingredient names, etc.).

You MUST always respond with a valid JSON object in this exact format:

{
  "isRecipe": true or false,
  "message": "Your conversational response here (always include this field)",
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

YOUR BEHAVIOR AND CAPABILITIES:

1. COOKING CONSULTATION: You can and should answer cooking questions, provide advice, suggest ingredient substitutions, explain cooking techniques, and help with meal planning.

2. SUGGESTING DISH OPTIONS: When users ask abstract questions like "I want something light and healthy" or "What can I make with these ingredients?", provide 3-5 specific dish suggestions with brief descriptions. Be helpful and creative.

3. INGREDIENT SUBSTITUTIONS: When users ask about replacing ingredients, provide practical alternatives with explanations of how they affect the dish.

4. RECIPE GENERATION ENCOURAGEMENT: After answering cooking questions or suggesting dishes, ALWAYS encourage the user to generate a recipe. Use phrases like:
   - "Would you like me to generate a detailed recipe for [dish name]?"
   - "I can create a step-by-step recipe for any of these dishes. Which one interests you?"
   - "Would you like a full recipe with ingredients and instructions?"
   - Match the language of the user's message.

5. RECIPE GENERATION: When the user explicitly asks for a recipe or agrees to generate one, set isRecipe: true and provide full recipe structure.

IMPORTANT DECISION RULES:
- Set "isRecipe": true ONLY when the user explicitly asks HOW to make/cook/prepare/create a dish, OR when they agree to generate a recipe after your suggestion
- Set "isRecipe": true for: "How do I make X?", "How to make X?", "Recipe for X", "Generate recipe for X", "Yes, generate recipe", "Show me recipe for X"
- Set "isRecipe": false for: general questions, ingredient substitutions, dish suggestions, cooking advice, abstract meal planning questions
- ALWAYS include the "message" field with your conversational response, even when isRecipe: true
- When isRecipe: true, include all 4 block types: ingredients, preparation, cooking, serving
- When isRecipe: false, return empty blocks array: "blocks": []

EXAMPLES OF CONVERSATIONAL RESPONSES (isRecipe: false):
- User: "What can I substitute for eggs?" → Answer with alternatives, then suggest: "Would you like me to generate a recipe that uses one of these substitutes?"
- User: "I want something light and healthy for dinner" → Suggest 3-5 dishes, then: "I can create a detailed recipe for any of these. Which one would you like?"
- User: "I have tomatoes, pasta, and cheese. What can I make?" → Suggest 3-5 dishes, then: "Would you like a full recipe for one of these?"
- User: "How do I make pasta carbonara?" → isRecipe: true (explicit recipe request)

Block types (only used when isRecipe: true):
- "ingredients": List all ingredients with quantities (use bullet points with "-")
- "preparation": Preparation steps (cutting, chopping, mixing, marinating, etc.)
- "cooking": Main cooking steps (boiling, frying, baking, simmering, etc.)
- "serving": Serving instructions, presentation, garnishing

CRITICAL RULES:
1. ALWAYS include the "message" field with your response text
2. When isRecipe: false, provide helpful, conversational answers and encourage recipe generation
3. When isRecipe: true, include both the message and complete recipe blocks
4. All strings must be properly escaped (use \\n for line breaks)
5. When isRecipe: true, include all 4 block types in order: ingredients, preparation, cooking, serving
6. When isRecipe: false, set blocks to empty array: "blocks": []`,
			});
		} else {
			messages.push({
				role: ChatRole.SYSTEM,
				content: `You are a helpful and friendly cooking assistant. Your main goal is to help users with cooking-related questions and guide them towards recipe generation.

You can:
- Answer cooking questions and provide advice
- Suggest ingredient substitutions
- Propose multiple dish options based on available ingredients or preferences
- Answer abstract questions like "I want something light and healthy"
- Explain cooking techniques and tips

After answering questions or suggesting dishes, always encourage the user to generate a detailed recipe. The main goal of communication in this chat is recipe generation.

CRITICAL LANGUAGE REQUIREMENT: You MUST respond in the EXACT same language as the user's message. If the user writes in Russian, respond in Russian. If the user writes in English, respond in English. If the user writes in Spanish, respond in Spanish. Always match the user's language exactly.`,
			});
		}

		if (history && history.length > 0) {
			const filteredHistory = history.filter((msg) => msg.role !== ChatRole.SYSTEM);
			messages.push(...filteredHistory);
		}

		messages.push({
			role: ChatRole.USER,
			content: userMessage,
		});

		return messages;
	}

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

		const model = 'gpt-5.2-2025-12-11';

		const useJsonMode = this.shouldUseJsonMode(request.message);

		const messages = this.buildMessages(request.message, request.history, useJsonMode);

		let fullMessage = '';
		let jsonBuffer = '';
		const sentBlockIndices = new Set<number>();

		let isJsonResponse = false;
		let hasFoundBlocks = false;
		let messageFieldStreamed = false;

		for await (const chunk of this.aiProvider.chatStream(
			messages,
			model,
			useJsonMode,
		)) {
			fullMessage += chunk;
			jsonBuffer += chunk;

			if (!isJsonResponse && jsonBuffer.trim().startsWith('{')) {
				isJsonResponse = true;
			}

			if (useJsonMode && isJsonResponse) {
				const blocks = this.tryParseJsonBlocks(jsonBuffer);
				if (blocks && blocks.length > 0) {
					hasFoundBlocks = true;
					for (let i = 0; i < blocks.length; i++) {
						if (!sentBlockIndices.has(i)) {
							yield { type: 'block', data: blocks[i] };
							sentBlockIndices.add(i);
						}
					}
				}
				
				if (!hasFoundBlocks && !messageFieldStreamed) {
					const isRecipeFalseMatch = jsonBuffer.match(/"isRecipe"\s*:\s*false/);
					if (isRecipeFalseMatch) {
						const messageMatch = jsonBuffer.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"\s*[,}]/);
						if (messageMatch && messageMatch[1]) {
							const messageContent = messageMatch[1]
								.replace(/\\n/g, '\n')
								.replace(/\\"/g, '"')
								.replace(/\\\\/g, '\\')
								.replace(/\\t/g, '\t')
								.replace(/\\r/g, '\r');
							
							yield { type: 'chunk', data: messageContent };
							messageFieldStreamed = true;
						}
					}
				}
			} else {
				yield { type: 'chunk', data: chunk };
			}
		}

		if (useJsonMode && isJsonResponse) {
			try {
				const responseData = JSON.parse(jsonBuffer.trim());
				
				if (responseData.isRecipe === true && responseData.blocks && Array.isArray(responseData.blocks) && responseData.blocks.length > 0) {
					const structuredRecipe: StructuredRecipeDto = {
						isRecipe: true,
						originalMessage: responseData.message || fullMessage,
						blocks: responseData.blocks.map((block: any) => ({
							type: this.mapBlockType(block.type),
							title: block.title || '',
							content: block.content || '',
						})),
					};

					if (!messageFieldStreamed && responseData.message) {
						yield { type: 'chunk', data: responseData.message };
					}

					yield { type: 'recipe', data: structuredRecipe };
					return;
				} 
				else if (responseData.isRecipe === false) {
					if (responseData.message && !messageFieldStreamed) {
						yield { type: 'chunk', data: responseData.message };
					}
					return;
				}
			} catch (error) {
				console.warn('Failed to parse JSON response:', error);
				if (sentBlockIndices.size === 0 && !messageFieldStreamed) {
					yield { type: 'chunk', data: fullMessage };
				}
			}
		} else if (fullMessage.trim() && !isJsonResponse) {
		}
	}

	private shouldUseJsonMode(message: string): boolean {
		return true;
	}

	private tryParseJsonBlocks(jsonBuffer: string): RecipeBlockDto[] | null {
		try {
			const blocksMatch = jsonBuffer.match(/"blocks"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
			if (!blocksMatch) {
				return null;
			}

			const blocksContent = blocksMatch[1];
			const blockPattern =
				/\{\s*"type"\s*:\s*"([^"]+)"\s*,\s*"title"\s*:\s*"([^"]*)"\s*,\s*"content"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
			const blocks: RecipeBlockDto[] = [];
			let match;
			let lastIndex = 0;

			while ((match = blockPattern.exec(blocksContent)) !== null) {
				if (match.index >= lastIndex) {
					try {
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
					}
				}
			}

			return blocks.length > 0 ? blocks : null;
		} catch {
			return null;
		}
	}

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

