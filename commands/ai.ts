import axios from 'axios';
import AuroraBetaStyler from '@aurora/styler';

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_MODEL = 'mistralai/mistral-large-4-1t-a52b';
const MAX_HISTORY = 10;
const histories = new Map<string, { role: 'user' | 'assistant'; content: string }[]>();

const aiCommand: ShadowBot.Command = {
  config: {
    name: 'ai',
    description: 'Chat with AI',
    usage: 'ai <message>',
    nonPrefix: true,
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    if (!threadID || !messageID) return;

    const footer = 'Developed by: **Aljur Pogoy**';
    const errorMsg = (headerText: string, bodyText: string) =>
      AuroraBetaStyler.styleOutput({
        headerText,
        headerSymbol: '❌',
        headerStyle: 'bold',
        bodyText,
        bodyStyle: 'sansSerif',
        footerText: footer,
      });

    const query = args.join(' ').trim();
    if (!query) {
      return api.sendMessage(errorMsg('Query', 'Please provide a message.'), threadID, messageID);
    }

    const getImageUrl = (ev: any): string => {
      const attachments = ev.messageReply?.attachments || [];
      const img = attachments.find(
        (a: any) => a.type === 'photo' || a.type === 'sticker' || a.type === 'animated_image'
      );
      return img?.url || img?.previewUrl || '';
    };
    const toDataUrl = async (url: string): Promise<string> => {
      const res = await axios.get(url, { responseType: 'arraybuffer' });
      const mime = (res.headers['content-type'] as string) || 'image/jpeg';
      return `data:${mime};base64,${Buffer.from(res.data).toString('base64')}`;
    };

    const askAI = async (text: string, imageUrl: string = '') => {
      const apiKey = process.env.NVIDIA_API_KEY;
      if (!apiKey) throw new Error('NVIDIA_API_KEY is not set');

      const history = histories.get(senderID) || [];

      const content: any = imageUrl
        ? [
            { type: 'text', text },
            { type: 'image_url', image_url: { url: await toDataUrl(imageUrl) } },
          ]
        : text;

      const res = await axios.post(
        NVIDIA_URL,
        {
          model: NVIDIA_MODEL,
          messages: [...history, { role: 'user', content }],
          max_tokens: 4096,
          stream: false,
          temperature: 0.5,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
          reasoning_effort: 'high',
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          timeout: 120000,
        }
      );

      const answer: string = res.data?.choices?.[0]?.message?.content || 'No response.';
      history.push({ role: 'user', content: imageUrl ? `${text} [image attached]` : text });
      history.push({ role: 'assistant', content: answer });
      histories.set(senderID, history.slice(-MAX_HISTORY));

      return answer;
    };

    const registerReply = (botMsgID: string) => {
      if (!global.Kagenou.replyListeners) global.Kagenou.replyListeners = new Map();

      global.Kagenou.replyListeners.set(botMsgID, {
        callback: async ({ api, event }: any) => {
          const { threadID: rThreadID, messageID: rMessageID, body } = event;
          if (rThreadID !== threadID) return;

          const followUp = body?.trim();
          if (!followUp) return;

          global.Kagenou.replyListeners.delete(botMsgID);

          try {
            const nextResponse = await askAI(followUp, getImageUrl(event));
            const nextStyled = AuroraBetaStyler.styleOutput({
              headerText: 'AI',
              headerSymbol: '🤖',
              headerStyle: 'bold',
              bodyText: nextResponse,
              bodyStyle: 'sansSerif',
              footerText: 'Reply to continue the conversation',
            });

            await new Promise<void>((resolve) => {
              api.sendMessage(nextStyled, rThreadID, (err: any, info: any) => {
                if (info?.messageID) registerReply(info.messageID);
                resolve();
              }, rMessageID);
            });
          } catch {
            await api.sendMessage(
              errorMsg('Error', 'Failed to process your message.'),
              rThreadID,
              rMessageID
            );
          }
        },
      });
    };

    try {
      const aiResponse = await askAI(query, getImageUrl(event));

      const styledMessage = AuroraBetaStyler.styleOutput({
        headerText: 'AI',
        headerSymbol: '🤖',
        headerStyle: 'bold',
        bodyText: aiResponse,
        bodyStyle: 'sansSerif',
        footerText: 'Reply to continue the conversation',
      });

      await new Promise<void>((resolve) => {
        api.sendMessage(styledMessage, threadID, (err: any, info: any) => {
          if (info?.messageID) registerReply(info.messageID);
          resolve();
        }, messageID);
      });
    } catch (error: any) {
      console.error('AI error:', error?.response?.status, error?.response?.data || error?.message);
      await api.sendMessage(errorMsg('AI ERROR', 'Failed to contact AI.'), threadID, messageID);
    }
  },
};

export default aiCommand;
