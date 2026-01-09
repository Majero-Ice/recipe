import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { AI_PROVIDER } from '../../../core/ai/ai.constants';
import type { ChatProvider } from '../../../core/ai/interfaces/ai-provider.interface';
import { ChatService } from '../chat/chat.service';
import { RecipeFlowRequestDto } from './dto/recipe-flow-request.dto';
import { RecipeFlowResponseDto, FlowNode, FlowEdge } from './dto/recipe-flow-response.dto';

/**
 * Сервис для генерации flow-диаграммы из кухонного рецепта
 */
@Injectable()
export class RecipeFlowService {
	constructor(
		@Inject(AI_PROVIDER) private readonly aiProvider: ChatProvider,
		private readonly chatService: ChatService,
	) {}

	/**
	 * Генерирует flow-диаграмму из рецепта
	 * @param request Запрос с рецептом или сообщением для получения рецепта
	 * @returns Flow-диаграмма с узлами и связями
	 */
	async generateFlow(request: RecipeFlowRequestDto): Promise<RecipeFlowResponseDto> {
		let recipeText: string;

		// Если передан рецепт напрямую, используем его
		if (request.recipe) {
			recipeText = request.recipe;
		}
		// Если передано сообщение, получаем рецепт напрямую через AI без анализа
		else if (request.message) {
			// Оптимизация: получаем рецепт напрямую через AI, минуя chat service
			// чтобы избежать двойного анализа (chat + recipe analyzer)
			recipeText = await this.getRecipeFromMessage(request.message);
		} else {
			throw new BadRequestException('Either recipe or message must be provided');
		}

		if (!recipeText || recipeText.trim().length === 0) {
			throw new BadRequestException('Recipe text cannot be empty');
		}

		// Генерируем flow-диаграмму через AI
		const flowData = await this.generateFlowFromRecipe(recipeText);

		return flowData;
	}

	/**
	 * Получает рецепт из сообщения напрямую через AI, минуя chat service
	 * Это позволяет избежать двойного анализа и ускорить процесс
	 */
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

	/**
	 * Streams flow diagram generation, yielding nodes and edges as they're parsed
	 */
	async *generateFlowStream(
		recipeText: string,
	): AsyncGenerator<
		| { type: 'node'; data: FlowNode }
		| { type: 'edge'; data: FlowEdge }
		| { type: 'complete'; data: RecipeFlowResponseDto },
		void,
		unknown
	> {
		const systemPrompt = `You are a helpful assistant that converts cooking recipes into flow diagrams.

CRITICAL LANGUAGE REQUIREMENT: You MUST respond in the EXACT same language as the user's message and the recipe text. If the user writes in Russian, respond in Russian. If the user writes in English, respond in English. If the user writes in Spanish, respond in Spanish. Always match the user's language exactly - this includes all node labels, descriptions, ingredient names, and time values in the JSON response.

Your task is to analyze a cooking recipe and create a structured flow diagram representing the cooking process.

The flow diagram should represent:
1. Ingredients (list of ingredients needed)
2. Preparation steps (cutting, chopping, mixing, etc.)
3. Cooking steps (boiling, frying, baking, etc.)
4. Serving/finishing steps

IMPORTANT: You MUST return a complete, valid JSON object. Do not truncate the response. Make sure all strings are properly escaped and the JSON is complete.

Return ONLY a valid JSON object with this exact structure:
{
  "nodes": [
    {
      "id": "string (unique identifier)",
      "type": "ingredientNode | preparationNode | cookingNode | servingNode | blockNode",
      "position": { "x": number, "y": number },
      "data": {
        "label": "string (step name)",
        "description": "string (optional step description)",
        "ingredients": [
          {
            "name": "string (ingredient name)",
            "quantity": "string (amount and unit, e.g., '2 cups', '500g', '3 pieces')"
          }
        ]
      }
    }
  ],
  "edges": [
    {
      "id": "string (unique identifier)",
      "source": "string (node id)",
      "target": "string (node id)",
      "time": "string (time required before proceeding to next step, e.g., '30 minutes', '1 hour', '15 minutes', '2 hours')"
    }
  ],
  "nutritionalInfo": {
    "calories": number (total calories per serving),
    "protein": number (grams of protein per serving),
    "fat": number (grams of fat per serving),
    "carbohydrates": number (grams of carbohydrates per serving),
    "fiber": number (grams of fiber per serving, optional),
    "sugar": number (grams of sugar per serving, optional),
    "sodium": number (milligrams of sodium per serving, optional)
  }
}

Node Types:
- "ingredientNode": Create EXACTLY ONE node of this type. It should contain ALL ingredients from the recipe in the "ingredients" array. Each ingredient should have "name" and "quantity" fields. The label should be "Ingredients". Example data structure:
  {
    "label": "Ingredients",
    "ingredients": [
      { "name": "Carrots", "quantity": "2 pieces" },
      { "name": "Onions", "quantity": "1 large" },
      { "name": "Beef", "quantity": "500g" },
      { "name": "Salt", "quantity": "1 tsp" }
    ]
  }
- "blockNode": Use EXCLUSIVELY as the FIRST node of each parallel block. This node identifies and represents the entire block (e.g., "Sauté", "Broth", "Sauce", "Garnish"). It should have a descriptive name that summarizes what the block does. Do NOT use blockNode for regular steps - only as block headers.
- "preparationNode": Use for preparation steps (e.g., "Chop vegetables", "Marinate meat", "Mix ingredients")
- "cookingNode": Use for actual cooking steps (e.g., "Boil water", "Fry onions", "Simmer for 30 minutes", "Bake in oven")
- "servingNode": Use for final steps (e.g., "Serve hot", "Garnish", "Ready to serve")

DIAGRAM STRUCTURE - BLOCK-BASED APPROACH (CRITICAL):
For complex dishes, organize the recipe into separate, independent BLOCKS/PIPELINES. Each block represents a complete workflow for one component (e.g., "Sauté", "Broth", "Vegetables").

STRUCTURE RULES:
1. START: Create EXACTLY ONE "ingredientNode" with ALL ingredients. This is the root node.
2. BLOCK CREATION: From the ingredientNode, create separate edges DIRECTLY to the FIRST node of EACH parallel block. Each block should have a descriptive name as its first node (e.g., "Sauté", "Broth").
3. WITHIN BLOCKS: Each block is a self-contained sequential pipeline:
   - Nodes within a block connect sequentially: A → B → C → D
   - NO connections between nodes from different blocks
   - Each block flows independently from start to finish
4. BLOCK MERGING: All parallel blocks converge at a single MERGE node where they combine (e.g., "Add sauté to broth").
5. AFTER MERGE: After the merge point, continue with a normal sequential flow (one node after another).
6. NESTED BLOCKS: If needed after merging, you can create new parallel blocks again, following the same pattern.

EXAMPLE STRUCTURE (Borscht):
- ingredientNode (Ingredients) → branches directly to:
  * Block 1: blockNode "Sauté" → preparationNode "Prepare onions" → preparationNode "Prepare beets" → cookingNode "Sauté in pan"
  * Block 2: blockNode "Broth" → preparationNode "Prepare meat" → cookingNode "Cook meat in water" → preparationNode "Prepare potatoes" → cookingNode "Cook potatoes in broth"
- Both blocks merge at: cookingNode "Add sauté to broth"
- After merge: cookingNode "Further processes" → servingNode "Ready"

IMPORTANT: The first node of each parallel block MUST be a "blockNode" type. This visually identifies the block. Subsequent nodes within the block can be preparationNode, cookingNode, or other appropriate types.

KEY PRINCIPLES:
- ingredientNode connects DIRECTLY to the first node of each block (NO intermediate nodes like "Prepare products")
- Each block is completely independent - NO edges between different blocks
- Blocks only connect at merge points
- After merging, use normal sequential flow
- This creates clear visual separation: each block is a separate pipeline that can be followed independently

Rules:
- Create EXACTLY ONE "ingredientNode" with ALL ingredients from the recipe in the "ingredients" array
- From ingredientNode, create edges DIRECTLY to the FIRST node of EACH parallel block
- Each block's first node MUST be of type "blockNode" with a descriptive name representing the block (e.g., "Sauté", "Broth", "Sauce", "Garnish")
- After the blockNode, use appropriate node types (preparationNode, cookingNode, etc.) for subsequent steps within the block
- Within each block, connect nodes sequentially in a linear chain (A → B → C)
- Between parallel blocks, create ABSOLUTELY NO connections - they are completely independent pipelines
- All blocks converge at a merge node where they combine
- After the merge node, continue with sequential flow (or create new blocks if needed)
- Position nodes will be automatically calculated by the client, so you can use placeholder positions like { "x": 0, "y": 0 } for all nodes
- The client will arrange nodes in a hierarchical layout based on the edges, so focus on creating correct node connections rather than precise positioning
- Identify opportunities for parallelization: if one step takes a long time (like boiling, simmering, marinating) and another step can be done during that time, they should be separate parallel blocks
- Common parallel block scenarios:
  * Block 1: Main component cooking (broth, meat, etc.) - long process
  * Block 2: Side component preparation (sauté, vegetables, etc.) - can be done during Block 1
  * Block 3: Additional preparations (garnishes, sides, etc.)
- The time on edges leading to parallel blocks should reflect the actual time needed for each parallel task
- After parallel blocks, they converge into a single merge node that combines the results
- For each edge, include the "time" field indicating how long to wait before proceeding to the next step
- Time examples: "5 minutes", "10 minutes", "30 minutes", "1 hour", "2 hours", "overnight"
- If a step requires waiting (e.g., "bake for 1 hour", "marinate for 30 minutes", "let rest for 15 minutes"), include that time in the edge connecting to the next step
- If no waiting time is needed between steps, use empty string "" or omit the time field
- Make sure all node IDs in edges exist in nodes array
- Escape special characters in strings (quotes, newlines, etc.)
- Calculate and include nutritional information (nutritionalInfo) based on the ingredients and their quantities in the recipe
- Nutritional information should be calculated for the entire recipe (total servings). Include calories, protein, fat, carbohydrates as required fields. Optionally include fiber, sugar, and sodium if available
- Use reasonable estimates based on standard nutritional values for common ingredients
- Ensure the JSON is complete and valid - do not truncate it
- Return ONLY the JSON object, no additional text, no markdown formatting, no code blocks`;

		const userPrompt = `Convert this recipe into a flow diagram:\n\n${recipeText}`;

		const messages = [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt },
		];

		let jsonBuffer = '';
		const sentNodeIds = new Set<string>();
		const sentEdgeIds = new Set<string>();

		try {
			// Используем прямой доступ к OpenAI клиенту для использования JSON mode и streaming
			const openaiClient = (this.aiProvider as any).getClient?.();
			if (openaiClient) {
				const stream = await openaiClient.chat.completions.create({
					model: 'gpt-5.2-2025-12-11',
					messages: messages.map((msg) => ({
						role: msg.role as 'system' | 'user' | 'assistant',
						content: msg.content,
					})),
					temperature: 0.3,
					max_completion_tokens: 4000,
					response_format: { type: 'json_object' },
					stream: true,
				});

				for await (const chunk of stream) {
					const content = chunk.choices[0]?.delta?.content;
					if (content) {
						jsonBuffer += content;

						// Пытаемся парсить JSON инкрементально и отправлять узлы и связи по мере их обнаружения
						const parsed = this.tryParseFlowJson(jsonBuffer);
						if (parsed) {
							// Отправляем новые узлы
							if (parsed.nodes) {
								for (const node of parsed.nodes) {
									if (node.id && !sentNodeIds.has(node.id)) {
										yield { type: 'node', data: node };
										sentNodeIds.add(node.id);
									}
								}
							}

							// Отправляем новые связи
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

				// После завершения стриминга пытаемся распарсить полный JSON
				try {
					const flowData = JSON.parse(jsonBuffer.trim());
					if (flowData.nodes && Array.isArray(flowData.nodes) && flowData.edges && Array.isArray(flowData.edges)) {
						// Валидируем и отправляем финальный результат
						const validated = this.validateFlowData(flowData);
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

	/**
	 * Пытается распарсить JSON flow данных инкрементально
	 * Извлекает отдельные объекты узлов и связей из неполного JSON
	 */
	private tryParseFlowJson(jsonBuffer: string): { nodes?: FlowNode[]; edges?: FlowEdge[] } | null {
		const result: { nodes?: FlowNode[]; edges?: FlowEdge[] } = {};
		
		// Сначала пытаемся распарсить полный JSON
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
			// JSON еще не полный, пытаемся извлечь объекты инкрементально
		}

		// Извлекаем узлы из массива nodes
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
							// Пропускаем некорректные узлы
						}
						return null;
					})
					.filter((node): node is FlowNode => node !== null);
			}
		}

		// Извлекаем связи из массива edges
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
							// Пропускаем некорректные связи
						}
						return null;
					})
					.filter((edge): edge is FlowEdge => edge !== null);
			}
		}

		return Object.keys(result).length > 0 ? result : null;
	}

	/**
	 * Извлекает отдельные JSON объекты из строки (для инкрементального парсинга)
	 */
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

	/**
	 * Валидирует flow данные
	 */
	private validateFlowData(flowData: any): RecipeFlowResponseDto {
		if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
			throw new Error('Invalid response: nodes array is missing or invalid');
		}
		if (!flowData.edges || !Array.isArray(flowData.edges)) {
			throw new Error('Invalid response: edges array is missing or invalid');
		}

		// Валидация узлов
		for (const node of flowData.nodes) {
			if (!node.id || !node.type || !node.position || !node.data) {
				throw new Error(`Invalid node structure: ${JSON.stringify(node)}`);
			}
			if (!node.data.label) {
				throw new Error(`Node ${node.id} is missing label`);
			}
		}

		// Валидация связей
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

	/**
	 * Генерирует flow-диаграмму из текста рецепта используя AI
	 */
	private async generateFlowFromRecipe(recipeText: string): Promise<RecipeFlowResponseDto> {
		const systemPrompt = `You are a helpful assistant that converts cooking recipes into flow diagrams.

CRITICAL LANGUAGE REQUIREMENT: You MUST respond in the EXACT same language as the recipe text. If the recipe is in Russian, respond in Russian. If the recipe is in English, respond in English. If the recipe is in Spanish, respond in Spanish. Always match the recipe's language exactly - this includes all node labels, descriptions, ingredient names, and time values in the JSON response.

Your task is to analyze a cooking recipe and create a structured flow diagram representing the cooking process.

The flow diagram should represent:
1. Ingredients (list of ingredients needed)
2. Preparation steps (cutting, chopping, mixing, etc.)
3. Cooking steps (boiling, frying, baking, etc.)
4. Serving/finishing steps

IMPORTANT: You MUST return a complete, valid JSON object. Do not truncate the response. Make sure all strings are properly escaped and the JSON is complete.

Return ONLY a valid JSON object with this exact structure:
{
  "nodes": [
    {
      "id": "string (unique identifier)",
      "type": "ingredientNode | preparationNode | cookingNode | servingNode | blockNode",
      "position": { "x": number, "y": number },
      "data": {
        "label": "string (step name)",
        "description": "string (optional step description)",
        "ingredients": [
          {
            "name": "string (ingredient name)",
            "quantity": "string (amount and unit, e.g., '2 cups', '500g', '3 pieces')"
          }
        ]
      }
    }
  ],
  "edges": [
    {
      "id": "string (unique identifier)",
      "source": "string (node id)",
      "target": "string (node id)",
      "time": "string (time required before proceeding to next step, e.g., '30 minutes', '1 hour', '15 minutes', '2 hours')"
    }
  ],
  "nutritionalInfo": {
    "calories": number (total calories per serving),
    "protein": number (grams of protein per serving),
    "fat": number (grams of fat per serving),
    "carbohydrates": number (grams of carbohydrates per serving),
    "fiber": number (grams of fiber per serving, optional),
    "sugar": number (grams of sugar per serving, optional),
    "sodium": number (milligrams of sodium per serving, optional)
  }
}

Node Types:
- "ingredientNode": Create EXACTLY ONE node of this type. It should contain ALL ingredients from the recipe in the "ingredients" array. Each ingredient should have "name" and "quantity" fields. The label should be "Ingredients". Example data structure:
  {
    "label": "Ingredients",
    "ingredients": [
      { "name": "Carrots", "quantity": "2 pieces" },
      { "name": "Onions", "quantity": "1 large" },
      { "name": "Beef", "quantity": "500g" },
      { "name": "Salt", "quantity": "1 tsp" }
    ]
  }
- "blockNode": Use EXCLUSIVELY as the FIRST node of each parallel block. This node identifies and represents the entire block (e.g., "Sauté", "Broth", "Sauce", "Garnish"). It should have a descriptive name that summarizes what the block does. Do NOT use blockNode for regular steps - only as block headers.
- "preparationNode": Use for preparation steps (e.g., "Chop vegetables", "Marinate meat", "Mix ingredients")
- "cookingNode": Use for actual cooking steps (e.g., "Boil water", "Fry onions", "Simmer for 30 minutes", "Bake in oven")
- "servingNode": Use for final steps (e.g., "Serve hot", "Garnish", "Ready to serve")

DIAGRAM STRUCTURE - BLOCK-BASED APPROACH (CRITICAL):
For complex dishes, organize the recipe into separate, independent BLOCKS/PIPELINES. Each block represents a complete workflow for one component (e.g., "Sauté", "Broth", "Vegetables").

STRUCTURE RULES:
1. START: Create EXACTLY ONE "ingredientNode" with ALL ingredients. This is the root node.
2. BLOCK CREATION: From the ingredientNode, create separate edges DIRECTLY to the FIRST node of EACH parallel block. Each block should have a descriptive name as its first node (e.g., "Sauté", "Broth").
3. WITHIN BLOCKS: Each block is a self-contained sequential pipeline:
   - Nodes within a block connect sequentially: A → B → C → D
   - NO connections between nodes from different blocks
   - Each block flows independently from start to finish
4. BLOCK MERGING: All parallel blocks converge at a single MERGE node where they combine (e.g., "Add sauté to broth").
5. AFTER MERGE: After the merge point, continue with a normal sequential flow (one node after another).
6. NESTED BLOCKS: If needed after merging, you can create new parallel blocks again, following the same pattern.

EXAMPLE STRUCTURE (Borscht):
- ingredientNode (Ingredients) → branches directly to:
  * Block 1: blockNode "Sauté" → preparationNode "Prepare onions" → preparationNode "Prepare beets" → cookingNode "Sauté in pan"
  * Block 2: blockNode "Broth" → preparationNode "Prepare meat" → cookingNode "Cook meat in water" → preparationNode "Prepare potatoes" → cookingNode "Cook potatoes in broth"
- Both blocks merge at: cookingNode "Add sauté to broth"
- After merge: cookingNode "Further processes" → servingNode "Ready"

IMPORTANT: The first node of each parallel block MUST be a "blockNode" type. This visually identifies the block. Subsequent nodes within the block can be preparationNode, cookingNode, or other appropriate types.

KEY PRINCIPLES:
- ingredientNode connects DIRECTLY to the first node of each block (NO intermediate nodes like "Prepare products")
- Each block is completely independent - NO edges between different blocks
- Blocks only connect at merge points
- After merging, use normal sequential flow
- This creates clear visual separation: each block is a separate pipeline that can be followed independently

Rules:
- Create EXACTLY ONE "ingredientNode" with ALL ingredients from the recipe in the "ingredients" array
- From ingredientNode, create edges DIRECTLY to the FIRST node of EACH parallel block
- Each block's first node MUST be of type "blockNode" with a descriptive name representing the block (e.g., "Sauté", "Broth", "Sauce", "Garnish")
- After the blockNode, use appropriate node types (preparationNode, cookingNode, etc.) for subsequent steps within the block
- Within each block, connect nodes sequentially in a linear chain (A → B → C)
- Between parallel blocks, create ABSOLUTELY NO connections - they are completely independent pipelines
- All blocks converge at a merge node where they combine
- After the merge node, continue with sequential flow (or create new blocks if needed)
- Position nodes will be automatically calculated by the client, so you can use placeholder positions like { "x": 0, "y": 0 } for all nodes
- The client will arrange nodes in a hierarchical layout based on the edges, so focus on creating correct node connections rather than precise positioning
- Identify opportunities for parallelization: if one step takes a long time (like boiling, simmering, marinating) and another step can be done during that time, they should be separate parallel blocks
- Common parallel block scenarios:
  * Block 1: Main component cooking (broth, meat, etc.) - long process
  * Block 2: Side component preparation (sauté, vegetables, etc.) - can be done during Block 1
  * Block 3: Additional preparations (garnishes, sides, etc.)
- The time on edges leading to parallel blocks should reflect the actual time needed for each parallel task
- After parallel blocks, they converge into a single merge node that combines the results
- For each edge, include the "time" field indicating how long to wait before proceeding to the next step
- Time examples: "5 minutes", "10 minutes", "30 minutes", "1 hour", "2 hours", "overnight"
- If a step requires waiting (e.g., "bake for 1 hour", "marinate for 30 minutes", "let rest for 15 minutes"), include that time in the edge connecting to the next step
- If no waiting time is needed between steps, use empty string "" or omit the time field
- Make sure all node IDs in edges exist in nodes array
- Escape special characters in strings (quotes, newlines, etc.)
- Calculate and include nutritional information (nutritionalInfo) based on the ingredients and their quantities in the recipe
- Nutritional information should be calculated for the entire recipe (total servings). Include calories, protein, fat, carbohydrates as required fields. Optionally include fiber, sugar, and sodium if available
- Use reasonable estimates based on standard nutritional values for common ingredients
- Ensure the JSON is complete and valid - do not truncate it
- Return ONLY the JSON object, no additional text, no markdown formatting, no code blocks`;

		const userPrompt = `Convert this recipe into a flow diagram:\n\n${recipeText}`;

		const messages = [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt },
		];

		let response: string | undefined;
		try {
			// Используем прямой доступ к OpenAI клиенту для увеличения max_completion_tokens и использования JSON mode
			const openaiClient = (this.aiProvider as any).getClient?.();
			if (openaiClient) {
				const completion = await openaiClient.chat.completions.create({
					model: 'gpt-5.2-2025-12-11',
					messages: messages.map((msg) => ({
						role: msg.role as 'system' | 'user' | 'assistant',
						content: msg.content,
					})),
					temperature: 0.3,
					max_completion_tokens: 4000,
					response_format: { type: 'json_object' },
				});
				response = completion.choices[0]?.message?.content;
			} else {
				// Fallback на стандартный метод
				response = await this.aiProvider.chat(messages, 'gpt-5.2-2025-12-11');
			}
			
			if (!response) {
				throw new Error('Empty response from AI');
			}
			
			// Парсим JSON из ответа (может быть обернут в markdown код)
			let jsonString = response.trim();
			
			// Убираем markdown код блоки если есть
			if (jsonString.startsWith('```json')) {
				jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
			} else if (jsonString.startsWith('```')) {
				jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
			}

			// Пытаемся найти JSON объект в ответе, даже если он обрезан
			let flowData: RecipeFlowResponseDto;
			try {
				flowData = JSON.parse(jsonString);
			} catch (parseError) {
				// Если парсинг не удался, пытаемся найти JSON объект в тексте
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

			// Валидация структуры
			if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
				throw new Error('Invalid response: nodes array is missing or invalid');
			}
			if (!flowData.edges || !Array.isArray(flowData.edges)) {
				throw new Error('Invalid response: edges array is missing or invalid');
			}

			// Валидация узлов
			for (const node of flowData.nodes) {
				if (!node.id || !node.type || !node.position || !node.data) {
					throw new Error(`Invalid node structure: ${JSON.stringify(node)}`);
				}
				if (!node.data.label) {
					throw new Error(`Node ${node.id} is missing label`);
				}
			}

			// Валидация связей
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

