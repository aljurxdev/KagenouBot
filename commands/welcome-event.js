/* modified by Jacob */

const AuroraBetaStyler = require('@aurora/styler');

const footer = 'Developed by: **Aljur Pogoy**';
const defaultMessage = '🎉 Welcome {userNames} to the group chat! Enjoy your stay!';

module.exports = {
  config: {
    name: 'welcome-event',
    description: 'Welcome new members and set a global welcome message',
    role: 2,
    cooldown: 5,
    aliases: ['welcome', 'setgreet', 'setwelcome'],
  },

  handleEvent: true,

  async handleEvent({ api, event }) {
    if (event.logMessageType !== 'log:subscribe') return;

    const threadID = event.threadID;
    const addedUsers = event.logMessageData.addedParticipants;

    const welcomeMessage = global.welcomeMessage || defaultMessage;

    const mentions = [];
    const names = [];

    for (const user of addedUsers) {
      const userName = user.fullName || 'User';
      mentions.push({
        tag: `@${userName}`,
        id: user.userFbId,
      });
      names.push(`@${userName}`);
    }

    const formattedMessage = welcomeMessage.replace('{userNames}', names.join(', '));

    const styled = AuroraBetaStyler.styleOutput({
      headerText: 'Welcome',
      headerSymbol: '🎉',
      headerStyle: 'bold',
      bodyText: formattedMessage,
      bodyStyle: 'sansSerif',
      footerText: footer,
    });

    api.sendMessage({ body: styled, mentions }, threadID);
  },

  async run({ api, event, args }) {
    const { threadID, messageID } = event;
    const newMessage = args.join(' ');

    if (!newMessage) {
      return api.sendMessage(
        AuroraBetaStyler.styleOutput({
          headerText: 'Set Welcome',
          headerSymbol: '❌',
          headerStyle: 'bold',
          bodyText: 'Please provide a welcome message (e.g., #setwelcome Welcome {userNames}!).',
          bodyStyle: 'sansSerif',
          footerText: footer,
        }),
        threadID,
        messageID
      );
    }

    try {
      global.welcomeMessage = newMessage;

      await api.sendMessage(
        AuroraBetaStyler.styleOutput({
          headerText: 'Set Welcome',
          headerSymbol: '✅',
          headerStyle: 'bold',
          bodyText: `Global welcome message updated to: ${newMessage}`,
          bodyStyle: 'sansSerif',
          footerText: footer,
        }),
        threadID,
        messageID
      );
    } catch (error) {
      await api.sendMessage(
        AuroraBetaStyler.styleOutput({
          headerText: 'Error',
          headerSymbol: '❌',
          headerStyle: 'bold',
          bodyText: `Error updating welcome message: ${error.message}`,
          bodyStyle: 'sansSerif',
          footerText: footer,
        }),
        threadID,
        messageID
      );
      await api.setMessageReaction('❌', messageID, () => {});
    }
  },
};
