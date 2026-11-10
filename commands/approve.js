const AuroraBetaStyler = require("@aurora/styler");

const MAX_SHOWN = 15;
const TIMEOUT = 15000;

const style = (header, body, symbol) =>
  AuroraBetaStyler.styleOutput({
    headerText: header,
    headerSymbol: symbol,
    headerStyle: "bold",
    bodyText: body,
    bodyStyle: "bold",
    footerText: "Developed by: **Aljur Pogoy**",
  });

const callApi = (fn) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Request timed out.")), TIMEOUT);
    const done = (err, value) => {
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(value);
    };

    try {
      const result = fn(done);
      if (result && typeof result.then === "function") {
        result.then(
          (value) => done(null, value),
          (err) => done(err || new Error("Request failed."))
        );
      }
    } catch (err) {
      done(err);
    }
  });

const fetchRequests = async (api, tag) => {
  try {
    const list = await callApi((cb) => api.getThreadList(50, null, [tag], cb));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const getThreadName = async (api, threadID) => {
  try {
    const info = await callApi((cb) => api.getThreadInfo(threadID, cb));
    return (info && (info.threadName || info.name)) || "";
  } catch {
    return "";
  }
};

const formatDate = (value) => {
  const date = new Date(value);
  if (!value || isNaN(date.getTime())) return "Unknown";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
};

const collectPending = async (api) => {
  const [requests, spam] = await Promise.all([
    fetchRequests(api, "PENDING"),
    fetchRequests(api, "OTHER"),
  ]);

  const found = new Map();

  const add = (thread, source) => {
    const id = String(thread.threadID);
    if (thread.isGroup === false || found.has(id)) return;

    const members = Array.isArray(thread.participants)
      ? thread.participants.length
      : Array.isArray(thread.participantIDs)
        ? thread.participantIDs.length
        : null;

    found.set(id, {
      threadID: id,
      name: thread.name || "",
      members,
      timestamp: Number(thread.timestamp) || 0,
      source,
    });
  };

  requests.forEach((thread) => add(thread, "Message Request"));
  spam.forEach((thread) => add(thread, "Spam Request"));

  const state = global.threadState;
  if (state && state.pending) {
    for (const [id, data] of state.pending.entries()) {
      const key = String(id);
      if (found.has(key)) continue;
      found.set(key, {
        threadID: key,
        name: "",
        members: null,
        timestamp: new Date(data && data.addedAt).getTime() || 0,
        source: "Bot Pending List",
      });
    }
  }

  return Array.from(found.values()).sort((a, b) => b.timestamp - a.timestamp);
};

module.exports = {
  config: {
    name: "approve",
    description: "Approve a group that added the bot, or list pending groups. Admin only.",
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
        const pending = await collectPending(api);

        if (pending.length === 0) {
          return send("Pending Threads", "No pending threads found.", "✅");
        }

        const shown = pending.slice(0, MAX_SHOWN);
        const extra = pending.length - shown.length;

        const names = await Promise.all(
          shown.map((item) => (item.name ? item.name : getThreadName(api, item.threadID)))
        );

        const lines = shown.map((item, index) => {
          const details = [`Source: ${item.source}`];
          if (item.members) details.unshift(`Members: ${item.members}`);
          if (item.timestamp) details.push(`Last activity: ${formatDate(item.timestamp)}`);
          return `${index + 1}. ${names[index] || "Unnamed group"}\n    ThreadID: ${item.threadID}\n    ${details.join("\n    ")}`;
        });

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

      let acceptError = null;
      try {
        await callApi((cb) => api.handleMessageRequest(targetThreadID, true, cb));
      } catch (err) {
        acceptError = err;
      }

      const state = global.threadState;
      if (state && state.pending && state.approved) {
        state.pending.delete(targetThreadID);
        state.approved.set(targetThreadID, { approvedAt: new Date() });
      }

      let notified = true;
      try {
        await callApi((cb) =>
          api.sendMessage(
            style(
              "Bot Approved",
              `This group has been approved by the admins. The bot is now active here.\nType ${botPrefix}help to see the commands.`,
              "✅"
            ),
            targetThreadID,
            cb
          )
        );
      } catch (err) {
        notified = false;
        console.error(`[Approve Command] Could not notify ${targetThreadID}: ${err?.message || err}`);
      }

      const notes = [];
      if (acceptError) notes.push(`Could not accept the message request: ${acceptError.message}`);
      if (!notified) notes.push("Could not send the approval notice to that thread.");

      return send(
        "Thread Approval",
        `Thread ${targetThreadID} has been approved.${notes.length ? `\n${notes.join("\n")}` : ""}`,
        acceptError && !notified ? "⚠️" : "✅"
      );
    } catch (error) {
      console.error("[Approve Command] Error:", error.message);
      return send("Error", "An error occurred while processing the thread.", "❌");
    }
  },
};
