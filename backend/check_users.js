import mongoose from 'mongoose';
import { User } from './db/index.js';

import dotenv from 'dotenv';
dotenv.config();
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/meriawaaaz';
await mongoose.connect(uri);

const users = await User.find({}, 'id username email role is_banned strikes');
console.log("USERS IN DB:", JSON.stringify(users, null, 2));
process.exit(0);
