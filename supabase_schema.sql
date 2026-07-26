-- ==============================================================================
-- ASUNTIA - Esquema de Base de Datos PostgreSQL (Compatible con Supabase)
-- Ejecutar en el SQL Editor de Supabase (https://app.supabase.com)
-- ==============================================================================

-- 1. Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla de Firmas (Multi-tenant)
CREATE TABLE IF NOT EXISTS firmas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    subdominio VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. Tabla de Usuarios (Abogados y Clientes)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL REFERENCES firmas(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NULL,
    nombre VARCHAR(255) NOT NULL,
    cedula VARCHAR(50) NOT NULL,
    rol VARCHAR(50) DEFAULT 'cliente' NOT NULL,
    telefono VARCHAR(50) NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_id UUID NULL
);

-- 4. Tabla de Estados Procesales
CREATE TABLE IF NOT EXISTS estados_procesales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL REFERENCES firmas(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(500) NULL,
    color_tipo VARCHAR(50) DEFAULT 'neutral' NOT NULL,
    orden INT DEFAULT 1 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 5. Tabla de Asuntos / Expedientes
CREATE TABLE IF NOT EXISTS asuntos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL REFERENCES firmas(id) ON DELETE CASCADE,
    radicado VARCHAR(100) UNIQUE NOT NULL,
    cliente_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    abogado_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    estado_id UUID NULL REFERENCES estados_procesales(id) ON DELETE SET NULL,
    etapa_actual VARCHAR(255) DEFAULT 'Etapa 1: Evaluación y Radicación' NOT NULL,
    siguiente_paso VARCHAR(500) DEFAULT 'Revisión inicial de documentación' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_id UUID NULL
);

-- 6. Tabla de Novedades / Avances Procesales
CREATE TABLE IF NOT EXISTS novedades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL REFERENCES firmas(id) ON DELETE CASCADE,
    asunto_id UUID NOT NULL REFERENCES asuntos(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT NOT NULL,
    publicado_al_cliente BOOLEAN DEFAULT TRUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_id UUID NULL REFERENCES users(id) ON DELETE SET NULL
);

-- Indexación de Rendimiento para Multi-tenancy
CREATE INDEX IF NOT EXISTS idx_users_firma ON users(firma_id);
CREATE INDEX IF NOT EXISTS idx_asuntos_firma ON asuntos(firma_id);
CREATE INDEX IF NOT EXISTS idx_asuntos_cliente ON asuntos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_novedades_asunto ON novedades(asunto_id);

-- ==============================================================================
-- SIEMBRA DE DATOS DE INICIALES (DEMO / PILOTO)
-- ==============================================================================

-- Firma Inicial
INSERT INTO firmas (id, nombre, subdominio, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Asuntia Legal S.A.S.', 'demo', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Usuarios Iniciales
INSERT INTO users (id, firma_id, nombre, email, cedula, rol, hashed_password) VALUES
('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Dra. Daniela Torres', 'daniela.torres@asuntia.com', '52.840.192', 'abogado', '$2b$12$R6SBpYVVGOpokqb0L5c7CO0.Sxtcca34jDY3agkZ07Gvi.UQC4Zo.'),
('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', 'Carlos Gómez Restrepo', 'carlos.gomez@email.com', '1.094.852.140', 'cliente', NULL),
('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', 'Constructora Norte S.A.S. (Laura Mejía)', 'laura@constructoranorte.co', '900.542.118-4', 'cliente', NULL)
ON CONFLICT (id) DO NOTHING;

-- Catálogo de 10 Estados Procesales
INSERT INTO estados_procesales (id, firma_id, nombre, descripcion, color_tipo, orden) VALUES
('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Sin acción aún', 'Expediente recién abierto sin actuaciones iniciales', 'warning', 1),
('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Pendiente por hacer', 'Tareas u observaciones pendientes por la firma', 'warning', 2),
('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Pendiente por corregir', 'Revisión de subsanaciones solicitadas por el juzgado o conciliador', 'danger', 3),
('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', 'Listo pero no se puede presentar', 'Documentación completa en espera de apertura de términos', 'warning', 4),
('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000001', 'Pendiente por presentar', 'Listo para radicación ante el Centro de Conciliación', 'purple', 5),
('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000001', 'Presentado', 'Solicitud formalmente radicada', 'blue', 6),
('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000001', 'En espera de respuesta', 'En traslado o auto de admisión del conciliador', 'cyan', 7),
('00000000-0000-0000-0000-000000000108', '00000000-0000-0000-0000-000000000001', 'Admitido en Centro de Conciliación', 'Auto admisorio notificado', 'mint', 8),
('00000000-0000-0000-0000-000000000109', '00000000-0000-0000-0000-000000000001', 'Activo en audiencia', 'Negociación de pasivos en desarrollo', 'mint', 9),
('00000000-0000-0000-0000-000000000110', '00000000-0000-0000-0000-000000000001', 'Cerrado / Archivado', 'Acuerdo logrado o liquidación concluida', 'neutral', 10)
ON CONFLICT (id) DO NOTHING;

-- Asuntos Iniciales
INSERT INTO asuntos (id, firma_id, radicado, cliente_id, abogado_id, estado_id, etapa_actual, siguiente_paso) VALUES
('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', 'AS-2026-001', '00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000108', 'Etapa 2: Negociación de Pasivos', 'Fijación de fecha para primera audiencia de negociación'),
('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001', 'AS-2026-002', '00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000102', 'Etapa 1: Evaluación de Pliegos', 'Recibir certificado de experiencia actualizado en PDF')
ON CONFLICT (id) DO NOTHING;

-- Novedades Iniciales
INSERT INTO novedades (id, firma_id, asunto_id, titulo, descripcion, publicado_al_cliente, created_by_id) VALUES
('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', 'Auto de Admisión Expedido', 'El Centro de Conciliación admitió formalmente la solicitud de negociación de pasivos de acuerdo con la Ley 2445.', TRUE, '00000000-0000-0000-0000-000000000010'),
('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', 'Verificación de acreencia Bancolombia', 'Borrador de conciliación de extractos bancarios antes de la audiencia.', FALSE, '00000000-0000-0000-0000-000000000010')
ON CONFLICT (id) DO NOTHING;
