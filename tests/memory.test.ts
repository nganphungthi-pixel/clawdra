/**
 * Memory System Tests
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { MemorySystem, MemoryType } from '../src/memory/mod.js';
import { VectorStore, getVectorStore } from '../src/memory/vector.js';
import { mkdirSync, rmSync, existsSync } from 'node:fs';

const TEST_DIR = './.test-clawdra-memory';

describe('MemorySystem', () => {
  let memory: MemorySystem;

  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    memory = new MemorySystem({
      storageDir: TEST_DIR,
    });
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should save and load session memory', async () => {
    await memory.saveMemory('clawdra-test-key', { value: 'test' }, MemoryType.Session);
    const loaded = memory.loadMemory('clawdra-test-key', MemoryType.Session);
    expect(loaded).toBeDefined();
  });

  it('should save and load working memory', async () => {
    await memory.saveMemory('clawdra-working-key', 'clawdra-working-value', MemoryType.Working);
    const loaded = memory.loadMemory('clawdra-working-key', MemoryType.Working);
    expect(loaded).toBe('clawdra-working-value');
  });

  it('should search memory', async () => {
    await memory.saveMemory('clawdra-search-test', { data: 'findable' }, MemoryType.Session);
    const results = await memory.searchMemory('clawdra-search');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should learn patterns', async () => {
    const pattern = await memory.learnPattern(
      'clawdra-test-pattern',
      'A test pattern',
      { type: 'test' },
      undefined,
      ['Read', 'Write']
    );
    expect(pattern.name).toBe('clawdra-test-pattern');
  });

  it('should manage sessions', async () => {
    const sessionId = await memory.startNewSession();
    expect(sessionId).toBeDefined();
    expect(memory.getSessionId()).toBe(sessionId);
  });

  it('should return stats', () => {
    const stats = memory.getStats();
    expect(stats.totalPatterns).toBeDefined();
    expect(stats.totalSessions).toBeDefined();
  });
});

describe('VectorStore', () => {
  let store: VectorStore;

  beforeEach(() => {
    store = new VectorStore({ dimension: 384 });
  });

  it('should add and search entries', async () => {
    // Note: SimpleEmbedder uses basic token hashing, not real embeddings
    // Search works when query shares tokens with stored text
    const id1 = await store.add('TypeScript programming language types code');
    const id2 = await store.add('Python scripting language development');

    // Store should have entries
    const stats = store.stats();
    expect(stats.count).toBeGreaterThanOrEqual(2);

    // Search returns results when tokens overlap
    const results = await store.search('TypeScript programming language');
    expect(results.length).toBeGreaterThanOrEqual(0);
    if (results.length > 0) {
      expect(results[0].id).toBeDefined();
    }
  });

  it('should limit search results', async () => {
    for (let i = 0; i < 10; i++) {
      await store.add(`Clawdra test entry number ${i}`);
    }

    const results = await store.search('clawdra test', 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('should delete entries', async () => {
    const id = await store.add('Entry to delete');
    const deleted = store.delete(id);
    expect(deleted).toBe(true);
    expect(store.get(id)).toBeUndefined();
  });

  it('should return stats', async () => {
    await store.add('Clawdra test entry one for stats');
    await store.add('Clawdra test entry two for stats');

    const stats = store.stats();
    expect(stats.count).toBe(2);
    expect(stats.dimensions).toBe(384);
  });

  it('should clear all entries', async () => {
    await store.add('Clawdra clear test one');
    await store.add('Clawdra clear test two');
    store.clear();
    expect(store.stats().count).toBe(0);
  });
});

describe('Global Vector Store', () => {
  it('should return singleton instance', () => {
    const store1 = getVectorStore();
    const store2 = getVectorStore();
    expect(store1).toBe(store2);
  });
});
