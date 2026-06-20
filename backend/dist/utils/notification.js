"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotification = sendNotification;
const uuid_1 = require("uuid");
const models_1 = require("../models");
/**
 * Sends a notification based on the tenant's chosen channel (SMS, WhatsApp API, or Manual WhatsApp)
 */
async function sendNotification(tenantId, phone, message) {
    const config = await models_1.WhatsappConfig.findOne({ tenantId });
    const channel = config?.notificationChannel || 'MANUAL_WHATSAPP';
    // Clean phone number (remove spaces, symbols)
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (channel === 'MANUAL_WHATSAPP') {
        // Log as PENDING_MANUAL or SENT for history tracking
        await models_1.MessageLog.create({
            _id: (0, uuid_1.v4)(),
            tenantId,
            recipient: phone,
            message: message,
            status: 'SENT',
        });
        return {
            mode: 'MANUAL',
            success: true,
            phone: cleanPhone,
            message
        };
    }
    if (channel === 'API_WHATSAPP') {
        if (!config || !config.apiUrl || !config.token) {
            throw new Error('WhatsApp API credentials are not configured. Please go to settings.');
        }
        try {
            console.log(`[WHATSAPP API DISPATCH] Sending to ${cleanPhone} via ${config.apiUrl}`);
            const payload = {
                token: config.token,
                to: cleanPhone,
                body: message
            };
            const response = await fetch(config.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(`WhatsApp API responded with status ${response.status}: ${errorText}`);
            }
            await models_1.MessageLog.create({
                _id: (0, uuid_1.v4)(),
                tenantId,
                recipient: phone,
                message: message,
                status: 'SENT',
            });
            return {
                mode: 'API',
                success: true,
                phone: cleanPhone,
                message
            };
        }
        catch (error) {
            console.error('[WHATSAPP API ERROR]', error);
            await models_1.MessageLog.create({
                _id: (0, uuid_1.v4)(),
                tenantId,
                recipient: phone,
                message: message,
                status: 'FAILED',
            });
            throw new Error(`WhatsApp API dispatch failed: ${error.message}`);
        }
    }
    if (channel === 'SMS') {
        if (!config || !config.fast2smsApiKey) {
            throw new Error('Fast2SMS API Key is not configured. Please go to settings.');
        }
        try {
            console.log(`[SMS DISPATCH] Sending SMS to ${cleanPhone} via Fast2SMS`);
            const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
                method: 'POST',
                headers: {
                    'authorization': config.fast2smsApiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    route: 'q',
                    message: message,
                    numbers: cleanPhone
                })
            });
            const resData = await response.json().catch(() => ({}));
            if (!response.ok || resData.return === false) {
                throw new Error(resData.message || `Fast2SMS responded with status ${response.status}`);
            }
            await models_1.MessageLog.create({
                _id: (0, uuid_1.v4)(),
                tenantId,
                recipient: phone,
                message: message,
                status: 'SENT',
            });
            return {
                mode: 'SMS',
                success: true,
                phone: cleanPhone,
                message
            };
        }
        catch (error) {
            console.error('[SMS ERROR]', error);
            await models_1.MessageLog.create({
                _id: (0, uuid_1.v4)(),
                tenantId,
                recipient: phone,
                message: message,
                status: 'FAILED',
            });
            throw new Error(`SMS dispatch failed: ${error.message}`);
        }
    }
    throw new Error(`Unsupported notification channel: ${channel}`);
}
