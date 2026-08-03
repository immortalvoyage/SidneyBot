import { importWeeklyStats } from "./service.js";
import { GAME_IDS } from "./constants.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8" }
  });
}

function authorized(request, env) {
  const token = String(env.PLATFORM_API_TOKEN || "");
  if (!token) return false;
  return request.headers.get("Authorization") === `Bearer ${token}`;
}

export async function handlePlatformApi(request, env, url) {
  if (!url.pathname.startsWith("/api/v1/")) return null;

  if (!authorized(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  if (request.method === "POST" && url.pathname === "/api/v1/wwm/weekly-stats") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON" }, 400);
    }

    try {
      const result = await importWeeklyStats(env, {
        gameId: GAME_IDS.WWM,
        week: body.week,
        rows: body.rows,
        source: body.source || "google_sheets"
      });
      return json({ ok: true, result });
    } catch (error) {
      return json({ ok: false, error: error.message }, 400);
    }
  }

  return json({ ok: false, error: "Not Found" }, 404);
}
