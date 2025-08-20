type PagesFunction = any;

export const onRequestGet: PagesFunction = async ({ params, env }) => {
  try {
    const gameId = params!.id as string;

    if (!gameId) {
      return new Response("Game ID required", { status: 400 });
    }

    // Ensure ratings table exists (no IP column)
    await env.DB
      .prepare(
        `CREATE TABLE IF NOT EXISTS ratings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          game_id TEXT NOT NULL,
          stars INTEGER NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
        )`
      )
      .run();

    const statsResult = await env.DB
      .prepare("SELECT COUNT(*) as count, AVG(stars) as avg FROM ratings WHERE game_id = ?1;")
      .bind(gameId)
      .first() as { count: number; avg: number } | null;

    return Response.json({
      votes: statsResult?.count ?? 0,
      average: statsResult?.avg ? Number(statsResult.avg).toFixed(2) : "0.00",
      // No per-user rating returned for privacy; keep field for backward compatibility
      mine: null,
    });
  } catch (error) {
    console.error('Ratings endpoint error:', error);
    return new Response("Internal server error", { status: 500 });
  }
};
