import { ArrowRight, BookOpen, BriefcaseBusiness, LockKeyhole, Scale, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { FirmPublicSiteModel } from "@/lib/workspace-selectors";

type FirmLandingProps = {
  model: FirmPublicSiteModel;
};

export function FirmLanding({ model }: FirmLandingProps) {
  const { caseStudies, firm, guides, practiceAreas, site, valueProps } = model;
  const featuredCaseStudy = caseStudies[0];
  const practiceAreasById = new Map(practiceAreas.map((area) => [area.id, area]));
  const guidesByPracticeArea = new Map(
    practiceAreas.map((area) => [
      area.id,
      guides.filter((guide) => guide.practiceAreaId === area.id),
    ]),
  );
  const caseStudiesByPracticeArea = new Map(
    practiceAreas.map((area) => [
      area.id,
      caseStudies.filter((caseStudy) => caseStudy.practiceAreaId === area.id),
    ]),
  );

  return (
    <main className="firm-landing-shell">
      <header className="landing-header">
        <Link className="landing-brand" href="/" aria-label={`${firm.name} inicio`}>
          <span className="brand-mark">A</span>
          <span>
            <strong>{firm.name}</strong>
            <small>{firm.specialty}</small>
          </span>
        </Link>

        <nav className="landing-nav" aria-label="Navegacion principal">
          <a href="#rutas">Rutas de ayuda</a>
          <a href="#guias">Guias</a>
          <a href="#casos">Casos ejemplo</a>
        </nav>

        <div className="landing-actions">
          <Link className="secondary-button" href="/firma/login">
            <LockKeyhole size={16} />
            Acceso firma
          </Link>
          <Link className="primary-button" data-testid="landing-consult-cta" href="/consulta">
            {site.secondaryCtaLabel}
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-specialty">{firm.specialty}</span>
          <h1>{site.headline}</h1>
          <p>{site.subheadline}</p>
          <div className="landing-hero-actions">
            <a className="primary-button" href={`mailto:${firm.contactEmail}`}>
              {site.primaryCtaLabel}
              <ArrowRight size={16} />
            </a>
            <Link className="secondary-button" href="/consulta">
              {site.secondaryCtaLabel}
            </Link>
          </div>
          <p className="landing-trust">
            <ShieldCheck size={16} />
            {site.trustStatement}
          </p>
        </div>

        <div className="landing-hero-visual" aria-label="Mapa de seguimiento de insolvencia">
          <Image
            src={site.heroImageUrl}
            alt=""
            width={720}
            height={520}
            priority
          />
        </div>
      </section>

      <section className="landing-section landing-intent" aria-label="Resumen de enfoque">
        <div>
          <h2>{site.heroSummary}</h2>
        </div>
        <div className="landing-value-list">
          {valueProps.map((valueProp) => (
            <article className="landing-value-item" key={valueProp.id}>
              <Scale size={18} />
              <div>
                <h3>{valueProp.title}</h3>
                <p>{valueProp.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section" id="rutas">
        <div className="landing-section-head">
          <h2>Rutas de ayuda segun tu posicion</h2>
          <p>
            Cada ruta ordena el tipo de informacion que la firma necesita revisar antes de
            recomendar un camino procesal.
          </p>
        </div>

        <div className="practice-grid">
          {practiceAreas.map((area) => (
            <article className="practice-card" key={area.id}>
              <span>{area.audience}</span>
              <h3>{area.title}</h3>
              <p>{area.summary}</p>
              <div className="practice-related">
                {guidesByPracticeArea.get(area.id)?.[0] ? (
                  <Link href={`/guias/${guidesByPracticeArea.get(area.id)?.[0]?.slug}`}>
                    Guia: {guidesByPracticeArea.get(area.id)?.[0]?.title}
                  </Link>
                ) : null}
                {caseStudiesByPracticeArea.get(area.id)?.[0] ? (
                  <small>
                    Caso ejemplo: {caseStudiesByPracticeArea.get(area.id)?.[0]?.title}
                  </small>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-guides" id="guias">
        <div className="landing-section-head">
          <h2>Guias rapidas para llegar con informacion ordenada</h2>
          <p>
            Material introductorio para preparar documentos, preguntas y expectativas antes de
            hablar con la firma.
          </p>
        </div>

        <div className="guide-list">
          {guides.map((guide) => (
            <Link className="guide-card" href={`/guias/${guide.slug}`} key={guide.id}>
              <BookOpen size={18} />
              <span>
                {guide.readingMinutes} min
                {guide.practiceAreaId && practiceAreasById.get(guide.practiceAreaId)
                  ? ` · ${practiceAreasById.get(guide.practiceAreaId)?.title}`
                  : ""}
              </span>
              <h3>{guide.title}</h3>
              <p>{guide.summary}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="landing-section case-study-band" id="casos">
        <div className="landing-section-head">
          <h2>Casos ejemplo anonimizados</h2>
          <p>
            Estos ejemplos explican patrones de trabajo, no resultados garantizados ni datos de
            clientes reales.
          </p>
        </div>

        <div className="case-study-grid">
          {caseStudies.map((caseStudy) => (
            <article className="case-study-card" key={caseStudy.id}>
              <BriefcaseBusiness size={18} />
              {caseStudy.practiceAreaId && practiceAreasById.get(caseStudy.practiceAreaId) ? (
                <span>{practiceAreasById.get(caseStudy.practiceAreaId)?.title}</span>
              ) : null}
              <h3>{caseStudy.title}</h3>
              <p>{caseStudy.scenario}</p>
              <strong>{caseStudy.approach}</strong>
              <span>{caseStudy.disclaimer}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section portal-band">
        <div>
          <span>Seguimiento conectado</span>
          <h2>La consulta del caso vive separada del sitio publico.</h2>
          <p>
            La firma puede publicar avances y solicitudes desde su workspace; el cliente solo ve
            lo autorizado mediante su codigo o correo.
          </p>
        </div>
        <Link className="primary-button" href="/consulta">
          Consulta tu caso
          <ArrowRight size={16} />
        </Link>
      </section>

      <footer className="landing-footer">
        <div>
          <strong>{firm.name}</strong>
          <span>{firm.contactEmail}</span>
          {firm.contactPhone ? <span>{firm.contactPhone}</span> : null}
        </div>
        {featuredCaseStudy ? (
          <span>Referencia destacada: {featuredCaseStudy.title}</span>
        ) : null}
      </footer>
    </main>
  );
}
