export function buildHealthPayload(env = {}) {
  return {
    ok: true,
    service: "sidney-discord-worker",
    version: String(env.APP_VERSION || "4.3.22"),
    capabilities: {
      slashCommands: true,
      laozuMemoryControls: true,
      laozuSpeakerIdentityGrounding: true,
      laozuMoodState: Boolean(env.SIDNEY_STATE_API_TOKEN),
      laozuMentions: Boolean(env.DISCORD_GATEWAY_SECRET),
      laozuEventArchive: Boolean(env.LAOZU_EVENT_ARCHIVE_URL && env.LAOZU_EVENT_ARCHIVE_SECRET),
      redeemAnnouncements: Boolean(env.SIDNEY_REDEEM_SECRET)
    },
    checkedAt: new Date().toISOString()
  };
}

export async function handleHealthRequest(env) {
  const payload = buildHealthPayload(env);
  if (env?.BOT_MEMORY?.get) {
    payload.lastArchiveAttempt = await env.BOT_MEMORY.get("integration:laozu-archive:last", { type: "json" });
  }
  return Response.json(payload, {
    headers: { "Cache-Control": "no-store" }
  });
}
