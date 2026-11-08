import { createCanvas, loadImage, registerFont, Image, CanvasRenderingContext2D } from "canvas";
import fs from "fs";
import path from "path";
import AuroraBetaStyler from "@aurora/styler";

const cacheDir = path.join(__dirname, "cache");
const FONT = "Poppins, sans-serif";

for (const [file, weight] of [
  ["Poppins-Regular.ttf", "normal"],
  ["Poppins-Bold.ttf", "bold"],
] as const) {
  try {
    registerFont(path.join(cacheDir, file), { family: "Poppins", weight });
  } catch {}
}

const backgroundFiles: string[] = (() => {
  try {
    return fs.readdirSync(cacheDir).filter((f) => /\.(png|jpg|jpeg)$/i.test(f));
  } catch {
    return [];
  }
})();

const backgroundCache = new Map<string, Image>();

const getBackground = async (): Promise<Image> => {
  if (!backgroundFiles.length) throw new Error("No background images found!");
  const file = backgroundFiles[Math.floor(Math.random() * backgroundFiles.length)];
  let img = backgroundCache.get(file);
  if (!img) {
    img = await loadImage(path.join(cacheDir, file));
    backgroundCache.set(file, img);
  }
  return img;
};

const drawDefaultAvatar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => {
  const r = size / 2;
  const gradient = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  gradient.addColorStop(0, "#4b5563");
  gradient.addColorStop(1, "#1f2937");
  ctx.fillStyle = gradient;
  ctx.fillRect(cx - r, cy - r, size, size);

  ctx.fillStyle = "#d1d5db";
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.2, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.85, r * 0.62, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
};

const xpNeeded = (_level: number) => 100;

const levelStartXP = (level: number) => {
  let total = 0;
  for (let l = 0; l < level; l++) total += xpNeeded(l);
  return total;
};

const configList = (key: string): string[] =>
  (((global as any).config && (global as any).config[key]) || []).map(String);

const getRoleBadge = (uid: string) => {
  uid = String(uid);
  if (configList("developers").includes(uid)) return { label: "Developer", color: "#facc15" };
  if (configList("admins").includes(uid)) return { label: "Admin", color: "#ef4444" };
  if (configList("moderators").includes(uid)) return { label: "Moderator", color: "#22c55e" };
  if (configList("vips").includes(uid)) return { label: "VIP", color: "#a855f7" };
  return { label: "Member", color: "#9ca3af" };
};

const style = (
  header: string,
  symbol: string,
  body: string,
  footer = "Developed by: **Aljur Pogoy**"
) =>
  AuroraBetaStyler.styleOutput({
    headerText: header,
    headerSymbol: symbol,
    headerStyle: "bold",
    bodyText: body,
    bodyStyle: "bold",
    footerText: footer,
  });

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const fitText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
};

type Entry = { userId: string; xp: number; level: number };

const loadEntries = async (db: any): Promise<Entry[]> => {
  const docs = await db.db("users").find({}).toArray();
  return docs.map((d: any) => ({
    userId: String(d.userId),
    xp: Number(d.data?.xp) || 0,
    level: Number(d.data?.level) || 0,
  }));
};

const getRank = async (db: any, userId: string, xp: number, level: number) => {
  if (!db) return null;
  try {
    const entries = (await loadEntries(db)).filter((e) => e.userId !== userId);
    entries.push({ userId, xp, level });
    const ranked = entries.filter((e) => e.xp > 0 || e.userId === userId).sort((a, b) => b.xp - a.xp);
    const index = ranked.findIndex((e) => e.userId === userId);
    return { rank: index + 1, total: ranked.length };
  } catch (err: any) {
    console.error(`XP rank error: ${err.message}`);
    return null;
  }
};

const sendTop = async (api: any, db: any, threadID: any, messageID: any) => {
  if (!db) {
    return api.sendMessage(
      style("XP Top", "⚠️", "Database not available. Ensure MongoDB is connected."),
      threadID,
      messageID
    );
  }

  const ranked = (await loadEntries(db))
    .filter((e) => e.xp > 0)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10);

  if (!ranked.length) {
    return api.sendMessage(style("XP Top", "📋", "No XP data yet."), threadID, messageID);
  }

  let names: Record<string, any> = {};
  try {
    names = await api.getUserInfo(ranked.map((e) => e.userId));
  } catch {}

  const medals = ["🥇", "🥈", "🥉"];
  const lines = ranked.map(
    (e, i) =>
      `${medals[i] || `${i + 1}.`} ${names[e.userId]?.name || `User ${e.userId}`}\n    Level ${e.level} • ${e.xp} XP`
  );

  return api.sendMessage(
    style("XP Top 10", "🏆", lines.join("\n\n"), "Keep chatting to gain XP!"),
    threadID,
    messageID
  );
};

const xpCommand: ShadowBot.Command = {
  config: {
    name: "xp",
    author: "Aljur Pogoy",
    aliases: ["level", "profile"],
    description: "Check your XP and level with a profile card. Mention someone to see theirs, or use 'top' for the leaderboard.",
    usage: "/xp [@user | top]",
    cooldown: 5,
    role: 0,
  },

  run: async (context: ShadowBot.CommandContext) => {
    const { api, event, args, db, usersData } = context;
    const { senderID, threadID, messageID } = event;
    const filePath = path.join(process.cwd(), `xp_${senderID}_${Date.now()}.png`);

    try {
      if ((args?.[0] || "").toLowerCase() === "top") {
        return await sendTop(api, db, threadID, messageID);
      }

      const mentionedID = Object.keys((event as any).mentions || {})[0];
      const targetID = mentionedID || senderID;
      const isSelf = String(targetID) === String(senderID);

      const xp = Number(await global.getXP(targetID)) || 0;
      const level = Number(await global.getLevel(targetID)) || 0;

      if (isSelf) {
        try {
          const cached = usersData.get(senderID);
          if (cached) {
            cached.xp = xp;
            cached.level = level;
            usersData.set(senderID, cached);
          }

          if (db) {
            await db.db("users").updateOne(
              { userId: senderID },
              { $set: { userId: senderID, "data.xp": xp, "data.level": level } },
              { upsert: true }
            );
          }
        } catch (syncErr: any) {
          console.error(`XP sync error: ${syncErr.message}`);
        }
      }

      const userInfo = await api.getUserInfo([targetID]);
      const info: any = userInfo[targetID];
      const userName = info?.name || "Unknown";

      const [background, rankInfo] = await Promise.all([
        getBackground(),
        getRank(db, String(targetID), xp, level),
      ]);

      const role = getRoleBadge(String(targetID));
      const accent = role.label === "Member" ? `hsl(${(level * 47) % 360},100%,60%)` : role.color;

      const width = 800;
      const height = 300;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      const scale = Math.max(width / background.width, height / background.height);
      ctx.drawImage(
        background,
        (width - background.width * scale) / 2,
        (height - background.height * scale) / 2,
        background.width * scale,
        background.height * scale
      );

      ctx.fillStyle = "rgba(0,0,0,0.45)";
      roundedRect(ctx, 235, 35, 540, 230, 18);
      ctx.fill();

      const avatarSize = 180;
      const avatarX = 120;
      const avatarY = height / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarSize / 2 + 10, 0, Math.PI * 2);
      ctx.shadowBlur = 30;
      ctx.shadowColor = accent;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      drawDefaultAvatar(ctx, avatarX, avatarY, avatarSize);
      ctx.restore();

      ctx.font = `bold 26px ${FONT}`;
      ctx.fillStyle = accent;
      ctx.fillText(fitText(ctx, userName, 490), 260, 78);

      ctx.font = `bold 16px ${FONT}`;
      const badgeWidth = ctx.measureText(role.label).width + 28;
      ctx.fillStyle = role.color;
      roundedRect(ctx, 260, 92, badgeWidth, 26, 13);
      ctx.fill();
      ctx.fillStyle = "#111111";
      ctx.textBaseline = "middle";
      ctx.fillText(role.label, 274, 105);
      ctx.textBaseline = "alphabetic";

      ctx.font = `bold 32px ${FONT}`;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`Level: ${level}`, 260, 162);

      if (rankInfo) {
        ctx.font = `bold 22px ${FONT}`;
        ctx.fillStyle = accent;
        ctx.textAlign = "right";
        ctx.fillText(`Rank #${rankInfo.rank} / ${rankInfo.total}`, 755, 160);
        ctx.textAlign = "left";
      }

      const needed = xpNeeded(level);
      const progress = Math.min(needed, Math.max(0, xp - levelStartXP(level)));
      const remaining = Math.max(0, needed - progress);

      ctx.font = `20px ${FONT}`;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(
        fitText(ctx, `XP: ${xp}  •  ${remaining} XP to level ${level + 1}`, 490),
        260,
        196
      );

      const barX = 260;
      const barY = 210;
      const barWidth = 490;
      const barHeight = 28;
      const ratio = needed > 0 ? progress / needed : 1;

      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(barX, barY, barWidth, barHeight);

      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(barX, barY, ratio * barWidth, barHeight);

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, barY, barWidth, barHeight);

      ctx.font = `18px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`${progress} / ${needed} XP`, barX + barWidth / 2, barY + barHeight / 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      fs.writeFileSync(filePath, canvas.toBuffer("image/png"));

      await api.sendMessage(
        {
          body: style(
            "🎮 XP Profile",
            "⭐",
            isSelf ? "Here is your XP & level progress." : `Here is ${userName}'s XP & level progress.`,
            "Keep chatting to gain XP!"
          ),
          attachment: fs.createReadStream(filePath),
        },
        threadID,
        messageID
      );
    } catch (err: any) {
      await api.sendMessage(style("XP Error", "⚠️", err.message), threadID, messageID);
    } finally {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {}
      }
    }
  },
};

export default xpCommand;
