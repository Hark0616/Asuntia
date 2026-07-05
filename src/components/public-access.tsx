"use client";

import { CheckCircle2, LockKeyhole, RefreshCcw, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { loadWorkspace } from "@/lib/storage";

type Challenge = {
  left: number;
  right: number;
  seed: number;
};

const initialChallenge: Challenge = {
  left: 6,
  right: 4,
  seed: 0,
};

const challengePairs = [
  [8, 3],
  [7, 5],
  [9, 4],
  [6, 8],
  [5, 7],
] as const;

export function PublicAccess() {
  const router = useRouter();
  const [trackingCode, setTrackingCode] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [challenge, setChallenge] = useState<Challenge>(initialChallenge);
  const [trackingError, setTrackingError] = useState("");

  function refreshCaptcha() {
    setChallenge((current) => {
      const nextSeed = current.seed + 1;
      const [left, right] = challengePairs[nextSeed % challengePairs.length];
      return { left, right, seed: nextSeed };
    });
    setCaptchaAnswer("");
  }

  function handleTrackingSubmit(event: FormEvent) {
    event.preventDefault();

    const expectedAnswer = challenge.left + challenge.right;
    if (Number(captchaAnswer.trim()) !== expectedAnswer) {
      setTrackingError("Confirma la operación de seguridad para continuar.");
      refreshCaptcha();
      return;
    }

    const normalizedCode = trackingCode.trim().toUpperCase();
    const workspace = loadWorkspace();
    const legalCase = workspace.cases.find(
      (item) => item.trackingCode.toUpperCase() === normalizedCode,
    );

    if (!legalCase) {
      setTrackingError("No encontramos un asunto asociado a ese código o radicado.");
      return;
    }

    window.sessionStorage.setItem("asuntia.trackingCode", legalCase.trackingCode);
    router.push(`/cliente?codigo=${encodeURIComponent(legalCase.trackingCode)}`);
  }

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
          Acceso seguro
        </span>
      </header>

      <section className="access-layout">
        <section className="access-panel primary-access">
          <div className="section-title">
            <div>
              <h3>Consultar asunto</h3>
            </div>
            <Search size={18} />
          </div>

          <form className="access-form" onSubmit={handleTrackingSubmit}>
            <div className="field full">
              <label htmlFor="public-tracking-code">Código o radicado</label>
              <input
                autoComplete="off"
                data-testid="public-tracking-code"
                id="public-tracking-code"
                onChange={(event) => setTrackingCode(event.target.value)}
                placeholder="AS-2026-001"
                required
                value={trackingCode}
              />
            </div>

            <div className="captcha-row">
              <div className="captcha-box">
                <span className="muted small">Verificación</span>
                <strong data-testid="captcha-question">
                  {challenge.left} + {challenge.right}
                </strong>
              </div>
              <input
                aria-label="Respuesta captcha"
                data-testid="captcha-answer"
                inputMode="numeric"
                onChange={(event) => setCaptchaAnswer(event.target.value)}
                placeholder="Respuesta"
                required
                value={captchaAnswer}
              />
              <button
                aria-label="Cambiar verificación"
                className="icon-button"
                type="button"
                onClick={refreshCaptcha}
              >
                <RefreshCcw size={16} />
              </button>
            </div>

            {trackingError ? <span className="small error-text">{trackingError}</span> : null}

            <button className="primary-button" data-testid="public-search" type="submit">
              <CheckCircle2 size={16} />
              Consultar asunto
            </button>
          </form>
        </section>

        <section className="access-panel internal-access">
          <div className="section-title">
            <div>
              <h3>Iniciar sesión</h3>
            </div>
            <LockKeyhole size={18} />
          </div>

          <Link className="secondary-button wide-button" data-testid="home-login" href="/firma/login">
            <LockKeyhole size={16} />
            Iniciar sesión
          </Link>
        </section>
      </section>
    </main>
  );
}
