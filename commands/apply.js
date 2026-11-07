const AuroraBetaStyler = require("@aurora/styler");

const COLLECTION = "applicants";
const MAX_SHOWN = 15;

const style = (header, body, symbol) =>
  AuroraBetaStyler.styleOutput({
    headerText: header,
    headerSymbol: symbol,
    headerStyle: "bold",
    bodyText: body,
    bodyStyle: "sansSerif",
    footerText: "Developed by: **Aljur Pogoy**",
  });

const ids = (key) => ((global.config && global.config[key]) || []).map(String);

const isReviewer = (uid) => {
  uid = String(uid);
  return ids("developers").includes(uid) || ids("admins").includes(uid) || ids("vips").includes(uid);
};

const isStaff = (uid) => {
  uid = String(uid);
  return isReviewer(uid) || ids("moderators").includes(uid);
};

const formatApplicant = (a) =>
  `Name: ${a.name}\nAge: ${a.age}\nWhy want to become a moderator for KagenouBot?: ${a.reason}\nUID: ${a.uid}`;

const CHECK_INTERVAL = 60 * 1000;
const PLACEHOLDER = "⟦⟧";
let lastCheck = 0;
let checking = false;

const sendTo = (api, message, threadID) =>
  new Promise((resolve, reject) => {
    api.sendMessage(message, threadID, (err) => (err ? reject(err) : resolve()));
  });

const buildApprovalMessage = (applicant) => {
  const mentionText = `@${applicant.name}`;

  let body = style(
    "Application Approved",
    `Congratulations ${PLACEHOLDER}! Your application to become a moderator for KagenouBot has been approved. Welcome to the staff team!`,
    "🎉"
  );

  if (body.includes(PLACEHOLDER)) {
    body = body.replace(PLACEHOLDER, mentionText);
  } else {
    body = `${mentionText}\n${body}`;
  }

  return { body, mentions: [{ tag: mentionText, id: applicant.uid }] };
};

const notifyApproved = async (api, database) => {
  const col = database.db(COLLECTION);
  const all = await col.find({}).toArray();
  const approved = all.filter((a) => isStaff(a.uid) && !a.notified);

  for (const applicant of approved) {
    let failed = false;

    try {
      await sendTo(api, buildApprovalMessage(applicant), applicant.threadID);
    } catch (err) {
      failed = true;
      console.error(`[Apply Command] Could not notify ${applicant.uid}: ${err?.message || err}`);
    }

    await col.updateOne(
      { uid: applicant.uid },
      { $set: { notified: true, notifyFailed: failed, notifiedAt: new Date() } }
    );
  }
};

module.exports = {
  config: {
    name: "apply",
    description: "Apply to become a moderator for KagenouBot. VIPs, admins, and developers can view applicants.",
    usage: "apply <yourname> <age> <why you want to become a moderator> | apply list | apply accept <uid>",
    category: "System ⚡",
    role: 0,
    nonPrefix: false,
  },

  run: async ({ api, event, args, db }) => {
    const { threadID, messageID, senderID } = event;
    const database = db || global.db;

    const send = (header, body, symbol) =>
      api.sendMessage(style(header, body, symbol), threadID, messageID);

    if (!database) {
      return send("Error", "Database not initialized. Ensure MongoDB is connected and try again.", "❌");
    }

    const col = database.db(COLLECTION);
    const subCommand = args[0]?.toLowerCase();

    try {
      if (subCommand === "list") {
        if (!isReviewer(senderID)) {
          return send("Apply", "Only VIPs, admins, and developers can view applicants.", "❌");
        }

        const all = await col.find({}).toArray();
        const pending = all
          .filter((a) => !isStaff(a.uid))
          .sort((a, b) => new Date(a.appliedAt) - new Date(b.appliedAt));

        if (pending.length === 0) {
          return send("Moderator Applicants", "No pending applicants.", "📋");
        }

        const shown = pending.slice(0, MAX_SHOWN);
        const extra = pending.length - shown.length;

        const bodyText =
          shown.map(formatApplicant).join("\n\n") +
          (extra > 0 ? `\n\n...and ${extra} more.` : "") +
          "\n\nCopy the UID and add it to moderators in config.json, then restart the bot. The applicant is notified automatically in the group chat they applied from, or notify them right away with /apply accept <uid>.";

        return send("Moderator Applicants", bodyText, "📋");
      }

      if (subCommand === "accept") {
        if (!isReviewer(senderID)) {
          return send("Apply", "Only VIPs, admins, and developers can accept applicants.", "❌");
        }

        const targetUID = args[1]?.trim();
        if (!targetUID || !/^\d+$/.test(targetUID)) {
          return send(
            "Apply",
            "Please provide the applicant's UID.\nExample: /apply accept 100012345678901",
            "⚠️"
          );
        }

        const applicant = await col.findOne({ uid: targetUID });
        if (!applicant) {
          return send("Apply", `No application found for UID ${targetUID}.`, "⚠️");
        }

        if (applicant.notified) {
          return send("Apply", `${applicant.name} has already been notified.`, "⚠️");
        }

        try {
          await sendTo(api, buildApprovalMessage(applicant), applicant.threadID);
        } catch (err) {
          return send(
            "Error",
            `Could not notify ${applicant.name} in their group chat: ${err?.message || err}`,
            "❌"
          );
        }

        await col.updateOne(
          { uid: targetUID },
          {
            $set: {
              notified: true,
              notifyFailed: false,
              notifiedAt: new Date(),
              acceptedBy: String(senderID),
            },
          }
        );

        return send(
          "Apply",
          `${applicant.name} has been notified in their group chat.${
            isStaff(targetUID) ? "" : "\nRemember to add their UID to moderators in config.json and restart the bot."
          }`,
          "✅"
        );
      }

      const [name, ageArg, ...reasonParts] = args;
      const reason = reasonParts.join(" ").trim();

      if (!name || !ageArg || !reason) {
        return send(
          "Apply",
          "Usage: /apply <yourname> <age> <why you want to become a moderator for KagenouBot>\n\nExample: /apply Juan 18 I'm active every day and I want to help keep the group safe.",
          "⚠️"
        );
      }

      const age = Number(ageArg);
      if (!Number.isInteger(age) || age < 13 || age > 99) {
        return send("Apply", "Please provide a valid age (13-99).", "❌");
      }

      if (reason.length < 10 || reason.length > 500) {
        return send("Apply", "Your message must be between 10 and 500 characters.", "❌");
      }

      if (isStaff(senderID)) {
        return send("Apply", "You are already part of the KagenouBot staff.", "⚠️");
      }

      const existing = await col.findOne({ uid: String(senderID) });
      if (existing) {
        return send("Apply", "You already have an application on file. Please wait for a review.", "⚠️");
      }

      await col.insertOne({
        uid: String(senderID),
        name,
        age,
        reason,
        threadID: String(threadID),
        appliedAt: new Date(),
      });

      return send(
        "Application Submitted",
        `Thank you ${name}! Your application to become a moderator for KagenouBot has been submitted and will be reviewed.`,
        "✅"
      );
    } catch (err) {
      console.error(`Error: ${err.message}`);
      return send("Error", `Something went wrong: ${err.message}`, "❌");
    }
  },

  handleEvent: async ({ api, db }) => {
    const database = db || global.db;
    if (!database || checking) return;

    const now = Date.now();
    if (now - lastCheck < CHECK_INTERVAL) return;

    checking = true;
    lastCheck = now;

    try {
      await notifyApproved(api, database);
    } catch (err) {
      console.error(`[Apply Command] Notify check error: ${err.message}`);
    } finally {
      checking = false;
    }
  },
};
