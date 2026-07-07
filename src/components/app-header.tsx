"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";

type AppHeaderProps = {
  areaLabel?: string;
  contextLabel?: string;
  exitLabel?: string;
  onExit?: () => void;
};

export function AppHeader({
  areaLabel,
  contextLabel,
  exitLabel = "Volver al inicio",
  onExit,
}: AppHeaderProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">A</div>
        <div>
          <h1>Asuntia</h1>
          {contextLabel || areaLabel ? <span>{contextLabel ?? areaLabel}</span> : null}
        </div>
      </div>

      <div className="row wrap">
        {onExit ? (
          <button className="secondary-button" type="button" onClick={onExit}>
            <LogOut size={16} />
            {exitLabel}
          </button>
        ) : (
          <Link className="secondary-button" href="/">
            <LogOut size={16} />
            {exitLabel}
          </Link>
        )}
      </div>
    </header>
  );
}
