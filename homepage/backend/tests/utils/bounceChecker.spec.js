import { describe, it, expect } from 'vitest';
import { isBounceMessage, extractBouncedAddress, extractDiagnosticCode } from '../../src/utils/bounceChecker.js';

describe('BounceChecker Helpers', () => {
    describe('isBounceMessage', () => {
        it('should detect English bounce subjects', () => {
            expect(isBounceMessage('Undeliverable: Your newsletter', 'user@x.com')).toBe(true);
            expect(isBounceMessage('Mail delivery failed: returning message', 'noreply@x.com')).toBe(true);
            expect(isBounceMessage('Delivery Status Notification (Failure)', 'admin@x.com')).toBe(true);
            expect(isBounceMessage('Returned mail: see transcript for details', '')).toBe(true);
        });

        it('should detect German bounce subjects', () => {
            expect(isBounceMessage('Nicht zustellbar: Bestellbestätigung', '')).toBe(true);
            expect(isBounceMessage('Unzustellbar: Newsletter', '')).toBe(true);
        });

        it('should detect bounce by sender address', () => {
            expect(isBounceMessage('Some subject', 'MAILER-DAEMON@mail.ionos.de')).toBe(true);
            expect(isBounceMessage('Notification', 'postmaster@ionos.de')).toBe(true);
        });

        it('should not flag regular emails', () => {
            expect(isBounceMessage('Re: Your order', 'customer@example.com')).toBe(false);
            expect(isBounceMessage('Newsletter: Bäume gießen', 'info@goplantatree.org')).toBe(false);
        });
    });

    describe('extractBouncedAddress', () => {
        it('should extract from Final-Recipient header', () => {
            const source = 'Content-Type: message/delivery-status\r\nFinal-Recipient: rfc822; bad@example.com\r\nStatus: 5.1.1';
            expect(extractBouncedAddress(source)).toBe('bad@example.com');
        });

        it('should extract from Original-Recipient header', () => {
            const source = 'Original-Recipient: smtp; test@domain.de\r\n';
            expect(extractBouncedAddress(source)).toBe('test@domain.de');
        });

        it('should extract from X-Failed-Recipients header', () => {
            const source = 'X-Failed-Recipients: user@broken.org\r\nSubject: Delivery failure';
            expect(extractBouncedAddress(source)).toBe('user@broken.org');
        });

        it('should return null for non-bounce content', () => {
            const source = 'From: friend@example.com\r\nTo: me@example.com\r\nSubject: Hello\r\n\r\nHi!';
            expect(extractBouncedAddress(source)).toBeNull();
        });
    });

    describe('extractDiagnosticCode', () => {
        it('should extract Diagnostic-Code from DSN', () => {
            const source = 'Diagnostic-Code: smtp; 550 5.1.1 The email account does not exist\r\n';
            expect(extractDiagnosticCode(source)).toBe('550 5.1.1 The email account does not exist');
        });

        it('should extract Status code', () => {
            const source = 'Status: 5.2.2\r\nAction: failed';
            expect(extractDiagnosticCode(source)).toBe('5.2.2');
        });

        it('should return null for no diagnostic info', () => {
            const source = 'From: test@x.com\r\nSubject: Hello';
            expect(extractDiagnosticCode(source)).toBeNull();
        });
    });
});
