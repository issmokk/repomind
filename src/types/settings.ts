export type EmbeddingProvider = 'ollama' | 'openai';

export type TeamSettings = {
  teamId: string;
  embeddingProvider: EmbeddingProvider;
  ollamaBaseUrl: string | null;
  ollamaModel: string | null;
  openaiModel: string | null;
};
