import {
	Controller,
	Post,
	Body,
	HttpCode,
	HttpStatus,
	BadRequestException,
	Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { RecipeFlowService } from './recipe-flow.service';
import { RecipeFlowRequestDto } from './dto/recipe-flow-request.dto';
import { RecipeFlowResponseDto } from './dto/recipe-flow-response.dto';

@Controller('recipe-flow')
export class RecipeFlowController {
	constructor(private readonly recipeFlowService: RecipeFlowService) {}

	@Post('generate')
	@HttpCode(HttpStatus.OK)
	async generateFlow(
		@Body() request: RecipeFlowRequestDto,
	): Promise<RecipeFlowResponseDto> {
		if (!request.recipe && !request.message) {
			throw new BadRequestException('Either recipe or message must be provided');
		}

		return this.recipeFlowService.generateFlow(request);
	}

	/**
	 * Streaming endpoint for flow diagram generation using Server-Sent Events (SSE)
	 */
	@Post('generate/stream')
	async streamFlow(
		@Body() request: RecipeFlowRequestDto,
		@Res() res: Response,
	): Promise<void> {
		if (!request.recipe && !request.message) {
			throw new BadRequestException('Either recipe or message must be provided');
		}

		// Set headers for SSE
		res.setHeader('Content-Type', 'text/event-stream');
		res.setHeader('Cache-Control', 'no-cache');
		res.setHeader('Connection', 'keep-alive');
		res.setHeader('X-Accel-Buffering', 'no');
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

		try {
			// Get recipe text first
			let recipeText: string;
			if (request.recipe) {
				recipeText = request.recipe;
			} else if (request.message) {
				recipeText = await this.recipeFlowService.getRecipeFromMessage(request.message);
			} else {
				throw new BadRequestException('Either recipe or message must be provided');
			}

			if (!recipeText || recipeText.trim().length === 0) {
				throw new BadRequestException('Recipe text cannot be empty');
			}

			// Stream flow generation
			for await (const item of this.recipeFlowService.generateFlowStream(recipeText)) {
				if (item.type === 'node') {
					res.write(`data: ${JSON.stringify({ node: item.data })}\n\n`);
				} else if (item.type === 'edge') {
					res.write(`data: ${JSON.stringify({ edge: item.data })}\n\n`);
				} else if (item.type === 'complete') {
					res.write(`data: ${JSON.stringify({ complete: item.data })}\n\n`);
				}
			}
			res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
			res.end();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
			res.end();
		}
	}
}




