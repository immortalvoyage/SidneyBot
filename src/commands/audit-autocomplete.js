import { autocompleteResponse } from "../../discord.js";
import { getUser } from "../../utils.js";
import { listAudits } from "../sect/audit.js";
import { getMember } from "../sect/members.js";
import { canManageRanks } from "../sect/permissions.js";
import { resolveActor } from "../sect/service.js";
import { actionLabel } from "./audit.js";

function focusedValue(interaction) {
  const options = interaction?.data?.options?.[0]?.options || [];
  return String(options.find(item => item.focused)?.value || "").trim().toLowerCase();
}

export async function handleAuditAutocomplete(interaction, env) {
  const subcommand = interaction?.data?.options?.[0];
  const focused = subcommand?.options?.find(item => item.focused);
  if (
    interaction?.data?.name !== "audit" ||
    subcommand?.name !== "view" ||
    focused?.name !== "record"
  ) {
    return autocompleteResponse([]);
  }

  try {
    const actor = await resolveActor(env, getUser(interaction));
    if (!actor || !canManageRanks(actor.rank)) return autocompleteResponse([]);

    const query = focusedValue(interaction);
    const records = await listAudits(env, 25);
    const choices = [];

    for (const record of records) {
      const target = record.targetId ? await getMember(env, record.targetId) : null;
      const targetName = target?.displayName || record.details?.displayName || record.targetId || "無對象";
      const haystack = [record.id, record.action, targetName, record.actorId, record.targetId]
        .filter(Boolean).join(" ").toLowerCase();
      if (query && !haystack.includes(query)) continue;

      choices.push({
        name: `${actionLabel(record.action)}｜${targetName}｜${String(record.createdAt || "").slice(0, 16)}`.slice(0, 100),
        value: record.id
      });
      if (choices.length >= 25) break;
    }

    return autocompleteResponse(choices);
  } catch {
    return autocompleteResponse([]);
  }
}
