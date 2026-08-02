import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UserMenu } from '../UserMenu';
import type { User } from '@/types/api';


const administrator: User = {
  id: 'user-1',
  firma_id: 'firma-1',
  nombre: 'Dra. Daniela Torres',
  email: 'daniela@example.com',
  cedula: '123',
  rol: 'administrador',
};


describe('UserMenu', () => {
  it('reserva los ajustes para quien recibe el permiso administrativo', () => {
    const onSettings = vi.fn();
    render(
      <UserMenu
        user={administrator}
        onLogout={vi.fn()}
        onOpenSettings={onSettings}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Dra. Daniela Torres/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ajustes de la firma' }));
    expect(onSettings).toHaveBeenCalledOnce();
  });

  it('no muestra ajustes a un usuario sin ese permiso', () => {
    render(
      <UserMenu
        user={{ ...administrator, rol: 'abogado' }}
        onLogout={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Dra. Daniela Torres/ }));
    expect(screen.queryByRole('menuitem', { name: 'Ajustes de la firma' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });
});
