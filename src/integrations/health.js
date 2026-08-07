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
      redeemAnnouncements: Boolean(env.SIDNEY_REDEEM_SECRET)
    },
    checkedAt: new Date().toISOString()
  };
}

export function handleHealthRequest(env) {
  return Response.json(buildHealthPayload(env), {
    headers: { "Cache-Control": "no-store" }
  });
}
