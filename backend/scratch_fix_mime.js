import dotenv from 'dotenv';
dotenv.config();
import { connectDB, Post } from './db/index.js';

connectDB().then(async () => {
    const res = await Post.updateMany({ mime_type: { $exists: false } }, { $set: { mime_type: 'video/mp4' } });
    console.log(`Updated ${res.modifiedCount} posts`);
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
