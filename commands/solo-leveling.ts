
import AuroraBetaStyler from "@aurora/styler";


interface HunterData {
  userID: string;
  name?: string;
  nameS2?: string;
  level: number;
  exp: number;
  expS2: number;
  rank: string;
  role?: string;
  equipment: { swords: { [key: string]: number } };
  inventory: { potions: { [key: string]: number }; materials: { [key: string]: number } };
  inventoryS2: { magicCrystals: number; holyCrystals: number; items: { [key: string]: number } };
  shadows: { name: string; nickname: string; level?: number }[];
  shadowsS2: { name: string; nickname: string; level?: number }[];
  stats: { strength: number; agility: number; mana: number };
  dungeonCooldown: number;
  dungeonCooldownS2: number;
  quests: { [key: string]: { goal: number; progress: number; reward: number; completed: boolean; description: string; timestamp?: number; target?: string } };
  guild?: string;
  guildS2?: string;
  meditateCooldown: number;
  warCooldownS2: number;
  lostShadows?: { name: string; nickname: string }[];
  lostShadowsS2?: { name: string; nickname: string }[];
  hasChangedName?: boolean;
  gateCooldown?: number;

  dailyCooldown?: number;
  lastLoginDate?: string;
  loginStreak?: number;
  titles?: string[];
  activeTitle?: string;
  duelCooldown?: number;
  battleWins?: number;
  dungeonClears?: number;
  ironDragonDefeated?: boolean;
  doubleDungeonUnlocked?: boolean;
  dailyMissions?: { [key: string]: { goal: number; progress: number; reward: number; completed: boolean; description: string } };
  dailyMissionsDate?: string;
}

interface GuildData {
  name: string;
  members: string[];
  totalStrength: number;
  hasChangedName?: boolean;
  isSeason2?: boolean;
}

const activeSurges = new Map<string, { expiresAt: number; claimedBy: string | null }>();

const activeRaids  = new Map<string, { initiatorID: string; participants: string[]; expiresAt: number }>();

const TITLE_DEFS: { id: string; label: string; how: string }[] = [
  { id: "iron_hunter",         label: "🪖 Iron Hunter",           how: "Reach D-rank" },
  { id: "dungeon_delver",      label: "🏰 Dungeon Delver",        how: "Clear 10 dungeons" },
  { id: "dragon_slayer",       label: "🐉 Dragon Slayer",         how: "Defeat Iron Dragon in bossfight" },
  { id: "shadow_sovereign",    label: "🌑 Shadow Sovereign",      how: "Reach S-rank" },
  { id: "shadow_monarch",      label: "👑 Shadow Monarch",        how: "Reach X-rank" },
  { id: "battle_hardened",     label: "⚔️ Battle-Hardened",      how: "Win 50 battles" },
  { id: "streak_legend",       label: "🔥 Streak Legend",         how: "Maintain a 7-day login streak" },
  { id: "double_dungeon_surv", label: "💀 Double Dungeon Survivor", how: "Survive the Double Dungeon" },
];

function checkAndGrantTitles(userData: HunterData): string[] {
  const newOnes: string[] = [];
  userData.titles = userData.titles || [];
  const has = (id: string) => userData.titles!.includes(id);
  const grant = (id: string) => { if (!has(id)) { userData.titles!.push(id); newOnes.push(id); } };
  const RANK_ORDER = ["E", "D", "C", "B", "A", "S", "X"];
  if (RANK_ORDER.indexOf(userData.rank) >= RANK_ORDER.indexOf("D")) grant("iron_hunter");
  if (RANK_ORDER.indexOf(userData.rank) >= RANK_ORDER.indexOf("S")) grant("shadow_sovereign");
  if (userData.rank === "X")                                         grant("shadow_monarch");
  if ((userData.dungeonClears  || 0) >= 10)                         grant("dungeon_delver");
  if ((userData.battleWins     || 0) >= 50)                         grant("battle_hardened");
  if ((userData.loginStreak    || 0) >= 7)                          grant("streak_legend");
  if (userData.ironDragonDefeated)                                   grant("dragon_slayer");
  if (userData.doubleDungeonUnlocked)                               grant("double_dungeon_surv");
  return newOnes;
}

const soloLevelingCommand: ShadowBot.Command = {
  config: {
    name: "solo-leveling",
    description: "Embark on a Solo Leveling adventure as a hunter! Season 2 included!",
    usage: "/solo-leveling register <name> | /sl status | /sl battle | /sl battle X | /sl shop | /sl buy <item> <quantity> | /sl use <potion> <quantity> | /sl dungeon <tier> | /sl train <stat> | /sl quest | /sl guild [create <name> | join <guild name> | leave | fight <guild name> | list | changename <new name>] | /sl leaderboard | /sl meditate | /sl shadowlist | /sl setrole <class> | /sl changename <newname> | /sl gate enter <class> | /sl s2 register | /sl s2 war | /sl s2 status | /sl s2 battle | /sl s2 shop | /sl s2 dungeon <class tier> | /sl s2 guild [create <name> | leave | list | war] | /sl s2 inventory",
    aliases: ["sl"],
    category: "Games 🎮",
  },
  run: async ({ api, event, args, db }) => {
    if (!db) {
      await api.sendMessage("Database not available.", event.threadID, event.messageID);
      return;
    }
    const { threadID, messageID, senderID } = event;
    const action = args[0]?.toLowerCase();
    const userData = await getHunterData(db, senderID.toString());
    const currentTime = Math.floor(Date.now() / 1000);
    const dungeonCooldown = 3600;
    const dungeonCooldownS2 = 3600;
    const meditateCooldown = 1800;
    const gateCooldown = 1800;
    const warCooldownS2 = 300;

    const s2Characters = [
      "Sung Jin-Woo", "Cha Hae-In", "Baek Yoonho", "Choi Jong-In", "Woo Jinchul",
      "Yoo Jinho", "Lee Joohee", "Park Heejin", "Kang Taeshik", "Kim Chul",
      "Go Gunhee", "Thomas Andre", "Liu Zhigang", "Goto Ryuji", "Hwang Dongsoo",
      "Lennart Niermann", "Selner", "Norma Selner", "Adam White", "Esil Radiru",
      "Beru", "Igris", "Tusk", "Baruka", "Kamish", "Ant King", "Monarch of Destruction",
      "Ashborn", "Ruler's Shadow", "Blood-Red Commander Igris", "Sung Il-Hwan",
      "Hwang Dongsuk", "Song Chi-Yul", "Kim Sangshik", "Han Song-Yi",
      "Yoo Soohyun", "Jung Yerim", "Park Beom-Shik", "Kim Cheol", "Lee Min-Sung",
      "Eunseok", "Woo Seok-Hyun", "Kang Jeongho", "Choi Minwoo", "Son Kihoon",
      "Tae Gyu", "Min Byung-Gyu", "Joo Jae-Hwan", "Lee Eun-Joo", "Park Jongsoo",
      "Ahn Sangmin", "Joo Hee", "Kim Dong-Wook", "Shin Hyung-Sik", "Lim Tae-Gyu",
      "Ma Dong-Wook", "Jung Yoontae", "Yoon Gijoong", "Kim Lakhyun", "Choi Yooshik"
    ].sort();

    if (action === "s2" && args[1]?.toLowerCase() === "register") {
      if (userData.nameS2) {
        const alreadyRegistered = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Season 2",
          headerSymbol: "🛑",
          headerStyle: "bold",
          bodyText: `You are already registered as ${userData.nameS2} in Season 2. Use /sl s2 status to check your stats.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(alreadyRegistered, threadID, messageID);
        return;
      }
      const characterList = s2Characters.map((char, i) => `${i + 1}. ${char}`).join("\n");
      const registerMessage = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Season 2 Registration",
        headerSymbol: "📋",
        headerStyle: "bold",
        bodyText: `Please choose a character by replying with the number:\n${characterList}`,
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      let sentMessageID: string;
      await new Promise((resolve) => {
        api.sendMessage(registerMessage, threadID, (err, info) => {
          if (err) resolve(err);
          else {
            sentMessageID = info.messageID;
            resolve(info);
          }
        }, messageID);
      });
      if (!global.Kagenou.replyListeners) global.Kagenou.replyListeners = new Map();
      const handleReply = async ({ api, event }) => {
        const currentMsgID = sentMessageID;
        const reply = parseInt(event.body.trim());
        if (isNaN(reply) || reply < 1 || reply > s2Characters.length) {
          let nextMsgID: string;
          await new Promise<void>((resolve) => {
            api.sendMessage(
              AuroraBetaStyler.styleOutput({
                headerText: "Solo Leveling Season 2",
                headerSymbol: "⚠️",
                headerStyle: "bold",
                bodyText: "Invalid character number. Please reply with a valid number.",
                bodyStyle: "bold",
                footerText: "Developed by: **Aljur pogoy**",
              }),
              threadID,
              (err: any, info: any) => { nextMsgID = info?.messageID; resolve(); },
              event.messageID
            );
          });
          global.Kagenou.replyListeners.set(nextMsgID, { callback: handleReply });
          global.Kagenou.replyListeners.delete(currentMsgID);
          sentMessageID = nextMsgID;
          return;
        }
        const selectedCharacter = s2Characters[reply - 1];
        const huntersCollection = db.db("hunters");
        const existingHunter = await huntersCollection.findOne({ nameS2: selectedCharacter });
        if (existingHunter) {
          let nextMsgID: string;
          await new Promise<void>((resolve) => {
            api.sendMessage(
              AuroraBetaStyler.styleOutput({
                headerText: "Solo Leveling Season 2",
                headerSymbol: "🛑",
                headerStyle: "bold",
                bodyText: `The character "${selectedCharacter}" is already taken. Please choose another.`,
                bodyStyle: "bold",
                footerText: "Developed by: **Aljur pogoy**",
              }),
              threadID,
              (err: any, info: any) => { nextMsgID = info?.messageID; resolve(); },
              event.messageID
            );
          });
          global.Kagenou.replyListeners.set(nextMsgID, { callback: handleReply });
          global.Kagenou.replyListeners.delete(currentMsgID);
          sentMessageID = nextMsgID;
          return;
        }
        userData.nameS2 = selectedCharacter;
        userData.expS2 = 0;
        userData.inventoryS2 = { magicCrystals: 0, holyCrystals: 0, items: {} };
        userData.shadowsS2 = [];
        userData.dungeonCooldownS2 = 0;
        userData.warCooldownS2 = 0;
        userData.lostShadowsS2 = [];
        await saveHunterData(db, senderID.toString(), userData);
        await api.sendMessage(
          AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Season 2",
            headerSymbol: "✅",
            headerStyle: "bold",
            bodyText: `Registered as ${selectedCharacter} in Season 2! Use /sl s2 status to check your stats.`,
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          }),
          threadID,
          event.messageID
        );
        global.Kagenou.replyListeners.delete(currentMsgID);
      };
      global.Kagenou.replyListeners.set(sentMessageID, { callback: handleReply });
      return;
    }

    if (action === "s2" && args[1]?.toLowerCase() === "war") {
      if (!userData.nameS2) {
        const notRegistered = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Season 2",
          headerSymbol: "⚠️",
          headerStyle: "bold",
          bodyText: "You need to register for Season 2 first. Usage: /sl s2 register",
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(notRegistered, threadID, messageID);
        return;
      }
      if (Math.max(0, Number(userData.warCooldownS2) || 0) > currentTime) {
        const remaining = Math.max(0, Number(userData.warCooldownS2) || 0) - currentTime;
        const cooldownMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Season 2 War",
          headerSymbol: "⏳",
          headerStyle: "bold",
          bodyText: `Cooldown active. Wait ${Math.ceil(remaining / 60)} minutes.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(cooldownMessage, threadID, messageID);
        return;
      }
      const magicCrystals = Math.floor(Math.random() * 5) + 1;
      const holyCrystals = Math.floor(Math.random() * 3) + 1;
      userData.inventoryS2.magicCrystals = Math.max(0, Number(userData.inventoryS2.magicCrystals) || 0) + magicCrystals;
      userData.inventoryS2.holyCrystals = Math.max(0, Number(userData.inventoryS2.holyCrystals) || 0) + holyCrystals;
      userData.warCooldownS2 = currentTime + warCooldownS2;
      await saveHunterData(db, senderID.toString(), userData);
      const warMessage = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Season 2 War",
        headerSymbol: "⚔️",
        headerStyle: "bold",
        bodyText: `You fought in a war! Gained ${magicCrystals} Magic Crystals and ${holyCrystals} Holy Crystals.`,
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(warMessage, threadID, messageID);
      return;
    }

    if (action === "s2" && args[1]?.toLowerCase() === "status") {
      if (!userData.nameS2) {
        const notRegistered = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Season 2",
          headerSymbol: "⚠️",
          headerStyle: "bold",
          bodyText: "You need to register for Season 2 first. Usage: /sl s2 register",
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(notRegistered, threadID, messageID);
        return;
      }
      const stats = userData.stats || { strength: 0, agility: 0, mana: 0 };
      const statusMessage = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Season 2 Status",
        headerSymbol: "📊",
        headerStyle: "bold",
        bodyText: `Name: ${userData.nameS2}\nLevel: ${Math.max(1, Number(userData.level) || 1)}\nEXP: ${Math.max(0, Number(userData.expS2) || 0)}\nRank: ${userData.rank || "E"}\nGuild: ${userData.guildS2 || "None"}\nShadows: ${userData.shadowsS2.length > 0 ? userData.shadowsS2.map(s => `${s.name} (${s.nickname})`).join(", ") : "None"}\nStats: Strength ${Math.max(0, Number(stats.strength) || 0)}, Agility ${Math.max(0, Number(stats.agility) || 0)}, Mana ${Math.max(0, Number(stats.mana) || 0)}\nMagic Crystals: ${Math.max(0, Number(userData.inventoryS2.magicCrystals) || 0)}\nHoly Crystals: ${Math.max(0, Number(userData.inventoryS2.holyCrystals) || 0)}`,
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(statusMessage, threadID, messageID);
      return;
    }

    if (action === "leaderboard") {
      const huntersCollection = db.db("hunters");
      const topHunters = await huntersCollection
        .find({})
        .sort({ exp: -1 })
        .limit(10)
        .toArray();
      const leaderboardMessage = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling S1 Leaderboard",
        headerSymbol: "🏆",
        headerStyle: "bold",
        bodyText: topHunters.length > 0
          ? topHunters.map((h, i) => `${i + 1}. ${h.name} (Level ${Math.max(1, Number(h.level) || 1)}, ${Math.max(0, Number(h.exp) || 0)} EXP, Rank ${h.rank || "E"})`).join("\n")
          : "No hunters ranked yet.",
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(leaderboardMessage, threadID, messageID);
      return;
    }

    if (action === "s2" && args[1]?.toLowerCase() === "battle") {
      if (!userData.nameS2) {
        const notRegistered = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Season 2",
          headerSymbol: "⚠️",
          headerStyle: "bold",
          bodyText: "You need to register for Season 2 first. Usage: /sl s2 register",
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(notRegistered, threadID, messageID);
        return;
      }
      const stats = userData.stats || { strength: 0, agility: 0, mana: 0 };
      const normalEnemies = [
        "Kang Taeshik", "Kim Chul", "Yoo Jinho", "Lee Joohee", "Park Heejin",
        "Cha Hae-In", "Baek Yoonho", "Choi Jong-In", "Maharaga", "Igris",
        "Beru", "Tusk", "Baruka", "Cerberus", "Blood-Red Commander Igris",
        "High Orc", "Ice Bear", "Frost Giant", "Flame Bear"
      ];
      const shadowMonarchs = ["Kamish", "Ant King", "Monarch of Destruction", "Ruler's Shadow", "Ashborn"];
      const allEnemies = userData.rank === "S" || userData.rank === "X" ? [...normalEnemies, ...shadowMonarchs] : normalEnemies;
      const enemy = allEnemies[Math.floor(Math.random() * allEnemies.length)];
      const isMonarch = shadowMonarchs.includes(enemy);
      const win = Math.random() < 0.7 || userData.rank === "X";
      let battleMessage;
      if (win) {
        stats.strength = Math.max(0, Number(stats.strength) || 0) + 100;
        stats.agility = Math.max(0, Number(stats.agility) || 0) + 100;
        stats.mana = Math.max(0, Number(stats.mana) || 0) + 100;
        userData.expS2 = Math.max(0, Number(userData.expS2) || 0) + 1000;
        const s1LvlWin = Math.max(1, Math.floor((Math.max(0, Number(userData.exp) || 0)) / 1000) + 1);
        const s2LvlWin = Math.max(1, Math.floor((Math.max(0, Number(userData.expS2) || 0)) / 1000) + 1);
        userData.level = Math.max(s1LvlWin, s2LvlWin);
        applyRankProgression(userData);
        battleMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Season 2 Battle",
          headerSymbol: "⚔️",
          headerStyle: "bold",
          bodyText: `Victory! ${userData.nameS2} defeated ${enemy}! Gained +100 Strength, +100 Agility, +100 Mana, 1000 EXP. New Level: ${userData.level}, Rank: ${userData.rank}${isMonarch && userData.rank === "S" ? `. Reply with 'arise ${enemy} <nickname>' to awaken this Shadow Monarch!` : "."}`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
      } else {
        userData.expS2 = Math.max(0, Number(userData.expS2) || 0) + 200;
        const s1LvlLoss = Math.max(1, Math.floor((Math.max(0, Number(userData.exp) || 0)) / 1000) + 1);
        const s2LvlLoss = Math.max(1, Math.floor((Math.max(0, Number(userData.expS2) || 0)) / 1000) + 1);
        userData.level = Math.max(s1LvlLoss, s2LvlLoss);
        applyRankProgression(userData);
        battleMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Season 2 Battle",
          headerSymbol: "💥",
          headerStyle: "bold",
          bodyText: `Defeated by ${enemy}! Gained 200 EXP. New Level: ${userData.level}, Rank: ${userData.rank}. Train harder!`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
      }
      userData.stats = stats;
      await saveHunterData(db, senderID.toString(), userData);
      if (win && isMonarch && userData.rank === "S") {
        let sentMessageID: string;
        await new Promise((resolve) => {
          api.sendMessage(battleMessage, threadID, (err, info) => {
            if (err) resolve(err);
            else {
              sentMessageID = info.messageID;
              resolve(info);
            }
          }, messageID);
        });
        if (!global.Kagenou.replyListeners) global.Kagenou.replyListeners = new Map();
        const handleReply = async ({ api, event }) => {
          const currentMsgID = sentMessageID;
          const { body } = event;
          const reply = body.toLowerCase().trim().split(" ");
          if (reply[0] === "arise") {
            const inputEnemy = reply[1]?.replace(/_/g, " ");
            const normalizedEnemy = shadowMonarchs.find(m => m.toLowerCase() === inputEnemy);
            if (normalizedEnemy) {
              const nickname = reply.slice(2).join(" ") || `${normalizedEnemy.toLowerCase()}Shadow`;
              const statBoosts = {
                "Kamish": { strength: 100, agility: 50, mana: 200 },
                "Ant King": { strength: 150, mana: 200 },
                "Monarch of Destruction": { agility: 100, mana: 300 },
                "Ruler's Shadow": { strength: 200, agility: 50 },
                "Ashborn": { strength: 500, agility: 500, mana: 1000 }
              };
              const boosts = statBoosts[normalizedEnemy] || { strength: 20, agility: 20, mana: 20 };
              userData.stats.strength = Math.max(0, Number(userData.stats.strength) || 0) + boosts.strength;
              userData.stats.agility = Math.max(0, Number(userData.stats.agility) || 0) + boosts.agility;
              userData.stats.mana = Math.max(0, Number(userData.stats.mana) || 0) + boosts.mana;
              userData.shadowsS2.push({ name: normalizedEnemy, nickname, level: 1 });
              await saveHunterData(db, senderID.toString(), userData);
              let nextMsgID: string;
              await new Promise<void>((resolve) => {
                api.sendMessage(
                  AuroraBetaStyler.styleOutput({
                    headerText: "Solo Leveling Season 2 Arise",
                    headerSymbol: "🌑",
                    headerStyle: "bold",
                    bodyText: `Awakened ${normalizedEnemy} as ${nickname}! Gain ${boosts.strength} Strength, ${boosts.agility} Agility, ${boosts.mana} Mana.\n\nReply to continue.`,
                    bodyStyle: "bold",
                    footerText: "Developed by: **Aljur pogoy**",
                  }),
                  threadID,
                  (err: any, info: any) => { nextMsgID = info?.messageID; resolve(); },
                  event.messageID
                );
              });
              global.Kagenou.replyListeners.set(nextMsgID, { callback: handleReply });
              global.Kagenou.replyListeners.delete(currentMsgID);
              sentMessageID = nextMsgID;
            }
          }
        };
        global.Kagenou.replyListeners.set(sentMessageID, { callback: handleReply });
      } else {
        await api.sendMessage(battleMessage, threadID, messageID);
      }
      return;
    }

    if (action === "s2" && args[1]?.toLowerCase() === "shop") {
      if (!userData.nameS2) {
        const notRegistered = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Season 2",
          headerSymbol: "⚠️",
          headerStyle: "bold",
          bodyText: "You need to register for Season 2 first. Usage: /sl s2 register",
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(notRegistered, threadID, messageID);
        return;
      }
      interface ShopItemS2 {
        cost: { magicCrystals?: number; holyCrystals?: number };
        type: "potion" | "equipment" | "material";
        effect: string;
      }
      const shopItemsS2: { [key: string]: ShopItemS2 } = {
        shadow_potion: { cost: { magicCrystals: 10 }, type: "potion", effect: "Boosts Strength by 50" },
        holy_potion: { cost: { holyCrystals: 5 }, type: "potion", effect: "Boosts Mana by 50" },
        monarch_essence: { cost: { magicCrystals: 20 }, type: "potion", effect: "Boosts Agility by 50" },
        crystal_vial: { cost: { magicCrystals: 15 }, type: "potion", effect: "Restores 100 Mana" },
        vitality_elixir: { cost: { holyCrystals: 10 }, type: "potion", effect: "Restores 100 Strength" },
        speed_draught: { cost: { magicCrystals: 12 }, type: "potion", effect: "Boosts Agility by 30" },
        mana_surge: { cost: { holyCrystals: 8 }, type: "potion", effect: "Boosts Mana by 30" },
        shadow_blade: { cost: { magicCrystals: 50 }, type: "equipment", effect: "Increases damage by 80%" },
        holy_spear: { cost: { holyCrystals: 30 }, type: "equipment", effect: "Increases damage by 70%" },
        monarch_crown: { cost: { magicCrystals: 100, holyCrystals: 50 }, type: "equipment", effect: "Boosts all stats by 100" },
        crystal_armor: { cost: { magicCrystals: 80 }, type: "equipment", effect: "Reduces damage taken by 50%" },
        divine_shield: { cost: { holyCrystals: 40 }, type: "equipment", effect: "Reduces damage taken by 40%" },
        shadow_cloak: { cost: { magicCrystals: 60 }, type: "equipment", effect: "Increases evasion by 30%" },
        holy_grail: { cost: { holyCrystals: 100 }, type: "material", effect: "Used for crafting legendary items" },
        mana_core: { cost: { magicCrystals: 25 }, type: "material", effect: "Used for crafting" },
        crystal_shard: { cost: { magicCrystals: 15 }, type: "material", effect: "Used for crafting" },
        divine_orb: { cost: { holyCrystals: 20 }, type: "material", effect: "Used for crafting" },
        shadow_essence: { cost: { magicCrystals: 30 }, type: "material", effect: "Used for crafting" },
        holy_relic: { cost: { holyCrystals: 50 }, type: "material", effect: "Used for crafting legendary items" },
        monarch_sigil: { cost: { magicCrystals: 150, holyCrystals: 75 }, type: "material", effect: "Unlocks ultimate abilities" },
      };
      const shopMessage = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Season 2 Shop",
        headerSymbol: "🛍️",
        headerStyle: "bold",
        bodyText: Object.entries(shopItemsS2).map(([key, details]) => {
          const costStr = details.cost.magicCrystals && details.cost.holyCrystals
            ? `${details.cost.magicCrystals} Magic Crystals, ${details.cost.holyCrystals} Holy Crystals`
            : details.cost.magicCrystals
              ? `${details.cost.magicCrystals} Magic Crystals`
              : `${details.cost.holyCrystals} Holy Crystals`;
          return `- ${key.replace("_", " ")}: ${details.effect} (Cost: ${costStr})`;
        }).join("\n") + "\nReply with 'buy <item> <quantity>' to purchase.",
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      let sentMessageID: string;
      await new Promise((resolve) => {
        api.sendMessage(shopMessage, threadID, (err, info) => {
          if (err) resolve(err);
          else {
            sentMessageID = info.messageID;
            resolve(info);
          }
        }, messageID);
      });
      if (!global.Kagenou.replyListeners) global.Kagenou.replyListeners = new Map();
      const handleReply = async ({ api, event }) => {
        const currentMsgID = sentMessageID;
        const { body } = event;
        const reply = body.toLowerCase().trim().split(" ");
        if (reply[0] === "buy") {
          const item = reply[1]?.replace(/_/g, "_");
          const quantity = parseInt(reply[2]) || 1;
          if (!item || !shopItemsS2[item] || quantity <= 0) {
            let nextMsgID: string;
            await new Promise<void>((resolve) => {
              api.sendMessage(
                AuroraBetaStyler.styleOutput({
                  headerText: "Solo Leveling Season 2 Shop",
                  headerSymbol: "⚠️",
                  headerStyle: "bold",
                  bodyText: "Invalid item or quantity. Reply with 'buy <item> <quantity>'.",
                  bodyStyle: "bold",
                  footerText: "Developed by: **Aljur pogoy**",
                }),
                threadID,
                (err: any, info: any) => { nextMsgID = info?.messageID; resolve(); },
                event.messageID
              );
            });
            global.Kagenou.replyListeners.set(nextMsgID, { callback: handleReply });
            global.Kagenou.replyListeners.delete(currentMsgID);
            sentMessageID = nextMsgID;
            return;
          }
          const itemData = shopItemsS2[item];
          const totalMagicCrystals = (itemData.cost.magicCrystals || 0) * quantity;
          const totalHolyCrystals = (itemData.cost.holyCrystals || 0) * quantity;
          if (
            (totalMagicCrystals > 0 && userData.inventoryS2.magicCrystals < totalMagicCrystals) ||
            (totalHolyCrystals > 0 && userData.inventoryS2.holyCrystals < totalHolyCrystals)
          ) {
            let nextMsgID: string;
            await new Promise<void>((resolve) => {
              api.sendMessage(
                AuroraBetaStyler.styleOutput({
                  headerText: "Solo Leveling Season 2 Shop",
                  headerSymbol: "❌",
                  headerStyle: "bold",
                  bodyText: `Not enough resources. Need ${totalMagicCrystals} Magic Crystals, ${totalHolyCrystals} Holy Crystals.`,
                  bodyStyle: "bold",
                  footerText: "Developed by: **Aljur pogoy**",
                }),
                threadID,
                (err: any, info: any) => { nextMsgID = info?.messageID; resolve(); },
                event.messageID
              );
            });
            global.Kagenou.replyListeners.set(nextMsgID, { callback: handleReply });
            global.Kagenou.replyListeners.delete(currentMsgID);
            sentMessageID = nextMsgID;
            return;
          }
          userData.inventoryS2.magicCrystals -= totalMagicCrystals;
          userData.inventoryS2.holyCrystals -= totalHolyCrystals;
          if (itemData.type === "potion") {
            const effects = {
              shadow_potion: { strength: 50 * quantity },
              holy_potion: { mana: 50 * quantity },
              monarch_essence: { agility: 50 * quantity },
              crystal_vial: { mana: 100 * quantity },
              vitality_elixir: { strength: 100 * quantity },
              speed_draught: { agility: 30 * quantity },
              mana_surge: { mana: 30 * quantity },
            };
            if (effects[item]) {
              userData.stats.strength = Math.max(0, Number(userData.stats.strength) || 0) + (effects[item].strength || 0);
              userData.stats.agility = Math.max(0, Number(userData.stats.agility) || 0) + (effects[item].agility || 0);
              userData.stats.mana = Math.max(0, Number(userData.stats.mana) || 0) + (effects[item].mana || 0);
            }
          } else {
            userData.inventoryS2.items[item] = Math.max(0, Number(userData.inventoryS2.items[item] || 0)) + quantity;
          }
          await saveHunterData(db, senderID.toString(), userData);
          let nextMsgID: string;
          await new Promise<void>((resolve) => {
            api.sendMessage(
              AuroraBetaStyler.styleOutput({
                headerText: "Solo Leveling Season 2 Shop",
                headerSymbol: "✅",
                headerStyle: "bold",
                bodyText: `Purchased ${quantity} ${item.replace("_", " ")}! ${itemData.effect}.\n\nReply 'buy <item> <quantity>' to buy more.`,
                bodyStyle: "bold",
                footerText: "Developed by: **Aljur pogoy**",
              }),
              threadID,
              (err: any, info: any) => { nextMsgID = info?.messageID; resolve(); },
              event.messageID
            );
          });
          global.Kagenou.replyListeners.set(nextMsgID, { callback: handleReply });
          global.Kagenou.replyListeners.delete(currentMsgID);
          sentMessageID = nextMsgID;
        }
      };
      global.Kagenou.replyListeners.set(sentMessageID, { callback: handleReply });
      return;
    }

    if (action === "s2" && args[1]?.toLowerCase() === "dungeon") {
      if (!userData.nameS2) {
        const notRegistered = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Season 2",
          headerSymbol: "⚠️",
          headerStyle: "bold",
          bodyText: "You need to register for Season 2 first. Usage: /sl s2 register",
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(notRegistered, threadID, messageID);
        return;
      }
      const tier = args[2]?.toUpperCase();
      const tiers = ["D", "C", "B", "A", "S"];
      if (!tier || !tiers.includes(tier)) {
        const invalidTier = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Season 2 Dungeon",
          headerSymbol: "⚠️",
          headerStyle: "bold",
          bodyText: "Invalid tier. Use /sl s2 dungeon <D/C/B/A/S>.",
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(invalidTier, threadID, messageID);
        return;
      }
      if (Math.max(0, Number(userData.dungeonCooldownS2) || 0) > currentTime) {
        const remaining = Math.max(0, Number(userData.dungeonCooldownS2) || 0) - currentTime;
        const cooldownMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Season 2 Dungeon",
          headerSymbol: "⏳",
          headerStyle: "bold",
          bodyText: `Cooldown active. Wait ${Math.ceil(remaining / 60)} minutes.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(cooldownMessage, threadID, messageID);
        return;
      }
      const rewards = {
        D: { magicCrystals: 5, holyCrystals: 2 },
        C: { magicCrystals: 10, holyCrystals: 4 },
        B: { magicCrystals: 15, holyCrystals: 6 },
        A: { magicCrystals: 20, holyCrystals: 8 },
        S: { magicCrystals: 30, holyCrystals: 12 },
      };
      const expGain = Math.max(0, Math.floor(Math.random() * 500) + (tier === "D" ? 500 : tier === "C" ? 1000 : tier === "B" ? 1500 : tier === "A" ? 2000 : 3000));
      userData.expS2 = Math.max(0, Number(userData.expS2) || 0) + expGain;
      const s1LvlDungeon = Math.max(1, Math.floor((Math.max(0, Number(userData.exp) || 0)) / 1000) + 1);
      const s2LvlDungeon = Math.max(1, Math.floor((Math.max(0, Number(userData.expS2) || 0)) / 1000) + 1);
      userData.level = Math.max(s1LvlDungeon, s2LvlDungeon);
      userData.inventoryS2.magicCrystals = Math.max(0, Number(userData.inventoryS2.magicCrystals) || 0) + rewards[tier].magicCrystals;
      userData.inventoryS2.holyCrystals = Math.max(0, Number(userData.inventoryS2.holyCrystals) || 0) + rewards[tier].holyCrystals;
      userData.dungeonCooldownS2 = currentTime + dungeonCooldownS2;
      applyRankProgression(userData);
      await saveHunterData(db, senderID.toString(), userData);
      const dungeonMessage = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Season 2 Dungeon",
        headerSymbol: "🏰",
        headerStyle: "bold",
        bodyText: `Cleared ${tier}-tier dungeon! Gained ${expGain} EXP, ${rewards[tier].magicCrystals} Magic Crystals, ${rewards[tier].holyCrystals} Holy Crystals. New Level: ${userData.level}, Rank: ${userData.rank}.`,
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(dungeonMessage, threadID, messageID);
      return;
    }

    if (action === "s2" && args[1]?.toLowerCase() === "guild") {
      if (!userData.nameS2) {
        const notRegistered = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Season 2",
          headerSymbol: "⚠️",
          headerStyle: "bold",
          bodyText: "You need to register for Season 2 first. Usage: /sl s2 register",
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(notRegistered, threadID, messageID);
        return;
      }
      const subAction = args[2]?.toLowerCase();
      const guildCollection = db.db("guilds");
      const guildsS2 = await guildCollection.find({ isSeason2: true }).toArray();

      if (subAction === "create") {
        const guildName = args.slice(3).join(" ") || `S2Guild${Math.floor(Math.random() * 1000)}`;
        if (userData.guildS2) {
          const alreadyInGuild = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Season 2 Guild",
            headerSymbol: "🛑",
            headerStyle: "bold",
            bodyText: `Already in ${userData.guildS2}. Leave to create a new one.`,
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(alreadyInGuild, threadID, messageID);
          return;
        }
        if (guildsS2.some(g => g.name === guildName)) {
          const guildExists = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Season 2 Guild",
            headerSymbol: "⚠️",
            headerStyle: "bold",
            bodyText: `Guild ${guildName} already exists. Join it instead!`,
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(guildExists, threadID, messageID);
          return;
        }
        userData.guildS2 = guildName;
        const stats = userData.stats || { strength: 0, agility: 0, mana: 0 };
        const baseStrength = Math.max(0, Number(stats.strength) || 0);
        await guildCollection.insertOne({ name: guildName, members: [senderID.toString()], totalStrength: baseStrength + 50, hasChangedName: false, isSeason2: true });
        await saveHunterData(db, senderID.toString(), userData);
        const createMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Season 2 Guild",
          headerSymbol: "🛡️",
          headerStyle: "bold",
          bodyText: `Created Guild: ${guildName}. +50 Group Strength.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(createMessage, threadID, messageID);
        return;
      }

      if (subAction === "leave") {
        if (!userData.guildS2) {
          const noGuild = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Season 2 Guild",
            headerSymbol: "❌",
            headerStyle: "bold",
            bodyText: "You are not in a Season 2 guild to leave!",
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(noGuild, threadID, messageID);
          return;
        }
        const currentGuild = guildsS2.find(g => g.name === userData.guildS2);
        if (!currentGuild) {
          userData.guildS2 = undefined;
          await saveHunterData(db, senderID.toString(), userData);
          const noGuildFound = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Season 2 Guild",
            headerSymbol: "ℹ️",
            headerStyle: "bold",
            bodyText: "Your Season 2 guild no longer exists. You have been removed.",
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(noGuildFound, threadID, messageID);
          return;
        }
        const stats = userData.stats || { strength: 0, agility: 0, mana: 0 };
        const memberStrength = Math.max(0, Number(stats.strength) || 0);
        currentGuild.members = currentGuild.members.filter(member => member !== senderID.toString());
        currentGuild.totalStrength = Math.max(0, currentGuild.totalStrength - memberStrength);
        await guildCollection.updateOne({ name: currentGuild.name, isSeason2: true }, { $set: currentGuild });
        userData.guildS2 = undefined;
        await saveHunterData(db, senderID.toString(), userData);
        const leaveMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Season 2 Guild",
          headerSymbol: "🚪",
          headerStyle: "bold",
          bodyText: `You have left ${currentGuild.name}.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(leaveMessage, threadID, messageID);
        return;
      }

      if (subAction === "list") {
        if (guildsS2.length === 0) {
          const noGuilds = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Season 2 Guild",
            headerSymbol: "ℹ️",
            headerStyle: "bold",
            bodyText: "No Season 2 guilds have been created yet.",
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(noGuilds, threadID, messageID);
          return;
        }
        const guildList = guildsS2.map(g => `- ${g.name}: ${Math.max(0, Number(g.totalStrength) || 0)} Total Strength`).join("\n");
        const listMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Season 2 Guild List",
          headerSymbol: "🛡️",
          headerStyle: "bold",
          bodyText: `Active Season 2 Guilds:\n${guildList}`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(listMessage, threadID, messageID);
        return;
      }

      if (subAction === "war") {
        if (!userData.guildS2) {
          const noGuild = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Season 2 Guild",
            headerSymbol: "❌",
            headerStyle: "bold",
            bodyText: "You must be in a Season 2 guild to fight!",
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(noGuild, threadID, messageID);
          return;
        }
        const myGuild = guildsS2.find(g => g.name === userData.guildS2);
        const targetGuild = guildsS2[Math.floor(Math.random() * guildsS2.length)];
        if (!targetGuild || myGuild.name === targetGuild.name) {
          const noTarget = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Season 2 Guild",
            headerSymbol: "⚠️",
            headerStyle: "bold",
            bodyText: "No valid opponent guild found or you can't fight your own guild!",
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(noTarget, threadID, messageID);
          return;
        }
        const myStrength = Math.max(0, Number(myGuild.totalStrength) || 0);
        const targetStrength = Math.max(0, Number(targetGuild.totalStrength) || 0);
        const fightResult = myStrength > targetStrength || userData.rank === "X";
        if (fightResult) {
          userData.inventoryS2.magicCrystals = Math.max(0, Number(userData.inventoryS2.magicCrystals) || 0) + 10;
          userData.inventoryS2.holyCrystals = Math.max(0, Number(userData.inventoryS2.holyCrystals) || 0) + 5;
          await saveHunterData(db, senderID.toString(), userData);
          const fightMessage = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Season 2 Guild War",
            headerSymbol: "⚔️",
            headerStyle: "bold",
            bodyText: `Victory! ${myGuild.name} defeated ${targetGuild.name} (${myStrength} vs ${targetStrength})! Gained 10 Magic Crystals and 5 Holy Crystals.`,
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(fightMessage, threadID, messageID);
        } else {
          const fightMessage = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Season 2 Guild War",
            headerSymbol: "💥",
            headerStyle: "bold",
            bodyText: `Defeated! ${myGuild.name} lost to ${targetGuild.name} (${myStrength} vs ${targetStrength}). Train harder!`,
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(fightMessage, threadID, messageID);
        }
        return;
      }

      const invalidGuildCommand = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Season 2 Guild",
        headerSymbol: "⚠️",
        headerStyle: "bold",
        bodyText: "Invalid guild command. Use /sl s2 guild [create <name> | leave | list | war].",
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(invalidGuildCommand, threadID, messageID);
      return;
    }

    if (action === "s2" && args[1]?.toLowerCase() === "inventory") {
      if (!userData.nameS2) {
        const notRegistered = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Season 2",
          headerSymbol: "⚠️",
          headerStyle: "bold",
          bodyText: "You need to register for Season 2 first. Usage: /sl s2 register",
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(notRegistered, threadID, messageID);
        return;
      }
      const items = Object.entries(userData.inventoryS2.items || {}).map(([k, v]) => `${k.replace("_", " ")} x${Math.max(0, Number(v) || 0)}`).join(", ") || "None";
      const inventoryMessage = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Season 2 Inventory",
        headerSymbol: "🎒",
        headerStyle: "bold",
        bodyText: `Magic Crystals: ${Math.max(0, Number(userData.inventoryS2.magicCrystals) || 0)}\nHoly Crystals: ${Math.max(0, Number(userData.inventoryS2.holyCrystals) || 0)}\nItems: ${items}`,
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(inventoryMessage, threadID, messageID);
      return;
    }

   if (action === "s2" && args[1]?.toLowerCase() === "leaderboard") {
  const huntersCollection = db.db("hunters");
  const topHunters = await huntersCollection
    .find({ nameS2: { $exists: true } })
    .sort({ expS2: -1 })
    .limit(20)
    .toArray();
  const leaderboardMessage = AuroraBetaStyler.styleOutput({
    headerText: "Solo Leveling S2 Leaderboard",
    headerSymbol: "🏆",
    headerStyle: "bold",
    bodyText: topHunters.length > 0
      ? topHunters.map((h, i) => `${i + 1}. ${h.nameS2 || "Unknown"} (Level ${Math.max(1, Number(h.level) || 1)}, S2 EXP: ${Math.max(0, Number(h.expS2) || 0)}, Rank ${h.rank || "E"})`).join("\n")
      : "No hunters ranked in Season 2 yet.",
    bodyStyle: "bold",
    footerText: "Developed by: **Aljur pogoy**",
  });
  await api.sendMessage(leaderboardMessage, threadID, messageID);
  return;
}
   if (action === "s2" && args[1]?.toLowerCase() === "shadowtrain") {
  if (!userData.nameS2) {
    const notRegistered = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Season 2",
      headerSymbol: "⚠️",
      headerStyle: "bold",
      bodyText: "You need to register for Season 2 first. Usage: /sl s2 register",
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(notRegistered, threadID, messageID);
    return;
  }
  const shadowName = args[2]?.replace(/\s+/g, "_").toLowerCase();
  if (!shadowName || !userData.shadowsS2.some(s => s.name.toLowerCase().replace(/\s+/g, "_") === shadowName)) {
    const invalidShadow = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Season 2 Shadow Train",
      headerSymbol: "⚠️",
      headerStyle: "bold",
      bodyText: `Invalid shadow name. Check your shadows with /sl s2 shadowlist. Usage: /sl s2 shadowtrain <shadow_name>`,
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(invalidShadow, threadID, messageID);
    return;
  }
  const shadow = userData.shadowsS2.find(s => s.name.toLowerCase().replace(/\s+/g, "_") === shadowName);
  const materialCost = { magicCrystals: 10, holyCrystals: 5 };
  if ((userData.inventoryS2.magicCrystals || 0) < materialCost.magicCrystals || (userData.inventoryS2.holyCrystals || 0) < materialCost.holyCrystals) {
    const insufficientMaterials = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Season 2 Shadow Train",
      headerSymbol: "❌",
      headerStyle: "bold",
      bodyText: `Not enough materials. Required: Magic Crystals x${materialCost.magicCrystals}, Holy Crystals x${materialCost.holyCrystals}`,
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(insufficientMaterials, threadID, messageID);
    return;
  }
  userData.inventoryS2.magicCrystals = Math.max(0, Number(userData.inventoryS2.magicCrystals || 0) - materialCost.magicCrystals);
  userData.inventoryS2.holyCrystals = Math.max(0, Number(userData.inventoryS2.holyCrystals || 0) - materialCost.holyCrystals);
  shadow.level = Math.max(1, Number(shadow.level || 1) + 1);
  userData.expS2 = Math.max(0, Number(userData.expS2) || 0) + 300;
  const s1Level = Math.max(1, Math.floor((Math.max(0, Number(userData.exp) || 0)) / 1000) + 1);
  const s2Level = Math.max(1, Math.floor((Math.max(0, Number(userData.expS2) || 0)) / 1000) + 1);
  userData.level = Math.max(s1Level, s2Level);
  applyRankProgression(userData);
  await saveHunterData(db, senderID.toString(), userData);
  const trainMessage = AuroraBetaStyler.styleOutput({
    headerText: "Solo Leveling Season 2 Shadow Train",
    headerSymbol: "🌑",
    headerStyle: "bold",
    bodyText: `Trained shadow ${shadow.name} (${shadow.nickname}) to Level ${shadow.level}! Gained 300 EXP. New Level: ${userData.level}, Rank: ${userData.rank}.`,
    bodyStyle: "bold",
    footerText: "Developed by: **Aljur pogoy**",
  });
  await api.sendMessage(trainMessage, threadID, messageID);
  return;
}

if (action === "craft") {
  const item = args[1]?.toLowerCase()?.replace(/\s+/g, "_");
  const craftRecipes: { [key: string]: { materials: { [key: string]: number }; effect: string } } = {
    shadow_blade: { materials: { iron_ore: 5, mana_crystal: 3 }, effect: "Increases damage by 60%" },
    mystic_armor: { materials: { mythril: 4, dragon_scale: 2 }, effect: "Reduces damage taken by 30%" },
    void_pendant: { materials: { shadow_essence: 2, mana_crystal: 5 }, effect: "Boosts Mana by 50" },
  };
  if (!item || !craftRecipes[item]) {
    const invalidItem = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Craft",
      headerSymbol: "⚠️",
      headerStyle: "bold",
      bodyText: `Invalid item. Available items: ${Object.keys(craftRecipes).map(k => k.replace("_", " ")).join(", ")}. Usage: /sl craft <item>`,
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(invalidItem, threadID, messageID);
    return;
  }
  const recipe = craftRecipes[item];
  const hasMaterials = Object.entries(recipe.materials).every(([mat, qty]) => (userData.inventory.materials[mat] || 0) >= qty);
  if (!hasMaterials) {
    const materialList = Object.entries(recipe.materials).map(([mat, qty]) => `${mat.replace("_", " ")} x${qty}`).join(", ");
    const insufficientMaterials = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Craft",
      headerSymbol: "❌",
      headerStyle: "bold",
      bodyText: `Not enough materials. Required: ${materialList}`,
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(insufficientMaterials, threadID, messageID);
    return;
  }
  for (const [mat, qty] of Object.entries(recipe.materials)) {
    userData.inventory.materials[mat] = Math.max(0, Number(userData.inventory.materials[mat] || 0) - qty);
    if (userData.inventory.materials[mat] <= 0) delete userData.inventory.materials[mat];
  }
  if (item === "void_pendant") {
    userData.stats.mana = Math.max(0, Number(userData.stats.mana) || 0) + 50;
  } else {
    userData.equipment.swords[item] = Math.max(1, Number(userData.equipment.swords[item] || 1));
  }
  await saveHunterData(db, senderID.toString(), userData);
  const craftMessage = AuroraBetaStyler.styleOutput({
    headerText: "Solo Leveling Craft",
    headerSymbol: "🔨",
    headerStyle: "bold",
    bodyText: `Crafted ${item.replace("_", " ")}! ${recipe.effect}`,
    bodyStyle: "bold",
    footerText: "Developed by: **Aljur pogoy**",
  });
  await api.sendMessage(craftMessage, threadID, messageID);
  return;
}

if (action === "shadowtrain") {
  const shadowName = args[1]?.replace(/\s+/g, "_").toLowerCase();
  if (!shadowName || !userData.shadows.some(s => s.name.toLowerCase().replace(/\s+/g, "_") === shadowName)) {
    const invalidShadow = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Shadow Train",
      headerSymbol: "⚠️",
      headerStyle: "bold",
      bodyText: `Invalid shadow name. Check your shadows with /sl shadowlist. Usage: /sl shadowtrain <shadow_name>`,
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(invalidShadow, threadID, messageID);
    return;
  }
  const shadow = userData.shadows.find(s => s.name.toLowerCase().replace(/\s+/g, "_") === shadowName);
  const materialCost = { mana_crystal: 2 };
  if ((userData.inventory.materials.mana_crystal || 0) < materialCost.mana_crystal) {
    const insufficientMaterials = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Shadow Train",
      headerSymbol: "❌",
      headerStyle: "bold",
      bodyText: `Not enough materials. Required: Mana Crystal x${materialCost.mana_crystal}`,
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(insufficientMaterials, threadID, messageID);
    return;
  }
  userData.inventory.materials.mana_crystal = Math.max(0, Number(userData.inventory.materials.mana_crystal || 0) - materialCost.mana_crystal);
  if (userData.inventory.materials.mana_crystal <= 0) delete userData.inventory.materials.mana_crystal;
  shadow.level = Math.max(1, Number(shadow.level || 1) + 1);
  userData.exp = Math.max(0, Number(userData.exp) || 0) + 200;
  userData.level = Math.max(1, Math.floor(userData.exp / 1000) + 1);
  applyRankProgression(userData);
  await saveHunterData(db, senderID.toString(), userData);
  const trainMessage = AuroraBetaStyler.styleOutput({
    headerText: "Solo Leveling Shadow Train",
    headerSymbol: "🌑",
    headerStyle: "bold",
    bodyText: `Trained shadow ${shadow.name} (${shadow.nickname}) to Level ${shadow.level}! Gained 200 EXP. New Level: ${userData.level}, Rank: ${userData.rank}.`,
    bodyStyle: "bold",
    footerText: "Developed by: **Aljur pogoy**",
  });
  await api.sendMessage(trainMessage, threadID, messageID);
  return;
}
   
    if (action === "register") {
      const name = args[1];
      if (!name) {
        const errorMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling",
          headerSymbol: "⚠️",
          headerStyle: "bold",
          bodyText: "Please provide a hunter name. Usage: /sl register <name>",
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(errorMessage, threadID, messageID);
        return;
      }
      const huntersCollection = db.db("hunters");
      const existingHunter = await huntersCollection.findOne({ name });
      if (existingHunter) {
        const duplicateName = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling",
          headerSymbol: "🛑",
          headerStyle: "bold",
          bodyText: `The name "${name}" is already taken. Please choose a different name.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(duplicateName, threadID, messageID);
        return;
      }
      if (userData.name) {
        const alreadyRegistered = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling",
          headerSymbol: "🛑",
          headerStyle: "bold",
          bodyText: `You are already registered as ${userData.name}. Use /sl status to check your stats.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(alreadyRegistered, threadID, messageID);
        return;
      }
      userData.name = name;
      userData.level = 1;
      userData.exp = 0;
      userData.rank = "E";
      userData.equipment.swords = { "basic_sword": 1 };
      userData.inventory = { potions: { "health_potion": 2 }, materials: {} };
      userData.shadows = [];
      userData.stats = { strength: 10, agility: 10, mana: 10 };
      userData.dungeonCooldown = 0;
      userData.quests = {};
      userData.meditateCooldown = 0;
      userData.lostShadows = [];
      userData.hasChangedName = false;
      userData.gateCooldown = 0;
      await saveHunterData(db, senderID.toString(), userData);
      const registerMessage = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling",
        headerSymbol: "✅",
        headerStyle: "bold",
        bodyText: `${name} registered as a hunter! Default rank: E. Use /sl status to see your stats.`,
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(registerMessage, threadID, messageID);
      return;
    }

    if (!userData.name && !["s2"].includes(action)) {
      const notRegistered = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling",
        headerSymbol: "⚠️",
        headerStyle: "bold",
        bodyText: "You need to register first. Usage: /sl register <name>",
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(notRegistered, threadID, messageID);
      return;
    }

    if (action === "status") {
      const equippedSword = Object.entries(userData.equipment.swords).reduce((max, current) => (current[1] > max[1] ? current : max), ["basic_sword", 1]);
      const stats = userData.stats || { strength: 0, agility: 0, mana: 0 };
      const statusMessage = AuroraBetaStyler.styleOutput({
        headerText: "Hunter Status",
        headerSymbol: "📊",
        headerStyle: "bold",
        bodyText: `Name: ${userData.name}\nLevel: ${Math.max(1, Number(userData.level) || 1)}\nEXP: ${Math.max(0, Number(userData.exp) || 0)}\nRank: ${userData.rank || "E"}\nRole: ${userData.role || "None"}\nStats: Strength ${Math.max(0, Number(stats.strength) || 0)}, Agility ${Math.max(0, Number(stats.agility) || 0)}, Mana ${Math.max(0, Number(stats.mana) || 0)}\nEquipped Sword: ${equippedSword[0].replace("_", " ")} (Level ${Math.max(1, Number(equippedSword[1]) || 1)})\nShadows: ${userData.shadows.length > 0 ? userData.shadows.map(s => `${s.name} (${s.nickname})`).join(", ") : "None"}\nGuild: ${userData.guild || "None"}`,
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(statusMessage, threadID, messageID);
      return;
    }

if (action === "use") {

      const useRawArgs = args.slice(1);
      const useLastArg = useRawArgs[useRawArgs.length - 1];
      const useParsedQty = parseInt(useLastArg);
      let potionRaw: string;
      let quantity: number;
      if (!isNaN(useParsedQty) && useParsedQty > 0 && useRawArgs.length > 1) {
        potionRaw = useRawArgs.slice(0, -1).join(" ").toLowerCase().trim();
        quantity = useParsedQty;
      } else {
        potionRaw = useRawArgs.join(" ").toLowerCase().trim();
        quantity = 1;
      }

      const potion = potionRaw.replace(/ /g, "_");
      if (!potion || !userData.inventory.potions[potion] || quantity <= 0 || userData.inventory.potions[potion] < quantity) {
        const invalidItem = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Use",
          headerSymbol: "⚠️",
          headerStyle: "bold",
          bodyText: `Invalid potion, insufficient quantity, or not enough potions. You have ${userData.inventory.potions[potion] || 0} ${potion?.replace("_", " ") || "potion"}. Check with /sl status.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(invalidItem, threadID, messageID);
        return;
      }
      userData.inventory.potions[potion] = Math.max(0, Number(userData.inventory.potions[potion]) || 0) - quantity;
      const stats = userData.stats || { strength: 0, agility: 0, mana: 0 };
      let effectMessage = "";
      if (potion === "health_potion") {
        stats.strength = Math.max(0, Number(stats.strength) || 0) + 5 * quantity;
        effectMessage = `Used ${quantity} Health Potion(s)! Strength increased by ${5 * quantity} permanently.`;
      } else if (potion === "mana_potion") {
        stats.mana = Math.max(0, Number(stats.mana) || 0) + 5 * quantity;
        effectMessage = `Used ${quantity} Mana Potion(s)! Mana increased by ${5 * quantity} permanently.`;
      } else if (potion === "strength_potion") {
        stats.strength = Math.max(0, Number(stats.strength) || 0) + 20 * quantity;
        effectMessage = `Used ${quantity} Strength Potion(s)! Strength increased by ${20 * quantity} permanently.`;
      } else if (potion === "agility_potion") {
        stats.agility = Math.max(0, Number(stats.agility) || 0) + 20 * quantity;
        effectMessage = `Used ${quantity} Agility Potion(s)! Agility increased by ${20 * quantity} permanently.`;
      } else if (potion === "mana_regen_potion") {
        stats.mana = Math.max(0, Number(stats.mana) || 0) + 50 * quantity;
        effectMessage = `Used ${quantity} Mana Regen Potion(s)! Mana increased by ${50 * quantity} permanently.`;
      } else if (potion === "god_mode_potion") {
        effectMessage = `Used ${quantity} God Mode Potion(s)! All enemies will be defeated instantly in your next ${quantity} battle(s)!`;
      }
      userData.stats = stats;
      if (userData.inventory.potions[potion] <= 0) delete userData.inventory.potions[potion];
      await saveHunterData(db, senderID.toString(), userData);
      const useMessage = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Use",
        headerSymbol: potion === "god_mode_potion" ? "✨" : potion.includes("health") ? "❤️" : potion.includes("mana") ? "🔮" : potion.includes("strength") ? "💪" : potion.includes("agility") ? "🏃" : "🔄",
        headerStyle: "bold",
        bodyText: effectMessage,
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(useMessage, threadID, messageID);
      return;
    }

if (action === "shop") {
      interface ShopItem {
        cost: { exp: number };
        type: "sword" | "potion";
        level?: number;
        effect?: string;
        amount?: number;
        limit?: number;
      }
      const shopItems: { [key: string]: ShopItem } = {
        "basic sword": { cost: { exp: 0 }, type: "sword", level: 1, effect: "Basic damage" },
        "demon kings longsword": { cost: { exp: 1000 }, type: "sword", level: 2, effect: "Increases damage by 30%" },
        "knights tyrant blade": { cost: { exp: 2500 }, type: "sword", level: 3, effect: "Increases damage by 50%" },
        "storcs bane": { cost: { exp: 5000 }, type: "sword", level: 4, effect: "Increases damage by 70%" },
        "kasaka venom fang": { cost: { exp: 7500 }, type: "sword", level: 5, effect: "Adds poison effect" },
        "ice dagger": { cost: { exp: 3000 }, type: "sword", level: 3, effect: "Freezes enemies, +40% damage" },
        "shadow scythe": { cost: { exp: 8000 }, type: "sword", level: 5, effect: "Dark damage, +60% damage" },
        "crimson blade": { cost: { exp: 9000 }, type: "sword", level: 6, effect: "Burns enemies, +70% damage" },
        "thunder spear": { cost: { exp: 10000 }, type: "sword", level: 6, effect: "Lightning strike, +70% damage" },
        "frostbite axe": { cost: { exp: 11000 }, type: "sword", level: 7, effect: "Slows enemies, +80% damage" },
        "arcane sword": { cost: { exp: 12000 }, type: "sword", level: 7, effect: "Mana boost, +80% damage" },
        "dragon tooth sword": { cost: { exp: 13000 }, type: "sword", level: 8, effect: "Dragon fire, +90% damage" },
        "void edge": { cost: { exp: 14000 }, type: "sword", level: 8, effect: "Void damage, +90% damage" },
        "celestial blade": { cost: { exp: 15000 }, type: "sword", level: 9, effect: "Holy damage, +100% damage" },
        "ashborn relic": { cost: { exp: 20000 }, type: "sword", level: 10, effect: "Ultimate power, +150% damage" },
        "x rank sword": { cost: { exp: 5000000 }, type: "sword", level: 15, effect: "+10k Strength, +10k Agility, +40k Mana" },
        "void monarch blade": { cost: { exp: 25000 }, type: "sword", level: 11, effect: "Void monarch force, +180% damage" },
        "shadow monarch staff": { cost: { exp: 30000 }, type: "sword", level: 12, effect: "Shadow monarch aura, +200% damage, +500 Mana" },
        "beru war axe": { cost: { exp: 18000 }, type: "sword", level: 10, effect: "Berserker fury, +160% damage, +300 Strength" },
        "igris lance": { cost: { exp: 22000 }, type: "sword", level: 11, effect: "Knight commander force, +170% damage" },
        "rulers authority": { cost: { exp: 40000 }, type: "sword", level: 13, effect: "Ruler divine power, +250% damage, +1000 Mana" },
        "health potion": { cost: { exp: 200 }, type: "potion", amount: 1, effect: "Boosts Strength by 5" },
        "mana potion": { cost: { exp: 300 }, type: "potion", amount: 1, effect: "Boosts Mana by 5" },
        "strength potion": { cost: { exp: 500 }, type: "potion", amount: 1, effect: "Boosts Strength by 20" },
        "agility potion": { cost: { exp: 600 }, type: "potion", amount: 1, effect: "Boosts Agility by 20" },
        "mana regen potion": { cost: { exp: 700 }, type: "potion", amount: 1, effect: "Boosts Mana by 50" },
        "god mode potion": { cost: { exp: 1000000 }, type: "potion", amount: 1, limit: 5, effect: "Defeats all enemies instantly for 1 battle" },
      };
      const swordsSection = Object.entries(shopItems)
        .filter(([, d]) => d.type === "sword")
        .map(([key, details]) => `⚔️ ${key}: ${details.effect} (Cost: ${details.cost.exp} EXP)`)
        .join("\n");
      const potionIdMapShop: { [name: string]: string } = {
        "health potion": "1001", "mana potion": "1002", "strength potion": "1003",
        "agility potion": "1004", "mana regen potion": "1005", "god mode potion": "1006",
      };
      const potionsSection = Object.entries(shopItems)
        .filter(([, d]) => d.type === "potion")
        .map(([key, details]) => `🧪 [ID: ${potionIdMapShop[key]}] ${key}: ${details.effect} (Cost: ${details.cost.exp} EXP${details.limit ? `, Limit: ${details.limit}` : ""})`)
        .join("\n");
      const shopMessage = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Shop",
        headerSymbol: "🛍️",
        headerStyle: "bold",
        bodyText: `⚔️ WEAPONS\n${swordsSection}\n\n🧪 POTIONS\n${potionsSection}\n\nUsage: /sl buy <item name> <quantity>\nExample: /sl buy celestial blade 1`,
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(shopMessage, threadID, messageID);
      return;
    }

      if (action === "buy") {
      interface ShopItem {
        cost: { exp: number };
        type: "sword" | "potion";
        level?: number;
        effect?: string;
        amount?: number;
        limit?: number;
      }
      const shopItems: { [key: string]: ShopItem } = {
        "basic sword": { cost: { exp: 0 }, type: "sword", level: 1, effect: "Basic damage" },
        "demon kings longsword": { cost: { exp: 1000 }, type: "sword", level: 2, effect: "Increases damage by 30%" },
        "knights tyrant blade": { cost: { exp: 2500 }, type: "sword", level: 3, effect: "Increases damage by 50%" },
        "storcs bane": { cost: { exp: 5000 }, type: "sword", level: 4, effect: "Increases damage by 70%" },
        "kasaka venom fang": { cost: { exp: 7500 }, type: "sword", level: 5, effect: "Adds poison effect" },
        "ice dagger": { cost: { exp: 3000 }, type: "sword", level: 3, effect: "Freezes enemies, +40% damage" },
        "shadow scythe": { cost: { exp: 8000 }, type: "sword", level: 5, effect: "Dark damage, +60% damage" },
        "crimson blade": { cost: { exp: 9000 }, type: "sword", level: 6, effect: "Burns enemies, +70% damage" },
        "thunder spear": { cost: { exp: 10000 }, type: "sword", level: 6, effect: "Lightning strike, +70% damage" },
        "frostbite axe": { cost: { exp: 11000 }, type: "sword", level: 7, effect: "Slows enemies, +80% damage" },
        "arcane sword": { cost: { exp: 12000 }, type: "sword", level: 7, effect: "Mana boost, +80% damage" },
        "dragon tooth sword": { cost: { exp: 13000 }, type: "sword", level: 8, effect: "Dragon fire, +90% damage" },
        "void edge": { cost: { exp: 14000 }, type: "sword", level: 8, effect: "Void damage, +90% damage" },
        "celestial blade": { cost: { exp: 15000 }, type: "sword", level: 9, effect: "Holy damage, +100% damage" },
        "ashborn relic": { cost: { exp: 20000 }, type: "sword", level: 10, effect: "Ultimate power, +150% damage" },
        "x rank sword": { cost: { exp: 5000000 }, type: "sword", level: 15, effect: "+10k Strength, +10k Agility, +40k Mana" },
        "void monarch blade": { cost: { exp: 25000 }, type: "sword", level: 11, effect: "Void monarch force, +180% damage" },
        "shadow monarch staff": { cost: { exp: 30000 }, type: "sword", level: 12, effect: "Shadow monarch aura, +200% damage, +500 Mana" },
        "beru war axe": { cost: { exp: 18000 }, type: "sword", level: 10, effect: "Berserker fury, +160% damage, +300 Strength" },
        "igris lance": { cost: { exp: 22000 }, type: "sword", level: 11, effect: "Knight commander force, +170% damage" },
        "rulers authority": { cost: { exp: 40000 }, type: "sword", level: 13, effect: "Ruler divine power, +250% damage, +1000 Mana" },
        "health potion": { cost: { exp: 200 }, type: "potion", amount: 1, effect: "Boosts Strength by 5" },
        "mana potion": { cost: { exp: 300 }, type: "potion", amount: 1, effect: "Boosts Mana by 5" },
        "strength potion": { cost: { exp: 500 }, type: "potion", amount: 1, effect: "Boosts Strength by 20" },
        "agility potion": { cost: { exp: 600 }, type: "potion", amount: 1, effect: "Boosts Agility by 20" },
        "mana regen potion": { cost: { exp: 700 }, type: "potion", amount: 1, effect: "Boosts Mana by 50" },
        "god mode potion": { cost: { exp: 1000000 }, type: "potion", amount: 1, limit: 5, effect: "Defeats all enemies instantly for 1 battle" },
      };

      const potionIdMap: { [id: string]: string } = {
        "1001": "health potion",
        "1002": "mana potion",
        "1003": "strength potion",
        "1004": "agility potion",
        "1005": "mana regen potion",
        "1006": "god mode potion",
      };
      const rawArgs = args.slice(1);
      const lastArg = rawArgs[rawArgs.length - 1];
      const parsedQty = parseInt(lastArg);
      let key: string;
      let quantity: number;
      if (!isNaN(parsedQty) && parsedQty > 0 && rawArgs.length > 1) {
        const inputId = rawArgs.slice(0, -1).join("").trim();
        quantity = parsedQty;

        if (potionIdMap[inputId]) {
          key = potionIdMap[inputId];
        } else {
          key = rawArgs.slice(0, -1).join(" ").toLowerCase().trim().replace(/_/g, " ");
        }
      } else {
        const inputId = rawArgs.join("").trim();
        quantity = 1;
        if (potionIdMap[inputId]) {
          key = potionIdMap[inputId];
        } else {
          key = rawArgs.join(" ").toLowerCase().trim().replace(/_/g, " ");
        }
      }
      if (!key || !shopItems[key] || quantity <= 0) {
        const invalidItem = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Shop",
          headerSymbol: "⚠️",
          headerStyle: "bold",
          bodyText: `Invalid item or quantity.\nFor swords: /sl buy <sword name> <qty>\nFor potions: /sl buy <potion ID> <qty>\nExample: /sl buy celestial blade 1\nExample: /sl buy 1001 2\n\nSee /sl shop for IDs.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(invalidItem, threadID, messageID);
        return;
      }
      const itemData = shopItems[key];
      const totalCost = itemData.cost.exp * quantity;
      userData.exp = Math.max(0, Number(userData.exp) || 0);
      if (userData.exp < totalCost) {
        const insufficientMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Shop",
          headerSymbol: "❌",
          headerStyle: "bold",
          bodyText: `Not enough EXP to buy ${quantity}x ${key}. Need ${totalCost} EXP, you have ${userData.exp} EXP.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(insufficientMessage, threadID, messageID);
        return;
      }

      const storageKey = itemData.type === "potion" ? key.replace(/ /g, "_") : key;
      if (itemData.limit && (userData.inventory.potions[storageKey] || 0) + quantity > itemData.limit) {
        const limitMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Shop",
          headerSymbol: "🛑",
          headerStyle: "bold",
          bodyText: `Limit reached for ${key}. Max allowed: ${itemData.limit}.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(limitMessage, threadID, messageID);
        return;
      }
      userData.exp -= totalCost;
      if (itemData.type === "sword") {
        userData.equipment.swords[key] = Math.max(1, Number(itemData.level) || 1);
      } else if (itemData.type === "potion") {
        userData.inventory.potions[storageKey] = Math.max(0, Number(userData.inventory.potions[storageKey] || 0)) + (itemData.amount || 1) * quantity;
        const potionEffects: { [k: string]: { strength?: number; agility?: number; mana?: number } } = {
          "health potion": { strength: 5 * quantity },
          "mana potion": { mana: 5 * quantity },
          "strength potion": { strength: 20 * quantity },
          "agility potion": { agility: 20 * quantity },
          "mana regen potion": { mana: 50 * quantity },
        };
        if (potionEffects[key]) {
          userData.stats.strength = Math.max(0, Number(userData.stats.strength) || 0) + (potionEffects[key].strength || 0);
          userData.stats.agility = Math.max(0, Number(userData.stats.agility) || 0) + (potionEffects[key].agility || 0);
          userData.stats.mana = Math.max(0, Number(userData.stats.mana) || 0) + (potionEffects[key].mana || 0);
        }
      }
      await saveHunterData(db, senderID.toString(), userData);
      const buyMessage = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Shop",
        headerSymbol: "✅",
        headerStyle: "bold",
        bodyText: `Purchased ${quantity}x ${key}!\n${itemData.effect || "Added to inventory."}\nCost: ${totalCost} EXP\nRemaining EXP: ${userData.exp}`,
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(buyMessage, threadID, messageID);
      return;
    }

    if (action === "battle") {
      if (args[1]?.toLowerCase() === "x") {
        if (userData.rank !== "X") {
          const restrictedMessage = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Battle X",
            headerSymbol: "🛑",
            headerStyle: "bold",
            bodyText: "Only X rank hunters can use /sl battle X!",
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(restrictedMessage, threadID, messageID);
          return;
        }
        const stats = userData.stats || { strength: 0, agility: 0, mana: 0 };
        const expGain = Math.max(0, Math.floor(Math.random() * 10000) + 5000);
        const enemy = "Supreme Monarch";
        userData.exp = Math.max(0, Number(userData.exp) || 0) + expGain;
        userData.level = Math.max(1, Math.floor(userData.exp / 1000) + 1);
        let battleXMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Battle X",
          headerSymbol: "🌑",
          headerStyle: "bold",
          bodyText: `X Rank Supremacy! Defeated ${enemy} instantly by ${userData.name}! Gained ${expGain} EXP. New Level: ${userData.level}, Rank: ${userData.rank}. Reply with 'arise ${enemy} <nickname>' to awaken this Shadow Monarch!`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        let sentMessageID;
        await new Promise((resolve) => {
          api.sendMessage(battleXMessage, threadID, (err, info) => {
            if (err) resolve(err);
            else {
              sentMessageID = info.messageID;
              resolve(info);
            }
          }, messageID);
        });
        if (!global.Kagenou.replyListeners) global.Kagenou.replyListeners = new Map();
        const handleReply = async ({ api, event }) => {
          const currentMsgID = sentMessageID;
          const { body } = event;
          const reply = body.toLowerCase().trim().split(" ");
          if (reply[0] === "arise" && reply[1]?.replace(/_/g, " ").toLowerCase() === "supreme monarch") {
            const nickname = reply.slice(2).join(" ") || "SupremeShadow";
            userData.stats.strength = Math.max(0, Number(userData.stats.strength) || 0) + 1000;
            userData.stats.agility = Math.max(0, Number(userData.stats.agility) || 0) + 1000;
            userData.stats.mana = Math.max(0, Number(userData.stats.mana) || 0) + 2000;
            userData.shadows.push({ name: "Supreme Monarch", nickname, level: 1 });
            await saveHunterData(db, senderID.toString(), userData);
            let nextMsgID: string;
            await new Promise<void>((resolve) => {
              api.sendMessage(
                AuroraBetaStyler.styleOutput({
                  headerText: "Solo Leveling Arise",
                  headerSymbol: "🌑",
                  headerStyle: "bold",
                  bodyText: `Awakened Supreme Monarch as ${nickname}! Gain +1000 Strength, +1000 Agility, +2000 Mana.\n\nReply to continue.`,
                  bodyStyle: "bold",
                  footerText: "Developed by: **Aljur pogoy**",
                }),
                threadID,
                (err: any, info: any) => { nextMsgID = info?.messageID; resolve(); },
                event.messageID
              );
            });
            global.Kagenou.replyListeners.set(nextMsgID, { callback: handleReply });
            global.Kagenou.replyListeners.delete(currentMsgID);
            sentMessageID = nextMsgID;
          }
        };
        global.Kagenou.replyListeners.set(sentMessageID, { callback: handleReply });
        await saveHunterData(db, senderID.toString(), userData);
        return;
      }

      if (userData.rank !== "X" && Math.random() < 0.4) {
        const stats = userData.stats || { strength: 0, agility: 0, mana: 0 };
        const userStrength = Math.max(1, Number(stats.strength) || 10);
        const normalEnemies = [
          "Kang Taeshik", "Kim Chul", "Yoo Jinho", "Lee Joohee", "Park Heejin",
          "Cha Hae-In", "Baek Yoonho", "Choi Jong-In", "Maharaga", "Igris",
          "Beru", "Tusk", "Baruka", "Cerberus", "Blood-Red Commander Igris",
          "High Orc", "Ice Bear", "Frost Giant", "Flame Bear"
        ];
        const shadowMonarchs = ["Kamish", "Ant King", "Monarch of Destruction", "Ruler's Shadow", "Ashborn"];
        const allEnemies = userData.rank === "S" ? [...normalEnemies, ...shadowMonarchs] : normalEnemies;
        const enemy = allEnemies[Math.floor(Math.random() * allEnemies.length)];
        const isMonarch = shadowMonarchs.includes(enemy);
        const enemyStrengthBase = isMonarch ? 200 : 50;
        const enemyStrength = Math.max(1, Math.floor(Math.random() * enemyStrengthBase * 0.4) + (userStrength * 0.67));
        let battleResult = userData.inventory.potions["god_mode_potion"] && userData.inventory.potions["god_mode_potion"] > 0 ? true : userStrength > enemyStrength;
        let expGain = Math.max(0, Math.floor(Math.random() * (isMonarch ? 1000 : 500)) + (isMonarch ? 500 : 100));
        userData.exp = Math.max(0, Number(userData.exp) || 0) + expGain;

        if (battleResult) {
          if (userData.inventory.potions["god_mode_potion"] && userData.inventory.potions["god_mode_potion"] > 0) {
            userData.inventory.potions["god_mode_potion"] -= 1;
            if (userData.inventory.potions["god_mode_potion"] <= 0) delete userData.inventory.potions["god_mode_potion"];
            expGain = Math.max(0, Math.floor(Math.random() * 10000) + 5000);
            const godModeMessage = AuroraBetaStyler.styleOutput({
              headerText: "Solo Leveling Battle",
              headerSymbol: "✨",
              headerStyle: "bold",
              bodyText: `God Mode Activated! All enemies defeated instantly by ${userData.name}! Gained ${expGain} EXP. New Level: ${userData.level}, Rank: ${userData.rank}.`,
              bodyStyle: "bold",
              footerText: "Developed by: **Aljur pogoy**",
            });
            await saveHunterData(db, senderID.toString(), userData);
            await api.sendMessage(godModeMessage, threadID, messageID);
            return;
          }
          userData.battleWins = (userData.battleWins || 0) + 1;
          const newTitlesBattle = checkAndGrantTitles(userData);
          const titleLineBattle = newTitlesBattle.length > 0
            ? "\n\n🎖️ New Title(s) Unlocked: " + newTitlesBattle.map((id: string) => TITLE_DEFS.find(t => t.id === id)?.label || id).join(", ")
            : "";
          let battleMessage = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Battle",
            headerSymbol: "⚔️",
            headerStyle: "bold",
            bodyText: `Victory! You defeated ${enemy} with strength ${userStrength} vs ${enemyStrength}! Gained ${expGain} EXP. New Level: ${userData.level}, Rank: ${userData.rank}.${titleLineBattle}`,
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });

          if (userData.rank === "S" && isMonarch) {
            battleMessage = AuroraBetaStyler.styleOutput({
              headerText: "Solo Leveling Battle",
              headerSymbol: "⚔️",
              headerStyle: "bold",
              bodyText: `Victory! You defeated ${enemy} with strength ${userStrength} vs ${enemyStrength}! Gained ${expGain} EXP. New Level: ${userData.level}, Rank: ${userData.rank}. Reply with 'arise ${enemy} <nickname>' to awaken this Shadow Monarch!${titleLineBattle}`,
              bodyStyle: "bold",
              footerText: "Developed by: **Aljur pogoy**",
            });
            let sentMessageID;
            await new Promise((resolve) => {
              api.sendMessage(battleMessage, threadID, (err, info) => {
                if (err) resolve(err);
                else {
                  sentMessageID = info.messageID;
                  resolve(info);
                }
              }, messageID);
            });
            if (!global.Kagenou.replyListeners) global.Kagenou.replyListeners = new Map();
            const handleReply = async ({ api, event }) => {
              const currentMsgID = sentMessageID;
              const { body } = event;
              const reply = body.toLowerCase().trim().split(" ");
              if (reply[0] === "arise") {
                const inputEnemy = reply[1]?.replace(/_/g, " ");
                const normalizedEnemy = shadowMonarchs.find(m => m.toLowerCase() === inputEnemy);
                if (normalizedEnemy) {
                  const nickname = reply.slice(2).join(" ") || `${normalizedEnemy.toLowerCase()}Shadow`;
                  const statBoosts = {
                    "Kamish": { strength: 100, agility: 50, mana: 200 },
                    "Ant King": { strength: 150, mana: 200 },
                    "Monarch of Destruction": { agility: 100, mana: 300 },
                    "Ruler's Shadow": { strength: 200, agility: 50 },
                    "Ashborn": { strength: 500, agility: 500, mana: 1000 }
                  };
                  const boosts = statBoosts[normalizedEnemy] || { strength: 20, agility: 20, mana: 20 };
                  userData.stats.strength = Math.max(0, Number(userData.stats.strength) || 0) + boosts.strength;
                  userData.stats.agility = Math.max(0, Number(userData.stats.agility) || 0) + boosts.agility;
                  userData.stats.mana = Math.max(0, Number(userData.stats.mana) || 0) + boosts.mana;
                  userData.shadows.push({ name: normalizedEnemy, nickname, level: 1 });
                  await saveHunterData(db, senderID.toString(), userData);
                  let nextMsgID: string;
                  await new Promise<void>((resolve) => {
                    api.sendMessage(
                      AuroraBetaStyler.styleOutput({
                        headerText: "Solo Leveling Arise",
                        headerSymbol: "🌑",
                        headerStyle: "bold",
                        bodyText: `Awakened ${normalizedEnemy} as ${nickname}! Gain ${boosts.strength} Strength, ${boosts.agility} Agility, ${boosts.mana} Mana.\n\nReply to continue.`,
                        bodyStyle: "bold",
                        footerText: "Developed by: **Aljur pogoy**",
                      }),
                      threadID,
                      (err: any, info: any) => { nextMsgID = info?.messageID; resolve(); },
                      event.messageID
                    );
                  });
                  global.Kagenou.replyListeners.set(nextMsgID, { callback: handleReply });
                  global.Kagenou.replyListeners.delete(currentMsgID);
                  sentMessageID = nextMsgID;
                }
              }
            };
            global.Kagenou.replyListeners.set(sentMessageID, { callback: handleReply });
          } else {
            await saveHunterData(db, senderID.toString(), userData);
            await api.sendMessage(battleMessage, threadID, messageID);
          }
        } else {
          const battleMessage = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Battle",
            headerSymbol: "💥",
            headerStyle: "bold",
            bodyText: `Defeated by ${enemy} (strength ${enemyStrength} vs ${userStrength}). Gained ${expGain} EXP. New Level: ${userData.level}, Rank: ${userData.rank}. Train harder!`,
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await saveHunterData(db, senderID.toString(), userData);
          await api.sendMessage(battleMessage, threadID, messageID);
        }
      } else if (userData.rank === "X") {
        const expGain = Math.max(0, Math.floor(Math.random() * 5000) + 2000);
        userData.exp = Math.max(0, Number(userData.exp) || 0) + expGain;
        userData.level = Math.max(1, Math.floor(userData.exp / 1000) + 1);
        const battleMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Battle",
          headerSymbol: "⚔️",
          headerStyle: "bold",
          bodyText: `X Rank Dominance! All enemies defeated instantly! Gained ${expGain} EXP. New Level: ${userData.level}, Rank: ${userData.rank}.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await saveHunterData(db, senderID.toString(), userData);
        await api.sendMessage(battleMessage, threadID, messageID);
      } else {
        const stats = userData.stats || { strength: 0, agility: 0, mana: 0 };
        userData.exp += 100;
        stats.agility = Math.max(0, Number(stats.agility) || 0) + 100;
        stats.mana = Math.max(0, Number(stats.mana) || 0) + 100;
        userData.stats = stats;
        userData.level = Math.max(1, Math.floor(userData.exp / 1000) + 1);
        const noEncounterMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Battle",
          headerSymbol: "ℹ️",
          headerStyle: "bold",
          bodyText: "No enemies encountered this time. Gained 100 EXP, 100 Agility, and 100 Mana! New Level: " + userData.level,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await saveHunterData(db, senderID.toString(), userData);
        await api.sendMessage(noEncounterMessage, threadID, messageID);
      }
      return;
    }

    if (action === "dungeon") {
      const subAction = args[1]?.toLowerCase();
      if (subAction === "status") {
        const remaining = Math.max(0, Number(userData.dungeonCooldown) || 0) > currentTime ? Math.ceil((Math.max(0, Number(userData.dungeonCooldown) || 0) - currentTime) / 60) : 0;
        const statusMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Dungeon Status",
          headerSymbol: "🏰",
          headerStyle: "bold",
          bodyText: `Last Tier: ${userData.rank || "E"}\nCooldown: ${remaining} mins\nMaterials: ${Object.entries(userData.inventory.materials || {}).map(([k, v]) => `${k} x${Math.max(0, Number(v) || 0)}`).join(", ") || "None"}`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(statusMessage, threadID, messageID);
        return;
      }
      const tier = subAction?.toUpperCase();
      const tiers = ["D", "C", "B", "A", "S"];
      if (!tier || !tiers.includes(tier)) {
        const invalidTier = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Dungeon",
          headerSymbol: "⚠️",
          headerStyle: "bold",
          bodyText: "Invalid tier. Use /sl dungeon <tier> (D, C, B, A, S).",
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(invalidTier, threadID, messageID);
        return;
      }
      if (Math.max(0, Number(userData.dungeonCooldown) || 0) > currentTime) {
        const remaining = Math.max(0, Number(userData.dungeonCooldown) || 0) - currentTime;
        const cooldownMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Dungeon",
          headerSymbol: "⏳",
          headerStyle: "bold",
          bodyText: `Cooldown active. Wait ${Math.ceil(remaining / 60)} minutes.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(cooldownMessage, threadID, messageID);
        return;
      }
      const rewards = {
        D: { exp: 500, materials: { "iron_ore": 2, "mana_crystal": 1 } },
        C: { exp: 1000, materials: { "iron_ore": 3, "mana_crystal": 2 } },
        B: { exp: 1500, materials: { "mythril": 2, "mana_crystal": 3 } },
        A: { exp: 2000, materials: { "mythril": 3, "dragon_scale": 1 } },
        S: { exp: 3000, materials: { "dragon_scale": 2, "shadow_essence": 1 } },
      };
      const expGain = Math.max(0, Math.floor(Math.random() * rewards[tier].exp) + rewards[tier].exp / 2);
      userData.exp = Math.max(0, Number(userData.exp) || 0) + expGain;
      userData.level = Math.max(1, Math.floor(userData.exp / 1000) + 1);
      for (const [material, qty] of Object.entries(rewards[tier].materials)) {
        userData.inventory.materials[material] = Math.max(0, Number(userData.inventory.materials[material] || 0)) + Number(qty);
      }
      userData.dungeonCooldown = currentTime + dungeonCooldown;
      userData.dungeonClears = (userData.dungeonClears || 0) + 1;

      let ddHint = "";
      if (!userData.doubleDungeonUnlocked && Math.random() < 0.10) {
        userData.doubleDungeonUnlocked = true;
        ddHint = "\n\n⚠️ A hidden door pulses with dark energy behind you... Use /sl doubledungeon to investigate!";
      }
      applyRankProgression(userData);
      await saveHunterData(db, senderID.toString(), userData);
      const materialList = Object.entries(rewards[tier].materials).map(([k, v]) => `${k.replace("_", " ")} x${v}`).join(", ");
      const dungeonMessage = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Dungeon",
        headerSymbol: "🏰",
        headerStyle: "bold",
        bodyText: `Cleared ${tier}-tier dungeon! Gained ${expGain} EXP and ${materialList}. New Level: ${userData.level}, Rank: ${userData.rank}.${ddHint}`,
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(dungeonMessage, threadID, messageID);
      return;
    }

    if (action === "train") {
      const stat = args[1]?.toLowerCase();
      const validStats = ["strength", "agility", "mana"];
      if (!stat || !validStats.includes(stat)) {
        const invalidStat = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Train",
          headerSymbol: "⚠️",
          headerStyle: "bold",
          bodyText: "Invalid stat. Use /sl train <strength/agility/mana>.",
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(invalidStat, threadID, messageID);
        return;
      }
      const stats = userData.stats || { strength: 0, agility: 0, mana: 0 };
      stats[stat] = Math.max(0, Number(stats[stat]) || 0) + 10;
      userData.stats = stats;
      userData.exp = Math.max(0, Number(userData.exp) || 0) + 50;
      userData.level = Math.max(1, Math.floor(userData.exp / 1000) + 1);
      applyRankProgression(userData);
      await saveHunterData(db, senderID.toString(), userData);
      const trainMessage = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Train",
        headerSymbol: "💪",
        headerStyle: "bold",
        bodyText: `Trained ${stat}! +10 ${stat}, +50 EXP. New ${stat}: ${stats[stat]}. New Level: ${userData.level}, Rank: ${userData.rank}.`,
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(trainMessage, threadID, messageID);
      return;
    }

    if (action === "quest") {
      const quests = {
        "kill_10_enemies": { goal: 10, reward: 500, description: "Kill 10 enemies in battle." },
        "clear_dungeon_C": { goal: 1, reward: 1000, description: "Clear a C-tier dungeon." },
        "train_5_times": { goal: 5, reward: 300, description: "Train any stat 5 times." },
      };
      if (!userData.quests["kill_10_enemies"]) {
  userData.quests["kill_10_enemies"] = { goal: 10, progress: 0, reward: 500, completed: false, description: "Kill 10 enemies in battle." };
  userData.quests["clear_dungeon_C"] = { goal: 1, progress: 0, reward: 1000, completed: false, description: "Clear a C-tier dungeon." };
  userData.quests["train_5_times"] = { goal: 5, progress: 0, reward: 300, completed: false, description: "Train any stat 5 times." };
}
      const questList = Object.entries(userData.quests).map(([key, q]) => {
        return `${key.replace("_", " ")}: ${q.description} (${q.progress}/${q.goal}) ${q.completed ? "[Completed]" : ""}`;
      }).join("\n");
      const questMessage = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Quests",
        headerSymbol: "📜",
        headerStyle: "bold",
        bodyText: `Available Quests:\n${questList}`,
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(questMessage, threadID, messageID);
      return;
    }

    if (action === "guild") {
      const subAction = args[1]?.toLowerCase();
      const guildCollection = db.db("guilds");
      const guilds = await guildCollection.find({ isSeason2: { $ne: true } }).toArray();

      if (subAction === "create") {
        const guildName = args.slice(2).join(" ") || `Guild${Math.floor(Math.random() * 1000)}`;
        if (userData.guild) {
          const alreadyInGuild = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Guild",
            headerSymbol: "🛑",
            headerStyle: "bold",
            bodyText: `Already in ${userData.guild}. Leave to create a new one.`,
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(alreadyInGuild, threadID, messageID);
          return;
        }
        if (guilds.some(g => g.name === guildName)) {
          const guildExists = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Guild",
            headerSymbol: "⚠️",
            headerStyle: "bold",
            bodyText: `Guild ${guildName} already exists. Join it instead!`,
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(guildExists, threadID, messageID);
          return;
        }
        userData.guild = guildName;
        const stats = userData.stats || { strength: 0, agility: 0, mana: 0 };
        const baseStrength = Math.max(0, Number(stats.strength) || 0);
        await guildCollection.insertOne({ name: guildName, members: [senderID.toString()], totalStrength: baseStrength + 50, hasChangedName: false, isSeason2: false });
        await saveHunterData(db, senderID.toString(), userData);
        const createMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Guild",
          headerSymbol: "🛡️",
          headerStyle: "bold",
          bodyText: `Created Guild: ${guildName}. +50 Group Strength.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(createMessage, threadID, messageID);
        return;
      }

      if (subAction === "join") {
        const guildName = args.slice(2).join(" ");
        if (!guildName) {
          const noGuildName = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Guild",
            headerSymbol: "⚠️",
            headerStyle: "bold",
            bodyText: "Please specify a guild name. Usage: /sl guild join <guild name>",
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(noGuildName, threadID, messageID);
          return;
        }
        if (userData.guild) {
          const alreadyInGuild = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Guild",
            headerSymbol: "🛑",
            headerStyle: "bold",
            bodyText: `Already in ${userData.guild}. Leave to join another.`,
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(alreadyInGuild, threadID, messageID);
          return;
        }
        const targetGuild = guilds.find(g => g.name === guildName);
        if (!targetGuild) {
          const guildNotFound = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Guild",
            headerSymbol: "❌",
            headerStyle: "bold",
            bodyText: `Guild ${guildName} does not exist.`,
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(guildNotFound, threadID, messageID);
          return;
        }
        userData.guild = guildName;
        const stats = userData.stats || { strength: 0, agility: 0, mana: 0 };
        targetGuild.members.push(senderID.toString());
        targetGuild.totalStrength = Math.max(0, Number(targetGuild.totalStrength) || 0) + Math.max(0, Number(stats.strength) || 0);
        await guildCollection.updateOne({ name: guildName, isSeason2: false }, { $set: targetGuild });
        await saveHunterData(db, senderID.toString(), userData);
        const joinMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Guild",
          headerSymbol: "✅",
          headerStyle: "bold",
          bodyText: `Joined ${guildName}! Added ${Math.max(0, Number(stats.strength) || 0)} to guild strength.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(joinMessage, threadID, messageID);
        return;
      }

      if (subAction === "leave") {
        if (!userData.guild) {
          const noGuild = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Guild",
            headerSymbol: "❌",
            headerStyle: "bold",
            bodyText: "You are not in a guild to leave!",
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(noGuild, threadID, messageID);
          return;
        }
        const currentGuild = guilds.find(g => g.name === userData.guild);
        if (!currentGuild) {
          userData.guild = undefined;
          await saveHunterData(db, senderID.toString(), userData);
          const noGuildFound = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Guild",
            headerSymbol: "ℹ️",
            headerStyle: "bold",
            bodyText: "Your guild no longer exists. You have been removed.",
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(noGuildFound, threadID, messageID);
          return;
        }
        const stats = userData.stats || { strength: 0, agility: 0, mana: 0 };
        const memberStrength = Math.max(0, Number(stats.strength) || 0);
        currentGuild.members = currentGuild.members.filter(member => member !== senderID.toString());
        currentGuild.totalStrength = Math.max(0, currentGuild.totalStrength - memberStrength);
        await guildCollection.updateOne({ name: currentGuild.name, isSeason2: false }, { $set: currentGuild });
        userData.guild = undefined;
        await saveHunterData(db, senderID.toString(), userData);
        const leaveMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Guild",
          headerSymbol: "🚪",
          headerStyle: "bold",
          bodyText: `You have left ${currentGuild.name}.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(leaveMessage, threadID, messageID);
        return;
      }

      if (subAction === "fight") {
        const targetGuildName = args.slice(2).join(" ");
        if (!userData.guild) {
          const noGuild = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Guild",
            headerSymbol: "❌",
            headerStyle: "bold",
            bodyText: "You must be in a guild to fight!",
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(noGuild, threadID, messageID);
          return;
        }
        if (!targetGuildName) {
          const noTarget = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Guild",
            headerSymbol: "⚠️",
            headerStyle: "bold",
            bodyText: "Please specify a guild to fight. Usage: /sl guild fight <guild name>",
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(noTarget, threadID, messageID);
          return;
        }
        const myGuild = guilds.find(g => g.name === userData.guild);
        const targetGuild = guilds.find(g => g.name === targetGuildName);
        if (!targetGuild || myGuild.name === targetGuild.name) {
          const invalidTarget = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Guild",
            headerSymbol: "⚠️",
            headerStyle: "bold",
            bodyText: "Invalid target guild or you can't fight your own guild!",
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(invalidTarget, threadID, messageID);
          return;
        }
        const myStrength = Math.max(0, Number(myGuild.totalStrength) || 0);
        const targetStrength = Math.max(0, Number(targetGuild.totalStrength) || 0);
        const fightResult = myStrength > targetStrength || userData.rank === "X";
        if (fightResult) {
          userData.exp = Math.max(0, Number(userData.exp) || 0) + 1000;
          userData.level = Math.max(1, Math.floor(userData.exp / 1000) + 1);
          applyRankProgression(userData);
          await saveHunterData(db, senderID.toString(), userData);
          const fightMessage = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Guild Fight",
            headerSymbol: "⚔️",
            headerStyle: "bold",
            bodyText: `Victory! ${myGuild.name} defeated ${targetGuild.name} (${myStrength} vs ${targetStrength})! Gained 1000 EXP. New Level: ${userData.level}, Rank: ${userData.rank}.`,
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(fightMessage, threadID, messageID);
        } else {
          const fightMessage = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Guild Fight",
            headerSymbol: "💥",
            headerStyle: "bold",
            bodyText: `Defeated! ${myGuild.name} lost to ${targetGuild.name} (${myStrength} vs ${targetStrength}). Train harder!`,
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(fightMessage, threadID, messageID);
        }
        return;
      }

      if (subAction === "list") {
        if (guilds.length === 0) {
          const noGuilds = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Guild",
            headerSymbol: "ℹ️",
            headerStyle: "bold",
            bodyText: "No guilds have been created yet.",
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(noGuilds, threadID, messageID);
          return;
        }
        const guildList = guilds.map(g => `- ${g.name}: ${Math.max(0, Number(g.totalStrength) || 0)} Total Strength`).join("\n");
        const listMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Guild List",
          headerSymbol: "🛡️",
          headerStyle: "bold",
          bodyText: `Active Guilds:\n${guildList}`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(listMessage, threadID, messageID);
        return;
      }

      if (subAction === "changename") {
        const newGuildName = args.slice(2).join(" ");
        if (!userData.guild) {
          const noGuild = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Guild",
            headerSymbol: "❌",
            headerStyle: "bold",
            bodyText: "You must be in a guild to change its name!",
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(noGuild, threadID, messageID);
          return;
        }
        if (!newGuildName) {
          const invalidInput = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Guild",
            headerSymbol: "⚠️",
            headerStyle: "bold",
            bodyText: "Please specify a new guild name. Usage: /sl guild changename <new name>",
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(invalidInput, threadID, messageID);
          return;
        }
        const currentGuild = guilds.find(g => g.name === userData.guild);
        if (!currentGuild) {
          userData.guild = undefined;
          await saveHunterData(db, senderID.toString(), userData);
          const noGuildFound = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Guild",
            headerSymbol: "ℹ️",
            headerStyle: "bold",
            bodyText: "Your guild no longer exists. You have been removed.",
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(noGuildFound, threadID, messageID);
          return;
        }
        if (currentGuild.hasChangedName) {
          const alreadyChanged = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Guild",
            headerSymbol: "🛑",
            headerStyle: "bold",
            bodyText: `Guild ${currentGuild.name} has already changed its name once.`,
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(alreadyChanged, threadID, messageID);
          return;
        }
        if (guilds.some(g => g.name.toLowerCase() === newGuildName.toLowerCase())) {
          const nameTaken = AuroraBetaStyler.styleOutput({
            headerText: "Solo Leveling Guild",
            headerSymbol: "⚠️",
            headerStyle: "bold",
            bodyText: `Guild name ${newGuildName} is already taken.`,
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          });
          await api.sendMessage(nameTaken, threadID, messageID);
          return;
        }
        await guildCollection.updateOne(
          { name: currentGuild.name, isSeason2: false },
          { $set: { name: newGuildName, hasChangedName: true } }
        );
        const huntersCollection = db.db("hunters");
        await huntersCollection.updateMany(
          { guild: currentGuild.name },
          { $set: { guild: newGuildName } }
        );
        userData.guild = newGuildName;
        await saveHunterData(db, senderID.toString(), userData);
        const changeNameMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Guild",
          headerSymbol: "✅",
          headerStyle: "bold",
          bodyText: `Guild name changed from ${currentGuild.name} to ${newGuildName}.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(changeNameMessage, threadID, messageID);
        return;
      }

      const invalidGuildCommand = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Guild",
        headerSymbol: "⚠️",
        headerStyle: "bold",
        bodyText: "Invalid guild command. Use /sl guild [create <name> | join <guild name> | leave | fight <guild name> | list | changename <new name>].",
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(invalidGuildCommand, threadID, messageID);
      return;
    }

    if (action === "meditate") {
      if (Math.max(0, Number(userData.meditateCooldown) || 0) > currentTime) {
        const remaining = Math.max(0, Number(userData.meditateCooldown) || 0) - currentTime;
        const cooldownMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Meditate",
          headerSymbol: "⏳",
          headerStyle: "bold",
          bodyText: `Cooldown active. Wait ${Math.ceil(remaining / 60)} minutes.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(cooldownMessage, threadID, messageID);
        return;
      }
      const stats = userData.stats || { strength: 0, agility: 0, mana: 0 };
      stats.mana = Math.max(0, Number(stats.mana) || 0) + 50;
      userData.stats = stats;
      userData.meditateCooldown = currentTime + meditateCooldown;
      await saveHunterData(db, senderID.toString(), userData);
      const meditateMessage = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Meditate",
        headerSymbol: "🧘",
        headerStyle: "bold",
        bodyText: `Meditated successfully! +50 Mana. New Mana: ${stats.mana}.`,
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(meditateMessage, threadID, messageID);
      return;
    }

    if (action === "shadowlist") {
      const shadowList = userData.shadows.length > 0
        ? userData.shadows.map(s => `- ${s.name} (${s.nickname}, Level ${Math.max(1, Number(s.level) || 1)})`).join("\n")
        : "No shadows summoned.";
      const lostShadowList = userData.lostShadows && userData.lostShadows.length > 0
        ? userData.lostShadows.map(s => `- ${s.name} (${s.nickname})`).join("\n")
        : "No shadows lost.";
      const shadowMessage = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Shadow List",
        headerSymbol: "🌑",
        headerStyle: "bold",
        bodyText: `Current Shadows:\n${shadowList}\n\nLost Shadows:\n${lostShadowList}`,
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(shadowMessage, threadID, messageID);
      return;
    }

    if (action === "setrole") {
      const role = args[1]?.toLowerCase();
      const validRoles = ["tank", "mage", "assassin", "healer", "ranger"];
      if (!role || !validRoles.includes(role)) {
        const invalidRole = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Set Role",
          headerSymbol: "⚠️",
          headerStyle: "bold",
          bodyText: "Invalid role. Use /sl setrole <tank/mage/assassin/healer/ranger>.",
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(invalidRole, threadID, messageID);
        return;
      }
      userData.role = role;
      applyRoleSkills(userData);
      await saveHunterData(db, senderID.toString(), userData);
      const roleMessage = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Set Role",
        headerSymbol: "✅",
        headerStyle: "bold",
        bodyText: `Role set to ${role}. Skills applied based on rank ${userData.rank}.`,
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(roleMessage, threadID, messageID);
      return;
    }

    if (action === "changename") {
      const newName = args.slice(1).join(" ");
      if (!newName) {
        const invalidName = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Change Name",
          headerSymbol: "⚠️",
          headerStyle: "bold",
          bodyText: "Please provide a new name. Usage: /sl changename <newname>",
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(invalidName, threadID, messageID);
        return;
      }
      if (userData.hasChangedName) {
        const alreadyChanged = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Change Name",
          headerSymbol: "🛑",
          headerStyle: "bold",
          bodyText: "You can only change your name once!",
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(alreadyChanged, threadID, messageID);
        return;
      }
      const huntersCollection = db.db("hunters");
      const existingHunter = await huntersCollection.findOne({ name: newName });
      if (existingHunter) {
        const nameTaken = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Change Name",
          headerSymbol: "⚠️",
          headerStyle: "bold",
          bodyText: `The name "${newName}" is already taken. Choose another.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(nameTaken, threadID, messageID);
        return;
      }
      userData.name = newName;
      userData.hasChangedName = true;
      await saveHunterData(db, senderID.toString(), userData);
      const changeNameMessage = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Change Name",
        headerSymbol: "✅",
        headerStyle: "bold",
        bodyText: `Name changed to ${newName}.`,
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(changeNameMessage, threadID, messageID);
      return;
    }

if (action === "customize" && args[1]?.toLowerCase() === "set") {
  const senderIDStr = senderID.toString();
  const isAuthorized =
    (global.config.vips && global.config.vips.map(String).includes(senderIDStr)) ||
    (global.config.developers && global.config.developers.map(String).includes(senderIDStr)) ||
    (global.config.admins && global.config.admins.map(String).includes(senderIDStr));

  if (!isAuthorized) {
    const permissionDenied = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Customize",
      headerSymbol: "❌",
      headerStyle: "bold",
      bodyText: "Only VIPs, Developers, or Admins can use this command.",
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(permissionDenied, threadID, messageID);
    return;
  }

  const targetName = args[2];
  const newName = args[3];
  const newRank = args[4]?.toUpperCase();
  const newLevel = parseInt(args[5]);
  const newRole = args[6]?.toLowerCase();
  const newStats = parseInt(args[7]);
  const newExp = parseInt(args[8]);
  const newEquipment = args[9];
  const newGuildName = args[10];
  const guildLevel = 9000000;

  if (!targetName || !newName || !newRank || isNaN(newLevel) || !newRole || isNaN(newStats) || isNaN(newExp) || !newEquipment || !newGuildName) {
    const invalidInput = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Customize",
      headerSymbol: "⚠️",
      headerStyle: "bold",
      bodyText: "Invalid input. Usage: /sl customize set <user name> <name> <rank> <level> <role> <stats> <exp> <equipment> <guild_name>",
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(invalidInput, threadID, messageID);
    return;
  }

  const huntersCollection = db?.db("hunters");
  if (!huntersCollection) {
    const dbError = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Customize",
      headerSymbol: "❌",
      headerStyle: "bold",
      bodyText: "Database not available. Please try again later.",
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(dbError, threadID, messageID);
    return;
  }

  const targetHunter = await huntersCollection.findOne({ name: targetName });
  if (!targetHunter) {
    const notFound = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Customize",
      headerSymbol: "⚠️",
      headerStyle: "bold",
      bodyText: `User with name "${targetName}" not found.`,
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(notFound, threadID, messageID);
    return;
  }

  const validRanks = ["E", "D", "C", "B", "A", "S", "X"];
  if (!newRank || !validRanks.includes(newRank)) {
    const invalidRank = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Customize",
      headerSymbol: "⚠️",
      headerStyle: "bold",
      bodyText: "Invalid rank. Must be one of: E, D, C, B, A, S, X.",
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(invalidRank, threadID, messageID);
    return;
  }

  if (newLevel < 1) {
    const invalidLevel = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Customize",
      headerSymbol: "⚠️",
      headerStyle: "bold",
      bodyText: "Level must be a positive number.",
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(invalidLevel, threadID, messageID);
    return;
  }

  const validRoles = ["tank", "mage", "assassin", "healer", "ranger"];
  if (!newRole || !validRoles.includes(newRole)) {
    const invalidRole = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Customize",
      headerSymbol: "⚠️",
      headerStyle: "bold",
      bodyText: "Invalid role. Must be one of: tank, mage, assassin, healer, ranger.",
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(invalidRole, threadID, messageID);
    return;
  }

  if (newStats < 0) {
    const invalidStats = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Customize",
      headerSymbol: "⚠️",
      headerStyle: "bold",
      bodyText: "Stats value must be non-negative.",
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(invalidStats, threadID, messageID);
    return;
  }

  if (newExp < 0) {
    const invalidExp = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Customize",
      headerSymbol: "⚠️",
      headerStyle: "bold",
      bodyText: "EXP must be a non-negative number.",
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(invalidExp, threadID, messageID);
    return;
  }

  const existingHunter = await huntersCollection.findOne({ name: newName });
  if (existingHunter && existingHunter.userID !== targetHunter.userID) {
    const nameTaken = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Customize",
      headerSymbol: "⚠️",
      headerStyle: "bold",
      bodyText: `The name "${newName}" is already taken. Choose another.`,
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(nameTaken, threadID, messageID);
    return;
  }

  const guildCollection = db?.db("guilds");
  if (!guildCollection) {
    const dbError = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Customize",
      headerSymbol: "❌",
      headerStyle: "bold",
      bodyText: "Database not available. Please try again later.",
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(dbError, threadID, messageID);
    return;
  }

  let guildData = await guildCollection.findOne({ name: newGuildName, isSeason2: false });
  if (!guildData) {
    guildData = {
      name: newGuildName,
      members: [targetHunter.userID],
      totalStrength: newStats,
      hasChangedName: false,
      isSeason2: false,
      level: guildLevel,
    };
    await guildCollection.insertOne(guildData);
  } else if (!guildData.members.includes(targetHunter.userID)) {
    guildData.members.push(targetHunter.userID);
    guildData.totalStrength = Math.max(0, Number(guildData.totalStrength) || 0) + newStats;
    guildData.level = guildLevel;
    await guildCollection.updateOne(
      { name: newGuildName, isSeason2: false },
      { $set: guildData }
    );
  }

  const targetUserData = usersData.get(targetHunter.userID) || {};
  targetUserData.name = newName;
  targetUserData.rank = newRank;
  targetUserData.level = newLevel;
  targetUserData.role = newRole;
  targetUserData.stats = { strength: newStats, agility: newStats, mana: newStats };
  targetUserData.exp = newExp;
  targetUserData.equipment = targetUserData.equipment || { swords: {} };
  targetUserData.equipment.swords = { [newEquipment.replace(/\s+/g, "_").toLowerCase()]: 1000000000 };
  targetUserData.guild = newGuildName;
  targetUserData.hasChangedName = true;
  applyRoleSkills(targetUserData);
  await saveHunterData(db, targetHunter.userID, targetUserData);
  usersData.set(targetHunter.userID, targetUserData);

  const customizeMessage = AuroraBetaStyler.styleOutput({
    headerText: "Solo Leveling Customize",
    headerSymbol: "✅",
    headerStyle: "bold",
    bodyText: `Customized hunter "${targetName}":\nName: ${newName}\nRank: ${newRank}\nLevel: ${newLevel}\nRole: ${newRole}\nStats: Strength ${newStats}, Agility ${newStats}, Mana ${newStats}\nEXP: ${newExp}\nEquipment: ${newEquipment} (1B damage)\nGuild: ${newGuildName} (Level ${guildLevel})`,
    bodyStyle: "bold",
    footerText: "Developed by: **Aljur pogoy**",
  });
  await api.sendMessage(customizeMessage, threadID, messageID);
  return;
}

    if (action === "gate" && args[1]?.toLowerCase() === "enter") {
      const gateClass = args[2]?.toLowerCase();
      const validClasses = ["blue", "red", "violet", "orange"];
      if (!gateClass || !validClasses.includes(gateClass)) {
        const invalidClass = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Gate",
          headerSymbol: "⚠️",
          headerStyle: "bold",
          bodyText: "Invalid gate class. Use /sl gate enter <blue/red/violet/orange>.",
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(invalidClass, threadID, messageID);
        return;
      }
      if (Math.max(0, Number(userData.gateCooldown) || 0) > currentTime) {
        const remaining = Math.max(0, Number(userData.gateCooldown) || 0) - currentTime;
        const cooldownMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Gate",
          headerSymbol: "⏳",
          headerStyle: "bold",
          bodyText: `Cooldown active. Wait ${Math.ceil(remaining / 60)} minutes.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(cooldownMessage, threadID, messageID);
        return;
      }
      userData.exp = Math.max(0, Number(userData.exp) || 0) + 3000;
      userData.level = Math.max(1, Math.floor(userData.exp / 1000) + 1);
      userData.gateCooldown = currentTime + gateCooldown;
      applyRankProgression(userData);
      await saveHunterData(db, senderID.toString(), userData);
      const gateMessage = AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Gate",
        headerSymbol: "🌌",
        headerStyle: "bold",
        bodyText: `Cleared ${gateClass} gate! Gained 3000 EXP. New Level: ${userData.level}, Rank: ${userData.rank}.`,
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      });
      await api.sendMessage(gateMessage, threadID, messageID);
      return;
    }
      
const disabledUsersCollection = db?.db("disabledUsers");
if (disabledUsersCollection) {
  const disabledUser = await disabledUsersCollection.findOne({ userID: senderID.toString() });
  if (disabledUser) {
    const disabledMessage = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling",
      headerSymbol: "❌",
      headerStyle: "bold",
      bodyText: "You are disabled from using Solo Leveling commands.",
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(disabledMessage, threadID, messageID);
    return;
  }
}

if (action === "disabled") {
  const senderIDStr = senderID.toString();
  const isAuthorized =
    (global.config.vips && global.config.vips.map(String).includes(senderIDStr)) ||
    (global.config.developers && global.config.developers.map(String).includes(senderIDStr)) ||
    (global.config.admins && global.config.admins.map(String).includes(senderIDStr));

  if (!isAuthorized) {
    const permissionDenied = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Disable",
      headerSymbol: "❌",
      headerStyle: "bold",
      bodyText: "Only VIPs, Developers, or Admins can use this command.",
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(permissionDenied, threadID, messageID);
    return;
  }

  const targetName = args[1];
  if (!targetName) {
    const invalidInput = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Disable",
      headerSymbol: "⚠️",
      headerStyle: "bold",
      bodyText: "Please provide a user name. Usage: /sl disabled <name>",
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(invalidInput, threadID, messageID);
    return;
  }

  const huntersCollection = db?.db("hunters");
  const disabledUsersCollection = db?.db("disabledUsers");
  if (!huntersCollection || !disabledUsersCollection) {
    const dbError = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Disable",
      headerSymbol: "❌",
      headerStyle: "bold",
      bodyText: "Database not available. Please try again later.",
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(dbError, threadID, messageID);
    return;
  }

  const targetHunter = await huntersCollection.findOne({ name: targetName });
  if (!targetHunter) {
    const notFound = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Disable",
      headerSymbol: "⚠️",
      headerStyle: "bold",
      bodyText: `User with name "${targetName}" not found.`,
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(notFound, threadID, messageID);
    return;
  }

  const targetUserID = targetHunter.userID;
  const alreadyDisabled = await disabledUsersCollection.findOne({ userID: targetUserID });
  if (alreadyDisabled) {
    const alreadyDisabledMessage = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Disable",
      headerSymbol: "⚠️",
      headerStyle: "bold",
      bodyText: `User "${targetName}" is already disabled.`,
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(alreadyDisabledMessage, threadID, messageID);
    return;
  }

  await huntersCollection.updateOne(
    { userID: targetUserID },
    { $set: { disabled: true } }
  );

  await disabledUsersCollection.insertOne({ userID: targetUserID, name: targetName });

  usersData.delete(targetUserID);

  const successMessage = AuroraBetaStyler.styleOutput({
    headerText: "Solo Leveling Disable",
    headerSymbol: "✅",
    headerStyle: "bold",
    bodyText: `User "${targetName}" has been disabled.`,
    bodyStyle: "bold",
    footerText: "Developed by: **Aljur pogoy**",
  });
  await api.sendMessage(successMessage, threadID, messageID);
  return;
}

if (action === "undisabled") {
  const senderIDStr = senderID.toString();
  const isAuthorized =
    (global.config.vips && global.config.vips.map(String).includes(senderIDStr)) ||
    (global.config.developers && global.config.developers.map(String).includes(senderIDStr)) ||
    (global.config.admins && global.config.admins.map(String).includes(senderIDStr));

  if (!isAuthorized) {
    const permissionDenied = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Undisable",
      headerSymbol: "❌",
      headerStyle: "bold",
      bodyText: "Only VIPs, Developers, or Admins can use this command.",
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(permissionDenied, threadID, messageID);
    return;
  }

  const targetName = args[1];
  if (!targetName) {
    const invalidInput = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Undisable",
      headerSymbol: "⚠️",
      headerStyle: "bold",
      bodyText: "Please provide a user name. Usage: /sl undisabled <name>",
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(invalidInput, threadID, messageID);
    return;
  }

  const disabledUsersCollection = db?.db("disabledUsers");
  if (!disabledUsersCollection) {
    const dbError = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Undisable",
      headerSymbol: "❌",
      headerStyle: "bold",
      bodyText: "Database not available. Please try again later.",
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(dbError, threadID, messageID);
    return;
  }

  const disabledUser = await disabledUsersCollection.findOne({ name: targetName });
  if (!disabledUser) {
    const notDisabled = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Undisable",
      headerSymbol: "⚠️",
      headerStyle: "bold",
      bodyText: `User "${targetName}" is not disabled.`,
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(notDisabled, threadID, messageID);
    return;
  }

  const huntersCollection = db?.db("hunters");
  if (!huntersCollection) {
    const dbError = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Undisable",
      headerSymbol: "❌",
      headerStyle: "bold",
      bodyText: "Database not available. Please try again later.",
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(dbError, threadID, messageID);
    return;
  }

  await huntersCollection.updateOne(
    { userID: disabledUser.userID },
    { $unset: { disabled: "" } }
  );

  await disabledUsersCollection.deleteOne({ userID: disabledUser.userID });

  const successMessage = AuroraBetaStyler.styleOutput({
    headerText: "Solo Leveling Undisable",
    headerSymbol: "✅",
    headerStyle: "bold",
    bodyText: `User "${targetName}" has been undisabled and can now use Solo Leveling commands.`,
    bodyStyle: "bold",
    footerText: "Developed by: **Aljur pogoy**",
  });
  await api.sendMessage(successMessage, threadID, messageID);
  return;
}

    if (action === "bossfight") {
      if (!userData.name) {
        const notRegistered = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Boss Fight",
          headerSymbol: "⚠️",
          headerStyle: "bold",
          bodyText: "You need to register first. Usage: /sl register <n>",
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(notRegistered, threadID, messageID);
        return;
      }
      const bosses = [
        { name: "Demon King Baran", minRank: "E", strength: 150, agility: 80, mana: 100, expReward: 200, agilityReward: 30, manaReward: 20, strengthReward: 25 },
        { name: "Ice Elf Commander", minRank: "D", strength: 300, agility: 200, mana: 180, expReward: 200, agilityReward: 50, manaReward: 35, strengthReward: 40 },
        { name: "Flame Golem", minRank: "C", strength: 600, agility: 350, mana: 400, expReward: 200, agilityReward: 70, manaReward: 60, strengthReward: 65 },
        { name: "Shadow Cerberus", minRank: "B", strength: 1000, agility: 700, mana: 800, expReward: 200, agilityReward: 100, manaReward: 90, strengthReward: 95 },
        { name: "Iron Dragon", minRank: "A", strength: 2000, agility: 1500, mana: 1800, expReward: 200, agilityReward: 150, manaReward: 130, strengthReward: 140 },
        { name: "Monarch of Iron Body", minRank: "S", strength: 5000, agility: 4000, mana: 4500, expReward: 200, agilityReward: 300, manaReward: 250, strengthReward: 280 },
        { name: "Supreme Chaos Monarch", minRank: "X", strength: 15000, agility: 12000, mana: 14000, expReward: 200, agilityReward: 600, manaReward: 500, strengthReward: 550 },
      ];
      const rankOrder = ["E", "D", "C", "B", "A", "S", "X"];
      const userRankIndex = rankOrder.indexOf(userData.rank || "E");
      const availableBosses = bosses.filter(b => rankOrder.indexOf(b.minRank) <= userRankIndex);
      const boss = availableBosses[Math.floor(Math.random() * availableBosses.length)];
      const bfStats = userData.stats || { strength: 10, agility: 10, mana: 10 };
      const userPower = Math.max(1, Number(bfStats.strength) || 10) + Math.max(0, Number(bfStats.agility) || 0) * 0.5 + Math.max(0, Number(bfStats.mana) || 0) * 0.3;
      const bossPower = boss.strength + boss.agility * 0.5 + boss.mana * 0.3;
      const winChance = userData.rank === "X" ? 1.0 : Math.min(0.85, Math.max(0.25, userPower / (userPower + bossPower)));
      const win = Math.random() < winChance;
      userData.exp = Math.max(0, Number(userData.exp) || 0) + 200;
      const bfS1Lvl = Math.max(1, Math.floor((Math.max(0, Number(userData.exp) || 0)) / 1000) + 1);
      const bfS2Lvl = Math.max(1, Math.floor((Math.max(0, Number(userData.expS2) || 0)) / 1000) + 1);
      userData.level = Math.max(bfS1Lvl, bfS2Lvl);
      applyRankProgression(userData);
      if (win) {
        bfStats.agility = Math.max(0, Number(bfStats.agility) || 0) + boss.agilityReward;
        bfStats.mana = Math.max(0, Number(bfStats.mana) || 0) + boss.manaReward;
        bfStats.strength = Math.max(0, Number(bfStats.strength) || 0) + boss.strengthReward;
        userData.stats = bfStats;
        const materialDrops = ["iron_ore", "mana_crystal", "mythril", "dragon_scale", "shadow_essence"];
        const materialDrop = materialDrops[Math.floor(Math.random() * materialDrops.length)];
        userData.inventory.materials[materialDrop] = Math.max(0, Number(userData.inventory.materials[materialDrop] || 0)) + 2;
        if (boss.name === "Iron Dragon") userData.ironDragonDefeated = true;
        const newTitlesBoss = checkAndGrantTitles(userData);
        const titleLineBoss = newTitlesBoss.length > 0
          ? "\n\n🎖️ New Title(s) Unlocked: " + newTitlesBoss.map(id => TITLE_DEFS.find(t => t.id === id)?.label || id).join(", ")
          : "";
        await saveHunterData(db, senderID.toString(), userData);
        const winMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Boss Fight",
          headerSymbol: "💀",
          headerStyle: "bold",
          bodyText: `BOSS SLAIN! ${userData.name} defeated ${boss.name}!\n\n+200 EXP\n+${boss.strengthReward} Strength\n+${boss.agilityReward} Agility\n+${boss.manaReward} Mana\n+2 ${materialDrop.replace(/_/g, " ")}\n\nNew Level: ${userData.level}, Rank: ${userData.rank}\nStats: STR ${bfStats.strength} | AGI ${bfStats.agility} | MANA ${bfStats.mana}${titleLineBoss}`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(winMessage, threadID, messageID);
      } else {
        userData.stats = bfStats;
        await saveHunterData(db, senderID.toString(), userData);
        const loseMessage = AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Boss Fight",
          headerSymbol: "💥",
          headerStyle: "bold",
          bodyText: `DEFEATED! ${boss.name} overwhelmed ${userData.name}!\n\n+200 EXP (consolation)\n\nNew Level: ${userData.level}, Rank: ${userData.rank}\nTrain your stats and try again!`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        });
        await api.sendMessage(loseMessage, threadID, messageID);
      }
      return;
    }

    if (action === "duel") {
      if (!userData.name) {
        await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Solo Leveling Duel", headerSymbol: "⚠️", headerStyle: "bold", bodyText: "You need to register first. Usage: /sl register <n>", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
        return;
      }
      const targetName = args.slice(1).join(" ").trim();
      if (!targetName) {
        await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Solo Leveling Duel", headerSymbol: "⚠️", headerStyle: "bold", bodyText: "Specify an opponent. Usage: /sl duel <hunterName>", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
        return;
      }
      const duelCooldownSecs = 600;
      if (Math.max(0, Number(userData.duelCooldown) || 0) > currentTime) {
        const rem = Math.max(0, Number(userData.duelCooldown) || 0) - currentTime;
        await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Solo Leveling Duel", headerSymbol: "⏳", headerStyle: "bold", bodyText: `Duel cooldown active. Wait ${Math.ceil(rem / 60)} minutes.`, bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
        return;
      }
      const duelCollection = db.db("hunters");
      const targetData = await duelCollection.findOne({ name: targetName });
      if (!targetData?.name) {
        await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Solo Leveling Duel", headerSymbol: "❌", headerStyle: "bold", bodyText: `Hunter "${targetName}" not found. They must be registered.`, bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
        return;
      }
      if (targetData.userID === senderID.toString()) {
        await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Solo Leveling Duel", headerSymbol: "⚠️", headerStyle: "bold", bodyText: "You cannot duel yourself!", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
        return;
      }
      const mySt = userData.stats || { strength: 10, agility: 10, mana: 10 };
      const thSt = targetData.stats  || { strength: 10, agility: 10, mana: 10 };

      const myPow = (Math.max(1, Number(mySt.strength) || 10) + Math.max(0, Number(mySt.agility) || 0) * 0.5 + Math.max(0, Number(mySt.mana) || 0) * 0.3) * (0.85 + Math.random() * 0.30);
      const thPow = (Math.max(1, Number(thSt.strength) || 10) + Math.max(0, Number(thSt.agility) || 0) * 0.5 + Math.max(0, Number(thSt.mana) || 0) * 0.3) * (0.85 + Math.random() * 0.30);
      userData.duelCooldown = currentTime + duelCooldownSecs;
      if (myPow > thPow) {
        const stake = Math.floor(Math.max(0, Number(targetData.exp) || 0) * 0.10);
        userData.exp = Math.max(0, Number(userData.exp) || 0) + stake;
        userData.level = Math.max(1, Math.floor(Math.max(0, Number(userData.exp)) / 1000) + 1);
        userData.battleWins = (userData.battleWins || 0) + 1;
        applyRankProgression(userData);
        targetData.exp = Math.max(0, Number(targetData.exp) - stake);
        await duelCollection.updateOne({ userID: targetData.userID }, { $set: { exp: targetData.exp } });
        const newTitlesDuel = checkAndGrantTitles(userData);
        const titleLineDuel = newTitlesDuel.length > 0 ? "\n\n🎖️ New Title(s) Unlocked: " + newTitlesDuel.map((id: string) => TITLE_DEFS.find(t => t.id === id)?.label || id).join(", ") : "";
        await saveHunterData(db, senderID.toString(), userData);
        await api.sendMessage(AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Duel",
          headerSymbol: "⚔️",
          headerStyle: "bold",
          bodyText: `⚔️ DUEL RESULT\n${userData.name} (${Math.floor(myPow)}) vs ${targetName} (${Math.floor(thPow)})\n\nVICTORY! ${userData.name} wins!\nStole ${stake} EXP from ${targetName}.\nNew Level: ${userData.level}, Rank: ${userData.rank}.${titleLineDuel}`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        }), threadID, messageID);
      } else {
        const lost = Math.floor(Math.max(0, Number(userData.exp) || 0) * 0.05);
        userData.exp = Math.max(0, Number(userData.exp) - lost);
        userData.level = Math.max(1, Math.floor(Math.max(0, Number(userData.exp)) / 1000) + 1);
        await saveHunterData(db, senderID.toString(), userData);
        await api.sendMessage(AuroraBetaStyler.styleOutput({
          headerText: "Solo Leveling Duel",
          headerSymbol: "💥",
          headerStyle: "bold",
          bodyText: `⚔️ DUEL RESULT\n${userData.name} (${Math.floor(myPow)}) vs ${targetName} (${Math.floor(thPow)})\n\nDEFEAT! ${targetName} wins!\nLost ${lost} EXP. Train harder!`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        }), threadID, messageID);
      }
      return;
    }

    if (action === "daily") {
      if (!userData.name) {
        await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Solo Leveling Daily", headerSymbol: "⚠️", headerStyle: "bold", bodyText: "You need to register first. Usage: /sl register <n>", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
        return;
      }
      const dailyCooldownSecs = 86400;
      const lastDaily = Math.max(0, Number(userData.dailyCooldown) || 0);
      if (lastDaily > currentTime) {
        const rem = lastDaily - currentTime;
        const h = Math.floor(rem / 3600);
        const m = Math.ceil((rem % 3600) / 60);
        await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Solo Leveling Daily", headerSymbol: "⏳", headerStyle: "bold", bodyText: `Daily reward already claimed! Come back in ${h}h ${m}m.`, bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
        return;
      }

      const todayStr     = new Date().toISOString().slice(0, 10);
      const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const lastDate     = userData.lastLoginDate || "";
      if (lastDate === yesterdayStr) {
        userData.loginStreak = (userData.loginStreak || 0) + 1;
      } else if (lastDate !== todayStr) {
        userData.loginStreak = 1;
      }
      userData.lastLoginDate = todayStr;
      const streak     = userData.loginStreak || 1;
      const multiplier = Math.min(streak, 7);
      const baseExp    = 500;
      const expReward  = baseExp * multiplier;
      const matPool    = ["iron_ore", "mana_crystal", "mythril", "dragon_scale", "shadow_essence"];
      const matDrop    = matPool[Math.floor(Math.random() * matPool.length)];
      const matQty     = Math.ceil(multiplier / 2);
      userData.exp     = Math.max(0, Number(userData.exp) || 0) + expReward;
      userData.level   = Math.max(1, Math.floor(Math.max(0, Number(userData.exp)) / 1000) + 1);
      userData.inventory.materials[matDrop] = Math.max(0, Number(userData.inventory.materials[matDrop] || 0)) + matQty;
      userData.dailyCooldown = currentTime + dailyCooldownSecs;

      if (userData.dailyMissionsDate !== todayStr) {
        const allMissions = [
          { key: "win_3_battles",  goal: 3, reward: 1500, description: "Win 3 battles." },
          { key: "clear_dungeon",  goal: 1, reward: 2000, description: "Clear any dungeon." },
          { key: "train_3_times",  goal: 3, reward: 800,  description: "Train any stat 3 times." },
          { key: "use_1_potion",   goal: 1, reward: 500,  description: "Use any potion." },
          { key: "meditate_once",  goal: 1, reward: 600,  description: "Meditate once." },
        ];
        const seed   = parseInt(todayStr.replace(/-/g, "")) % allMissions.length;
        const picks  = [seed % allMissions.length, (seed + 1) % allMissions.length, (seed + 2) % allMissions.length];
        userData.dailyMissions = {};
        for (const i of picks) {
          const mis = allMissions[i];
          userData.dailyMissions[mis.key] = { goal: mis.goal, progress: 0, reward: mis.reward, completed: false, description: mis.description };
        }
        userData.dailyMissionsDate = todayStr;
      }
      applyRankProgression(userData);
      const newTitlesD = checkAndGrantTitles(userData);
      const titleLineD = newTitlesD.length > 0 ? "\n\n🎖️ New Title(s) Unlocked: " + newTitlesD.map((id: string) => TITLE_DEFS.find(t => t.id === id)?.label || id).join(", ") : "";
      const missText   = Object.values(userData.dailyMissions || {})
        .map((ms: any) => `• ${ms.description} (${ms.progress}/${ms.goal}) ${ms.completed ? "✅" : ""}  → ${ms.reward} EXP`)
        .join("\n");
      await saveHunterData(db, senderID.toString(), userData);
      await api.sendMessage(AuroraBetaStyler.styleOutput({
        headerText: "Solo Leveling Daily Reward",
        headerSymbol: "🎁",
        headerStyle: "bold",
        bodyText: `Daily reward claimed!\n🔥 Streak: ${streak} day(s) — ${multiplier}× multiplier\n+${expReward} EXP | +${matQty} ${matDrop.replace(/_/g, " ")}\nNew Level: ${userData.level}, Rank: ${userData.rank}.${titleLineD}\n\n📜 Today's Daily Missions:\n${missText}\n\nComplete missions for bonus EXP! Come back tomorrow to keep your streak!`,
        bodyStyle: "bold",
        footerText: "Developed by: **Aljur pogoy**",
      }), threadID, messageID);
      return;
    }

    if (action === "title") {
      if (!userData.name) {
        await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Hunter Titles", headerSymbol: "⚠️", headerStyle: "bold", bodyText: "You need to register first. Usage: /sl register <n>", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
        return;
      }
      const titleSub = args[1]?.toLowerCase();
      if (!titleSub || titleSub === "list") {
        const unlocked = userData.titles || [];
        const list     = TITLE_DEFS.map(t => `${unlocked.includes(t.id) ? "✅" : "🔒"} ${t.label} — ${t.how}`).join("\n");
        const active   = userData.activeTitle ? (TITLE_DEFS.find(t => t.id === userData.activeTitle)?.label || userData.activeTitle) : "None";
        await api.sendMessage(AuroraBetaStyler.styleOutput({
          headerText: "Hunter Titles",
          headerSymbol: "🎖️",
          headerStyle: "bold",
          bodyText: `Active Title: ${active}\n\n${list}\n\nUse /sl title set <titleId> to equip.\nIDs: ${TITLE_DEFS.map(t => t.id).join(", ")}`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        }), threadID, messageID);
        return;
      }
      if (titleSub === "set") {

        const titleId = args.slice(2).join("_").toLowerCase().replace(/\s+/g, "_").replace(/__+/g, "_");
        if (!titleId || !TITLE_DEFS.find(t => t.id === titleId)) {
          await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Hunter Titles", headerSymbol: "⚠️", headerStyle: "bold", bodyText: "Invalid title ID. Use /sl title list to see available IDs.", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
          return;
        }
        if (!(userData.titles || []).includes(titleId)) {
          await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Hunter Titles", headerSymbol: "🛑", headerStyle: "bold", bodyText: "You haven't unlocked this title yet!", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
          return;
        }
        userData.activeTitle = titleId;
        await saveHunterData(db, senderID.toString(), userData);
        const lbl = TITLE_DEFS.find(t => t.id === titleId)?.label || titleId;
        await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Hunter Titles", headerSymbol: "✅", headerStyle: "bold", bodyText: `Active title set to: ${lbl}`, bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
        return;
      }
      await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Hunter Titles", headerSymbol: "⚠️", headerStyle: "bold", bodyText: "Usage: /sl title list | /sl title set <titleId>", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
      return;
    }

    if (action === "raid") {
      if (!userData.name) {
        await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Solo Leveling Raid", headerSymbol: "⚠️", headerStyle: "bold", bodyText: "You need to register first. Usage: /sl register <n>", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
        return;
      }
      const existingRaid = activeRaids.get(threadID);

      if (args[1]?.toLowerCase() === "start") {
        if (!existingRaid) {
          await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Solo Leveling Raid", headerSymbol: "⚠️", headerStyle: "bold", bodyText: "No raid lobby open. Use /sl raid to create one.", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
          return;
        }
        if (existingRaid.initiatorID !== senderID.toString()) {
          await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Solo Leveling Raid", headerSymbol: "❌", headerStyle: "bold", bodyText: "Only the raid initiator can start the fight.", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
          return;
        }
        if (existingRaid.participants.length < 2) {
          await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Solo Leveling Raid", headerSymbol: "⚠️", headerStyle: "bold", bodyText: `Need at least 2 hunters. Currently ${existingRaid.participants.length}/5.`, bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
          return;
        }
        const raidBosses = [
          { name: "Monarch of Destruction", power: 10000 },
          { name: "Ashborn",                power: 15000 },
          { name: "Demon King Baran",        power: 8000  },
          { name: "Ant King",               power: 12000 },
        ];
        const rb      = raidBosses[Math.floor(Math.random() * raidBosses.length)];
        const hColl   = db.db("hunters");
        let partyPower = 0;
        const names: string[] = [];
        for (const pid of existingRaid.participants) {
          const pd = await hColl.findOne({ userID: pid });
          if (pd) {
            const ps = pd.stats || { strength: 10, agility: 10, mana: 10 };
            partyPower += Math.max(1, Number(ps.strength) || 10) + Math.max(0, Number(ps.agility) || 0) * 0.5 + Math.max(0, Number(ps.mana) || 0) * 0.3;
            names.push(pd.name || "Hunter");
          }
        }
        const raidWin  = partyPower * (0.85 + Math.random() * 0.30) > rb.power;
        const expEach  = raidWin ? Math.floor(Math.random() * 5000) + 3000 : 500;
        const matDrops = ["dragon_scale", "shadow_essence", "mythril", "mana_crystal"];
        const raidMat  = matDrops[Math.floor(Math.random() * matDrops.length)];
        for (const pid of existingRaid.participants) {
          const pd = await hColl.findOne({ userID: pid });
          if (pd) {
            pd.exp   = Math.max(0, Number(pd.exp) || 0) + expEach;
            pd.level = Math.max(1, Math.floor(Math.max(0, Number(pd.exp)) / 1000) + 1);
            if (raidWin) {
              pd.inventory = pd.inventory || { potions: {}, materials: {} };
              pd.inventory.materials = pd.inventory.materials || {};
              pd.inventory.materials[raidMat] = Math.max(0, Number(pd.inventory.materials[raidMat] || 0)) + 2;
            }
            applyRankProgression(pd);
            await saveHunterData(db, pid, pd);
          }
        }
        activeRaids.delete(threadID);
        await api.sendMessage(AuroraBetaStyler.styleOutput({
          headerText: "⚔️ RAID COMPLETE ⚔️",
          headerSymbol: raidWin ? "🏆" : "💥",
          headerStyle: "bold",
          bodyText: `Party: ${names.join(", ")}\nBoss: ${rb.name} (Power: ${rb.power})\nParty Power: ${Math.floor(partyPower)}\n\n${raidWin ? `VICTORY! Everyone gained ${expEach} EXP and 2 ${raidMat.replace(/_/g, " ")}.` : `DEFEAT! Boss was too powerful. Everyone gained ${expEach} EXP as consolation.`}`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        }), threadID, messageID);
        return;
      }

      if (existingRaid) {
        await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Solo Leveling Raid", headerSymbol: "ℹ️", headerStyle: "bold", bodyText: `Raid already open: ${existingRaid.participants.length}/5 hunters. Reply 'join raid' or use /sl raid start when ready.`, bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
        return;
      }
      const newRaid = { initiatorID: senderID.toString(), participants: [senderID.toString()], expiresAt: currentTime + 120 };
      activeRaids.set(threadID, newRaid);
      let raidMsgID: string;
      await new Promise((resolve) => {
        api.sendMessage(
          AuroraBetaStyler.styleOutput({
            headerText: "⚔️ RAID INITIATED ⚔️",
            headerSymbol: "🏰",
            headerStyle: "bold",
            bodyText: `${userData.name} opened a Mega Dungeon Raid!\n\nUp to 5 hunters can join — reply 'join raid' within 2 minutes.\n\nShared rewards: 3000–8000 EXP each + rare material drops.\n\nWhen ready: /sl raid start`,
            bodyStyle: "bold",
            footerText: "Developed by: **Aljur pogoy**",
          }),
          threadID,
          (err: any, info: any) => { raidMsgID = info?.messageID; resolve(info); },
          messageID
        );
      });
      if (!global.Kagenou.replyListeners) global.Kagenou.replyListeners = new Map();
      global.Kagenou.replyListeners.set(raidMsgID, {
        callback: async ({ api, event }: any) => {
          if (event.body?.toLowerCase().trim() !== "join raid") return;
          const r = activeRaids.get(threadID);
          if (!r || r.expiresAt < Math.floor(Date.now() / 1000)) {
            await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Raid", headerSymbol: "⚠️", headerStyle: "bold", bodyText: "This raid lobby has expired.", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), event.threadID, event.messageID);
            return;
          }
          if (r.participants.includes(event.senderID)) {
            await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Raid", headerSymbol: "⚠️", headerStyle: "bold", bodyText: "You've already joined!", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), event.threadID, event.messageID);
            return;
          }
          if (r.participants.length >= 5) {
            await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Raid", headerSymbol: "🛑", headerStyle: "bold", bodyText: "Raid is full (5/5).", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), event.threadID, event.messageID);
            return;
          }
          const joiner = await db.db("hunters").findOne({ userID: event.senderID });
          if (!joiner?.name) {
            await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Raid", headerSymbol: "⚠️", headerStyle: "bold", bodyText: "You must be a registered hunter to join.", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), event.threadID, event.messageID);
            return;
          }
          r.participants.push(event.senderID);
          activeRaids.set(threadID, r);
          let nextRaidMsgID: string;
          await new Promise<void>((resolve) => {
            api.sendMessage(
              AuroraBetaStyler.styleOutput({ headerText: "Raid", headerSymbol: "✅", headerStyle: "bold", bodyText: `${joiner.name} joined the raid! (${r.participants.length}/5)\n\nReply 'join raid' to join, or use /sl raid start when ready.`, bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }),
              event.threadID,
              (err: any, info: any) => { nextRaidMsgID = info?.messageID; resolve(); },
              event.messageID
            );
          });
          global.Kagenou.replyListeners.set(nextRaidMsgID, global.Kagenou.replyListeners.get(raidMsgID));
          global.Kagenou.replyListeners.delete(raidMsgID);
        },
      });
      setTimeout(() => activeRaids.delete(threadID), 120000);
      return;
    }

    if (action === "doubledungeon") {
      if (!userData.name) {
        await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Double Dungeon", headerSymbol: "⚠️", headerStyle: "bold", bodyText: "You need to register first. Usage: /sl register <n>", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
        return;
      }
      if (!userData.doubleDungeonUnlocked) {
        await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Double Dungeon", headerSymbol: "🔒", headerStyle: "bold", bodyText: "The Double Dungeon hasn't appeared yet. Keep clearing dungeons — it opens randomly (10% chance each clear)!", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
        return;
      }
      if (Math.max(0, Number(userData.dungeonCooldown) || 0) > currentTime) {
        const rem = Math.max(0, Number(userData.dungeonCooldown) || 0) - currentTime;
        await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Double Dungeon", headerSymbol: "⏳", headerStyle: "bold", bodyText: `Dungeon cooldown active. Wait ${Math.ceil(rem / 60)} minutes.`, bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
        return;
      }
      const RANK_ORDER_DD = ["E", "D", "C", "B", "A", "S", "X"];
      const rankBonus     = RANK_ORDER_DD.indexOf(userData.rank || "E") * 0.05;
      const successChance = Math.min(0.85, 0.60 + rankBonus);
      const ddWin         = Math.random() < successChance;
      const ddExp         = ddWin ? Math.floor(Math.random() * 5000) + 5000 : 1000;
      userData.exp        = Math.max(0, Number(userData.exp) || 0) + ddExp;
      userData.level      = Math.max(1, Math.floor(Math.max(0, Number(userData.exp)) / 1000) + 1);
      userData.dungeonCooldown      = currentTime + dungeonCooldown;
      userData.doubleDungeonUnlocked = false;
      applyRankProgression(userData);
      if (ddWin) {
        userData.dungeonClears = (userData.dungeonClears || 0) + 1;
        const ddDrops = ["dragon_scale", "shadow_essence", "mythril"];
        const ddMat   = ddDrops[Math.floor(Math.random() * ddDrops.length)];
        userData.inventory.materials[ddMat] = Math.max(0, Number(userData.inventory.materials[ddMat] || 0)) + 3;
        const newTitlesDD = checkAndGrantTitles(userData);
        const titleLineDD = newTitlesDD.length > 0 ? "\n\n🎖️ New Title(s) Unlocked: " + newTitlesDD.map((id: string) => TITLE_DEFS.find(t => t.id === id)?.label || id).join(", ") : "";
        await saveHunterData(db, senderID.toString(), userData);
        await api.sendMessage(AuroraBetaStyler.styleOutput({
          headerText: "Double Dungeon",
          headerSymbol: "💀",
          headerStyle: "bold",
          bodyText: `You survived the Double Dungeon!\n\n+${ddExp} EXP | +3 ${ddMat.replace(/_/g, " ")}\nNew Level: ${userData.level}, Rank: ${userData.rank}.${titleLineDD}`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        }), threadID, messageID);
      } else {
        let lossLine = "";
        if ((userData.shadows || []).length > 0) {
          const idx  = Math.floor(Math.random() * userData.shadows.length);
          const lost = userData.shadows.splice(idx, 1)[0];
          userData.lostShadows = [...(userData.lostShadows || []), { name: lost.name, nickname: lost.nickname }];
          lossLine = `\n😱 Lost shadow: ${lost.name} (${lost.nickname})!`;
        }
        await saveHunterData(db, senderID.toString(), userData);
        await api.sendMessage(AuroraBetaStyler.styleOutput({
          headerText: "Double Dungeon",
          headerSymbol: "💀",
          headerStyle: "bold",
          bodyText: `Overwhelmed in the Double Dungeon!\n\n+${ddExp} EXP (consolation)${lossLine}\nNew Level: ${userData.level}. Train before venturing again!`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        }), threadID, messageID);
      }
      return;
    }

    if (action === "gatesurge") {
      const gsSub = args[1]?.toLowerCase();
      if (gsSub === "start") {
        const sid    = senderID.toString();
        const isAuth =
          (global.config.vips       && global.config.vips.map(String).includes(sid)) ||
          (global.config.developers && global.config.developers.map(String).includes(sid)) ||
          (global.config.admins     && global.config.admins.map(String).includes(sid));
        if (!isAuth) {
          await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Gate Surge", headerSymbol: "❌", headerStyle: "bold", bodyText: "Only admins, developers, or VIPs can start a Gate Surge.", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
          return;
        }
        const existing = activeSurges.get(threadID);
        if (existing && existing.expiresAt > currentTime) {
          await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Gate Surge", headerSymbol: "⚠️", headerStyle: "bold", bodyText: "A Gate Surge is already active in this chat!", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
          return;
        }
        activeSurges.set(threadID, { expiresAt: currentTime + 600, claimedBy: null });
        await api.sendMessage(AuroraBetaStyler.styleOutput({
          headerText: "⚡ GATE SURGE ⚡",
          headerSymbol: "🌌",
          headerStyle: "bold",
          bodyText: `A RED GATE has ripped open!\n\nFirst registered hunter to use /sl gatesurge enter within 10 minutes gets:\n• 5 000 EXP\n• 5 Magic Crystals (S2)\n• 3 Shadow Essence\n\nHurry — only ONE hunter can claim this!`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        }), threadID, messageID);
        setTimeout(() => {
          const s = activeSurges.get(threadID);
          if (s && !s.claimedBy) {
            activeSurges.delete(threadID);
            api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Gate Surge", headerSymbol: "🌌", headerStyle: "bold", bodyText: "The red gate destabilized and closed. No hunter entered in time.", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID);
          }
        }, 600000);
        return;
      }
      if (gsSub === "enter") {
        if (!userData.name) {
          await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Gate Surge", headerSymbol: "⚠️", headerStyle: "bold", bodyText: "You need to register first. Usage: /sl register <n>", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
          return;
        }
        const surge = activeSurges.get(threadID);
        if (!surge || surge.expiresAt < currentTime) {
          await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Gate Surge", headerSymbol: "⚠️", headerStyle: "bold", bodyText: "There is no active Gate Surge right now. Watch for announcements!", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
          return;
        }
        if (surge.claimedBy) {
          await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Gate Surge", headerSymbol: "🛑", headerStyle: "bold", bodyText: "The gate has already been claimed by another hunter. Better luck next time!", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
          return;
        }
        surge.claimedBy = senderID.toString();
        activeSurges.set(threadID, surge);
        userData.exp = Math.max(0, Number(userData.exp) || 0) + 5000;
        userData.level = Math.max(1, Math.floor(Math.max(0, Number(userData.exp)) / 1000) + 1);
        userData.inventoryS2 = userData.inventoryS2 || { magicCrystals: 0, holyCrystals: 0, items: {} };
        userData.inventoryS2.magicCrystals = Math.max(0, Number(userData.inventoryS2.magicCrystals) || 0) + 5;
        userData.inventory.materials["shadow_essence"] = Math.max(0, Number(userData.inventory.materials["shadow_essence"] || 0)) + 3;
        applyRankProgression(userData);
        await saveHunterData(db, senderID.toString(), userData);
        await api.sendMessage(AuroraBetaStyler.styleOutput({
          headerText: "⚡ GATE SURGE CLAIMED ⚡",
          headerSymbol: "🌌",
          headerStyle: "bold",
          bodyText: `${userData.name} dashed into the red gate and emerged victorious!\n\n+5 000 EXP | +5 Magic Crystals | +3 Shadow Essence\nNew Level: ${userData.level}, Rank: ${userData.rank}.`,
          bodyStyle: "bold",
          footerText: "Developed by: **Aljur pogoy**",
        }), threadID, messageID);
        return;
      }
      await api.sendMessage(AuroraBetaStyler.styleOutput({ headerText: "Gate Surge", headerSymbol: "⚠️", headerStyle: "bold", bodyText: "Usage: /sl gatesurge enter\n(Admins: /sl gatesurge start)", bodyStyle: "bold", footerText: "Developed by: **Aljur pogoy**" }), threadID, messageID);
      return;
    }

    const invalidCommand = AuroraBetaStyler.styleOutput({
      headerText: "Solo Leveling Commands",
      headerSymbol: "📖",
      headerStyle: "bold",
      bodyText: "Invalid command. Here are all available commands:\n\n🔰 GENERAL\n/sl register <n> — Register as a hunter\n/sl status — View your hunter stats\n/sl leaderboard — Top 10 hunters by EXP\n/sl changename <new name> — Change your hunter name (once only)\n/sl setrole <tank|mage|assassin|healer|ranger> — Set your class role\n\n⚔️ COMBAT\n/sl battle — Fight random enemies\n/sl battle X — Fight the Supreme Monarch (X rank only)\n/sl bossfight — Challenge a powerful boss for EXP & attributes\n/sl gate enter <blue|red|violet|orange> — Enter a gate for EXP\n/sl duel <hunterName> — Challenge another hunter to a PvP duel (10 min cooldown)\n\n🎁 DAILY & MISSIONS\n/sl daily — Claim daily reward + streak multiplier + rotating missions\n\n🎖️ TITLES\n/sl title list — View all titles and your unlocked ones\n/sl title set <titleId> — Equip a title to display on your status\n\n🏰 DUNGEONS & EVENTS\n/sl dungeon <D|C|B|A|S> — Clear a dungeon tier for EXP & materials\n/sl dungeon status — Check dungeon cooldown & materials\n/sl doubledungeon — Enter the hidden Double Dungeon (unlocks randomly)\n/sl raid — Open a raid lobby (up to 5 hunters, reply-based join)\n/sl raid start — Start the raid fight\n/sl gatesurge enter — Claim an active Gate Surge event\n(Admins: /sl gatesurge start — trigger a Gate Surge)\n\n🧘 TRAINING\n/sl train <strength|agility|mana> — Train a stat\n/sl meditate — Restore +50 Mana (30 min cooldown)\n/sl shadowtrain <shadow name> — Level up a shadow soldier\n\n🛍️ SHOP & INVENTORY\n/sl shop — View all items for sale\n/sl buy <item name> <quantity> — Buy an item\nExample: /sl buy celestial blade 1\n/sl use <potion name> <quantity> — Use a potion\n/sl craft <item> — Craft items using materials\n\n📜 QUESTS\n/sl quest — View and track active quests\n\n🌑 SHADOWS\n/sl shadowlist — View all your shadow soldiers\n\n🛡️ GUILD\n/sl guild create <n> — Create a guild\n/sl guild join <n> — Join a guild\n/sl guild leave — Leave your current guild\n/sl guild fight <n> — Challenge another guild\n/sl guild list — List all guilds\n/sl guild changename <new name> — Rename your guild (once only)\n\n🌟 SEASON 2\n/sl s2 register — Register a Season 2 character\n/sl s2 status — View Season 2 stats\n/sl s2 battle — Fight enemies in Season 2\n/sl s2 war — Participate in a Season 2 war\n/sl s2 dungeon <D|C|B|A|S> — Clear a Season 2 dungeon\n/sl s2 shop — Season 2 shop\n/sl s2 inventory — View Season 2 inventory\n/sl s2 shadowtrain <shadow> — Train a Season 2 shadow\n/sl s2 guild [create|leave|list|war] — Season 2 guild actions\n/sl s2 leaderboard — Season 2 top hunters\n\n🔐 ADMIN \/ DEVELOPER COMMANDS\n(Only accessible by admins, developers, and VIPs)\n/sl customize set <name> <n> <rank> <level> <role> <stats> <exp> <equipment> <guild> — Manually set a hunter's full profile\n/sl disabled <n> — Disable a hunter from using Solo Leveling commands\n/sl undisabled <n> — Re-enable a disabled hunter\n/sl gatesurge start — Trigger a Gate Surge event in the current chat",
      bodyStyle: "bold",
      footerText: "Developed by: **Aljur pogoy**",
    });
    await api.sendMessage(invalidCommand, threadID, messageID);
  },
};

async function getHunterData(db: any, userID: string): Promise<HunterData> {
  const huntersCollection = db.db("hunters");
  let userData = await huntersCollection.findOne({ userID });
  if (!userData) {
    userData = {
      userID,
      name: undefined,
      nameS2: undefined,
      level: 1,
      exp: 0,
      expS2: 0,
      rank: "E",
      role: undefined,
      equipment: { swords: {} },
      inventory: { potions: {}, materials: {} },
      inventoryS2: { magicCrystals: 0, holyCrystals: 0, items: {} },
      shadows: [],
      shadowsS2: [],
      stats: { strength: 10, agility: 10, mana: 10 },
      dungeonCooldown: 0,
      dungeonCooldownS2: 0,
      quests: {},
      meditateCooldown: 0,
      warCooldownS2: 0,
      lostShadows: [],
      lostShadowsS2: [],
      hasChangedName: false,
      gateCooldown: 0,
      dailyCooldown: 0,
      lastLoginDate: "",
      loginStreak: 0,
      titles: [],
      activeTitle: undefined,
      duelCooldown: 0,
      battleWins: 0,
      dungeonClears: 0,
      ironDragonDefeated: false,
      doubleDungeonUnlocked: false,
      dailyMissions: {},
      dailyMissionsDate: "",
    };
    await saveHunterData(db, userID, userData);
  }
  return userData;
}

async function saveHunterData(db: any, userID: string, data: HunterData): Promise<void> {
  const huntersCollection = db.db("hunters");
  await huntersCollection.updateOne(
    { userID },
    { $set: data },
    { upsert: true }
  );
}

function applyRoleSkills(userData: HunterData): void {
  const stats = userData.stats || { strength: 0, agility: 0, mana: 0 };
  const role = userData.role?.toLowerCase();
  const rank = userData.rank || "E";
  const roleBoosts: { [key: string]: { strength: number; agility: number; mana: number } } = {
    tank: { strength: rank === "E" ? 10 : rank === "D" ? 20 : rank === "C" ? 30 : rank === "B" ? 40 : rank === "A" ? 50 : rank === "S" ? 100 : 1000, agility: 0, mana: 0 },
    mage: { strength: 0, agility: 0, mana: rank === "E" ? 10 : rank === "D" ? 20 : rank === "C" ? 30 : rank === "B" ? 40 : rank === "A" ? 50 : rank === "S" ? 100 : 1000 },
    assassin: { strength: 0, agility: rank === "E" ? 10 : rank === "D" ? 20 : rank === "C" ? 30 : rank === "B" ? 40 : rank === "A" ? 50 : rank === "S" ? 100 : 1000, mana: 0 },
    healer: { strength: 0, agility: 0, mana: rank === "E" ? 10 : rank === "D" ? 20 : rank === "C" ? 30 : rank === "B" ? 40 : rank === "A" ? 50 : rank === "S" ? 100 : 500 },
    ranger: { strength: 0, agility: rank === "E" ? 10 : rank === "D" ? 20 : rank === "C" ? 30 : rank === "B" ? 40 : rank === "A" ? 50 : rank === "S" ? 100 : 500, mana: 0 },
  };
  if (role && roleBoosts[role]) {
    stats.strength = Math.max(0, Number(stats.strength) || 0) + roleBoosts[role].strength;
    stats.agility = Math.max(0, Number(stats.agility) || 0) + roleBoosts[role].agility;
    stats.mana = Math.max(0, Number(stats.mana) || 0) + roleBoosts[role].mana;
    userData.stats = stats;
  }
}

function applyRankProgression(userData: HunterData): void {
  const level = Math.max(1, Number(userData.level) || 1);
  if (level >= 1000) {
    userData.rank = "X";
  } else if (level >= 500) {
    const currentRankOrder = ["E", "D", "C", "B", "A", "S", "X"];
    const currentIndex = currentRankOrder.indexOf(userData.rank || "E");
    if (currentIndex < currentRankOrder.indexOf("S")) {
      userData.rank = "S";
    }
  } else if (level >= 100) {
    const rankOrder = ["E", "D", "C", "B", "A", "S", "X"];
    const levelRankThresholds = [
      { rank: "A", minLevel: 400 },
      { rank: "B", minLevel: 300 },
      { rank: "C", minLevel: 200 },
      { rank: "D", minLevel: 100 },
    ];
    for (const { rank, minLevel } of levelRankThresholds) {
      if (level >= minLevel) {
        const currentIndex = rankOrder.indexOf(userData.rank || "E");
        const newIndex = rankOrder.indexOf(rank);
        if (newIndex > currentIndex) {
          userData.rank = rank;
        }
        break;
      }
    }
  }
}

export default soloLevelingCommand;
