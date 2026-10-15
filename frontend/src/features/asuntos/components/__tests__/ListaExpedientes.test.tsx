import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate, NavLink } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ListaExpedientes } from '../ListaExpedientes';
import { buscarAsuntosAPI } from '../../api/asuntos';
import type { AsuntoListaAPI, AsuntosPaginaAPI } from '@/types/asunto';

vi.mock('../../api/asuntos', () => ({ buscarAsuntosAPI: vi.fn() }));

const resumen: AsuntoListaAPI = {
  id: 'asunto-120', titulo: 'Revisión de contrato', codigo_interno: 'AS-2026-120',
  radicado_oficial: 'JUZ-42', cliente_id: 'cliente-1', cliente_nombre: 'Ana Gómez',
  abogado_id: 'abogado-1', responsable_nombre: 'Alejandro', estado_id: 'estado-1',
  estado_nombre: 'En trámite', estado_color: 'mint', fecha_apertura: '2026-10-14', etapa_actual: 'Sin guía',
};
const pagina = (page = 1, total = 121): AsuntosPaginaAPI => ({
  items: [{ ...resumen, id: `asunto-${page}`, titulo: `Contrato página ${page}` }],
  pagina: page, por_pagina: 25, total,
});

function RouteInfo() {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <output aria-label="URL">{location.pathname}{location.search}</output>
    <button onClick={() => navigate(-1)}>Volver en historial</button>
  </>;
}

function renderList(path = '/oficina/asuntos', clienteId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[path]}>
    <RouteInfo />
    <Routes>
      <Route path="/oficina/asuntos" element={<ListaExpedientes clienteId={clienteId}
        responsables={[{ id: 'abogado-1', nombre: 'Alejandro', rol: 'abogado' }]}
        estados={[{ id: 'estado-1', nombre: 'En trámite', color_tipo: 'mint' }]} />} />
      <Route path="/oficina/asuntos/:id" element={<Detail />} />
    </Routes>
  </MemoryRouter></QueryClientProvider>);
  return queryClient;
}

function Detail() {
  const location = useLocation();
  return <><h2>Detalle del expediente</h2><NavLink to={{ pathname: '/oficina/asuntos', search: location.search }}>Volver a expedientes</NavLink></>;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(buscarAsuntosAPI).mockImplementation(async (filtros) => pagina(filtros.pagina));
});

describe('ListaExpedientes', () => {
  it('carga la página y filtros de la URL y muestra el total completo', async () => {
    renderList('/oficina/asuntos?pagina=3&q=contrato&responsable_id=abogado-1&estado_id=estado-1');
    expect(await screen.findByText('Contrato página 3')).toBeInTheDocument();
    expect(buscarAsuntosAPI).toHaveBeenCalledWith(expect.objectContaining({
      pagina: 3, por_pagina: 25, q: 'contrato', responsable_id: 'abogado-1', estado_id: 'estado-1',
    }));
    expect(screen.getByText('121 expedientes')).toBeInTheDocument();
    expect(screen.getByText('Página 3 de 5')).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar expediente')).toHaveValue('contrato');
    expect(screen.getByText('Radicado oficial · JUZ-42')).toBeInTheDocument();
  });

  it('cambia página y restaura los filtros mediante el historial', async () => {
    const user = userEvent.setup();
    renderList('/oficina/asuntos?q=contrato');
    await screen.findByText('Contrato página 1');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Contrato página 2')).toBeInTheDocument();
    expect(screen.getByLabelText('URL')).toHaveTextContent('q=contrato&pagina=2');
    await user.click(screen.getByRole('button', { name: 'Volver en historial' }));
    expect(await screen.findByText('Contrato página 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar expediente')).toHaveValue('contrato');
  });

  it('aplica filtros en el servidor y vuelve a la primera página', async () => {
    const user = userEvent.setup();
    renderList('/oficina/asuntos?pagina=4&q=antes');
    await screen.findByText('Contrato página 4');
    await user.clear(screen.getByLabelText('Buscar expediente'));
    await user.type(screen.getByLabelText('Buscar expediente'), 'Arriendo');
    await user.selectOptions(screen.getByLabelText('Responsable'), 'abogado-1');
    await user.selectOptions(screen.getByLabelText('Estado'), 'estado-1');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(buscarAsuntosAPI).toHaveBeenLastCalledWith(expect.objectContaining({
      pagina: 1, q: 'Arriendo', responsable_id: 'abogado-1', estado_id: 'estado-1',
    })));
    expect(screen.getByLabelText('URL')).not.toHaveTextContent('pagina=4');
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await waitFor(() => expect(screen.getByLabelText('URL')).toHaveTextContent('/oficina/asuntos'));
    expect(screen.getByLabelText('Buscar expediente')).toHaveValue('');
  });

  it('conserva los filtros al abrir un resultado y volver a la lista', async () => {
    const user = userEvent.setup();
    renderList('/oficina/asuntos?q=contrato&pagina=3');
    await user.click(await screen.findByRole('link', { name: /Contrato página 3/ }));
    expect(await screen.findByText('Detalle del expediente')).toBeInTheDocument();
    expect(screen.getByLabelText('URL')).toHaveTextContent('/oficina/asuntos/asunto-3?q=contrato&pagina=3');
    await user.click(screen.getByRole('link', { name: 'Volver a expedientes' }));
    expect(await screen.findByText('Contrato página 3')).toBeInTheDocument();
  });

  it('no presenta resultados de otra página mientras carga o falla la solicitada', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('Contrato página 1');
    vi.mocked(buscarAsuntosAPI).mockRejectedValue(new Error('Sin conexión'));
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('No pudimos consultar los expedientes')).toBeInTheDocument();
    expect(screen.queryByText('Contrato página 1')).not.toBeInTheDocument();
    vi.mocked(buscarAsuntosAPI).mockResolvedValue(pagina(2));
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Contrato página 2')).toBeInTheDocument();
  });

  it('ofrece recuperación para una página vacía después de cambiar los datos', async () => {
    const user = userEvent.setup();
    vi.mocked(buscarAsuntosAPI).mockResolvedValue({ items: [], total: 12, pagina: 3, por_pagina: 25 });
    renderList('/oficina/asuntos?pagina=3');
    expect(await screen.findByText('Esta página ya no tiene expedientes')).toBeInTheDocument();
    vi.mocked(buscarAsuntosAPI).mockResolvedValue(pagina(1, 12));
    await user.click(screen.getByRole('button', { name: 'Ir a la primera página' }));
    expect(await screen.findByText('Contrato página 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  it('consulta asuntos del cliente sin depender de los filtros de la lista global', async () => {
    renderList('/oficina/asuntos?q=otro&pagina=5&asuntos_pagina=2', 'cliente-1');
    await screen.findByText('Contrato página 2');
    expect(buscarAsuntosAPI).toHaveBeenCalledWith({ pagina: 2, por_pagina: 10, cliente_id: 'cliente-1' });
    expect(screen.queryByLabelText('Buscar expediente')).not.toBeInTheDocument();
  });

  it('el filtro sin asignar no envía otro responsable al mismo tiempo', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('Contrato página 1');
    await user.selectOptions(screen.getByLabelText('Responsable'), 'sin_asignar');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(buscarAsuntosAPI).toHaveBeenLastCalledWith(expect.objectContaining({
      sin_responsable: true, responsable_id: undefined,
    })));
  });
});
