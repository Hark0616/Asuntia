import React, { useEffect, useState } from 'react';
import { X, FolderPlus, Save } from 'lucide-react';

interface ClienteItem {
  id: string;
  nombre: string;
}

interface CrearAsuntoModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: ClienteItem;
  responsableNombre: string;
  onSubmit: (data: {
    cliente_id: string;
    fecha_apertura: string;
  }) => void;
  isLoading?: boolean;
}

function getLocalDateInputValue() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function CrearAsuntoModal({
  isOpen,
  onClose,
  cliente,
  responsableNombre,
  onSubmit,
  isLoading = false
}: CrearAsuntoModalProps) {
  const [fechaApertura, setFechaApertura] = useState(getLocalDateInputValue);

  useEffect(() => {
    if (isOpen) setFechaApertura(getLocalDateInputValue());
  }, [isOpen, cliente.id]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      cliente_id: cliente.id,
      fecha_apertura: fechaApertura,
    });
  };

  return (
    <div
      className="modal-overlay"
      onClick={() => {
        if (!isLoading) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !isLoading) onClose();
      }}
    >
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crear-asunto-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="row" style={{ gap: '10px' }}>
            <div className="brand-mark" style={{ width: '32px', height: '32px', fontSize: '16px' }}>
              <FolderPlus size={18} />
            </div>
            <div>
              <h3 id="crear-asunto-title">Abrir expediente</h3>
              <span className="muted small">Insolvencia de persona natural</span>
            </div>
          </div>
          <button 
            className="icon-button" 
            type="button" 
            onClick={onClose} 
            disabled={isLoading}
            title="Cerrar"
            style={{ width: '32px', height: '32px', minHeight: '32px' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body stack" style={{ gap: '16px' }}>
            <div className="list-card">
              <span className="muted small">Cliente</span>
              <strong>{cliente.nombre}</strong>
              <span className="muted small">Responsable inicial · {responsableNombre}</span>
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="fecha-apertura">Fecha de apertura</label>
                <input
                  id="fecha-apertura"
                  type="date"
                  autoFocus
                  required
                  value={fechaApertura}
                  onChange={(event) => setFechaApertura(event.target.value)}
                />
              </div>
            </div>

            <div className="list-card">
              <strong>Paso 1 · Recepción y evaluación inicial</strong>
              <span className="muted small">
                Se asignará como tarea a {responsableNombre}.
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button className="secondary-button" type="button" onClick={onClose} disabled={isLoading}>
              Cancelar
            </button>
            <button className="primary-button" type="submit" disabled={isLoading}>
              {isLoading ? 'Creando…' : 'Crear expediente'}
              <Save size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
