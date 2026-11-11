// Pure text work on the shader and on the text Chrome translated it into. No GPU and no DOM, so the city,
// the program frame and the experiments page can all use it, and it can be tested.

export type TranslatedLanguage = 'Metal Shading Language' | 'GLSL' | 'unknown';

export interface TextSize {
  bytes: number;
  lines: number;
}

export interface UserFunction {
  name: string;
  // 1-based line of the definition in the GLSL handed to WebGL.
  line: number;
}

const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'return', 'else', 'do']);

// Read from the text itself, never assumed.
export function translatedLanguage(text: string): TranslatedLanguage {
  if (/#include\s*<metal_stdlib>|using namespace metal/.test(text)) return 'Metal Shading Language';
  if (/^\s*#version/m.test(text)) return 'GLSL';
  return 'unknown';
}

export function textSize(text: string): TextSize {
  return { bytes: new TextEncoder().encode(text).length, lines: text.split('\n').length };
}

// Swaps comments for spaces, keeping newlines, so line numbers and offsets stay the same.
function blankComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (comment) => comment.replace(/[^\n]/g, ' '));
}

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

// Every function the GLSL defines (a body follows the header), except main, which the wrapper writes.
export function userFunctions(glsl: string): UserFunction[] {
  const code = blankComments(glsl);
  const found: UserFunction[] = [];
  for (const match of code.matchAll(/\b([A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*\([^()]*\)\s*\{/g)) {
    const [, type, name] = match as unknown as [string, string, string];
    if (KEYWORDS.has(type) || KEYWORDS.has(name) || name === 'main') continue;
    found.push({ name, line: lineAt(code, match.index ?? 0) });
  }
  return found;
}

// ANGLE puts "_u" in front of every name the user wrote, so it can't clash with Metal's own names.
const namePattern = (name: string) => `\\b(?:_u)?${name}\\b`;

// Every 1-based line that names the function, in either spelling.
export function linesNaming(text: string, name: string): number[] {
  const pattern = new RegExp(namePattern(name));
  return text.split('\n').flatMap((line, index) => (pattern.test(line) ? [index + 1] : []));
}

// The 1-based line where the function is defined: a top-level line that starts with its return type, names
// it before a "(", and isn't a forward declaration ending in ";". Null when it isn't found by name.
export function definitionLine(text: string, name: string): number | null {
  const pattern = new RegExp(`^[A-Za-z_][\\w:<>, ]*\\s${namePattern(name)}\\s*\\(`);
  const lines = blankComments(text).split('\n');
  const index = lines.findIndex((line) => pattern.test(line) && !line.trimEnd().endsWith(';'));
  return index === -1 ? null : index + 1;
}

export function countMatches(text: string, pattern: RegExp): number {
  return [...blankComments(text).matchAll(new RegExp(pattern.source, 'g'))].length;
}

// The names of the GLSL's #define lines, like AA, in the order they appear.
export function defineNames(glsl: string): string[] {
  return [...blankComments(glsl).matchAll(/^[ \t]*#define[ \t]+([A-Za-z_]\w*)/gm)].map((match) => match[1] as string);
}

// How often the macro's name is still written in a text. After the preprocessor it should be 0.
export function nameCount(text: string, name: string): number {
  return countMatches(text, new RegExp(`\\b${name}\\b`));
}

// How many times the GLSL calls the function, not counting its own definition. Comments don't count.
export function callCount(glsl: string, name: string): number {
  return Math.max(countMatches(glsl, new RegExp(`\\b${name}\\s*\\(`)) - 1, 0);
}

// A translated line that is only ANGLE's: it names ANGLE and none of the user's "_u" names.
export function isAngleOnly(line: string): boolean {
  return line.includes('ANGLE') && !/\b_u[A-Za-z]/.test(line);
}
