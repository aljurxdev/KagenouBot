const path = require("path");

const AuroraBetaStyler = require(path.join(__dirname, "..", "core", "plugins", "aurora-beta-styler"));

const footer = "Developed by: **Aljur pogoy**";
const cache = new Map();

const style = (headerText, headerSymbol, bodyText) =>
  AuroraBetaStyler.styleOutput({
    headerText,
    headerSymbol,
    headerStyle: "bold",
    bodyText,
    bodyStyle: "bold",
    footerText: footer,
  });

const fetchName = (api, threadID) =>
  new Promise((resolve) => {
    try {
      api.getThreadInfo(threadID, (err, info) => {
        if (err || !info) return resolve("");
        resolve(info.threadName ?? info.name ?? "");
      });
    } catch {
      resolve("");
    }
  });

const ensure = async (api, col, threadID) => {
  if (cache.has(threadID)) return cache.get(threadID);

  let doc = await col.findOne({ threadID });
  if (!doc) {
    const name = await fetchName(api, threadID);
    doc = { threadID, name, locked: false, updatedAt: new Date() };
    await col.insertOne(doc);
  }

  const record = { name: doc.name, locked: doc.locked };
  cache.set(threadID, record);
  return record;
};

const save = async (col, threadID, fields) => {
  const current = cache.get(threadID) || { name: "", locked: false };
  const next = { ...current, ...fields };
  await col.deleteOne({ threadID });
  await col.insertOne({ threadID, ...next, updatedAt: new Date() });
  cache.set(threadID, next);
};

module.exports = {
  config: {
    name: "anti-thread",
    description: "Auto-save thread names to MongoDB and lock them against unauthorized changes.",
    usage: "/anti-thread <on/off/status>",
    role: 4,
    cooldown: 5,
    aliases: ["anti-thread", "antithread", "namelock"],
  },

  handleEvent: true,

  async handleEvent({ api, event, db, admins }) {
    const { threadID, logMessageType, logMessageData, author } = event;
    const database = db || global.db;
    if (!threadID || !database) return;

    try {
      const col = database.db("threadNames");
      const record = await ensure(api, col, threadID);

      if (logMessageType !== "log:thread-name") return;

      const newName = logMessageData?.name ?? "";
      const adminList = (admins || global.admins || []).map(String);
      const authorized =
        String(author) === String(api.getCurrentUserID()) || adminList.includes(String(author));

      if (record.locked && !authorized) {
        api.setTitle(record.name, threadID, (err) => {
          if (err) return;
          api.sendMessage(
            style("Name Lock", "🔒", "Unauthorized thread name change detected. The name has been restored."),
            threadID
          );
        });
        return;
      }

      await save(col, threadID, { name: newName });
    } catch (error) {
      console.error("name-lock-event error:", error?.message || error);
    }
  },

  run: async ({ api, event, args, db, admins }) => {
    const { threadID, messageID, senderID } = event;
    const action = args[0]?.toLowerCase();

    if (!admins.includes(senderID.toString())) {
      return api.sendMessage(
        style("Access Denied", "❌", "Only developers can manage the thread name lock."),
        threadID,
        messageID
      );
    }

    if (!db) {
      return api.sendMessage(
        style("Error", "❌", "Database not initialized. Ensure MongoDB is connected and try again."),
        threadID,
        messageID
      );
    }

    const col = db.db("threadNames");

    try {
      if (action === "on") {
        const record = await ensure(api, col, threadID);
        const currentName = (await fetchName(api, threadID)) || record.name;
        await save(col, threadID, { name: currentName, locked: true });
        return api.sendMessage(
          style("Anti Thread", "🔒", `Thread name lock is now ON.\nLocked name: ${currentName || "None"}`),
          threadID,
          messageID
        );
      }

      if (action === "off") {
        await ensure(api, col, threadID);
        await save(col, threadID, { locked: false });
        return api.sendMessage(
          style("Anti Thread", "🔓", "Thread name lock is now OFF. Name changes are still saved automatically."),
          threadID,
          messageID
        );
      }

      if (action === "status") {
        const record = await ensure(api, col, threadID);
        return api.sendMessage(
          style("Anti Thread", "📌", `Lock: ${record.locked ? "ON" : "OFF"}\nSaved name: ${record.name || "None"}`),
          threadID,
          messageID
        );
      }

      return api.sendMessage(
        style("Anti Thread", "📌", "Usage:\n• /anti-thread on\n• /anti-thread off\n• /anti-thread status"),
        threadID,
        messageID
      );
    } catch (error) {
      return api.sendMessage(
        style("Error", "❌", `Failed to update thread name lock: ${error.message}`),
        threadID,
        messageID
      );
    }
  },
};
