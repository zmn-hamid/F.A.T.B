# F.A.T.B: Free Audio Trimming Bot

A simple Telegram bot running on **Cloudflare Workers** that trims audio using the **CloudConvert API**. Anything about this setup is free for the average person.

## Requirements

* A [Telegram bot](https://core.telegram.org/bots/features) created with BotFather
* A Cloudflare account with Workers
* A CloudConvert account and API key ([CloudConvert](https://cloudconvert.com/))

## Installation

### 1. Create a Telegram bot

1. Open [@BotFather](https://t.me/BotFather) on Telegram.
2. Send `/newbot`.
3. Choose a name for your bot.
4. Choose a username ending in `bot`, for example `my_audio_trimmer_bot`.
5. BotFather will give you a **bot token**. Keep it secret — you will need it later as `BOT_TOKEN`.

### 2. Get the code

Open the **[worker.js](./worker.js)**, copy everything (you can use the "Copy raw file" button), and keep it ready for the next step.

### 3. Create a Cloudflare Worker

1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Go to **Compute** > **Workers & Pages**.
3. Click **Create application**.
4. Select **Start with Hello World!** and deploy it.
5. Click **Edit code** in the top-right corner.
6. Replace the default code with the contents of `worker.js`.
7. Deploy the Worker.

After deploying, Cloudflare will give your Worker a URL similar to:

```text
https://fatb.example.workers.dev
```

Keep this URL ready for the webhook setup.

### 4. Get your Telegram chat ID

The bot only allows the configured admin chat to use it. 

Get your chat id by sending a message to https://t.me/chatIDrobot. You'll receive a message like:

```
👤 name: Bro  
🆔 username: @username
📱 chat_id: 123456789   <-- this is what you need
🉐 language: en
```

### 5. Get a CloudConvert API key

1. Create a free account at [CloudConvert](https://cloudconvert.com/).
2. Go to **Dashboard** > **Authorization** > **API Keys**
3. Create an API key.
4. Copy the key and keep it secret — you will need it as `CLOUDCONVERT_API_KEY`.

> It's free for 10 audio trimming per day, for more, you gotta pay for the lifetime subscription.

### 6. Add the required secrets

Your Worker needs these three environment variables:

| Variable               | Description                                 |
| ---------------------- | ------------------------------------------- |
| `BOT_TOKEN`            | Your Telegram bot token                     |
| `ADMIN_CHAT_ID`        | The Telegram chat ID allowed to use the bot |
| `CLOUDCONVERT_API_KEY` | Your CloudConvert API key                   |

In the Worker, go to **Settings** > **Variables and Secrets** and add them.

For `BOT_TOKEN` and `CLOUDCONVERT_API_KEY` check the `secret` box to mark them as encrypted.

### 7. Set the Telegram webhook

After deploying the Worker and adding the required variables, copy your Worker URL.

Open this URL in your browser, replacing the placeholders:

```text
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<WORKER_URL>
```

For example:

```text
https://api.telegram.org/bot123456:ABC.../setWebhook?url=https://fatb.example.workers.dev
```

If successful, Telegram will return:

```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

Your bot is now ready to use.

## Usage

1. Send an audio file to the bot.
2. Reply to that audio with the desired start and end times.
3. Use the format:

```text
00:30 01:45
```

This trims the audio from **30 seconds** to **1 minute 45 seconds**.

Hours are not supported.

### Example

```text
Audio
└── Reply: 01:20 02:45
```

The bot will return the trimmed audio.

## How It Works

```text
Telegram
   │
   ▼
Cloudflare Worker
   │
   ▼
CloudConvert
   │
   ├── Downloads audio
   ├── Trims it with FFmpeg
   └── Creates MP3
   │
   ▼
Telegram
```

The Worker does not permanently store your audio.

## Security

Never share or commit your:

* Telegram bot token
* CloudConvert API key

If you accidentally expose either key, revoke it and generate a new one, then edit the environment keys in the settings.

## License

This project is licensed under the [MIT License](./LICENSE).
