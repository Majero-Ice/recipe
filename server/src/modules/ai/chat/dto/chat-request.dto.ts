/**
 * DTO для запроса чата
 */
export class ChatRequestDto {
	/**
	 * Сообщение пользователя
	 */
	message: string;

	/**
	 * История сообщений для контекста разговора
	 */
	history?: Array<{ role: string; content: string }>;
}

