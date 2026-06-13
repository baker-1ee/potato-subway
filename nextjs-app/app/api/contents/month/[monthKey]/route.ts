import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ monthKey: string }> }
) {
  const { monthKey } = await params;
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return NextResponse.json({ error: "monthKey 형식이 잘못됐어요 (YYYY-MM)" }, { status: 400 });
  }

  const rows = await sql`
    SELECT * FROM contents
    WHERE TO_CHAR(publish_date, 'YYYY-MM') = ${monthKey} AND is_active = true
    ORDER BY publish_date ASC
  `;

  return NextResponse.json(rows);
}
