const AuroraBetaStyler = require("@aurora/styler");

/* Updated by aljurx */
const cache = new Map();
const style = (header, body, symbol, footer = "Developed by: **Aljur Pogoy**") =>
  AuroraBetaStyler.styleOutput({
    headerText: header,
    headerSymbol: symbol,
    headerStyle: "bold",
    bodyText: body,
    bodyStyle: "bold",
    footerText: footer,
  });

const getUserRole = (uid) => {
  uid = String(uid);
  if (!global.config) return 0;

  const developers = (global.config.developers || []).map(String);
  const admins = (global.config.admins || []).map(String);
  const moderators = (global.config.moderators || []).map(String);
  const vips = (global.config.vips || []).map(String);

  if (developers.includes(uid)) return 4;
  if (admins.includes(uid)) return 3;
  if (moderators.includes(uid)) return 2;
  if (vips.includes(uid)) return 1;
  return 0;
};

const isEnabled = async (col, threadID) => {
  if (cache.has(threadID)) return cache.get(threadID);
  const doc = await col.findOne({ threadID });
  const enabled = !!doc;
  cache.set(threadID, enabled);
  return enabled;
};

const setEnabled = async (col, threadID, enabled) => {
  await col.deleteOne({ threadID });
  if (enabled) await col.insertOne({ threadID, enabledAt: new Date() });
  cache.set(threadID, enabled);
};

module.exports = {
  config: {
    name: "chat-off",
    description: "Disable chat for members. Non-authorized users will be kicked if they chat.",
    usage: "chat-off [on|off]",
    category: "System ⚡",
    role: 1,
    nonPrefix: false,
  },

  run: async ({ api, event, args, db }) => {
    const { threadID, messageID, senderID } = event;

    if (getUserRole(senderID) < 1) {
      return api.sendMessage(
        style("Chat-Off", "You don't have permission to use this command.", "❌"),
        threadID,
        messageID
      );
    }

    if (!db) {
      return api.sendMessage(
        style("Error", "Database not initialized. Ensure MongoDB is connected and try again.", "❌"),
        threadID,
        messageID
      );
    }

    const col = db.db("chatOffThreads");
    const action = args[0]?.toLowerCase();

    try {
      if (action === "on") {
        await setEnabled(col, threadID, true);
        return api.sendMessage(
          style("Chat-Off", "Chat is now disabled. Only VIPs, moderators, admins, and developers can chat. Anyone else who sends a message will be kicked.", "🚫"),
          threadID,
          messageID
        );
      }

      if (action === "off") {
        await setEnabled(col, threadID, false);
        return api.sendMessage(
          style("Chat-Off", "Chat is now enabled for everyone.", "✅"),
          threadID,
          messageID
        );
      }

      return api.sendMessage(
        style("Chat-Off", "Usage: /chat-off [on|off]", "⚠️"),
        threadID,
        messageID
      );
    } catch (error) {
      return api.sendMessage(
        style("Error", `Failed to update chat-off: ${error.message}`, "❌"),
        threadID,
        messageID
      );
    }
  },

  handleEvent: async ({ api, event, db }) => {
    const { threadID, senderID, body, attachments, type } = event;

    if (type !== "message" && type !== "message_reply") return;
    if (!body && !(attachments && attachments.length)) return;
    if (!senderID) return;
    if (String(senderID) === String(api.getCurrentUserID())) return;
    if (getUserRole(senderID) > 0) return;

    const database = db || global.db;
    if (!database) return;

    try {
      const col = database.db("chatOffThreads");
      if (!(await isEnabled(col, threadID))) return;

      const userInfo = await api.getUserInfo([senderID]);
      const name = userInfo[senderID]?.name || "Unknown User";

      await api.sendMessage(
        style(
          "Chat-Off System",
          `User ${name} has been kicked for chatting while chat is disabled.`,
          "🚫",
          "You have been removed automatically."
        ),
        threadID
      );
      await api.removeUserFromGroup(senderID, threadID);
    } catch (err) {
      console.error(`Chat-Off Error | ${err.message}`);
    }
  },
};
