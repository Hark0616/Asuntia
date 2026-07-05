"use client";

import { BriefcaseBusiness, RefreshCcw, UserRound } from "lucide-react";
import Link from "next/link";

type AppHeaderProps = {
  active: "cliente" | "firma";
  onReset: () => void;
};

export function AppHeader({ active, onReset }: AppHeaderProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">A</div>
        <div>
          <h1>Asuntia</h1>
          <span>Casos, avances y documentos</span>
        </div>
      </div>

      <div className="row wrap">
        <button className="ghost-button" type="button" onClick={onReset}>
          <RefreshCcw size={16} />
          Reiniciar
        </button>
        <nav className="mode-switch" aria-label="Navegacion principal">
          <Link className={active === "firma" ? "active" : ""} href="/firma">
            <BriefcaseBusiness size={16} />
            Firma
          </Link>
          <Link className={active === "cliente" ? "active" : ""} href="/cliente">
            <UserRound size={16} />
            Cliente
          </Link>
        </nav>
      </div>
    </header>
  );
}
