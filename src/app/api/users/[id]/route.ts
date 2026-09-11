import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";
import { z } from "zod";

const patchSchema = z.object({
  active: z.boolean().optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  if (parsed.data.active === undefined && parsed.data.password === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (id === session.userId && parsed.data.active === false) {
    return NextResponse.json(
      { error: "You can't deactivate your own account" },
      { status: 400 }
    );
  }

  if (parsed.data.active === false) {
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
    data: {
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      ...(parsed.data.password ? { passwordHash: await hashPassword(parsed.data.password) } : {}),
    },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  return NextResponse.json(user);
}
