/**
* @Description - handler dawg
* @author - Aljurx pogoy 
*/

const path   = require("path");
const crypto = require("crypto");
const fs     = require("fs-extra");

const sessions   = new Map();
const SESSION_TTL = 1000 * 60 * 60 * 6;

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
        api.sendMessage(message, String(tid), (err) => err ? reject(err) : resolve());
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
      ok:                true,
      botName:           global.config?.botName        || "Shadow Garden Bot",
      uptime:            process.uptime(),
      commands:          global.commands?.size          || 0,
      nonPrefixCommands: global.nonPrefixCommands?.size || 0,
      eventCommands:     global.eventCommands?.length   || 0,
      usersTracked:      global.usersData?.size         || 0,
      maintenanceMode:   global.maintenanceMode         || false,
      dbConnected:       !!global.db,
      prefix:            global.config?.Prefix?.[0]    || "/",
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

  const guestSessions = new Map();
  const GUEST_TTL     = 1000 * 60 * 60 * 3;

  function createGuestSession(uid) {
    for (const [tok, d] of guestSessions) if (d.uid === uid) guestSessions.delete(tok);
    const token = crypto.randomBytes(24).toString("hex");
    guestSessions.set(token, { uid, expiry: Date.now() + GUEST_TTL });
    return token;
  }

  function getGuestSession(token) {
    if (!token || !guestSessions.has(token)) return null;
    const s = guestSessions.get(token);
    if (Date.now() > s.expiry) { guestSessions.delete(token); return null; }
    return s;
  }

  setInterval(() => {
    const now = Date.now();
    for (const [t, s] of guestSessions) if (now > s.expiry) guestSessions.delete(t);
  }, 3600000);

  function streamToDataURL(stream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on("data",  c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      stream.on("error", reject);
      stream.on("end", () => {
        const buf  = Buffer.concat(chunks);
        const mime = detectMime(buf);
        resolve({ dataUrl: "data:" + mime + ";base64," + buf.toString("base64"), mime, size: buf.length });
      });
    });
  }

  function detectMime(buf) {
    if (!buf || buf.length < 8) return "application/octet-stream";
    const h = buf.slice(0, 12);
    if (h[0] === 0xFF && h[1] === 0xD8 && h[2] === 0xFF) return "image/jpeg";
    if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4E && h[3] === 0x47) return "image/png";
    if (h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46) return "image/gif";
    if (h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x41) return "image/webp";
    if (h[4] === 0x66 && h[5] === 0x74 && h[6] === 0x79 && h[7] === 0x70) return "video/mp4";
    if (h[4] === 0x6D && h[5] === 0x6F && (h[6] === 0x6F || h[6] === 0x64)) return "video/mp4";
    if (h[0] === 0x1A && h[1] === 0x45 && h[2] === 0xDF && h[3] === 0xA3) return "video/webm";
    return "application/octet-stream";
  }

  async function serializeAttachment(a) {
    if (!a) return null;
    try {
      if (typeof a.pipe === "function") {
        const r = await streamToDataURL(a);
        return { kind: "media", mime: r.mime, dataUrl: r.dataUrl, size: r.size };
      }
      if (Buffer.isBuffer(a)) {
        const mime = detectMime(a);
        return { kind: "media", mime, dataUrl: "data:" + mime + ";base64," + a.toString("base64"), size: a.length };
      }
      if (typeof a === "string" && (a.startsWith("http://") || a.startsWith("https://"))) {
        return { kind: "url", url: a };
      }
      if (typeof a === "object") {
        if (a.url)  return { kind: "url",  url: a.url };
        if (a.path) return { kind: "file", path: a.path };
        return { kind: "object", data: JSON.stringify(a).slice(0, 200) };
      }
      return { kind: "unknown", raw: String(a).slice(0, 100) };
    } catch (err) {
      return { kind: "error", error: err.message };
    }
  }

  function createVirtualApi(uid, responseBuffer) {
    const VIRTUAL_THREAD = "guest_" + uid;
    return {
      async sendMessage(data, threadID, arg3, arg4) {
        let callback     = null;
        let replyToMsgID = null;
        if (typeof arg3 === "function") {
          callback     = arg3;
          replyToMsgID = arg4 || null;
        } else if (typeof arg3 === "string") {
          replyToMsgID = arg3;
        }
        let body = "", rawAttachments = [];
        if (typeof data === "string") {
          body = data;
        } else if (data && typeof data === "object") {
          body           = data.body || "";
          rawAttachments = data.attachment
            ? (Array.isArray(data.attachment) ? data.attachment : [data.attachment])
            : [];
        }
        const attachments = await Promise.all(rawAttachments.map(serializeAttachment));
        responseBuffer.push({
          type:        "message",
          body:        body.trim(),
          attachments: attachments.filter(Boolean),
          timestamp:   Date.now(),
        });
        const fakeInfo = {
          threadID:  VIRTUAL_THREAD,
          messageID: "vmsg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        };
        if (callback) callback(null, fakeInfo);
        return fakeInfo;
      },
      setMessageReaction(reaction, messageID, callback) {
        if (typeof callback === "function") callback(null);
      },
      sendTypingIndicator(threadID, callback) {
        if (typeof callback === "function") callback(null, () => {});
        return () => {};
      },
      async getUserInfo(userID) {
        if (global.botApi && global.botApi.getUserInfo) {
          try {
            return await new Promise((res, rej) =>
              global.botApi.getUserInfo(userID, (err, d) => err ? rej(err) : res(d))
            );
          } catch (e) {}
        }
        const id = Array.isArray(userID) ? userID[0] : userID;
        return { [id]: { name: "User " + id, vanity: "", thumbSrc: "" } };
      },
      async getThreadInfo(tid) {
        return { threadID: tid, name: "Guest Dashboard", isGroup: false, userInfo: [] };
      },
      async getThreadList(limit, timestamp, tags) {
        return (global.botApi && global.botApi.getThreadList)
          ? global.botApi.getThreadList(limit, timestamp, tags)
          : [];
      },
      getCurrentUserID() { return (global.botApi && global.botApi.getCurrentUserID) ? global.botApi.getCurrentUserID() : "0"; },
      changeNickname(n, t, p, cb) { if (typeof cb === "function") cb(null); return Promise.resolve(); },
      unsendMessage(messageID, cb) { if (typeof cb === "function") cb(null); return Promise.resolve(); },
      markAsRead(threadID, cb)     { if (typeof cb === "function") cb(null); },
      listenMqtt()  { return { stopListening: () => {} }; },
      setOptions()  {},
    };
  }

  function getGuestUserRole(uid) {
    uid = String(uid);
    if (!global.config) return 0;
    const developers = (global.config.developers || []).map(String);
    const moderators = (global.config.moderators || []).map(String);
    const admins     = (global.config.admins     || []).map(String);
    const vips       = (global.config.vips        || []).map(String);
    if (developers.includes(uid)) return 4;
    if (vips.includes(uid))       return 3;
    if (moderators.includes(uid)) return 2;
    if (admins.includes(uid))     return 1;
    return 0;
  }

  async function runGuestCommand(uid, input) {
    const prefix  = (global.config && global.config.Prefix && global.config.Prefix[0]) || "/";
    const trimmed = input.trim();
    const body    = trimmed.startsWith(prefix) ? trimmed : prefix + trimmed;
    const parts   = body.slice(prefix.length).trim().split(/\s+/);
    const cmdName = parts[0] ? parts[0].toLowerCase() : "";
    const args    = parts.slice(1);

    const command = (global.commands && global.commands.get(cmdName))
                 || (global.nonPrefixCommands && global.nonPrefixCommands.get(cmdName));

    if (!command) {
      return [{ type: "message", body: "Command \"" + cmdName + "\" not found. Use " + prefix + "help to see available commands.", attachments: [], timestamp: Date.now() }];
    }

    const userRole    = getGuestUserRole(uid);
    const commandRole = (command.config && command.config.role != null) ? command.config.role : (command.role != null ? command.role : 0);

    if (userRole < commandRole) {
      return [{ type: "message", body: "Permission denied. This command requires role " + commandRole + " and your role is " + userRole + ".", attachments: [], timestamp: Date.now() }];
    }

    const fakeEvent = {
      type:         "message",
      threadID:     "guest_" + uid,
      senderID:     String(uid),
      messageID:    "vmsg_" + Date.now(),
      body,
      attachments:  [],
      timestamp:    Date.now(),
      isGroup:      false,
      messageReply: null,
    };

    const responseBuffer = [];
    const vApi           = createVirtualApi(uid, responseBuffer);
    const vSendMessage   = async (api, msgData) =>
      vApi.sendMessage(
        { body: msgData.message || "", attachment: msgData.attachment },
        msgData.threadID,
        msgData.messageID || null
      );

    try {
      if (global.trackUsage) global.trackUsage(cmdName);
      if (command.execute) {
        await command.execute(vApi, fakeEvent, args, global.commands, prefix, (global.config && global.config.admins) || [], global.appState, vSendMessage, global.usersData, global.globalData);
      } else if (command.run) {
        await command.run({ api: vApi, event: fakeEvent, args, attachments: [], usersData: global.usersData, globalData: global.globalData, admins: (global.config && global.config.admins) || [], prefix, db: global.db, commands: global.commands });
      }
    } catch (err) {
      responseBuffer.push({ type: "message", body: "Command error: " + err.message, attachments: [], timestamp: Date.now() });
    }

    if (!responseBuffer.length) {
      responseBuffer.push({ type: "message", body: "(Command ran but produced no output.)", attachments: [], timestamp: Date.now() });
    }
    return responseBuffer;
  }

  app.get("/guest", (req, res) => {
    res.sendFile(path.join(__dirname, "guest.html"));
  });

  app.post("/guest/login", (req, res) => {
    const { uid } = req.body || {};
    if (!uid || !/^\d+$/.test(String(uid).trim())) {
      return res.status(400).json({ ok: false, error: "Please enter a valid numeric Facebook UID." });
    }
    const token = createGuestSession(String(uid).trim());
    global.log.info("[GUEST] Session created for UID " + uid + ".");
    return res.json({ ok: true, token, uid: String(uid).trim() });
  });

  app.post("/guest/logout", (req, res) => {
    const tok = req.headers["x-guest-token"];
    if (tok) guestSessions.delete(tok);
    return res.json({ ok: true });
  });

  app.get("/guest/commands", (req, res) => {
    const tok     = req.headers["x-guest-token"];
    const session = getGuestSession(tok);
    if (!session) return res.status(401).json({ ok: false, error: "Not logged in." });
    const userRole = getGuestUserRole(session.uid);
    const prefix   = (global.config && global.config.Prefix && global.config.Prefix[0]) || "/";
    const seen     = new Set();
    const cmds     = [...((global.commands && global.commands.values()) || [])]
      .filter(c => {
        const n = (c.config && c.config.name) || c.name;
        if (seen.has(n)) return false;
        seen.add(n);
        const cmdRole = (c.config && c.config.role != null) ? c.config.role : (c.role != null ? c.role : 0);
        return userRole >= cmdRole;
      })
      .map(c => ({
        name:        (c.config && c.config.name) || c.name || "unknown",
        description: (c.config && c.config.description) || c.description || "",
        usage:       (c.config && c.config.usage) || (prefix + ((c.config && c.config.name) || c.name)),
        cooldown:    (c.config && c.config.cooldown != null) ? c.config.cooldown : (c.cooldown != null ? c.cooldown : 3),
        role:        (c.config && c.config.role != null) ? c.config.role : (c.role != null ? c.role : 0),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return res.json({ ok: true, commands: cmds, prefix, userRole });
  });

  app.post("/guest/run", async (req, res) => {
    const tok     = req.headers["x-guest-token"];
    const session = getGuestSession(tok);
    if (!session) return res.status(401).json({ ok: false, error: "Session expired. Please log in again." });
    const { input } = req.body || {};
    if (!input || !input.trim()) return res.status(400).json({ ok: false, error: "input is required." });
    try {
      const responses = await runGuestCommand(session.uid, input);
      return res.json({ ok: true, responses });
    } catch (err) {
      global.log.error("[GUEST] Error: " + err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  global.log.success("[GUEST] Guest mode mounted at /guest");
};
