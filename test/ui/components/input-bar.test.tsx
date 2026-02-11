import { describe, test, expect, mock } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { InputBar } from '../../../src/ui/components/input-bar.js';

describe('InputBar', () => {
  test('❯ プロンプトを表示する', () => {
    const { lastFrame } = render(
      <InputBar value="" onChange={() => {}} onSubmit={() => {}} />
    );
    expect(lastFrame()).toContain('❯');
  });

  test('入力テキストを表示する', () => {
    const { lastFrame } = render(
      <InputBar value="hello world" onChange={() => {}} onSubmit={() => {}} />
    );
    expect(lastFrame()).toContain('hello world');
  });

  test('文字入力でonChangeが呼ばれる', () => {
    const onChange = mock(() => {});
    const { stdin } = render(
      <InputBar value="" onChange={onChange} onSubmit={() => {}} />
    );
    stdin.write('a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  test('既存valueに文字が追加される', () => {
    const onChange = mock(() => {});
    const { stdin } = render(
      <InputBar value="hel" onChange={onChange} onSubmit={() => {}} />
    );
    stdin.write('l');
    expect(onChange).toHaveBeenCalledWith('hell');
  });

  test('BackspaceでonChangeが最後の文字を削除する', () => {
    const onChange = mock(() => {});
    const { stdin } = render(
      <InputBar value="abc" onChange={onChange} onSubmit={() => {}} />
    );
    stdin.write('\x7f'); // backspace
    expect(onChange).toHaveBeenCalledWith('ab');
  });

  test('EnterキーでonSubmitが呼ばれる', () => {
    const onSubmit = mock(() => {});
    const onChange = mock(() => {});
    const { stdin } = render(
      <InputBar value="hello" onChange={onChange} onSubmit={onSubmit} />
    );
    stdin.write('\r'); // enter/return
    expect(onSubmit).toHaveBeenCalledWith('hello');
    expect(onChange).toHaveBeenCalledWith('');
  });

  test('空入力でEnterを押してもonSubmitは呼ばれない', () => {
    const onSubmit = mock(() => {});
    const { stdin } = render(
      <InputBar value="" onChange={() => {}} onSubmit={onSubmit} />
    );
    stdin.write('\r');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('空白のみの入力でEnterを押してもonSubmitは呼ばれない', () => {
    const onSubmit = mock(() => {});
    const { stdin } = render(
      <InputBar value="   " onChange={() => {}} onSubmit={onSubmit} />
    );
    stdin.write('\r');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('カーソルが表示される', () => {
    const { lastFrame } = render(
      <InputBar value="" onChange={() => {}} onSubmit={() => {}} />
    );
    // The cursor should be visible (block character or space)
    const frame = lastFrame() ?? '';
    // Either the block cursor or a space should be present after the prompt
    expect(frame).toContain('❯');
  });

  test('Shift+Enterで改行が挿入される', () => {
    const onChange = mock(() => {});
    const onSubmit = mock(() => {});
    const { stdin } = render(
      <InputBar value="hello" onChange={onChange} onSubmit={onSubmit} />
    );
    // Kitty keyboard protocol: Shift+Enter = ESC[13;2u
    stdin.write('\x1b[13;2u');
    expect(onChange).toHaveBeenCalledWith('hello\n');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('Meta+Enter(Option+Enter)で改行が挿入される', () => {
    const onChange = mock(() => {});
    const onSubmit = mock(() => {});
    const { stdin } = render(
      <InputBar value="world" onChange={onChange} onSubmit={onSubmit} />
    );
    // Option+Enter on macOS: ESC + CR
    stdin.write('\x1b\r');
    expect(onChange).toHaveBeenCalledWith('world\n');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('複数行の値が正しくレンダリングされる', () => {
    const { lastFrame } = render(
      <InputBar value={'line1\nline2'} onChange={() => {}} onSubmit={() => {}} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('line1');
    expect(frame).toContain('line2');
  });

  test('複数行の値で最初の行に ❯ プレフィックスが付く', () => {
    const { lastFrame } = render(
      <InputBar value={'first\nsecond'} onChange={() => {}} onSubmit={() => {}} />
    );
    const frame = lastFrame() ?? '';
    // First line should have ❯ prefix
    expect(frame).toContain('❯');
    expect(frame).toContain('first');
    expect(frame).toContain('second');
  });
});
