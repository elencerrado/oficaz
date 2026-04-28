import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const registerPath = path.resolve(process.cwd(), 'client/src/pages/public-register.tsx');
const requestCodePath = path.resolve(process.cwd(), 'client/src/pages/public-request-code.tsx');
const verifyCodePath = path.resolve(process.cwd(), 'client/src/pages/public-verify-code.tsx');

const registerSource = fs.readFileSync(registerPath, 'utf8');
const requestCodeSource = fs.readFileSync(requestCodePath, 'utf8');
const verifyCodeSource = fs.readFileSync(verifyCodePath, 'utf8');

describe('Public referral flow regression guards', () => {
  it('keeps referral query when redirecting from register to request-code', () => {
    expect(registerSource).toMatch(/const referralQuery = referralCodeFromUrl \? `\?ref=\$\{encodeURIComponent\(referralCodeFromUrl\)\}` : '';/);
    expect(registerSource).toMatch(/setLocation\(`\/request-code\$\{referralQuery\}`/);
  });

  it('sends referral query from request-code to verify-code', () => {
    expect(requestCodeSource).toMatch(/const referralCodeFromUrl = \(queryParams\.get\('ref'\) \|\| ''\)\.trim\(\);/);
    expect(requestCodeSource).toMatch(/setLocation\(`\/verify-code\?session=\$\{result\.sessionId\}\$\{referralQuery\}`\)/);
  });

  it('sends referral query from verify-code to register and preserves it on email change', () => {
    expect(verifyCodeSource).toMatch(/const referralCodeFromUrl = \(params\.get\('ref'\) \|\| ''\)\.trim\(\);/);
    expect(verifyCodeSource).toMatch(/setLocation\(`\/register\?token=\$\{result\.verificationToken\}&email=\$\{encodeURIComponent\(result\.email\)\}\$\{referralQuery\}`\)/);
    expect(verifyCodeSource).toMatch(/setLocation\(`\/request-code\$\{referralQuery\}`\);/);
  });

  it('includes referral code in final register payload and shows final attribution notice', () => {
    expect(registerSource).toMatch(/referralCode: referralCodeFromUrl \|\| undefined,/);
    expect(registerSource).toMatch(/Este registro quedará asociado al referido/);
  });
});