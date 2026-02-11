import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import {
  UserAnswerEntry,
  isUserAnswerBlock,
  extractUserAnswers,
} from '../../../src/ui/components/user-answer-entry.js';
import type { UserAnswer } from '../../../src/ui/components/user-answer-entry.js';

// ---------------------------------------------------------------------------
// コンポーネント: UserAnswerEntry
// ---------------------------------------------------------------------------

describe('UserAnswerEntry', () => {
  test('基本的なQ&Aペアが質問と回答テキストとともに表示される', () => {
    const answers: UserAnswer[] = [
      { question: 'どの言語を使いますか？', answer: 'TypeScript' },
    ];
    const { lastFrame } = render(<UserAnswerEntry answers={answers} />);
    const frame = lastFrame()!;
    expect(frame).toContain('どの言語を使いますか？');
    expect(frame).toContain('TypeScript');
  });

  test('複数のQ&Aペアがすべて表示される', () => {
    const answers: UserAnswer[] = [
      { question: 'フレームワークは？', answer: 'React' },
      { question: 'テストツールは？', answer: 'bun:test' },
      { question: 'パッケージマネージャは？', answer: 'bun' },
    ];
    const { lastFrame } = render(<UserAnswerEntry answers={answers} />);
    const frame = lastFrame()!;
    expect(frame).toContain('フレームワークは？');
    expect(frame).toContain('React');
    expect(frame).toContain('テストツールは？');
    expect(frame).toContain('bun:test');
    expect(frame).toContain('パッケージマネージャは？');
    expect(frame).toContain('bun');
  });

  test('回答に"(Recommended)"が含まれる場合、そのテキストが表示される', () => {
    const answers: UserAnswer[] = [
      { question: 'DBを選んでください', answer: 'PostgreSQL (Recommended)' },
    ];
    const { lastFrame } = render(<UserAnswerEntry answers={answers} />);
    const frame = lastFrame()!;
    expect(frame).toContain('(Recommended)');
    expect(frame).toContain('PostgreSQL');
  });

  test('answersが空配列の場合、ヘッダーのみ表示されQ&A行は表示されない', () => {
    const { lastFrame } = render(<UserAnswerEntry answers={[]} />);
    const frame = lastFrame()!;
    expect(frame).toContain("User answered");
    // ツリー文字はQ&A行にのみ表示されるため、空配列では出現しない
    expect(frame).not.toContain('⎿');
  });

  test('ヘッダーに"User answered"テキストが表示される', () => {
    const answers: UserAnswer[] = [
      { question: 'テスト', answer: '回答' },
    ];
    const { lastFrame } = render(<UserAnswerEntry answers={answers} />);
    const frame = lastFrame()!;
    expect(frame).toContain("User answered Claude's questions:");
  });

  test('各Q&A行にツリー文字 ⎿ が表示される', () => {
    const answers: UserAnswer[] = [
      { question: '質問1', answer: '回答1' },
      { question: '質問2', answer: '回答2' },
    ];
    const { lastFrame } = render(<UserAnswerEntry answers={answers} />);
    const frame = lastFrame()!;
    expect(frame).toContain('⎿');
  });

  test('各Q&A行に矢印 → が質問と回答の間に表示される', () => {
    const answers: UserAnswer[] = [
      { question: 'プロジェクト名は？', answer: 'devdemon' },
    ];
    const { lastFrame } = render(<UserAnswerEntry answers={answers} />);
    const frame = lastFrame()!;
    expect(frame).toContain('→');
    // 質問が矢印より前に表示されることを確認
    const arrowIndex = frame.indexOf('→');
    const questionIndex = frame.indexOf('プロジェクト名は？');
    expect(questionIndex).toBeLessThan(arrowIndex);
  });
});

// ---------------------------------------------------------------------------
// ユーティリティ関数: isUserAnswerBlock
// ---------------------------------------------------------------------------

describe('isUserAnswerBlock', () => {
  test('"User answered"を含むテキストに対してtrueを返す', () => {
    expect(isUserAnswerBlock('User answered')).toBe(true);
    expect(isUserAnswerBlock("User answered Claude's questions:")).toBe(true);
    expect(isUserAnswerBlock('● User answered some questions')).toBe(true);
  });

  test('大文字小文字を区別せずにマッチする', () => {
    expect(isUserAnswerBlock('user answered')).toBe(true);
    expect(isUserAnswerBlock('USER ANSWERED')).toBe(true);
    expect(isUserAnswerBlock('User Answered')).toBe(true);
  });

  test('"User answered"を含まないテキストに対してfalseを返す', () => {
    expect(isUserAnswerBlock('Hello world')).toBe(false);
    expect(isUserAnswerBlock('The assistant responded')).toBe(false);
    expect(isUserAnswerBlock('')).toBe(false);
    expect(isUserAnswerBlock('User asked a question')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ユーティリティ関数: extractUserAnswers
// ---------------------------------------------------------------------------

describe('extractUserAnswers', () => {
  test('フォーマットされたテキストからQ&Aペアを抽出する', () => {
    const text = [
      "● User answered Claude's questions:",
      '  ⎿  · Which language? → TypeScript',
      '  ⎿  · Which framework? → React',
    ].join('\n');

    const result = extractUserAnswers(text);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ question: 'Which language?', answer: 'TypeScript' });
    expect(result[1]).toEqual({ question: 'Which framework?', answer: 'React' });
  });

  test('Q&Aパターンを含まないテキストに対して空配列を返す', () => {
    expect(extractUserAnswers('Hello world')).toEqual([]);
    expect(extractUserAnswers('')).toEqual([]);
    expect(extractUserAnswers('Some random text\nAnother line')).toEqual([]);
  });

  test('単一のQ&Aペアを正しく抽出する', () => {
    const text = '  ⎿  · DB選択 → PostgreSQL (Recommended)';
    const result = extractUserAnswers(text);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ question: 'DB選択', answer: 'PostgreSQL (Recommended)' });
  });

  test('ヘッダー行のみでQ&A行がない場合、空配列を返す', () => {
    const text = "● User answered Claude's questions:";
    const result = extractUserAnswers(text);
    expect(result).toEqual([]);
  });
});
