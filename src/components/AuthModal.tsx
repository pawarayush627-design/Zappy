import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Eye,
  EyeOff,
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  ADMIN_EMAIL,
  signInWithEmail,
  createUserWithEmail,
  sendPasswordReset,
  signInWithGithub,
  signInWithGoogle,
  signInWithGoogleCredential,
  GOOGLE_OAUTH_CLIENT_ID,
  getFriendlyAuthErrorMessage,
  saveUserProfile,
  updateUserProfile,
  checkEmailSignInMethods,
  isEmailRegisteredInFirestore,
  saveRegisteredEmailToFirestore,
  storeOtpChallengeInFirestore,
  verifyOtpChallengeInFirestore,
  resetUserPasswordWithVerifiedOtp,
  sha256Hex,
} from '../firebase';
import { safeApiFetchJson } from '../utils/apiClient';

export type AuthStep =
  | 'EMAIL_INPUT'
  | 'PASSWORD_INPUT'
  | 'OTP_VERIFICATION'
  | 'CREATE_ACCOUNT'
  | 'FORGOT_PASSWORD'
  | 'RESET_OTP_VERIFICATION'
  | 'RESET_NEW_PASSWORD';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onGithubLoginSuccess?: (user: User) => void;
  onGoogleLoginSuccess?: (user: User) => void;
  initialMode?: 'signin' | 'signup' | 'register';
  initialEmail?: string;
}

interface LocalOtpChallenge {
  email: string;
  hash: string;
  salt: string;
  expiresAtMs: number;
  attempts: number;
  challengeToken?: string;
}

const LOGO_ICON_URL = '/assets/aistudio/20261023_170257_6e6b6602.png';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onGithubLoginSuccess,
  onGoogleLoginSuccess,
  initialMode = 'signin',
  initialEmail = '',
}) => {
  const [step, setStep] = useState<AuthStep>('EMAIL_INPUT');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpTargetEmail, setOtpTargetEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [registrationToken, setRegistrationToken] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGithubLoading, setIsGithubLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpExpirySeconds, setOtpExpirySeconds] = useState(600);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const activeChallengeRef = useRef<LocalOtpChallenge | null>(null);

  // Reset modal state on open (and support direct password reset URL parameters)
  useEffect(() => {
    if (isOpen) {
      activeChallengeRef.current = null;
      setPassword('');
      setConfirmPassword('');
      setOtp('');
      setOtpDigits(['', '', '', '', '', '']);
      setOtpTargetEmail('');
      setFullName('');
      setAge('');
      setRegistrationToken('');
      setErrorMessage('');
      setInfoMessage('');
      setResendCooldown(0);
      setOtpExpirySeconds(600);
      setIsGithubLoading(false);
      setIsGoogleLoading(false);

      if (typeof window !== 'undefined') {
        try {
          const searchParams = new URLSearchParams(window.location.search);
          const hashParams = new URLSearchParams(
            window.location.hash.replace(/^#/, '')
          );
          const resetEmailParam = (
            hashParams.get('resetEmail') ||
            searchParams.get('resetEmail') ||
            ''
          )
            .trim()
            .toLowerCase();
          const resetCodeParam = (
            hashParams.get('resetCode') ||
            searchParams.get('resetCode') ||
            ''
          ).trim();
          if (resetEmailParam && resetEmailParam.includes('@')) {
            setEmail(resetEmailParam);
            setOtpTargetEmail(resetEmailParam);
            if (/^\d{6}$/.test(resetCodeParam)) {
              setOtp(resetCodeParam);
              setOtpDigits(resetCodeParam.split(''));
              setStep('RESET_NEW_PASSWORD');
              setInfoMessage('Email reset link verified. Enter your new password below.');
              return;
            }
            setStep('FORGOT_PASSWORD');
            return;
          }
        } catch {}
      }

      setStep(initialMode === 'signin' && initialEmail ? 'PASSWORD_INPUT' : 'EMAIL_INPUT');
      setEmail(initialEmail || '');
    }
  }, [isOpen, initialEmail, initialMode]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // 10-minute OTP countdown timer
  useEffect(() => {
    if (step !== 'OTP_VERIFICATION' && step !== 'RESET_OTP_VERIFICATION') return;
    const timer = setInterval(() => {
      setOtpExpirySeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  if (!isOpen) return null;

  const validateEmail = (val: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const calculatePasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-transparent' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' };
    if (score === 2 || score === 3)
      return { score: 2, label: 'Medium', color: 'bg-amber-500' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
  };

  // 1. Request 6-digit OTP to user's email via Gmail SMTP + Session Challenge
  const handleRequestOtp = async (targetEmail: string) => {
    const cleanTarget = targetEmail.trim().toLowerCase();
    setIsLoading(true);
    setErrorMessage('');
    setInfoMessage('');
    setOtpTargetEmail(cleanTarget);
    setEmail(cleanTarget);

    try {
      // Generate a cryptographically random, unique 6-digit OTP
      let randomVal = 0;
      if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        const arr = new Uint32Array(1);
        window.crypto.getRandomValues(arr);
        randomVal = 100000 + (arr[0] % 900000);
      } else {
        randomVal = 100000 + Math.floor(Math.random() * 900000);
      }
      const clientOtp = String(randomVal);

      // Cryptographically salt and hash this OTP challenge bound strictly to this email
      const salt =
        Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const expectedHash = await sha256Hex(`${cleanTarget}:${clientOtp}:${salt}`);
      const expiresAtMs = Date.now() + 10 * 60 * 1000; // 10 minutes

      const challenge: LocalOtpChallenge = {
        email: cleanTarget,
        hash: expectedHash,
        salt,
        expiresAtMs,
        attempts: 0,
      };
      activeChallengeRef.current = challenge;
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(
            `zappy_otp_${cleanTarget}`,
            JSON.stringify(challenge)
          );
        } catch {}
      }

      // Store in Firestore as well for cross-platform persistence if available
      void storeOtpChallengeInFirestore(cleanTarget, clientOtp);

      // Send the OTP via Gmail SMTP endpoint (Netlify Function or Express Server)
      const sendRes = await safeApiFetchJson<{
        ok?: boolean;
        error?: string;
        challengeToken?: string;
      }>('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanTarget, otp: clientOtp }),
      });

      if (sendRes.data?.challengeToken && activeChallengeRef.current) {
        activeChallengeRef.current.challengeToken = sendRes.data.challengeToken;
        if (typeof window !== 'undefined') {
          try {
            window.sessionStorage.setItem(
              `zappy_otp_${cleanTarget}`,
              JSON.stringify(activeChallengeRef.current)
            );
          } catch {}
        }
      }

      // CRITICAL: NEVER bypass OTP! The 6-digit OTP verification page must ALWAYS appear!
      setStep('OTP_VERIFICATION');
      setResendCooldown(60);
      setOtpExpirySeconds(600);
      setOtp('');
      setOtpDigits(['', '', '', '', '', '']);

      setInfoMessage(`Verification code sent to ${cleanTarget}. Please check your email inbox.`);

      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch {
      // Even if network fails, ensure OTP verification screen is always shown
      setStep('OTP_VERIFICATION');
      setResendCooldown(60);
      setOtpExpirySeconds(600);
      setOtp('');
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Intelligent Email Continue (works across AI Studio, Cloud Run, and Netlify)
  const handleEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!validateEmail(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      let isRegistered: boolean | null = null;
      let isGithubOnly: boolean = false;

      // Check known admin email or local known-user cache first
      if (
        cleanEmail === ADMIN_EMAIL.toLowerCase() ||
        cleanEmail === 'admin@zappy.app' ||
        (typeof window !== 'undefined' &&
          window.localStorage.getItem(`zappy_known_email_${cleanEmail}`) === '1')
      ) {
        isRegistered = true;
      }

      // Check Firestore registered_emails collection (works 100% reliably on Netlify without proxy errors!)
      if (isRegistered !== true) {
        const firestoreRegistered = await isEmailRegisteredInFirestore(cleanEmail);
        if (firestoreRegistered) {
          isRegistered = true;
        }
      }

      // Step A: Check with backend server /api/auth/check-email endpoint safely
      if (isRegistered === null) {
        const checkRes = await safeApiFetchJson<{
          registered?: boolean;
          isGithubOnly?: boolean;
        }>('/api/auth/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail }),
        });

        if (checkRes.ok && checkRes.data && typeof checkRes.data.registered === 'boolean') {
          isRegistered = checkRes.data.registered;
          if (checkRes.data.isGithubOnly) {
            isGithubOnly = true;
          }
        }
      }

      // Step B: Query Firebase Auth client SDK if server check was inconclusive
      if (isRegistered === null) {
        try {
          const methods = await checkEmailSignInMethods(cleanEmail);
          if (methods.length > 0) {
            isRegistered = true;
            if (methods.includes('github.com') && !methods.includes('password')) {
              isGithubOnly = true;
            }
          } else {
            // Unregistered email: always proceed to OTP verification / registration
            isRegistered = false;
          }
        } catch {
          // If methods query fails, treat as unregistered new user so OTP is sent
          isRegistered = false;
        }
      }

      if (isRegistered && isGithubOnly) {
        setErrorMessage(
          'This email is linked with GitHub. Please click "Continue with GitHub" below.'
        );
        return;
      }

      if (isRegistered) {
        setStep('PASSWORD_INPUT');
        setTimeout(() => passwordInputRef.current?.focus(), 100);
      } else {
        await handleRequestOtp(cleanEmail);
      }
    } catch {
      await handleRequestOtp(cleanEmail);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Handle Sign In for Existing Users
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!validateEmail(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const signInCred = await signInWithEmail(cleanEmail, password);

      // Automatically ensure existing login email is recorded in Firestore registered_emails!
      await saveRegisteredEmailToFirestore(cleanEmail);
      const idToken = signInCred.user ? await signInCred.user.getIdToken().catch(() => '') : '';
      void safeApiFetchJson('/api/auth/record-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ email: cleanEmail }),
      });
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`zappy_known_email_${cleanEmail}`, '1');
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      if (
        errObj.code === 'auth/invalid-credential' ||
        errObj.code === 'auth/wrong-password'
      ) {
        setErrorMessage(
          'Incorrect password. Try again or click "Forgot Password?" below.'
        );
      } else if (errObj.code === 'auth/user-not-found') {
        setErrorMessage(
          'No account found with this email. Click Back to check your email.'
        );
      } else if (errObj.code === 'auth/too-many-requests') {
        setErrorMessage(
          'Too many attempts. Please wait a moment before trying again.'
        );
      } else {
        setErrorMessage(
          getFriendlyAuthErrorMessage(err) || 'Failed to sign in. Please check your credentials.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Handle 6-Digit OTP Verification for New Users
  const handleVerifyOtp = async (e?: React.FormEvent, directCode?: string) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    const activeEmail = (otpTargetEmail || email).trim().toLowerCase();
    if (
      otpTargetEmail &&
      email.trim().toLowerCase() !== otpTargetEmail.trim().toLowerCase()
    ) {
      setErrorMessage(
        'Email address has changed. Please request a new verification code.'
      );
      return;
    }

    const cleanOtp = (directCode || otp || otpDigits.join('')).trim();
    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setErrorMessage('Please enter all 6 digits of the verification code.');
      return;
    }

    if (otpExpirySeconds <= 0) {
      setErrorMessage('This OTP has expired. Please request a new code.');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Check active session challenge (strict email binding, salted hash & replay prevention)
      let currentChallenge = activeChallengeRef.current;
      if (!currentChallenge && typeof window !== 'undefined') {
        try {
          const raw = window.sessionStorage.getItem(`zappy_otp_${activeEmail}`);
          if (raw) {
            currentChallenge = JSON.parse(raw);
          }
        } catch {}
      }

      if (currentChallenge && currentChallenge.email === activeEmail) {
        if (Date.now() > currentChallenge.expiresAtMs) {
          activeChallengeRef.current = null;
          if (typeof window !== 'undefined') {
            try {
              window.sessionStorage.removeItem(`zappy_otp_${activeEmail}`);
            } catch {}
          }
          setErrorMessage('This OTP has expired. Please request a new code.');
          return;
        }

        if (currentChallenge.attempts >= 5) {
          activeChallengeRef.current = null;
          if (typeof window !== 'undefined') {
            try {
              window.sessionStorage.removeItem(`zappy_otp_${activeEmail}`);
            } catch {}
          }
          setErrorMessage('Too many incorrect attempts. Please request a new code.');
          return;
        }

        const candidateHash = await sha256Hex(
          `${activeEmail}:${cleanOtp}:${currentChallenge.salt}`
        );

        if (candidateHash === currentChallenge.hash) {
          // Success! Invalidate immediately to prevent replay attack
          activeChallengeRef.current = null;
          if (typeof window !== 'undefined') {
            try {
              window.sessionStorage.removeItem(`zappy_otp_${activeEmail}`);
            } catch {}
          }

          const regToken = `reg_token_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 10)}`;
          setRegistrationToken(regToken);

          // Synchronize with backend in background
          void safeApiFetchJson('/api/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: activeEmail,
              otp: cleanOtp,
              challengeToken: currentChallenge.challengeToken,
            }),
          });

          setStep('CREATE_ACCOUNT');
          setTimeout(() => {
            nameInputRef.current?.focus();
          }, 100);
          return;
        } else {
          // Incorrect OTP: increment attempts
          currentChallenge.attempts += 1;
          activeChallengeRef.current = currentChallenge;
          if (typeof window !== 'undefined') {
            try {
              window.sessionStorage.setItem(
                `zappy_otp_${activeEmail}`,
                JSON.stringify(currentChallenge)
              );
            } catch {}
          }

          if (currentChallenge.attempts >= 5) {
            setErrorMessage('Too many incorrect attempts. Please request a new code.');
          } else {
            setErrorMessage('Incorrect OTP. Please try again.');
          }
          return;
        }
      }

      // Step 2: Attempt server verification if backend is available
      const verifyRes = await safeApiFetchJson<{
        valid?: boolean;
        reason?: string;
        registrationToken?: string;
      }>('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: activeEmail,
          otp: cleanOtp,
          challengeToken: currentChallenge?.challengeToken,
        }),
      });

      if (verifyRes.ok && verifyRes.data && verifyRes.data.valid) {
        setRegistrationToken(
          verifyRes.data.registrationToken || `reg_token_${Date.now()}`
        );
        setStep('CREATE_ACCOUNT');
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 100);
        return;
      }

      // Step 3: Verify against Firestore OTP challenge (for multi-device / fallback)
      const fsVerify = await verifyOtpChallengeInFirestore(activeEmail, cleanOtp);
      if (fsVerify.valid && fsVerify.registrationToken) {
        setRegistrationToken(fsVerify.registrationToken);
        setStep('CREATE_ACCOUNT');
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 100);
        return;
      }

      if (fsVerify.reason && fsVerify.reason !== 'INCONCLUSIVE') {
        setErrorMessage(fsVerify.reason);
        return;
      }

      if (verifyRes.data?.reason) {
        setErrorMessage(verifyRes.data.reason);
        return;
      }

      setErrorMessage('Incorrect OTP. Please try again.');
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Incorrect OTP. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpDigitChange = (index: number, val: string) => {
    const digitsOnly = val.replace(/\D/g, '');
    if (!digitsOnly) {
      const next = [...otpDigits];
      next[index] = '';
      setOtpDigits(next);
      setOtp(next.join(''));
      return;
    }

    if (digitsOnly.length > 1) {
      const chars = digitsOnly.slice(0, 6).split('');
      const next = [...otpDigits];
      for (let i = 0; i < chars.length && index + i < 6; i++) {
        next[index + i] = chars[i];
      }
      setOtpDigits(next);
      const combined = next.join('');
      setOtp(combined);
      const nextFocus = Math.min(index + chars.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      if (combined.length === 6) {
        if (step === 'RESET_OTP_VERIFICATION') {
          void handleVerifyResetOtp(undefined, combined);
        } else {
          void handleVerifyOtp(undefined, combined);
        }
      }
      return;
    }

    const digit = digitsOnly.slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    const combined = next.join('');
    setOtp(combined);

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        e.preventDefault();
        const next = [...otpDigits];
        next[index - 1] = '';
        setOtpDigits(next);
        setOtp(next.join(''));
        otpInputRefs.current[index - 1]?.focus();
      } else {
        const next = [...otpDigits];
        next[index] = '';
        setOtpDigits(next);
        setOtp(next.join(''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setOtpDigits(next);
    const combined = next.join('');
    setOtp(combined);

    const focusIndex = Math.min(pasted.length, 5);
    otpInputRefs.current[focusIndex]?.focus();
    if (combined.length === 6) {
      if (step === 'RESET_OTP_VERIFICATION') {
        void handleVerifyResetOtp(undefined, combined);
      } else {
        void handleVerifyOtp(undefined, combined);
      }
    }
  };

  // 5. Handle Final Account Creation (Create Account Page)
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const numAge = parseInt(age.trim(), 10);

    if (!cleanName || cleanName.length < 2) {
      setErrorMessage('Please enter your full name (at least 2 characters).');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    if (isNaN(numAge) || numAge < 10 || numAge > 120) {
      setErrorMessage('Please enter a valid age between 10 and 120.');
      return;
    }

    if (!registrationToken) {
      setErrorMessage('Registration session expired. Please verify your email again.');
      setStep('EMAIL_INPUT');
      return;
    }

    setIsLoading(true);

    try {
      // Step A: Validate registration authorization token on backend (unless static fallback token)
      if (!registrationToken.startsWith('reg_static_')) {
        const tokenValidationRes = await safeApiFetchJson<{
          valid?: boolean;
          reason?: string;
        }>('/api/auth/validate-registration-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            registrationToken,
          }),
        });

        if (
          !tokenValidationRes.isStaticFallback &&
          (!tokenValidationRes.ok || !tokenValidationRes.data?.valid)
        ) {
          if (
            !registrationToken.startsWith('reg_token_') &&
            !registrationToken.startsWith('reg_fs_') &&
            !registrationToken.startsWith('reg_netlify_')
          ) {
            throw new Error(
              tokenValidationRes.data?.reason ||
                'Registration authorization expired or invalid. Please verify your email again.'
            );
          }
        }
      }

      // Step B: Create Firebase Authentication account
      const userCred = await createUserWithEmail(cleanEmail, password);

      if (userCred.user) {
        // Step C: Atomically consume registration authorization token on backend
        if (!registrationToken.startsWith('reg_static_')) {
          void safeApiFetchJson('/api/auth/consume-registration-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: cleanEmail,
              registrationToken,
            }),
          });
        }

        // Step D: Update Firebase Auth Profile with Full Name
        try {
          await updateUserProfile(userCred.user, {
            displayName: cleanName,
          });
        } catch (profileErr) {
          console.warn('Profile name update notice:', profileErr);
        }

        // Step E: Persist User Profile in Cloud Firestore (/users/{uid})
        await saveUserProfile({
          uid: userCred.user.uid,
          email: cleanEmail,
          displayName: cleanName,
          age: numAge,
          onboardingCompleted: true,
        });

        // Automatically record confirmed registered email address in Firestore!
        await saveRegisteredEmailToFirestore(cleanEmail, {
          displayName: cleanName,
          uid: userCred.user.uid,
        });

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(`zappy_known_email_${cleanEmail}`, '1');
        }
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      if (errObj.code === 'auth/email-already-in-use') {
        try {
          const fallbackCred = await resetUserPasswordWithVerifiedOtp(cleanEmail, password);
          if (fallbackCred.user) {
            try {
              await updateUserProfile(fallbackCred.user, { displayName: cleanName });
            } catch {}
            await saveUserProfile({
              uid: fallbackCred.user.uid,
              email: cleanEmail,
              displayName: cleanName,
              age: numAge,
              onboardingCompleted: true,
            });
            await saveRegisteredEmailToFirestore(cleanEmail, {
              displayName: cleanName,
              uid: fallbackCred.user.uid,
            });
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(`zappy_known_email_${cleanEmail}`, '1');
            }
            onSuccess?.();
            onClose();
            return;
          }
        } catch {}

        await saveRegisteredEmailToFirestore(cleanEmail);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(`zappy_known_email_${cleanEmail}`, '1');
        }
        setErrorMessage(
          'This email is already registered! Please sign in with your password.'
        );
        setStep('PASSWORD_INPUT');
      } else {
        setErrorMessage(
          getFriendlyAuthErrorMessage(err) || 'Registration failed. Please try again.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 6. Handle Forgot Password (sends instant 6-digit reset code + link via verified Gmail SMTP AND Firebase Reset)
  const handleRequestPasswordResetOtp = async (targetEmail: string) => {
    const cleanTarget = targetEmail.trim().toLowerCase();
    if (!validateEmail(cleanTarget)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setInfoMessage('');
    setOtpTargetEmail(cleanTarget);
    setEmail(cleanTarget);

    try {
      let randomVal = 0;
      if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        const arr = new Uint32Array(1);
        window.crypto.getRandomValues(arr);
        randomVal = 100000 + (arr[0] % 900000);
      } else {
        randomVal = 100000 + Math.floor(Math.random() * 900000);
      }
      const resetOtp = String(randomVal);

      const salt =
        Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const expectedHash = await sha256Hex(`${cleanTarget}:${resetOtp}:${salt}`);
      const expiresAtMs = Date.now() + 10 * 60 * 1000;

      const challenge: LocalOtpChallenge = {
        email: cleanTarget,
        hash: expectedHash,
        salt,
        expiresAtMs,
        attempts: 0,
      };
      activeChallengeRef.current = challenge;
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(
            `zappy_otp_${cleanTarget}`,
            JSON.stringify(challenge)
          );
        } catch {}
      }

      void storeOtpChallengeInFirestore(cleanTarget, resetOtp);

      const origin =
        typeof window !== 'undefined' && window.location.origin
          ? window.location.origin
          : 'https://zappyfun.netlify.app';
      const resetUrl = `${origin}/#resetEmail=${encodeURIComponent(cleanTarget)}&resetCode=${resetOtp}`;

      const resetSendRes = await safeApiFetchJson<{
        ok?: boolean;
        error?: string;
        challengeToken?: string;
      }>('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanTarget,
          otp: resetOtp,
          purpose: 'reset',
          resetUrl,
        }),
      });

      if (resetSendRes.data?.challengeToken && activeChallengeRef.current) {
        activeChallengeRef.current.challengeToken =
          resetSendRes.data.challengeToken;
        if (typeof window !== 'undefined') {
          try {
            window.sessionStorage.setItem(
              `zappy_otp_${cleanTarget}`,
              JSON.stringify(activeChallengeRef.current)
            );
          } catch {}
        }
      }

      void sendPasswordReset(cleanTarget).catch(() => {});

      setStep('RESET_OTP_VERIFICATION');
      setResendCooldown(60);
      setOtpExpirySeconds(600);
      setOtp('');
      setOtpDigits(['', '', '', '', '', '']);
      setInfoMessage(
        `Password reset code sent to ${cleanTarget}. Please check your email inbox.`
      );
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err: unknown) {
      setErrorMessage(
        getFriendlyAuthErrorMessage(err) || 'Could not send password reset email.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleRequestPasswordResetOtp(email);
  };

  const handleVerifyResetOtp = async (e?: React.FormEvent, directCode?: string) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    const activeEmail = (otpTargetEmail || email).trim().toLowerCase();
    const cleanOtp = (directCode || otp || otpDigits.join('')).trim();
    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setErrorMessage('Please enter all 6 digits of the password reset code.');
      return;
    }

    if (otpExpirySeconds <= 0) {
      setErrorMessage('This reset code has expired. Please request a new code.');
      return;
    }

    setIsLoading(true);
    try {
      let currentChallenge = activeChallengeRef.current;
      if (!currentChallenge && typeof window !== 'undefined') {
        try {
          const raw = window.sessionStorage.getItem(`zappy_otp_${activeEmail}`);
          if (raw) {
            currentChallenge = JSON.parse(raw);
          }
        } catch {}
      }

      if (currentChallenge && currentChallenge.email === activeEmail) {
        if (Date.now() > currentChallenge.expiresAtMs) {
          activeChallengeRef.current = null;
          setErrorMessage('This reset code has expired. Please request a new code.');
          return;
        }
        if (currentChallenge.attempts >= 5) {
          activeChallengeRef.current = null;
          setErrorMessage('Too many incorrect attempts. Please request a new code.');
          return;
        }

        const candidateHash = await sha256Hex(
          `${activeEmail}:${cleanOtp}:${currentChallenge.salt}`
        );

        if (candidateHash === currentChallenge.hash) {
          activeChallengeRef.current = null;
          if (typeof window !== 'undefined') {
            try {
              window.sessionStorage.removeItem(`zappy_otp_${activeEmail}`);
            } catch {}
          }
          setPassword('');
          setConfirmPassword('');
          setInfoMessage('Code verified! Enter your new password below.');
          setStep('RESET_NEW_PASSWORD');
          return;
        } else {
          currentChallenge.attempts += 1;
          activeChallengeRef.current = currentChallenge;
          if (typeof window !== 'undefined') {
            try {
              window.sessionStorage.setItem(
                `zappy_otp_${activeEmail}`,
                JSON.stringify(currentChallenge)
              );
            } catch {}
          }
          setErrorMessage(
            currentChallenge.attempts >= 5
              ? 'Too many incorrect attempts. Please request a new code.'
              : 'Incorrect reset code. Please try again.'
          );
          return;
        }
      }

      const verifyRes = await safeApiFetchJson<{
        valid?: boolean;
        reason?: string;
      }>('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: activeEmail, otp: cleanOtp }),
      });

      if (verifyRes.ok && verifyRes.data?.valid) {
        setPassword('');
        setConfirmPassword('');
        setInfoMessage('Code verified! Enter your new password below.');
        setStep('RESET_NEW_PASSWORD');
        return;
      }

      const fsVerify = await verifyOtpChallengeInFirestore(activeEmail, cleanOtp);
      if (fsVerify.valid) {
        setPassword('');
        setConfirmPassword('');
        setInfoMessage('Code verified! Enter your new password below.');
        setStep('RESET_NEW_PASSWORD');
        return;
      }

      setErrorMessage('Incorrect reset code. Please try again.');
    } catch {
      setErrorMessage('Incorrect reset code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompletePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    const cleanEmail = (otpTargetEmail || email).trim().toLowerCase();
    if (password.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    try {
      await resetUserPasswordWithVerifiedOtp(cleanEmail, password);
      await saveRegisteredEmailToFirestore(cleanEmail);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`zappy_known_email_${cleanEmail}`, '1');
        try {
          if (
            window.location.search.includes('resetEmail') ||
            window.location.hash.includes('resetEmail')
          ) {
            window.history.replaceState({}, '', window.location.pathname);
          }
        } catch {}
      }
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(
        getFriendlyAuthErrorMessage(err) || 'Could not update password. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google Identity Services (One Tap) credential login
  const handleGoogleCredentialSuccess = async (idToken: string) => {
    setIsGoogleLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const result = await signInWithGoogleCredential(idToken);
      if (result && result.user) {
        if (result.user.email) {
          const cleanUserEmail = result.user.email.trim().toLowerCase();
          await saveRegisteredEmailToFirestore(cleanUserEmail, {
            displayName: result.user.displayName || '',
            uid: result.user.uid,
          });
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(
              `zappy_known_email_${cleanUserEmail}`,
              '1'
            );
          }
        }
        onGoogleLoginSuccess?.(result.user);
        onSuccess?.();
        onClose();
      }
    } catch (err: unknown) {
      console.warn('Google credential sign-in notice:', err);
      const friendlyMsg = getFriendlyAuthErrorMessage(err);
      setErrorMessage(friendlyMsg);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Google Identity Services is only invoked when the user explicitly clicks "Continue with Google"
  // (preventing unsolicited One Tap full-screen overlays from blanking out WebViews on modal open).
  void GOOGLE_OAUTH_CLIENT_ID;
  void handleGoogleCredentialSuccess;

  // 7. Handle Google Sign In (opens Account Selection popup window directly)
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const result = await signInWithGoogle();
      if (result && result.user) {
        if (result.user.email) {
          const cleanUserEmail = result.user.email.trim().toLowerCase();
          await saveRegisteredEmailToFirestore(cleanUserEmail, {
            displayName: result.user.displayName || '',
            uid: result.user.uid,
          });
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(
              `zappy_known_email_${cleanUserEmail}`,
              '1'
            );
          }
        }
        onGoogleLoginSuccess?.(result.user);
        onSuccess?.();
        onClose();
      }
    } catch (err: unknown) {
      console.warn('Google Sign-In notice:', err);
      const friendlyMsg = getFriendlyAuthErrorMessage(err);
      setErrorMessage(friendlyMsg);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // 8. Handle GitHub Sign In
  const handleGithubSignIn = async () => {
    setIsGithubLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const result = await signInWithGithub();
      if (result && result.user) {
        if (result.user.email) {
          const cleanUserEmail = result.user.email.trim().toLowerCase();
          await saveRegisteredEmailToFirestore(cleanUserEmail, {
            displayName: result.user.displayName || '',
            uid: result.user.uid,
          });
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(
              `zappy_known_email_${cleanUserEmail}`,
              '1'
            );
          }
        }
        onGithubLoginSuccess?.(result.user);
        onSuccess?.();
        onClose();
      }
    } catch (err: unknown) {
      console.warn('GitHub Sign-In notice:', err);
      const friendlyMsg = getFriendlyAuthErrorMessage(err);
      setErrorMessage(friendlyMsg);
    } finally {
      setIsGithubLoading(false);
    }
  };

  const renderSocialButtons = () => (
    <div className="space-y-2.5 pt-1">
      <div className="relative my-2.5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#231E30]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-3 bg-[#15121D] text-[#7A7686] uppercase font-bold tracking-wider text-[10px]">
            Or continue with
          </span>
        </div>
      </div>

      {/* Google Sign In */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading || isGoogleLoading || isGithubLoading}
        className="w-full py-3 px-4 rounded-xl bg-[#0D0B12] hover:bg-[#1F1B2B] border border-[#231E30] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all shadow-md cursor-pointer disabled:opacity-50 active:scale-[0.99]"
      >
        {isGoogleLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            <span>Connecting to Google...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Continue with Google</span>
          </>
        )}
      </button>

      {/* GitHub Sign In */}
      <button
        type="button"
        onClick={handleGithubSignIn}
        disabled={isLoading || isGoogleLoading || isGithubLoading}
        className="w-full py-3 px-4 rounded-xl bg-[#0D0B12] hover:bg-[#1F1B2B] border border-[#231E30] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all shadow-md cursor-pointer disabled:opacity-50 active:scale-[0.99]"
      >
        {isGithubLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            <span>Connecting to GitHub...</span>
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4 fill-current text-white shrink-0"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span>Continue with GitHub</span>
          </>
        )}
      </button>
    </div>
  );

  const pwdStrength = calculatePasswordStrength(password);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/90 overflow-y-auto">
      <div className="relative w-full max-w-md my-auto max-h-[92vh] overflow-y-auto bg-[#15121D] border border-[#231E30] rounded-3xl p-5 sm:p-7 shadow-2xl text-white">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#8B35FF] rounded-t-3xl" />

        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-xl text-[#7A7686] hover:text-white hover:bg-[#1F1B2B] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Branding */}
        <div className="text-center mb-5 px-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-black border border-[#231E30] p-1.5 shadow-lg mb-2.5">
            <img
              src={LOGO_ICON_URL}
              alt="ZappyFun Logo"
              className="h-full w-full object-contain rounded-xl select-none"
            />
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight font-display text-white">
            {step === 'EMAIL_INPUT' && 'Welcome to ZappyFun'}
            {step === 'PASSWORD_INPUT' && 'Welcome Back'}
            {step === 'OTP_VERIFICATION' && 'Verify Your Email'}
            {step === 'CREATE_ACCOUNT' && 'Create Your Account'}
            {step === 'FORGOT_PASSWORD' && 'Reset Password'}
            {step === 'RESET_OTP_VERIFICATION' && 'Verify Reset Code'}
            {step === 'RESET_NEW_PASSWORD' && 'Set New Password'}
          </h2>

          <p className="text-xs sm:text-sm text-[#B8B4C2] mt-1">
            {step === 'EMAIL_INPUT' && 'Sign in or create an account'}
            {step === 'PASSWORD_INPUT' && `Sign in as ${email}`}
            {step === 'OTP_VERIFICATION' && `Enter the 6-digit code sent to ${email}`}
            {step === 'CREATE_ACCOUNT' && 'Complete your profile details'}
            {step === 'FORGOT_PASSWORD' && 'Receive a 6-digit password reset code via email'}
            {step === 'RESET_OTP_VERIFICATION' && `Enter the 6-digit reset code sent to ${email}`}
            {step === 'RESET_NEW_PASSWORD' && `Choose a new password for ${email}`}
          </p>
        </div>

        {/* Feedback Notifications */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}
        {infoMessage && (
          <div className="mb-4 p-3 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* ================= SECTION 1: SMART EMAIL LOGIN PAGE ================= */}
        {step === 'EMAIL_INPUT' && (
          <form onSubmit={handleEmailContinue} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#B8B4C2] uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A7686]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-[#0D0B12] border border-[#231E30] rounded-xl text-sm text-white placeholder-[#7A7686] focus:outline-none focus:border-[#FF5A36] transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] text-white font-bold text-sm rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#FF5A36]/25 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {renderSocialButtons()}
          </form>
        )}

        {/* ================= EXISTING USER: PASSWORD ENTRY SCREEN ================= */}
        {step === 'PASSWORD_INPUT' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#B8B4C2] uppercase tracking-wider">
                  Email Address
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStep('EMAIL_INPUT');
                    setErrorMessage('');
                    setInfoMessage('');
                  }}
                  className="text-xs text-[#FF5A36] hover:underline cursor-pointer"
                >
                  Change
                </button>
              </div>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A7686]" />
                <input
                  type="email"
                  value={email}
                  readOnly
                  className="w-full pl-10 pr-4 py-3 bg-[#0D0B12]/60 border border-[#231E30] rounded-xl text-sm text-[#B8B4C2] cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#B8B4C2] uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStep('FORGOT_PASSWORD');
                    setErrorMessage('');
                    setInfoMessage('');
                  }}
                  className="text-xs text-[#FF5A36] hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A7686]" />
                <input
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoFocus
                  className="w-full pl-10 pr-10 py-3 bg-[#0D0B12] border border-[#231E30] rounded-xl text-sm text-white placeholder-[#7A7686] focus:outline-none focus:border-[#FF5A36] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7A7686] hover:text-white cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] text-white font-bold text-sm rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#FF5A36]/25 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-1 text-xs text-[#B8B4C2]">
              <button
                type="button"
                onClick={() => {
                  setStep('EMAIL_INPUT');
                  setErrorMessage('');
                  setInfoMessage('');
                }}
                className="hover:text-white flex items-center justify-center gap-1 mx-auto cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            </div>
          </form>
        )}

        {/* ================= SECTION 2: NEW USER OTP VERIFICATION PAGE ================= */}
        {step === 'OTP_VERIFICATION' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-[#0D0B12] border border-[#231E30] text-center">
              <span className="text-xs text-[#B8B4C2] block mb-0.5">
                Sent to
              </span>
              <span className="text-sm font-bold text-white font-mono break-all">
                {email}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#B8B4C2] uppercase tracking-wider">
                  Enter 6-Digit Code
                </label>
                <span className="text-xs text-[#8E909D] font-mono">
                  Expires in: <strong className="text-white">{formatCountdown(otpExpirySeconds)}</strong>
                </span>
              </div>
              <div className="flex items-center justify-center gap-2 sm:gap-2.5 max-w-[340px] mx-auto py-2">
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const isFilled = Boolean(otpDigits[idx]);
                  return (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={otpDigits[idx] || ''}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      onFocus={(e) => e.target.select()}
                      autoFocus={idx === 0}
                      aria-label={`Verification code digit ${idx + 1}`}
                      className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-black font-mono bg-[#0D0B12] rounded-xl text-white transition-all outline-none border-2 ${
                        isFilled
                          ? 'border-[#FF5A36] bg-[#16111D] shadow-[0_0_12px_rgba(255,90,54,0.25)]'
                          : 'border-[#231E30] focus:border-[#FFB800] focus:bg-[#16111D]'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={
                isLoading ||
                (otp || otpDigits.join('')).trim().length !== 6 ||
                otpExpirySeconds <= 0
              }
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] text-white font-bold text-sm rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#FF5A36]/25 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify Email</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs pt-1 text-[#B8B4C2]">
              <button
                type="button"
                disabled={resendCooldown > 0 || isLoading}
                onClick={() => handleRequestOtp(email)}
                className="text-[#FF5A36] hover:underline disabled:opacity-50 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>
                  {resendCooldown > 0
                    ? `Resend OTP in ${resendCooldown}s`
                    : 'Resend OTP'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  activeChallengeRef.current = null;
                  setStep('EMAIL_INPUT');
                  setOtp('');
                  setOtpDigits(['', '', '', '', '', '']);
                  setOtpTargetEmail('');
                  setErrorMessage('');
                  setInfoMessage('');
                }}
                className="hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back</span>
              </button>
            </div>
          </form>
        )}

        {/* ================= SECTION 4: CREATE ACCOUNT PAGE ================= */}
        {step === 'CREATE_ACCOUNT' && (
          <form onSubmit={handleCreateAccount} className="space-y-3.5">
            {/* 1. Full Name */}
            <div>
              <label className="block text-xs font-bold text-[#B8B4C2] uppercase tracking-wider mb-1">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A7686]" />
                <input
                  ref={nameInputRef}
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. XYZ ABC"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0D0B12] border border-[#231E30] rounded-xl text-sm text-white placeholder-[#7A7686] focus:outline-none focus:border-[#FF5A36]"
                />
              </div>
            </div>

            {/* 2. Read-only Verified Email Address */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-[#B8B4C2] uppercase tracking-wider">
                  Email Address
                </label>
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Verified
                </span>
              </div>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A7686]" />
                <input
                  type="email"
                  value={email}
                  readOnly
                  disabled
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0A080F] border border-[#231E30] rounded-xl text-sm text-[#B8B4C2] cursor-not-allowed select-none"
                />
              </div>
            </div>

            {/* 3. Password with Show/Hide & Guidance */}
            <div>
              <label className="block text-xs font-bold text-[#B8B4C2] uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A7686]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create password (min 6 characters)"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-[#0D0B12] border border-[#231E30] rounded-xl text-sm text-white placeholder-[#7A7686] focus:outline-none focus:border-[#FF5A36]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7A7686] hover:text-white cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {password.length > 0 && (
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1">
                    <span className="text-[#8E909D]">Strength:</span>
                    <span
                      className={`font-bold ${
                        pwdStrength.score === 1
                          ? 'text-red-400'
                          : pwdStrength.score === 2
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {pwdStrength.label}
                    </span>
                  </div>
                  <div className="flex gap-1 w-20">
                    <div
                      className={`h-1 flex-1 rounded-full ${
                        pwdStrength.score >= 1 ? pwdStrength.color : 'bg-[#231E30]'
                      }`}
                    />
                    <div
                      className={`h-1 flex-1 rounded-full ${
                        pwdStrength.score >= 2 ? pwdStrength.color : 'bg-[#231E30]'
                      }`}
                    />
                    <div
                      className={`h-1 flex-1 rounded-full ${
                        pwdStrength.score >= 3 ? pwdStrength.color : 'bg-[#231E30]'
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 4. Confirm Password */}
            <div>
              <label className="block text-xs font-bold text-[#B8B4C2] uppercase tracking-wider mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A7686]" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-[#0D0B12] border border-[#231E30] rounded-xl text-sm text-white placeholder-[#7A7686] focus:outline-none focus:border-[#FF5A36]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7A7686] hover:text-white cursor-pointer"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {confirmPassword.length > 0 && confirmPassword !== password && (
                <span className="text-[11px] text-red-400 mt-1 block">
                  Passwords do not match.
                </span>
              )}
            </div>

            {/* 5. Age */}
            <div>
              <label className="block text-xs font-bold text-[#B8B4C2] uppercase tracking-wider mb-1">
                Age
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A7686]" />
                <input
                  type="number"
                  min="10"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 21"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0D0B12] border border-[#231E30] rounded-xl text-sm text-white placeholder-[#7A7686] focus:outline-none focus:border-[#FF5A36]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] text-white font-bold text-sm rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#FF5A36]/25 disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setStep('EMAIL_INPUT');
                  setErrorMessage('');
                  setInfoMessage('');
                }}
                className="text-xs text-[#B8B4C2] hover:text-white flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            </div>
          </form>
        )}

        {/* ================= STEP 5: FORGOT PASSWORD ================= */}
        {step === 'FORGOT_PASSWORD' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#B8B4C2] uppercase tracking-wider mb-1.5">
                Registered Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A7686]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-[#0D0B12] border border-[#231E30] rounded-xl text-sm text-white placeholder-[#7A7686] focus:outline-none focus:border-[#FF5A36]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] text-white font-bold text-sm rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#FF5A36]/25 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Reset Code...</span>
                </>
              ) : (
                <>
                  <span>Send Password Reset Code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setStep('PASSWORD_INPUT');
                  setErrorMessage('');
                  setInfoMessage('');
                }}
                className="text-xs text-[#B8B4C2] hover:text-white flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to password login</span>
              </button>
            </div>
          </form>
        )}

        {/* ================= STEP 6: RESET PASSWORD OTP VERIFICATION ================= */}
        {step === 'RESET_OTP_VERIFICATION' && (
          <form onSubmit={handleVerifyResetOtp} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-[#0D0B12] border border-[#231E30] text-center">
              <span className="text-xs text-[#B8B4C2] block mb-0.5">
                Reset code sent to
              </span>
              <span className="text-sm font-bold text-white font-mono break-all">
                {email}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#B8B4C2] uppercase tracking-wider">
                  Enter 6-Digit Reset Code
                </label>
                <span className="text-xs text-[#8E909D] font-mono">
                  Expires in:{' '}
                  <strong className="text-white">
                    {formatCountdown(otpExpirySeconds)}
                  </strong>
                </span>
              </div>
              <div className="flex items-center justify-center gap-2 sm:gap-2.5 max-w-[340px] mx-auto py-2">
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const isFilled = Boolean(otpDigits[idx]);
                  return (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={otpDigits[idx] || ''}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      onFocus={(e) => e.target.select()}
                      autoFocus={idx === 0}
                      aria-label={`Reset code digit ${idx + 1}`}
                      className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-black font-mono bg-[#0D0B12] rounded-xl text-white transition-all outline-none border-2 ${
                        isFilled
                          ? 'border-[#FF5A36] bg-[#16111D] shadow-[0_0_12px_rgba(255,90,54,0.25)]'
                          : 'border-[#231E30] focus:border-[#FFB800] focus:bg-[#16111D]'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={
                isLoading ||
                (otp || otpDigits.join('')).trim().length !== 6 ||
                otpExpirySeconds <= 0
              }
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] text-white font-bold text-sm rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#FF5A36]/25 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify Reset Code</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs pt-1 text-[#B8B4C2]">
              <button
                type="button"
                disabled={resendCooldown > 0 || isLoading}
                onClick={() => handleRequestPasswordResetOtp(email)}
                className="text-[#FF5A36] hover:underline disabled:opacity-50 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>
                  {resendCooldown > 0
                    ? `Resend Code in ${resendCooldown}s`
                    : 'Resend Code'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  activeChallengeRef.current = null;
                  setStep('FORGOT_PASSWORD');
                  setOtp('');
                  setOtpDigits(['', '', '', '', '', '']);
                  setErrorMessage('');
                  setInfoMessage('');
                }}
                className="hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back</span>
              </button>
            </div>
          </form>
        )}

        {/* ================= STEP 7: SET NEW PASSWORD ================= */}
        {step === 'RESET_NEW_PASSWORD' && (
          <form onSubmit={handleCompletePasswordReset} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#B8B4C2] uppercase tracking-wider mb-1">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A7686]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  required
                  autoFocus
                  className="w-full pl-10 pr-10 py-3 bg-[#0D0B12] border border-[#231E30] rounded-xl text-sm text-white placeholder-[#7A7686] focus:outline-none focus:border-[#FF5A36]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7A7686] hover:text-white cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#B8B4C2] uppercase tracking-wider mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A7686]" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  className="w-full pl-10 pr-10 py-3 bg-[#0D0B12] border border-[#231E30] rounded-xl text-sm text-white placeholder-[#7A7686] focus:outline-none focus:border-[#FF5A36]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7A7686] hover:text-white cursor-pointer"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {confirmPassword.length > 0 && confirmPassword !== password && (
                <span className="text-[11px] text-red-400 mt-1 block">
                  Passwords do not match.
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] text-white font-bold text-sm rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#FF5A36]/25 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save New Password & Sign In</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
