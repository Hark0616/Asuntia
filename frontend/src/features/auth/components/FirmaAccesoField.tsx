import { Tooltip } from '@/components/ui/Tooltip';

interface FirmaAccesoFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function FirmaAccesoField({ value, onChange, disabled }: FirmaAccesoFieldProps) {
  return <div className="field">
    <div className="row"><label htmlFor="firma-acceso">Firma</label>
      <Tooltip content="Usa el identificador del enlace de acceso de tu firma." />
    </div>
    <input id="firma-acceso" name="firma" value={value} required maxLength={100}
      autoCapitalize="none" autoCorrect="off" spellCheck={false}
      disabled={disabled} onChange={(event) => onChange(event.target.value)} />
  </div>;
}
