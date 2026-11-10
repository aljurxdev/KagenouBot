const AuroraBetaStyler = require("@aurora/styler");

const MAX_SHOWN = 15;

const style = (header, body, symbol) =>
  AuroraBetaStyler.styleOutput({
    headerText: header,
    headerSymbol: symbol,
    headerStyle: "bold",
    bodyText: body,
    bodyStyle: "bold",
    footerText: "Developed by: **Aljur Pogoy**",
  });

const sendTo = (api, message, threadID) =>
  new Promise((resolve, reject) => {
    api.sendMessage(message, threadID, (err) => (err ? reject(err) : resolve()));
  });

const getThreadName = (api, threadID) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(""), 5000);
    try {
      api.getThreadInfo(threadID, (err, info) => {
        clearTimeout(timer);
        if (err || !info) return resolve("");
        resolve(info.threadName || info.name || "");
      });
    } catch {
      clearTimeout(timer);
      resolve("");
    }
  });

const formatDate = (value) => {
  const date = new Date(value);
  if (isNaN(date.getTime())) return "Unknown";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
};

module.exports = {
  config: {
    name: "approve",
    description: "Approve a thread so the bot can work there, or list pending threads. Admin only.",
    usage: "approve pending | approve accept <threadID>",
    category: "admin",
    role: 3,
  },

  run: async ({ api, event, args, admins, prefix }) => {
    const { threadID, messageID, senderID } = event;

    const send = (header, body, symbol) =>
      api.sendMessage(style(header, body, symbol), threadID, messageID);

    const configPrefix = global.config && global.config.Prefix;
    const botPrefix =
      prefix || (Array.isArray(configPrefix) ? configPrefix[0] : configPrefix) || "#";

    if (!admins.includes(senderID.toString())) {
      return send("Access Denied", "Only admins can use this command.", "❌");
    }

    const state = global.threadState;
    if (!state || !state.pending || !state.approved) {
      return send("Error", "The thread approval system is not initialized.", "❌");
    }

    const action = args[0]?.toLowerCase();

    if (!action) {
      return send(
        "Approve",
        `Usage:\n• ${botPrefix}approve pending\n• ${botPrefix}approve accept <threadID>`,
        "📌"
      );
    }

    try {
      if (action === "pending") {
        const entries = Array.from(state.pending.entries()).sort(
          (a, b) => new Date(a[1]?.addedAt) - new Date(b[1]?.addedAt)
        );

        if (entries.length === 0) {
          return send("Pending Threads", "No pending threads found.", "✅");
        }

        const shown = entries.slice(0, MAX_SHOWN);
        const extra = entries.length - shown.length;
        const names = await Promise.all(shown.map(([id]) => getThreadName(api, id)));

        const lines = shown.map(
          ([id, data], index) =>
            `${index + 1}. ${names[index] || "Unknown thread"}\n    ThreadID: ${id}\n    Added: ${formatDate(data?.addedAt)}`
        );

        const bodyText =
          lines.join("\n\n") +
          (extra > 0 ? `\n\n...and ${extra} more.` : "") +
          `\n\nUse ${botPrefix}approve accept <threadID> to approve a thread.`;

        return send("Pending Threads", bodyText, "📋");
      }

      const targetThreadID = (action === "accept" ? args[1] : args[0])?.trim();

      if (!targetThreadID) {
        return send(
          "Approve",
          `Please provide a threadID.\nExample: ${botPrefix}approve accept 123456789`,
          "❌"
        );
      }

      if (!/^-?\d+$/.test(targetThreadID)) {
        return send("Error", "Invalid threadID. Please provide a valid numeric threadID.", "❌");
      }

      if (state.approved.has(targetThreadID)) {
        return send("Notice", `Thread ${targetThreadID} is already approved.`, "⚠️");
      }

      const wasPending = state.pending.has(targetThreadID);
      state.pending.delete(targetThreadID);
      state.approved.set(targetThreadID, { approvedAt: new Date() });

      let notified = true;
      try {
        await sendTo(
          api,
          style(
            "Bot Approved",
            `This group has been approved by the admins. The bot is now active here.\nType ${botPrefix}help to see the commands.`,
            "✅"
          ),
          targetThreadID
        );
      } catch (err) {
        notified = false;
        console.error(`[Approve Command] Could not notify ${targetThreadID}: ${err?.message || err}`);
      }

      return send(
        "Thread Approval",
        `Thread ${targetThreadID} has been approved${wasPending ? " and removed from pending" : " (it was not in the pending list)"}.${
          notified ? "" : "\nCould not send the approval notice to that thread."
        }`,
        "✅"
      );
    } catch (error) {
      console.error("[Approve Command] Error:", error.message);
      return send("Error", "An error occurred while processing the thread.", "❌");
    }
  },
};
