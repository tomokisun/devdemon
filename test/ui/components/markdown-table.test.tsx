import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import {
  MarkdownTable,
  isTableLine,
  extractTableLines,
  parseRow,
} from '../../../src/ui/components/markdown-table.js';

// ---------------------------------------------------------------------------
// ユーティリティ関数のテスト
// ---------------------------------------------------------------------------

describe('isTableLine', () => {
  test('パイプで始まる行はtrueを返す', () => {
    expect(isTableLine('| Header |')).toBe(true);
  });

  test('先頭にスペースがあってもパイプで始まればtrueを返す', () => {
    expect(isTableLine('  | Header |')).toBe(true);
  });

  test('パイプで始まらない通常のテキストはfalseを返す', () => {
    expect(isTableLine('Hello world')).toBe(false);
  });

  test('空文字列はfalseを返す', () => {
    expect(isTableLine('')).toBe(false);
  });

  test('パイプが途中にあるだけの行はfalseを返す', () => {
    expect(isTableLine('foo | bar')).toBe(false);
  });

  test('セパレータ行もtrueを返す', () => {
    expect(isTableLine('| --- | --- |')).toBe(true);
  });
});

describe('extractTableLines', () => {
  test('連続するテーブル行を抽出する', () => {
    const lines = [
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2 |',
      'not a table line',
    ];
    const result = extractTableLines(lines, 0);
    expect(result.tableLines).toEqual([
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2 |',
    ]);
    expect(result.endIndex).toBe(3);
  });

  test('途中のインデックスから抽出を開始できる', () => {
    const lines = [
      'some text',
      '| X | Y |',
      '| --- | --- |',
      '| a | b |',
    ];
    const result = extractTableLines(lines, 1);
    expect(result.tableLines).toEqual([
      '| X | Y |',
      '| --- | --- |',
      '| a | b |',
    ]);
    expect(result.endIndex).toBe(4);
  });

  test('テーブル行がない場合は空配列を返す', () => {
    const lines = ['hello', 'world'];
    const result = extractTableLines(lines, 0);
    expect(result.tableLines).toEqual([]);
    expect(result.endIndex).toBe(0);
  });

  test('全行がテーブル行の場合は全て抽出する', () => {
    const lines = ['| A |', '| --- |', '| 1 |'];
    const result = extractTableLines(lines, 0);
    expect(result.tableLines).toEqual(lines);
    expect(result.endIndex).toBe(3);
  });
});

describe('parseRow', () => {
  test('通常の行をセルに分割する', () => {
    const result = parseRow('| Hello | World |');
    expect(result.cells).toEqual(['Hello', 'World']);
    expect(result.isSeparator).toBe(false);
  });

  test('セパレータ行を検出する', () => {
    const result = parseRow('| --- | --- |');
    expect(result.isSeparator).toBe(true);
  });

  test('コロン付きセパレータ行を検出する', () => {
    const result = parseRow('| :---: | ---: |');
    expect(result.isSeparator).toBe(true);
  });

  test('セル値の前後のスペースをトリムする', () => {
    const result = parseRow('|  foo  |  bar  |');
    expect(result.cells).toEqual(['foo', 'bar']);
  });

  test('単一セルの行をパースする', () => {
    const result = parseRow('| only |');
    expect(result.cells).toEqual(['only']);
  });

  test('空セルを含む行をパースする', () => {
    const result = parseRow('| a |  | c |');
    expect(result.cells).toEqual(['a', '', 'c']);
  });
});

// ---------------------------------------------------------------------------
// コンポーネントのテスト
// ---------------------------------------------------------------------------

describe('MarkdownTable', () => {
  test('ヘッダーとデータ行を含む基本テーブルをレンダリングする', () => {
    const lines = [
      '| Name | Age |',
      '| --- | --- |',
      '| Alice | 30 |',
    ];
    const { lastFrame } = render(<MarkdownTable lines={lines} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Name');
    expect(frame).toContain('Age');
    expect(frame).toContain('Alice');
    expect(frame).toContain('30');
  });

  test('罫線文字が表示される', () => {
    const lines = [
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2 |',
    ];
    const { lastFrame } = render(<MarkdownTable lines={lines} />);
    const frame = lastFrame()!;
    // 上辺の罫線文字
    expect(frame).toContain('\u250C'); // ┌
    expect(frame).toContain('\u252C'); // ┬
    expect(frame).toContain('\u2510'); // ┐
    // 中間の罫線文字（セパレータ行）
    expect(frame).toContain('\u251C'); // ├
    expect(frame).toContain('\u253C'); // ┼
    expect(frame).toContain('\u2524'); // ┤
    // 下辺の罫線文字
    expect(frame).toContain('\u2514'); // └
    expect(frame).toContain('\u2534'); // ┴
    expect(frame).toContain('\u2518'); // ┘
    // 水平・垂直罫線
    expect(frame).toContain('\u2500'); // ─
    expect(frame).toContain('\u2502'); // │
  });

  test('セパレータ行が中間罫線に変換される', () => {
    const lines = [
      '| H1 | H2 |',
      '| --- | --- |',
      '| D1 | D2 |',
    ];
    const { lastFrame } = render(<MarkdownTable lines={lines} />);
    const frame = lastFrame()!;
    // セパレータ行は├─┼─┤形式の罫線に変換されるはず
    expect(frame).toContain('\u251C');
    expect(frame).toContain('\u253C');
    expect(frame).toContain('\u2524');
  });

  test('単一カラムのテーブルをレンダリングする', () => {
    const lines = [
      '| Item |',
      '| --- |',
      '| Apple |',
    ];
    const { lastFrame } = render(<MarkdownTable lines={lines} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Item');
    expect(frame).toContain('Apple');
    // 単一カラムなので┬と┴は不要（┌─┐形式になる）
    expect(frame).toContain('\u250C');
    expect(frame).toContain('\u2510');
    expect(frame).toContain('\u2514');
    expect(frame).toContain('\u2518');
  });

  test('空セルを含むテーブルをレンダリングする', () => {
    const lines = [
      '| Key | Value |',
      '| --- | --- |',
      '| a |  |',
    ];
    const { lastFrame } = render(<MarkdownTable lines={lines} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Key');
    expect(frame).toContain('Value');
    expect(frame).toContain('a');
  });

  test('複数データ行のテーブルをレンダリングする', () => {
    const lines = [
      '| Lang | Year |',
      '| --- | --- |',
      '| Rust | 2010 |',
      '| Go | 2009 |',
      '| Zig | 2016 |',
    ];
    const { lastFrame } = render(<MarkdownTable lines={lines} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Rust');
    expect(frame).toContain('2010');
    expect(frame).toContain('Go');
    expect(frame).toContain('2009');
    expect(frame).toContain('Zig');
    expect(frame).toContain('2016');
  });

  test('空のlines配列ではnullを返す', () => {
    const { lastFrame } = render(<MarkdownTable lines={[]} />);
    expect(lastFrame()).toBe('');
  });

  test('ファイル名セルが含まれるテーブルをレンダリングする', () => {
    const lines = [
      '| File | Status |',
      '| --- | --- |',
      '| src/app.tsx | modified |',
    ];
    const { lastFrame } = render(<MarkdownTable lines={lines} />);
    const frame = lastFrame()!;
    expect(frame).toContain('src/app.tsx');
    expect(frame).toContain('modified');
  });
});
