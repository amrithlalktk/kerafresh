import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { notifyEmail: true },
  });
  return NextResponse.json({
    userId: session.userId,
    name: session.name,
    email: session.email,
    role: session.role,
    notifyEmail: user?.notifyEmail ?? null,
  });
}

const patchSchema = z.object({
  notifyEmail: z.string().trim().email().nullable(),
});

// Lets a user set where their own one-click "Email PDF" sends bills/reports
// — separate from their login email (see User.notifyEmail).
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  await db.user.update({
    where: { id: session.userId },
    data: { notifyEmail: parsed.data.notifyEmail },
  });
  return NextResponse.json({ ok: true });
}
