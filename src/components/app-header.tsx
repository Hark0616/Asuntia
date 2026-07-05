"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";

type AppHeaderProps = {
  areaLabel?: string;
  exitLabel?: string;
};

export function AppHeader({ areaLabel, exitLabel = "Volver al inicio" }: AppHeaderProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">A</div>
        <div>
          <h1>Asuntia</h1>
          {areaLabel ? <span>{areaLabel}</span> : null}
        </div>
      </div>

      <div className="row wrap">
        <Link className="secondary-button" href="/">
          <LogOut size={16} />
          {exitLabel}
        </Link>
      </div>
    </header>
  );
}
