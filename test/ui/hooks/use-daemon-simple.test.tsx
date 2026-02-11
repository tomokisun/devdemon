import { describe, test, expect } from 'bun:test';

// formatMs関数の単体テスト
describe('formatMs helper function', () => {
  // use-daemon.tsから抽出したformatMs関数
  function formatMs(ms: number): string {
    if (ms >= 60000) {
      const m = Math.floor(ms / 60000);
      const s = Math.round((ms % 60000) / 1000);
      return `${m}m ${s}s`;
    }
    return `${Math.round(ms / 1000)}s`;
  }

  test('60秒未満は秒単位で表示', () => {
    expect(formatMs(0)).toBe('0s');
    expect(formatMs(1000)).toBe('1s');
    expect(formatMs(1500)).toBe('2s'); // 四捨五入
    expect(formatMs(59999)).toBe('60s');
  });

  test('60秒以上は分秒単位で表示', () => {
    expect(formatMs(60000)).toBe('1m 0s');
    expect(formatMs(65000)).toBe('1m 5s');
    expect(formatMs(125000)).toBe('2m 5s');
    expect(formatMs(3665000)).toBe('61m 5s');
  });
});

// addEntryToState関数の単体テスト
describe('addEntryToState helper function', () => {
  const MAX_ENTRIES = 200;

  interface CurrentTaskState {
    task: any;
    entries: any[];
    streamingText: string;
    cycleStartedAt: number;
  }

  function addEntryToState(prev: CurrentTaskState, entry: any): CurrentTaskState {
    const newEntries = [...prev.entries, entry];
    const trimmed = newEntries.length > MAX_ENTRIES
      ? newEntries.slice(-MAX_ENTRIES)
      : newEntries;
    return { ...prev, entries: trimmed };
  }

  test('エントリを追加できる', () => {
    const prev: CurrentTaskState = {
      task: {},
      entries: [{ text: 'entry1' }],
      streamingText: '',
      cycleStartedAt: Date.now()
    };
    const newEntry = { text: 'entry2' };

    const result = addEntryToState(prev, newEntry);

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toEqual({ text: 'entry1' });
    expect(result.entries[1]).toEqual({ text: 'entry2' });
  });

  test('200件を超えると古いエントリが削除される', () => {
    const prev: CurrentTaskState = {
      task: {},
      entries: Array.from({ length: 200 }, (_, i) => ({ text: `entry${i}` })),
      streamingText: '',
      cycleStartedAt: Date.now()
    };
    const newEntry = { text: 'entry200' };

    const result = addEntryToState(prev, newEntry);

    expect(result.entries).toHaveLength(200);
    expect(result.entries[0]).toEqual({ text: 'entry1' }); // entry0が削除されている
    expect(result.entries[199]).toEqual({ text: 'entry200' });
  });
});