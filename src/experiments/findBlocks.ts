// Finds every { } block in one shader file, so a counting copy can count how often each one runs.
// Pure text work with no GPU, so it can be tested. It reads the source only. It never changes the file.

export type BlockKind = 'function' | 'for' | 'while' | 'if' | 'else' | 'block';

export interface Block {
  // Unique across files: "<file>:<line of the opening brace>:<column>".
  id: string;
  file: string;
  kind: BlockKind;
  // The function this block sits in, or the function's own name for a function body.
  functionName: string;
  // 1-based lines of the opening and closing brace.
  startLine: number;
  endLine: number;
  // Indexes of the opening and closing brace in the file's text. A counter goes just after the opening one.
  openIndex: number;
  closeIndex: number;
  // The enclosing block's id, or null for a function body.
  parentId: string | null;
  // For a loop with constant bounds: the most times its body can run per run of the parent block.
  // A brace-less loop in front of it (for ... for ... {) multiplies in.
  maxPerParent: number | null;
  // The header text in front of the brace, comments removed and spaces collapsed.
  header: string;
}

export interface FileBlocks {
  file: string;
  blocks: Block[];
  // For each 1-based line: the id of the innermost block holding the line's first code character,
  // or null for blank, comment-only and top-level lines.
  lineBlock: (string | null)[];
}

// Replaces comments with spaces, keeping newlines, so every index still points at the same character.
export function blankComments(text: string): string {
  let out = '';
  let index = 0;
  while (index < text.length) {
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index);
      const stop = end === -1 ? text.length : end;
      out += ' '.repeat(stop - index);
      index = stop;
    } else if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += text.slice(index, stop).replace(/[^\n]/g, ' ');
      index = stop;
    } else {
      out += text[index];
      index += 1;
    }
  }
  return out;
}

// Integer #defines, such as AA 2, so a loop bound written as a macro can be read.
export function integerDefines(text: string): Map<string, number> {
  const defines = new Map<string, number>();
  for (const match of text.matchAll(/^\s*#define\s+(\w+)\s+(-?\d+)\s*$/gm)) {
    defines.set(match[1] as string, Number(match[2]));
  }
  return defines;
}

const FOR_HEADER = /for\s*\(\s*int\s+(\w+)\s*=\s*(-?\w+)\s*;\s*\1\s*<\s*(-?\w+)\s*;\s*(?:\1\s*\+\+|\+\+\s*\1)\s*\)/g;

function valueOf(token: string, defines: Map<string, number>): number | null {
  if (/^-?\d+$/.test(token)) return Number(token);
  return defines.get(token) ?? null;
}

// Product of the trip counts of every for header in front of a brace, or null if any bound isn't constant.
export function loopBound(header: string, defines: Map<string, number>): number | null {
  const loops = [...header.matchAll(FOR_HEADER)];
  if (loops.length === 0) return null;
  let product = 1;
  for (const loop of loops) {
    const from = valueOf(loop[2] as string, defines);
    const to = valueOf(loop[3] as string, defines);
    if (from === null || to === null) return null;
    product *= Math.max(0, to - from);
  }
  return product;
}

function kindOf(header: string, depth: number): BlockKind {
  if (depth === 0) return 'function';
  if (/^(for|while)\b/.test(header) || /\bfor\s*\(/.test(header)) return header.startsWith('while') ? 'while' : 'for';
  if (/^(else\s+)?if\b/.test(header)) return 'if';
  if (/^else\b/.test(header)) return 'else';
  return 'block';
}

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let at = 0; at < index; at += 1) if (text.charCodeAt(at) === 10) line += 1;
  return line;
}

export function findBlocks(file: string, text: string): FileBlocks {
  const code = blankComments(text);
  const defines = integerDefines(code);
  const blocks: Block[] = [];
  const stack: Block[] = [];
  // Where the current statement began: just after the last ; { or }. A ; inside for( ) doesn't end one.
  let statementStart = 0;
  let parens = 0;
  for (let index = 0; index < code.length; index += 1) {
    const char = code[index];
    if (char === '(') parens += 1;
    if (char === ')') parens -= 1;
    if (char === ';' && parens === 0) statementStart = index + 1;
    if (char === '{') {
      const header = code.slice(statementStart, index).replace(/\s+/g, ' ').trim();
      if (/^struct\b/.test(header)) throw new Error(`${file}: struct bodies aren't supported by the counter.`);
      const parent = stack[stack.length - 1] ?? null;
      const kind = kindOf(header, stack.length);
      const nameMatch = kind === 'function' ? /(\w+)\s*\([^()]*\)$/.exec(header) : null;
      const line = lineOf(code, index);
      const block: Block = {
        id: `${file}:${line}:${index - code.lastIndexOf('\n', index - 1)}`,
        file,
        kind,
        functionName: nameMatch ? (nameMatch[1] as string) : (parent?.functionName ?? '?'),
        startLine: line,
        endLine: line,
        openIndex: index,
        closeIndex: -1,
        parentId: parent?.id ?? null,
        maxPerParent: kind === 'for' ? loopBound(header, defines) : null,
        header,
      };
      blocks.push(block);
      stack.push(block);
      statementStart = index + 1;
    }
    if (char === '}') {
      const closed = stack.pop();
      if (!closed) throw new Error(`${file}: a } on line ${lineOf(code, index)} has no matching {.`);
      closed.endLine = lineOf(code, index);
      closed.closeIndex = index;
      statementStart = index + 1;
    }
  }
  if (stack.length > 0) throw new Error(`${file}: a { on line ${stack[stack.length - 1]?.startLine} is never closed.`);
  return { file, blocks, lineBlock: lineBlocks(code, blocks) };
}

// The innermost block whose braces enclose the line's first code character. A line outside every block
// that opens one, such as a one-line function, takes the block it opens.
function lineBlocks(code: string, blocks: Block[]): (string | null)[] {
  const result: (string | null)[] = [];
  let lineStart = 0;
  for (const line of code.split('\n')) {
    const lineEnd = lineStart + line.length;
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      result.push(null);
    } else {
      const first = lineStart + line.search(/\S/);
      let best: Block | null = null;
      for (const block of blocks) {
        if (block.openIndex <= first && first <= block.closeIndex && (!best || block.openIndex > best.openIndex)) best = block;
      }
      best ??= blocks.find((block) => block.openIndex >= lineStart && block.openIndex < lineEnd) ?? null;
      result.push(best?.id ?? null);
    }
    lineStart = lineEnd + 1;
  }
  return result;
}
