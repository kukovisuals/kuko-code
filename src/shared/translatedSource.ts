// Asks Chrome for the text ANGLE handed to the next compiler, through WEBGL_debug_shaders. On this Mac that
// should be Metal Shading Language. The text is measured: it is what Chrome returned for this exact shader.
// Only pages that own a GL context import this. The city never does.
import { translatedLanguage, type TranslatedLanguage } from './translatedText';

// TypeScript's DOM types don't include this extension, so its shape is declared here.
interface DebugShadersExt {
  getTranslatedShaderSource(shader: WebGLShader): string;
}

export interface Translated {
  text: string;
  language: TranslatedLanguage;
}

export function translatedSource(gl: WebGL2RenderingContext, shader: WebGLShader): Translated | null {
  const ext = gl.getExtension('WEBGL_debug_shaders') as DebugShadersExt | null;
  if (!ext) return null;
  const text = ext.getTranslatedShaderSource(shader);
  return { text, language: translatedLanguage(text) };
}
