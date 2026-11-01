import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Request } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  verifyAdminRequest,
  type TokenVerifierFn,
} from '../src/utils/adminAuthServer';
import {
  OFFICIAL_CONTACT_EMAIL,
  DEFAULT_LEGAL_PAGES,
  normalizeLegalPagesConfig,
} from '../src/components/InfoModal';

function makeMockRequest(headers: Record<string, string | undefined>): Request {
  return {
    headers,
  } as unknown as Request;
}

function makeDecodedToken(
  uid: string,
  email: string,
  emailVerified: boolean
): DecodedIdToken {
  return {
    uid,
    sub: uid,
    email,
    email_verified: emailVerified,
    aud: 'zappyfun',
    iss: 'https://securetoken.google.com/zappyfun',
    auth_time: Math.floor(Date.now() / 1000) - 60,
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3600,
    firebase: {
      identities: { email: [email] },
      sign_in_provider: 'google.com',
    },
  };
}

const mockTokenVerifier: TokenVerifierFn = async (token: string) => {
  if (token === 'valid-admin-token') {
    return makeDecodedToken('admin-uid-1', 'pawarayushai1@gmail.com', true);
  }
  if (token === 'valid-secondary-admin-token') {
    return makeDecodedToken('admin-uid-2', 'admin@zappy.app', true);
  }
  if (token === 'unverified-admin-token') {
    return makeDecodedToken(
      'admin-uid-unverified',
      'pawarayushai1@gmail.com',
      false
    );
  }
  if (token === 'valid-viewer-token') {
    return makeDecodedToken('viewer-uid-99', 'viewer@example.com', true);
  }
  return null;
};

async function runTests() {
  console.log('Running ZappyFun Security & Compliance Tests...\n');

  // 1. Missing Authorization header -> 401
  {
    const req = makeMockRequest({});
    const res = await verifyAdminRequest(req, mockTokenVerifier);
    assert.equal(res.authorized, false);
    if (!res.authorized) {
      assert.equal(res.statusCode, 401);
    }
    console.log('✅ Test 1 passed: Missing Authorization header returns 401');
  }

  // 2. Forged x-admin-email header without Bearer token -> 401
  {
    const req = makeMockRequest({
      'x-admin-email': 'pawarayushai1@gmail.com',
    });
    const res = await verifyAdminRequest(req, mockTokenVerifier);
    assert.equal(res.authorized, false);
    if (!res.authorized) {
      assert.equal(res.statusCode, 401);
    }
    console.log(
      '✅ Test 2 passed: Forged x-admin-email header is never trusted without a verified Bearer token (401)'
    );
  }

  // 3. Invalid or expired Bearer token -> 401
  {
    const req = makeMockRequest({
      authorization: 'Bearer forged-or-expired-jwt',
      'x-admin-email': 'pawarayushai1@gmail.com',
    });
    const res = await verifyAdminRequest(req, mockTokenVerifier);
    assert.equal(res.authorized, false);
    if (!res.authorized) {
      assert.equal(res.statusCode, 401);
    }
    console.log('✅ Test 3 passed: Invalid/expired Bearer token returns 401');
  }

  // 4. Valid non-admin Firebase ID token -> 403
  {
    const req = makeMockRequest({
      authorization: 'Bearer valid-viewer-token',
      'x-admin-email': 'pawarayushai1@gmail.com',
    });
    const res = await verifyAdminRequest(req, mockTokenVerifier);
    assert.equal(res.authorized, false);
    if (!res.authorized) {
      assert.equal(res.statusCode, 403);
    }
    console.log(
      '✅ Test 4 passed: Valid non-admin token is rejected with 403 even if x-admin-email is spoofed'
    );
  }

  // 5. Unverified admin email token -> 403
  {
    const req = makeMockRequest({
      authorization: 'Bearer unverified-admin-token',
    });
    const res = await verifyAdminRequest(req, mockTokenVerifier);
    assert.equal(res.authorized, false);
    if (!res.authorized) {
      assert.equal(res.statusCode, 403);
    }
    console.log(
      '✅ Test 5 passed: Admin email with email_verified=false is rejected with 403'
    );
  }

  // 6. Verified admin tokens -> 200
  {
    const req1 = makeMockRequest({
      authorization: 'Bearer valid-admin-token',
    });
    const res1 = await verifyAdminRequest(req1, mockTokenVerifier);
    assert.equal(res1.authorized, true);
    if (res1.authorized) {
      assert.equal(res1.admin.email, 'pawarayushai1@gmail.com');
      assert.equal(res1.admin.emailVerified, true);
    }

    const req2 = makeMockRequest({
      authorization: 'Bearer valid-secondary-admin-token',
    });
    const res2 = await verifyAdminRequest(req2, mockTokenVerifier);
    assert.equal(res2.authorized, true);
    if (res2.authorized) {
      assert.equal(res2.admin.email, 'admin@zappy.app');
      assert.equal(res2.admin.emailVerified, true);
    }
    console.log(
      '✅ Test 6 passed: Verified admin Firebase ID tokens are authorized'
    );
  }

  // 7. Firestore Security Rules Verification (/firestore.rules & AdminStudioModal snippet)
  {
    const rootRules = fs.readFileSync(
      path.resolve(process.cwd(), 'firestore.rules'),
      'utf8'
    );
    const adminStudioCode = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AdminStudioModal.tsx'),
      'utf8'
    );

    assert.ok(
      rootRules.includes(
        'allow get: if isVerifiedUser() && isValidId(watchlistDocId) && (existing().ownerId == request.auth.uid || isAdmin());'
      ) &&
        rootRules.includes(
          'allow list: if isVerifiedUser() && (existing().ownerId == request.auth.uid || isAdmin());'
        ) &&
        rootRules.includes(
          'allow delete: if isVerifiedUser() && isValidId(watchlistDocId) && (existing().ownerId == request.auth.uid || isAdmin());'
        ),
      'firestore.rules must restrict /watchlists get, list, delete to owner or admin'
    );
    assert.ok(
      rootRules.includes('request.auth.token.email_verified == true'),
      'firestore.rules must require email_verified == true'
    );
    assert.ok(
      rootRules.includes('allow get: if isValidId(messageId) && isAdmin();') &&
        rootRules.includes('allow list: if isAdmin();'),
      'firestore.rules must restrict /support_messages get and list to isAdmin()'
    );
    assert.ok(
      adminStudioCode.includes(
        'allow get, list, delete: if isVerifiedUser() && (resource.data.ownerId == request.auth.uid || isAdmin());'
      ) &&
        adminStudioCode.includes('allow get, list: if isAdmin();'),
      'AdminStudioModal rules snippet must match /watchlists and /support_messages restrictions'
    );
    console.log(
      '✅ Test 7 passed: firestore.rules and AdminStudioModal snippet enforce owner-only /watchlists access, admin-only /support_messages reads, and email_verified == true'
    );
  }

  // 8. Contact Email Typo Normalization & Custom Legal Page Preservation
  {
    assert.equal(OFFICIAL_CONTACT_EMAIL, 'ContactZappyFun@gmail.com');

    const normalizedFromTypo = normalizeLegalPagesConfig({
      contactEmail: 'ContactZappyFun@gamil.com',
      terms: {
        title: 'Custom Terms',
        subtitle: 'Contact us at ContactZappyFun@gamil.com',
        body: 'Custom Admin Terms — reach us at ContactZappyFun@gamil.com.',
      },
    });
    assert.equal(normalizedFromTypo.contactEmail, 'ContactZappyFun@gmail.com');
    assert.equal(
      normalizedFromTypo.terms.subtitle,
      'Contact us at ContactZappyFun@gmail.com'
    );
    assert.equal(
      normalizedFromTypo.terms.body,
      'Custom Admin Terms — reach us at ContactZappyFun@gmail.com.'
    );
    assert.equal(
      normalizedFromTypo.privacy.body,
      DEFAULT_LEGAL_PAGES.privacy.body
    );
    assert.ok(
      DEFAULT_LEGAL_PAGES.privacy.body.includes('watchlists'),
      'Privacy policy must disclose Cloud Firestore watchlists'
    );
    assert.ok(
      DEFAULT_LEGAL_PAGES.advertising.body.includes('zappy_watchlist_v2'),
      'Cookie & Local Storage policy must disclose actual localStorage keys'
    );
    assert.ok(
      DEFAULT_LEGAL_PAGES.disclaimer.body.includes('vidly.pro'),
      'Disclaimer must accurately disclose third-party vidly.pro embeds'
    );
    console.log(
      '✅ Test 8 passed: normalizeLegalPagesConfig fixes @gamil.com typos, preserves custom admin text, and includes code-verified disclosures'
    );
  }

  // 9. Verify misleading stream authorization strings are removed
  {
    const filesToCheck = [
      'server.ts',
      'src/App.tsx',
      'src/components/DetailsView.tsx',
      'src/components/VideoPlayer.tsx',
      'src/components/AdminStudioModal.tsx',
      'src/components/InfoModal.tsx',
    ];
    for (const relPath of filesToCheck) {
      const content = fs.readFileSync(
        path.resolve(process.cwd(), relPath),
        'utf8'
      );
      assert.ok(
        !content.includes('Verified Authorized Stream'),
        `${relPath} must not contain 'Verified Authorized Stream'`
      );
      assert.ok(
        !content.includes('Verified Stream & Episodes!'),
        `${relPath} must not contain 'Verified Stream & Episodes!'`
      );
    }
    console.log(
      '✅ Test 9 passed: Misleading stream licensing claims removed across backend and frontend'
    );
  }

  // 10. Verify 6-digit OTP lifecycle, single-use registration authorization tokens, and replay prevention
  {
    const {
      generateAndStoreOtp,
      verifyOtp,
      validateRegistrationToken,
      consumeRegistrationToken,
    } = await import('../src/server/smtpService');
    const testEmail = 'compliance-test@zappyfun.app';
    const otp = generateAndStoreOtp(testEmail);
    assert.strictEqual(typeof otp, 'string');
    assert.strictEqual(otp.length, 6, 'OTP must be exactly 6 digits');
    assert.ok(/^\d{6}$/.test(otp), 'OTP must be purely numeric');

    // Wrong code rejected
    const wrongAttempt = verifyOtp(testEmail, '000000');
    assert.strictEqual(wrongAttempt.valid, false);

    // Correct code accepted and issues registration authorization token
    const validAttempt = verifyOtp(testEmail, otp);
    assert.strictEqual(validAttempt.valid, true);
    assert.ok(
      validAttempt.registrationToken &&
        validAttempt.registrationToken.startsWith('reg_'),
      'verifyOtp must issue a valid registration authorization token'
    );

    // Replay attack rejected
    const replayAttempt = verifyOtp(testEmail, otp);
    assert.strictEqual(replayAttempt.valid, false, 'Consumed OTP must not be reusable');

    // Registration authorization token validation & atomic single-use consumption
    const regToken = validAttempt.registrationToken!;
    const checkValidToken = validateRegistrationToken(regToken, testEmail);
    assert.strictEqual(checkValidToken.valid, true);

    const consumeToken = consumeRegistrationToken(regToken, testEmail);
    assert.strictEqual(consumeToken.valid, true);

    // Consumed token cannot be reused
    const reUseToken = consumeRegistrationToken(regToken, testEmail);
    assert.strictEqual(reUseToken.valid, false, 'Consumed registration token must not be reusable');

    console.log(
      '✅ Test 10 passed: 6-digit OTP generation, length validation, registration authorization token issuance & replay prevention verified'
    );
  }

  // 11. Verify GitHub OAuth Provider, Redirect Result handlers, and Secret safety
  {
    const {
      githubProvider,
      signInWithGithubRedirect,
      handleGithubRedirectResult,
      signInWithGithub,
      getFriendlyAuthErrorMessage,
    } = await import('../src/firebase');

    assert.ok(githubProvider, 'githubProvider must be initialized');
    assert.strictEqual(githubProvider.providerId, 'github.com');
    assert.strictEqual(typeof signInWithGithubRedirect, 'function');
    assert.strictEqual(typeof handleGithubRedirectResult, 'function');
    assert.strictEqual(typeof signInWithGithub, 'function');

    // Friendly error messaging checks
    assert.strictEqual(
      getFriendlyAuthErrorMessage({ code: 'auth/popup-closed-by-user' }),
      'GitHub sign-in was cancelled.'
    );
    assert.ok(
      getFriendlyAuthErrorMessage({
        code: 'auth/account-exists-with-different-credential',
      }).includes('email and password')
    );
    assert.ok(
      getFriendlyAuthErrorMessage({ code: 'auth/unauthorized-domain' }).includes(
        'Authorized domains'
      )
    );

    // Verify GitHub client secret is never hardcoded in client source files
    const clientFiles = [
      'src/firebase.ts',
      'src/App.tsx',
      'src/components/AuthModal.tsx',
      'src/components/AdminStudioModal.tsx',
    ];
    for (const rel of clientFiles) {
      const src = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
      assert.ok(
        !src.toLowerCase().includes('client_secret'),
        `${rel} must not contain any client_secret references`
      );
    }

    console.log(
      '✅ Test 11 passed: GitHub OAuth provider, redirect result handlers, friendly error messages, and secret safety verified'
    );
  }

  // 12. Verify Smart Email Auth Flow: Registered Email check, 6-Digit OTP & Create Account Page
  {
    const { checkEmailRegisteredOnServer } = await import(
      '../src/utils/adminAuthServer'
    );
    assert.strictEqual(typeof checkEmailRegisteredOnServer, 'function');

    const emptyCheck = await checkEmailRegisteredOnServer('');
    assert.strictEqual(emptyCheck.registered, false);

    const {
      saveUserProfile,
      getCachedUserProfile,
      updateUserProfile,
      checkEmailSignInMethods,
    } = await import('../src/firebase');

    assert.strictEqual(typeof saveUserProfile, 'function');
    assert.strictEqual(typeof getCachedUserProfile, 'function');
    assert.strictEqual(typeof updateUserProfile, 'function');
    assert.strictEqual(typeof checkEmailSignInMethods, 'function');

    // Verify AuthModal contains the required profile fields: Name, Password, and Age
    const authModalSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AuthModal.tsx'),
      'utf8'
    );
    assert.ok(
      authModalSrc.includes('CREATE_ACCOUNT'),
      'AuthModal must have CREATE_ACCOUNT step'
    );
    assert.ok(
      authModalSrc.includes('Full Name'),
      'AuthModal must include Full Name input'
    );
    assert.ok(
      authModalSrc.includes('Age'),
      'AuthModal must include Age input'
    );
    assert.ok(
      authModalSrc.includes('Password'),
      'AuthModal must include password field'
    );
    assert.ok(
      authModalSrc.includes('Confirm Password'),
      'AuthModal must include Confirm Password field'
    );
    assert.ok(
      authModalSrc.includes('/api/auth/check-email'),
      'AuthModal must call check-email to separate existing users from new users'
    );
    assert.ok(
      authModalSrc.includes('/api/auth/validate-registration-token'),
      'AuthModal must validate registration authorization token on backend'
    );

    console.log(
      '✅ Test 12 passed: Smart Email Auth redesign verified (backend account check, 6-digit OTP, registration tokens, and Create Account page)'
    );
  }

  console.log('\n🎉 All 12 security & compliance test suites passed!');
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
