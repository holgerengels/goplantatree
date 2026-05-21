import { describe, it, expect } from 'vitest';
import MailLog from '../../src/models/MailLog.js';

describe('MailLog Model', () => {
    it('should create a log entry with default status queued', async () => {
        const entry = await MailLog.create({
            to: 'test@example.com',
            from: 'sender@goplantatree.org',
            subject: 'Test',
            template: 'test'
        });

        expect(entry.status).toBe('queued');
        expect(entry.to).toBe('test@example.com');
        expect(entry.template).toBe('test');
        expect(entry.createdAt).toBeDefined();
    });

    it('should transition to sent with smtpResponse', async () => {
        const entry = await MailLog.create({
            to: 'user@example.com',
            subject: 'Confirmation',
            status: 'queued'
        });

        entry.status = 'sent';
        entry.sentAt = new Date();
        entry.smtpResponse = '250 OK';
        await entry.save();

        const found = await MailLog.findById(entry._id);
        expect(found.status).toBe('sent');
        expect(found.smtpResponse).toBe('250 OK');
        expect(found.sentAt).toBeDefined();
    });

    it('should transition to bounced with bounceInfo', async () => {
        const entry = await MailLog.create({
            to: 'bad@example.com',
            subject: 'Newsletter',
            status: 'sent',
            sentAt: new Date()
        });

        entry.status = 'bounced';
        entry.bounceInfo = {
            detectedAt: new Date(),
            type: 'hard',
            diagnosticCode: '550 5.1.1 User unknown',
            rawSubject: 'Undeliverable: Newsletter'
        };
        await entry.save();

        const found = await MailLog.findById(entry._id);
        expect(found.status).toBe('bounced');
        expect(found.bounceInfo.type).toBe('hard');
        expect(found.bounceInfo.diagnosticCode).toBe('550 5.1.1 User unknown');
    });

    it('should transition to failed with error', async () => {
        const entry = await MailLog.create({
            to: 'fail@example.com',
            subject: 'Test',
            status: 'queued'
        });

        entry.status = 'failed';
        entry.error = 'ECONNREFUSED';
        await entry.save();

        const found = await MailLog.findById(entry._id);
        expect(found.status).toBe('failed');
        expect(found.error).toBe('ECONNREFUSED');
    });

    it('should reject invalid status values', async () => {
        await expect(MailLog.create({
            to: 'x@x.com',
            status: 'invalid'
        })).rejects.toThrow();
    });

    it('should find most recent entry by to + sentAt', async () => {
        const now = new Date();
        await MailLog.create({ to: 'multi@example.com', subject: 'Old', status: 'sent', sentAt: new Date(now - 86400000) });
        await MailLog.create({ to: 'multi@example.com', subject: 'New', status: 'sent', sentAt: now });

        const latest = await MailLog.findOne({ to: 'multi@example.com', status: 'sent' }).sort({ sentAt: -1 });
        expect(latest.subject).toBe('New');
    });
});
