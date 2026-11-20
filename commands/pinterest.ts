import axios from "axios";
import AuroraBetaStyler from "@aurora/styler";

const MAX_RESULTS = 5;

const style = (headerText: string, headerSymbol: string, bodyText: string) =>
  AuroraBetaStyler.styleOutput({
    headerText,
    headerSymbol,
    headerStyle: "bold",
    bodyText,
    bodyStyle: "bold",
    footerText: "Developed by: **Aljur pogoy**",
  });

const extractUrls = (payload: any): string[] => {
  const list = Array.isArray(payload?.data) ? payload.data : [];
  return list
    .map((item: any) => (typeof item === "string" ? item : item?.url))
    .filter((url: any) => typeof url === "string" && /^https?:\/\//i.test(url));
};

const pinterestCommand: ShadowBot.Command = {
  config: {
    name: "pinterest",
    author: "Aljur pogoy | Moderators",
    description: "Search for Pinterest images (max 5 results).",
    usage: "pinterest <query> <max_results>",
    category: "Fun 🎉",
    role: 0,
    nonPrefix: false,
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;

    const send = (header: string, symbol: string, body: string) =>
      api.sendMessage(style(header, symbol, body), threadID, messageID);

    const maxResults = Number(args[args.length - 1]);

    if (args.length < 2 || !Number.isInteger(maxResults) || maxResults < 1 || maxResults > MAX_RESULTS) {
      return send(
        "Pinterest",
        "❌",
        `Usage: pinterest <query> <max_results> (1-${MAX_RESULTS})\nExample: /pinterest anime wallpaper 3`
      );
    }

    const query = args.slice(0, -1).join(" ");

    try {
      const response = await axios.get("https://www.zyckee.org/pinterest", {
        params: { search: query, count: maxResults },
        timeout: 30000,
      });

      const urls = extractUrls(response.data).slice(0, maxResults);

      if (urls.length === 0) {
        return send("Pinterest", "❌", `No images found for "${query}".`);
      }

      const streams = (
        await Promise.all(
          urls.map((url) =>
            axios
              .get(url, { responseType: "stream", timeout: 30000 })
              .then((res) => res.data)
              .catch((err) => {
                console.error(`Failed to fetch image ${url}: ${err.message}`);
                return null;
              })
          )
        )
      ).filter(Boolean);

      if (streams.length === 0) {
        return send("Pinterest", "❌", "Failed to download the images. Please try again.");
      }

      await api.sendMessage(
        {
          body: style(
            "Pinterest",
            "📌",
            `Search results for "${query}" (${streams.length} image${streams.length > 1 ? "s" : ""})`
          ),
          attachment: streams,
        },
        threadID,
        messageID
      );
    } catch (error: any) {
      console.error("Error in pinterest command:", error);
      return send("Pinterest", "❌", `An error occurred: ${error.message || "Unknown error"}`);
    }
  },
};

export default pinterestCommand;

