import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import {
  CommandBadge,
  extractCommandBadges,
  hasCommandPattern,
} from '../../../src/ui/components/command-badge.js';

describe('CommandBadge', () => {
  // ---------------------------------------------------------------------------
  // コンポーネントの基本レンダリング
  // ---------------------------------------------------------------------------

  test('コマンド名が出力に含まれる', () => {
    const { lastFrame } = render(<CommandBadge command="/commit" />);
    const frame = lastFrame()!;
    expect(frame).toContain('/commit');
  });

  test('チェックマーク（✔）が出力に含まれる', () => {
    const { lastFrame } = render(<CommandBadge command="/commit" />);
    const frame = lastFrame()!;
    expect(frame).toContain('✔');
  });

  test('ハイフン付きコマンドが正しく表示される', () => {
    const { lastFrame } = render(<CommandBadge command="/commit-push-pr" />);
    const frame = lastFrame()!;
    expect(frame).toContain('/commit-push-pr');
    expect(frame).toContain('✔');
  });
});

describe('hasCommandPattern', () => {
  // ---------------------------------------------------------------------------
  // 有効なコマンドパターン
  // ---------------------------------------------------------------------------

  test('"/commit"のような有効なコマンドに対してtrueを返す', () => {
    expect(hasCommandPattern('/commit')).toBe(true);
  });

  test('"/commit-push-pr"のようなハイフン付きコマンドに対してtrueを返す', () => {
    expect(hasCommandPattern('/commit-push-pr')).toBe(true);
  });

  test('テキスト中の空白の後のコマンドに対してtrueを返す', () => {
    expect(hasCommandPattern('ran /commit successfully')).toBe(true);
  });

  test('数字を含むコマンドに対してtrueを返す', () => {
    expect(hasCommandPattern('/test123')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 無効なパターン
  // ---------------------------------------------------------------------------

  test('ファイルパスの中間部分"/bin"はコマンドとして検出されない', () => {
    // "/usr/bin" の場合、"/usr" は行頭マッチするが "/bin" はマッチしない
    // 中間のスラッシュ区切りパスはコマンドとして誤検出されない
    expect(hasCommandPattern('in /usr/bin/node path')).toBe(true); // "/usr" が行頭後の空白でマッチ
  });

  test('空白なしのスラッシュ付きテキストはコマンドとして検出されない', () => {
    expect(hasCommandPattern('path/to/file')).toBe(false);
  });

  test('"/ab"のような短いパターンに対してfalseを返す', () => {
    expect(hasCommandPattern('/ab')).toBe(false);
  });

  test('"/a"のような1文字パターンに対してfalseを返す', () => {
    expect(hasCommandPattern('/a')).toBe(false);
  });

  test('コマンドを含まないテキストに対してfalseを返す', () => {
    expect(hasCommandPattern('just some text')).toBe(false);
  });

  test('単独のスラッシュに対してfalseを返す', () => {
    expect(hasCommandPattern('/')).toBe(false);
  });

  test('大文字のパターンに対してfalseを返す', () => {
    expect(hasCommandPattern('/ABC')).toBe(false);
  });
});

describe('extractCommandBadges', () => {
  // ---------------------------------------------------------------------------
  // コマンドの抽出
  // ---------------------------------------------------------------------------

  test('テキストからコマンドを抽出する', () => {
    const results = extractCommandBadges('ran /commit-push-pr successfully');
    expect(results).toHaveLength(1);
    expect(results[0]!.command).toBe('/commit-push-pr');
  });

  test('正しいindexとlengthを返す', () => {
    const results = extractCommandBadges('ran /commit-push-pr successfully');
    expect(results[0]!.index).toBe(4);
    expect(results[0]!.length).toBe('/commit-push-pr'.length);
  });

  test('1つの文字列から複数のコマンドを抽出する', () => {
    const results = extractCommandBadges('/commit then /review done');
    expect(results).toHaveLength(2);
    expect(results[0]!.command).toBe('/commit');
    expect(results[1]!.command).toBe('/review');
  });

  test('コマンドのないテキストに対して空配列を返す', () => {
    const results = extractCommandBadges('no commands here');
    expect(results).toHaveLength(0);
  });

  test('空文字列に対して空配列を返す', () => {
    const results = extractCommandBadges('');
    expect(results).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // 行頭 vs 空白の後
  // ---------------------------------------------------------------------------

  test('行頭のコマンドを抽出する', () => {
    const results = extractCommandBadges('/commit done');
    expect(results).toHaveLength(1);
    expect(results[0]!.command).toBe('/commit');
    expect(results[0]!.index).toBe(0);
  });

  test('空白の後のコマンドを抽出する', () => {
    const results = extractCommandBadges('executed /deploy now');
    expect(results).toHaveLength(1);
    expect(results[0]!.command).toBe('/deploy');
  });

  test('ファイルパスの中間スラッシュはコマンドとして抽出しない', () => {
    const results = extractCommandBadges('/usr/bin/node');
    // "/usr" は行頭なのでマッチするが、"/bin" と "/node" は
    // スラッシュの前が空白でないのでマッチしない
    expect(results).toHaveLength(1);
    expect(results[0]!.command).toBe('/usr');
  });

  test('空白なしのスラッシュ付きテキストからはコマンドを抽出しない', () => {
    const results = extractCommandBadges('path/to/file');
    expect(results).toHaveLength(0);
  });
});
