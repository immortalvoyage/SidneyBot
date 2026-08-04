import { autocompleteResponse } from "../../discord.js";
import { getUser } from "../../utils.js";
import { GAME_IDS } from "../platform/games/constants.js";
import { listPendingBindings } from "../platform/games/service.js";
import { getMember } from "../sect/members.js";
import { canApprove, canUseAI } from "../sect/permissions.js";
import { resolveActor } from "../sect/service.js";

function selectedSubcommand(interaction) {
  return interaction?.data?.options?.[0] || null;
}

function focusedOption(interaction) {
  return selectedSubcommand(interaction)?.options?.find(
    option => option.focused === true
  ) || null;
}

function searchableText(binding) {
  return [
    binding.discordName,
    binding.userId,
    binding.uid,
    binding.characterName
  ].filter(Boolean).join(" ").toLocaleLowerCase("zh-Hant");
}

export async function handleGameBindingAutocomplete(interaction, env) {
  const subcommand = selectedSubcommand(interaction);
  const focused = focusedOption(interaction);

  if (
    subcommand?.name !== "review" ||
    focused?.name !== "applicant"
  ) {
    return autocompleteResponse([]);
  }

  try {
    const actor = await resolveActor(env, getUser(interaction));
    if (!actor || !canApprove(actor.rank)) {
      return autocompleteResponse([]);
    }

    const query = String(focused.value || "")
      .trim()
      .toLocaleLowerCase("zh-Hant");
    const pending = await listPendingBindings(env, GAME_IDS.WWM);
    const withMembers = await Promise.all(pending.map(async item => ({
      item,
      member: await getMember(env, item.userId)
    })));
    const choices = withMembers
      .filter(({ member }) => member && canUseAI(member.rank))
      .map(({ item }) => item)
      .filter(item => !query || searchableText(item).includes(query))
      .slice(0, 25)
      .map(item => ({
        name: `${item.discordName || item.userId}｜UID ${item.uid}｜${item.characterName}`.slice(0, 100),
        value: String(item.userId)
      }));

    return autocompleteResponse(choices);
  } catch {
    return autocompleteResponse([]);
  }
}
