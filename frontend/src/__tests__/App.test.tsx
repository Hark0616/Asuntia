import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App';
import {
  crearNovedadAPI,
  actualizarEstadoAPI,
  fetchAsuntos,
  buscarAsuntosAPI,
  fetchAsunto,
  incorporarGuiaAPI,
  fetchAsuntosPortalAPI,
  fetchClientesAPI,
  fetchEstadosAPI,
  fetchResponsablesAPI,
} from '@/features/asuntos/api/asuntos';
import { fetchCurrentUserAPI, logoutAPI } from '@/features/auth/api/auth';
import { SESSION_EXPIRED_EVENT } from '@/lib/session';
import type { User } from '@/types/api';
import type { AsuntoPortalAPI } from '@/types/portal';

vi.mock('@/features/asuntos/api/asuntos', () => ({
  fetchAsuntos: vi.fn(),
  buscarAsuntosAPI: vi.fn(),
  fetchAsunto: vi.fn(),
  incorporarGuiaAPI: vi.fn(),
  fetchAsuntosPortalAPI: vi.fn(),
  fetchClientesAPI: vi.fn(),
  fetchEstadosAPI: vi.fn(),
  fetchResponsablesAPI: vi.fn(),
  abrirAsuntoAPI: vi.fn(),
  avanzarPasoAPI: vi.fn(),
  guardarBorradorPasoAPI: vi.fn(),
  actualizarVisibilidadNovedadAPI: vi.fn(),
  crearNovedadAPI: vi.fn(),
  actualizarEstadoAPI: vi.fn(),
  asignarResponsableClienteAPI: vi.fn(),
  asignarResponsableAsuntoAPI: vi.fn(),
}));
vi.mock('@/features/auth/api/auth', () => ({
  fetchCurrentUserAPI: vi.fn(),
  logoutAPI: vi.fn(),
}));
vi.mock('@/features/documentos/components/DocumentosTab', () => ({
  DocumentosTab: () => <div>Documentos del expediente</div>,
}));
vi.mock('@/features/tareas/components/TareasAsunto', () => ({
  TareasAsunto: () => <section id="tareas-expediente" tabIndex={-1} aria-label="Tareas del expediente">Tareas del expediente</section>,
}));
vi.mock('@/features/portal-cliente/components/PortalCliente', () => ({
  PortalCliente: ({ asuntos }: { asuntos: AsuntoPortalAPI[] }) => (
    <div data-testid="portal-autorizado">
      {asuntos.map((asunto) => <span key={asunto.id}>{asunto.radicado}</span>)}
    </div>
  ),
}));

const clientUser: User = {
  id: 'acceso-1',
  email: 'cliente@example.com',
  nombre: 'Ana Cliente',
  cedula: '123456',
  rol: 'cliente',
  firma_id: 'firma-1',
};
const portalAsunto: AsuntoPortalAPI = {
  id: 'asunto-1',
  radicado: 'AS-2026-001',
  fecha_apertura: '2026-08-01',
  responsable_nombre: 'Abogada Responsable',
  ultima_novedad_at: null,
  novedades: [],
};

function renderApp(path = '/cliente', queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, retryDelay: 0 } },
})) {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

function prepareOffice(role: 'administrador' | 'auxiliar' | 'abogado' = 'administrador') {
  vi.mocked(fetchCurrentUserAPI).mockResolvedValue({ ...clientUser, rol: role });
  vi.mocked(fetchClientesAPI).mockResolvedValue([{
    id: 'cliente-1', tipo_persona: 'natural', tipo_documento: 'CC',
    numero_documento: '123456', cedula: '123456', nombre: 'Ana Cliente',
    email: 'cliente@example.com', canal_preferido: 'email', portal_habilitado: true,
    asuntos_count: 1, rol: 'cliente', created_at: '2026-08-01T12:00:00Z',
  }]);
  const asunto = {
    id: 'asunto-1', radicado: 'AS-2026-001', fecha_apertura: '2026-08-01',
    cliente_id: 'cliente-1', abogado_id: 'abogada-1', etapa_actual: 'Recepción',
    siguiente_paso: 'Preparación', ruta_codigo: 'insolvencia', paso_actual: 1,
    titulo: 'Expediente de prueba', codigo_interno: 'AS-2026-001', radicado_oficial: null,
    cliente: { id: 'cliente-1', nombre: 'Ana Cliente', email: 'cliente@example.com', numero_documento: '123456' },
    flujo_estado: 'activo' as const, pasos: [], novedades: [],
    created_at: '2026-08-01T12:00:00Z', updated_at: '2026-08-01T12:00:00Z',
  };
  vi.mocked(fetchAsuntos).mockResolvedValue([asunto]);
  vi.mocked(fetchAsunto).mockResolvedValue(asunto);
  vi.mocked(buscarAsuntosAPI).mockResolvedValue({ items: [], total: 0, pagina: 1, por_pagina: 25 });
  return asunto;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchCurrentUserAPI).mockResolvedValue(clientUser);
  vi.mocked(fetchAsuntosPortalAPI).mockResolvedValue([portalAsunto]);
  vi.mocked(fetchAsuntos).mockResolvedValue([]);
  vi.mocked(buscarAsuntosAPI).mockResolvedValue({ items: [], total: 0, pagina: 1, por_pagina: 25 });
  vi.mocked(fetchClientesAPI).mockResolvedValue([]);
  vi.mocked(fetchEstadosAPI).mockResolvedValue([]);
  vi.mocked(fetchResponsablesAPI).mockResolvedValue([]);
});

describe('App: proyección autorizada y recuperación', () => {
  it('limpia datos privados ante revocación sin repetir acciones', async () => {
    prepareOffice();
    const query = renderApp('/oficina/asuntos/asunto-1');
    expect(await screen.findByRole('heading', { name: 'Expediente de prueba' })).toBeInTheDocument();
    query.setQueryData(['privado', 'otra-firma'], { documento: 'reservado' });
    vi.mocked(fetchCurrentUserAPI).mockRejectedValue({ response: { status: 401 } });
    act(() => window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu sesión venció o cambió tu acceso');
    expect(screen.getByLabelText('Correo Institucional')).toBeInTheDocument();
    expect(query.getQueryData(['privado', 'otra-firma'])).toBeUndefined();
    expect(query.getQueryData(['asuntos', 'detalle', 'asunto-1'])).toBeUndefined();
    expect(crearNovedadAPI).not.toHaveBeenCalled();
    expect(actualizarEstadoAPI).not.toHaveBeenCalled();
  });

  it('no presenta un fallo de cierre como una sesión cerrada', async () => {
    prepareOffice();
    vi.mocked(logoutAPI).mockRejectedValue(new Error('sin conexión'));
    const query = renderApp('/oficina/asuntos/asunto-1');
    const user = userEvent.setup();
    expect(await screen.findByRole('heading', { name: 'Expediente de prueba' })).toBeInTheDocument();
    query.setQueryData(['privado'], 'conservado');
    await user.click(screen.getByRole('button', { name: /Ana Cliente/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cerrar la sesión');
    expect(screen.getByRole('heading', { name: 'Expediente de prueba' })).toBeInTheDocument();
    expect(query.getQueryData(['privado'])).toBe('conservado');
    expect(logoutAPI).toHaveBeenCalledTimes(1);
  });

  it('abre activación pública aunque exista una sesión de oficina', async () => {
    prepareOffice();
    renderApp('/activar-equipo?firma=real#invitacion=00000000-0000-0000-0000-000000000099&token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(await screen.findByRole('heading', { name: 'Activar acceso a Asuntia' })).toBeInTheDocument();
    expect(fetchClientesAPI).not.toHaveBeenCalled();
    expect(fetchAsunto).not.toHaveBeenCalled();
  });

  it('conserva la firma del enlace al cambiar entre ingreso de oficina y cliente', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchCurrentUserAPI).mockRejectedValue({ response: { status: 401 } });
    renderApp('/?firma=Oficina-Norte');
    expect(await screen.findByLabelText('Firma')).toHaveValue('oficina-norte');
    await user.clear(screen.getByLabelText('Firma'));
    await user.type(screen.getByLabelText('Firma'), 'firma-elegida');
    await user.click(screen.getByRole('button', { name: /Acceso Cliente/ }));
    expect(screen.getByLabelText('Firma')).toHaveValue('firma-elegida');
    expect(screen.getByLabelText('Cédula de ciudadanía')).toBeInTheDocument();
  });

  it('abre un asunto por URL aunque las listas de asuntos y clientes estén vacías', async () => {
    const asunto = prepareOffice();
    vi.mocked(fetchAsunto).mockResolvedValue({
      ...asunto, titulo: 'Consulta contractual', ruta_codigo: null, paso_actual: null, flujo_estado: null,
      radicado_oficial: 'JUZ-2026-42',
    });
    vi.mocked(fetchAsuntos).mockResolvedValue([]);
    vi.mocked(fetchClientesAPI).mockResolvedValue([]);
    renderApp('/oficina/asuntos/asunto-1');
    expect(await screen.findByRole('heading', { name: 'Consulta contractual' })).toBeInTheDocument();
    expect(screen.getByText('Radicado oficial · JUZ-2026-42')).toBeInTheDocument();
    expect(screen.getByLabelText('Contenido')).toBeInTheDocument();
    expect(fetchAsunto).toHaveBeenCalledWith('asunto-1');
    expect(screen.queryByText('Recepción y evaluación inicial')).not.toBeInTheDocument();
  });

  it('un fallo de detalle no abre otro expediente de la lista', async () => {
    prepareOffice();
    vi.mocked(fetchAsunto).mockRejectedValue({ response: { status: 404 } });
    renderApp('/oficina/asuntos/inexistente');
    expect(await screen.findByText('No pudimos abrir el expediente')).toBeInTheDocument();
    expect(screen.queryByLabelText('Contenido')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a expedientes' })).toBeInTheDocument();
  });

  it('incorpora la guía desde el expediente general', async () => {
    const user = userEvent.setup();
    const initial = prepareOffice();
    vi.mocked(fetchAsunto).mockResolvedValue({ ...initial, ruta_codigo: null, paso_actual: null, flujo_estado: null });
    renderApp('/oficina/asuntos/asunto-1');
    const button = await screen.findByRole('button', { name: 'Incorporar guía de insolvencia' });
    vi.mocked(incorporarGuiaAPI).mockResolvedValue(initial);
    vi.mocked(fetchAsunto).mockResolvedValue(initial);
    await user.click(button);
    await waitFor(() => expect(incorporarGuiaAPI).toHaveBeenCalledWith('asunto-1', 'insolvencia_persona_natural:v2'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Incorporar guía de insolvencia' })).not.toBeInTheDocument());
  });

  it('el enlace de agenda desplaza y enfoca las tareas del expediente', async () => {
    const previous = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    try {
      prepareOffice();
      renderApp('/oficina/asuntos/asunto-1#tareas-expediente');
      const target = await screen.findByRole('region', { name: 'Tareas del expediente' });
      await waitFor(() => expect(target).toHaveFocus());
      expect(scroll).toHaveBeenCalledWith({ block: 'start' });
    } finally {
      if (previous) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', previous);
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    }
  });

  it('consulta el contrato público sin descargar datos de oficina para clientes', async () => {
    renderApp();

    expect(await screen.findByText('AS-2026-001')).toBeInTheDocument();
    expect(fetchAsuntosPortalAPI).toHaveBeenCalledTimes(1);
    expect(fetchAsuntos).not.toHaveBeenCalled();
    expect(buscarAsuntosAPI).not.toHaveBeenCalled();
    expect(fetchClientesAPI).not.toHaveBeenCalled();
    expect(fetchEstadosAPI).not.toHaveBeenCalled();
    expect(fetchResponsablesAPI).not.toHaveBeenCalled();
  });

  it('muestra carga mientras la consulta del portal está pendiente', async () => {
    vi.mocked(fetchAsuntosPortalAPI).mockReturnValue(new Promise(() => {}));
    renderApp();

    expect(await screen.findByText('Consultando tus asuntos…')).toBeInTheDocument();
    expect(screen.queryByText('Sin expedientes activos')).not.toBeInTheDocument();
    expect(screen.queryByTestId('portal-autorizado')).not.toBeInTheDocument();
  });

  it('permite recuperar un fallo sin presentarlo como ausencia de expedientes', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchAsuntosPortalAPI).mockRejectedValue(new Error('API no disponible'));
    renderApp();

    expect(await screen.findByText('No pudimos consultar tus asuntos')).toBeInTheDocument();
    expect(screen.queryByTestId('portal-autorizado')).not.toBeInTheDocument();
    vi.mocked(fetchAsuntosPortalAPI).mockResolvedValue([portalAsunto]);
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('AS-2026-001')).toBeInTheDocument();
  });

  it('conserva la información disponible cuando falla una actualización', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    });
    queryClient.setQueryData(['portal', 'asuntos'], [portalAsunto]);
    vi.mocked(fetchAsuntosPortalAPI).mockRejectedValue(new Error('API no disponible'));
    renderApp('/cliente', queryClient);

    expect(await screen.findByText('Mostrando la última información disponible.')).toBeInTheDocument();
    expect(screen.getByText('AS-2026-001')).toBeInTheDocument();
  });

  it('distingue el fallo de expedientes de un directorio vacío en oficina', async () => {
    prepareOffice();
    vi.mocked(buscarAsuntosAPI).mockRejectedValue(new Error('API no disponible'));
    renderApp('/oficina/asuntos');

    expect(await screen.findByText('No pudimos consultar los expedientes')).toBeInTheDocument();
    expect(screen.queryByText('No hay clientes registrados')).not.toBeInTheDocument();
    expect(fetchAsuntosPortalAPI).not.toHaveBeenCalled();
  });

  it('el auxiliar registra notas privadas y no puede seleccionar publicación', async () => {
    const user = userEvent.setup();
    prepareOffice('auxiliar');
    vi.mocked(crearNovedadAPI).mockResolvedValue({});
    renderApp('/oficina/asuntos/asunto-1');

    const note = await screen.findByLabelText('Contenido');
    expect(screen.queryByLabelText('Visibilidad')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Actualizar estado')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Responsable del cliente|Abogado del asunto/ })).not.toBeInTheDocument();
    await user.type(note, 'Se revisaron los soportes.');
    await user.click(screen.getByRole('button', { name: 'Registrar nota' }));

    await waitFor(() => expect(crearNovedadAPI).toHaveBeenCalledWith('asunto-1', {
      titulo: 'Avance procesal',
      descripcion: 'Se revisaron los soportes.',
      publicado_al_cliente: false,
    }));
  });

  it('el abogado responsable actualiza el estado del expediente sin corrección administrativa', async () => {
    const user = userEvent.setup();
    prepareOffice('abogado');
    vi.mocked(fetchCurrentUserAPI).mockResolvedValue({ ...clientUser, id: 'abogada-1', rol: 'abogado' });
    vi.mocked(fetchEstadosAPI).mockResolvedValue([{ id: 'estado-1', nombre: 'En negociación', color_tipo: 'mint' }]);
    vi.mocked(actualizarEstadoAPI).mockResolvedValue({});
    renderApp('/oficina/asuntos/asunto-1');
    expect(await screen.findByText('Estado del expediente')).toBeInTheDocument();
    expect(screen.queryByText('Corrección administrativa')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Actualizar estado'), 'estado-1');
    await user.click(screen.getByRole('button', { name: 'Guardar estado' }));
    await waitFor(() => expect(actualizarEstadoAPI).toHaveBeenCalledWith('asunto-1', { estado_id: 'estado-1' }));
    expect(await screen.findByText('Estado actualizado')).toBeInTheDocument();
  });

  it('un abogado diferente no recibe controles de estado ni publicación', async () => {
    prepareOffice('abogado');
    renderApp('/oficina/asuntos/asunto-1');
    await screen.findByLabelText('Contenido');
    expect(screen.queryByLabelText('Actualizar estado')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Visibilidad')).not.toBeInTheDocument();
  });

  it('las notas comienzan privadas y un fallo conserva el texto para reintentar', async () => {
    const user = userEvent.setup();
    prepareOffice();
    vi.mocked(crearNovedadAPI).mockRejectedValue(new Error('API no disponible'));
    renderApp('/oficina/asuntos/asunto-1');

    const note = await screen.findByLabelText('Contenido');
    expect(screen.getByLabelText('Visibilidad')).toHaveValue('internal');
    await user.type(note, 'Pendiente confirmar la evidencia.');
    await user.click(screen.getByRole('button', { name: 'Registrar nota' }));

    expect(await screen.findByText('No pudimos guardar la nota. Inténtalo de nuevo.')).toBeInTheDocument();
    expect(note).toHaveValue('Pendiente confirmar la evidencia.');
    expect(crearNovedadAPI).toHaveBeenCalledWith('asunto-1', {
      titulo: 'Avance procesal',
      descripcion: 'Pendiente confirmar la evidencia.',
      publicado_al_cliente: false,
    });
  });

  it('permite publicar a administración y vuelve a privado para la siguiente nota', async () => {
    const user = userEvent.setup();
    prepareOffice();
    vi.mocked(crearNovedadAPI).mockResolvedValue({});
    renderApp('/oficina/asuntos/asunto-1');

    const note = await screen.findByLabelText('Contenido');
    await user.type(note, 'La solicitud fue radicada.');
    await user.selectOptions(screen.getByLabelText('Visibilidad'), 'client');
    await user.click(screen.getByRole('button', { name: 'Registrar nota' }));

    await waitFor(() => expect(crearNovedadAPI).toHaveBeenCalledWith('asunto-1', {
      titulo: 'Avance procesal',
      descripcion: 'La solicitud fue radicada.',
      publicado_al_cliente: true,
    }));
    await waitFor(() => expect(note).toHaveValue(''));
    expect(screen.getByLabelText('Visibilidad')).toHaveValue('internal');
  });
});
