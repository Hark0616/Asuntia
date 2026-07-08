import { ArrowLeft, ArrowRight, BookOpen, Clock, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import type { FirmGuidePageModel } from "@/lib/workspace-selectors";

type FirmGuidePageProps = {
  model: FirmGuidePageModel;
};

export function FirmGuidePage({ model }: FirmGuidePageProps) {
  const { firm, guide, practiceArea, relatedGuides, site } = model;
  const paragraphs = guide.content.split("\n\n").filter(Boolean);

  return (
    <main className="guide-page-shell">
      <header className="guide-header">
        <Link className="landing-brand" href="/" aria-label={`${firm.name} inicio`}>
          <span className="brand-mark">A</span>
          <span>
            <strong>{firm.name}</strong>
            <small>{firm.specialty}</small>
          </span>
        </Link>

        <div className="landing-actions">
          <Link className="secondary-button" href="/firma/login">
            <LockKeyhole size={16} />
            Acceso firma
          </Link>
          <Link className="primary-button" href="/consulta">
            Consulta tu caso
          </Link>
        </div>
      </header>

      <article className="guide-article">
        <Link className="guide-back-link" href="/#guias">
          <ArrowLeft size={16} />
          Volver a guias
        </Link>

        <div className="guide-article-head">
          <div className="guide-meta-row">
            {practiceArea ? <span>{practiceArea.title}</span> : null}
            <span>
              <Clock size={14} />
              {guide.readingMinutes} min
            </span>
          </div>
          <h1>{guide.title}</h1>
          <p>{guide.summary}</p>
        </div>

        <div className="guide-body">
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <section className="guide-cta-panel" aria-label="Acciones de guia">
          <div>
            <span>{site.secondaryCtaLabel}</span>
            <h2>Usa esta guia para llegar con informacion ordenada.</h2>
            <p>
              Si ya tienes un codigo o correo asociado a un asunto, revisa el avance publicado.
              Para una valoracion inicial, escribe directamente a la firma.
            </p>
          </div>
          <div className="guide-cta-actions">
            <Link className="primary-button" href="/consulta">
              Consulta tu caso
              <ArrowRight size={16} />
            </Link>
            <a className="secondary-button" href={`mailto:${firm.contactEmail}`}>
              <Mail size={16} />
              Contactar firma
            </a>
          </div>
        </section>
      </article>

      <section className="guide-related-section">
        <div className="landing-section-head">
          <h2>Guias relacionadas</h2>
          <p>
            {practiceArea
              ? `Mas contenido de ${practiceArea.title}.`
              : "Mas contenido publicado por la firma."}
          </p>
        </div>

        {relatedGuides.length > 0 ? (
          <div className="guide-list compact">
            {relatedGuides.map((relatedGuide) => (
              <Link className="guide-card" href={`/guias/${relatedGuide.slug}`} key={relatedGuide.id}>
                <BookOpen size={18} />
                <span>{relatedGuide.readingMinutes} min</span>
                <h3>{relatedGuide.title}</h3>
                <p>{relatedGuide.summary}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state compact">
            <span className="muted">No hay guias relacionadas publicadas para esta area.</span>
          </div>
        )}
      </section>
    </main>
  );
}
