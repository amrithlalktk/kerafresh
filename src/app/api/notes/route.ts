import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { noteSheetSchema } from "@/lib/validation";
import type { NoteSheetData } from "@/lib/types";

const DEFAULT_ROWS = 30;
const DEFAULT_COLS = 20;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sheets = await db.noteSheet.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json(sheets);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = noteSheetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const last = await db.noteSheet.aggregate({ _max: { order: true } });
  const data: NoteSheetData = { rows: DEFAULT_ROWS, cols: DEFAULT_COLS, cells: {} };
  const sheet = await db.noteSheet.create({
    data: {
      name: parsed.data.name,
      order: (last._max.order ?? 0) + 1,
      data,
    },
  });

  return NextResponse.json(sheet);
}
