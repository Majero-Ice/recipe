
export interface AiProvider {
	
	getName(): string;

	isAvailable(): Promise<boolean>;
}


export interface ChatProvider extends AiProvider {
	
	chat(messages: Array<{ role: string; content: string }>, model?: string): Promise<string>;
	
	/**
	 * Streams chat responses chunk by chunk
	 * @param messages Array of messages
	 * @param model Model name (optional)
	 * @param useJsonMode Whether to use JSON mode for structured responses
	 * @returns Async generator that yields response chunks
	 */
	chatStream(
		messages: Array<{ role: string; content: string }>,
		model?: string,
		useJsonMode?: boolean,
	): AsyncGenerator<string, void, unknown>;
}


export interface CompletionProvider extends AiProvider {
	
	complete(prompt: string, model?: string): Promise<string>;
}
