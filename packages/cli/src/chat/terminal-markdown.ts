import chalk from 'chalk';

/**
 * Lightweight markdown-to-terminal renderer.
 * Handles: tables, headers, bold, inline code, code blocks, lists.
 */

const INDENT = '  ';

// Strip ANSI escape sequences for width calculation
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

/** Pad string to width accounting for ANSI codes */
function padEnd(str: string, width: number): string {
  const diff = width - visibleLength(str);
  return diff > 0 ? str + ' '.repeat(diff) : str;
}

/** Apply inline formatting: **bold**, `code`, *italic* */
function formatInline(text: string): string {
  let result = text;
  // code spans first (so bold inside code isn't processed)
  result = result.replace(/`([^`]+)`/g, (_m, code: string) => chalk.cyan(code));
  // bold
  result = result.replace(/\*\*([^*]+)\*\*/g, (_m, bold: string) => chalk.bold(bold));
  // italic (single *)
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_m, it: string) => chalk.italic(it));
  return result;
}

/** Detect if a line is a table separator like |:---|:---|  */
function isTableSeparator(line: string): boolean {
  return /^\|[\s:*-]+\|$/.test(line.trim().replace(/[\s:-]+/g, (m) => m));
}

function isSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false;
  const cells = trimmed.slice(1, -1).split('|');
  return cells.every((cell) => /^\s*:?-+:?\s*$/.test(cell));
}

/** Parse a table row into cells */
function parseTableRow(line: string): string[] {
  const trimmed = line.trim();
  // Remove leading/trailing |
  const inner = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
  const cleaned = inner.endsWith('|') ? inner.slice(0, -1) : inner;
  return cleaned.split('|').map((cell) => cell.trim());
}

interface TableData {
  headers: string[];
  rows: string[][];
}

function renderTable(table: TableData, termWidth: number): string[] {
  const colCount = table.headers.length;
  const allRows = [table.headers, ...table.rows];

  // Calculate natural column widths
  const naturalWidths: number[] = new Array(colCount).fill(0);
  for (const row of allRows) {
    for (let i = 0; i < colCount; i++) {
      const cellLen = (row[i] ?? '').length;
      if (cellLen > naturalWidths[i]) {
        naturalWidths[i] = cellLen;
      }
    }
  }

  // Available width: terminal width minus indent, borders, padding
  // Each col takes: "| content " = 3 chars overhead, plus trailing "|" = 1
  const overhead = INDENT.length + colCount * 3 + 1;
  const available = Math.max(termWidth - overhead, colCount * 8);

  // Distribute widths proportionally if they exceed available space
  const totalNatural = naturalWidths.reduce((a, b) => a + b, 0);
  const colWidths: number[] =
    totalNatural <= available
      ? naturalWidths
      : naturalWidths.map((w) => Math.max(6, Math.floor((w / totalNatural) * available)));

  const lines: string[] = [];

  // Top border
  const borderLine = INDENT + '┌' + colWidths.map((w) => '─'.repeat(w + 2)).join('┬') + '┐';
  lines.push(chalk.gray(borderLine));

  // Header row
  const headerCells = table.headers.map((cell, i) => {
    const formatted = chalk.bold(truncateCell(cell, colWidths[i]));
    return ' ' + padEnd(formatted, colWidths[i]) + ' ';
  });
  lines.push(INDENT + chalk.gray('│') + headerCells.join(chalk.gray('│')) + chalk.gray('│'));

  // Header separator
  const sepLine = INDENT + '├' + colWidths.map((w) => '─'.repeat(w + 2)).join('┼') + '┤';
  lines.push(chalk.gray(sepLine));

  // Data rows
  for (const row of table.rows) {
    const cells = row.map((cell, i) => {
      const formatted = formatInline(truncateCell(cell, colWidths[i]));
      return ' ' + padEnd(formatted, colWidths[i]) + ' ';
    });
    lines.push(INDENT + chalk.gray('│') + cells.join(chalk.gray('│')) + chalk.gray('│'));
  }

  // Bottom border
  const bottomLine = INDENT + '└' + colWidths.map((w) => '─'.repeat(w + 2)).join('┴') + '┘';
  lines.push(chalk.gray(bottomLine));

  return lines;
}

function truncateCell(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) return text;
  return text.slice(0, maxWidth - 1) + '…';
}

/**
 * Render markdown text for terminal output.
 */
export function renderMarkdown(text: string): string {
  const termWidth = process.stdout.columns || 100;
  const inputLines = text.split('\n');
  const output: string[] = [];

  let i = 0;
  while (i < inputLines.length) {
    const line = inputLines[i];
    const trimmed = line.trim();

    // --- Code blocks ---
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      if (lang) {
        output.push(INDENT + chalk.gray(`  ── ${lang} ──`));
      }
      i++;
      const codeLines: string[] = [];
      while (i < inputLines.length && !inputLines[i].trim().startsWith('```')) {
        codeLines.push(inputLines[i]);
        i++;
      }
      for (const codeLine of codeLines) {
        output.push(INDENT + chalk.green('  ' + codeLine));
      }
      if (lang) {
        output.push(INDENT + chalk.gray('  ' + '─'.repeat(Math.min(50, termWidth - 6))));
      }
      i++; // skip closing ```
      continue;
    }

    // --- Tables ---
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Collect all table lines
      const tableLines: string[] = [];
      while (
        i < inputLines.length &&
        inputLines[i].trim().startsWith('|') &&
        inputLines[i].trim().endsWith('|')
      ) {
        tableLines.push(inputLines[i]);
        i++;
      }

      if (tableLines.length >= 2) {
        // Parse: first line = header, second = separator (skip), rest = data
        const headers = parseTableRow(tableLines[0]);
        const dataStart = isSeparatorRow(tableLines[1]) ? 2 : 1;
        const rows = tableLines
          .slice(dataStart)
          .filter((l) => !isSeparatorRow(l))
          .map(parseTableRow);

        // Normalize column counts
        const colCount = headers.length;
        const normalizedRows = rows.map((row) => {
          while (row.length < colCount) row.push('');
          return row.slice(0, colCount);
        });

        output.push(...renderTable({ headers, rows: normalizedRows }, termWidth));
      } else {
        // Single pipe line, just format inline
        output.push(INDENT + formatInline(trimmed));
      }
      continue;
    }

    // --- Headers ---
    const headerMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2];
      output.push('');
      if (level === 1) {
        output.push(INDENT + chalk.cyan.bold.underline(title));
      } else if (level === 2) {
        output.push(INDENT + chalk.cyan.bold(title));
      } else if (level === 3) {
        output.push(INDENT + chalk.white.bold(title));
      } else {
        output.push(INDENT + chalk.white(title));
      }
      i++;
      continue;
    }

    // --- Horizontal rule ---
    if (/^[-*_]{3,}$/.test(trimmed)) {
      output.push(INDENT + chalk.gray('─'.repeat(Math.min(50, termWidth - 4))));
      i++;
      continue;
    }

    // --- Unordered list ---
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (ulMatch) {
      const depth = Math.floor(ulMatch[1].length / 2);
      const bullet = depth === 0 ? '•' : depth === 1 ? '◦' : '‣';
      output.push(
        INDENT + '  '.repeat(depth) + chalk.gray(bullet) + ' ' + formatInline(ulMatch[2])
      );
      i++;
      continue;
    }

    // --- Ordered list ---
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (olMatch) {
      const depth = Math.floor(olMatch[1].length / 2);
      output.push(
        INDENT + '  '.repeat(depth) + chalk.gray(olMatch[2] + '.') + ' ' + formatInline(olMatch[3])
      );
      i++;
      continue;
    }

    // --- Blockquote ---
    if (trimmed.startsWith('>')) {
      const content = trimmed.replace(/^>\s*/, '');
      output.push(INDENT + chalk.gray('│ ') + chalk.italic(formatInline(content)));
      i++;
      continue;
    }

    // --- Empty line ---
    if (!trimmed) {
      output.push('');
      i++;
      continue;
    }

    // --- Normal text ---
    output.push(INDENT + formatInline(trimmed));
    i++;
  }

  return output.join('\n');
}
