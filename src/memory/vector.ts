/**
 * Vector Store for Semantic Memory
 * Inspired by OpenClaw's memory-lancedb and MetaGPT's embedding system
 * Pure TypeScript implementation using cosine similarity
 */

export interface VectorEntry {
  id: string;
  vector: number[];
  text: string;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  text: string;
  metadata: Record<string, unknown>;
}

export interface VectorStoreConfig {
  dimension: number;
  maxEntries?: number;
  similarityThreshold?: number;
}

const DEFAULT_CONFIG: Required<VectorStoreConfig> = {
  dimension: 384, // MiniLM embedding dimension
  maxEntries: 10000,
  similarityThreshold: 0.7,
};

/**
 * Simple text embedding using TF-IDF inspired approach
 * In production, replace with actual embedding API (OpenAI, Ollama, etc.)
 */
export class SimpleEmbedder {
  private vocabulary: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();
  private documentCount = 0;

  async embed(text: string): Promise<number[]> {
    const tokens = this.tokenize(text);
    const vector = new Array(384).fill(0);

    // Hash tokens to vector dimensions
    for (const token of tokens) {
      const hash = this.hashToken(token);
      const idx = hash % 384;
      vector[idx] += 1;
    }

    // Normalize
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < 384; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }

  private hashToken(token: string): number {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export class VectorStore {
  private entries: Map<string, VectorEntry> = new Map();
  private embedder: SimpleEmbedder;
  private config: Required<VectorStoreConfig>;

  constructor(config?: VectorStoreConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.embedder = new SimpleEmbedder();
  }

  /**
   * Add entry with automatic embedding
   */
  async add(text: string, metadata: Record<string, unknown> = {}): Promise<string> {
    const id = crypto.randomUUID();
    const vector = await this.embedder.embed(text);

    // Check for duplicates
    if (this.entries.size > 0) {
      const similar = await this.search(text, 1);
      if (similar.length > 0 && similar[0].score > 0.95) {
        return similar[0].id; // Return existing ID if duplicate
      }
    }

    // Enforce max entries
    if (this.entries.size >= this.config.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey) {
        this.entries.delete(oldestKey);
      }
    }

    const entry: VectorEntry = {
      id,
      vector,
      text,
      metadata,
      createdAt: Date.now(),
    };

    this.entries.set(id, entry);
    return id;
  }

  /**
   * Search for similar entries
   */
  async search(query: string, limit: number = 10): Promise<VectorSearchResult[]> {
    const queryVector = await this.embedder.embed(query);
    const results: VectorSearchResult[] = [];

    for (const entry of this.entries.values()) {
      const score = cosineSimilarity(queryVector, entry.vector);
      if (score >= this.config.similarityThreshold) {
        results.push({
          id: entry.id,
          score,
          text: entry.text,
          metadata: entry.metadata,
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get entry by ID
   */
  get(id: string): VectorEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Delete entry
   */
  delete(id: string): boolean {
    return this.entries.delete(id);
  }

  /**
   * Get all entries
   */
  getAll(): VectorEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Get statistics
   */
  stats(): { count: number; dimensions: number } {
    return {
      count: this.entries.size,
      dimensions: this.config.dimension,
    };
  }
}

// Global vector store instance
let globalVectorStore: VectorStore | null = null;

export function getVectorStore(): VectorStore {
  if (!globalVectorStore) {
    globalVectorStore = new VectorStore();
  }
  return globalVectorStore;
}
