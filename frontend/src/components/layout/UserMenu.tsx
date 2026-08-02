import { useEffect, useState } from 'react';
import { ChevronDown, LogOut, Settings } from 'lucide-react';

import type { User } from '@/types/api';

interface UserMenuProps {
  user: User;
  onLogout: () => void;
  onOpenSettings?: () => void;
}

const roleLabels: Record<User['rol'], string> = {
  administrador: 'Administración',
  abogado: 'Abogado',
  auxiliar: 'Auxiliar',
  cliente: 'Cliente',
};

export function UserMenu({ user, onLogout, onOpenSettings }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const initials = user.nombre
    .split(' ')
    .filter((part) => !['Dra.', 'Dr.'].includes(part))
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className="user-menu">
      <button
        type="button"
        className="user-menu-trigger"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="user-avatar" aria-hidden="true">{initials}</span>
        <span className="user-menu-identity">
          <strong>{user.nombre}</strong>
          <small>{roleLabels[user.rol]}</small>
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="user-menu-popover" role="menu">
          {onOpenSettings && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onOpenSettings();
              }}
            >
              <Settings size={16} />
              Ajustes de la firma
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
