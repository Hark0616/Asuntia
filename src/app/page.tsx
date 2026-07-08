import { FirmLanding } from "@/components/firm-landing";
import { DEFAULT_FIRM_ID } from "@/lib/auth";
import { loadWorkspaceFromDatabase } from "@/lib/server/workspace-repository";
import { getFirmPublicSiteModel } from "@/lib/workspace-selectors";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const workspace = await loadWorkspaceFromDatabase();
  const model = getFirmPublicSiteModel(workspace, DEFAULT_FIRM_ID);

  if (!model) {
    notFound();
  }

  return <FirmLanding model={model} />;
}
