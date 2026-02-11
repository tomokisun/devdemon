import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { MarkdownText } from '../../../src/ui/components/markdown-text.js';

describe('MarkdownText', () => {
  // -------------------------------------------------------------------------
  // 1. ボールドテキスト
  // -------------------------------------------------------------------------
  test('**text**でボールドテキストがレンダリングされる', () => {
    const { lastFrame } = render(<MarkdownText text="これは**太字**です" />);
    const frame = lastFrame()!;
    expect(frame).toContain('太字');
    expect(frame).toContain('これは');
    expect(frame).toContain('です');
    // ** delimiters should be stripped
    expect(frame).not.toContain('**');
  });

  test('複数のボールドテキストが正しくレンダリングされる', () => {
    const { lastFrame } = render(
      <MarkdownText text="**first** and **second**" />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('first');
    expect(frame).toContain('second');
    expect(frame).not.toContain('**');
  });

  // -------------------------------------------------------------------------
  // 2. インラインコード
  // -------------------------------------------------------------------------
  test('`code`でインラインコードがレンダリングされる', () => {
    const { lastFrame } = render(
      <MarkdownText text="実行コマンド: `npm install`" />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('npm install');
    expect(frame).toContain('実行コマンド:');
    // backtick delimiters should be stripped
    expect(frame).not.toContain('`');
  });

  test('複数のインラインコードが正しくレンダリングされる', () => {
    const { lastFrame } = render(
      <MarkdownText text="`foo` and `bar`" />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('foo');
    expect(frame).toContain('bar');
    expect(frame).not.toContain('`');
  });

  // -------------------------------------------------------------------------
  // 3. URL
  // -------------------------------------------------------------------------
  test('URLがレンダリングされる', () => {
    const { lastFrame } = render(
      <MarkdownText text="詳細は https://example.com を参照" />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('https://example.com');
    expect(frame).toContain('詳細は');
    expect(frame).toContain('を参照');
  });

  test('httpのURLもレンダリングされる', () => {
    const { lastFrame } = render(
      <MarkdownText text="http://example.com/path?q=1" />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('http://example.com/path?q=1');
  });

  // -------------------------------------------------------------------------
  // 4. ファイル名ハイライト
  // -------------------------------------------------------------------------
  test('ファイル名がハイライト表示される', () => {
    const { lastFrame } = render(
      <MarkdownText text="ファイル app.tsx を編集します" />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('app.tsx');
    expect(frame).toContain('ファイル');
    expect(frame).toContain('を編集します');
  });

  test('パス付きファイル名がハイライト表示される', () => {
    const { lastFrame } = render(
      <MarkdownText text="src/utils/helpers.ts を確認" />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('src/utils/helpers.ts');
  });

  test('様々な拡張子のファイル名がハイライトされる', () => {
    const extensions = ['md', 'js', 'json', 'yaml', 'yml', 'swift', 'graphql', 'css', 'html'];
    for (const ext of extensions) {
      const { lastFrame } = render(
        <MarkdownText text={`file.${ext} を編集`} />,
      );
      expect(lastFrame()!).toContain(`file.${ext}`);
    }
  });

  // -------------------------------------------------------------------------
  // 5. ヘッダー
  // -------------------------------------------------------------------------
  test('## ヘッダーがレンダリングされる', () => {
    const { lastFrame } = render(
      <MarkdownText text="## セクションタイトル" />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('セクションタイトル');
    // ## prefix should be stripped
    expect(frame).not.toContain('##');
  });

  test('### ヘッダーがレンダリングされる', () => {
    const { lastFrame } = render(
      <MarkdownText text="### サブセクション" />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('サブセクション');
    expect(frame).not.toContain('###');
  });

  // -------------------------------------------------------------------------
  // 6. 空テキスト
  // -------------------------------------------------------------------------
  test('空文字列は空の出力を返す', () => {
    const { lastFrame } = render(<MarkdownText text="" />);
    const frame = lastFrame()!;
    expect(frame).toBe('');
  });

  // -------------------------------------------------------------------------
  // 7. 混合フォーマット（ボールド + コード + URL）
  // -------------------------------------------------------------------------
  test('1行にボールド・コード・URLが混在する場合正しくレンダリングされる', () => {
    const { lastFrame } = render(
      <MarkdownText text="**注意**: `npm run build` で https://example.com にデプロイ" />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('注意');
    expect(frame).toContain('npm run build');
    expect(frame).toContain('https://example.com');
    expect(frame).not.toContain('**');
    expect(frame).not.toContain('`');
  });

  test('ボールドとファイル名が混在する場合正しくレンダリングされる', () => {
    const { lastFrame } = render(
      <MarkdownText text="**変更点**: app.tsx を更新しました" />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('変更点');
    expect(frame).toContain('app.tsx');
    expect(frame).not.toContain('**');
  });

  // -------------------------------------------------------------------------
  // 8. 複数行テキスト
  // -------------------------------------------------------------------------
  test('複数行テキストがレンダリングされる', () => {
    const multiLine = '1行目\n2行目\n3行目';
    const { lastFrame } = render(<MarkdownText text={multiLine} />);
    const frame = lastFrame()!;
    expect(frame).toContain('1行目');
    expect(frame).toContain('2行目');
    expect(frame).toContain('3行目');
  });

  test('複数行でヘッダーと通常テキストが混在する場合', () => {
    const text = '## タイトル\nこれは本文です\n### サブタイトル\nサブ本文';
    const { lastFrame } = render(<MarkdownText text={text} />);
    const frame = lastFrame()!;
    expect(frame).toContain('タイトル');
    expect(frame).toContain('これは本文です');
    expect(frame).toContain('サブタイトル');
    expect(frame).toContain('サブ本文');
    expect(frame).not.toContain('##');
  });

  test('複数行で各行に異なるフォーマットが使われている場合', () => {
    const text = '**ボールド行**\n`コード行`\nhttps://example.com';
    const { lastFrame } = render(<MarkdownText text={text} />);
    const frame = lastFrame()!;
    expect(frame).toContain('ボールド行');
    expect(frame).toContain('コード行');
    expect(frame).toContain('https://example.com');
    expect(frame).not.toContain('**');
    expect(frame).not.toContain('`');
  });

  // -------------------------------------------------------------------------
  // 9. プレーンテキスト
  // -------------------------------------------------------------------------
  test('マークダウンなしのプレーンテキストがそのまま表示される', () => {
    const { lastFrame } = render(
      <MarkdownText text="これは普通のテキストです" />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('これは普通のテキストです');
  });

  test('特殊文字を含まないプレーンテキストが正しく表示される', () => {
    const { lastFrame } = render(
      <MarkdownText text="Hello, world! This is plain text." />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('Hello, world! This is plain text.');
  });
});
