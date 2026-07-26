import { useState } from 'react';
import { Info } from 'lucide-react';

interface TooltipProps {
  content: string;
}

export function Tooltip({ content }: TooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span 
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '6px', cursor: 'pointer' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen(!open)}
      tabIndex={0}
      aria-label={content}
    >
      <Info size={14} style={{ color: 'var(--muted)', opacity: 0.8 }} />
      {open && (
        <span 
          style={{
            position: 'absolute',
            bottom: '125%',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1e293b',
            color: '#f8fafc',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            lineHeight: '1.3',
            whiteSpace: 'normal',
            width: 'max-content',
            maxWidth: '220px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 100,
            pointerEvents: 'none'
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}
