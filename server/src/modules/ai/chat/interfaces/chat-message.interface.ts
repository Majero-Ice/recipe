/**
 * Роль участника чата
 */
export enum ChatRole {
	USER = 'user',
	ASSISTANT = 'assistant',
	SYSTEM = 'system',
}

/**
 * Сообщение в чате
 */
export interface ChatMessage {
	role: ChatRole;
	content: string;
}


