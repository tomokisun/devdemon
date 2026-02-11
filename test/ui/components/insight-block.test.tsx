import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import {
  InsightBlock,
  isInsightBlockStart,
  extractInsightBlock,
} from '../../../src/ui/components/insight-block.js';

describe('InsightBlock', () => {
  // ---------------------------------------------------------------------------
  // コンポーネントレンダリングテスト
  // ---------------------------------------------------------------------------

  test('★ Insightヘッダーが表示される', () => {
    const { lastFrame } = render(<InsightBlock content="テスト内容" />);
    const frame = lastFrame()!;
    expect(frame).toContain('★ Insight');
  });

  test('コンテンツテキストが出力に表示される', () => {
    const { lastFrame } = render(<InsightBlock content="重要な発見です" />);
    const frame = lastFrame()!;
    expect(frame).toContain('重要な発見です');
  });

  test('ボーダー文字（─）が表示される', () => {
    const { lastFrame } = render(<InsightBlock content="テスト" />);
    const frame = lastFrame()!;
    expect(frame).toContain('─');
  });

  test('複数行のコンテンツが正しく表示される', () => {
    const multiLineContent = '1行目\n2行目\n3行目';
    const { lastFrame } = render(<InsightBlock content={multiLineContent} />);
    const frame = lastFrame()!;
    expect(frame).toContain('1行目');
    expect(frame).toContain('2行目');
    expect(frame).toContain('3行目');
  });

  test('単一行のコンテンツが正しく表示される', () => {
    const { lastFrame } = render(<InsightBlock content="単一行の内容" />);
    const frame = lastFrame()!;
    expect(frame).toContain('単一行の内容');
    expect(frame).toContain('★ Insight');
  });

  test('空のコンテンツでもヘッダーとボーダーが表示される', () => {
    const { lastFrame } = render(<InsightBlock content="" />);
    const frame = lastFrame()!;
    expect(frame).toContain('★ Insight');
    expect(frame).toContain('─');
  });

  // ---------------------------------------------------------------------------
  // isInsightBlockStart ユーティリティ関数テスト
  // ---------------------------------------------------------------------------

  describe('isInsightBlockStart', () => {
    test('★ Insightで始まる行をtrueと判定する', () => {
      expect(isInsightBlockStart('★ Insight')).toBe(true);
    });

    test('★ Insightにボーダーが続く行をtrueと判定する', () => {
      expect(isInsightBlockStart('★ Insight ──────────────────')).toBe(true);
    });

    test('前後に空白がある場合でもtrueと判定する', () => {
      expect(isInsightBlockStart('  ★ Insight  ')).toBe(true);
    });

    test('★ Insight─（スペースなし）の行をtrueと判定する', () => {
      expect(isInsightBlockStart('★ Insight─────')).toBe(true);
    });

    test('Insight以外の行はfalseを返す', () => {
      expect(isInsightBlockStart('普通のテキスト')).toBe(false);
    });

    test('空文字列はfalseを返す', () => {
      expect(isInsightBlockStart('')).toBe(false);
    });

    test('★だけの行はfalseを返す', () => {
      expect(isInsightBlockStart('★')).toBe(false);
    });

    test('Insightだけの行はfalseを返す', () => {
      expect(isInsightBlockStart('Insight')).toBe(false);
    });

    test('★ の後にInsight以外のテキストがある行はfalseを返す', () => {
      expect(isInsightBlockStart('★ Something')).toBe(false);
    });

    test('ボーダー行はfalseを返す', () => {
      expect(isInsightBlockStart('──────────────────')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // extractInsightBlock ユーティリティ関数テスト
  // ---------------------------------------------------------------------------

  describe('extractInsightBlock', () => {
    test('正しい形式のインサイトブロックを抽出する', () => {
      const text = '★ Insight ──────\nブロック内容\n─────────';
      const result = extractInsightBlock(text, 0);
      expect(result).not.toBeNull();
      expect(result!.content).toBe('ブロック内容');
      expect(result!.endIndex).toBe(2);
    });

    test('複数行のコンテンツを抽出する', () => {
      const text = '★ Insight\n1行目\n2行目\n3行目\n─────────';
      const result = extractInsightBlock(text, 0);
      expect(result).not.toBeNull();
      expect(result!.content).toBe('1行目\n2行目\n3行目');
      expect(result!.endIndex).toBe(4);
    });

    test('閉じボーダーがない場合はnullを返す', () => {
      const text = '★ Insight\nブロック内容\nまだ続く';
      const result = extractInsightBlock(text, 0);
      expect(result).toBeNull();
    });

    test('startIndexが範囲外の場合はnullを返す', () => {
      const text = '★ Insight\n内容\n─────────';
      expect(extractInsightBlock(text, -1)).toBeNull();
      expect(extractInsightBlock(text, 10)).toBeNull();
    });

    test('startIndexの行がインサイトヘッダーでない場合はnullを返す', () => {
      const text = '普通のテキスト\n★ Insight\n内容\n─────────';
      const result = extractInsightBlock(text, 0);
      expect(result).toBeNull();
    });

    test('途中のstartIndexからブロックを抽出する', () => {
      const text = '前のテキスト\n★ Insight\n重要な発見\n─────────';
      const result = extractInsightBlock(text, 1);
      expect(result).not.toBeNull();
      expect(result!.content).toBe('重要な発見');
      expect(result!.endIndex).toBe(3);
    });

    test('空のコンテンツのブロックを抽出する', () => {
      const text = '★ Insight\n─────────';
      const result = extractInsightBlock(text, 0);
      expect(result).not.toBeNull();
      expect(result!.content).toBe('');
      expect(result!.endIndex).toBe(1);
    });
  });
});
