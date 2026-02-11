import { useState, useCallback } from 'react';
import type { Daemon } from '../../daemon/daemon.js';

export function useInputQueue(daemon: Daemon, onQuit: () => void) {
  const [input, setInput] = useState('');

  const submit = useCallback(() => {
    if (input.trim()) {
      const trimmed = input.trim().toLowerCase();
      if (trimmed === 'quit' || trimmed === '/quit') {
        onQuit();
        return;
      }
      daemon.enqueueUserTask(input.trim());
      setInput('');
    }
  }, [input, daemon, onQuit]);

  return { input, setInput, submit };
}
