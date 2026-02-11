import { z } from 'zod';

export const RoleFrontmatterSchema = z.object({
  name: z.string().min(1),
  interval: z.number().positive().default(300),
  maxTurns: z.number().positive().default(25),
  tools: z.array(z.string()).optional(),
  permissionMode: z.enum(['default', 'acceptEdits', 'bypassPermissions']).default('acceptEdits'),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type RoleFrontmatter = z.infer<typeof RoleFrontmatterSchema>;

export interface RoleConfig {
  frontmatter: RoleFrontmatter;
  body: string;
  filePath: string;
}
