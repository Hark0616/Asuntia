import { demoProfiles } from "./auth";
import type { WorkspaceData } from "./types";

export const seedData: WorkspaceData = {
  firms: [
    {
      id: "firm-demo",
      name: "Asuntia Insolvencia",
      slug: "asuntia-insolvencia",
      subdomain: "cliente1",
      specialty: "Derecho de la insolvencia",
      contactEmail: "contacto@asuntia.local",
      contactPhone: "+57 300 000 0000",
      createdAt: "2026-07-04T08:00:00.000Z",
    },
  ],
  publicSites: [
    {
      id: "site-firm-demo",
      firmId: "firm-demo",
      headline: "Insolvencia con estrategia, orden y seguimiento claro",
      subheadline:
        "Acompanamos procesos de reorganizacion, negociacion de deudas y liquidacion con informacion trazable desde el primer dia.",
      heroSummary:
        "Un equipo legal enfocado en convertir documentos dispersos, presion de acreedores y proximos vencimientos en una ruta de accion comprensible.",
      trustStatement:
        "Cada cliente puede consultar el avance publicado de su proceso sin llamadas innecesarias y sin exponer informacion interna de la firma.",
      primaryCtaLabel: "Solicitar valoracion",
      secondaryCtaLabel: "Consulta tu caso",
      heroImageUrl: "/tenant-assets/insolvencia-hero.svg",
      status: "published",
      updatedAt: "2026-07-08T08:00:00.000Z",
    },
  ],
  practiceAreas: [
    {
      id: "area-persona-natural",
      firmId: "firm-demo",
      slug: "persona-natural",
      title: "Persona natural no comerciante",
      summary:
        "Revision de obligaciones, capacidad de pago y ruta de negociacion cuando la deuda ya no se puede atender normalmente.",
      audience: "Deudores personales",
      sortOrder: 10,
    },
    {
      id: "area-empresa",
      firmId: "firm-demo",
      slug: "empresa",
      title: "Empresa en reorganizacion",
      summary:
        "Preparacion documental, lectura de flujo de caja y estrategia con acreedores para preservar continuidad cuando sea viable.",
      audience: "Empresas y administradores",
      sortOrder: 20,
    },
    {
      id: "area-acreedores",
      firmId: "firm-demo",
      slug: "acreedores",
      title: "Acreedores",
      summary:
        "Analisis de recuperacion, riesgos procesales y actuaciones oportunas dentro de procesos de insolvencia.",
      audience: "Acreedores y areas financieras",
      sortOrder: 30,
    },
    {
      id: "area-liquidacion",
      firmId: "firm-demo",
      slug: "liquidacion",
      title: "Liquidacion y cierre ordenado",
      summary:
        "Acompanamiento para proteger informacion, activos e intereses cuando la continuidad del negocio no es viable.",
      audience: "Empresas en cierre",
      sortOrder: 40,
    },
  ],
  guides: [
    {
      id: "guide-documentos-antes-de-insolvencia",
      firmId: "firm-demo",
      practiceAreaId: "area-empresa",
      slug: "documentos-antes-de-insolvencia",
      title: "Preparar documentos antes de iniciar una insolvencia",
      summary:
        "Un mapa practico de informacion financiera, contractual y operativa que suele ordenar la primera valoracion del caso.",
      content:
        "La preparacion documental no decide el resultado del proceso, pero si cambia la calidad de la primera conversacion. Estados financieros, inventarios de obligaciones, contratos relevantes, litigios activos y flujo de caja proyectado permiten entender que tan urgente es actuar.\n\nPara una empresa, la pregunta inicial suele ser si existe una ruta razonable de continuidad. Para una persona natural, el foco esta en ordenar acreedores, ingresos, gastos y soportes. En ambos casos conviene separar hechos comprobables de expectativas.\n\nEsta guia es informativa y no reemplaza una valoracion juridica. La estrategia depende del tipo de deudor, de los acreedores, de los terminos vencidos y de la autoridad competente.",
      readingMinutes: 4,
      status: "published",
      sortOrder: 10,
      publishedAt: "2026-07-08T08:00:00.000Z",
    },
    {
      id: "guide-reorganizacion-vs-liquidacion",
      firmId: "firm-demo",
      practiceAreaId: "area-liquidacion",
      slug: "reorganizacion-vs-liquidacion",
      title: "Reorganizacion o liquidacion: que cambia en la estrategia",
      summary:
        "Diferencias de enfoque cuando el objetivo es preservar una empresa viable o cerrar de forma ordenada.",
      content:
        "La reorganizacion se analiza cuando el negocio conserva elementos de viabilidad y existe una ruta para normalizar relaciones comerciales y de credito. La liquidacion parte de una premisa distinta: ordenar el cierre y la realizacion de activos disponibles.\n\nLa decision no deberia tomarse por intuicion ni por presion aislada de un acreedor. Requiere revisar contratos, obligaciones laborales, activos, caja, contingencias y capacidad real de cumplir un acuerdo.\n\nLa firma usa esta distincion para definir que informacion pedir primero y como explicar al cliente el estado del proceso sin prometer un resultado juridico.",
      readingMinutes: 5,
      status: "published",
      sortOrder: 20,
      publishedAt: "2026-07-08T08:05:00.000Z",
    },
    {
      id: "guide-negociacion-deudas-persona-natural",
      firmId: "firm-demo",
      practiceAreaId: "area-persona-natural",
      slug: "negociacion-deudas-persona-natural",
      title: "Negociacion de deudas para persona natural no comerciante",
      summary:
        "Que revisar antes de una negociacion: acreedores, ingresos, gastos, soportes y expectativas realistas.",
      content:
        "Antes de iniciar una ruta de negociacion, la persona debe tener clara la lista de obligaciones, fechas de mora, garantias, ingresos disponibles y gastos indispensables. Esa informacion permite distinguir urgencia financiera de riesgo juridico.\n\nTambien importa separar deudas personales, obligaciones respaldadas por garantias y compromisos con codeudores. Una buena preparacion reduce reprocesos y evita que la conversacion se base en cifras incompletas.\n\nEsta guia solo resume criterios de organizacion. La aplicacion concreta depende de la situacion personal y de la documentacion revisada.",
      readingMinutes: 3,
      status: "published",
      sortOrder: 30,
      publishedAt: "2026-07-08T08:10:00.000Z",
    },
    {
      id: "guide-acreedor-en-insolvencia",
      firmId: "firm-demo",
      practiceAreaId: "area-acreedores",
      slug: "acreedor-en-insolvencia",
      title: "Como ubicarse como acreedor en un proceso de insolvencia",
      summary:
        "Senales y documentos que ayudan a decidir si conviene reclamar, negociar o monitorear el proceso.",
      content:
        "El acreedor no siempre necesita la misma respuesta. Algunas situaciones exigen actuar rapido; otras requieren monitorear terminos, validar soportes y medir el costo de cada actuacion.\n\nLa informacion basica incluye titulo de la obligacion, estado de pagos, garantias, comunicaciones previas y relacion comercial con el deudor. Con eso se puede estimar el margen de recuperacion y la mejor forma de participar.\n\nEl objetivo es tomar decisiones informadas, no aumentar ruido operativo ni duplicar gestiones sin efecto practico.",
      readingMinutes: 4,
      status: "published",
      sortOrder: 40,
      publishedAt: "2026-07-08T08:15:00.000Z",
    },
    {
      id: "guide-borrador-interno",
      firmId: "firm-demo",
      practiceAreaId: "area-empresa",
      slug: "borrador-interno",
      title: "Borrador interno no publicado",
      summary: "Contenido de prueba que no debe aparecer en la landing publica.",
      content: "Este contenido permanece oculto hasta que la firma lo publique.",
      readingMinutes: 2,
      status: "draft",
      sortOrder: 50,
    },
  ],
  caseStudies: [
    {
      id: "case-study-empresa-acreedores-financieros",
      firmId: "firm-demo",
      practiceAreaId: "area-empresa",
      slug: "empresa-acreedores-financieros",
      title: "Empresa con cartera presionada por acreedores financieros",
      scenario:
        "Una compania con contratos activos necesitaba ordenar obligaciones vencidas sin perder trazabilidad interna.",
      approach:
        "Se separaron obligaciones por acreedor, soporte y urgencia, y se construyo una ruta de comunicacion para decisiones de gerencia.",
      outcomeSummary:
        "El equipo directivo obtuvo un mapa de riesgos y una secuencia clara de proximas acciones antes de cualquier radicacion.",
      disclaimer:
        "Caso anonimizado con fines informativos. No representa garantia de resultado.",
      sortOrder: 10,
    },
    {
      id: "case-study-persona-natural-obligaciones-dispersas",
      firmId: "firm-demo",
      practiceAreaId: "area-persona-natural",
      slug: "persona-natural-obligaciones-dispersas",
      title: "Persona natural con obligaciones dispersas",
      scenario:
        "Una persona recibia cobros de varios acreedores y no tenia una vista completa de saldos, fechas y soportes.",
      approach:
        "La firma organizo acreedores, documentos y capacidad de pago para preparar una conversacion juridica realista.",
      outcomeSummary:
        "El cliente pudo entender que informacion faltaba y que pasos dependian de su documentacion.",
      disclaimer:
        "Caso anonimizado con fines informativos. La estrategia depende de cada expediente.",
      sortOrder: 20,
    },
    {
      id: "case-study-acreedor-monitoreo",
      firmId: "firm-demo",
      practiceAreaId: "area-acreedores",
      slug: "acreedor-monitoreo",
      title: "Acreedor que necesitaba actuar sin duplicar gestiones",
      scenario:
        "Un acreedor comercial queria proteger su posicion sin iniciar actuaciones repetidas o desconectadas del proceso.",
      approach:
        "Se revisaron soportes, terminos y comunicaciones para definir una estrategia de seguimiento proporcional.",
      outcomeSummary:
        "La empresa conto con criterios de decision y una bitacora de seguimiento para su area financiera.",
      disclaimer:
        "Caso anonimizado con fines informativos. No constituye concepto juridico.",
      sortOrder: 30,
    },
  ],
  valueProps: [
    {
      id: "value-diagnostico-documental",
      firmId: "firm-demo",
      title: "Diagnostico documental antes de actuar",
      body:
        "Ordenamos soportes, obligaciones y terminos para que la decision juridica no nazca de informacion incompleta.",
      sortOrder: 10,
    },
    {
      id: "value-estrategia-acreedor",
      firmId: "firm-demo",
      title: "Estrategia por tipo de acreedor",
      body:
        "Diferenciamos urgencias, garantias y conversaciones para que cada accion tenga una razon procesal y operativa.",
      sortOrder: 20,
    },
    {
      id: "value-seguimiento-visible",
      firmId: "firm-demo",
      title: "Seguimiento visible para el cliente",
      body:
        "El cliente consulta avances, hitos y proximas acciones desde Asuntia, mientras la firma conserva su informacion interna separada.",
      sortOrder: 30,
    },
  ],
  profiles: demoProfiles,
  clients: [
    {
      id: "client-1",
      name: "Constructora Norte S.A.S.",
      contactName: "Laura Mejia",
      email: "laura@constructoranorte.co",
      phone: "300 123 4567",
      createdAt: "2026-07-01T09:00:00.000Z",
    },
    {
      id: "client-2",
      name: "Andes Foods",
      contactName: "Carlos Rojas",
      email: "carlos@andesfoods.co",
      phone: "310 555 0140",
      createdAt: "2026-07-02T11:30:00.000Z",
    },
  ],
  cases: [
    {
      id: "case-1",
      clientId: "client-1",
      trackingCode: "AS-2026-001",
      title: "Licitacion municipal 2026",
      description: "Revision de pliegos, requisitos habilitantes y observaciones.",
      status: "requiere_cliente",
      priority: "alta",
      responsible: "Daniela Torres",
      nextStep: "Recibir certificado de experiencia actualizado.",
      createdAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-04T14:15:00.000Z",
    },
    {
      id: "case-2",
      clientId: "client-1",
      trackingCode: "AS-2026-002",
      title: "Contrato de obra con proveedor",
      description: "Ajuste de clausulas de responsabilidad, pagos y terminacion.",
      status: "en_curso",
      priority: "normal",
      responsible: "Martin Acosta",
      nextStep: "Enviar version marcada al cliente.",
      createdAt: "2026-06-28T15:20:00.000Z",
      updatedAt: "2026-07-03T16:45:00.000Z",
    },
    {
      id: "case-3",
      clientId: "client-2",
      trackingCode: "AS-2026-003",
      title: "Concepto laboral sobre turnos",
      description: "Analisis de modificacion de turnos y riesgos laborales.",
      status: "en_espera",
      priority: "normal",
      responsible: "Sofia Bernal",
      nextStep: "Esperar informacion de nomina solicitada.",
      createdAt: "2026-07-02T13:00:00.000Z",
      updatedAt: "2026-07-03T09:10:00.000Z",
    },
  ],
  milestones: [
    {
      id: "milestone-1",
      caseId: "case-1",
      title: "Apertura del asunto",
      description: "La firma registro el asunto y asigno el equipo responsable.",
      detail:
        "Se valido la informacion inicial del cliente, el objetivo del proceso y los responsables de seguimiento.",
      date: "2026-07-01",
      status: "completed",
      evidenceEnabled: false,
    },
    {
      id: "milestone-2",
      caseId: "case-1",
      title: "Revision inicial de pliegos",
      description: "Se revisaron requisitos habilitantes y documentos disponibles.",
      detail:
        "El equipo identifico los documentos que ya cumplen y marco los faltantes para completar la presentacion.",
      date: "2026-07-03",
      status: "completed",
      evidenceEnabled: false,
    },
    {
      id: "milestone-3",
      caseId: "case-1",
      title: "Recoleccion de evidencia",
      description:
        "Estamos esperando el certificado de experiencia actualizado para continuar con observaciones.",
      detail:
        "Cuando el cliente cargue el soporte, el equipo lo revisara y definira si queda listo para radicar.",
      date: "2026-07-08",
      status: "current",
      evidenceEnabled: true,
    },
    {
      id: "milestone-4",
      caseId: "case-1",
      title: "Radicacion de observaciones",
      description: "La firma preparara y radicara observaciones si aplica.",
      detail:
        "Esta etapa depende de completar la informacion pendiente y validar la estrategia final.",
      date: "2026-07-10",
      status: "upcoming",
      evidenceEnabled: false,
    },
    {
      id: "milestone-5",
      caseId: "case-1",
      title: "Seguimiento a respuesta",
      description: "Se hara seguimiento a la respuesta de la entidad.",
      detail:
        "La firma informara cualquier decision relevante y los siguientes pasos del proceso.",
      date: "2026-07-15",
      status: "upcoming",
      evidenceEnabled: false,
    },
    {
      id: "milestone-6",
      caseId: "case-2",
      title: "Recepcion de minuta",
      description: "La firma recibio y clasifico la minuta enviada por el cliente.",
      detail: "El documento quedo asociado al asunto para revision contractual.",
      date: "2026-06-28",
      status: "completed",
      evidenceEnabled: false,
    },
    {
      id: "milestone-7",
      caseId: "case-2",
      title: "Revision contractual",
      description: "Estamos ajustando clausulas de pagos, multas y terminacion.",
      detail:
        "El abogado responsable prepara una version marcada para compartir con el cliente.",
      date: "2026-07-04",
      status: "current",
      evidenceEnabled: false,
    },
    {
      id: "milestone-8",
      caseId: "case-2",
      title: "Aprobacion cliente",
      description: "El cliente revisara la version marcada y autorizara cierre.",
      detail: "La firma esperara comentarios finales antes de preparar version limpia.",
      date: "2026-07-07",
      status: "upcoming",
      evidenceEnabled: true,
    },
    {
      id: "milestone-9",
      caseId: "case-3",
      title: "Solicitud de informacion laboral",
      description: "Se solicito informacion de nomina y turnos.",
      detail: "El equipo requiere datos operativos para evaluar riesgos laborales.",
      date: "2026-07-03",
      status: "current",
      evidenceEnabled: true,
    },
    {
      id: "milestone-10",
      caseId: "case-3",
      title: "Emision de concepto",
      description: "La firma preparara concepto juridico con recomendaciones.",
      detail: "El concepto se publicara cuando se revise la informacion pendiente.",
      date: "2026-07-11",
      status: "upcoming",
      evidenceEnabled: false,
    },
  ],
  updates: [
    {
      id: "update-1",
      caseId: "case-1",
      author: "Daniela Torres",
      body: "Se revisaron los requisitos habilitantes y se identifico un documento pendiente.",
      visibility: "client",
      createdAt: "2026-07-04T14:15:00.000Z",
    },
    {
      id: "update-2",
      caseId: "case-1",
      author: "Daniela Torres",
      body: "Pendiente validar internamente si conviene presentar observacion adicional.",
      visibility: "internal",
      createdAt: "2026-07-04T14:25:00.000Z",
    },
    {
      id: "update-3",
      caseId: "case-2",
      author: "Martin Acosta",
      body: "Se ajustaron clausulas de pagos parciales y multas por incumplimiento.",
      visibility: "client",
      createdAt: "2026-07-03T16:45:00.000Z",
    },
  ],
  requests: [
    {
      id: "request-1",
      caseId: "case-1",
      title: "Certificado de experiencia",
      detail: "Enviar certificado actualizado en PDF.",
      owner: "Laura Mejia",
      dueDate: "2026-07-08",
      status: "pendiente",
      createdAt: "2026-07-04T14:20:00.000Z",
    },
    {
      id: "request-2",
      caseId: "case-3",
      title: "Reporte de turnos",
      detail: "Cargar archivo con turnos de los ultimos tres meses.",
      owner: "Carlos Rojas",
      dueDate: "2026-07-09",
      status: "en_progreso",
      createdAt: "2026-07-03T09:10:00.000Z",
    },
  ],
  documents: [
    {
      id: "doc-1",
      caseId: "case-1",
      name: "Pliego_condiciones_v2.pdf",
      category: "Licitacion",
      visibility: "client",
      status: "aprobado",
      uploadedAt: "2026-07-03T10:30:00.000Z",
    },
    {
      id: "doc-2",
      caseId: "case-2",
      name: "Contrato_obra_revision.docx",
      category: "Contrato",
      visibility: "client",
      status: "en_revision",
      uploadedAt: "2026-07-03T16:40:00.000Z",
    },
  ],
  audit: [
    {
      id: "audit-1",
      actor: "Sistema demo",
      action: "Cargo datos iniciales",
      target: "Workspace",
      createdAt: "2026-07-04T08:00:00.000Z",
    },
  ],
};
