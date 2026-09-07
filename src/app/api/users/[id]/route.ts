import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const patchSchema = z.object({ active: z.boolean() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (id === session.userId && !parsed.data.active) {
    return NextResponse.json(
      { error: "You can't deactivate your own account" },
      { status: 400 }
    );
  }

  if (!parsed.data.active) {
    const target = await db.user.findUnique({ where: { id } });
    if (target?.role === "ADMIN") {
      const activeAdmins = await db.user.count({ where: { role: "ADMIN", active: true } });
      if (activeAdmins <= 1) {
        return NextResponse.json(
          { error: "Can't deactivate the last active admin" },
          { status: 400 }
        );
      }
    }
  }

  const user = await db.user.update({
    where: { id },
    data: { active: parsed.data.active },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  return NextResponse.json(user);
}
