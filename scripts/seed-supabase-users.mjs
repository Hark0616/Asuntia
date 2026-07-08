import { createClient } from "@supabase/supabase-js";

const DEMO_PASSWORD = "AsuntiaDemo2026!";
const DEFAULT_FIRM_ID = "firm-demo";

const demoUsers = [
  {
    email: "socia@asuntia.local",
    name: "Valeria Rios",
    role: "owner",
    createdAt: "2026-07-04T08:00:00.000Z",
  },
  {
    email: "admin@asuntia.local",
    name: "Equipo Asuntia",
    role: "admin",
    createdAt: "2026-07-04T08:05:00.000Z",
  },
  {
    email: "daniela@asuntia.local",
    name: "Daniela Torres",
    role: "lawyer",
    createdAt: "2026-07-04T08:10:00.000Z",
  },
  {
    email: "asistente@asuntia.local",
    name: "Camila Duarte",
    role: "assistant",
    createdAt: "2026-07-04T08:15:00.000Z",
  },
  {
    clientId: "client-1",
    email: "laura@constructoranorte.co",
    name: "Laura Mejia",
    role: "client",
    createdAt: "2026-07-04T08:20:00.000Z",
  },
];

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function throwIfError(error, label) {
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
}

async function listAllAuthUsers(supabase) {
  const users = [];
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    throwIfError(error, "List auth users");
    users.push(...(data?.users ?? []));

    if (!data?.users || data.users.length < perPage) {
      return users;
    }
  }
}

async function ensureAuthUser(supabase, existingUsers, user, password) {
  const existingUser = existingUsers.find(
    (item) => item.email?.toLowerCase() === user.email.toLowerCase(),
  );
  const metadata = {
    asuntia_role: user.role,
    client_id: user.clientId ?? null,
    firm_id: DEFAULT_FIRM_ID,
    name: user.name,
  };

  if (existingUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password,
      user_metadata: metadata,
    });
    throwIfError(error, `Update auth user ${user.email}`);
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    email_confirm: true,
    password,
    user_metadata: metadata,
  });
  throwIfError(error, `Create auth user ${user.email}`);
  return data.user;
}

async function existingClientIds(supabase) {
  const { data, error } = await supabase.from("clients").select("id");
  throwIfError(error, "Read clients");
  return new Set((data ?? []).map((client) => client.id));
}

async function upsertProfile(supabase, profile) {
  const { data: existingProfile, error: findError } = await supabase
    .from("profiles")
    .select("id")
    .eq("firm_id", profile.firm_id)
    .eq("email", profile.email)
    .maybeSingle();
  throwIfError(findError, `Find profile ${profile.email}`);

  if (existingProfile && existingProfile.id !== profile.id) {
    const { error } = await supabase
      .from("profiles")
      .update(profile)
      .eq("id", existingProfile.id);
    throwIfError(error, `Update profile ${profile.email}`);
    return;
  }

  const { error } = await supabase.from("profiles").upsert(profile, { onConflict: "id" });
  throwIfError(error, `Upsert profile ${profile.email}`);
}

async function main() {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const password = process.env.ASUNTIA_SUPABASE_DEMO_PASSWORD ?? DEMO_PASSWORD;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error: firmError } = await supabase.from("firms").upsert({
    created_at: "2026-07-04T08:00:00.000Z",
    id: DEFAULT_FIRM_ID,
    name: "Asuntia Demo",
  });
  throwIfError(firmError, "Upsert demo firm");

  const clientIds = await existingClientIds(supabase);
  const authUsers = await listAllAuthUsers(supabase);

  for (const user of demoUsers) {
    const authUser = await ensureAuthUser(supabase, authUsers, user, password);
    const clientId = user.clientId && clientIds.has(user.clientId) ? user.clientId : null;

    if (user.clientId && !clientId) {
      console.warn(
        `Client ${user.clientId} does not exist yet; ${user.email} profile was created without client_id.`,
      );
    }

    await upsertProfile(supabase, {
      client_id: clientId,
      created_at: user.createdAt,
      email: user.email,
      firm_id: DEFAULT_FIRM_ID,
      id: authUser.id,
      name: user.name,
      role: user.role,
      status: "active",
    });

    console.log(`Seeded ${user.email} as ${user.role}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
