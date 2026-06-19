"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const MONGODB_URI = process.env.MONGODB_URI || '';
if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in .env\n' +
        'Please add your MongoDB Atlas connection string to backend/.env\n' +
        'Example: MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/lms');
}
let isConnected = false;
async function connectDB() {
    if (isConnected)
        return;
    try {
        await mongoose_1.default.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        isConnected = true;
        console.log('✅ MongoDB Atlas connected successfully');
    }
    catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        process.exit(1);
    }
}
exports.default = mongoose_1.default;
