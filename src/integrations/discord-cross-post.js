export function extractCrossPostChannelId(content, currentChannelId = "") {
  const text = String(content || "");
  if (!/(發到|傳到|貼到|送到|發至|傳至|貼至|送至|發布到|發布至|公告到|公告至|通知到|通知至|訊息要發到|消息要發到)/u.test(text)) return "";
  const matches = [...text.matchAll(/<#(\d{6,24})>/g)].map(match => match[1]);
  return matches[0] || "";
}

export function attachMasterCrossPost(result, { targetChannelId, memberRank } = {}) {
  if (!result || result.ok !== true || !["master", "elder"].includes(memberRank)) return result;
  const channelId = String(targetChannelId || "").trim();
  const content = String(result.reply || "").trim();
  if (!/^\d{6,24}$/.test(channelId) || !content) return result;
  return {
    ...result,
    crossPost: {
      channelId,
      content: content.slice(0, 2000)
    }
  };
}
