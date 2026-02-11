import { readFileSync } from 'fs';
import { join } from 'path';

export class ProgressTracker {
  private filePath: string;

  constructor(devdemonDir: string) {
    this.filePath = join(devdemonDir, 'progress.md');
  }

  read(): string | null {
    try {
      return readFileSync(this.filePath, 'utf-8');
    } catch {
      return null;
    }
  }
}
