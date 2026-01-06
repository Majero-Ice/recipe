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
 * Пищевая ценность блюда
 */
export interface NutritionalInfo {
	/**
	 * Калории на порцию
	 */
	calories: number;

	/**
	 * Белки в граммах на порцию
	 */
	protein: number;

	/**
	 * Жиры в граммах на порцию
	 */
	fat: number;

	/**
	 * Углеводы в граммах на порцию
	 */
	carbohydrates: number;

	/**
	 * Клетчатка в граммах на порцию (опционально)
	 */
	fiber?: number;

	/**
	 * Сахар в граммах на порцию (опционально)
	 */
	sugar?: number;

	/**
	 * Натрий в миллиграммах на порцию (опционально)
	 */
	sodium?: number;
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

	/**
	 * Пищевая ценность блюда
	 */
	nutritionalInfo?: NutritionalInfo;
}




