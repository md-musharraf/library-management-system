"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const uri = process.env.MONGODB_URI || '';
console.log('Connecting to database using environment variables...');
async function test() {
    try {
        await mongoose_1.default.connect(uri, { serverSelectionTimeoutMS: 5000 });
        console.log('✅ Connected successfully!');
        await mongoose_1.default.disconnect();
    }
    catch (err) {
        console.error('❌ Connection failed:', err);
    }
}
test();
