import type { Profile, UserRole } from "./types";

export const FIRM_SESSION_KEY = "asuntia.firmSession";
export const DEMO_PASSWORD = "AsuntiaDemo2026!";
export const DEFAULT_FIRM_ID = "firm-demo";

export type DemoUser = Profile & {
  password: string;
};

export type RoleCapabilities = {
  canCreateCases: boolean;
  canCreateClients: boolean;
  canManageCases: boolean;
  canManageUsers: boolean;
  canUseFirmWorkspace: boolean;
};

export const roleLabels: Record<UserRole, string> = {
  owner: "Socia",
  admin: "Administracion",
  lawyer: "Abogada",
  assistant: "Asistente",
  client: "Cliente",
};

export const demoUsers: DemoUser[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    firmId: DEFAULT_FIRM_ID,
    email: "socia@asuntia.local",
    name: "Valeria Rios",
    role: "owner",
    status: "active",
    createdAt: "2026-07-04T08:00:00.000Z",
    password: DEMO_PASSWORD,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    firmId: DEFAULT_FIRM_ID,
    email: "admin@asuntia.local",
    name: "Equipo Asuntia",
    role: "admin",
    status: "active",
    createdAt: "2026-07-04T08:05:00.000Z",
    password: DEMO_PASSWORD,
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    firmId: DEFAULT_FIRM_ID,
    email: "daniela@asuntia.local",
    name: "Daniela Torres",
    role: "lawyer",
    status: "active",
    createdAt: "2026-07-04T08:10:00.000Z",
    password: DEMO_PASSWORD,
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    firmId: DEFAULT_FIRM_ID,
    email: "asistente@asuntia.local",
    name: "Camila Duarte",
    role: "assistant",
    status: "active",
    createdAt: "2026-07-04T08:15:00.000Z",
    password: DEMO_PASSWORD,
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    firmId: DEFAULT_FIRM_ID,
    clientId: "client-1",
    email: "laura@constructoranorte.co",
    name: "Laura Mejia",
    role: "client",
    status: "active",
    createdAt: "2026-07-04T08:20:00.000Z",
    password: DEMO_PASSWORD,
  },
];

export const demoProfiles: Profile[] = demoUsers.map((user) => ({
  clientId: user.clientId,
  createdAt: user.createdAt,
  email: user.email,
  firmId: user.firmId,
  id: user.id,
  name: user.name,
  role: user.role,
  status: user.status,
}));

const capabilitiesByRole: Record<UserRole, RoleCapabilities> = {
  owner: {
    canCreateCases: true,
    canCreateClients: true,
    canManageCases: true,
    canManageUsers: true,
    canUseFirmWorkspace: true,
  },
  admin: {
    canCreateCases: true,
    canCreateClients: true,
    canManageCases: true,
    canManageUsers: true,
    canUseFirmWorkspace: true,
  },
  lawyer: {
    canCreateCases: true,
    canCreateClients: true,
    canManageCases: true,
    canManageUsers: false,
    canUseFirmWorkspace: true,
  },
  assistant: {
    canCreateCases: false,
    canCreateClients: false,
    canManageCases: false,
    canManageUsers: false,
    canUseFirmWorkspace: true,
  },
  client: {
    canCreateCases: false,
    canCreateClients: false,
    canManageCases: false,
    canManageUsers: false,
    canUseFirmWorkspace: false,
  },
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getRoleCapabilities(role: UserRole): RoleCapabilities {
  return capabilitiesByRole[role];
}

export function isFirmRole(role: UserRole) {
  return getRoleCapabilities(role).canUseFirmWorkspace;
}

export function getDemoUserByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  return demoUsers.find((user) => normalizeEmail(user.email) === normalizedEmail);
}

export function getDemoUserById(id: string) {
  return demoUsers.find((user) => user.id === id);
}

export function getDemoFirmProfiles() {
  return demoProfiles.filter((profile) => isFirmRole(profile.role));
}

export function getCaseResponsibleProfiles() {
  return demoProfiles.filter((profile) => ["owner", "admin", "lawyer"].includes(profile.role));
}

export function authenticateDemoUser(email: string, password: string) {
  const user = getDemoUserByEmail(email);

  if (!user || user.status !== "active" || user.password !== password) {
    return null;
  }

  return user;
}

export function authenticateFirmUser(email: string, password: string) {
  const user = authenticateDemoUser(email, password);

  if (!user || !isFirmRole(user.role)) {
    return null;
  }

  return user;
}

export function serializeSessionUser(profile: Profile) {
  return JSON.stringify({
    email: profile.email,
    firmId: profile.firmId,
    id: profile.id,
    name: profile.name,
    role: profile.role,
  });
}

export function parseSessionUser(raw: string | null) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Profile>;
    if (!parsed.id || !parsed.email || !parsed.name || !parsed.role || !parsed.firmId) {
      return null;
    }

    const demoUser = getDemoUserById(parsed.id);
    if (!demoUser || demoUser.status !== "active" || demoUser.email !== parsed.email) {
      return null;
    }

    return demoUser;
  } catch {
    return null;
  }
}
