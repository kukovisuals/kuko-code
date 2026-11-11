// Asks Chrome for the text ANGLE handed to the next compiler, through WEBGL_debug_shaders. On this Mac that
// should be Metal Shading Language. The text is measured: it is what Chrome returned for this exact shader.

// TypeScript's DOM types don't include this extension, so its shape is declared here.
interface DebugShadersExt {
  getTranslatedShaderSource(shader: WebGLShader): string;
}

export interface Translated {
  text: string;
  // Read from the text itself, never assumed.
  language: 'Metal Shading Language' | 'GLSL' | 'unknown';
}

export function translatedSource(gl: WebGL2RenderingContext, shader: WebGLShader): Translated | null {
  const ext = gl.getExtension('WEBGL_debug_shaders') as DebugShadersExt | null;
  if (!ext) return null;
  const text = ext.getTranslatedShaderSource(shader);
  const language = /#include\s*<metal_stdlib>|using namespace metal/.test(text)
    ? 'Metal Shading Language'
    : /^\s*#version/m.test(text)
      ? 'GLSL'
      : 'unknown';
  return { text, language };
}

// Every 1-based line of the translated text that names the user's function. ANGLE may prefix user names
// (for example "_ushape"), so both spellings are searched.
export function linesNaming(text: string, name: string): number[] {
  const pattern = new RegExp(`\\b(?:_u)?${name}\\b`);
  return text.split('\n').flatMap((line, index) => (pattern.test(line) ? [index + 1] : []));
}
