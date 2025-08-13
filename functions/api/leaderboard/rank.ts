type PagesFunction = any;

async function ensureTable(env: any) {
  await env.DB
    .prepare(`CREATE TABLE IF NOT EXISTS leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );`)
    .run();

  await env.DB
    .prepare(`CREATE INDEX IF NOT EXISTS idx_leaderboard_game ON leaderboard (game_id);`)
    .run();
}

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  try {
    if (!env.DB) return new Response("Database not configured", { status: 500 });

    await ensureTable(env);

    const url = new URL(request.url);
    const gameId = (url.searchParams.get('gameId') || url.searchParams.get('id') || '').trim();
    const scoreStr = url.searchParams.get('score') || '';
    const score = Number.parseInt(scoreStr, 10);

    if (!gameId || !Number.isFinite(score) || score < 0) {
      return new Response("Bad request", { status: 400 });
    }

    // Prospective rank for a new entry created now: after all equal scores
    const row = (await env.DB
      .prepare(`
        SELECT COUNT(*) + 1 AS rank
        FROM leaderboard
        WHERE game_id = ?1 AND (score > ?2 OR score = ?2);
      `)
      .bind(gameId, score)
      .first()) as { rank?: number } | null;

    const totalRow = (await env.DB
      .prepare(`SELECT COUNT(*) AS total FROM leaderboard WHERE game_id = ?1;`)
      .bind(gameId)
      .first()) as { total?: number } | null;

    return Response.json({ gameId, score, rank: row?.rank ?? null, total: totalRow?.total ?? 0 });
  } catch (err) {
    console.error('Leaderboard rank endpoint error:', err);
    return new Response("Internal server error", { status: 500 });
  }
};
