import { describe, expect, test } from "vitest";
import {
  authenticateDemoUser,
  authenticateFirmUser,
  DEMO_PASSWORD,
  demoProfiles,
  getRoleCapabilities,
  parseSessionUser,
  serializeSessionUser,
} from "../../src/lib/auth";

describe("demo auth and role capabilities", () => {
  test("authenticates local firm users with explicit roles", () => {
    const user = authenticateFirmUser("  SOCIA@asuntia.local  ", DEMO_PASSWORD);

    expect(user?.name).toBe("Valeria Rios");
    expect(user?.role).toBe("owner");
    expect(getRoleCapabilities(user!.role).canManageUsers).toBe(true);
  });

  test("keeps client demo users out of the firm workspace", () => {
    const client = authenticateDemoUser("laura@constructoranorte.co", DEMO_PASSWORD);

    expect(client?.role).toBe("client");
    expect(authenticateFirmUser("laura@constructoranorte.co", DEMO_PASSWORD)).toBeNull();
    expect(getRoleCapabilities("client").canUseFirmWorkspace).toBe(false);
  });

  test("makes assistant access read-only in the firm workspace", () => {
    const assistant = authenticateFirmUser("asistente@asuntia.local", DEMO_PASSWORD);
    const capabilities = getRoleCapabilities(assistant!.role);

    expect(capabilities.canUseFirmWorkspace).toBe(true);
    expect(capabilities.canCreateCases).toBe(false);
    expect(capabilities.canManageCases).toBe(false);
  });

  test("round-trips a stored firm session against the demo profile catalog", () => {
    const profile = demoProfiles.find((item) => item.email === "daniela@asuntia.local")!;
    const session = parseSessionUser(serializeSessionUser(profile));

    expect(session?.id).toBe(profile.id);
    expect(session?.role).toBe("lawyer");
  });
});
