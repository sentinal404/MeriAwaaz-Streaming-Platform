import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const tokens = [
  "YOUR_TELEGRAM_BOT_TOKEN_HERE",
  "YOUR_TELEGRAM_BOT_TOKEN_HERE",
  "YOUR_TELEGRAM_BOT_TOKEN_HERE",
  "YOUR_TELEGRAM_BOT_TOKEN_HERE",
  "YOUR_TELEGRAM_BOT_TOKEN_HERE",
  "YOUR_TELEGRAM_BOT_TOKEN_HERE",
  "YOUR_TELEGRAM_BOT_TOKEN_HERE",
  "YOUR_TELEGRAM_BOT_TOKEN_HERE",
  "YOUR_TELEGRAM_BOT_TOKEN_HERE",
  "YOUR_TELEGRAM_BOT_TOKEN_HERE"
];

async function run() {
  await mongoose.connect('mongodb://localhost:27017/meriawaaaz');
  const { StorageManager, PFPStorageConfig } = await import('./db/index.js');
  
  // Update National StorageManager
  const nationalManager = await StorageManager.findOne({ state: 'National' });
  if (nationalManager) {
    nationalManager.telegram_bot_tokens = tokens;
    if (tokens.length > 0) {
      nationalManager.telegram_bot_token = tokens[0]; // Set default as well
    }
    await nationalManager.save();
    console.log("Updated National StorageManager");
  }

  // Update PFPStorageConfig
  const pfpConfig = await PFPStorageConfig.findOne({});
  if (pfpConfig) {
    pfpConfig.telegram_bot_tokens = tokens;
    await pfpConfig.save();
    console.log("Updated PFPStorageConfig");
  }

  console.log("Done adding bots.");
  process.exit(0);
}

run();
