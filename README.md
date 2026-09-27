# AI Game of the Day

This site hosts several small HTML games and can optionally collect star ratings using Cloudflare Pages Functions and a D1 database.

## Arcade front end

The landing page and the About, Contact, Privacy, and Leaderboard pages share
`src/arcade.css`. The landing page uses static, directly navigable game cards;
`src/arcade.js` adds genre filters, search, a random game button, and accessible
ratings using the existing Cloudflare endpoints. Individual game interfaces are
independent of this stylesheet.

The featured game is defined in the `.featured` article in `index.html`. When
rotating it, update its artwork, description, game and leaderboard links, and
rating `data-id` together. Catalog cards carry their genre and searchable text in
`data-category` and `data-search`. Keep `GAME_CATALOG` in `leaderboard.html` in sync
so each game has a display name and Play Again link.

Generated illustrations, the brand mark, and the full image-generation prompts
are in [`images/arcade`](images/arcade/README.md). Game illustrations are labeled
as cover art rather than gameplay screenshots.

For a static front-end preview, run `python -m http.server 4173 --bind 127.0.0.1`
and open `http://127.0.0.1:4173`. Ratings and leaderboard data require the Wrangler
setup below; the static preview displays an unavailable state for those APIs.

The redesign was checked in headless Edge at 320, 390, 768, 1024, and 1440 CSS
pixels, including search/filter/reset behavior, game links, random navigation,
keyboard rating submission, synchronized ratings, failed/offline requests, and
the four supporting pages. API responses were mocked and advertising requests
blocked for those checks; they do not verify production API or ad delivery.

A separate AdSense check loaded the real Google script and ad requests on mobile
and desktop without JavaScript errors; Google returned unfilled slots locally.
Full-width ad geometry, empty-slot collapse, and mobile touch filters were also
verified. The ad stays between the spotlight and catalog, with no CSS clipping
or iframe-width overrides that would constrain Google-managed mobile expansion.
Filled ads and Auto ads overlays still require verification on the deployed site.

## Developing locally

1. Install the [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install/):
   ```bash
   npm install -g wrangler
   ```
2. Create a D1 database:
   ```bash
   wrangler d1 create gameday_ratings
   ```
3. Update `wrangler.toml` with your new database ID.
4. Create the table:
   ```bash
   wrangler d1 execute gameday_ratings --command "CREATE TABLE IF NOT EXISTS ratings (id INTEGER PRIMARY KEY AUTOINCREMENT, game_id TEXT NOT NULL, stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5), ip TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"
   wrangler d1 execute gameday_ratings --command "CREATE UNIQUE INDEX IF NOT EXISTS rating_per_ip ON ratings(game_id, ip);"
   ```
5. Start the development server:
   ```bash
   wrangler pages dev
   ```

## Deployment

Deploy the current `./` directory with:
```bash
wrangler pages deploy ./
```

This exposes the rating API under `/api/rate` and `/api/ratings/:gameId`.
