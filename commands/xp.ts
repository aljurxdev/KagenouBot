import { createCanvas, loadImage, registerFont } from "canvas";
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

const xpCommand: ShadowBot.Command = {
  config: {
    name: "xp",
    author: "Aljur Pogoy",
    aliases: ["level", "profile"],
    description: "Check your XP and level with a profile card",
    cooldown: 5,
    role: 0,
  },

  run: async (context: ShadowBot.CommandContext) => {
    const { api, event, db, usersData } = context;
    const { senderID, threadID, messageID } = event;

    try {
      let user = usersData.get(senderID) || {
        balance: 0,
        bank: 0,
        xp: 0,
        level: 0,
      };

      user.xp = await global.getXP(senderID);
      user.level = await global.getLevel(senderID);
      usersData.set(senderID, user);

      if (db) {
        const usersCollection = db.db("users");
        await usersCollection.updateOne(
          { userId: senderID },
          { $set: { userId: senderID, data: user } },
          { upsert: true }
        );
      }

      const userInfo = await api.getUserInfo([senderID]);
      const userName = userInfo[senderID]?.name || "Unknown";

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

      ctx.font = "bold 32px Poppins";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`Level: ${user.level}`, 260, 140);

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
        bodyText: "Here is your XP & level progress.\n XP profile updated to version 12.1.5.",
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
