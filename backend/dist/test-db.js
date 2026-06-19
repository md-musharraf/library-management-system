"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function run() {
    console.log('--- Database Tenants ---');
    const tenants = await prisma.tenant.findMany();
    console.log(JSON.stringify(tenants, null, 2));
    console.log('------------------------');
}
run()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
