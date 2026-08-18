export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("OK");
    }

    try {
      const update = await request.json();
      const message = update.message;

      if (!message) {
        return new Response("OK");
      }

      // Only respond to messages from the admin
      if (String(message.chat.id) !== String(env.ADMIN_CHAT_ID)) {
        return new Response("OK");
      }

      /*
       * Expected:
       * - Admin sends an audio
       * - Admin replies to that audio with:
       *   00:30 01:45
       */

      const repliedMessage = message.reply_to_message;
      const text = message.text?.trim();

      // Admin sent an audio without replying to it
      if (message.audio) {
        await telegram(
          "sendMessage",
          {
            chat_id: message.chat.id,
            text: "Now reply to this audio with the trim times.\nExample: 00:30 01:45",
          },
          env
        );

        return new Response("OK");
      }

      // Message isn't a reply to anything
      if (!repliedMessage) {
        await telegram(
          "sendMessage",
          {
            chat_id: message.chat.id,
            text: "Reply to an audio with the trim times.\nExample: 00:30 01:45",
          },
          env
        );

        return new Response("OK");
      }

      // Reply isn't to an audio
      if (!repliedMessage.audio) {
        await telegram(
          "sendMessage",
          {
            chat_id: message.chat.id,
            text: "You must reply to an audio file.\nExample: 00:30 01:45",
          },
          env
        );

        return new Response("OK");
      }

      // Validate time format
      if (!text) {
        await telegram(
          "sendMessage",
          {
            chat_id: message.chat.id,
            text: "Enter the trim times.\nExample: 00:30 01:45",
          },
          env
        );

        return new Response("OK");
      }

      const match = text.match(
        /^(\d{1,2}):([0-5]\d)\s+(\d{1,2}):([0-5]\d)$/
      );

      if (!match) {
        await telegram(
          "sendMessage",
          {
            chat_id: message.chat.id,
            text: "Invalid format.\nUse: 00:30 01:45",
          },
          env
        );

        return new Response("OK");
      }

      const start =
        Number(match[1]) * 60 +
        Number(match[2]);

      const end =
        Number(match[3]) * 60 +
        Number(match[4]);

      if (end <= start) {
        await telegram(
          "sendMessage",
          {
            chat_id: message.chat.id,
            text: "End time must be after start time.",
          },
          env
        );

        return new Response("OK");
      }

      // Get Telegram file information
      const file = await telegram(
        "getFile",
        {
          file_id: repliedMessage.audio.file_id,
        },
        env
      );

      if (!file.ok) {
        console.error("getFile failed:", file);

        await telegram(
          "sendMessage",
          {
            chat_id: message.chat.id,
            text: "Couldn't access the audio file.",
          },
          env
        );

        return new Response("OK");
      }

      // Temporary Telegram download URL
      const telegramUrl =
        `https://api.telegram.org/file/bot${env.BOT_TOKEN}/${file.result.file_path}`;

      // Create CloudConvert job
      const jobResponse = await fetch(
        "https://sync.api.cloudconvert.com/v2/jobs",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.CLOUDCONVERT_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tasks: {
              "import-audio": {
                operation: "import/url",
                url: telegramUrl,
                filename: "input.audio",
              },

              "trim-audio": {
                operation: "command",
                input: "import-audio",
                engine: "ffmpeg",
                command: "ffmpeg",
                arguments:
                  `-i /input/import-audio/input.audio ` +
                  `-ss ${start} ` +
                  `-to ${end} ` +
                  `-vn ` +
                  `-c:a libmp3lame ` +
                  `-b:a 192k ` +
                  `/output/trimmed.mp3`,
              },

              "export-audio": {
                operation: "export/url",
                input: "trim-audio",
              },
            },
          }),
        }
      );

      const job = await jobResponse.json();

      // CloudConvert failed
      if (!jobResponse.ok || job.data?.status !== "finished") {
        console.error("CloudConvert error:", job);

        await telegram(
          "sendMessage",
          {
            chat_id: message.chat.id,
            text: "Conversion failed. Please try again.",
          },
          env
        );

        return new Response("OK");
      }

      const exportTask = job.data.tasks.find(
        (task) => task.name === "export-audio"
      );

      const outputFile = exportTask?.result?.files?.[0];

      if (!outputFile?.url) {
        console.error("No output URL:", job);

        await telegram(
          "sendMessage",
          {
            chat_id: message.chat.id,
            text: "Conversion failed: no output file was produced.",
          },
          env
        );

        return new Response("OK");
      }

      // Send result back to admin
      const result = await telegram(
        "sendAudio",
        {
          chat_id: message.chat.id,
          audio: outputFile.url,
          title: repliedMessage.audio.title || "Trimmed Audio",
        },
        env
      );

      if (!result.ok) {
        console.error("sendAudio failed:", result);

        await telegram(
          "sendMessage",
          {
            chat_id: message.chat.id,
            text: "The audio was converted, but I couldn't send the result.",
          },
          env
        );
      }

      return new Response("OK");
    } catch (error) {
      console.error("ERROR:", error);

      // Try to tell the admin about unexpected errors
      try {
        await telegram(
          "sendMessage",
          {
            chat_id: env.ADMIN_CHAT_ID,
            text: "Something went wrong while processing the audio.",
          },
          env
        );
      } catch (telegramError) {
        console.error("Failed to send error message:", telegramError);
      }

      return new Response("OK");
    }
  },
};


async function telegram(method, body, env) {
  const response = await fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  return await response.json();
}