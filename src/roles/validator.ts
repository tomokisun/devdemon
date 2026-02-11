import { RoleFrontmatterSchema, type RoleFrontmatter } from './types.js';

export function validateFrontmatter(data: unknown): RoleFrontmatter {
  return RoleFrontmatterSchema.parse(data);
}
