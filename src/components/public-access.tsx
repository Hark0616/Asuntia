"use client";

import { LockKeyhole, RefreshCcw, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { loadWorkspaceData } from "@/lib/storage";
import { resolvePublicAccess } from "@/lib/workspace-selectors";

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
  const [accessQuery, setAccessQuery] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [challenge, setChallenge] = useState<Challenge>(initialChallenge);
  const [trackingError, setTrackingError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  function refreshCaptcha() {
    setChallenge((current) => {
      const nextSeed = current.seed + 1;
      const [left, right] = challengePairs[nextSeed % challengePairs.length];
      return { left, right, seed: nextSeed };
    });
    setCaptchaAnswer("");
  }

  async function handleTrackingSubmit(event: FormEvent) {
    event.preventDefault();
    setTrackingError("");

    const expectedAnswer = challenge.left + challenge.right;
    if (Number(captchaAnswer.trim()) !== expectedAnswer) {
      setTrackingError("Confirma la operación de seguridad para continuar.");
      refreshCaptcha();
      return;
    }

    setIsSearching(true);
    const workspace = await loadWorkspaceData();
    setIsSearching(false);
    const target = resolvePublicAccess(workspace, accessQuery);

    if (!target) {
      setTrackingError("No encontramos un asunto asociado a ese dato.");
      return;
    }

    if (target.kind === "case") {
      window.sessionStorage.setItem("asuntia.accessQuery", target.legalCase.trackingCode);
      router.push(`/cliente?codigo=${encodeURIComponent(target.legalCase.trackingCode)}`);
      return;
    }

    window.sessionStorage.setItem("asuntia.accessQuery", accessQuery.trim());
    router.push(`/cliente?consulta=${encodeURIComponent(accessQuery.trim())}`);
  }

  return (
    <main className="public-shell public-consult-shell">
      <header className="public-topbar">
        <Link className="brand" href="/">
          <div className="brand-mark">A</div>
          <div>
            <h1>Asuntia Insolvencia</h1>
          </div>
        </Link>
        <span className="access-trust">
          <ShieldCheck size={16} />
          Acceso seguro
        </span>
      </header>

      <section className="consult-stage">
        <div className="consult-copy">
          <span className="consult-kicker">Portal de seguimiento</span>
          <h2>Consulta el estado de tu proceso</h2>
          <p>
            Ingresa el radicado o codigo entregado por la firma para ver el avance
            publicado.
          </p>
        </div>

        <section className="consult-panel" aria-label="Consulta de asunto">
          <form className="access-form" onSubmit={handleTrackingSubmit}>
            <div className="field full consult-field">
              <label className="sr-only" htmlFor="public-tracking-code">
                Numero de radicado o codigo
              </label>
              <input
                autoComplete="off"
                data-testid="public-tracking-code"
                id="public-tracking-code"
                onChange={(event) => setAccessQuery(event.target.value)}
                placeholder="Ingresa tu numero de radicado o codigo"
                required
                value={accessQuery}
              />
            </div>

            <div className="captcha-row security-check">
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

            <button
              className="primary-button"
              data-testid="public-search"
              disabled={isSearching}
              type="submit"
            >
              <Search size={17} />
              {isSearching ? "Consultando" : "Consultar"}
            </button>

            <p className="consult-trust">
              <ShieldCheck size={14} />
              Consulta cifrada y protegida bajo secreto profesional.
            </p>
          </form>

          <Link className="firm-access-link" data-testid="home-login" href="/firma/login">
            <LockKeyhole size={16} />
            Acceso firma
          </Link>
        </section>
      </section>
    </main>
  );
}
