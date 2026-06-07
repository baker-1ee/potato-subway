import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { fetchNotionRows } from "@/lib/notionImport";

export const maxDuration = 60;

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

  // Notion fetch와 DB existing 조회를 병렬로 실행
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
    const newDates = newRows.map((r) => r.publish_date);

    // 1) 노션에서 사라진 날짜 삭제 + 기존 row 조회 (병렬)
    const [, existing] = await Promise.all([
      sql`DELETE FROM contents WHERE NOT (TO_CHAR(publish_date, 'YYYY-MM-DD') = ANY(${newDates}::text[]))`,
      sql`SELECT id, TO_CHAR(publish_date, 'YYYY-MM-DD') AS publish_date FROM contents`,
    ]);

    const existingMap = new Map(existing.map((r) => [r.publish_date as string, r.id as string]));

    const toUpdate: Array<typeof newRows[number] & { id: string }> = [];
    const toInsert: typeof newRows = [];

    for (const row of newRows) {
      const existingId = existingMap.get(row.publish_date);
      if (existingId) toUpdate.push({ ...row, id: existingId });
      else toInsert.push(row);
    }

    // 2) 고아 row 정리: toUpdate에 없는 row가 남아있으면 삭제 (posts 없는 것만)
    if (toUpdate.length > 0) {
      await sql`
        DELETE FROM contents
        WHERE id NOT IN (
          SELECT word_id FROM posts WHERE word_id IS NOT NULL
        )
        AND id != ANY(${toUpdate.map((r) => r.id)})
      `;
    }

    // 3) 단일 unnest UPDATE (UNIQUE 충돌 방지: month_key를 먼저 임시값으로)
    if (toUpdate.length > 0) {
      // month_key를 행 고유 임시값으로 설정해 (month_key, order) unique 충돌 회피
      await sql`
        UPDATE contents SET month_key = 'tmp-' || id::text
        WHERE id = ANY(${toUpdate.map((r) => r.id)})
      `;

      // 실제 값으로 한번에 업데이트 (unnest로 N쿼리 → 1쿼리)
      await sql`
        UPDATE contents SET
          word       = v.word,
          meaning_ko = v.meaning_ko,
          meaning_en = v.meaning_en,
          examples   = v.examples::jsonb,
          month_key  = v.month_key,
          "order"    = v.ord::int,
          is_active  = (v.is_active = 'true'),
          updated_at = now()
        FROM unnest(
          ${toUpdate.map((r) => r.id)}::uuid[],
          ${toUpdate.map((r) => r.word)}::text[],
          ${toUpdate.map((r) => r.meaning_ko ?? '')}::text[],
          ${toUpdate.map((r) => r.meaning_en ?? '')}::text[],
          ${toUpdate.map((r) => JSON.stringify(r.examples))}::text[],
          ${toUpdate.map((r) => r.month_key)}::text[],
          ${toUpdate.map((r) => r.order)}::int[],
          ${toUpdate.map((r) => (r.is_active ? 'true' : 'false'))}::text[]
        ) AS v(id, word, meaning_ko, meaning_en, examples, month_key, ord, is_active)
        WHERE contents.id = v.id
      `;
    }

    // 4) 신규 row INSERT
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
