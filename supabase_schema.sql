-- ========================================================
-- ASUNTIA LEGAL - ESTRUCTURA DDL COMPLETA PARA SUPABASE
-- ========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Firmas (Tenants)
CREATE TABLE IF NOT EXISTS firmas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    subdominio VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL REFERENCES firmas(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NULL,
    cedula VARCHAR(50) NULL,
    rol VARCHAR(50) NOT NULL DEFAULT 'cliente',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_id UUID NULL
);

-- 3. Catálogo de Estados Procesales
CREATE TABLE IF NOT EXISTS estados_procesales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL REFERENCES firmas(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT NULL,
    color_tipo VARCHAR(20) DEFAULT 'neutral',
    orden INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_id UUID NULL
);

-- 4. Tabla de Asuntos (Expedientes)
CREATE TABLE IF NOT EXISTS asuntos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL REFERENCES firmas(id) ON DELETE CASCADE,
    radicado VARCHAR(100) NOT NULL,
    cliente_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    abogado_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    estado_id UUID NULL REFERENCES estados_procesales(id) ON DELETE SET NULL,
    etapa_actual VARCHAR(255) NOT NULL DEFAULT 'Etapa 1: Evaluación Inicial',
    siguiente_paso VARCHAR(255) NOT NULL DEFAULT 'Revisión inicial de documentación',
    google_drive_folder_id VARCHAR(255) NULL,
    storage_folders JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_id UUID NULL
);

-- 5. Tabla de Configuración de Almacenamiento por Firma
CREATE TABLE IF NOT EXISTS firma_storage_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL UNIQUE REFERENCES firmas(id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL DEFAULT 'mock',
    auth_type VARCHAR(30) NOT NULL DEFAULT 'none',
    oauth_refresh_token_encrypted TEXT NULL,
    oauth_access_token_encrypted TEXT NULL,
    oauth_token_expires_at TIMESTAMP WITH TIME ZONE NULL,
    root_folder_id VARCHAR(255) NULL,
    root_folder_name VARCHAR(255) DEFAULT 'Asuntia_Expedientes',
    last_verified_at TIMESTAMP WITH TIME ZONE NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_id UUID NULL
);

-- 6. Tabla de Novedades Procesales
CREATE TABLE IF NOT EXISTS novedades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL REFERENCES firmas(id) ON DELETE CASCADE,
    asunto_id UUID NOT NULL REFERENCES asuntos(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT NOT NULL,
    publicado_al_cliente BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_id UUID NULL
);

-- 7. Tabla de Documentos del Asunto (Gestión Documental)
CREATE TABLE IF NOT EXISTS documentos_asunto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL REFERENCES firmas(id) ON DELETE CASCADE,
    asunto_id UUID NOT NULL REFERENCES asuntos(id) ON DELETE CASCADE,
    nombre_funcional VARCHAR(255) NOT NULL,
    tipo_documental VARCHAR(50) NOT NULL DEFAULT 'otro',
    provider VARCHAR(30) NOT NULL DEFAULT 'google_drive',
    external_file_id VARCHAR(255) NOT NULL,
    web_view_url TEXT NOT NULL,
    web_download_url TEXT NULL,
    mime_type VARCHAR(100) NULL,
    tamano_bytes BIGINT NULL,
    compartido_con_cliente BOOLEAN DEFAULT FALSE,
    estado_revision VARCHAR(50) DEFAULT 'recibido',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_id UUID NULL
);

-- Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_users_firma ON users(firma_id);
CREATE INDEX IF NOT EXISTS idx_asuntos_firma ON asuntos(firma_id);
CREATE INDEX IF NOT EXISTS idx_asuntos_cliente ON asuntos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_novedades_asunto ON novedades(asunto_id);
CREATE INDEX IF NOT EXISTS idx_documentos_asunto ON documentos_asunto(asunto_id);
CREATE INDEX IF NOT EXISTS idx_firma_storage_firma ON firma_storage_config(firma_id);

-- Datos Semilla Básicos
INSERT INTO firmas (id, nombre, subdominio) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Asuntia Legal S.A.S.', 'demo')
ON CONFLICT (id) DO NOTHING;
