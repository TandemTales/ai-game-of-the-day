type PagesFunction = any;

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    if (!env.DB) {
      return new Response("Database not configured", { status: 500 });
    }

    // Ensure ratings table exists without IP column
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

    const { gameId, stars } = await request.json() as any;
    const rating = parseInt(stars, 10);

    if (!gameId || isNaN(rating) || rating < 1 || rating > 5) {
      return new Response("Bad request", { status: 400 });
    }

    // Insert the new rating (no IP stored)
    try {
      const insertResult = await env.DB
        .prepare("INSERT INTO ratings (game_id, stars) VALUES (?, ?)")
        .bind(gameId, rating)
        .run();

      if (!insertResult.success) {
        return new Response("Database error", { status: 500 });
      }
    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      return new Response("Database operation failed", { status: 500 });
    }

    // Get updated stats
    const statsResult = await env.DB
      .prepare("SELECT COUNT(*) as count, AVG(stars) as avg FROM ratings WHERE game_id = ?")
      .bind(gameId)
      .first() as { count: number; avg: number } | null;

    return Response.json({ 
      votes: statsResult?.count || 0, 
      average: statsResult?.avg ? Number(statsResult.avg).toFixed(2) : "0.00"
    });
  } catch (error) {
    console.error('Rate endpoint error:', error);
    return new Response("Internal server error", { status: 500 });
  }
};
