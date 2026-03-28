export type RepositoryStatus = 'pending' | 'indexing' | 'indexed' | 'error';

export type Repository = {
  id: string;
  name: string;
  url: string;
  teamId: string;
  status: RepositoryStatus;
  lastIndexedAt: string | null;
  createdAt: string;
};

export type Chunk = {
  id: string;
  repositoryId: string;
  filePath: string;
  content: string;
  language: string;
  startLine: number;
  endLine: number;
  nodeType: string;
};

export type Embedding = {
  id: string;
  chunkId: string;
  vector: number[];
  model: string;
  createdAt: string;
};

export type GraphNode = {
  id: string;
  repositoryId: string;
  name: string;
  nodeType: string;
  filePath: string;
  metadata: Record<string, unknown>;
};
