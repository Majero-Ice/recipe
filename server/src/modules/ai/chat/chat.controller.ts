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
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatResponseDto } from './dto/chat-response.dto';


@Controller('chat')
export class ChatController {
	constructor(private readonly chatService: ChatService) {}

	
	@Post('message')
	@HttpCode(HttpStatus.OK)
	async sendMessage(@Body() request: ChatRequestDto): Promise<ChatResponseDto> {
		if (!request.message || request.message.trim().length === 0) {
			throw new BadRequestException('Message is required and cannot be empty');
		}

		return this.chatService.chat(request);
	}

	@Post('message/stream')
	async streamMessage(
		@Body() request: ChatRequestDto,
		@Res() res: Response,
	): Promise<void> {
		if (!request.message || request.message.trim().length === 0) {
			throw new BadRequestException('Message is required and cannot be empty');
		}

		res.setHeader('Content-Type', 'text/event-stream');
		res.setHeader('Cache-Control', 'no-cache');
		res.setHeader('Connection', 'keep-alive');
		res.setHeader('X-Accel-Buffering', 'no');
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

		try {
			for await (const item of this.chatService.chatStream(request)) {
				if (item.type === 'chunk') {
					res.write(`data: ${JSON.stringify({ chunk: item.data })}\n\n`);
				} else if (item.type === 'block') {
					res.write(`data: ${JSON.stringify({ block: item.data })}\n\n`);
				} else if (item.type === 'recipe') {
					res.write(`data: ${JSON.stringify({ recipe: item.data })}\n\n`);
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


