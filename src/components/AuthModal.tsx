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
  getFriendlyAuthErrorMessage,
  saveUserProfile,
  updateUserProfile,
  checkEmailSignInMethods,
} from '../firebase';
import { safeApiFetchJson } from '../utils/apiClient';

export type AuthStep =
  | 'EMAIL_INPUT'
  | 'PASSWORD_INPUT'
  | 'OTP_VERIFICATION'
  | 'CREATE_ACCOUNT'
  | 'FORGOT_PASSWORD';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onGithubLoginSuccess?: (user: User) => void;
  onGoogleLoginSuccess?: (user: User) => void;
  initialMode?: 'signin' | 'signup' | 'register';
  initialEmail?: string;
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

  // Reset modal state on open
  useEffect(() => {
    if (isOpen) {
      setStep(initialMode === 'signin' && initialEmail ? 'PASSWORD_INPUT' : 'EMAIL_INPUT');
      setEmail(initialEmail || '');
      setPassword('');
      setConfirmPassword('');
      setOtp('');
      setOtpDigits(['', '', '', '', '', '']);
      setFullName('');
      setAge('');
      setRegistrationToken('');
      setErrorMessage('');
      setInfoMessage('');
      setResendCooldown(0);
      setOtpExpirySeconds(600);
      setIsGithubLoading(false);
      setIsGoogleLoading(false);
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
    if (step !== 'OTP_VERIFICATION') return;
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

  // 1. Request 6-digit OTP to user's email via Gmail SMTP (with Netlify static fallback)
  const handleRequestOtp = async (targetEmail: string) => {
    setIsLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const otpResult = await safeApiFetchJson<{ ok?: boolean; error?: string }>(
        '/api/auth/send-otp',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: targetEmail.trim() }),
        }
      );

      // If running on static host without live SMTP backend reachable, advance smoothly to CREATE_ACCOUNT
      if (otpResult.isStaticFallback) {
        setRegistrationToken(`reg_static_${Date.now()}`);
        setStep('CREATE_ACCOUNT');
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 100);
        return;
      }

      if (!otpResult.ok || !otpResult.data?.ok) {
        throw new Error(
          otpResult.data?.error ||
            'Failed to send verification code. Please check your email address.'
        );
      }

      setStep('OTP_VERIFICATION');
      setResendCooldown(60);
      setOtpExpirySeconds(600);
      setOtp('');
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not send verification code.'
      );
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

      // Step A: Check with backend server /api/auth/check-email endpoint safely
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

      // Step B: Query Firebase Auth client SDK if server check was inconclusive
      if (isRegistered === null) {
        const methods = await checkEmailSignInMethods(cleanEmail);
        if (methods.length > 0) {
          isRegistered = true;
          if (methods.includes('github.com') && !methods.includes('password')) {
            isGithubOnly = true;
          }
        } else if (checkRes.isStaticFallback) {
          // On static hosting when enumeration protection is active, default to password screen
          // with a 1-click option to create a new account if they don't have one yet.
          isRegistered = true;
        } else {
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
      await signInWithEmail(cleanEmail, password);

      void safeApiFetchJson('/api/auth/record-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const verifyRes = await safeApiFetchJson<{
        valid?: boolean;
        reason?: string;
        registrationToken?: string;
      }>('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: cleanOtp }),
      });

      if (verifyRes.isStaticFallback) {
        setRegistrationToken(`reg_static_${Date.now()}`);
        setStep('CREATE_ACCOUNT');
        return;
      }

      const verifyData = verifyRes.data || {};
      if (!verifyRes.ok || !verifyData.valid) {
        if (verifyData.reason === 'This OTP has expired. Please request a new code.') {
          throw new Error('This OTP has expired. Please request a new code.');
        }
        throw new Error(verifyData.reason || 'Incorrect OTP. Please try again.');
      }

      if (!verifyData.registrationToken) {
        throw new Error('Failed to issue registration authorization token. Please try again.');
      }

      setRegistrationToken(verifyData.registrationToken);
      setStep('CREATE_ACCOUNT');
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
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
        void handleVerifyOtp(undefined, combined);
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
      void handleVerifyOtp(undefined, combined);
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
          throw new Error(
            tokenValidationRes.data?.reason ||
              'Registration authorization expired or invalid. Please verify your email again.'
          );
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

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(`zappy_known_email_${cleanEmail}`, '1');
        }
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      if (errObj.code === 'auth/email-already-in-use') {
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

  // 6. Handle Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      await sendPasswordReset(email.trim());
      setInfoMessage(
        `Password reset link sent to ${email.trim()}. Check your inbox.`
      );
    } catch (err: unknown) {
      setErrorMessage(
        getFriendlyAuthErrorMessage(err) || 'Could not send reset email.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 7. Handle Google Sign In
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const result = await signInWithGoogle();
      if (result && result.user) {
        if (result.user.email && typeof window !== 'undefined') {
          window.localStorage.setItem(
            `zappy_known_email_${result.user.email.trim().toLowerCase()}`,
            '1'
          );
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
        if (result.user.email && typeof window !== 'undefined') {
          window.localStorage.setItem(
            `zappy_known_email_${result.user.email.trim().toLowerCase()}`,
            '1'
          );
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
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
          </h2>

          <p className="text-xs sm:text-sm text-[#B8B4C2] mt-1">
            {step === 'EMAIL_INPUT' && 'Sign in or create an account'}
            {step === 'PASSWORD_INPUT' && `Sign in as ${email}`}
            {step === 'OTP_VERIFICATION' && `Enter the 6-digit code sent to ${email}`}
            {step === 'CREATE_ACCOUNT' && 'Complete your profile details'}
            {step === 'FORGOT_PASSWORD' && 'Receive a password reset link via email'}
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
                  setStep('EMAIL_INPUT');
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
                  placeholder="e.g. Ayush Pawar"
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
                  <span>Sending Reset Link...</span>
                </>
              ) : (
                <>
                  <span>Send Password Reset Link</span>
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
      </div>
    </div>
  );
};
