
import AuroraBetaStyler from "@aurora/styler";

interface MLBBPlayer {
  player_id: number;
  server_id: number;
  nickname: string;
  level: number;
  rank: string;
  collection?: {
    heroes?: number;
    skins?: number;
  };
  combat?: {
    total_matches?: number;
    win_rate?: number;
  };
  favorite_heroes?: any;
  recent_battles?: any[];
}

interface MLBBResponse {
  success: boolean;
  data?: MLBBPlayer;
  error?: string;
  elapsed?: number;
}

const API_URL = "https://api.jebray.com/tools/check";

function styled(header: string, symbol: string, body: string): string {
  return AuroraBetaStyler.styleOutput({
    headerText: header,
    headerSymbol: symbol,
    headerStyle: "bold",
    bodyText: body,
    bodyStyle: "sansSerif",
    footerText: "Developed by: Aljur Pogoy",
  });
}

function fmt(value: any): string {
  return Number(value || 0).toLocaleString("en-US");
}

function getAPIKey(): string {
  return process.env.MLBB_API_KEY || "";
}

async function checkPlayer(
  playerID: number,
  zoneID?: number
): Promise<MLBBResponse> {
  const apiKey = getAPIKey();

  if (!apiKey) {
    throw new Error("MLBB API key is not configured.");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      player_id: playerID,
      ...(zoneID ? { zone_id: zoneID } : {}),
    }),
    signal: AbortSignal.timeout(30000),
  });

  const result = await response.json() as MLBBResponse;

  if (!response.ok || !result.success) {
    throw new Error(
      result.error || `API request failed with status ${response.status}.`
    );
  }

  return result;
}

function formatPlayer(player: MLBBPlayer, elapsed?: number): string {
  const collection = player.collection || {};
  const combat = player.combat || {};

  return [
    `👤 Nickname: ${player.nickname || "Unknown"}`,
    `🆔 Player ID: ${player.player_id}`,
    `🌐 Server ID: ${player.server_id}`,
    "",
    "PLAYER INFORMATION",
    `⭐ Level: ${fmt(player.level)}`,
    `🏆 Rank: ${player.rank || "Unknown"}`,
    "",
    "COLLECTION",
    `🦸 Heroes: ${fmt(collection.heroes)}`,
    `🎭 Skins: ${fmt(collection.skins)}`,
    "",
    "BATTLE STATISTICS",
    `⚔️ Total Matches: ${fmt(combat.total_matches)}`,
    `📊 Win Rate: ${fmt(combat.win_rate)}%`,
    "",
    `⚡ Response Time: ${elapsed ?? "N/A"}s`,
  ].join("\n");
}

const USAGE = "mlbb <player_id> [zone_id]";

const mlbbCommand = {
  name: "mlbb",
  aliases: ["mlbbcheck", "mlbbinfo"],
  description: "Check Mobile Legends player information using Player ID.",
  usage: USAGE,

  config: {
    name: "mlbb",
    author: "Aljur Pogoy",
    aliases: ["mlbbcheck", "mlbbinfo"],
    description: "Check Mobile Legends player information using Player ID.",
    usage: USAGE,
    version: "1.0.0",
    category: "Games 🎮",
  },

  async run(ctx: any) {
    const { api, event, args } = ctx;
    const { threadID, messageID } = event;

    const playerID = Number(args?.[0]);
    const zoneID = args?.[1] ? Number(args[1]) : undefined;

    if (!args?.[0]) {
      await api.sendMessage(
        styled(
          "MLBB Player Checker",
          "🎮",
          `Check a Mobile Legends player using their ID.\n\nUsage:\n${USAGE}\n\nExamples:\n/mlbb 58773882\n/mlbb 58773882 2207\n\nPlayer ID is required.\nZone ID is optional.`
        ),
        threadID,
        messageID
      );
      return;
    }

    if (
      !Number.isSafeInteger(playerID) ||
      playerID <= 0 ||
      (zoneID !== undefined &&
        (!Number.isSafeInteger(zoneID) || zoneID <= 0))
    ) {
      await api.sendMessage(
        styled(
          "MLBB Player Checker",
          "⚠️",
          "Invalid Player ID or Zone ID.\n\nBoth IDs must be positive integers."
        ),
        threadID,
        messageID
      );
      return;
    }

    try {
      const result = await checkPlayer(playerID, zoneID);
      const player = result.data;

      if (!player) {
        throw new Error("Player information was not returned.");
      }

      await api.sendMessage(
        styled(
          "MLBB Player Information",
          "🎮",
          formatPlayer(player, result.elapsed)
        ),
        threadID,
        messageID
      );
    } catch (error: any) {
      const message = error?.message || "An unexpected error occurred.";

      await api.sendMessage(
        styled(
          "MLBB Player Checker",
          "❌",
          `Unable to retrieve player information.\n\nReason: ${message}\n\nPlease check the Player ID, Zone ID, and API subscription.`
        ),
        threadID,
        messageID
      );
    }
  },
};

module.exports = mlbbCommand;
module.exports.default = mlbbCommand;
