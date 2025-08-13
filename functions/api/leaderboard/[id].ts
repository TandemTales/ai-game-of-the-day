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

export const onRequestGet: PagesFunction = async ({ params, env, request }) => {
  try {
    if (!env.DB) {
      return new Response("Database not configured", { status: 500 });
    }

    const gameId = (params?.id || '').toString();
    if (!gameId) {
      return new Response("Game ID required", { status: 400 });
    }

    await ensureTable(env);

    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    let limit = Number.parseInt(limitParam || '20', 10);
    if (Number.isNaN(limit) || limit <= 0) limit = 20;
    if (limit > 100) limit = 100;

    const rows = (await env.DB
      .prepare(`
        SELECT id, game_id, score, name, created_at
        FROM leaderboard
        WHERE game_id = ?
        ORDER BY score DESC, created_at ASC
        LIMIT ?;
      `)
      .bind(gameId, limit)
      .all()) as { results?: Array<{ id: number; game_id: string; score: number; name: string; created_at: number }> };

    const entries = (rows.results || []).map((r, idx) => ({
      rank: idx + 1,
      id: r.id,
      gameId: r.game_id,
      score: r.score,
      name: r.name,
      timestamp: r.created_at,
    }));

    return Response.json({ gameId, count: entries.length, entries });
  } catch (error) {
    console.error('Leaderboard fetch endpoint error:', error);
    return new Response("Internal server error", { status: 500 });
  }
};
