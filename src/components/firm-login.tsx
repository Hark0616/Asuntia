"use client";

import { BriefcaseBusiness, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

export function FirmLoginForm({ buttonLabel = "Iniciar sesión" }: { buttonLabel?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!email.trim() || password.length < 4) {
      setError("Ingresa correo y clave interna.");
      return;
    }

    window.sessionStorage.setItem("asuntia.firmSession", email.trim());
    router.push("/firma");
  }

  return (
    <form className="access-form" onSubmit={handleSubmit}>
      <div className="field full">
        <label htmlFor="firm-email">Correo</label>
        <input
          autoComplete="email"
          data-testid="firm-email"
          id="firm-email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="abogado@firma.co"
          type="email"
          value={email}
        />
      </div>
      <div className="field full">
        <label htmlFor="firm-password">Clave</label>
        <input
          autoComplete="current-password"
          data-testid="firm-password"
          id="firm-password"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
      </div>

      {error ? <span className="small error-text">{error}</span> : null}

      <button className="primary-button" data-testid="firm-login" type="submit">
        <BriefcaseBusiness size={16} />
        {buttonLabel}
      </button>
    </form>
  );
}

export function FirmLogin() {
  return (
    <main className="public-shell">
      <header className="public-topbar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <h1>Asuntia</h1>
          </div>
        </div>
        <span className="access-trust">
          <ShieldCheck size={16} />
          Firma
        </span>
      </header>

      <section className="login-layout">
        <section className="access-panel primary-access">
          <div className="section-title">
            <div>
              <span className="badge neutral">Firma</span>
              <h2>Iniciar sesión</h2>
            </div>
            <LockKeyhole size={18} />
          </div>

          <FirmLoginForm />
        </section>
      </section>
    </main>
  );
}
