"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("./models");
const db_1 = require("./db");
async function clearDatabase() {
    console.log('Connecting to database...');
    await (0, db_1.connectDB)();
    console.log('Wiping all collections...');
    const results = await Promise.all([
        models_1.Tenant.deleteMany({}),
        models_1.User.deleteMany({}),
        models_1.Student.deleteMany({}),
        models_1.Shift.deleteMany({}),
        models_1.Plan.deleteMany({}),
        models_1.Seat.deleteMany({}),
        models_1.Booking.deleteMany({}),
        models_1.Payment.deleteMany({}),
        models_1.WhatsappConfig.deleteMany({}),
        models_1.MessageLog.deleteMany({}),
        models_1.Attendance.deleteMany({}),
        models_1.Expense.deleteMany({}),
        models_1.Session.deleteMany({})
    ]);
    console.log('\nDatabase Wiped Successfully!');
    console.log(`- Tenants deleted: ${results[0].deletedCount}`);
    console.log(`- Users deleted: ${results[1].deletedCount}`);
    console.log(`- Students deleted: ${results[2].deletedCount}`);
    console.log(`- Shifts deleted: ${results[3].deletedCount}`);
    console.log(`- Plans deleted: ${results[4].deletedCount}`);
    console.log(`- Seats deleted: ${results[5].deletedCount}`);
    console.log(`- Bookings deleted: ${results[6].deletedCount}`);
    console.log(`- Payments deleted: ${results[7].deletedCount}`);
    console.log(`- WhatsappConfigs deleted: ${results[8].deletedCount}`);
    console.log(`- MessageLogs deleted: ${results[9].deletedCount}`);
    console.log(`- Attendances deleted: ${results[10].deletedCount}`);
    console.log(`- Expenses deleted: ${results[11].deletedCount}`);
    console.log(`- Sessions deleted: ${results[12].deletedCount}`);
    await mongoose_1.default.disconnect();
    console.log('\nDisconnected from database.');
}
clearDatabase().catch(err => {
    console.error('Error wiping database:', err);
});
