import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SHADER_FORMS, shaderFormAt, type TranslatedEvent } from '../src/city/shaderForms';
import { wrapImagePass } from '../src/shaderView/wrapShadertoy';
import { callCount, countMatches, isAngleOnly, defineNames, definitionLine, nameCount, translatedLanguage, userFunctions } from '../src/shared/translatedText';

const GLSL = `#version 300 es
#define AA 2
// float notAFunction() {
float shape(vec3 p) { return length(p); }
float map(vec3 p) {
  if (p.x > 0.0) { return 1.0; } else if (p.y > 0.0) { return 2.0; }
  return shape(p);
}
void main() {
  for (int i = 0; i < AA; i++) { map(vec3(0.0)); }
}
`;

// Shaped like what ANGLE returned on this Mac: a forward declaration, then the definition on its own line.
const MSL = `#include <metal_stdlib>
using namespace metal;
float _umap(metal::float3 _up);
float _ushape(metal::float3 _up)
{
  return metal::length(_up);
}
float _umap(metal::float3 _up)
{
  return _ushape(_up);
}
fragment ANGLE_FragmentOut main0()
{
  int _ui = 0;
  while (_ui < 2) { _umap(metal::float3(0.0)); _ui++; }
}
`;

const event = (text: string | null): TranslatedEvent => ({ type: 'translated', at: 0, glsl: GLSL, text, language: text === null ? null : translatedLanguage(text) });

describe('translated text', () => {
  it('reads the language from the text', () => {
    expect(translatedLanguage(MSL)).toBe('Metal Shading Language');
    expect(translatedLanguage(GLSL)).toBe('GLSL');
    expect(translatedLanguage('hello')).toBe('unknown');
  });

  it('finds the functions the GLSL defines, without main, comments or else if', () => {
    expect(userFunctions(GLSL)).toEqual([
      { name: 'shape', line: 4 },
      { name: 'map', line: 5 },
    ]);
  });

  it('finds a definition in both texts, skipping forward declarations', () => {
    expect(definitionLine(GLSL, 'map')).toBe(5);
    expect(definitionLine(MSL, 'map')).toBe(8);
    expect(definitionLine(MSL, 'shape')).toBe(4);
    expect(definitionLine(MSL, 'rayMarch')).toBeNull();
  });

  it('counts loops and macro names in each text', () => {
    expect(countMatches(GLSL, /\bfor\s*\(/)).toBe(1);
    expect(countMatches(MSL, /\bfor\s*\(/)).toBe(0);
    expect(countMatches(MSL, /\bwhile\s*\(/)).toBe(1);
    expect(defineNames(GLSL)).toEqual(['AA']);
    expect(nameCount(GLSL, 'AA')).toBe(2);
    expect(nameCount(MSL, 'AA')).toBe(0);
  });

  it('counts calls apart from the definition, so an unused function reads 0', () => {
    expect(callCount(GLSL, 'map')).toBe(1);
    expect(callCount(GLSL, 'shape')).toBe(1);
    expect(callCount('float unused(float x) { return x; } // unused(1.0);', 'unused')).toBe(0);
  });

  it("dims only lines that carry none of the user's names", () => {
    expect(isAngleOnly('fragment ANGLE_FragmentOut main0()')).toBe(true);
    expect(isAngleOnly('metal::float3 ANGLE_s = _umap(ANGLE_userUniforms, _up);')).toBe(false);
    expect(isAngleOnly('return _ushape(_up);')).toBe(false);
  });

  it("finds Day 442's map, shape and rayMarch in the GLSL handed to WebGL", () => {
    const read = (name: string) => readFileSync(`shaders/${name}.glsl`, 'utf8');
    const names = userFunctions(wrapImagePass(read('day442-common'), read('day442-image'))).map((fn) => fn.name);
    expect(names).toEqual(expect.arrayContaining(['map', 'shape', 'rayMarch']));
  });
});

describe('stop 4 shader form', () => {
  it('stays published without the text Chrome returned', () => {
    expect(shaderFormAt(4, null)).toEqual(SHADER_FORMS[4]);
    expect(shaderFormAt(4, event(null))?.tag).toBe('published');
  });

  it('becomes measured with the text, naming its source and size', () => {
    const form = shaderFormAt(4, event(MSL));
    expect(form?.tag).toBe('measured');
    expect(form?.form).toBe('GLSL in, Metal source out');
    expect(form?.source).toContain('WEBGL_debug_shaders.getTranslatedShaderSource');
    expect(form?.source).toContain('this exact fragment shader');
  });

  it('never changes the stops after it, which no API can read', () => {
    for (const stop of [5, 6, 7, 8]) expect(shaderFormAt(stop, event(MSL))?.tag).toBe('modeled');
  });
});
