import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { fetchNotionRows } from "@/lib/notionImport";

export const maxDuration = 60; // Vercel 함수 최대 실행 시간 60초

export async function POST(request: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "NOTION_TOKEN이 설정되지 않았어요." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const notionUrl = (body as { notionUrl?: string }).notionUrl ?? process.env.NOTION_DATABASE_URL;
  if (!notionUrl) {
    return NextResponse.json({ error: "notionUrl이 필요해요." }, { status: 400 });
  }

  let rows;
  try {
    rows = await fetchNotionRows(notionUrl, token);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ message: "가져올 데이터가 없어요.", upserted: 0 });
  }

  const monthOrderMap = new Map<string, number>();
  const newRows = rows.map((row) => {
    const next = (monthOrderMap.get(row.monthKey) ?? 0) + 1;
    monthOrderMap.set(row.monthKey, next);
    return {
      word: row.word,
      meaning_ko: row.meaning.ko,
      meaning_en: row.meaning.en,
      examples: row.examples,
      publish_date: row.publishDate,
      month_key: row.monthKey,
      order: next,
      is_active: row.isActive,
    };
  });

  const count = await sql.begin(async (sql) => {
    // publish_date가 timestamptz이므로 date로 캐스팅 후 text 변환 (YYYY-MM-DD)
    const existing = await sql`SELECT id, TO_CHAR(publish_date, 'YYYY-MM-DD') AS publish_date FROM contents`;
    const existingMap = new Map(existing.map((r) => [r.publish_date as string, r.id as string]));

    const newDates = newRows.map((r) => r.publish_date);

    // 노션에서 사라진 날짜의 row 삭제 (posts는 CASCADE로 자동 삭제)
    await sql`DELETE FROM contents WHERE NOT (TO_CHAR(publish_date, 'YYYY-MM-DD') = ANY(${newDates}::text[]))`;

    const toUpdate: Array<typeof newRows[number] & { id: string }> = [];
    const toInsert: typeof newRows = [];

    for (const row of newRows) {
      const existingId = existingMap.get(row.publish_date);
      if (existingId) toUpdate.push({ ...row, id: existingId });
      else toInsert.push(row);
    }

    if (toUpdate.length > 0) {
      // UNIQUE(month_key, order) 충돌 방지: 한 번에 order를 큰 값으로 이동 후 실제 값으로 업데이트
      await sql`UPDATE contents SET "order" = "order" + 10000 WHERE id = ANY(${toUpdate.map((r) => r.id)})`;
      for (const row of toUpdate) {
        await sql`
          UPDATE contents SET
            word        = ${row.word},
            meaning_ko  = ${row.meaning_ko},
            meaning_en  = ${row.meaning_en},
            examples    = ${sql.json(row.examples)},
            month_key   = ${row.month_key},
            "order"     = ${row.order},
            is_active   = ${row.is_active},
            updated_at  = now()
          WHERE id = ${row.id}
        `;
      }
    }

    if (toInsert.length > 0) {
      const insertData = toInsert.map((r) => ({
        word: r.word,
        meaning_ko: r.meaning_ko,
        meaning_en: r.meaning_en,
        examples: sql.json(r.examples),
        publish_date: r.publish_date,
        month_key: r.month_key,
        order: r.order,
        is_active: r.is_active,
      }));
      await sql`INSERT INTO contents ${sql(insertData)}`;
    }

    return toUpdate.length + toInsert.length;
  });

  return NextResponse.json({ message: "임포트 완료!", upserted: count });
}
