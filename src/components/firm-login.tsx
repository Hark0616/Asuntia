"use client";

import { BriefcaseBusiness, LockKeyhole, ShieldCheck, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import {
  authenticateDemoUser,
  authenticateFirmUser,
  DEMO_PASSWORD,
  demoUsers,
  FIRM_SESSION_KEY,
  roleLabels,
  serializeSessionUser,
} from "@/lib/auth";

const firmDemoUsers = demoUsers.filter((user) => user.role !== "client");

export function FirmLoginForm({ buttonLabel = "Iniciar sesión" }: { buttonLabel?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(firmDemoUsers[0]?.email ?? "");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const demoUser = authenticateDemoUser(email, password);

    if (demoUser?.role === "client") {
      setError("Este usuario solo puede entrar al portal cliente.");
      return;
    }

    const firmUser = authenticateFirmUser(email, password);
    if (!firmUser) {
      setError("Credenciales internas no validas.");
      return;
    }

    window.sessionStorage.setItem(FIRM_SESSION_KEY, serializeSessionUser(firmUser));
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

      <div className="demo-users" data-testid="firm-demo-users">
        <div className="row between">
          <span className="muted small">Usuarios de prueba</span>
          <span className="badge neutral">Clave unica</span>
        </div>
        {firmDemoUsers.map((user) => (
          <button
            className="demo-user-option"
            key={user.id}
            type="button"
            onClick={() => {
              setEmail(user.email);
              setPassword(DEMO_PASSWORD);
              setError("");
            }}
          >
            <span>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
            <span className="badge neutral">{roleLabels[user.role]}</span>
          </button>
        ))}
      </div>
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

        <section className="access-panel secondary-access">
          <div className="section-title">
            <div>
              <span className="badge neutral">Roles</span>
              <h2>Perfiles demo</h2>
            </div>
            <UsersRound size={18} />
          </div>
          <div className="stack">
            {demoUsers.map((user) => (
              <div className="list-card" key={user.id}>
                <div className="row between">
                  <strong>{user.name}</strong>
                  <span className="badge neutral">{roleLabels[user.role]}</span>
                </div>
                <span className="muted small">{user.email}</span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
