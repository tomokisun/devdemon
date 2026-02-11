import React from 'react';
import { Text, Box } from 'ink';
import stringWidth from 'string-width';
import { colors } from '../theme.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedRow {
  cells: string[];
  isSeparator: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a line looks like a markdown table row (starts with `|`).
 */
export function isTableLine(line: string): boolean {
  return /^\s*\|/.test(line);
}

/**
 * Extract consecutive table lines from an array starting at `startIndex`.
 * Returns the collected lines and the index of the first non-table line.
 */
export function extractTableLines(
  lines: string[],
  startIndex: number,
): { tableLines: string[]; endIndex: number } {
  const tableLines: string[] = [];
  let i = startIndex;
  while (i < lines.length && isTableLine(lines[i]!)) {
    tableLines.push(lines[i]!);
    i++;
  }
  return { tableLines, endIndex: i };
}

/**
 * Parse a single markdown table row into trimmed cell values.
 * Leading and trailing `|` are stripped.
 */
function parseRow(line: string): ParsedRow {
  // Remove leading/trailing whitespace, then strip outer pipes
  const trimmed = line.trim();
  const inner = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
  const stripped = inner.endsWith('|') ? inner.slice(0, -1) : inner;

  const cells = stripped.split('|').map((c) => c.trim());
  const isSeparator = cells.every((c) => /^[-:]+$/.test(c) || c === '');

  return { cells, isSeparator };
}

/**
 * Detect if a string looks like a filename (contains a dot extension).
 */
function isFileName(text: string): boolean {
  return /^[\w./-]+\.\w{1,10}$/.test(text);
}

/**
 * Pad a string to a target display width (accounts for CJK characters).
 */
function padToWidth(str: string, targetWidth: number): string {
  const currentWidth = stringWidth(str);
  const diff = targetWidth - currentWidth;
  if (diff <= 0) return str;
  return str + ' '.repeat(diff);
}

// ---------------------------------------------------------------------------
// Box-drawing builders
// ---------------------------------------------------------------------------

function buildHorizontalLine(
  colWidths: number[],
  left: string,
  mid: string,
  right: string,
  fill: string,
): string {
  const segments = colWidths.map((w) => fill.repeat(w + 2));
  return left + segments.join(mid) + right;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Render parsed markdown table lines as a box-drawing table in the terminal.
 *
 * @param lines - Raw markdown table lines (including header, separator, data rows).
 */
export const MarkdownTable: React.FC<{ lines: string[] }> = ({ lines }) => {
  if (lines.length === 0) return null;

  // Parse all rows
  const rows = lines.map(parseRow);

  // Determine number of columns (max across all non-separator rows)
  const maxCols = rows.reduce(
    (max, r) => (r.isSeparator ? max : Math.max(max, r.cells.length)),
    0,
  );

  if (maxCols === 0) return null;

  // Normalise each row to have exactly `maxCols` cells
  const normalised = rows.map((r) => ({
    ...r,
    cells: [
      ...r.cells.slice(0, maxCols),
      ...Array.from({ length: Math.max(0, maxCols - r.cells.length) }, () => ''),
    ],
  }));

  // Calculate column widths (display width)
  const colWidths: number[] = Array.from({ length: maxCols }, () => 0);
  for (const row of normalised) {
    if (row.isSeparator) continue;
    for (let c = 0; c < maxCols; c++) {
      colWidths[c] = Math.max(colWidths[c]!, stringWidth(row.cells[c]!));
    }
  }

  // Ensure minimum width of 1 per column
  for (let c = 0; c < maxCols; c++) {
    if (colWidths[c]! < 1) colWidths[c] = 1;
  }

  // Identify header row index (first non-separator row before the first separator)
  let headerIndex = -1;
  for (let i = 0; i < normalised.length; i++) {
    if (normalised[i]!.isSeparator) break;
    if (headerIndex === -1) headerIndex = i;
  }

  // Build rendered lines
  const output: React.ReactNode[] = [];

  // Top border
  const topBorder = buildHorizontalLine(colWidths, '\u250C', '\u252C', '\u2510', '\u2500');
  output.push(
    <Text key="top" color={colors.muted}>
      {topBorder}
    </Text>,
  );

  for (let i = 0; i < normalised.length; i++) {
    const row = normalised[i]!;

    if (row.isSeparator) {
      // Mid border (separator line)
      const midBorder = buildHorizontalLine(colWidths, '\u251C', '\u253C', '\u2524', '\u2500');
      output.push(
        <Text key={`sep-${i}`} color={colors.muted}>
          {midBorder}
        </Text>,
      );
    } else {
      // Data / header row
      const isHeader = i === headerIndex;
      const cellNodes: React.ReactNode[] = [];

      cellNodes.push(
        <Text key={`pipe-start-${i}`} color={colors.muted}>
          {'\u2502'}{' '}
        </Text>,
      );

      for (let c = 0; c < maxCols; c++) {
        const cellText = row.cells[c]!;
        const padded = padToWidth(cellText, colWidths[c]!);

        if (c > 0) {
          cellNodes.push(
            <Text key={`pipe-${i}-${c}`} color={colors.muted}>
              {' '}{'\u2502'}{' '}
            </Text>,
          );
        }

        if (isHeader) {
          cellNodes.push(
            <Text key={`cell-${i}-${c}`} bold>
              {padded}
            </Text>,
          );
        } else if (isFileName(cellText)) {
          // Filename detected: padded might have trailing spaces that should not be colored
          const trailingSpaces = padded.slice(cellText.length);
          cellNodes.push(
            <Text key={`cell-${i}-${c}`}>
              <Text color={colors.primary}>{cellText}</Text>
              {trailingSpaces}
            </Text>,
          );
        } else {
          cellNodes.push(
            <Text key={`cell-${i}-${c}`}>
              {padded}
            </Text>,
          );
        }
      }

      cellNodes.push(
        <Text key={`pipe-end-${i}`} color={colors.muted}>
          {' '}{'\u2502'}
        </Text>,
      );

      output.push(
        <Box key={`row-${i}`}>
          {cellNodes}
        </Box>,
      );
    }
  }

  // Bottom border
  const bottomBorder = buildHorizontalLine(colWidths, '\u2514', '\u2534', '\u2518', '\u2500');
  output.push(
    <Text key="bottom" color={colors.muted}>
      {bottomBorder}
    </Text>,
  );

  return <Box flexDirection="column">{output}</Box>;
};
