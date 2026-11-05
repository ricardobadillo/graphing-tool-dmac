import { buildShareUrl, decodeShare, encodeShare } from './share';

describe('enlaces para compartir', () => {
  it('codifica y decodifica un estado del graficador', () => {
    const data = {
      functions: [{ expression: 'sin(x)', color: '#38bdf8', visible: true }],
      centerX: 1,
      centerY: -2,
      pixelsPerUnit: 48,
    };

    const token = encodeShare('plot', data);
    const decoded = decodeShare<typeof data>(`#share=${token}`);

    expect(decoded?.tool).toBe('plot');
    expect(decoded?.data).toEqual(data);
  });

  it('acepta el token con o sin el prefijo share=', () => {
    const token = encodeShare('structures', { structure: 'bst' });

    expect(decodeShare(`#${token}`)?.tool).toBe('structures');
    expect(decodeShare(`#share=${token}`)?.tool).toBe('structures');
  });

  it('rechaza tokens vacíos, corruptos o demasiado largos', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('#share=@@@')).toBeNull();
    expect(decodeShare(`#share=${'a'.repeat(64_001)}`)).toBeNull();
  });

  it('rechaza versiones y herramientas desconocidas', () => {
    const invalid = btoa(JSON.stringify({ v: 2, tool: 'plot', data: {} }));
    const unknownTool = btoa(JSON.stringify({ v: 1, tool: 'other', data: {} }));

    expect(decodeShare(`#share=${invalid}`)).toBeNull();
    expect(decodeShare(`#share=${unknownTool}`)).toBeNull();
  });

  it('construye una URL con el hash de compartir', () => {
    const url = buildShareUrl('plot', { centerX: 0 });

    expect(url).toContain('#share=');
    expect(decodeShare(new URL(url).hash)?.tool).toBe('plot');
  });
});
