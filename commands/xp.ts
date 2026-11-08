import { createCanvas, loadImage, registerFont, CanvasRenderingContext2D } from "canvas";
import fs from "fs";
import path from "path";
import axios from "axios";
import AuroraBetaStyler from "@aurora/styler";

registerFont(path.join(__dirname, "cache", "Poppins-Regular.ttf"), {
  family: "Poppins",
  weight: "normal",
});

registerFont(path.join(__dirname, "cache", "Poppins-Bold.ttf"), {
  family: "Poppins",
  weight: "bold",
});

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

const getRank = async (db: any, userId: string, xp: number) => {
  if (!db) return null;
  try {
    const docs = await db.db("users").find({}).toArray();
    const entries = docs
      .map((d: any) => ({ userId: String(d.userId), xp: Number(d.data?.xp) || 0 }))
      .filter((e: any) => e.userId !== userId);
    entries.push({ userId, xp });
    const ranked = entries
      .filter((e: any) => e.xp > 0 || e.userId === userId)
      .sort((a: any, b: any) => b.xp - a.xp);
    return {
      rank: ranked.findIndex((e: any) => e.userId === userId) + 1,
      total: ranked.length,
    };
  } catch {
    return null;
  }
};

const xpCommand: ShadowBot.Command = {
  config: {
    name: "xp",
    author: "Aljur Pogoy",
    aliases: ["level", "profile"],
    description: "Check your XP and level with a profile card. Mention someone to see theirs.",
    cooldown: 5,
    role: 0,
  },

  run: async (context: ShadowBot.CommandContext) => {
    const { api, event, db, usersData } = context;
    const { senderID, threadID, messageID } = event;

    try {
      const mentionedID = Object.keys((event as any).mentions || {})[0];
      const targetID = mentionedID || senderID;
      const isSelf = String(targetID) === String(senderID);

      let user = usersData.get(targetID) || {
        balance: 0,
        bank: 0,
        xp: 0,
        level: 0,
      };

      user.xp = await global.getXP(targetID);
      user.level = await global.getLevel(targetID);

      if (isSelf) {
        usersData.set(senderID, user);

        if (db) {
          const usersCollection = db.db("users");
          await usersCollection.updateOne(
            { userId: senderID },
            { $set: { userId: senderID, data: user } },
            { upsert: true }
          );
        }
      }

      const userInfo = await api.getUserInfo([targetID]);
      const userName = userInfo[targetID]?.name || "Unknown";

      const rankInfo = await getRank(db, String(targetID), user.xp);
      const role = getRoleBadge(String(targetID));

      const width = 800;
      const height = 300;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      const cacheDir = path.join(__dirname, "cache");
      const bgFiles = fs
        .readdirSync(cacheDir)
        .filter(f => /\.(png|jpg|jpeg)$/i.test(f));

      if (!bgFiles.length) throw new Error("No background images found!");

      const bg = await loadImage(
        path.join(cacheDir, bgFiles[Math.floor(Math.random() * bgFiles.length)])
      );

      const scale = Math.max(width / bg.width, height / bg.height);
      const x = (width - bg.width * scale) / 2;
      const y = (height - bg.height * scale) / 2;
      ctx.drawImage(bg, x, y, bg.width * scale, bg.height * scale);

      const avatarURL = "https://files.catbox.moe/gy3qy6.jpg";
      const avatarRes = await axios.get(avatarURL, { responseType: "arraybuffer" });
      const avatar = await loadImage(Buffer.from(avatarRes.data));

      const avatarSize = 180;
      const avatarX = 120;
      const avatarY = height / 2;
      const glowColor = `hsl(${Math.random() * 360},100%,60%)`;

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarSize / 2 + 10, 0, Math.PI * 2);
      ctx.shadowBlur = 30;
      ctx.shadowColor = glowColor;
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        avatar,
        avatarX - avatarSize / 2,
        avatarY - avatarSize / 2,
        avatarSize,
        avatarSize
      );
      ctx.restore();

      ctx.font = "bold 24px Poppins";
      ctx.fillStyle = glowColor;
      ctx.fillText(userName, 260, 100);

      ctx.font = "bold 16px Poppins";
      const badgeWidth = ctx.measureText(role.label).width + 28;
      const badgeX = 770 - badgeWidth;
      ctx.fillStyle = role.color;
      roundedRect(ctx, badgeX, 78, badgeWidth, 26, 13);
      ctx.fill();
      ctx.fillStyle = "#111111";
      ctx.textBaseline = "middle";
      ctx.fillText(role.label, badgeX + 14, 91);
      ctx.textBaseline = "alphabetic";

      ctx.font = "bold 32px Poppins";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`Level: ${user.level}`, 260, 140);

      if (rankInfo) {
        ctx.font = "bold 22px Poppins";
        ctx.fillStyle = glowColor;
        ctx.textAlign = "right";
        ctx.fillText(`Rank #${rankInfo.rank} / ${rankInfo.total}`, 770, 140);
        ctx.textAlign = "left";
      }

      ctx.font = "22px Poppins";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`XP: ${user.xp}`, 260, 175);

      const progress = user.xp % 100;
      const barX = 260;
      const barY = 195;
      const barWidth = 420;
      const barHeight = 28;

      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(barX, barY, barWidth, barHeight);

      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(
        barX,
        barY,
        Math.max(10, (progress / 100) * barWidth),
        barHeight
      );

      ctx.strokeStyle = "#ffffff";
      ctx.strokeRect(barX, barY, barWidth, barHeight);

      ctx.font = "18px Poppins";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(
        `${progress} / 100 XP`,
        barX + barWidth / 2,
        barY + barHeight / 2
      );
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      const filePath = path.join(process.cwd(), `xp_${senderID}.png`);
      fs.writeFileSync(filePath, canvas.toBuffer("image/png"));

      const styledMessage = AuroraBetaStyler.styleOutput({
        headerText: "🎮 XP Profile",
        headerSymbol: "⭐",
        headerStyle: "bold",
        bodyText: isSelf
          ? "Here is your XP & level progress.\n XP profile updated to version 12.1.5."
          : `Here is ${userName}'s XP & level progress.\n XP profile updated to version 12.1.5.`,
        footerText: "Keep chatting to gain XP!",
      });

      await api.sendMessage(
        {
          body: styledMessage,
          attachment: fs.createReadStream(filePath),
        },
        threadID,
        messageID
      );

      fs.unlinkSync(filePath);

    } catch (err: any) {
      api.sendMessage(
        `⚠️ XP Error: ${err.message}`,
        threadID,
        messageID
      );
    }
  },
};

export default xpCommand;
