import React, { useState } from 'react';
import { X, FolderPlus, Save } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface ClienteItem {
  id: string;
  nombre: string;
}

interface CrearAsuntoModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientes: ClienteItem[];
  clienteSeleccionadoId?: string;
  onSubmit: (data: {
    radicado: string;
    cliente_id: string;
  }) => void;
  isLoading?: boolean;
}

export function CrearAsuntoModal({
  isOpen,
  onClose,
  clientes,
  clienteSeleccionadoId,
  onSubmit,
  isLoading = false
}: CrearAsuntoModalProps) {
  const [radicado, setRadicado] = useState('AS-2026-006');
  const [clienteId, setClienteId] = useState(clienteSeleccionadoId || (clientes[0]?.id || ''));

  React.useEffect(() => {
    if (clienteSeleccionadoId) {
      setClienteId(clienteSeleccionadoId);
    } else if (clientes.length > 0 && !clienteId) {
      setClienteId(clientes[0].id);
    }
  }, [clienteSeleccionadoId, clientes]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!radicado.trim() || !clienteId) return;

    onSubmit({
      radicado: radicado.trim(),
      cliente_id: clienteId
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="row" style={{ gap: '10px' }}>
            <div className="brand-mark" style={{ width: '32px', height: '32px', fontSize: '16px' }}>
              <FolderPlus size={18} />
            </div>
            <div>
              <h3>Aperturar Nuevo Expediente</h3>
              <span className="muted small">El proceso iniciará automáticamente en Radicación</span>
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
            <div className="form-grid">
              <div className="field">
                <label htmlFor="radicado-asunto">
                  Número de Radicado *
                  <Tooltip content="Identificador único del asunto dentro de Asuntia (ej: AS-2026-006)." />
                </label>
                <input
                  id="radicado-asunto"
                  type="text"
                  required
                  value={radicado}
                  onChange={(e) => setRadicado(e.target.value)}
                  placeholder="AS-2026-006"
                  autoFocus
                />
              </div>

              <div className="field">
                <label htmlFor="cliente-asunto">
                  Cliente Asignado *
                  <Tooltip content="El titular del proceso que podrá consultar los avances vía OTP." />
                </label>
                <select
                  id="cliente-asunto"
                  required
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                >
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="list-card">
              <strong>Paso 1 · Radicación</strong>
              <span className="muted small">Los pasos posteriores se habilitan al completar el anterior.</span>
            </div>
          </div>

          <div className="modal-footer">
            <button className="secondary-button" type="button" onClick={onClose} disabled={isLoading}>
              Cancelar
            </button>
            <button className="primary-button" type="submit" disabled={isLoading}>
              {isLoading ? 'Creando...' : 'Crear Expediente'}
              <Save size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
