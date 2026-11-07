import axios from "axios";
import fs from "fs";
import path from "path";
import AuroraBetaStyler from "@aurora/styler";

const API_URL = "https://waifu-api-031n.onrender.com/images";
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_ATTEMPTS = 3;

const style = (headerText: string, headerSymbol: string, bodyText: string) =>
  AuroraBetaStyler.styleOutput({
    headerText,
    headerSymbol,
    headerStyle: "bold",
    bodyText,
    bodyStyle: "bold",
    footerText: "Developed by: **Aljur pogoy**",
  });

const fetchImage = async (nsfw: boolean) => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const response = await axios.get(API_URL, {
      params: {
        IncludedTags: "waifu",
        IsNsfw: nsfw ? "True" : "False",
        PageSize: 1,
      },
      timeout: 30000,
    });

    const item = response.data?.items?.[0];
    if (!item?.url) continue;
    if (Boolean(item.isNsfw) !== nsfw) continue;
    if (item.byteSize && item.byteSize > MAX_BYTES) continue;

    return item;
  }

  return null;
};

const waifuCommand: ShadowBot.Command = {
  config: {
    name: "waifu",
    description: "Sends a random waifu image. Use '18' for 18+ images.",
    usage: "/waifu [18]",
    aliases: ["anime", "girl"],
    category: "Fun 🎉",
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const nsfw = ["18", "18+"].includes((args[0] || "").toLowerCase());
    let filePath = "";

    try {
      const item = await fetchImage(nsfw);

      if (!item) {
        return api.sendMessage(
          style("Waifu", "⚠️", "Couldn't find a suitable image. Please try again."),
          threadID,
          messageID
        );
      }

      const ext = /^\.[a-z0-9]{2,5}$/i.test(item.extension || "") ? item.extension : ".jpg";
      filePath = path.join(process.cwd(), `waifu_${Date.now()}${ext}`);

      const imageResponse = await axios.get(item.url, {
        responseType: "arraybuffer",
        timeout: 60000,
      });

      fs.writeFileSync(filePath, Buffer.from(imageResponse.data));

      await api.sendMessage(
        {
          body: style(
            nsfw ? "Waifu 18+" : "Waifu",
            nsfw ? "🔞" : "🌸",
            nsfw ? "Here's your 18+ waifu!" : "Here's your waifu! 💕"
          ),
          attachment: fs.createReadStream(filePath),
        },
        threadID,
        messageID
      );
    } catch (err: any) {
      const rateLimited = err?.response?.status === 429;

      await api.sendMessage(
        style(
          "Waifu",
          "⚠️",
          rateLimited
            ? "Too many requests. Please try again in a few seconds."
            : `Failed to fetch waifu image.\n${err.message}`
        ),
        threadID,
        messageID
      );
    } finally {
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {}
      }
    }
  },
};

export default waifuCommand;
    
