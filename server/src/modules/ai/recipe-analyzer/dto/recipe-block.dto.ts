export enum RecipeBlockType {
	INGREDIENTS = 'ingredients',
	PREPARATION = 'preparation',
	COOKING = 'cooking',
	SERVING = 'serving',
}

export interface RecipeBlockDto {
	type: RecipeBlockType;

	title: string;

	content: string;
}

export interface StructuredRecipeDto {
	isRecipe: boolean;

	originalMessage: string;

	blocks: RecipeBlockDto[];
}

