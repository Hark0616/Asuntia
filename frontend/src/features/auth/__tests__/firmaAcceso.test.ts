import { describe, expect, it } from 'vitest';
import { firmaInicial } from '../firmaAcceso';

describe('contexto de firma', () => {
  it('no presupone una firma cuando la instalación y el enlace no la indican', () => {
    expect(firmaInicial('')).toBe('');
  });
  it('usa la configuración pública de la instalación', () => {
    expect(firmaInicial('', ' Firma-Real ')).toBe('firma-real');
  });
  it('el enlace de acceso tiene prioridad y no reusa la firma de otro enlace vacío', () => {
    expect(firmaInicial('?firma=Oficina-Norte', 'oficina-sur')).toBe('oficina-norte');
    expect(firmaInicial('?firma=', 'oficina-sur')).toBe('');
  });
});
