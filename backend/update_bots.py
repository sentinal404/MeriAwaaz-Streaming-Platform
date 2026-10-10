from pymongo import MongoClient

tokens = [
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
]

client = MongoClient('mongodb://localhost:27017/')
db = client['meriawaaaz']

# Update storagemanagers
res1 = db.storagemanagers.update_many({'state': 'National'}, {'$set': {'telegram_bot_tokens': tokens, 'telegram_bot_token': tokens[0]}})
print("storagemanagers updated:", res1.modified_count)

# Update pfpstorageconfigs
res2 = db.pfpstorageconfigs.update_many({}, {'$set': {'telegram_bot_tokens': tokens}})
print("pfpstorageconfigs updated:", res2.modified_count)
