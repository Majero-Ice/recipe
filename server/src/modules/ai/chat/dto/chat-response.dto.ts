import { StructuredRecipeDto } from '../../recipe-analyzer/dto/recipe-block.dto';

export interface ChatResponseDto {
	message: string;

	model: string;

	recipe?: StructuredRecipeDto;
}


