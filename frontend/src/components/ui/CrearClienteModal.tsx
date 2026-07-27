import React, { useState } from 'react';
import { X, UserPlus, ShieldCheck } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface CrearClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { nombre: string; cedula: string; email: string; telefono?: string }) => void;
  isLoading?: boolean;
}

export function CrearClienteModal({ isOpen, onClose, onSubmit, isLoading = false }: CrearClienteModalProps) {
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !cedula.trim() || !email.trim()) return;

    onSubmit({
      nombre: nombre.trim(),
      cedula: cedula.trim(),
      email: email.trim(),
      telefono: telefono.trim() || undefined
    });

    // Limpiar formulario al enviar
    setNombre('');
    setCedula('');
    setEmail('');
    setTelefono('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="row" style={{ gap: '10px' }}>
            <div className="brand-mark" style={{ width: '32px', height: '32px', fontSize: '16px' }}>
              <UserPlus size={18} />
            </div>
            <div>
              <h3>Registrar Nuevo Cliente</h3>
              <span className="muted small">Añade una persona natural o jurídica a Asuntia</span>
            </div>
          </div>
          <button 
            className="icon-button" 
            type="button" 
            onClick={onClose} 
            title="Cerrar"
            style={{ width: '32px', height: '32px', minHeight: '32px' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body stack" style={{ gap: '16px' }}>
            <div className="field">
              <label htmlFor="nombre-cliente">
                Nombre Completo o Razón Social *
                <Tooltip content="Ejemplo: Carlos Gómez Restrepo o Transportes del Norte S.A.S." />
              </label>
              <input
                id="nombre-cliente"
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre o empresa"
                autoFocus
              />
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="cedula-cliente">
                  Cédula o NIT *
                  <Tooltip content="Formato estándar usado para la verificación OTP por correo." />
                </label>
                <input
                  id="cedula-cliente"
                  type="text"
                  required
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  placeholder="1.094.852.140"
                />
              </div>

              <div className="field">
                <label htmlFor="telefono-cliente">Teléfono (Opcional)</label>
                <input
                  id="telefono-cliente"
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="300 123 4567"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="email-cliente">
                Correo Electrónico *
                <Tooltip content="Dirección donde el cliente recibirá sus códigos de acceso OTP." />
              </label>
              <input
                id="email-cliente"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@ejemplo.com"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button className="secondary-button" type="button" onClick={onClose} disabled={isLoading}>
              Cancelar
            </button>
            <button className="primary-button" type="submit" disabled={isLoading}>
              {isLoading ? 'Registrando...' : 'Registrar Cliente'}
              <ShieldCheck size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
