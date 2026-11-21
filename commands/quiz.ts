import axios from "axios";
import AuroraBetaStyler from "@aurora/styler";

const QUESTION_TTL = 60 * 1000;
const DIFFICULTIES = ["easy", "medium", "hard"];
const TOP_LIMIT = 10;

const style = (headerText: string, headerSymbol: string, bodyText: string) =>
  AuroraBetaStyler.styleOutput({
    headerText,
    headerSymbol,
    headerStyle: "bold",
    bodyText,
    bodyStyle: "bold",
    footerText: "Developed by: **Aljur pogoy**",
  });

const decodeHtml = (text: string) =>
  String(text)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&amp;/g, "&");

const parseAnswer = (body: string | undefined, choices: Record<string, string>) => {
  const text = (body || "").trim();
  if (!text) return null;

  const upper = text.toUpperCase();
  if (/^[A-Z][.)]?$/.test(upper) && choices[upper.charAt(0)]) return upper.charAt(0);

  return (
    Object.keys(choices).find(
      (key) => decodeHtml(choices[key]).toLowerCase() === text.toLowerCase()
    ) || null
  );
};

const recordResult = async (api: any, db: any, userId: string, isCorrect: boolean) => {
  if (!db) return;

  try {
    let name = `User ${userId}`;
    try {
      const info = await api.getUserInfo([userId]);
      name = info?.[userId]?.name || name;
    } catch {}

    await db.db("quizScores").updateOne(
      { userId },
      {
        $inc: { total: 1, correct: isCorrect ? 1 : 0 },
        $set: { userId, name, updatedAt: new Date() },
      },
      { upsert: true }
    );
  } catch (err: any) {
    console.error(`Quiz score error: ${err.message}`);
  }
};

const sendTop = async (api: any, db: any, threadID: any, messageID: any, senderID: any) => {
  if (!db) {
    return api.sendMessage(
      style("Quiz Top", "⚠️", "Database not available. Ensure MongoDB is connected."),
      threadID,
      messageID
    );
  }

  const docs = await db.db("quizScores").find({}).toArray();

  const ranked = docs
    .map((d: any) => ({
      userId: String(d.userId),
      name: d.name || `User ${d.userId}`,
      correct: Number(d.correct) || 0,
      total: Number(d.total) || 0,
    }))
    .filter((e: any) => e.total > 0)
    .sort(
      (a: any, b: any) =>
        b.correct - a.correct || b.correct / b.total - a.correct / a.total
    );

  if (ranked.length === 0) {
    return api.sendMessage(
      style("Quiz Top", "📋", "No quiz scores yet. Play with /quiz!"),
      threadID,
      messageID
    );
  }

  const medals = ["🥇", "🥈", "🥉"];
  const lines = ranked.slice(0, TOP_LIMIT).map(
    (e: any, i: number) =>
      `${medals[i] || `${i + 1}.`} ${e.name}\n    ${e.correct} correct • ${e.total} played • ${Math.round(
        (e.correct / e.total) * 100
      )}%`
  );

  const myIndex = ranked.findIndex((e: any) => e.userId === String(senderID));
  const mine =
    myIndex >= 0
      ? `\n\nYour rank: #${myIndex + 1} • ${ranked[myIndex].correct} correct`
      : "\n\nYou haven't played yet. Try /quiz!";

  return api.sendMessage(
    style("Quiz Top 10", "🏆", lines.join("\n\n") + mine),
    threadID,
    messageID
  );
};

const quizCommand: ShadowBot.Command = {
  config: {
    name: "quiz",
    author: "Aljur pogoy",
    description: "Answer a random quiz question by replying with A, B, C, or D. Use 'top' for the leaderboard.",
    usage: "/quiz [easy|medium|hard] | /quiz top",
    aliases: ["trivia"],
    category: "Fun 🎉",
    cooldown: 5,
    role: 0,
  },

  run: async ({ api, event, args, db }) => {
    const { threadID, messageID, senderID } = event;

    const send = (header: string, symbol: string, body: string) =>
      api.sendMessage(style(header, symbol, body), threadID, messageID);

    const firstArg = (args[0] || "").toLowerCase();

    if (firstArg === "top") {
      try {
        return await sendTop(api, db, threadID, messageID, senderID);
      } catch (error: any) {
        console.error("Error in quiz top:", error);
        return send("Quiz Top", "❌", `Failed to load the leaderboard.\n${error.message || "Unknown error"}`);
      }
    }

    const difficulty = firstArg || "easy";

    if (!DIFFICULTIES.includes(difficulty)) {
      return send("Quiz", "⚠️", "Usage:\n• /quiz [easy|medium|hard]\n• /quiz top");
    }

    try {
      const response = await axios.get("https://www.zyckee.org/quiz", {
        params: { difficulty, limit: 1 },
        timeout: 30000,
      });

      const question = response.data?.questions?.[0];
      const choices: Record<string, string> = question?.choices;
      const correct = String(question?.correct_answer || "").toUpperCase();

      if (!question?.question || !choices || !choices[correct]) {
        return send("Quiz", "❌", "Couldn't get a quiz question. Please try again.");
      }

      const letters = Object.keys(choices).sort();
      const correctText = decodeHtml(choices[correct]);

      const bodyText =
        `${decodeHtml(question.question)}\n\n` +
        `Category: ${decodeHtml(question.category || "General")}\n` +
        `Difficulty: ${question.difficulty || difficulty}\n\n` +
        letters.map((letter) => `${letter}. ${decodeHtml(choices[letter])}`).join("\n") +
        `\n\nReply to this message with your answer (${letters.join(", ")}). You have ${QUESTION_TTL / 1000} seconds.`;

      const sent: any = await new Promise((resolve) => {
        api.sendMessage(style("Quiz", "🧠", bodyText), threadID, (err: any, info: any) => resolve(info), messageID);
      });

      if (!sent?.messageID) return;

      if (!global.Kagenou.replyListeners) global.Kagenou.replyListeners = new Map();

      const botMsgID = sent.messageID;
      let finished = false;
      let timer: ReturnType<typeof setTimeout>;

      const finish = () => {
        finished = true;
        clearTimeout(timer);
        global.Kagenou.replyListeners.delete(botMsgID);
      };

      timer = setTimeout(() => {
        if (finished) return;
        finish();
        api.sendMessage(
          style("Quiz", "⏰", `Time's up! The correct answer was ${correct}. ${correctText}`),
          threadID
        );
      }, QUESTION_TTL);

      global.Kagenou.replyListeners.set(botMsgID, {
        callback: async ({ api: replyApi, event: replyEvent }: any) => {
          const { threadID: rThreadID, messageID: rMessageID, senderID: rSenderID, body } = replyEvent;

          if (finished || rThreadID !== threadID) return;
          if (String(rSenderID) !== String(senderID)) return;

          const answer = parseAnswer(body, choices);

          if (!answer) {
            return replyApi.sendMessage(
              style("Quiz", "⚠️", `Please reply with ${letters.join(", ")}.`),
              rThreadID,
              rMessageID
            );
          }

          finish();

          const isCorrect = answer === correct;
          await recordResult(replyApi, db, String(senderID), isCorrect);

          if (isCorrect) {
            return replyApi.sendMessage(
              style("Correct!", "🎉", `${correct}. ${correctText} is the right answer!`),
              rThreadID,
              rMessageID
            );
          }

          return replyApi.sendMessage(
            style("Wrong!", "❌", `The correct answer was ${correct}. ${correctText}`),
            rThreadID,
            rMessageID
          );
        },
      });
    } catch (error: any) {
      console.error("Error in quiz command:", error);
      return send("Quiz", "❌", `Failed to fetch a quiz question.\n${error.message || "Unknown error"}`);
    }
  },
};

export default quizCommand;
