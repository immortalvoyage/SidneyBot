import { autocompleteResponse } from "../../discord.js";
import { getUser } from "../../utils.js";
import { APPLICATION_STATUS } from "../sect/constants.js";
import { listApplications } from "../sect/applications.js";
import { canApprove } from "../sect/permissions.js";
import { resolveActor } from "../sect/service.js";

function focusedOption(interaction) {
  return interaction?.data?.options?.find(
    option => option.focused === true
  ) || null;
}

function searchableText(application) {
  return [
    application.displayName,
    application.username,
    application.userId,
    application.reason
  ].filter(Boolean).join(" ").toLocaleLowerCase("zh-Hant");
}

export async function handleApplicationAutocomplete(interaction, env) {
  const command = interaction?.data?.name;
  const focused = focusedOption(interaction);

  if (
    command !== "review" ||
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
    const applications = await listApplications(
      env,
      APPLICATION_STATUS.PENDING
    );

    const choices = applications
      .filter(item => !query || searchableText(item).includes(query))
      .slice(0, 25)
      .map(item => ({
        name: `${item.displayName || item.username}｜${item.reason || "未填理由"}`.slice(0, 100),
        value: String(item.userId)
      }));

    return autocompleteResponse(choices);
  } catch {
    return autocompleteResponse([]);
  }
}
