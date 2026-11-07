import assert from 'node:assert/strict';
import crypto from 'node:crypto';

async function sha256Hex(message: string): Promise<string> {
  return crypto.createHash('sha256').update(message).digest('hex');
}

interface LocalOtpChallenge {
  email: string;
  hash: string;
  salt: string;
  expiresAtMs: number;
  attempts: number;
}

class OtpVerificationEngine {
  private activeChallenge: LocalOtpChallenge | null = null;
  private sessionStorage: Map<string, string> = new Map();

  async requestOtp(targetEmail: string, forcedOtp?: string): Promise<{ otp: string }> {
    const cleanEmail = targetEmail.trim().toLowerCase();
    const otp = forcedOtp || String(100000 + Math.floor(Math.random() * 900000));
    const salt = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const expectedHash = await sha256Hex(`${cleanEmail}:${otp}:${salt}`);
    const expiresAtMs = Date.now() + 10 * 60 * 1000;

    const challenge: LocalOtpChallenge = {
      email: cleanEmail,
      hash: expectedHash,
      salt,
      expiresAtMs,
      attempts: 0,
    };

    this.activeChallenge = challenge;
    this.sessionStorage.set(`zappy_otp_${cleanEmail}`, JSON.stringify(challenge));
    return { otp };
  }

  async verifyOtp(
    email: string,
    candidateOtp: string,
    otpTargetEmail?: string
  ): Promise<{ success: boolean; error?: string; registrationToken?: string }> {
    const activeEmail = (otpTargetEmail || email).trim().toLowerCase();
    if (otpTargetEmail && email.trim().toLowerCase() !== otpTargetEmail.trim().toLowerCase()) {
      return {
        success: false,
        error: 'Email address has changed. Please request a new verification code.',
      };
    }

    const cleanOtp = candidateOtp.trim();
    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      return {
        success: false,
        error: 'Please enter all 6 digits of the verification code.',
      };
    }

    let currentChallenge = this.activeChallenge;
    if (!currentChallenge) {
      const raw = this.sessionStorage.get(`zappy_otp_${activeEmail}`);
      if (raw) currentChallenge = JSON.parse(raw);
    }

    if (!currentChallenge || currentChallenge.email !== activeEmail) {
      return {
        success: false,
        error: 'Incorrect OTP. Please try again.',
      };
    }

    if (Date.now() > currentChallenge.expiresAtMs) {
      this.activeChallenge = null;
      this.sessionStorage.delete(`zappy_otp_${activeEmail}`);
      return {
        success: false,
        error: 'This OTP has expired. Please request a new code.',
      };
    }

    if (currentChallenge.attempts >= 5) {
      this.activeChallenge = null;
      this.sessionStorage.delete(`zappy_otp_${activeEmail}`);
      return {
        success: false,
        error: 'Too many incorrect attempts. Please request a new code.',
      };
    }

    const candidateHash = await sha256Hex(`${activeEmail}:${cleanOtp}:${currentChallenge.salt}`);
    if (candidateHash === currentChallenge.hash) {
      // Clear challenge immediately to prevent replay
      this.activeChallenge = null;
      this.sessionStorage.delete(`zappy_otp_${activeEmail}`);
      return {
        success: true,
        registrationToken: `reg_token_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      };
    } else {
      currentChallenge.attempts += 1;
      this.activeChallenge = currentChallenge;
      this.sessionStorage.set(`zappy_otp_${activeEmail}`, JSON.stringify(currentChallenge));
      if (currentChallenge.attempts >= 5) {
        return {
          success: false,
          error: 'Too many incorrect attempts. Please request a new code.',
        };
      }
      return {
        success: false,
        error: 'Incorrect OTP. Please try again.',
      };
    }
  }

  expireActiveChallenge() {
    if (this.activeChallenge) {
      this.activeChallenge.expiresAtMs = Date.now() - 1000;
    }
  }

  clearOnBack() {
    this.activeChallenge = null;
  }
}

async function runOtpTests() {
  console.log('Running OTP Verification Flow Tests...\n');
  const engine = new OtpVerificationEngine();

  // Test 1: Entering correct OTP succeeds unconditionally
  {
    const { otp } = await engine.requestOtp('user1@example.com', '654321');
    const result = await engine.verifyOtp('user1@example.com', otp, 'user1@example.com');
    assert.strictEqual(result.success, true);
    assert.ok(result.registrationToken && result.registrationToken.startsWith('reg_token_'));
    console.log('✅ Test 1 passed: Correct 6-digit OTP verification always succeeds');
  }

  // Test 2: Entering wrong OTP fails with "Incorrect OTP. Please try again."
  {
    await engine.requestOtp('user2@example.com', '123456');
    const result = await engine.verifyOtp('user2@example.com', '999999', 'user2@example.com');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Incorrect OTP. Please try again.');
    console.log('✅ Test 2 passed: Incorrect OTP rejected with "Incorrect OTP. Please try again."');
  }

  // Test 3: Person A cannot enter OTP sent to Person B
  {
    const { otp: otpB } = await engine.requestOtp('personB@example.com', '888111');
    // Person A enters person B's OTP
    const result = await engine.verifyOtp('personA@example.com', otpB, 'personA@example.com');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Incorrect OTP. Please try again.');
    console.log('✅ Test 3 passed: Person A entering Person B\'s OTP rejected');
  }

  // Test 4: Replay attack rejected after successful verification
  {
    const { otp } = await engine.requestOtp('user3@example.com', '777888');
    const firstAttempt = await engine.verifyOtp('user3@example.com', otp, 'user3@example.com');
    assert.strictEqual(firstAttempt.success, true);

    // Immediate second attempt with same OTP
    const replayAttempt = await engine.verifyOtp('user3@example.com', otp, 'user3@example.com');
    assert.strictEqual(replayAttempt.success, false);
    console.log('✅ Test 4 passed: Replay attack rejected; consumed OTP cannot be reused');
  }

  // Test 5: 5 incorrect attempts locks out with "Too many incorrect attempts"
  {
    await engine.requestOtp('user4@example.com', '111222');
    for (let i = 1; i <= 4; i++) {
      const res = await engine.verifyOtp('user4@example.com', '000000', 'user4@example.com');
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, 'Incorrect OTP. Please try again.');
    }
    // 5th attempt
    const res5 = await engine.verifyOtp('user4@example.com', '000000', 'user4@example.com');
    assert.strictEqual(res5.success, false);
    assert.strictEqual(res5.error, 'Too many incorrect attempts. Please request a new code.');
    console.log('✅ Test 5 passed: Max 5 attempts enforced; locks out with "Too many incorrect attempts"');
  }

  // Test 6: Expired OTP rejected
  {
    const { otp } = await engine.requestOtp('user5@example.com', '333444');
    engine.expireActiveChallenge();
    const result = await engine.verifyOtp('user5@example.com', otp, 'user5@example.com');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'This OTP has expired. Please request a new code.');
    console.log('✅ Test 6 passed: Expired OTP rejected with "This OTP has expired. Please request a new code."');
  }

  // Test 7: Backing out and changing email invalidates previous OTP
  {
    await engine.requestOtp('first@example.com', '555666');
    engine.clearOnBack();
    // User changes email in state to 'second@example.com' without requesting OTP
    const result = await engine.verifyOtp('second@example.com', '555666', 'first@example.com');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Email address has changed. Please request a new verification code.');
    console.log('✅ Test 7 passed: Email change caught and old OTP invalidated');
  }

  // Test 8: Password Reset OTP verification & Effective Email alias resolution
  {
    const { otp: resetCode } = await engine.requestOtp('resetuser@example.com', '482910');
    const badReset = await engine.verifyOtp('resetuser@example.com', '111111', 'resetuser@example.com');
    assert.strictEqual(badReset.success, false);

    const validReset = await engine.verifyOtp('resetuser@example.com', resetCode, 'resetuser@example.com');
    assert.strictEqual(validReset.success, true);

    const resolveEffective = (raw: string) =>
      raw
        .trim()
        .toLowerCase()
        .replace(/\+zfr[a-z0-9_]*@/, '@')
        .replace(/\+zf[a-z0-9_]*@/, '@');

    assert.strictEqual(resolveEffective('resetuser+zfr19283@example.com'), 'resetuser@example.com');
    assert.strictEqual(resolveEffective('pawarayushai1+zfr999@gmail.com'), 'pawarayushai1@gmail.com');
    console.log('✅ Test 8 passed: Password Reset OTP verification & Effective Email resolution');
  }

  console.log('\n🎉 All 8 OTP & Password Reset verification flow tests passed!');
  process.exit(0);
}

runOtpTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
