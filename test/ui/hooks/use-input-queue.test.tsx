import { describe, test, expect, mock } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { useInputQueue } from '../../../src/ui/hooks/use-input-queue.js';

function createMockDaemon() {
  return {
    enqueueUserTask: mock(() => ({
      id: 'task-1',
      type: 'user' as const,
      prompt: '',
      enqueuedAt: new Date().toISOString(),
      priority: 0,
    })),
  } as any;
}

// Capture hook return values so tests can call methods directly
let captured: ReturnType<typeof useInputQueue> | null = null;

function HookCapture({ daemon, onQuit }: { daemon: any; onQuit?: () => void }) {
  const hookResult = useInputQueue(daemon, onQuit ?? (() => {}));
  captured = hookResult;
  return React.createElement('ink-text', null, JSON.stringify({ input: hookResult.input }));
}

describe('useInputQueue', () => {
  test('初期inputは空文字列', () => {
    const daemon = createMockDaemon();
    captured = null;
    const { lastFrame } = render(
      React.createElement(HookCapture, { daemon }),
    );
    const output = JSON.parse(lastFrame()!);
    expect(output.input).toBe('');
  });

  test('setInputでinput値を更新できる', async () => {
    const daemon = createMockDaemon();
    captured = null;
    const { lastFrame } = render(
      React.createElement(HookCapture, { daemon }),
    );

    captured!.setInput('hello');
    await new Promise(r => setTimeout(r, 50));

    const output = JSON.parse(lastFrame()!);
    expect(output.input).toBe('hello');
  });

  test('submitでdaemon.enqueueUserTaskが呼ばれる', async () => {
    const daemon = createMockDaemon();
    captured = null;
    render(React.createElement(HookCapture, { daemon }));

    captured!.setInput('fix bug');
    await new Promise(r => setTimeout(r, 50));
    captured!.submit();
    await new Promise(r => setTimeout(r, 50));

    expect(daemon.enqueueUserTask).toHaveBeenCalledWith('fix bug');
  });

  test('submit後にinputがクリアされる', async () => {
    const daemon = createMockDaemon();
    captured = null;
    const { lastFrame } = render(
      React.createElement(HookCapture, { daemon }),
    );

    captured!.setInput('fix bug');
    await new Promise(r => setTimeout(r, 50));
    captured!.submit();
    await new Promise(r => setTimeout(r, 50));

    const output = JSON.parse(lastFrame()!);
    expect(output.input).toBe('');
  });

  test('空白のみのinputではsubmitしない', async () => {
    const daemon = createMockDaemon();
    captured = null;
    render(React.createElement(HookCapture, { daemon }));

    captured!.setInput('   ');
    await new Promise(r => setTimeout(r, 50));
    captured!.submit();
    await new Promise(r => setTimeout(r, 50));

    expect(daemon.enqueueUserTask).not.toHaveBeenCalled();
  });

  test('"quit"入力でsubmitするとonQuitが呼ばれる', async () => {
    const daemon = createMockDaemon();
    const onQuit = mock(() => {});
    captured = null;
    render(React.createElement(HookCapture, { daemon, onQuit }));

    captured!.setInput('quit');
    await new Promise(r => setTimeout(r, 50));
    captured!.submit();
    await new Promise(r => setTimeout(r, 50));

    expect(onQuit).toHaveBeenCalled();
    expect(daemon.enqueueUserTask).not.toHaveBeenCalled();
  });

  test('"/quit"入力でsubmitするとonQuitが呼ばれる', async () => {
    const daemon = createMockDaemon();
    const onQuit = mock(() => {});
    captured = null;
    render(React.createElement(HookCapture, { daemon, onQuit }));

    captured!.setInput('/quit');
    await new Promise(r => setTimeout(r, 50));
    captured!.submit();
    await new Promise(r => setTimeout(r, 50));

    expect(onQuit).toHaveBeenCalled();
    expect(daemon.enqueueUserTask).not.toHaveBeenCalled();
  });

  test('"QUIT"(大文字)入力でもonQuitが呼ばれる', async () => {
    const daemon = createMockDaemon();
    const onQuit = mock(() => {});
    captured = null;
    render(React.createElement(HookCapture, { daemon, onQuit }));

    captured!.setInput('QUIT');
    await new Promise(r => setTimeout(r, 50));
    captured!.submit();
    await new Promise(r => setTimeout(r, 50));

    expect(onQuit).toHaveBeenCalled();
    expect(daemon.enqueueUserTask).not.toHaveBeenCalled();
  });
});
