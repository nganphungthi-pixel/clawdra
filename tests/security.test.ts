/**
 * Security Scanner Tests
 */
import { describe, it, expect } from 'vitest';
import { SecurityScanner } from '../src/security/mod.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

describe('SecurityScanner', () => {
  it('should scan directory and return report', async () => {
    const scanner = new SecurityScanner();
    const report = await scanner.scanDirectory('src');
    expect(report.filesScanned).toBeGreaterThan(0);
    expect(report.vulns).toBeDefined();
    expect(report.bySeverity).toBeDefined();
  });

  it('should detect SQL injection patterns', async () => {
    const testDir = join(tmpdir(), 'clawdra-sql-test');
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'test.ts'), `
      query("SELECT * FROM users WHERE id = " + userId);
    `);

    const scanner = new SecurityScanner();
    const report = await scanner.scanDirectory(testDir);

    expect(report.totalVulns).toBeGreaterThan(0);
  });

  it('should detect hardcoded secrets', async () => {
    const testDir = join(tmpdir(), 'clawdra-secret-test');
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'config.ts'), `
      const API_KEY = "sk-test-1234567890abcdef";
      const PASSWORD = "supersecret123";
    `);

    const scanner = new SecurityScanner();
    const report = await scanner.scanDirectory(testDir);

    const secretVulns = report.vulns.filter(v => v.category === 'Hardcoded Secret');
    expect(secretVulns.length).toBeGreaterThan(0);
  });

  it('should detect XSS patterns', async () => {
    const testDir = join(tmpdir(), 'clawdra-xss-test');
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'app.tsx'), `
      element.innerHTML = userInput;
      return <div dangerouslySetInnerHTML={{ __html: content }} />;
    `);

    const scanner = new SecurityScanner();
    const report = await scanner.scanDirectory(testDir);

    const xssVulns = report.vulns.filter(v => v.category === 'XSS');
    expect(xssVulns.length).toBeGreaterThan(0);
  });

  it('should handle empty directory', async () => {
    const testDir = join(tmpdir(), 'clawdra-empty-test');
    mkdirSync(testDir, { recursive: true });

    const scanner = new SecurityScanner();
    const report = await scanner.scanDirectory(testDir, ['.ts']);

    expect(report.filesScanned).toBe(0);
    expect(report.totalVulns).toBe(0);
  });
});
