import { AxiosError, CanceledError, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { apiClient } from '../axios';
import { advanceSessionGeneration, SESSION_EXPIRED_EVENT } from '../session';

describe('Límite de sesión HTTP', () => {
  it('notifica un 401 protegido y conserva los errores de ingreso en su formulario', async () => {
    const onExpired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError('401', 'ERR_BAD_REQUEST', config, null,
        { status: 401, statusText: 'Unauthorized', data: {}, headers: {}, config });
    });
    try {
      await expect(apiClient.get('/asuntos', { adapter })).rejects.toBeInstanceOf(AxiosError);
      expect(onExpired).toHaveBeenCalledTimes(1);
      for (const url of ['/auth/login', '/auth/otp/verify', '/auth/equipo/activar']) {
        await expect(apiClient.post(url, {}, { adapter })).rejects.toBeInstanceOf(AxiosError);
      }
      expect(onExpired).toHaveBeenCalledTimes(1);
      expect(adapter).toHaveBeenCalledTimes(4);
    } finally { window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired); }
  });

  it('descarta una respuesta tardía tras cerrar o cambiar sesión', async () => {
    let finish!: () => void;
    let started!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      started();
      await new Promise<void>(resolve => { finish = resolve; });
      return { status: 200, statusText: 'OK', data: { privado: 'sesión anterior' }, headers: {}, config };
    });
    const request = apiClient.post('/asuntos', {}, { adapter });
    const assertion = expect(request).rejects.toBeInstanceOf(CanceledError);
    await ready;
    advanceSessionGeneration();
    finish();
    await assertion;
    expect(adapter).toHaveBeenCalledTimes(1);
  });
});
