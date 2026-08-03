import { autocompleteResponse } from "../../discord.js";
import { getUser } from "../../utils.js";
import { RANK, RANK_LABEL } from "../sect/constants.js";
import { listMembers } from "../sect/members.js";
import { canManageRanks, isSectMaster } from "../sect/permissions.js";
import { resolveActor } from "../sect/service.js";

function selectedSubcommand(interaction) {
  return interaction?.data?.options?.[0] || null;
}

function focusedOption(interaction) {
  return selectedSubcommand(interaction)?.options?.find(
    option => option.focused === true
  ) || null;
}

function searchableText(member) {
  return [member.displayName, member.username, member.userId]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("zh-Hant");
}

export async function handleMemberAutocomplete(interaction, env) {
  const subcommand = selectedSubcommand(interaction)?.name;
  const focused = focusedOption(interaction);

  if (
    interaction?.data?.name !== "member" ||
    !["get", "set-rank", "remove"].includes(subcommand) ||
    focused?.name !== "player"
  ) {
    return autocompleteResponse([]);
  }

  try {
    const actor = await resolveActor(env, getUser(interaction));
    if (!actor || !canManageRanks(actor.rank)) {
      return autocompleteResponse([]);
    }

    const query = String(focused.value || "")
      .trim()
      .toLocaleLowerCase("zh-Hant");
    const members = await listMembers(env);

    const choices = members
      .filter(member => [RANK.MASTER, RANK.ELDER, RANK.DISCIPLE].includes(member.rank))
      .filter(member => {
        if (subcommand === "get") return true;
        return member.rank !== RANK.MASTER && !isSectMaster(member.userId, env);
      })
      .filter(member => !query || searchableText(member).includes(query))
      .slice(0, 25)
      .map(member => ({
        name: `${member.displayName || member.username}｜${RANK_LABEL[member.rank] || member.rank}`.slice(0, 100),
        value: String(member.userId)
      }));

    return autocompleteResponse(choices);
  } catch {
    return autocompleteResponse([]);
  }
}
