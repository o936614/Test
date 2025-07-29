const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const fs = require("fs/promises");
const path = require("path");
const { Telegraf } = require("telegraf"); // Correct import for telegraf@4

// Bot settings
const BOT_TOKEN = "7311226265:AAGfb0ednKMPlVlLqm6U-H4SoetKdwnP8Og"; // استبدل بتوكن البوت من BotFather
const apiId = 26525079; // استبدل بـ api_id من my.telegram.org
const apiHash = "1a11e1d7da390e53b298e5707a5e88f6"; // استبدل بـ api_hash من my.telegram.org
const stringSession = new StringSession("1BAAOMTQ5LjE1NC4xNjcuOTEAUAYY2qwwCRmTrIw2vug6c9idLYuCX/zzIwTnT2Hmlk0X809RYMkV1Am1Sgzjkev5TOCA8bHx50WQzIkJJFTERz/zRvKsZMtM7gDmTzV444jet5JU1ahvbX8d5V6M67O0S0LOWTZiysPYuoUGV22aEZg6dMeECYC2VDM4bC00GLjgGK8E0Rx1sPgfKpaZqBcCiL7u+sYJkPsskvL9c0yyWu0cP7nsEUvX7OUQg2qx8NKuEGOk6IpViVmEnH36Iro6PHvPF6II5OI44A7c4v6J29Ug6mLZzkFJzJvL/bmd5YZgMAc0Y9XI4Qwqyr9wHKium0SHbr43ybAsciGWltrjVpU="); // سيتم حفظ الجلسة هنا بعد تسجيل الدخول

// Create MTProto client
const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

// Create Telegraf bot
const bot = new Telegraf(BOT_TOKEN);

// Function to download file
async function downloadFile(message) {
  try {
    const file = message.media;
    if (!file) {
      return { success: false, error: "No file found in the message" };
    }

    // Determine file type
    let fileType = "document";
    if (file.photo) fileType = "photo";
    else if (file.video) fileType = "video";
    else if (file.audio) fileType = "audio";

    // File name (fallback to message ID if no name)
    const fileName = file.document
      ? file.document.attributes.find((attr) => attr.fileName)?.fileName ||
        `file_${message.id}.${file.document.mimeType.split("/")[1] || "bin"}`
      : `file_${message.id}.${fileType}`;

    // Download the file
    const buffer = await client.downloadMedia(message.media, {
      progressCallback: (progress) => {
        console.log(`Downloading: ${(progress * 100).toFixed(2)}%`);
      },
    });

    // Save file temporarily
    const filePath = path.join(__dirname, "downloads", fileName);
    await fs.mkdir(path.join(__dirname, "downloads"), { recursive: true });
    await fs.writeFile(filePath, buffer);

    return { success: true, filePath, fileName };
  } catch (error) {
    console.error("Download error:", error);
    return { success: false, error: error.message };
  }
}

// Function to upload file
async function uploadFile(chatId, filePath, fileName, ctx) {
  try {
    const fileBuffer = await fs.readFile(filePath);
    await ctx.telegram.sendDocument(chatId, {
      source: fileBuffer,
      filename: fileName,
    });
    // Delete file after upload
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    console.error("Upload error:", error);
    return { success: false, error: error.message };
  }
}

// Start command
bot.start((ctx) => {
  ctx.reply(
    "مرحبًا! أرسل رابط رسالة تحتوي على ملف من قناة أو مجموعة خاصة، وسأقوم بتحميله وإعادة رفعه لك."
  );
});

// Handle text messages (links)
bot.on("text", async (ctx) => {
  const messageText = ctx.message.text;
  const chatId = ctx.message.chat.id;

  // Validate Telegram message link
  const messageLinkRegex = /t\.me\/(?:c\/)?(\w+)\/(\d+)/;
  const match = messageText.match(messageLinkRegex);

  if (!match) {
    return ctx.reply("يرجى إرسال رابط رسالة صالح (مثال: https://t.me/c/123456789/123)");
  }

  const [, channelId, messageId] = match;

  try {
    // Resolve channel ID to Peer
    let peer;
    if (channelId.startsWith("c/")) {
      const realChannelId = channelId.replace("c/", "");
      peer = { _: "inputPeerChannel", channelId: parseInt(realChannelId), accessHash: 0 };
    } else {
      const entity = await client.getEntity(channelId);
      peer = entity;
    }

    // Fetch the message
    const messages = await client.getMessages(peer, { ids: [parseInt(messageId)] });
    if (!messages[0]) {
      return ctx.reply("لم يتم العثور على الرسالة!");
    }

    const message = messages[0];
    if (!message.media) {
      return ctx.reply("الرسالة لا تحتوي على ملف!");
    }

    ctx.reply("جارٍ تحميل الملف...");
    const downloadResult = await downloadFile(message);

    if (!downloadResult.success) {
      return ctx.reply(`فشل تحميل الملف: ${downloadResult.error}`);
    }

    ctx.reply("جارٍ رفع الملف...");
    const uploadResult = await uploadFile(
      chatId,
      downloadResult.filePath,
      downloadResult.fileName,
      ctx
    );

    if (uploadResult.success) {
      ctx.reply("تم رفع الملف بنجاح!");
    } else {
      ctx.reply(`فشل رفع الملف: ${uploadResult.error}`);
    }
  } catch (error) {
    console.error("Error:", error);
    ctx.reply(`حدث خطأ: ${error.message}`);
  }
});

// Start bot and MTProto client
(async () => {
  try {
    await client.start({
      phoneNumber: async () => {
        return new Promise((resolve) => {
          const readline = require("readline").createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          readline.question("أدخل رقم هاتفك: ", (num) => {
            readline.close();
            resolve(num);
          });
        });
      },
      phoneCode: async () => {
        return new Promise((resolve) => {
          const readline = require("readline").createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          readline.question("أدخل رمز التحقق: ", (code) => {
            readline.close();
            resolve(code);
          });
        });
      },
      password: async () => {
        return new Promise((resolve) => {
          const readline = require("readline").createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          readline.question("أدخل كلمة مرور التحقق بخطوتين (2FA): ", (pwd) => {
            readline.close();
            resolve(pwd);
          });
        });
      },
      onError: (err) => console.log("Auth error:", err),
    });

    console.log("Logged in to MTProto client");
    console.log("MTProto session:", client.session.save());

    await bot.launch();
    console.log("Bot is running!");
  } catch (error) {
    console.error("Startup error:", error);
    process.exit(1);
  }
})();

// Handle graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));