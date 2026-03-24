
import AuroraBetaStyler from "@aurora/styler";

export default {
  config: {
    name: "xp-event",
    description: "Automatically grant XP based on user activity.",
    role: 0,
    category: "System ⚡",
  },
  handleEvent: true,
  async handleEvent({ api, event, db }) {
    const { threadID, senderID, body } = event;
    if (!body) return;
    const userData = global.messageTracker.get(senderID) || { count: 0, lastGain: 0 };
    userData.count += 1;
    global.messageTracker.set(senderID, userData);
    const now = Date.now();
    if (userData.count >= 10 && now - userData.lastGain >= 5 * 60 * 1000) {
      const xpGain = Math.floor(Math.random() * 2000) + 2000; // 70–140 XP
      await global.addXP(senderID, xpGain);

      userData.count = 0;
      userData.lastGain = now;
      global.messageTracker.set(senderID, userData);

      try {
        const userInfo = await api.getUserInfo([senderID]);
        const name = userInfo[senderID]?.name || "Unknown User";
        const styledMessage = AuroraBetaStyler.styleOutput({
          headerText: "XP System",
          headerSymbol: "✨",
          headerStyle: "bold",
          bodyText: `🎉 ${name} earned ${xpGain}!`,
          bodyStyle: "sansSerif",
          footerText: "XP event updated by **Aljurx pogoy**",
        });
        await api.sendMessage(styledMessage, threadID);
      } catch (err) {
        global.log.error(`Error sending XP gain message for ${senderID}: ${err.message}`);
      }
    }
  },
  run: async () => {
    // Event only don't ne stupidnegga.
  },
};
