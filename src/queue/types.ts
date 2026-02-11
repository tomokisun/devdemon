export interface Task {
  id: string;
  type: 'user' | 'autonomous';
  prompt: string;
  enqueuedAt: string;
  priority: number; // 0=user(high), 1=autonomous(low)
}
