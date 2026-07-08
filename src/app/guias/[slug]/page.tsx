import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FirmGuidePage } from "@/components/firm-guide-page";
import { DEFAULT_FIRM_ID } from "@/lib/auth";
import { loadWorkspaceFromDatabase } from "@/lib/server/workspace-repository";
import { getFirmGuidePageModel } from "@/lib/workspace-selectors";

type GuidePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const workspace = await loadWorkspaceFromDatabase();
  const model = getFirmGuidePageModel(workspace, DEFAULT_FIRM_ID, slug);

  if (!model) {
    return {
      title: "Guia no encontrada",
    };
  }

  return {
    description: model.guide.summary,
    title: `${model.guide.title} | ${model.firm.name}`,
  };
}

export default async function GuiaPage({ params }: GuidePageProps) {
  const { slug } = await params;
  const workspace = await loadWorkspaceFromDatabase();
  const model = getFirmGuidePageModel(workspace, DEFAULT_FIRM_ID, slug);

  if (!model) {
    notFound();
  }

  return <FirmGuidePage model={model} />;
}
