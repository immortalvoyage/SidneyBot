export const MASTER_ADMIN_CHANNEL_ID = "1534238116099919933";

export function isMasterAdminChannel(channelId) {
  return String(channelId || "") === MASTER_ADMIN_CHANNEL_ID;
}
