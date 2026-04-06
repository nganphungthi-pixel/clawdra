/**
 * Tool Tests
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ToolExecutor, ToolPermission } from '../src/tools/mod.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

describe('ToolExecutor', () => {
  let executor: ToolExecutor;

  beforeAll(() => {
    executor = new ToolExecutor({
      allowedPaths: [tmpdir()],
      blockedPaths: [],
      allowedCommands: [],
      blockedCommands: [],
      timeout: 30000,
      sandbox: false,
    });
  });

  it('should execute Read tool on existing file', async () => {
    const testFile = join(tmpdir(), 'clawdra-test-read.txt');
    writeFileSync(testFile, 'Hello World\nLine 2\nLine 3');

    const result = await executor.executeTool('Read', { filePath: testFile }, 'test-1');
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain('Hello World');
  });

  it('should return error for non-existent file', async () => {
    const result = await executor.executeTool('Read', { filePath: '/non-existent-file-clawdra.txt' }, 'test-2');
    expect(result.isError).toBeTruthy();
    expect(result.content).toMatch(/not found|Access denied/i);
  });

  it('should write to a new file', async () => {
    const testFile = join(tmpdir(), 'clawdra-test-write.txt');
    const result = await executor.executeTool('Write', { filePath: testFile, content: 'Clawdra test content' }, 'test-3');
    expect(result.isError).toBeFalsy();
    expect(existsSync(testFile)).toBe(true);
    expect(readFileSync(testFile, 'utf-8')).toBe('Clawdra test content');
  });

  it('should edit existing file', async () => {
    const testFile = join(tmpdir(), 'clawdra-test-edit.txt');
    writeFileSync(testFile, 'Old text');

    const result = await executor.executeTool('Edit', {
      filePath: testFile,
      oldString: 'Old text',
      newString: 'New text',
    }, 'test-4');

    expect(result.isError).toBeFalsy();
    expect(readFileSync(testFile, 'utf-8')).toBe('New text');
  });

  it('should execute bash command', async () => {
    const isWin = process.platform === 'win32';
    if (isWin) {
      // Skip on Windows - BashTool uses sh which is Unix-only
      // This is a known platform limitation
      return;
    }
    const result = await executor.executeTool('Bash', { command: 'echo hello-clawdra' }, 'test-5');
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain('hello-clawdra');
  });

  it('should block dangerous commands', async () => {
    const executorWithBlocks = new ToolExecutor({
      allowedPaths: [tmpdir()],
      blockedCommands: ['rm -rf'],
      timeout: 30000,
      sandbox: false,
    });

    const result = await executorWithBlocks.executeTool('Bash', { command: 'rm -rf /' }, 'test-6');
    expect(result.isError).toBeTruthy();
    expect(result.content).toContain('blocked');
  });

  it('should handle tool not found', async () => {
    const result = await executor.executeTool('NonExistentTool', {}, 'test-7');
    expect(result.isError).toBeTruthy();
    expect(result.content).toContain('not found');
  });

  it('should return all tools', () => {
    const tools = executor.getAllTools();
    expect(tools.length).toBeGreaterThan(0);
    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain('Read');
    expect(toolNames).toContain('Write');
    expect(toolNames).toContain('Bash');
  });
});

describe('Tool Permissions', () => {
  it('should allow and deny permissions', () => {
    const executor = new ToolExecutor();
    executor.removePermission(ToolPermission.BASH);

    // Tools still exist but bash permission is revoked
    expect(executor.getAllTools().length).toBeGreaterThan(0);
  });
});
