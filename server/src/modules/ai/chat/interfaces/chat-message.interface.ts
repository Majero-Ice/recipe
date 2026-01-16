export enum ChatRole {
	USER = 'user',
	ASSISTANT = 'assistant',
	SYSTEM = 'system',
}

export interface ChatMessage {
	role: ChatRole;
	content: string;
}


