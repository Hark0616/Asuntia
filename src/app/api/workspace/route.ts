import { NextResponse } from "next/server";
import {
  loadWorkspaceFromDatabase,
  replaceWorkspace,
  resetWorkspaceDatabase,
} from "@/lib/server/workspace-repository";
import type { WorkspaceData } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await loadWorkspaceFromDatabase();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to load workspace", error);
    return NextResponse.json({ error: "No se pudo cargar el workspace." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = (await request.json()) as WorkspaceData;
    const saved = await replaceWorkspace(data);
    return NextResponse.json(saved);
  } catch (error) {
    console.error("Failed to save workspace", error);
    return NextResponse.json({ error: "No se pudo guardar el workspace." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const data = await resetWorkspaceDatabase();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to reset workspace", error);
    return NextResponse.json({ error: "No se pudo reiniciar el workspace." }, { status: 500 });
  }
}
