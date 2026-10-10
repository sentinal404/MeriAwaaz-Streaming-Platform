import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudvault';

const migrate = async () => {
    try {
        await mongoose.connect(uri);
        console.log("Connected to MongoDB for migration.");

        const Access = mongoose.model('Access', new mongoose.Schema({
            user_id: String,
            storage_id: String,
            access_type: String
        }, { collection: 'accesses' }));

        const Storage = mongoose.model('Storage', new mongoose.Schema({
            id: String,
            user_id: String
        }, { collection: 'storages' }));

        const admins = await Access.find({ access_type: 'a' });
        console.log(`Found ${admins.length} administrators in 'accesses' collection.`);

        for (const admin of admins) {
            console.log(`Setting owner of storage ${admin.storage_id} to user ${admin.user_id}`);
            const result = await Storage.updateOne(
                { id: admin.storage_id },
                { $set: { user_id: admin.user_id } }
            );
            console.log(`Result: ${result.modifiedCount} documents updated.`);
        }

        console.log("Migration completed.");
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
};

migrate();
