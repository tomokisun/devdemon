import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { mockQuery, createSuccessResult, createErrorResult } from '../../helpers/mock-agent-sdk.js';
import { createTestRole } from '../../helpers/test-role-factory.js';

describe('Agent', () => {
  beforeEach(() => {
    mock.restore();
  });

  describe('execute()', () => {
    test('query()に正しいオプションを渡す（cwd, systemPrompt, allowedTools等）', async () => {
      const successResult = createSuccessResult();
      let capturedArgs: any = null;

      mock.module('@anthropic-ai/claude-agent-sdk', () => ({
        query: (...args: any[]) => {
          capturedArgs = args[0];
          return {
            async *[Symbol.asyncIterator]() {
              yield successResult;
            },
            interrupt: mock(() => Promise.resolve()),
          };
        },
      }));

      const { Agent } = await import('../../../src/agent/agent.js');
      const agent = new Agent('/test/repo', {});
      const role = createTestRole({
        frontmatter: { tools: ['Read', 'Edit'], maxTurns: 10, permissionMode: 'bypassPermissions' },
        body: 'Custom system prompt.',
      });

      await agent.execute('Do something', role);

      expect(capturedArgs).not.toBeNull();
      expect(capturedArgs.prompt).toBe('Do something');
      expect(capturedArgs.options.cwd).toBe('/test/repo');
    });

    test('systemPromptにrole.bodyがappendされる', async () => {
      const successResult = createSuccessResult();
      let capturedArgs: any = null;

      mock.module('@anthropic-ai/claude-agent-sdk', () => ({
        query: (...args: any[]) => {
          capturedArgs = args[0];
          return {
            async *[Symbol.asyncIterator]() {
              yield successResult;
            },
            interrupt: mock(() => Promise.resolve()),
          };
        },
      }));

      const { Agent } = await import('../../../src/agent/agent.js');
      const agent = new Agent('/test/repo', {});
      const role = createTestRole({ body: 'You are a code reviewer.' });

      await agent.execute('Review code', role);

      expect(capturedArgs.options.systemPrompt).toEqual({
        type: 'preset',
        preset: 'claude_code',
        append: 'You are a code reviewer.',
      });
    });

    test('allowedToolsがrole.frontmatter.toolsと一致する', async () => {
      const successResult = createSuccessResult();
      let capturedArgs: any = null;

      mock.module('@anthropic-ai/claude-agent-sdk', () => ({
        query: (...args: any[]) => {
          capturedArgs = args[0];
          return {
            async *[Symbol.asyncIterator]() {
              yield successResult;
            },
            interrupt: mock(() => Promise.resolve()),
          };
        },
      }));

      const { Agent } = await import('../../../src/agent/agent.js');
      const agent = new Agent('/test/repo', {});
      const tools = ['Read', 'Write', 'Bash'];
      const role = createTestRole({ frontmatter: { tools } });

      await agent.execute('Do work', role);

      expect(capturedArgs.options.allowedTools).toEqual(tools);
    });

    test('maxTurnsがrole.frontmatter.maxTurnsと一致する', async () => {
      const successResult = createSuccessResult();
      let capturedArgs: any = null;

      mock.module('@anthropic-ai/claude-agent-sdk', () => ({
        query: (...args: any[]) => {
          capturedArgs = args[0];
          return {
            async *[Symbol.asyncIterator]() {
              yield successResult;
            },
            interrupt: mock(() => Promise.resolve()),
          };
        },
      }));

      const { Agent } = await import('../../../src/agent/agent.js');
      const agent = new Agent('/test/repo', {});
      const role = createTestRole({ frontmatter: { maxTurns: 42 } });

      await agent.execute('Do work', role);

      expect(capturedArgs.options.maxTurns).toBe(42);
    });

    test('各SDKMessageに対してmessageイベントをemitする', async () => {
      const messages = [
        { type: 'assistant', content: 'Working on it...' },
        { type: 'tool_use', name: 'Read', input: {} },
        createSuccessResult(),
      ];

      mock.module('@anthropic-ai/claude-agent-sdk', () => ({
        query: () => ({
          async *[Symbol.asyncIterator]() {
            for (const msg of messages) yield msg;
          },
          interrupt: mock(() => Promise.resolve()),
        }),
      }));

      const { Agent } = await import('../../../src/agent/agent.js');
      const agent = new Agent('/test/repo', {});
      const role = createTestRole();
      const emitted: any[] = [];

      agent.on('message', (msg: any) => emitted.push(msg));
      await agent.execute('Do something', role);

      expect(emitted).toHaveLength(3);
      expect(emitted[0]).toEqual(messages[0]);
      expect(emitted[1]).toEqual(messages[1]);
      expect(emitted[2]).toEqual(messages[2]);
    });

    test('成功時にAgentResult.success=trueを返す', async () => {
      mockQuery([createSuccessResult()]);

      const { Agent } = await import('../../../src/agent/agent.js');
      const agent = new Agent('/test/repo', {});
      const role = createTestRole();

      const result = await agent.execute('Do something', role);

      expect(result.success).toBe(true);
      expect(result.result).toBe('Task completed successfully.');
      expect(result.errors).toEqual([]);
    });

    test('エラー時にAgentResult.success=falseを返す', async () => {
      mockQuery([createErrorResult(['Error 1', 'Error 2'])]);

      const { Agent } = await import('../../../src/agent/agent.js');
      const agent = new Agent('/test/repo', {});
      const role = createTestRole();

      const result = await agent.execute('Do something', role);

      expect(result.success).toBe(false);
      expect(result.result).toBeNull();
      expect(result.errors).toEqual(['Error 1', 'Error 2']);
    });

    test('costUsdが結果に含まれる', async () => {
      mockQuery([createSuccessResult({ total_cost_usd: 0.123 })]);

      const { Agent } = await import('../../../src/agent/agent.js');
      const agent = new Agent('/test/repo', {});
      const role = createTestRole();

      const result = await agent.execute('Do something', role);

      expect(result.costUsd).toBe(0.123);
    });

    test('numTurnsが結果に含まれる', async () => {
      mockQuery([createSuccessResult({ num_turns: 7 })]);

      const { Agent } = await import('../../../src/agent/agent.js');
      const agent = new Agent('/test/repo', {});
      const role = createTestRole();

      const result = await agent.execute('Do something', role);

      expect(result.numTurns).toBe(7);
    });

    test('durationMsが正しく計算される（> 0）', async () => {
      // Add a small delay to ensure duration > 0
      const delayedResult = createSuccessResult();
      mock.module('@anthropic-ai/claude-agent-sdk', () => ({
        query: () => ({
          async *[Symbol.asyncIterator]() {
            await new Promise(resolve => setTimeout(resolve, 10));
            yield delayedResult;
          },
          interrupt: mock(() => Promise.resolve()),
        }),
      }));

      const { Agent } = await import('../../../src/agent/agent.js');
      const agent = new Agent('/test/repo', {});
      const role = createTestRole();

      const result = await agent.execute('Do something', role);

      expect(result.durationMs).toBeGreaterThan(0);
    });

    test('settings.modelが設定されている場合、queryオプションにmodelを渡す', async () => {
      const successResult = createSuccessResult();
      let capturedArgs: any = null;

      mock.module('@anthropic-ai/claude-agent-sdk', () => ({
        query: (...args: any[]) => {
          capturedArgs = args[0];
          return {
            async *[Symbol.asyncIterator]() {
              yield successResult;
            },
            interrupt: mock(() => Promise.resolve()),
          };
        },
      }));

      const { Agent } = await import('../../../src/agent/agent.js');
      const agent = new Agent('/test/repo', { model: 'claude-sonnet-4-5-20250929' });
      const role = createTestRole();

      await agent.execute('Do something', role);

      expect(capturedArgs).not.toBeNull();
      // settings.model should be used when provided
      expect(capturedArgs.options.model).toBe('claude-sonnet-4-5-20250929');
    });

    test('settings.languageが設定されている場合、systemPromptにlanguage指示を追加する', async () => {
      const successResult = createSuccessResult();
      let capturedArgs: any = null;

      mock.module('@anthropic-ai/claude-agent-sdk', () => ({
        query: (...args: any[]) => {
          capturedArgs = args[0];
          return {
            async *[Symbol.asyncIterator]() {
              yield successResult;
            },
            interrupt: mock(() => Promise.resolve()),
          };
        },
      }));

      const { Agent } = await import('../../../src/agent/agent.js');
      const agent = new Agent('/test/repo', { language: 'Japanese' });
      const role = createTestRole({ body: 'You are a test role.' });

      await agent.execute('Do something', role);

      expect(capturedArgs).not.toBeNull();
      expect(capturedArgs.options.systemPrompt.append).toContain('Japanese');
      expect(capturedArgs.options.systemPrompt.append).toContain('You are a test role.');
    });

    test('settingsが空の場合、modelオプションを渡さない', async () => {
      const successResult = createSuccessResult();
      let capturedArgs: any = null;

      mock.module('@anthropic-ai/claude-agent-sdk', () => ({
        query: (...args: any[]) => {
          capturedArgs = args[0];
          return {
            async *[Symbol.asyncIterator]() {
              yield successResult;
            },
            interrupt: mock(() => Promise.resolve()),
          };
        },
      }));

      const { Agent } = await import('../../../src/agent/agent.js');
      const agent = new Agent('/test/repo', {});
      const role = createTestRole();

      await agent.execute('Do something', role);

      expect(capturedArgs).not.toBeNull();
      // When settings.model is not set, the default model should be used
      expect(capturedArgs.options.model).toBe('claude-opus-4-20250514');
    });

  });

  describe('interrupt()', () => {
    test('currentQuery.interrupt()を呼び出す', async () => {
      const interruptMock = mock(() => Promise.resolve());
      let resolveIterator: { fn: (() => void) | null } = { fn: null };

      mock.module('@anthropic-ai/claude-agent-sdk', () => ({
        query: () => ({
          async *[Symbol.asyncIterator]() {
            // Block until interrupt is called
            await new Promise<void>(resolve => {
              resolveIterator.fn = resolve;
            });
          },
          interrupt: interruptMock,
        }),
      }));

      const { Agent } = await import('../../../src/agent/agent.js');
      const agent = new Agent('/test/repo', {});
      const role = createTestRole();

      // Start execute but don't await it (it will block)
      const executePromise = agent.execute('Do something', role);

      // Wait a tick for the async iterator to start
      await new Promise(resolve => setTimeout(resolve, 5));

      await agent.interrupt();

      expect(interruptMock).toHaveBeenCalledTimes(1);

      // Resolve the iterator so execute can complete
      resolveIterator.fn?.();
      await executePromise.catch(() => {});
    });

    test('interrupt()後にcurrentQueryがnullになる', async () => {
      const interruptMock = mock(() => Promise.resolve());
      let resolveIterator: { fn: (() => void) | null } = { fn: null };

      mock.module('@anthropic-ai/claude-agent-sdk', () => ({
        query: () => ({
          async *[Symbol.asyncIterator]() {
            await new Promise<void>(resolve => {
              resolveIterator.fn = resolve;
            });
          },
          interrupt: interruptMock,
        }),
      }));

      const { Agent } = await import('../../../src/agent/agent.js');
      const agent = new Agent('/test/repo', {});
      const role = createTestRole();

      const executePromise = agent.execute('Do something', role);
      await new Promise(resolve => setTimeout(resolve, 5));

      await agent.interrupt();

      // Second interrupt should do nothing (currentQuery is null)
      await agent.interrupt();
      expect(interruptMock).toHaveBeenCalledTimes(1);

      resolveIterator.fn?.();
      await executePromise.catch(() => {});
    });

    test('クエリ未実行時にinterrupt()を呼んでも何も起きない', async () => {
      mockQuery([createSuccessResult()]);

      const { Agent } = await import('../../../src/agent/agent.js');
      const agent = new Agent('/test/repo', {});

      // Should not throw
      await agent.interrupt();
    });
  });
});
