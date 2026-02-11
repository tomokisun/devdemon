import { z } from 'zod';

export const settingsSchema = z.object({
  language: z.string().optional(),
  model: z.string().optional(),
});

export interface DevDemonSettings {
  language?: string;
  model?: string;
}

export function validateSettings(data: unknown): DevDemonSettings {
  return settingsSchema.parse(data);
}
