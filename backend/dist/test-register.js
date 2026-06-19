"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const postData = JSON.stringify({
    libraryName: 'Test Library',
    ownerName: 'Test Owner',
    phone: '1234567890',
    address: '123 Test St',
    email: 'test@library.com',
    password: 'password123',
});
const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register-tenant',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
    },
};
const req = http_1.default.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});
req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});
// Write data to request body
req.write(postData);
req.end();
