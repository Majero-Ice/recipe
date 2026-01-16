export class ChatRequestDto {
	message: string;

	history?: Array<{ role: string; content: string }>;
}

