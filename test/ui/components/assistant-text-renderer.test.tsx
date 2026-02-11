import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { AssistantTextRenderer } from '../../../src/ui/components/assistant-text-renderer.js';

describe('AssistantTextRenderer', () => {
  test('空テキストの場合は何も描画しない', () => {
    const { lastFrame } = render(<AssistantTextRenderer text="" />);
    expect(lastFrame()).toBe('');
  });

  test('プレーンテキストが出力に表示される', () => {
    const { lastFrame } = render(
      <AssistantTextRenderer text="Hello, world!" />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('Hello, world!');
  });

  test('スラッシュコマンドを含むテキストが表示される', () => {
    const { lastFrame } = render(
      <AssistantTextRenderer text="/commit" />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('/commit');
  });

  test('★ Insightブロックの内容が表示される', () => {
    const text = [
      '★ Insight ──────────────────────────────────────',
      'This is an important finding.',
      'It spans multiple lines.',
      '────────────────────────────────────────────────',
    ].join('\n');

    const { lastFrame } = render(<AssistantTextRenderer text={text} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Insight');
    expect(frame).toContain('This is an important finding.');
    expect(frame).toContain('It spans multiple lines.');
  });

  test('Markdownテーブル（|で始まる行）の内容が表示される', () => {
    const text = [
      '| Name  | Value |',
      '|-------|-------|',
      '| alpha | 1     |',
      '| beta  | 2     |',
    ].join('\n');

    const { lastFrame } = render(<AssistantTextRenderer text={text} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Name');
    expect(frame).toContain('Value');
    expect(frame).toContain('alpha');
    expect(frame).toContain('beta');
  });

  test('User answeredブロックの内容が表示される', () => {
    const text = [
      '● User answered Claude\'s questions:',
      '⎿  · Proceed with changes? → Yes',
      '⎿  · Which branch? → main',
    ].join('\n');

    const { lastFrame } = render(<AssistantTextRenderer text={text} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Proceed with changes?');
    expect(frame).toContain('Yes');
    expect(frame).toContain('Which branch?');
    expect(frame).toContain('main');
  });

  test('複合コンテンツ：プレーンテキスト + Insight + テーブルが表示される', () => {
    const text = [
      'Here is some analysis.',
      '★ Insight ──────────────────────────────────────',
      'Key takeaway from the analysis.',
      '────────────────────────────────────────────────',
      '| File       | Status  |',
      '|------------|---------|',
      '| app.ts     | Changed |',
    ].join('\n');

    const { lastFrame } = render(<AssistantTextRenderer text={text} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Here is some analysis.');
    expect(frame).toContain('Key takeaway from the analysis.');
    expect(frame).toContain('File');
    expect(frame).toContain('Status');
    expect(frame).toContain('Changed');
  });

  test('単一行テキストが高速パスで描画される', () => {
    const { lastFrame } = render(
      <AssistantTextRenderer text="Single line of text" />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('Single line of text');
  });
});
