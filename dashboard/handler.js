const path = require("path");
const crypto = require("crypto");
const fs = require("fs-extra");
const express = require("express");


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
  app.use(express.json({ limit: "20mb" }));

  app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
  app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
  app.get("/guest", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
  app.get("/apk", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
  app.use("/assets", express.static(require("path").join(__dirname, "assets")));

  app.get("/download/dashboard.apk", (req, res) => {
  const apkPath = path.join(__dirname, "assets", "Kagenou_Dashboard__v12.0.0.apk");
  if (!fs.existsSync(apkPath)) {
    return res.status(404).json({ ok: false, error: "APK not available yet." });
  }
  res.download(apkPath, "KagenouDashboard.apk");
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
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post("/data/message", async (req, res) => {
    if (!checkAuth(req, res)) return;
    const { threadIDs, message } = req.body || {};
    if (!Array.isArray(threadIDs) || !threadIDs.length || !message?.trim())
      return res.status(400).json({ ok: false, error: "threadIDs (array) and message are required." });
    const api = global.botApi;
    if (!api) return res.status(503).json({ ok: false, error: "Bot not connected yet." });
    const formatted = `❲ 👑 ❳ Message from Admin\n━━━━━━━━━━━━━━━━━━\n${message.trim()}\n\nFrom: ${global.config?.botName || "Shadow Garden Bot"} Dashboard`;
    const { sent, failed } = await sendToThreads(api, threadIDs, formatted);
    return res.json({ ok: true, sent: sent.length, failed: failed.length, failedList: failed });
  });

  app.post("/data/broadcast", async (req, res) => {
    if (!checkAuth(req, res)) return;
    const { message } = req.body || {};
    if (!message?.trim()) return res.status(400).json({ ok: false, error: "message is required." });
    const api = global.botApi;
    if (!api) return res.status(503).json({ ok: false, error: "Bot not connected yet." });
    let threadList;
    try { threadList = await api.getThreadList(30, null, ["INBOX"]); }
    catch (err) { return res.status(500).json({ ok: false, error: "Failed to fetch thread list: " + err.message }); }
    const targets = threadList
      .filter(t => t.isGroup && t.name && t.name !== t.threadID)
      .map(t => t.threadID);
    const formatted = `❲ 👑 ❳ Broadcast from Admin\n━━━━━━━━━━━━━━━━━━\n${message.trim()}\n\nFrom: ${global.config?.botName || "Shadow Garden Bot"} Dashboard`;
    const { sent, failed } = await sendToThreads(api, targets, formatted);
    return res.json({ ok: true, sent: sent.length, failed: failed.length, total: targets.length });
  });

  app.post("/data/maintenance", (req, res) => {
    if (!checkAuth(req, res)) return;
    const { enabled } = req.body || {};
    if (typeof enabled !== "boolean") return res.status(400).json({ ok: false, error: "enabled must be true or false." });
    global.maintenanceMode = enabled;
    return res.json({ ok: true, maintenanceMode: global.maintenanceMode });
  });

  app.post("/data/reload", (req, res) => {
    if (!checkAuth(req, res)) return;
    if (typeof global.reloadCommands !== "function")
      return res.status(503).json({ ok: false, error: "reloadCommands not available." });
    try {
      global.reloadCommands();
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
  app.get("/data/guests/:uid", async (req, res) => {
    if (!checkAuth(req, res)) return;
    if (!global.db) return res.status(503).json({ ok: false, error: "Database not connected." });
    const uid = String(req.params.uid);
    try {
      const doc = await global.db.db(GUEST_COLLECTION).findOne({ uid });
      if (!doc) return res.status(404).json({ ok: false, error: "Account not found." });
      const premium = await global.db.db(PREMIUM_COLLECTION).findOne({ uid });
      return res.json({
        ok: true,
        account: {
          uid,
          displayName: doc.displayName || "",
          bio: doc.bio || "",
          birthdate: doc.birthdate || null,
          hasAvatar: !!doc.avatar,
          createdAt: doc.createdAt || null,
          passwordResetAt: doc.passwordResetAt || null,
          role: getGuestUserRole(uid),
          premiumActive: !!(premium && premium.active && (!premium.expiresAt || Date.now() < premium.expiresAt)),
          premiumExpiresAt: premium?.expiresAt || null,
        },
      });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });
  app.post("/data/guests/:uid/reset-password", async (req, res) => {
    if (!checkAuth(req, res)) return;
    if (!global.db) return res.status(503).json({ ok: false, error: "Database not connected." });
    const uid = String(req.params.uid);
    const { newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 6)
      return res.status(400).json({ ok: false, error: "Password must be at least 6 characters." });
    try {
      const existing = await getGuestAccount(uid);
      if (!existing) return res.status(404).json({ ok: false, error: "Account not found." });
      const hash = hashPassword(String(newPassword));
      await global.db.db(GUEST_COLLECTION).updateOne(
        { uid },
        { $set: { passwordHash: hash, passwordResetAt: Date.now() } }
      );
      guestAccounts.set(uid, { passwordHash: hash });
      // log the user out everywhere
      for (const [tok, d] of guestSessions) if (d.uid === uid) guestSessions.delete(tok);
      global.log.info("[GUEST] Admin reset password for UID " + uid);
      return res.json({ ok: true });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.delete("/data/banned/:userID", async (req, res) => {
    if (!checkAuth(req, res)) return;
    const { userID } = req.params;
    if (global.db) {
      try {
        await global.db.db("bannedUsers").deleteOne({ userId: userID });
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

  global.log.success("[DASHBOARD] Admin dashboard mounted at / and /admin");

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

  function detectMime(buf) {
    if (!buf || buf.length < 12) return "application/octet-stream";
    const h = buf.slice(0, 12);
    if (h[0]===0xFF && h[1]===0xD8 && h[2]===0xFF) return "image/jpeg";
    if (h[0]===0x89 && h[1]===0x50 && h[2]===0x4E && h[3]===0x47) return "image/png";
    if (h[0]===0x47 && h[1]===0x49 && h[2]===0x46) return "image/gif";
    if (h[0]===0x52 && h[1]===0x49 && h[2]===0x46 && h[3]===0x41) return "image/webp";
    if (h[4]===0x66 && h[5]===0x74 && h[6]===0x79 && h[7]===0x70) return "video/mp4";
    if (h[0]===0x1A && h[1]===0x45 && h[2]===0xDF && h[3]===0xA3) return "video/webm";
    if (h[0]===0x49 && h[1]===0x44 && h[2]===0x33) return "audio/mp3";
    if (h[0]===0xFF && (h[1]&0xE0)===0xE0) return "audio/mp3";
    if (h[0]===0x4F && h[1]===0x67 && h[2]===0x67 && h[3]===0x53) return "audio/ogg";
    if (h[0]===0x52&&h[1]===0x49&&h[2]===0x46&&h[3]===0x46&&h[8]===0x57&&h[9]===0x41&&h[10]===0x56&&h[11]===0x45) return "audio/wav";
    return "application/octet-stream";
  }

  function getMimeFromFilename(filename) {
    if (!filename) return null;
    const ext = String(filename).split(".").pop().toLowerCase();
    return { mp4:"video/mp4", webm:"video/webm", mov:"video/quicktime", mp3:"audio/mp3", ogg:"audio/ogg", wav:"audio/wav", m4a:"audio/m4a", aac:"audio/aac", flac:"audio/flac", jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", gif:"image/gif", webp:"image/webp" }[ext] || null;
  }

  function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on("data", c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
  }

  async function serializeAttachment(a) {
    if (!a) return null;
    try {
      
      if (a && typeof a.then === "function") a = await a;
      if (!a) return null;

      
      const hintMime = typeof a === "object"
        ? (getMimeFromFilename(a.filename) || getMimeFromFilename(a.name) || getMimeFromFilename(a.path) || a.mimetype || a.contentType || a.type || null)
        : null;

      
      if (a && typeof a === "object" && typeof a.pipe === "function") {
        const pathHint = a.path || null;
        const mime = hintMime || getMimeFromFilename(pathHint) || "application/octet-stream";
        const buf = await streamToBuffer(a);
        const finalMime = hintMime || detectMime(buf);
        return { kind: "media", mime: finalMime, dataUrl: "data:" + finalMime + ";base64," + buf.toString("base64"), size: buf.length };
      }

      
      if (a && typeof a === "object" && a.stream && typeof a.stream.pipe === "function") {
        const buf = await streamToBuffer(a.stream);
        const finalMime = hintMime || detectMime(buf);
        return { kind: "media", mime: finalMime, dataUrl: "data:" + finalMime + ";base64," + buf.toString("base64"), size: buf.length };
      }

      
      if (Buffer.isBuffer(a)) {
        const finalMime = hintMime || detectMime(a);
        return { kind: "media", mime: finalMime, dataUrl: "data:" + finalMime + ";base64," + a.toString("base64"), size: a.length };
      }

      
      if (a instanceof ArrayBuffer || ArrayBuffer.isView(a)) {
        const buf = Buffer.from(a instanceof ArrayBuffer ? a : a.buffer);
        const finalMime = hintMime || detectMime(buf);
        return { kind: "media", mime: finalMime, dataUrl: "data:" + finalMime + ";base64," + buf.toString("base64"), size: buf.length };
      }

      
      if (typeof a === "string" && !a.startsWith("http") && fs.existsSync(a)) {
        const buf = fs.readFileSync(a);
        const finalMime = getMimeFromFilename(a) || detectMime(buf);
        return { kind: "media", mime: finalMime, dataUrl: "data:" + finalMime + ";base64," + buf.toString("base64"), size: buf.length };
      }

      
      if (typeof a === "string" && (a.startsWith("http://") || a.startsWith("https://"))) {
        return { kind: "url", url: a };
      }

      
      if (a && typeof a === "object" && a.path) {
        const buf = fs.readFileSync(a.path);
        const finalMime = hintMime || getMimeFromFilename(a.path) || detectMime(buf);
        return { kind: "media", mime: finalMime, dataUrl: "data:" + finalMime + ";base64," + buf.toString("base64"), size: buf.length };
      }

      
      if (a && typeof a === "object" && a.url) {
        return { kind: "url", url: a.url };
      }

      
      if (a && typeof a === "object" && a.data && Buffer.isBuffer(a.data)) {
        const finalMime = hintMime || detectMime(a.data);
        return { kind: "media", mime: finalMime, dataUrl: "data:" + finalMime + ";base64," + a.data.toString("base64"), size: a.data.length };
      }

      return { kind: "unknown", raw: String(a).slice(0, 100) };
    } catch (err) {
      return { kind: "error", error: err.message };
    }
  }

  function createVirtualApi(uid, responseBuffer) {
    const VIRTUAL_THREAD = "guest_" + uid;

    function resolveAttachments(raw) {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      
      return [raw];
    }

    const vApi = {
      async sendMessage(data, threadID, arg3, arg4) {
        let callback = null;
        let replyToMsgID = null;
        if (typeof arg3 === "function") { callback = arg3; replyToMsgID = arg4 || null; }
        else if (typeof arg3 === "string") { replyToMsgID = arg3; }
        else if (typeof arg4 === "function") { callback = arg4; }

        let body = "", rawAttachments = [];
        if (typeof data === "string") {
          body = data;
        } else if (data && typeof data === "object") {
          body = data.body || data.message || "";
          rawAttachments = resolveAttachments(data.attachment);
        }

        const attachments = await Promise.all(rawAttachments.map(serializeAttachment));
        const fakeInfo = {
          threadID:  VIRTUAL_THREAD,
          messageID: "vmsg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        };
        if (!global._guestMessageStore) global._guestMessageStore = new Map();
        global._guestMessageStore.set(fakeInfo.messageID, {
          body: typeof body === "string" ? body.trim() : String(body || ""),
          attachments: attachments.filter(Boolean),
          edited: false,
          unsent: false,
        });
                const msgEntry = {
          type:        "message",
          body:        typeof body === "string" ? body.trim() : String(body || ""),
          attachments: attachments.filter(Boolean),
          timestamp:   Date.now(),
          messageID:   fakeInfo.messageID,
          edited:      false,
          unsent:      false,
        };
        if (typeof callback === "function") {
          callback(null, fakeInfo);
          
          if (global.Kagenou?.replies?.[fakeInfo.messageID]) {
            const registeredReply = global.Kagenou.replies[fakeInfo.messageID];
            if (!global._guestReplyListeners) global._guestReplyListeners = new Map();
            global._guestReplyListeners.set(fakeInfo.messageID, {
              callback:  registeredReply.callback,
              author:    registeredReply.author,
              expiresAt: Date.now() + 30 * 60 * 1000,
              uid, oneShot: true,
            });
            delete global.Kagenou.replies[fakeInfo.messageID];
          }
        }

        responseBuffer.push(msgEntry);
        return fakeInfo;
      },

      setMessageReaction(reaction, messageID, callback) {
        if (typeof callback === "function") callback(null);
        return Promise.resolve();
      },
      sendTypingIndicator(threadID, callback) {
        if (typeof callback === "function") callback(null, () => {});
        return () => {};
      },
      async getUserInfo(userID) {
        if (global.botApi?.getUserInfo) {
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
        return { threadID: tid || VIRTUAL_THREAD, name: "Guest Dashboard", isGroup: false, userInfo: [] };
      },
      async getThreadList(limit, timestamp, tags) {
        return global.botApi?.getThreadList ? global.botApi.getThreadList(limit, timestamp, tags) : [];
      },
      getCurrentUserID() {
        return global.botApi?.getCurrentUserID ? global.botApi.getCurrentUserID() : String(uid);
      },
      changeNickname(n, t, p, cb)  { if (typeof cb === "function") cb(null); return Promise.resolve(); },
      async unsendMessage(messageID, cb) {
        if (!global._guestMessageStore) global._guestMessageStore = new Map();
        global._guestMessageStore.set(String(messageID), {
          ...(global._guestMessageStore.get(String(messageID)) || {}),
          unsent: true,
          body: "",
          attachments: [],
        });
        if (typeof cb === "function") cb(null);
        return Promise.resolve();
      },
      async editMessage(newBody, messageID, threadID, cb) {
  if (!global._guestMessageStore) global._guestMessageStore = new Map();
  const existing = global._guestMessageStore.get(String(messageID)) || {};
  global._guestMessageStore.set(String(messageID), {
    ...existing,
    body: newBody,
    edited: true,
  });
  if (typeof cb === "function") cb(null);
  return Promise.resolve();
},
markAsRead(threadID, cb)     { if (typeof cb === "function") cb(null); return Promise.resolve(); },
      markAsDelivered(tid, mid, cb){ if (typeof cb === "function") cb(null); return Promise.resolve(); },
      listenMqtt()   { return { stopListening: () => {} }; },
      setOptions()   {},
      getAppState()  { return global.appState || {}; },
      async sendFile(filepath, threadID, callback) {
        const a = await serializeAttachment({ path: filepath });
        const fakeInfo = { threadID: VIRTUAL_THREAD, messageID: "vmsg_" + Date.now() };
        responseBuffer.push({ type: "message", body: "", attachments: [a].filter(Boolean), timestamp: Date.now(), messageID: fakeInfo.messageID });
        if (typeof callback === "function") callback(null, fakeInfo);
        return fakeInfo;
      },
      httpGet(url, callback) {
        const https = url.startsWith("https") ? require("https") : require("http");
        https.get(url, res => {
          const chunks = [];
          res.on("data", c => chunks.push(c));
          res.on("end", () => { if (typeof callback === "function") callback(null, Buffer.concat(chunks)); });
        }).on("error", err => { if (typeof callback === "function") callback(err); });
      },
    };

    return vApi;
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

  function buildFakeReplyEvent(uid, replyToMessageID, newInput) {
    return {
      type:         "message_reply",
      threadID:     "guest_" + uid,
      senderID:     String(uid),
      messageID:    "vmsg_reply_" + Date.now(),
      body:         newInput,
      attachments:  [],
      timestamp:    Date.now(),
      isGroup:      false,
      messageReply: { messageID: replyToMessageID },
    };
  }

  async function handleGuestReply(uid, replyToMessageID, newInput, responseBuffer, vApi) {
    const listeners = [
      global._guestReplyListeners,
      global.replyListeners,
      global.Kagenou?.replyListeners,
    ];

    for (const map of listeners) {
      if (!map || !map.has(replyToMessageID)) continue;
      const data = map.get(replyToMessageID);
      if (data.expiresAt && Date.now() > data.expiresAt) {
        map.delete(replyToMessageID);
        responseBuffer.push({ type: "message", body: "⏰ This reply has expired.", attachments: [], timestamp: Date.now() });
        return true;
      }
      if (data.author && String(uid) !== String(data.author)) {
        responseBuffer.push({ type: "message", body: "Only the original sender can reply.", attachments: [], timestamp: Date.now() });
        return true;
      }
      const fakeReplyEvent = buildFakeReplyEvent(uid, replyToMessageID, newInput);
      try {
        await data.callback({ ...fakeReplyEvent, event: fakeReplyEvent, api: vApi, attachments: [], data: data.data || data, originalMessageID: replyToMessageID });
        if (data.oneShot !== false) map.delete(replyToMessageID);
      } catch (err) {
        responseBuffer.push({ type: "message", body: "⚠️ Reply error: " + err.message, attachments: [], timestamp: Date.now() });
      }
      return true;
    }

    if (global.Kagenou?.replies?.[replyToMessageID]) {
      const replyData = global.Kagenou.replies[replyToMessageID];
      if (replyData.author && String(uid) !== String(replyData.author)) {
        responseBuffer.push({ type: "message", body: "Only the original sender can reply.", attachments: [], timestamp: Date.now() });
        return true;
      }
      const fakeReplyEvent = buildFakeReplyEvent(uid, replyToMessageID, newInput);
      try {
        await replyData.callback({ ...fakeReplyEvent, event: fakeReplyEvent, api: vApi, attachments: [], data: replyData });
      } catch (err) {
        responseBuffer.push({ type: "message", body: "⚠️ Reply error: " + err.message, attachments: [], timestamp: Date.now() });
      }
      return true;
    }

    return false;
  }

  async function handleGuestReaction(uid, messageID, reaction) {
    const senderID = String(uid);
    if (global.usersData && !global.usersData.has(senderID)) {
      global.usersData.set(senderID, { messages: 0, reactions: 0 });
    }
    if (global.usersData) {
      const s = global.usersData.get(senderID) || {};
      s.reactions = (s.reactions || 0) + 1;
      global.usersData.set(senderID, s);
    }
    if (!global.reactionData) global.reactionData = new Map();
    if (!global.reactionData.has(messageID)) {
      global.reactionData.set(messageID, { count: 0, users: new Set(), callback: null });
    }
    const info = global.reactionData.get(messageID);
    info.count = (info.count || 0) + 1;
    info.users = info.users || new Set();
    info.users.add(senderID);
    global.reactionData.set(messageID, info);

    if (info.callback && typeof info.callback === "function") {
      const responseBuffer = [];
      const vApi = createVirtualApi(uid, responseBuffer);
      try {
        const fakeEvent = { type: "message_reaction", threadID: "guest_" + uid, senderID, messageID, reaction, timestamp: Date.now() };
        await info.callback({ api: vApi, event: fakeEvent, reaction, threadID: "guest_" + uid, messageID, senderID });
        global.reactionData.delete(messageID);
        return { ok: true, responses: responseBuffer };
      } catch (err) {
        return { ok: false, error: err.message, responses: [] };
      }
    }
    return { ok: true, responses: [] };
  }

  async function runGuestCommand(uid, input, replyToMessageID) {
  const prefix  = (global.config?.Prefix?.[0]) || "/";
  const trimmed = input.trim();

  const responseBuffer = [];
  const vApi  = createVirtualApi(uid, responseBuffer);

 if (replyToMessageID) {
    const prefix = (global.config?.Prefix?.[0]) || "/";
    const parts = trimmed.startsWith(prefix)
      ? trimmed.slice(prefix.length).trim().split(/\s+/)
      : trimmed.split(/\s+/);
    const cmdNameCheck = parts[0]?.toLowerCase() || "";
    const cmdCheck = global.commands?.get(cmdNameCheck);

    const isReplyCmd = cmdCheck &&
      (cmdCheck.config?.useReply === true ||
       cmdCheck.config?.hasReply === true ||
       cmdCheck.config?.name === "unsend" ||
       (cmdCheck.name || cmdCheck.config?.name) === "unsend");

    if (!isReplyCmd) {
      const handled = await handleGuestReply(uid, replyToMessageID, trimmed, responseBuffer, vApi);
      if (handled) {
        if (!responseBuffer.length) {
          responseBuffer.push({ type: "message", body: "(Reply processed.)", attachments: [], timestamp: Date.now() });
        }
        return responseBuffer;
      }
      return [{ type: "message", body: "⚠️ This reply is no longer active or has expired.", attachments: [], timestamp: Date.now() }];
    }
  }
  
  let command = null;
  let body    = trimmed;
  let cmdName = "";
  let args    = [];

  if (trimmed.startsWith(prefix)) {
    const parts = trimmed.slice(prefix.length).trim().split(/\s+/);
    cmdName = parts[0]?.toLowerCase() || "";
    args = parts.slice(1);
    command = global.commands?.get(cmdName);
    
    if (!command) {
      return [{ type: "message", body: `Command "${cmdName}" not found. Use ${prefix}help to see available commands.`, attachments: [], timestamp: Date.now() }];
    }
  } else {
    const firstWord = trimmed.toLowerCase().split(/\s+/)[0] || "";
    const exactCmd = global.nonPrefixCommands?.get(firstWord);
    if (exactCmd && (exactCmd.config?.nonPrefix === true || exactCmd.nonPrefix === true)) {
      command = exactCmd;
      cmdName = firstWord;
      args = trimmed.split(/\s+/).slice(1);
    } else {
      for (const [name, cmd] of global.nonPrefixCommands || []) {
        if (cmd.config?.nonPrefix === true || cmd.nonPrefix === true) {
          if (trimmed.toLowerCase().startsWith(name.toLowerCase())) {
            command = cmd;
            cmdName = name;
            const remaining = trimmed.slice(name.length).trim();
            args = remaining ? remaining.split(/\s+/) : [];
            break;
          }
        }
      }
    }
    
    if (!command) {
      return [{ type: "message", body: `Command not recognized. Use ${prefix}help to see available commands.`, attachments: [], timestamp: Date.now() }];
    }
  }
    const userRole    = getGuestUserRole(uid);
    const commandRole = command.config?.role ?? command.role ?? 0;
    if (userRole < commandRole) {
      return [{ type: "message", body: `Permission denied. Requires role ${commandRole}, your role is ${userRole}.`, attachments: [], timestamp: Date.now() }];
    }

    const fakeEvent = {
      type: "message", threadID: "guest_" + uid, senderID: String(uid),
      messageID: "vmsg_" + Date.now(), body, attachments: [], timestamp: Date.now(),
      isGroup: false,
      messageReply: replyToMessageID ? {
        messageID: replyToMessageID,
        senderID:  vApi.getCurrentUserID(),
        body:      "",
      } : null,
    };

    try {
      if (global.trackUsage) global.trackUsage(cmdName);

      await new Promise(async (resolve) => {
        const timeout = setTimeout(resolve, 90000);
        const done = () => { clearTimeout(timeout); resolve(); };
        try {
          if (command.execute) {
            const result = command.execute(vApi, fakeEvent, args, global.commands, prefix, global.config?.admins || [], global.appState, null, global.usersData, global.globalData);
            if (result && typeof result.then === "function") await result;
          } else if (command.run) {
            const result = command.run({ api: vApi, event: fakeEvent, args, attachments: [], usersData: global.usersData, globalData: global.globalData, admins: global.config?.admins || [], prefix, db: global.db, commands: global.commands });
            if (result && typeof result.then === "function") await result;
          }
        } catch (err) {
          responseBuffer.push({ type: "message", body: "Command error: " + err.message, attachments: [], timestamp: Date.now() });
        }
        setTimeout(done, 500);
      });

    } catch (err) {
      responseBuffer.push({ type: "message", body: "Command error: " + err.message, attachments: [], timestamp: Date.now() });
    }

    if (!responseBuffer.length) {
      responseBuffer.push({ type: "message", body: "(Command ran but produced no output.)", attachments: [], timestamp: Date.now() });
    }
    return responseBuffer;
  }

  const GUEST_COLLECTION = "guestUsers";
  const guestAccounts = new Map();

  async function loadGuestAccounts() {
    if (!global.db) { global.log.warn("[GUEST] No DB connected — guest accounts unavailable."); return; }
    try {
      const all = await global.db.db(GUEST_COLLECTION).find({}).toArray();
      all.forEach(a => guestAccounts.set(String(a.uid), { passwordHash: a.passwordHash }));
      global.log.info("[GUEST] Loaded " + all.length + " guest accounts from MongoDB.");
    } catch (e) { global.log.error("[GUEST] Failed to load guest accounts: " + e.message); }
  }
  loadGuestAccounts();

  async function saveGuestAccount(uid, passwordHash) {
    guestAccounts.set(uid, { passwordHash });
    if (!global.db) throw new Error("No database connected.");
    await global.db.db(GUEST_COLLECTION).updateOne({ uid }, { $set: { uid, passwordHash, createdAt: new Date() } }, { upsert: true });
  }

  async function getGuestAccount(uid) {
    if (guestAccounts.has(uid)) return guestAccounts.get(uid);
    if (!global.db) return null;
    try {
      const doc = await global.db.db(GUEST_COLLECTION).findOne({ uid });
      if (doc) { guestAccounts.set(uid, { passwordHash: doc.passwordHash }); return { passwordHash: doc.passwordHash }; }
    } catch (e) { global.log.error("[GUEST] DB lookup error: " + e.message); }
    return null;
  }

  function hashPassword(password) {
    return crypto.createHash("sha256").update(password + "sgbot_salt_2025").digest("hex");
  }

  app.post("/data/guests/reset", async (req, res) => {
    if (!checkAuth(req, res)) return;
    if (!global.db) return res.status(503).json({ ok: false, error: "Database not connected." });
    try {
      await global.db.db(GUEST_COLLECTION).deleteMany({});
      guestAccounts.clear();
      return res.json({ ok: true, message: "All guest accounts deleted." });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get("/data/guests", async (req, res) => {
    if (!checkAuth(req, res)) return;
    if (!global.db) return res.status(503).json({ ok: false, error: "Database not connected." });
    try {
      const all = await global.db.db(GUEST_COLLECTION).find({}, { projection: { uid: 1, createdAt: 1, _id: 0 } }).toArray();
      return res.json({ ok: true, total: all.length, guests: all });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.delete("/data/guests/:uid", async (req, res) => {
    if (!checkAuth(req, res)) return;
    if (!global.db) return res.status(503).json({ ok: false, error: "Database not connected." });
    const { uid } = req.params;
    try {
      await global.db.db(GUEST_COLLECTION).deleteOne({ uid });
      guestAccounts.delete(uid);
      return res.json({ ok: true });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post("/guest/register", async (req, res) => {
    const { uid, password } = req.body || {};
    if (!uid || !/^\d+$/.test(String(uid))) return res.status(400).json({ ok: false, error: "Please enter a valid numeric Facebook UID." });
    if (!password) return res.status(400).json({ ok: false, error: "Password is required." });
    if (String(password).length < 6) return res.status(400).json({ ok: false, error: "Password must be at least 6 characters." });
    const cleanUid = String(uid).trim();
    const existing = await getGuestAccount(cleanUid);
    if (existing) return res.status(409).json({ ok: false, error: "This UID is already registered.", exists: true });
    try {
      await saveGuestAccount(cleanUid, hashPassword(password));
      global.log.info("[GUEST] New account registered for UID " + cleanUid + ".");
      return res.json({ ok: true });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post("/guest/login", async (req, res) => {
    const { uid, password } = req.body || {};
    if (!uid || !/^\d+$/.test(String(uid))) return res.status(400).json({ ok: false, error: "Please enter a valid numeric Facebook UID." });
    if (!password) return res.status(400).json({ ok: false, error: "Password is required." });
    const cleanUid = String(uid).trim();
    const account = await getGuestAccount(cleanUid);
    if (!account) return res.status(404).json({ ok: false, error: "UID not registered. Please create an account first.", notFound: true });
    if (account.passwordHash !== hashPassword(password)) return res.status(401).json({ ok: false, error: "Incorrect password." });
    const token = createGuestSession(cleanUid);
    global.log.info("[GUEST] Session created for UID " + cleanUid + ".");
    return res.json({ ok: true, token, uid: cleanUid });
  });

  app.post("/guest/logout", (req, res) => {
    const tok = req.headers["x-guest-token"];
    if (tok) guestSessions.delete(tok);
    return res.json({ ok: true });
  });

  app.get("/guest/commands", (req, res) => {
    const session = getGuestSession(req.headers["x-guest-token"]);
    if (!session) return res.status(401).json({ ok: false, error: "Not logged in." });
    const userRole = getGuestUserRole(session.uid);
    const prefix   = global.config?.Prefix?.[0] || "/";
    const seen = new Set();
    const cmds = [...((global.commands && global.commands.values()) || [])]
      .filter(c => {
        const n = c.config?.name || c.name;
        if (seen.has(n)) return false;
        seen.add(n);
        return userRole >= (c.config?.role ?? c.role ?? 0);
      })
      .map(c => ({
        name:        c.config?.name || c.name || "unknown",
        description: c.config?.description || c.description || "",
        usage:       c.config?.usage || (prefix + (c.config?.name || c.name)),
        cooldown:    c.config?.cooldown ?? c.cooldown ?? 3,
        role:        c.config?.role ?? c.role ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return res.json({ ok: true, commands: cmds, prefix, userRole });
  });

  app.post("/guest/run", async (req, res) => {
    const session = getGuestSession(req.headers["x-guest-token"]);
    if (!session) return res.status(401).json({ ok: false, error: "Session expired. Please log in again." });
    const { input, replyTo } = req.body || {};
    if (!input?.trim()) return res.status(400).json({ ok: false, error: "input is required." });
    try {
      const responses = await runGuestCommand(session.uid, input, replyTo || null);
      return res.json({ ok: true, responses });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

    app.get("/guest/message-state", (req, res) => {
        const session = getGuestSession(req.headers["x-guest-token"]);
        if (!session) return res.status(401).json({ ok: false });
        if (!global._guestMessageStore) return res.json({ ok: true, messages: {} });
        const out = {};
        for (const [id, data] of global._guestMessageStore.entries()) {
          if (data.edited || data.unsent) {
            out[id] = { body: data.body || "", edited: !!data.edited, unsent: !!data.unsent };
          }
        }
        return res.json({ ok: true, messages: out });
      });
      
      app.post("/guest/react", async (req, res) => {
    const session = getGuestSession(req.headers["x-guest-token"]);
    if (!session) return res.status(401).json({ ok: false, error: "Not logged in." });
    const { messageID, reaction } = req.body || {};
    if (!messageID || !reaction) return res.status(400).json({ ok: false, error: "messageID and reaction are required." });
    const VALID = ["😢","👍","🤩","🗿","💝","❤️","😂","😮","😡"];
    if (!VALID.includes(reaction)) return res.status(400).json({ ok: false, error: "Invalid reaction." });
    try {
      const result = await handleGuestReaction(session.uid, messageID, reaction);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message, responses: [] });
    }
  });

  
  function guestAuth(req, res) {
    const session = getGuestSession(req.headers["x-guest-token"]);
    if (!session) { res.status(401).json({ ok: false, error: "Not logged in." }); return null; }
    return session;
  }

  function dbRequired(res) {
    if (!global.db) { res.status(503).json({ ok: false, error: "Database not connected." }); return false; }
    return true;
  }

  async function getProfile(uid) {
    const doc = global.db ? await global.db.db("guestUsers").findOne({ uid }) : null;
    return {
      uid,
      displayName: doc?.displayName || ("User " + uid.slice(-6)),
      bio:         doc?.bio         || "",
      avatar:      doc?.avatar      || null,
      birthdate:   doc?.birthdate   || null,
      createdAt:   doc?.createdAt   || null,
    };
  }

  app.get("/social/profile/me", async (req, res) => {
    const session = guestAuth(req, res); if (!session) return;
    if (!dbRequired(res)) return;
    try {
      const profile = await getProfile(session.uid);
      const userRole = getGuestUserRole(session.uid);
      return res.json({ ok: true, profile, userRole });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
    });
  
  app.get("/social/users", async (req, res) => {
  const session = guestAuth(req, res); if (!session) return;
  if (!dbRequired(res)) return;
  try {
    const docs = await global.db.db("guestUsers").find({}).toArray();
    const users = await Promise.all(docs.map(async doc => {
      const profile = await getProfile(doc.uid);
      return { profile, userRole: getGuestUserRole(doc.uid) };
    }));
    return res.json({ ok: true, users });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.patch("/social/profile", async (req, res) => {
    const session = guestAuth(req, res); if (!session) return;
    if (!dbRequired(res)) return;
    const { displayName, bio, avatar, birthdate } = req.body || {};
    const update = {};
    if (displayName !== undefined) update.displayName = String(displayName).slice(0, 40);
    if (bio !== undefined)         update.bio         = String(bio).slice(0, 200);
    if (avatar !== undefined)      update.avatar      = avatar;
    if (birthdate !== undefined)   update.birthdate   = String(birthdate).slice(0, 20);
    try {
      await global.db.db("guestUsers").updateOne({ uid: session.uid }, { $set: update }, { upsert: true });
      return res.json({ ok: true });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get("/social/search", async (req, res) => {
    const session = guestAuth(req, res); if (!session) return;
    if (!dbRequired(res)) return;
    const { q } = req.query;
    if (!q?.trim()) return res.status(400).json({ ok: false, error: "Query required." });
    try {
      const trimmed = q.trim();
      let doc = await global.db.db("guestUsers").findOne({ uid: trimmed });
      if (!doc) {
        doc = await global.db.db("guestUsers").findOne({ displayName: { $regex: new RegExp("^" + trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") } });
      }
      if (!doc) return res.json({ ok: false, error: "User not found." });
      const profile = await getProfile(doc.uid);
      const userRole = getGuestUserRole(doc.uid);
      return res.json({ ok: true, profile, userRole });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get("/social/profile/:uid", async (req, res) => {
    const session = guestAuth(req, res); if (!session) return;
    if (!dbRequired(res)) return;
    try {
      const profile = await getProfile(req.params.uid);
      const userRole = getGuestUserRole(req.params.uid);
      const collections = await global.db.db("collections").find({ uid: req.params.uid }).sort({ createdAt: -1 }).toArray();
      return res.json({ ok: true, profile, userRole, collections, isSelf: session.uid === req.params.uid });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get("/social/collection", async (req, res) => {
    const session = guestAuth(req, res); if (!session) return;
    if (!dbRequired(res)) return;
    try {
      const items = await global.db.db("collections").find({ uid: session.uid }).sort({ createdAt: -1 }).toArray();
      return res.json({ ok: true, items });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post("/social/collection", async (req, res) => {
    const session = guestAuth(req, res); if (!session) return;
    if (!dbRequired(res)) return;
    const { mediaData, mediaType, mime, caption } = req.body || {};
    if (!mediaData) return res.status(400).json({ ok: false, error: "mediaData required." });
    if (!["image","video"].includes(mediaType)) return res.status(400).json({ ok: false, error: "mediaType must be image or video." });
    if (Buffer.byteLength(mediaData, "base64") > 10 * 1024 * 1024) return res.status(413).json({ ok: false, error: "File too large. Max 10MB." });
    try {
      const id = newId();
      const finalMime = mime || (mediaType === "video" ? "video/mp4" : "image/jpeg");
      const dataUrl = `data:${finalMime};base64,${mediaData}`;
      await global.db.db("collections").insertOne({
        id, uid: session.uid, mediaType, mime: finalMime, dataUrl,
        caption: (caption || "").slice(0, 300),
        createdAt: Date.now()
      });
      return res.json({ ok: true, id });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.delete("/social/collection/:id", async (req, res) => {
    const session = guestAuth(req, res); if (!session) return;
    if (!dbRequired(res)) return;
    try {
      const item = await global.db.db("collections").findOne({ id: req.params.id });
      if (!item) return res.status(404).json({ ok: false, error: "Not found." });
      if (item.uid !== session.uid) return res.status(403).json({ ok: false, error: "Not yours." });
      await global.db.db("collections").deleteOne({ id: req.params.id });
      return res.json({ ok: true });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  function newId() { return crypto.randomBytes(12).toString('hex'); }

  app.post("/group/create", async (req, res) => {
    const session = guestAuth(req, res); if (!session) return;
    if (!dbRequired(res)) return;
    const { name, members } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ ok: false, error: "Group name required." });
    const allMembers = [...new Set([session.uid, ...(members||[]).map(String)])];
    try {
      const id = newId();
      await global.db.db("groups").insertOne({ id, name: name.trim().slice(0,40), ownerUID: session.uid, members: allMembers, createdAt: Date.now() });
      await global.db.db("groupMessages").insertOne({ groupId: id, role: "bot", senderUID: "bot", body: `Welcome to "${name.trim()}"! You can now run bot commands here.`, attachments: [], ts: Date.now(), id: newId() });
      return res.json({ ok: true, id });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get("/group/list", async (req, res) => {
    const session = guestAuth(req, res); if (!session) return;
    if (!dbRequired(res)) return;
    try {
      const groups = await global.db.db("groups").find({ members: session.uid }).sort({ createdAt: -1 }).toArray();
      return res.json({ ok: true, groups: groups.map(g => ({ id: g.id, name: g.name, ownerUID: g.ownerUID, memberCount: g.members.length })) });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get("/group/:id/messages", async (req, res) => {
    const session = guestAuth(req, res); if (!session) return;
    if (!dbRequired(res)) return;
    try {
      const group = await global.db.db("groups").findOne({ id: req.params.id });
      if (!group) return res.status(404).json({ ok: false, error: "Group not found." });
      if (!group.members.includes(session.uid)) return res.status(403).json({ ok: false, error: "Not a member." });
      const messages = await global.db.db("groupMessages").find({ groupId: req.params.id }).sort({ ts: 1 }).limit(100).toArray();
      const msgMap = {};
      messages.forEach(m => { msgMap[m.id] = m; });
      const enriched = messages.map(m => {
        if (m.replyTo && msgMap[m.replyTo]) {
          const target = msgMap[m.replyTo];
          const targetProfile = target.senderUID === 'bot' ? { displayName: 'KagenouBot' } : null;
          return { ...m, replyToBody: target.body || '', replyToSender: target.senderUID === 'bot' ? 'KagenouBot' : (target.senderUID || 'User') };
        }
        return m;
      });
      const profiles = {};
      for (const m of enriched) {
        if (m.senderUID && m.senderUID !== 'bot' && !profiles[m.senderUID]) {
          profiles[m.senderUID] = await getProfile(m.senderUID);
        }
      }
      for (const uid of group.members) {
        if (!profiles[uid]) profiles[uid] = await getProfile(uid);
      }
      return res.json({ ok: true, messages: enriched, profiles, memberCount: group.members.length, group });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post("/group/:id/run", async (req, res) => {
    const session = guestAuth(req, res); if (!session) return;
    if (!dbRequired(res)) return;
    const { input, replyTo } = req.body || {};
    if (!input?.trim()) return res.status(400).json({ ok: false, error: "input required." });
    try {
      const group = await global.db.db("groups").findOne({ id: req.params.id });
      if (!group) return res.status(404).json({ ok: false, error: "Group not found." });
      if (!group.members.includes(session.uid)) return res.status(403).json({ ok: false, error: "Not a member." });

      const groupThreadId = "group_" + req.params.id;
      const userMsgId = "vmsg_" + Date.now() + "_" + Math.random().toString(36).slice(2,6);
      let replyToBody = undefined, replyToSender = undefined;
      if (replyTo) {
        const targetMsg = await global.db.db("groupMessages").findOne({ groupId: req.params.id, id: replyTo });
        if (targetMsg) {
          replyToBody = targetMsg.body || '';
          replyToSender = targetMsg.senderUID === 'bot' ? 'KagenouBot' : (targetMsg.senderUID || 'User');
        }
      }
      await global.db.db("groupMessages").insertOne({
        groupId: req.params.id, id: userMsgId,
        role: "user", senderUID: session.uid,
        body: input.trim(), attachments: [], ts: Date.now(),
        replyTo: replyTo || null, replyToBody, replyToSender
      });
      if (replyTo) {
        const targetMsg = await global.db.db("groupMessages").findOne({ groupId: req.params.id, id: replyTo });
        const targetMsgId = targetMsg?.vmsgId || replyTo;

        const responseBuffer = [];
        const vApi = createVirtualApi(session.uid, responseBuffer);
        const origSend = vApi.sendMessage.bind(vApi);
        vApi.sendMessage = async (data, threadID, arg3, arg4) => {
          const result = await origSend(data, groupThreadId, arg3, arg4);
          return result;
        };

        const handled = await handleGuestReply(session.uid, targetMsgId, input.trim(), responseBuffer, vApi);

        if (handled) {
          for (const r of responseBuffer) {
            if (r.body?.trim() || r.attachments?.length) {
              const botMsgVmsgId = "vmsg_" + Date.now() + "_" + Math.random().toString(36).slice(2,6);
              await global.db.db("groupMessages").insertOne({
                groupId: req.params.id, id: newId(), vmsgId: botMsgVmsgId,
                role: "bot", senderUID: "bot",
                body: r.body || "", attachments: r.attachments || [], ts: Date.now()
              });
            }
          }
          return res.json({ ok: true });
        }
      }

      const responseBuffer = [];
      const vApi = createVirtualApi(session.uid, responseBuffer);
      const origSend = vApi.sendMessage.bind(vApi);
      vApi.sendMessage = async (data, threadID, arg3, arg4) => {
        const result = await origSend(data, groupThreadId, arg3, arg4);
        return result;
      };

        const prefix = global.config?.Prefix?.[0] || "/";
        const trimmed = input.trim();
        let command = null;
        let body = trimmed;
        let cmdName = "";
        let args = [];
        
        if (trimmed.startsWith(prefix)) {
          const parts = trimmed.slice(prefix.length).trim().split(/\s+/);
          cmdName = parts[0]?.toLowerCase() || "";
          args = parts.slice(1);
          command = global.commands?.get(cmdName);
          if (!command) {
            await global.db.db("groupMessages").insertOne({
              groupId: req.params.id, id: newId(), vmsgId: "vmsg_nf_" + Date.now(),
              role: "bot", senderUID: "bot",
              body: `Command "${cmdName}" not found. Use ${prefix}help.`,
              attachments: [], ts: Date.now()
            });
            return res.json({ ok: true });
          }
        } else {
          const firstWord = trimmed.toLowerCase().split(/\s+/)[0] || "";
          const exactCmd = global.nonPrefixCommands?.get(firstWord);
          if (exactCmd && (exactCmd.config?.nonPrefix === true || exactCmd.nonPrefix === true)) {
            command = exactCmd;
            cmdName = firstWord;
            args = trimmed.split(/\s+/).slice(1);
          } else {
            let found = false;
            for (const [name, cmd] of global.nonPrefixCommands || []) {
              if ((cmd.config?.nonPrefix === true || cmd.nonPrefix === true) && 
                  trimmed.toLowerCase().startsWith(name.toLowerCase())) {
                command = cmd;
                cmdName = name;
                const remaining = trimmed.slice(name.length).trim();
                args = remaining ? remaining.split(/\s+/) : [];
                found = true;
                break;
              }
            }
            if (!found) {
              return res.json({ ok: true });
            }
          }
        }

      const userRole = getGuestUserRole(session.uid);
      const commandRole = command.config?.role ?? command.role ?? 0;
      if (userRole >= commandRole) {
        const fakeEvent = {
          type: "message", threadID: groupThreadId,
          senderID: String(session.uid),
          messageID: userMsgId,
          body, attachments: [], timestamp: Date.now(),
          isGroup: true,
          messageReply: null,
        };
        try {
          if (command.execute) {
            const r = command.execute(vApi, fakeEvent, args, global.commands, prefix, global.config?.admins||[], global.appState, null, global.usersData, global.globalData);
            if (r?.then) await r;
          } else if (command.run) {
            const r = command.run({ api: vApi, event: fakeEvent, args, attachments: [], usersData: global.usersData, globalData: global.globalData, admins: global.config?.admins||[], prefix, db: global.db, commands: global.commands });
            if (r?.then) await r;
          }
        } catch(err) {
          responseBuffer.push({ type:"message", body:"Command error: "+err.message, attachments:[], timestamp:Date.now(), messageID:"vmsg_err_"+Date.now() });
        }
      } else {
        responseBuffer.push({ type:"message", body:`Permission denied. Requires role ${commandRole}.`, attachments:[], timestamp:Date.now(), messageID:"vmsg_perm_"+Date.now() });
      }
      for (const r of responseBuffer) {
        if (r.body?.trim() || r.attachments?.length) {
          const botMsgVmsgId = r.messageID || ("vmsg_" + Date.now() + "_" + Math.random().toString(36).slice(2,6));
          await global.db.db("groupMessages").insertOne({
            groupId: req.params.id, id: newId(), vmsgId: botMsgVmsgId,
            role: "bot", senderUID: "bot",
            body: r.body || "", attachments: r.attachments || [], ts: Date.now()
          });
        }
      }
      return res.json({ ok: true });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  

  app.post("/group/:id/react", async (req, res) => {
    const session = guestAuth(req, res); if (!session) return;
    if (!dbRequired(res)) return;
    const { msgId, reaction } = req.body || {};
    if (!msgId || !reaction) return res.status(400).json({ ok: false, error: "msgId and reaction required." });
    const VALID = ["❤️","😂","😮","😢","😡","👍"];
    if (!VALID.includes(reaction)) return res.status(400).json({ ok: false, error: "Invalid reaction." });
    try {
      const group = await global.db.db("groups").findOne({ id: req.params.id });
      if (!group) return res.status(404).json({ ok: false, error: "Group not found." });
      if (!group.members.includes(session.uid)) return res.status(403).json({ ok: false, error: "Not a member." });
      const msg = await global.db.db("groupMessages").findOne({ id: msgId, groupId: req.params.id });
      if (!msg) return res.status(404).json({ ok: false, error: "Message not found." });
      const reactions = msg.reactions || {};
      if (reactions[session.uid] === reaction) { delete reactions[session.uid]; }
      else { reactions[session.uid] = reaction; }
      await global.db.db("groupMessages").updateOne({ id: msgId }, { $set: { reactions } });
      return res.json({ ok: true, reactions });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post("/group/:id/media", async (req, res) => {
    const session = guestAuth(req, res); if (!session) return;
    if (!dbRequired(res)) return;
    const { mediaData, mediaType, mime } = req.body || {};
    if (!mediaData) return res.status(400).json({ ok: false, error: "mediaData required." });
    if (Buffer.byteLength(mediaData, 'base64') > 10 * 1024 * 1024)
      return res.status(413).json({ ok: false, error: "File too large. Max 10MB." });
    try {
      const group = await global.db.db("groups").findOne({ id: req.params.id });
      if (!group) return res.status(404).json({ ok: false, error: "Group not found." });
      if (!group.members.includes(session.uid)) return res.status(403).json({ ok: false, error: "Not a member." });
      const finalMime = mime || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
      const dataUrl = `data:${finalMime};base64,${mediaData}`;
      await global.db.db("groupMessages").insertOne({
        groupId: req.params.id, id: newId(), vmsgId: "vmsg_media_"+Date.now(),
        role: "user", senderUID: session.uid, body: "",
        attachments: [{ kind: "media", mime: finalMime, dataUrl }],
        ts: Date.now()
      });
      return res.json({ ok: true });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post("/group/:id/members", async (req, res) => {
    const session = guestAuth(req, res); if (!session) return;
    if (!dbRequired(res)) return;
    const { uid } = req.body || {};
    if (!uid) return res.status(400).json({ ok: false, error: "uid required." });
    try {
      const group = await global.db.db("groups").findOne({ id: req.params.id });
      if (!group) return res.status(404).json({ ok: false, error: "Group not found." });
      if (group.ownerUID !== session.uid) return res.status(403).json({ ok: false, error: "Only owner can add members." });
      const target = await global.db.db("guestUsers").findOne({ uid: String(uid) });
      if (!target) return res.status(404).json({ ok: false, error: "UID not registered." });
      if (group.members.includes(String(uid))) return res.status(409).json({ ok: false, error: "Already a member." });
      await global.db.db("groups").updateOne({ id: req.params.id }, { $push: { members: String(uid) } });
      const p = await getProfile(String(uid));
      await global.db.db("groupMessages").insertOne({ groupId: req.params.id, id: newId(), role:"bot", senderUID:"bot", body:`${p.displayName} joined the group.`, attachments:[], ts:Date.now() });
      return res.json({ ok: true });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.delete("/group/:id", async (req, res) => {
    const session = guestAuth(req, res); if (!session) return;
    if (!dbRequired(res)) return;
    try {
      const group = await global.db.db("groups").findOne({ id: req.params.id });
      if (!group) return res.status(404).json({ ok: false, error: "Group not found." });
      if (group.ownerUID !== session.uid) return res.status(403).json({ ok: false, error: "Only owner can delete." });
      await global.db.db("groups").deleteOne({ id: req.params.id });
      await global.db.db("groupMessages").deleteMany({ groupId: req.params.id });
      return res.json({ ok: true });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get("/uid-lookup", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ ok: false, error: "Missing url param." });
  try {
    const https = require("https");
    const FormData = require("form-data");
    const axios = require("axios");
    const { URL: NodeURL } = require("url");

    const relaxedAgent = new https.Agent({ rejectUnauthorized: false });
    const input = url.trim();
    if (/^\d+$/.test(input)) {
      return res.json({ ok: true, uid: input, profile_url: `https://www.facebook.com/profile.php?id=${input}`, input });
    }
    const profileMatch = input.match(/profile\.php\?id=(\d+)/);
    if (profileMatch) {
      return res.json({ ok: true, uid: profileMatch[1], profile_url: `https://www.facebook.com/profile.php?id=${profileMatch[1]}`, input });
    }

    const fbUrl = /^https?:\/\//i.test(input)
      ? input
      : /^\d+$/.test(input)
        ? `https://www.facebook.com/profile.php?id=${input}`
        : `https://www.facebook.com/${input}`;
    let uid = null;
    try {
      const form1 = new FormData();
      form1.append("link", new NodeURL(fbUrl).href);
      const { data: d1 } = await axios.post("https://id.traodoisub.com/api.php", form1, { headers: form1.getHeaders(), timeout: 20000 });
      if (!d1.error && d1.id && !isNaN(String(d1.id))) uid = String(d1.id);
    } catch {}
    if (!uid) {
      try {
        const username = new NodeURL(fbUrl).pathname.replace(/\//g, "");
        const form2 = new FormData();
        form2.append("username", username);
        const USER_AGENTS = ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/58.0 Safari/537.3"];
        const { data: d2 } = await axios.post("https://api.findids.net/api/get-uid-from-username", form2, {
          headers: { "User-Agent": USER_AGENTS[0], ...form2.getHeaders() },
          timeout: 10000, httpsAgent: relaxedAgent,
        });
        if (d2.status === 200 && d2.data?.id && !isNaN(String(d2.data.id))) uid = String(d2.data.id);
      } catch {}
    }

    if (!uid) return res.status(502).json({ ok: false, error: "Both lookup methods failed.", details: "Could not resolve UID for this profile.", input });
    return res.json({ ok: true, uid, profile_url: `https://www.facebook.com/profile.php?id=${uid}`, input });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Server error.", details: err.message });
  }
});
  
  const PREMIUM_COLLECTION = "premiumUsers";
  const PREMIUM_REQUESTS   = "premiumRequests";
  const GCASH_NUMBER       = process.env.GCASH_NUMBER || global.config?.gcashNumber || "09129121191";
  const PREMIUM_PRICE_PHP  = 49;
  const PREMIUM_PRICE_USD  = 1.99;
  const PREMIUM_DAYS       = 30;

  async function isPremiumActive(uid) {
    if (!global.db) return false;
    const doc = await global.db.db(PREMIUM_COLLECTION).findOne({ uid: String(uid) });
    if (!doc || !doc.active) return false;
    if (doc.expiresAt && Date.now() > doc.expiresAt) {
      await global.db.db(PREMIUM_COLLECTION).updateOne({ uid: String(uid) }, { $set: { active: false } });
      return false;
    }
    return true;
  }

  async function activatePremium(uid, name) {
    const expiresAt = Date.now() + PREMIUM_DAYS * 24 * 60 * 60 * 1000;
    await global.db.db(PREMIUM_COLLECTION).updateOne(
      { uid: String(uid) },
      { $set: { uid: String(uid), name, active: true, activatedAt: Date.now(), expiresAt } },
      { upsert: true }
    );
    if (global.config && Array.isArray(global.config.moderators)) {
      if (!global.config.moderators.includes(String(uid))) {
        global.config.moderators.push(String(uid));
        const cfgPath = require("path").join(__dirname, "../config.json");
        const fs2 = require("fs-extra");
        if (fs2.existsSync(cfgPath)) {
          fs2.writeFileSync(cfgPath, JSON.stringify(global.config, null, 2));
        }
      }
    }
  }

  async function deactivatePremium(uid) {
    await global.db.db(PREMIUM_COLLECTION).updateOne({ uid: String(uid) }, { $set: { active: false } });
    if (global.config && Array.isArray(global.config.moderators)) {
      global.config.moderators = global.config.moderators.filter(m => String(m) !== String(uid));
      const cfgPath = require("path").join(__dirname, "../config.json");
      const fs2 = require("fs-extra");
      if (fs2.existsSync(cfgPath)) {
        fs2.writeFileSync(cfgPath, JSON.stringify(global.config, null, 2));
      }
    }
  }

  app.get("/premium/info", (req, res) => {
    return res.json({
      ok: true,
      price: { php: PREMIUM_PRICE_PHP, usd: PREMIUM_PRICE_USD },
      days: PREMIUM_DAYS,
      gcash: GCASH_NUMBER,
      perks: ["Moderator role", "Access to premium commands", "Priority support"],
    });
  });

  app.get("/premium/status", async (req, res) => {
    const session = getGuestSession(req.headers["x-guest-token"]);
    if (!session) return res.status(401).json({ ok: false, error: "Not logged in." });
    if (!global.db) return res.json({ ok: true, active: false, premium: null });
    try {
      const doc = await global.db.db(PREMIUM_COLLECTION).findOne({ uid: session.uid });
      const active = await isPremiumActive(session.uid);
      return res.json({ ok: true, active, premium: doc || null });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post("/premium/submit", async (req, res) => {
    const session = getGuestSession(req.headers["x-guest-token"]);
    if (!session) return res.status(401).json({ ok: false, error: "Not logged in." });
    if (!global.db) return res.status(503).json({ ok: false, error: "Database not connected." });
    const { phone, email, name, uid, receiptImage } = req.body || {};
    if (!phone?.trim())        return res.status(400).json({ ok: false, error: "Phone number is required." });
    if (!email?.trim())        return res.status(400).json({ ok: false, error: "Email is required." });
    if (!name?.trim())         return res.status(400).json({ ok: false, error: "Name is required." });
    if (!uid?.trim())          return res.status(400).json({ ok: false, error: "Facebook UID is required." });
    if (!receiptImage)         return res.status(400).json({ ok: false, error: "Receipt screenshot is required." });
    if (!/^\d+$/.test(uid.trim())) return res.status(400).json({ ok: false, error: "UID must be numeric." });
    if (Buffer.byteLength(receiptImage.split(",")[1] || receiptImage, "base64") > 8 * 1024 * 1024)
      return res.status(413).json({ ok: false, error: "Receipt image too large. Max 8MB." });
    try {
      const existing = await global.db.db(PREMIUM_REQUESTS).findOne({ uid: uid.trim(), status: "pending" });
      if (existing) return res.status(409).json({ ok: false, error: "You already have a pending request." });
      const already = await isPremiumActive(uid.trim());
      if (already) return res.status(409).json({ ok: false, error: "This UID already has an active premium subscription." });
      const id = newId();
      await global.db.db(PREMIUM_REQUESTS).insertOne({
        id, uid: uid.trim(), name: name.trim(),
        phone: phone.trim(), email: email.trim(),
        receiptImage, status: "pending",
        submittedAt: Date.now(), submittedBy: session.uid,
      });
      global.log.info("[PREMIUM] New request submitted by UID " + uid.trim());
      return res.json({ ok: true, requestId: id });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get("/data/premium/requests", async (req, res) => {
    if (!checkAuth(req, res)) return;
    if (!global.db) return res.status(503).json({ ok: false, error: "Database not connected." });
    try {
      const status = req.query.status || "pending";
      const requests = await global.db.db(PREMIUM_REQUESTS).find(status === "all" ? {} : { status }).sort({ submittedAt: -1 }).limit(100).toArray();
      return res.json({ ok: true, requests });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post("/data/premium/approve/:id", async (req, res) => {
    if (!checkAuth(req, res)) return;
    if (!global.db) return res.status(503).json({ ok: false, error: "Database not connected." });
    try {
      const r = await global.db.db(PREMIUM_REQUESTS).findOne({ id: req.params.id });
      if (!r) return res.status(404).json({ ok: false, error: "Request not found." });
      if (r.status !== "pending") return res.status(409).json({ ok: false, error: "Request already processed." });
      await activatePremium(r.uid, r.name);
      await global.db.db(PREMIUM_REQUESTS).updateOne({ id: req.params.id }, { $set: { status: "approved", processedAt: Date.now() } });
      global.log.success("[PREMIUM] Approved UID " + r.uid);
      return res.json({ ok: true, uid: r.uid, name: r.name });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post("/data/premium/reject/:id", async (req, res) => {
    if (!checkAuth(req, res)) return;
    if (!global.db) return res.status(503).json({ ok: false, error: "Database not connected." });
    try {
      const r = await global.db.db(PREMIUM_REQUESTS).findOne({ id: req.params.id });
      if (!r) return res.status(404).json({ ok: false, error: "Request not found." });
      await global.db.db(PREMIUM_REQUESTS).updateOne({ id: req.params.id }, { $set: { status: "rejected", processedAt: Date.now() } });
      global.log.info("[PREMIUM] Rejected request from UID " + r.uid);
      return res.json({ ok: true });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post("/data/premium/revoke/:uid", async (req, res) => {
    if (!checkAuth(req, res)) return;
    if (!global.db) return res.status(503).json({ ok: false, error: "Database not connected." });
    try {
      await deactivatePremium(req.params.uid);
      global.log.info("[PREMIUM] Revoked premium for UID " + req.params.uid);
      return res.json({ ok: true });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get("/data/premium/subscribers", async (req, res) => {
    if (!checkAuth(req, res)) return;
    if (!global.db) return res.status(503).json({ ok: false, error: "Database not connected." });
    try {
      const subs = await global.db.db(PREMIUM_COLLECTION).find({}).sort({ activatedAt: -1 }).toArray();
      return res.json({ ok: true, subscribers: subs });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  });

  setInterval(async () => {
    if (!global.db) return;
    try {
      const expired = await global.db.db(PREMIUM_COLLECTION).find({ active: true, expiresAt: { $lt: Date.now() } }).toArray();
      for (const doc of expired) {
        await deactivatePremium(doc.uid);
        global.log.info("[PREMIUM] Auto-expired UID " + doc.uid);
      }
    } catch (e) { global.log.error("[PREMIUM] Expiry check failed: " + e.message); }
  }, 1000 * 60 * 60);

  app.get("/transaction", (req, res) => res.sendFile(require("path").join(__dirname, "index.html")));
  app.use(express.json({ limit: "20mb" }));
  global.log.success("[GUEST] Guest mode mounted at /guest");
  global.log.success("[PREMIUM] Premium subscription system mounted.");
};
