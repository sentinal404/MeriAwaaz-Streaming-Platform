import mongoose from 'mongoose';
import { User, TempPost } from './db/index.js';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/meriawaaaz';

async function run() {
    await mongoose.connect(uri);
    const user = await User.findOne({ email: 'user@test.com' });
    console.log("Mod User:", user);
    
    const posts = await TempPost.find({ status: 'pending' });
    console.log("Pending Posts:", posts.map(p => ({ id: p._id, title: p.title, state: p.state, city: p.city, status: p.status })));
    
    process.exit(0);
}
run();
