import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { AI_PROVIDER } from '../../../core/ai/ai.constants';
import type { ChatProvider } from '../../../core/ai/interfaces/ai-provider.interface';
import { ChatService } from '../chat/chat.service';
import { RecipeFlowRequestDto } from './dto/recipe-flow-request.dto';
import { RecipeFlowResponseDto, FlowNode, FlowEdge } from './dto/recipe-flow-response.dto';

@Injectable()
export class RecipeFlowService {
	constructor(
		@Inject(AI_PROVIDER) private readonly aiProvider: ChatProvider,
		private readonly chatService: ChatService,
	) {}

	async generateFlow(request: RecipeFlowRequestDto): Promise<RecipeFlowResponseDto> {
		let recipeText: string;

		if (request.structuredRecipe && request.structuredRecipe.blocks && request.structuredRecipe.blocks.length > 0) {
			recipeText = this.buildRecipeTextFromBlocks(request.structuredRecipe.blocks);
		}
		else if (request.recipe) {
			recipeText = request.recipe;
		}
		else if (request.message) {
			recipeText = await this.getRecipeFromMessage(request.message);
		} else {
			throw new BadRequestException('Either structuredRecipe, recipe or message must be provided');
		}

		if (!recipeText || recipeText.trim().length === 0) {
			throw new BadRequestException('Recipe text cannot be empty');
		}

		const recipeTitle = await this.generateRecipeTitle(recipeText);
		
		const flowData = await this.generateFlowFromRecipe(recipeText);
		flowData.title = recipeTitle;

		return flowData;
	}

	private buildRecipeTextFromBlocks(blocks: Array<{ type: string; title: string; content: string }>): string {
		return blocks
			.map((block) => `## ${block.title}\n${block.content}`)
			.join('\n\n');
	}

	async getRecipeFromMessage(message: string): Promise<string> {
		const systemPrompt = `You are a helpful cooking assistant. 

CRITICAL LANGUAGE REQUIREMENT: You MUST respond in the EXACT same language as the user's message. If the user writes in Russian, respond in Russian. If the user writes in English, respond in English. If the user writes in Spanish, respond in Spanish. Always match the user's language exactly - this includes all section headers, ingredient names, and step descriptions.

When the user asks for a recipe, provide it with clear section headers using one of these formats:

1. Markdown headers (preferred):
## Ingredients
- Item 1 - quantity
- Item 2 - quantity

## Preparation
Step description...

## Cooking
Step description...

## Serving
Step description...

2. Or plain text headers:
Ingredients:
- Item 1 - quantity

Preparation:
Step description...

Cooking:
Step description...

Serving:
Step description...

Always include clear section headers (Ingredients, Preparation, Cooking, Serving) when providing recipes. Use bullet points for ingredients and numbered or bullet points for steps.`;

		const messages = [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: message },
		];

		return await this.aiProvider.chat(messages, 'gpt-5.2-2025-12-11');
	}

	private async generateRecipeTitle(recipeText: string): Promise<string> {
		const firstLine = recipeText.split('\n')[0].trim();
		const words = recipeText.split(/\s+/);
		
		const titlePatterns = [
			/^(?:Recipe for |How to (?:make|prepare|cook) |How do you (?:make|prepare|cook) )(.+?)(?:\.|:|$)/i,
			/^(.+?)(?:\s+Recipe|:)/i,
		];

		for (const pattern of titlePatterns) {
			const match = firstLine.match(pattern);
			if (match && match[1]) {
				const extracted = match[1].trim();
				if (extracted.length > 0 && extracted.length < 50) {
					return extracted;
				}
			}
		}

		const titlePrompt = `Generate a short recipe title (2-4 words) for: ${firstLine.substring(0, 200)}. Title only, same language.`;

		try {
			const title = await this.aiProvider.chat(
				[
					{ role: 'system', content: 'Generate concise recipe titles (2-4 words), title only.' },
					{ role: 'user', content: titlePrompt },
				],
				'gpt-5.2-2025-12-11',
			);
			const cleaned = title.trim().replace(/^["']|["']$/g, '').split('\n')[0].trim();
			return cleaned.length > 50 ? cleaned.substring(0, 47) + '...' : cleaned || words.slice(0, 3).join(' ');
		} catch (error) {
			console.error('Failed to generate recipe title:', error);
			const meaningfulWords = words.slice(0, 5).filter(w => w.length > 2 && !['the', 'and', 'for', 'with'].includes(w.toLowerCase()));
			return meaningfulWords.slice(0, 3).join(' ') || 'Recipe';
		}
	}

	async *generateFlowStream(
		recipeText: string,
	): AsyncGenerator<
		| { type: 'title'; data: string }
		| { type: 'node'; data: FlowNode }
		| { type: 'edge'; data: FlowEdge }
		| { type: 'complete'; data: RecipeFlowResponseDto },
		void,
		unknown
	> {
		const recipeTitle = await this.generateRecipeTitle(recipeText);
		yield { type: 'title', data: recipeTitle };
		const systemPrompt = `Convert cooking recipes into flow diagrams. Respond in the SAME language as the recipe.

JSON STRUCTURE:
{
  "nodes": [{"id": "string", "type": "ingredientNode|preparationNode|cookingNode|servingNode|blockNode", "position": {"x": 0, "y": 0}, "data": {"label": "string", "description": "string (optional)", "ingredients": [{"name": "string", "quantity": "string"}]}}],
  "edges": [{"id": "string", "source": "nodeId", "target": "nodeId", "time": "string (e.g., '30 minutes' or '')"}],
  "nutritionalInfo": {"calories": number, "protein": number, "fat": number, "carbohydrates": number, "fiber": number (optional), "sugar": number (optional), "sodium": number (optional)}
}

NODE TYPES:
- ingredientNode: EXACTLY ONE, contains ALL ingredients, label="Ingredients"
- blockNode: FIRST node of each parallel block (e.g., "Sauté", "Broth")
- preparationNode: prep steps (chop, mix, marinate)
- cookingNode: cooking steps (boil, fry, bake, simmer)
- servingNode: final steps (serve, garnish)

BLOCK STRUCTURE:
1. ingredientNode → edges to FIRST node of EACH parallel block
2. Each block: blockNode → sequential nodes (A→B→C)
3. Blocks merge at single node, then continue sequentially
4. NO connections between different blocks (only at merge)

RULES:
- Use placeholder positions {x:0, y:0} for all nodes
- Parallelize long tasks (broth/meat cooking) with prep tasks (sauté/vegetables)
- Edge "time" field: waiting duration or "" if none
- Calculate nutritionalInfo from ingredients (required: calories, protein, fat, carbs)
- Return ONLY valid JSON, no markdown, no code blocks`;

		const userPrompt = `Convert this recipe into a flow diagram:\n\n${recipeText}`;

		const messages = [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt },
		];

		let jsonBuffer = '';
		const sentNodeIds = new Set<string>();
		const sentEdgeIds = new Set<string>();

		try {
			const openaiClient = (this.aiProvider as any).getClient?.();
			if (openaiClient) {
				const stream = await openaiClient.chat.completions.create({
					model: 'gpt-5.2-2025-12-11',
					messages: messages.map((msg) => ({
						role: msg.role as 'system' | 'user' | 'assistant',
						content: msg.content,
					})),
					temperature: 0.2,
					max_completion_tokens: 8000,
					response_format: { type: 'json_object' },
					stream: true,
				});

				for await (const chunk of stream) {
					const content = chunk.choices[0]?.delta?.content;
					if (content) {
						jsonBuffer += content;

						const parsed = this.tryParseFlowJson(jsonBuffer);
						if (parsed) {
							if (parsed.nodes) {
								for (const node of parsed.nodes) {
									if (node.id && !sentNodeIds.has(node.id)) {
										yield { type: 'node', data: node };
										sentNodeIds.add(node.id);
									}
								}
							}

							if (parsed.edges) {
								for (const edge of parsed.edges) {
									if (edge.id && !sentEdgeIds.has(edge.id)) {
										yield { type: 'edge', data: edge };
										sentEdgeIds.add(edge.id);
									}
								}
							}
						}
					}
				}

				try {
					const flowData = JSON.parse(jsonBuffer.trim());
					if (flowData.nodes && Array.isArray(flowData.nodes) && flowData.edges && Array.isArray(flowData.edges)) {
						const validated = this.validateFlowData(flowData);
						validated.title = recipeTitle;
						yield { type: 'complete', data: validated };
					}
				} catch (parseError) {
					throw new Error(`Failed to parse flow JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
				}
			} else {
				throw new Error('OpenAI client not available');
			}
		} catch (error) {
			if (error instanceof Error) {
				throw new BadRequestException(`Failed to generate flow diagram: ${error.message}`);
			}
			throw new BadRequestException('Failed to generate flow diagram: Unknown error');
		}
	}

	private tryParseFlowJson(jsonBuffer: string): { nodes?: FlowNode[]; edges?: FlowEdge[] } | null {
		const result: { nodes?: FlowNode[]; edges?: FlowEdge[] } = {};
		
		try {
			const parsed = JSON.parse(jsonBuffer.trim());
			if (parsed.nodes && Array.isArray(parsed.nodes)) {
				result.nodes = parsed.nodes.filter((node: any) => node.id && node.type && node.data);
			}
			if (parsed.edges && Array.isArray(parsed.edges)) {
				result.edges = parsed.edges.filter((edge: any) => edge.id && edge.source && edge.target);
			}
			if (result.nodes || result.edges) {
				return result;
			}
		} catch {
		}

		const nodesMatch = jsonBuffer.match(/"nodes"\s*:\s*\[([\s\S]*)/);
		if (nodesMatch) {
			const nodesContent = nodesMatch[1];
			const nodeObjects = this.extractJsonObjects(nodesContent);
			if (nodeObjects.length > 0) {
				result.nodes = nodeObjects
					.map((objStr) => {
						try {
							const node = JSON.parse(objStr);
							if (node.id && node.type && node.data) {
								return node as FlowNode;
							}
						} catch {
						}
						return null;
					})
					.filter((node): node is FlowNode => node !== null);
			}
		}

		const edgesMatch = jsonBuffer.match(/"edges"\s*:\s*\[([\s\S]*)/);
		if (edgesMatch) {
			const edgesContent = edgesMatch[1];
			const edgeObjects = this.extractJsonObjects(edgesContent);
			if (edgeObjects.length > 0) {
				result.edges = edgeObjects
					.map((objStr) => {
						try {
							const edge = JSON.parse(objStr);
							if (edge.id && edge.source && edge.target) {
								return edge as FlowEdge;
							}
						} catch {
						}
						return null;
					})
					.filter((edge): edge is FlowEdge => edge !== null);
			}
		}

		return Object.keys(result).length > 0 ? result : null;
	}

	private extractJsonObjects(content: string): string[] {
		const objects: string[] = [];
		let depth = 0;
		let start = -1;
		let inString = false;
		let escapeNext = false;

		for (let i = 0; i < content.length; i++) {
			const char = content[i];

			if (escapeNext) {
				escapeNext = false;
				continue;
			}

			if (char === '\\') {
				escapeNext = true;
				continue;
			}

			if (char === '"' && !escapeNext) {
				inString = !inString;
				continue;
			}

			if (!inString) {
				if (char === '{') {
					if (depth === 0) {
						start = i;
					}
					depth++;
				} else if (char === '}') {
					depth--;
					if (depth === 0 && start !== -1) {
						const objStr = content.substring(start, i + 1);
						objects.push(objStr);
						start = -1;
					}
				}
			}
		}

		return objects;
	}

	private validateFlowData(flowData: any): RecipeFlowResponseDto {
		if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
			throw new Error('Invalid response: nodes array is missing or invalid');
		}
		if (!flowData.edges || !Array.isArray(flowData.edges)) {
			throw new Error('Invalid response: edges array is missing or invalid');
		}

		for (const node of flowData.nodes) {
			if (!node.id || !node.type || !node.position || !node.data) {
				throw new Error(`Invalid node structure: ${JSON.stringify(node)}`);
			}
			if (!node.data.label) {
				throw new Error(`Node ${node.id} is missing label`);
			}
		}

		const nodeIds = new Set(flowData.nodes.map((n: FlowNode) => n.id));
		for (const edge of flowData.edges) {
			if (!edge.id || !edge.source || !edge.target) {
				throw new Error(`Invalid edge structure: ${JSON.stringify(edge)}`);
			}
			if (!nodeIds.has(edge.source)) {
				throw new Error(`Edge references non-existent source node: ${edge.source}`);
			}
			if (!nodeIds.has(edge.target)) {
				throw new Error(`Edge references non-existent target node: ${edge.target}`);
			}
		}

		return flowData as RecipeFlowResponseDto;
	}

	private async generateFlowFromRecipe(recipeText: string): Promise<RecipeFlowResponseDto> {
		const systemPrompt = `Convert cooking recipes into flow diagrams. Respond in the SAME language as the recipe.

JSON STRUCTURE:
{
  "nodes": [{"id": "string", "type": "ingredientNode|preparationNode|cookingNode|servingNode|blockNode", "position": {"x": 0, "y": 0}, "data": {"label": "string", "description": "string (optional)", "ingredients": [{"name": "string", "quantity": "string"}]}}],
  "edges": [{"id": "string", "source": "nodeId", "target": "nodeId", "time": "string (e.g., '30 minutes' or '')"}],
  "nutritionalInfo": {"calories": number, "protein": number, "fat": number, "carbohydrates": number, "fiber": number (optional), "sugar": number (optional), "sodium": number (optional)}
}

NODE TYPES:
- ingredientNode: EXACTLY ONE, contains ALL ingredients, label="Ingredients"
- blockNode: FIRST node of each parallel block (e.g., "Sauté", "Broth")
- preparationNode: prep steps (chop, mix, marinate)
- cookingNode: cooking steps (boil, fry, bake, simmer)
- servingNode: final steps (serve, garnish)

BLOCK STRUCTURE:
1. ingredientNode → edges to FIRST node of EACH parallel block
2. Each block: blockNode → sequential nodes (A→B→C)
3. Blocks merge at single node, then continue sequentially
4. NO connections between different blocks (only at merge)

RULES:
- Use placeholder positions {x:0, y:0} for all nodes
- Parallelize long tasks (broth/meat cooking) with prep tasks (sauté/vegetables)
- Edge "time" field: waiting duration or "" if none
- Calculate nutritionalInfo from ingredients (required: calories, protein, fat, carbs)
- Return ONLY valid JSON, no markdown, no code blocks`;

		const userPrompt = `Convert this recipe into a flow diagram:\n\n${recipeText}`;

		const messages = [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt },
		];

		let response: string | undefined;
		try {
			const openaiClient = (this.aiProvider as any).getClient?.();
			if (openaiClient) {
				const completion = await openaiClient.chat.completions.create({
					model: 'gpt-5.2-2025-12-11',
					messages: messages.map((msg) => ({
						role: msg.role as 'system' | 'user' | 'assistant',
						content: msg.content,
					})),
					temperature: 0.2,
					max_completion_tokens: 8000,
					response_format: { type: 'json_object' },
				});
				response = completion.choices[0]?.message?.content;
			} else {
				response = await this.aiProvider.chat(messages, 'gpt-5.2-2025-12-11');
			}
			
			if (!response) {
				throw new Error('Empty response from AI');
			}
			
			let jsonString = response.trim();
			
			if (jsonString.startsWith('```json')) {
				jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
			} else if (jsonString.startsWith('```')) {
				jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
			}

			let flowData: RecipeFlowResponseDto;
			try {
				flowData = JSON.parse(jsonString);
			} catch (parseError) {
				const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
				if (jsonMatch) {
					try {
						flowData = JSON.parse(jsonMatch[0]);
					} catch {
						throw parseError;
					}
				} else {
					throw parseError;
				}
			}

			if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
				throw new Error('Invalid response: nodes array is missing or invalid');
			}
			if (!flowData.edges || !Array.isArray(flowData.edges)) {
				throw new Error('Invalid response: edges array is missing or invalid');
			}

			for (const node of flowData.nodes) {
				if (!node.id || !node.type || !node.position || !node.data) {
					throw new Error(`Invalid node structure: ${JSON.stringify(node)}`);
				}
				if (!node.data.label) {
					throw new Error(`Node ${node.id} is missing label`);
				}
			}

			const nodeIds = new Set(flowData.nodes.map((n) => n.id));
			for (const edge of flowData.edges) {
				if (!edge.id || !edge.source || !edge.target) {
					throw new Error(`Invalid edge structure: ${JSON.stringify(edge)}`);
				}
				if (!nodeIds.has(edge.source)) {
					throw new Error(`Edge references non-existent source node: ${edge.source}`);
				}
				if (!nodeIds.has(edge.target)) {
					throw new Error(`Edge references non-existent target node: ${edge.target}`);
				}
			}

			return flowData;
		} catch (error) {
			if (error instanceof SyntaxError) {
				const responsePreview = response 
					? response.substring(0, 500) + (response.length > 500 ? '...' : '')
					: 'No response received';
				console.error('JSON parsing error:', error);
				console.error('Response preview:', responsePreview);
				throw new BadRequestException(
					`Failed to parse AI response as JSON: ${error.message}. Response may be incomplete. Please try again.`,
				);
			}
			if (error instanceof Error) {
				console.error('Error generating flow diagram:', error);
				throw new BadRequestException(`Failed to generate flow diagram: ${error.message}`);
			}
			throw new BadRequestException('Failed to generate flow diagram: Unknown error');
		}
	}
}

