"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
// Direct connection string bypassing SRV lookup
const directUri = "mongodb://devwithmusharraf_db_user:XSS5GLLynHnuwxdF@ac-bnzyqyo-shard-00-00.9vvzcql.mongodb.net:27017,ac-bnzyqyo-shard-00-01.9vvzcql.mongodb.net:27017,ac-bnzyqyo-shard-00-02.9vvzcql.mongodb.net:27017/lms?ssl=true&authSource=admin&retryWrites=true&w=majority";
console.log('Connecting directly to:', directUri.replace(/:[^@]+@/, ':****@'));
async function test() {
    try {
        await mongoose_1.default.connect(directUri, { serverSelectionTimeoutMS: 5000 });
        console.log('✅ Connected successfully directly!');
        await mongoose_1.default.disconnect();
    }
    catch (err) {
        console.error('❌ Connection failed directly:', err);
    }
}
test();
