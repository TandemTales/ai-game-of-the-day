type PagesFunction = any;

async function ensureTable(env: any) {
  // Create table and basic index if they don't exist
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

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    if (!env.DB) {
      return new Response("Database not configured", { status: 500 });
    }

    await ensureTable(env);

    const body = (await request.json()) as any;
    const rawGameId = body?.gameId;
    const rawName = body?.name;
    const rawScore = body?.score;

    const gameId = typeof rawGameId === 'string' ? rawGameId.trim() : '';
    let name = typeof rawName === 'string' ? rawName.trim() : '';
    const score = Number.parseInt(String(rawScore), 10);

    if (!gameId || !name || Number.isNaN(score) || score < 0) {
      return new Response("Bad request", { status: 400 });
    }

    // Sanitize and limit name length
    name = name.replace(/[^\w \-'.!]/g, '');
    if (name.length > 20) name = name.slice(0, 20);

    const createdAt = Date.now(); // server-side timestamp; older beats newer on ties

    const insertResult = await env.DB
      .prepare(`INSERT INTO leaderboard (game_id, score, name, created_at) VALUES (?, ?, ?, ?);`)
      .bind(gameId, score, name, createdAt)
      .run();

    if (!insertResult.success) {
      return new Response("Database error", { status: 500 });
    }

    // Prune to keep only top 20 per game (score desc, created_at asc)
    await env.DB
      .prepare(`
        DELETE FROM leaderboard
        WHERE game_id = ?
          AND id NOT IN (
            SELECT id FROM leaderboard
            WHERE game_id = ?
            ORDER BY score DESC, created_at ASC
            LIMIT 20
          );
      `)
      .bind(gameId, gameId)
      .run();

    // Compute the rank for the newly inserted score
    const rankRow = (await env.DB
      .prepare(`
        SELECT COUNT(*) + 1 AS rank
        FROM leaderboard
        WHERE game_id = ?
          AND (score > ? OR (score = ? AND created_at < ?));
      `)
      .bind(gameId, score, score, createdAt)
      .first()) as { rank?: number } | null;

    return Response.json({ ok: true, rank: rankRow?.rank ?? null });
  } catch (error) {
    console.error('Leaderboard submit endpoint error:', error);
    return new Response("Internal server error", { status: 500 });
  }
};
