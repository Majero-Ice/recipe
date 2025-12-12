/**
 * DTO для запроса генерации flow-диаграммы из рецепта
 */
export class RecipeFlowRequestDto {
	/**
	 * Текстовый вариант кухонного рецепта
	 */
	recipe: string;

	/**
	 * Опционально: можно запросить рецепт через chat, передав сообщение
	 */
	message?: string;
}




