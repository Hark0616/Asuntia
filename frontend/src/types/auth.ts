// Proyección interna del presupuesto técnico; no se expone en endpoints públicos.
export interface AuthRateLimit {
  id: string;
  firma_id: string;
  key_hash: string;
  attempts: number;
  expires_at: string;
}

export interface SolicitudAccesoResponse {
  message: string;
  expires_in_seconds: number;
}

export interface RestablecerPassword {
  firma_slug: string;
  challenge_id: string;
  token: string;
  password: string;
}
