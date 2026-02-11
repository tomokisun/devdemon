import { z } from 'zod';

// --- Reusable field-level schemas ---

export const RoleNameSchema = z
  .string()
  .min(1, 'Role name must not be empty')
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9 _\-]*$/,
    'Role name must start with a letter or number and contain only letters, numbers, spaces, hyphens, or underscores',
  );

export const IntervalSchema = z
  .number()
  .positive('Interval must be a positive number');

export const MaxTurnsSchema = z
  .number()
  .int('Max turns must be an integer')
  .positive('Max turns must be a positive integer');

export const PermissionModeSchema = z.enum(
  ['default', 'acceptEdits', 'bypassPermissions'],
  { message: 'Permission mode must be one of: default, acceptEdits, bypassPermissions' },
);

/**
 * Schema for parsing a CLI string interval override into a validated number.
 * Accepts a numeric string, coerces to number, and validates it is positive.
 */
export const IntervalOverrideSchema = z
  .string()
  .transform((val) => {
    const n = Number(val);
    if (isNaN(n)) throw new Error(`Invalid interval: "${val}" is not a number`);
    return n;
  })
  .pipe(IntervalSchema);

// --- Composite schema ---

export const RoleFrontmatterSchema = z.object({
  name: RoleNameSchema,
  interval: IntervalSchema.default(300),
  maxTurns: MaxTurnsSchema.default(50),
  tools: z.array(z.string()).optional(),
  permissionMode: PermissionModeSchema.default('acceptEdits'),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type RoleFrontmatter = z.infer<typeof RoleFrontmatterSchema>;

export interface RoleConfig {
  frontmatter: RoleFrontmatter;
  body: string;
  filePath: string;
}
