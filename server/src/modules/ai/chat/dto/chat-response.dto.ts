import { StructuredRecipeDto } from '../../recipe-analyzer/dto/recipe-block.dto';

/**
 * DTO для ответа чата
 */
export interface ChatResponseDto {
	/**
	 * Ответ ассистента
	 */
	message: string;

	/**
	 * Модель, использованная для генерации ответа
	 */
	model: string;

	/**
	 * Структурированный рецепт (если сообщение является рецептом)
	 */
	recipe?: StructuredRecipeDto;
}


