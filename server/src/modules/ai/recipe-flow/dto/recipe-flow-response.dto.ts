/**
 * Узел для flow-диаграммы
 */
export interface FlowNode {
	id: string;
	type: string;
	position: {
		x: number;
		y: number;
	};
	data: {
		label: string;
		description?: string;
		[key: string]: any;
	};
}

/**
 * Связь между узлами
 */
export interface FlowEdge {
	id: string;
	source: string;
	target: string;
	label?: string;
	time?: string;
	type?: string;
	[key: string]: any;
}

/**
 * DTO для ответа с flow-диаграммой
 */
export interface RecipeFlowResponseDto {
	/**
	 * Узлы диаграммы
	 */
	nodes: FlowNode[];

	/**
	 * Связи между узлами
	 */
	edges: FlowEdge[];
}




