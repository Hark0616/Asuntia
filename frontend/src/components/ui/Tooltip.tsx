import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

import './Tooltip.css';

interface TooltipProps {
  content: string;
}

export function Tooltip({ content }: TooltipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const open = !dismissed && (hovered || focused || pinned);

  const clearHoverTimer = () => {
    if (hoverTimer.current !== null) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };
  const enterTooltip = () => {
    clearHoverTimer();
    setHovered(true);
    setDismissed(false);
  };
  const leaveTooltip = () => {
    clearHoverTimer();
    hoverTimer.current = setTimeout(() => setHovered(false), 150);
  };
  const dismiss = () => {
    clearHoverTimer();
    setPinned(false);
    setDismissed(true);
  };

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const placeTooltip = () => {
      if (!triggerRef.current || !contentRef.current) return;
      const trigger = triggerRef.current.getBoundingClientRect();
      const popup = contentRef.current.getBoundingClientRect();
      const style = getComputedStyle(contentRef.current);
      const edge = parseFloat(style.paddingLeft) || 0;
      const gap = parseFloat(style.paddingTop) || 0;
      const above = trigger.top - popup.height - gap;
      setPosition({
        left: Math.max(edge, Math.min(
          trigger.left + trigger.width / 2 - popup.width / 2,
          window.innerWidth - popup.width - edge,
        )),
        top: Math.max(edge, Math.min(
          above >= edge ? above : trigger.bottom + gap,
          window.innerHeight - popup.height - edge,
        )),
      });
    };
    const outsideTap = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !contentRef.current?.contains(target)) {
        dismiss();
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };

    placeTooltip();
    window.addEventListener('resize', placeTooltip);
    window.addEventListener('scroll', placeTooltip, true);
    document.addEventListener('pointerdown', outsideTap);
    document.addEventListener('keydown', escape);
    return () => {
      clearHoverTimer();
      window.removeEventListener('resize', placeTooltip);
      window.removeEventListener('scroll', placeTooltip, true);
      document.removeEventListener('pointerdown', outsideTap);
      document.removeEventListener('keydown', escape);
    };
  }, [open, content]);

  return (
    <span className="tooltip">
      <button
        ref={triggerRef}
        className="tooltip-trigger"
        type="button"
        aria-label="Más información"
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={enterTooltip}
        onMouseLeave={leaveTooltip}
        onFocus={() => {
          setFocused(true);
          setDismissed(false);
        }}
        onBlur={() => {
          setFocused(false);
          setPinned(false);
        }}
        onClick={(event) => {
          // El contexto no debe activar un enlace, label o summary que lo contenga.
          event.preventDefault();
          event.stopPropagation();
          setPinned(!pinned);
          setDismissed(pinned);
        }}
      >
        <Info size={14} aria-hidden="true" />
      </button>
      {open && createPortal(
        <span
          ref={contentRef}
          id={id}
          role="tooltip"
          className="tooltip-content"
          style={position || { visibility: 'hidden' }}
          onMouseEnter={enterTooltip}
          onMouseLeave={leaveTooltip}
        >
          {content}
        </span>,
        document.body,
      )}
    </span>
  );
}
