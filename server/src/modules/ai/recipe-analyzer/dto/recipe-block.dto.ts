/**
 * Типы блоков рецепта, соответствующие типам узлов диаграммы
 */
export enum RecipeBlockType {
	INGREDIENTS = 'ingredients',
	PREPARATION = 'preparation',
	COOKING = 'cooking',
	SERVING = 'serving',
}

/**
 * Блок рецепта
 */
export interface RecipeBlockDto {
	/**
	 * Тип блока
	 */
	type: RecipeBlockType;

	/**
	 * Заголовок блока
	 */
	title: string;

	/**
	 * Содержимое блока
	 */
	content: string;
}

/**
 * Структурированный рецепт
 */
export interface StructuredRecipeDto {
	/**
	 * Является ли сообщение рецептом
	 */
	isRecipe: boolean;

	/**
	 * Оригинальное сообщение
	 */
	originalMessage: string;

	/**
	 * Структурированные блоки рецепта
	 */
	blocks: RecipeBlockDto[];
}

