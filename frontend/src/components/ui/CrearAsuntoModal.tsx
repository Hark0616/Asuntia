import React, { useEffect, useState } from 'react';
import { X, FolderPlus, Save } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface ClienteItem {
  id: string;
  nombre: string;
}

interface EstadoItem {
  id: string;
  nombre: string;
  descripcion?: string;
}

interface CrearAsuntoModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: ClienteItem;
  responsableNombre: string;
  estados: EstadoItem[];
  onSubmit: (data: {
    cliente_id: string;
    estado_id?: string;
    siguiente_paso: string;
    fecha_apertura: string;
  }) => void;
  isLoading?: boolean;
}

export function CrearAsuntoModal({
  isOpen,
  onClose,
  cliente,
  responsableNombre,
  estados,
  onSubmit,
  isLoading = false
}: CrearAsuntoModalProps) {
  const [estadoId, setEstadoId] = useState('');
  const [siguientePaso, setSiguientePaso] = useState('Registrar radicación oficial');
  const [fechaApertura, setFechaApertura] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (isOpen) setEstadoId(estados[0]?.id || '');
  }, [estados, isOpen]);

  if (!isOpen) return null;

  const estadoSeleccionado = estados.find((estado) => estado.id === estadoId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      cliente_id: cliente.id,
      estado_id: estadoId || undefined,
      siguiente_paso: siguientePaso.trim(),
      fecha_apertura: fechaApertura,
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
              <span className="muted small">Insolvencia de persona natural</span>
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
            <div className="list-card">
              <span className="muted small">Cliente</span>
              <strong>{cliente.nombre}</strong>
              <span className="muted small">Responsable inicial · {responsableNombre}</span>
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="estado-inicial">
                  Situación inicial
                  <Tooltip content="Describe el estado operativo del expediente al abrirlo. No cambia la ruta: Radicación continúa siendo el primer paso." />
                </label>
                <select
                  id="estado-inicial"
                  value={estadoId}
                  onChange={(event) => setEstadoId(event.target.value)}
                >
                  {estados.map((estado) => (
                    <option key={estado.id} value={estado.id}>{estado.nombre}</option>
                  ))}
                </select>
                {estadoSeleccionado?.descripcion && (
                  <span className="muted small">{estadoSeleccionado.descripcion}</span>
                )}
              </div>

              <div className="field">
                <label htmlFor="fecha-apertura">Fecha de apertura</label>
                <input
                  id="fecha-apertura"
                  type="date"
                  required
                  value={fechaApertura}
                  onChange={(event) => setFechaApertura(event.target.value)}
                />
              </div>

              <div className="field full">
                <label htmlFor="siguiente-paso-inicial">Próxima acción *</label>
                <input
                  id="siguiente-paso-inicial"
                  type="text"
                  required
                  value={siguientePaso}
                  onChange={(event) => setSiguientePaso(event.target.value)}
                />
              </div>
            </div>

            <div className="list-card">
              <strong>Ruta inicial · Radicación</strong>
              <span className="muted small">El código interno se asignará al crear el expediente.</span>
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
