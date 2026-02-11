import { describe, test, expect, mock, beforeEach, spyOn } from 'bun:test';
import { createSuccessResult, createErrorResult } from '../../../helpers/mock-agent-sdk.js';

describe('role-body-generator', () => {
  let warnSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    mock.restore();
    warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
  });

  test('成功時: query が成功結果を返す → 生成テキストを返す', async () => {
    const generatedText = '  You are a **linter** role.\n\n## Responsibilities\n\n- Lint all code  ';
    const successResult = createSuccessResult({ result: generatedText });

    mock.module('@anthropic-ai/claude-agent-sdk', () => ({
      query: () => ({
        async *[Symbol.asyncIterator]() {
          yield successResult;
        },
        interrupt: mock(() => Promise.resolve()),
      }),
    }));

    const { generateRoleBody, FALLBACK_BODY } = await import(
      '../../../../src/cli/generators/role-body-generator.js'
    );

    const result = await generateRoleBody({
      frontmatter: {
        name: 'linter',
        interval: 300,
        maxTurns: 50,
        permissionMode: 'acceptEdits',
      },
    });

    expect(result).toBe(generatedText.trim());
    expect(result).not.toBe(FALLBACK_BODY('linter'));
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('APIエラー: query がエラー結果を返す → フォールバックを返し console.warn が呼ばれる', async () => {
    const errorResult = createErrorResult(['API rate limit exceeded']);

    mock.module('@anthropic-ai/claude-agent-sdk', () => ({
      query: () => ({
        async *[Symbol.asyncIterator]() {
          yield errorResult;
        },
        interrupt: mock(() => Promise.resolve()),
      }),
    }));

    const { generateRoleBody, FALLBACK_BODY } = await import(
      '../../../../src/cli/generators/role-body-generator.js'
    );

    const result = await generateRoleBody({
      frontmatter: {
        name: 'reviewer',
        interval: 300,
        maxTurns: 50,
        permissionMode: 'acceptEdits',
      },
    });

    expect(result).toBe(FALLBACK_BODY('reviewer'));
    expect(warnSpy).toHaveBeenCalled();
  });

  test('query が例外を投げる → フォールバックを返し console.warn が呼ばれる', async () => {
    mock.module('@anthropic-ai/claude-agent-sdk', () => ({
      query: () => {
        throw new Error('Network failure');
      },
    }));

    const { generateRoleBody, FALLBACK_BODY } = await import(
      '../../../../src/cli/generators/role-body-generator.js'
    );

    const result = await generateRoleBody({
      frontmatter: {
        name: 'fixer',
        interval: 300,
        maxTurns: 50,
        permissionMode: 'acceptEdits',
      },
    });

    expect(result).toBe(FALLBACK_BODY('fixer'));
    expect(warnSpy).toHaveBeenCalled();
  });
});
