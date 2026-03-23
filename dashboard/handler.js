/**
 * @description Shadow Garden Bot Dashboard Handler
 * @author Aljur Pogoy
 */

const path = require("path");
const crypto = require("crypto");
const fs = require("fs-extra");

const sessions = new Map();
const SESSION_TTL = 1000 * 60 * 60 * 6; // 6 hours

function createSession() {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL);
  return token;
}

function isValidSession(token) {
  if (!token || !sessions.has(token)) return false;
  if (Date.now() > sessions.get(token)) { sessions.delete(token); return false; }
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [t, exp] of sessions) if (now > exp) sessions.delete(t);
}, 3600000);

function checkAuth(req, res) {
  const token = req.headers["x-session-token"];
  if (!isValidSession(token)) {
    res.status(401).json({ ok: false, error: "Session expired. Please log in again." });
    return false;
  }
  return true;
}

async function sendToThreads(api, threadIDs, message) {
  const sent = [], failed = [];
  for (const tid of threadIDs) {
    try {
      await new Promise((resolve, reject) => {
        api.sendMessage(message, String(tid), (err) =>
          err ? reject(err) : resolve()
        );
      });
      sent.push(tid);
    } catch (err) {
      failed.push({ tid, reason: err.message });
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  return { sent, failed };
}

module.exports = function mountDashboard(app) {
  const express = require("express");
  app.use(express.json());

  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
  });
  app.post("/login", (req, res) => {
    const { password } = req.body || {};
    const expected = process.env.DASHBOARD_PASSWORD || global.config?.dashboardPassword;
    if (!expected) return res.status(503).json({ ok: false, error: "No dashboardPassword set in config.json." });
    if (!password || password !== expected) return res.status(401).json({ ok: false, error: "Incorrect password." });
    const token = createSession();
    global.log.info("[DASHBOARD] New session created.");
    return res.json({ ok: true, token });
  });
  app.post("/logout", (req, res) => {
    const token = req.headers["x-session-token"];
    if (token) sessions.delete(token);
    return res.json({ ok: true });
  });
  app.get("/data/stats", (req, res) => {
    if (!checkAuth(req, res)) return;
    return res.json({
      ok: true,
      botName:           global.config?.botName        || "Shadow Garden Bot",
      uptime:            process.uptime(),
      commands:          global.commands?.size          || 0,
      nonPrefixCommands: global.nonPrefixCommands?.size || 0,
      eventCommands:     global.eventCommands?.length   || 0,
      usersTracked:      global.usersData?.size          || 0,
      maintenanceMode:   global.maintenanceMode          || false,
      dbConnected:       !!global.db,
      prefix:            global.config?.Prefix?.[0]     || "/",
      topCommands:       (global.getUsageStats?.() || [])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
    });
  });
  app.get("/data/threads", async (req, res) => {
    if (!checkAuth(req, res)) return;
    const api = global.botApi;
    if (!api) return res.status(503).json({ ok: false, error: "Bot not connected yet." });
    try {
      const threadList = await api.getThreadList(30, null, ["INBOX"]);
      const groups = threadList
        .filter(t => t.isGroup && t.name && t.name !== t.threadID)
        .map(t => ({ threadID: t.threadID, name: t.name, memberCount: t.userInfo?.length || 0 }));
      return res.json({ ok: true, threads: groups });
    } catch (err) {
      global.log.error(`[DASHBOARD] getThreadList failed: ${err.message}`);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
  app.post("/data/message", async (req, res) => {
    if (!checkAuth(req, res)) return;
    const { threadIDs, message } = req.body || {};
    if (!Array.isArray(threadIDs) || !threadIDs.length || !message?.trim()) {
      return res.status(400).json({ ok: false, error: "threadIDs (array) and message are required." });
    }
    const api = global.botApi;
    if (!api) return res.status(503).json({ ok: false, error: "Bot not connected yet." });

    const formatted = `❲ 👑 ❳ Message from Admin\n━━━━━━━━━━━━━━━━━━\n${message.trim()}\n\nFrom: ${global.config?.botName || "Shadow Garden Bot"} Dashboard`;

    const { sent, failed } = await sendToThreads(api, threadIDs, formatted);
    global.log.info(`[DASHBOARD] Message sent to ${sent.length} threads, failed: ${failed.length}.`);
    return res.json({ ok: true, sent: sent.length, failed: failed.length, failedList: failed });
  });
  app.post("/data/broadcast", async (req, res) => {
    if (!checkAuth(req, res)) return;
    const { message } = req.body || {};
    if (!message?.trim()) return res.status(400).json({ ok: false, error: "message is required." });

    const api = global.botApi;
    if (!api) return res.status(503).json({ ok: false, error: "Bot not connected yet." });

    let threadList;
    try {
      threadList = await api.getThreadList(30, null, ["INBOX"]);
    } catch (err) {
      return res.status(500).json({ ok: false, error: "Failed to fetch thread list: " + err.message });
    }
    const targets = threadList
      .filter(t => t.isGroup && t.name && t.name !== t.threadID)
      .map(t => t.threadID);

    const formatted = `❲ 👑 ❳ Broadcast from Admin\n━━━━━━━━━━━━━━━━━━\n${message.trim()}\n\nFrom: ${global.config?.botName || "Shadow Garden Bot"} Dashboard`;

    const { sent, failed } = await sendToThreads(api, targets, formatted);
    global.log.info(`[DASHBOARD] Broadcast: ${sent.length} sent, ${failed.length} failed.`);
    return res.json({ ok: true, sent: sent.length, failed: failed.length, total: targets.length });
  });
  app.post("/data/maintenance", (req, res) => {
    if (!checkAuth(req, res)) return;
    const { enabled } = req.body || {};
    if (typeof enabled !== "boolean") return res.status(400).json({ ok: false, error: "enabled must be true or false." });
    global.maintenanceMode = enabled;
    global.log.warn(`[DASHBOARD] Maintenance mode ${enabled ? "ON" : "OFF"}.`);
    return res.json({ ok: true, maintenanceMode: global.maintenanceMode });
  });
  app.post("/data/reload", (req, res) => {
    if (!checkAuth(req, res)) return;
    if (typeof global.reloadCommands !== "function") return res.status(503).json({ ok: false, error: "reloadCommands not available." });
    try {
      global.reloadCommands();
      global.log.success("[DASHBOARD] Commands reloaded.");
      return res.json({ ok: true, commands: global.commands?.size || 0, nonPrefixCommands: global.nonPrefixCommands?.size || 0, eventCommands: global.eventCommands?.length || 0 });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
  app.get("/data/banned", async (req, res) => {
    if (!checkAuth(req, res)) return;
    if (global.db) {
      try {
        const banned = await global.db.db("bannedUsers").find({}).toArray();
        return res.json({ ok: true, banned });
      } catch (err) { return res.status(500).json({ ok: false, error: err.message }); }
    }
    const p = path.join(__dirname, "../database/bannedUsers.json");
    try {
      const raw = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
      return res.json({ ok: true, banned: Object.entries(raw).map(([userId, info]) => ({ userId, ...info })) });
    } catch { return res.json({ ok: true, banned: [] }); }
  });
  app.delete("/data/banned/:userID", async (req, res) => {
    if (!checkAuth(req, res)) return;
    const { userID } = req.params;
    if (global.db) {
      try {
        await global.db.db("bannedUsers").deleteOne({ userId: userID });
        global.log.info(`[DASHBOARD] User ${userID} unbanned.`);
        return res.json({ ok: true });
      } catch (err) { return res.status(500).json({ ok: false, error: err.message }); }
    }
    const p = path.join(__dirname, "../database/bannedUsers.json");
    try {
      const raw = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
      delete raw[userID];
      fs.writeFileSync(p, JSON.stringify(raw, null, 2));
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ ok: false, error: err.message }); }
  });

  global.log.success("[DASHBOARD] Mounted at /");
};
