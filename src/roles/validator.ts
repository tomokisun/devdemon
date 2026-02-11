import {
  RoleFrontmatterSchema,
  RoleNameSchema,
  IntervalSchema,
  MaxTurnsSchema,
  PermissionModeSchema,
  IntervalOverrideSchema,
  type RoleFrontmatter,
} from './types.js';
import { z } from 'zod';

export function validateFrontmatter(data: unknown): RoleFrontmatter {
  return RoleFrontmatterSchema.parse(data);
}

export function validateRoleName(name: string): string {
  return RoleNameSchema.parse(name);
}

export function validateInterval(value: number): number {
  return IntervalSchema.parse(value);
}

export function validateMaxTurns(value: number): number {
  return MaxTurnsSchema.parse(value);
}

export function validatePermissionMode(value: string): 'default' | 'acceptEdits' | 'bypassPermissions' {
  return PermissionModeSchema.parse(value);
}

/**
 * Validate and coerce a CLI string interval override to a number.
 */
export function validateIntervalOverride(value: string): number {
  return IntervalOverrideSchema.parse(value);
}

/**
 * Format a ZodError into a user-friendly single-line message.
 */
export function formatValidationError(error: z.ZodError): string {
  return error.issues.map(issue => issue.message).join('; ');
}
