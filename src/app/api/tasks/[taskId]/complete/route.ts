// ============================================================================
// Viro — Toggle task completion
// PATCH /api/tasks/[taskId]/complete
// Protegido por Clerk (middleware bloqueia rotas /api/tasks/* por padrao)
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  // 1. Verificar autenticacao Clerk
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = params;
  const supabase = getSupabase();

  // 2. Buscar task e verificar ownership via lead -> clerk_user_id
  const { data: task, error: taskErr } = await supabase
    .from("plan_tasks")
    .select("id, lead_id, completed")
    .eq("id", taskId)
    .single();

  if (taskErr || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Verificar que o usuario e dono do lead
  const { data: lead } = await supabase
    .from("leads")
    .select("clerk_user_id")
    .eq("id", task.lead_id)
    .single();

  if (!lead || lead.clerk_user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Toggle completed
  const newCompleted = !task.completed;
  const { error: updateErr } = await supabase
    .from("plan_tasks")
    .update({
      completed: newCompleted,
      completed_at: newCompleted ? new Date().toISOString() : null,
    })
    .eq("id", taskId);

  if (updateErr) {
    console.error("[Tasks] Update error:", updateErr);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, completed: newCompleted });
}
