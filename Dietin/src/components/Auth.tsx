import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/stores/userStore';
import { useState, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { auth, db, tryReconnect } from "@/lib/firebase";
import { signInWithCustomToken, sendPasswordResetEmail, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, reload, signInWithCredential, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, limit as fblimit, getDocs } from "firebase/firestore";
import { toast } from "@/components/ui/use-toast";
import { Loader2, ArrowLeft, RefreshCw, MoreHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { FcGoogle } from 'react-icons/fc';
import { FaEnvelope } from 'react-icons/fa';
import { useRotatingText } from "@/hooks/useRotatingText";
// useGoogleLogin removed in favor of standard Firebase auth
import { useTranslation } from 'react-i18next';
import ShapesTrio from '@/assets/Vectors/20250831_0538_Cheerful Shapes Trio_remix_01k3yzrkpee20vrmzy5m9xxnmv.png';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

const TYPING_SPEED = 50;
const DELETING_SPEED = 30;
const PAUSE_DURATION = 2000;

const typewriterTexts = [
  "Your personal AI fitness coach",
  "Reach your goal faster",
  "Track calories with a photo",
  "Custom workout plans for you"
];

const TypewriterText = ({ showEmailForm }: { showEmailForm: boolean }) => {
  const [textIndex, setTextIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const currentFullText = typewriterTexts[textIndex];

    if (isDeleting) {
      timer = setTimeout(() => {
        setDisplayText(currentFullText.substring(0, displayText.length - 1));
        if (displayText.length <= 1) {
          setIsDeleting(false);
          setTextIndex((prev) => (prev + 1) % typewriterTexts.length);
        }
      }, DELETING_SPEED);
    } else {
      timer = setTimeout(() => {
        setDisplayText(currentFullText.substring(0, displayText.length + 1));
        if (displayText.length === currentFullText.length) {
          timer = setTimeout(() => setIsDeleting(true), PAUSE_DURATION);
        }
      }, TYPING_SPEED);
    }

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, textIndex]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: showEmailForm ? -14 : -6 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full text-left mt-8 mb-2 h-[88px] sm:h-[100px] flex items-end"
    >
      <h1 className="text-[34px] sm:text-[38px] leading-[1.1] font-extrabold text-[#1a365d] tracking-tight font-inter">
        {displayText}
        <span className="animate-pulse ml-[2px] border-r-[4px] border-[#1a365d] inline-block align-baseline h-[32px] sm:h-[36px] translate-y-1"></span>
      </h1>
    </motion.div>
  );
};

export const Auth = () => {
  const navigate = useNavigate();
  const { setUser } = useUserStore();
  const [isLoading, setIsLoading] = useState(false);
  const { text, color, isVisible } = useRotatingText();
  const [authError, setAuthError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEntering, setIsEntering] = useState(true);
  const { t } = useTranslation();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailMode, setEmailMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Refs for programmatic focusing
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const confirmInputRef = useRef<HTMLInputElement | null>(null);
  // Smooth height animation container for swapping sections
  const [ready, setReady] = useState(false);
  const [emailStrength, setEmailStrength] = useState<number>(0);
  const [passwordHint, setPasswordHint] = useState<string>('');
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string>('');
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [allowNavigation, setAllowNavigation] = useState(false);
  // iOS PWA keyboard fix flags
  const [isIOSStandalone, setIsIOSStandalone] = useState(false);
  const [iosInputFocus, setIosInputFocus] = useState(false);
  const [iosKbHeight, setIosKbHeight] = useState(0);
  const actionCodeSettings = useMemo(() => ({
    url: typeof window !== 'undefined' ? `${window.location.origin}/verify-email` : 'https://localhost/verify-email',
    handleCodeInApp: true,
  }), []);

  const resetActionCodeSettings = useMemo(() => ({
    url: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : 'https://localhost/reset-password',
    handleCodeInApp: true,
  }), []);

  // Entry animation effect disabled for simplicity and performance
  useEffect(() => {
    setIsEntering(false);
  }, []);

  // Mark ready after first paint to avoid initial jank
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Detect iOS PWA (standalone) to apply keyboard workarounds
  useEffect(() => {
    try {
      const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
      const isIOS = /iPad|iPhone|iPod/.test(ua);
      const isStandalone = (typeof window !== 'undefined' && (
        // Safari iOS standalone flag
        (typeof (navigator as any).standalone !== 'undefined' && (navigator as any).standalone) ||
        // PWA display-mode
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      )) || false;
      setIsIOSStandalone(Boolean(isIOS && isStandalone));
    } catch {
      setIsIOSStandalone(false);
    }
  }, []);

  // While the iOS keyboard is opening, shift content up and keep focused input visible
  useEffect(() => {
    if (!isIOSStandalone) return;
    const container = containerRef.current;
    const onResize = () => {
      try {
        const vv = (window as any).visualViewport;
        if (!vv || !container) return;
        const kbHeight = Math.max(0, window.innerHeight - (vv.height + (vv.offsetTop || 0)));
        // Add bottom padding so content can move above the keyboard
        container.style.paddingBottom = kbHeight > 0 ? `${kbHeight + 24}px` : '20px';
        setIosKbHeight(kbHeight);
      } catch { }
    };

    const onFocusIn = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        setIosInputFocus(true);
        // Do not programmatically scroll; this triggers layout jumps on iOS PWA
      }
    };
    const onFocusOut = (e: Event) => {
      const related = e.target as HTMLElement | null;
      if (related && (related.tagName === 'INPUT' || related.tagName === 'TEXTAREA')) {
        setIosInputFocus(false);
        // Do not force padding adjustments; let the page settle naturally
      }
    };
    // Avoid visualViewport listeners which cause layout thrash on iOS PWA
    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
    };
  }, [isIOSStandalone]);

  // Auto-focus email input when the email form shows or mode switches
  useEffect(() => {
    if (!showEmailForm) return;
    const id = setTimeout(() => {
      try { emailInputRef.current?.focus(); } catch { }
    }, 50);
    return () => clearTimeout(id);
  }, [showEmailForm]);

  useEffect(() => {
    if (!showEmailForm) return;
    const id = setTimeout(() => {
      try { emailInputRef.current?.focus(); } catch { }
    }, 50);
    return () => clearTimeout(id);
  }, [emailMode, showEmailForm]);

  // Do not mutate body/html on focus; it causes jumps in iOS PWA
  useEffect(() => { }, [isIOSStandalone, iosInputFocus]);

  // Resend cooldown timer
  useEffect(() => {
    if (!verifyModalOpen || resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [verifyModalOpen, resendCooldown]);

  // If a user is already signed in but unverified, show the same verification modal
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    (async () => {
      try {
        await reload(u);
        const refreshed = auth.currentUser;
        if (refreshed && !refreshed.emailVerified) {
          // Only gate email/password users; allow Google/OAuth to pass
          const providerIds = (refreshed.providerData || []).map((p: any) => p?.providerId);
          const isPasswordProvider = providerIds.includes('password');
          if (!isPasswordProvider) return;
          setPendingEmail(refreshed.email || pendingEmail || '');
          setVerifyModalOpen(true);
          if (resendCooldown <= 0) setResendCooldown(30);
        }
      } catch (e) {
        console.warn('Failed to reload user for verification check on mount:', e);
      }
    })();
  }, []);

  // Lightweight password strength; optionally use global zxcvbn if present
  const assessPassword = async (pwd: string) => {
    try {
      const anyWin = (globalThis as any) || {};
      const z = anyWin.zxcvbn;
      if (typeof z === 'function') {
        const res = z(pwd);
        setEmailStrength(res.score); // 0-4
        setPasswordHint(res.feedback?.warning || res.feedback?.suggestions?.[0] || '');
        return res.score;
      }
    } catch { }
    // Fallback simple heuristic
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (pwd.length >= 12) score++;
    if (/password|1234|qwer|abcd|letmein|admin/i.test(pwd)) score = Math.max(0, score - 2);
    setEmailStrength(Math.min(score, 4));
    setPasswordHint(score < 3 ? t('auth.weakPassword', 'Use 8+ chars with upper, lower, number, symbol') : '');
    return Math.min(score, 4);
  };

  const checkVerificationAndProceed = async () => {
    try {
      setCheckingVerification(true);
      const u = auth.currentUser;
      if (!u) {
        toast({ title: t('auth.error', 'Error'), description: t('auth.notSignedIn', 'Not signed in.'), variant: 'destructive' });
        return;
      }
      await u.reload();
      if (u.emailVerified) {
        setAllowNavigation(true);
        await handleAuthSuccess({ user: u });
        setAllowNavigation(false);
        setVerifyModalOpen(false);
      } else {
        toast({ title: t('auth.notVerified', 'Not verified yet'), description: t('auth.clickLinkInEmail', 'Please click the verification link in your email.'), variant: 'default' });
      }
    } catch (e: any) {
      toast({ title: t('auth.error', 'Error'), description: e?.message || t('auth.tryAgain', 'Please try again.'), variant: 'destructive' });
    } finally {
      setCheckingVerification(false);
    }
  };

  const allowedDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
  const isAllowedEmail = (mail: string) => {
    const m = mail.trim().toLowerCase();
    const parts = m.split('@');
    if (parts.length !== 2) return false;
    return allowedDomains.includes(parts[1]);
  };

  // Auth via email
  const handleEmailRegister = async () => {
    try {
      setIsLoading(true);
      setAuthError(null);

      if (!isAllowedEmail(email)) {
        throw new Error(t('auth.emailDomainRestriction', 'Please use Gmail, Outlook, Hotmail, or iCloud email.'));
      }
      if (password !== confirmPassword) {
        throw new Error(t('auth.passwordsDontMatch', "Passwords don't match"));
      }
      const strength = await assessPassword(password);
      if (strength < 3) {
        throw new Error(t('auth.weakPasswordError', 'Please choose a stronger password.'));
      }

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (!cred.user) throw new Error('User creation failed');
      try {
        await sendEmailVerification(cred.user, actionCodeSettings);
      } catch (e: any) {
        console.warn('sendEmailVerification failed:', e);
        toast({ title: t('auth.error', 'Error'), description: t('auth.verifyEmailSendFailed', 'Could not send verification email. Try resend.'), variant: 'destructive' });
      }

      setPendingEmail(email);
      setVerifyModalOpen(true);
      setResendCooldown(30);

      // Do NOT create Firestore user doc yet to avoid global redirects.
      // We'll create/populate it inside handleAuthSuccess AFTER verification.

      toast({ title: t('auth.verifyEmailTitle', 'Verify your email'), description: t('auth.verifyEmailDesc', 'We sent a verification link to your inbox.') });
    } catch (e: any) {
      setAuthError(e?.message || t('auth.tryAgain', 'Please try again.'));
      toast({ title: t('auth.error', 'Error'), description: e?.message || t('auth.tryAgain', 'Please try again.'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (manualEmail?: string, manualPassword?: string) => {
    try {
      setIsLoading(true);
      setAuthError(null);

      const loginEmail = manualEmail || email;
      const loginPassword = manualPassword || password;

      if (!isAllowedEmail(loginEmail)) {
        throw new Error(t('auth.emailDomainRestriction', 'Please use Gmail, Outlook, Hotmail, or iCloud email.'));
      }
      const cred = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      if (!cred.user) throw new Error('Sign in failed');

      if (!cred.user.emailVerified) {
        setPendingEmail(loginEmail);
        setVerifyModalOpen(true);
        setResendCooldown(30);
        try { await sendEmailVerification(cred.user, actionCodeSettings); }
        catch (err: any) {
          console.warn('sendEmailVerification (login) failed:', err);
          toast({ title: t('auth.error', 'Error'), description: err?.message || t('auth.verifyEmailSendFailed', 'Could not send verification email. Try resend.'), variant: 'destructive' });
        }
        return;
      }

      // Verified email/password login: go through the same gated path
      setAllowNavigation(true);
      await handleAuthSuccess({ user: cred.user });
      setAllowNavigation(false);
    } catch (e: any) {
      setAuthError(e?.message || t('auth.tryAgain', 'Please try again.'));
      toast({ title: t('auth.error', 'Error'), description: e?.message || t('auth.tryAgain', 'Please try again.'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      if (resendCooldown > 0) return;
      const u = auth.currentUser;
      if (u) {
        await sendEmailVerification(u, actionCodeSettings);
        setResendCooldown(30);
        toast({ title: t('auth.verifyEmailTitle', 'Verify your email'), description: t('auth.verifyEmailResent', 'Verification email resent.') });
      }
    } catch (e: any) {
      toast({ title: t('auth.error', 'Error'), description: e?.message || t('auth.tryAgain', 'Please try again.'), variant: 'destructive' });
    }
  };

  // Removed @react-oauth/google login flow in favor of standard Firebase Auth

  const handleGoogleSignIn = async () => {
    // On native (Android/iOS), use direct native implementation
    if (Capacitor.isNativePlatform()) {
      try {
        setIsLoading(true);
        setAuthError(null);

        console.log('Starting direct native Google sign-in...');

        // Wait for AndroidInterface to be available (it's injected after WebView loads)
        const waitForAndroidInterface = () => {
          return new Promise<boolean>((resolve) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max wait

            const checkInterface = () => {
              const androidInterface = (window as any).AndroidInterface;
              if (androidInterface && typeof androidInterface.signInWithGoogle === 'function') {
                console.log('AndroidInterface found and ready');
                resolve(true);
                return;
              }

              attempts++;
              if (attempts >= maxAttempts) {
                console.log('AndroidInterface not found after waiting');
                resolve(false);
                return;
              }

              setTimeout(checkInterface, 100);
            };

            checkInterface();
          });
        };

        const interfaceAvailable = await waitForAndroidInterface();

        if (!interfaceAvailable) {
          throw new Error('Native Google Sign-In interface not available. Please ensure you are running on Android with Google Play Services.');
        }

        // Direct native Android Google Sign-In implementation
        const result = await new Promise<any>((resolve, reject) => {
          // Create a unique callback name
          const callbackName = `googleSignInCallback_${Date.now()}`;

          // Set up the callback
          (window as any)[callbackName] = (success: boolean, data: any) => {
            console.log('AndroidInterface callback received:', { success, data });
            delete (window as any)[callbackName];
            if (success) {
              resolve(data);
            } else {
              reject(new Error(data?.message || 'Native Google sign-in failed'));
            }
          };

          // Call native Android method directly
          const androidInterface = (window as any).AndroidInterface;
          console.log('Calling AndroidInterface.signInWithGoogle with callback:', callbackName);
          androidInterface.signInWithGoogle(callbackName);

          // Timeout after 30 seconds
          setTimeout(() => {
            delete (window as any)[callbackName];
            reject(new Error('Google sign-in timeout'));
          }, 30000);
        });

        if (!result.idToken) {
          throw new Error('No idToken returned from native Google sign-in');
        }

        console.log('Google sign-in successful, exchanging token with Firebase...');
        const credential = GoogleAuthProvider.credential(result.idToken);
        await signInWithCredential(auth, credential);

        const user = auth.currentUser;
        if (!user) throw new Error('Firebase user not available after native sign-in');

        await handleAuthSuccess({ user });
      } catch (err: any) {
        console.error('Native Google sign-in error:', err);
        toast({
          title: t('auth.googleSignInErrorTitle'),
          description: err?.message || t('auth.signInErrorDescGeneric'),
          variant: 'destructive'
        });
        setAuthError(`${t('auth.signInErrorTitle')}: ${err?.message || 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // On web, trigger standard Firebase Google login flow
    try {
      setIsLoading(true);
      setAuthError(null);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (!result.user) throw new Error('Firebase user not available after sign-in');
      await handleAuthSuccess({ user: result.user });
    } catch (err: any) {
      console.error('Firebase Google sign-in error:', err);
      
      // Ignore errors when user explicitly closes the popup
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        return;
      }

      toast({
        title: t('auth.googleSignInErrorTitle', 'Sign In Error'),
        description: err?.message || t('auth.signInErrorDescGeneric', 'An unknown error occurred'),
        variant: 'destructive'
      });
      setAuthError(`${t('auth.signInErrorTitle', 'Sign In Error')}: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const retryAuth = () => {
    setAuthError(null);
    setIsLoading(false);
  };

  const handleForgotPassword = async () => {
    try {
      if (!email) {
        toast({ title: t('auth.enterEmail', 'Enter your email'), description: t('auth.enterEmailDesc', 'Please enter your email above to receive a reset link.'), variant: 'default' });
        return;
      }
      await sendPasswordResetEmail(auth, email, resetActionCodeSettings);
      toast({ title: t('auth.resetSent', 'Password reset sent'), description: t('auth.resetSentDesc', 'Check your inbox for a reset link.') });
    } catch (e: any) {
      toast({ title: t('auth.resetFailed', 'Reset failed'), description: e?.message || t('auth.tryAgain', 'Please try again.'), variant: 'destructive' });
    }
  };

  const handleAuthSuccess = async (result: any) => {
    if (!result.user) {
      console.error('No user data returned from Google Sign In');
      setAuthError('No user data returned from Google Sign In');
      setIsLoading(false);
      return;
    }

    try {
      // Determine provider type early
      const providerIds = (result.user.providerData || []).map((p: any) => p?.providerId);
      const isPasswordProvider = providerIds.includes('password');
      const isGoogleProvider = providerIds.some((id: string) => String(id).includes('google'));

      // Block navigation until email is verified ONLY for email/password users
      if (isPasswordProvider && !result.user.emailVerified) {
        try { await sendEmailVerification(result.user, actionCodeSettings); }
        catch (err: any) {
          console.warn('sendEmailVerification (gate) failed:', err);
          toast({ title: t('auth.error', 'Error'), description: err?.message || t('auth.verifyEmailSendFailed', 'Could not send verification email. Try resend.'), variant: 'destructive' });
        }
        setPendingEmail(result.user.email || pendingEmail || '');
        setVerifyModalOpen(true);
        setResendCooldown((c) => (c > 0 ? c : 30));
        toast({ title: t('auth.verifyEmailTitle', 'Verify your email'), description: t('auth.verifyBeforeProceed', 'Please verify your email to continue.') });
        setIsLoading(false);
        return;
      }
      // Pull custom claims from the ID token (email, name, picture, etc.)
      const tokenResult = await result.user.getIdTokenResult(true);
      const claims: any = tokenResult?.claims || {};
      // isGoogleProvider computed above

      console.log('Auth success, user:', result.user, 'claims:', claims);
      const userDocRef = doc(db, "users", result.user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('Existing user data:', userData);

        const emailToPersist = userData.email || claims.email || result.user.email || null;
        await updateDoc(userDocRef, {
          lastUpdated: new Date().toISOString(),
          ...(emailToPersist ? { email: emailToPersist } : {})
        });

        const userWithDefaults = {
          name: userData.name || result.user.displayName || claims.name || '',
          username: userData.username || (result.user.email || claims.email || 'user').split('@')[0],
          email: userData.email || claims.email || result.user.email || null,
          calorieGoal: userData.calorieGoal || 2000,
          proteinGoal: userData.proteinGoal || 150,
          carbsGoal: userData.carbsGoal || 200,
          fatGoal: userData.fatGoal || 70,
          metabolism: userData.metabolism || 2200,
          experienceLevel: userData.experienceLevel || 'BEGINNER',
          onboardingCompleted: userData.onboardingCompleted || false,
          profilePicture: userData.profilePicture || result.user.photoURL || claims.picture || null,
          isMoodTrackerEnabled: userData.isMoodTrackerEnabled ?? true,
          moodHistory: userData.moodHistory || []
        };

        console.log('Setting user with defaults:', userWithDefaults);
        setUser(userWithDefaults);

        // Redirect based on onboarding status (only after verification AND allowed)
        if (allowNavigation || isGoogleProvider) {
          if (!userData.onboardingCompleted) navigate('/welcome', { replace: true });
          else navigate('/home', { replace: true });
        }
        console.log('Creating new user document');
        const newUser = {
          name: result.user.displayName || claims.name || '',
          username: (emailForLookup ? emailForLookup.split('@')[0] : 'user'),
          email: emailForLookup || null,
          calorieGoal: 2000,
          proteinGoal: 150,
          carbsGoal: 200,
          fatGoal: 70,
          metabolism: 2200,
          experienceLevel: 'BEGINNER' as const,
          onboardingCompleted: false,
          profilePicture: result.user.photoURL || claims.picture || null,
          isMoodTrackerEnabled: true,
          moodHistory: migratedData?.moodHistory || [],
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        };

        console.log('New user data:', newUser);
        await setDoc(userDocRef, newUser);
        console.log('Successfully created new user document');
        setUser(newUser);
        if (allowNavigation || isGoogleProvider) {
          navigate('/welcome', { replace: true });
        }
      }

      toast({
        title: t('auth.welcomeTitle'),
        description: isGoogleProvider ? t('auth.welcomeDescGoogle') : t('auth.welcomeDescEmail'),
        duration: 3000,
      });
    } catch (dbError: any) {
      console.error("Firestore error:", dbError);

      const minimalUser = {
        name: result.user.displayName || '',
        username: (result.user.email || 'user').split('@')[0],
        email: result.user.email || null,
        calorieGoal: 2000,
        proteinGoal: 150,
        carbsGoal: 200,
        fatGoal: 70,
        metabolism: 2200,
        experienceLevel: 'BEGINNER' as const,
        onboardingCompleted: false,
        profilePicture: result.user.photoURL || null,
        isMoodTrackerEnabled: true,
        moodHistory: []
      };

      console.log('Setting minimal user due to error:', minimalUser);
      setUser(minimalUser);
      // Only navigate if explicitly allowed or Google provider
      const isGoogleProvider = Array.isArray(result.user.providerData) &&
        result.user.providerData.some((p: any) => String(p?.providerId || '').includes('google'));
      if (allowNavigation || isGoogleProvider) {
        navigate('/welcome', { replace: true });
      }

      toast({
        title: t('auth.partialSignInTitle'),
        description: t('auth.partialSignInDesc'),
        variant: 'default'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`${isIOSStandalone ? 'absolute' : 'fixed'} inset-0 bg-white flex flex-col ${iosInputFocus ? 'overflow-auto' : 'overflow-visible'}`}
      style={{ height: '100svh', WebkitFillAvailable: '100%' } as any}
    >
      {/* Static Background (video removed) */}
      <AnimatePresence mode="wait">
        <div className="absolute inset-0 w-full h-full video-container">
          <div className="absolute inset-0 w-full h-full bg-white" />
          {/* Bottom decorative image, approx 10% side cut (80% width) */}
          <img
            src={ShapesTrio}
            alt="Decorative shapes"
            className="absolute bottom-0 left-1/2 -translate-x-1/2 select-none pointer-events-none"
            style={{ width: '100%', opacity: 1, bottom: '-16px' }}
            loading="eager"
          />
        </div>
      </AnimatePresence>

      {/* Main Content with Enhanced Animations (design restored) */}
      <motion.div
        initial={{ y: 12, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className={`flex-1 flex flex-col w-full ${isIOSStandalone && iosInputFocus ? 'justify-start' : 'justify-between'} relative z-20 content-wrapper`}
        style={{
          height: '100%',
          minHeight: 'min-content',
          paddingBottom: '32px',
          paddingTop: '20px',
          // Important: avoid transforms while keyboard open on iOS standalone
          transform: isIOSStandalone ? 'none' as any : undefined
        }}
      >
        {/* Top Bar */}
        <div className="w-full flex justify-between items-center px-6 pt-4">
          <button onClick={() => window.location.reload()} className="p-2.5 rounded-full bg-gray-50/80 backdrop-blur-md hover:bg-gray-100 transition-colors shadow-sm">
            <RefreshCw className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center justify-center">
            <img src="/11.png" alt="Dietin Logo" className="h-[48px] w-auto object-contain" />
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <button className="p-2.5 rounded-full bg-gray-50/80 backdrop-blur-md hover:bg-gray-100 transition-colors shadow-sm">
                <MoreHorizontal className="w-5 h-5 text-gray-700" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-[32px] pb-12 pt-8 px-6">
              <SheetHeader>
                <SheetTitle className="text-left font-inter mb-4 text-2xl font-bold">Support</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-3 mt-2">
                <a 
                  href="mailto:support@dietin.pro"
                  className="w-full py-4 px-5 bg-gray-100 hover:bg-gray-200 rounded-2xl text-left font-semibold text-gray-900 transition-colors flex items-center gap-3"
                >
                  <FaEnvelope className="w-5 h-5 text-gray-600" />
                  Contact Support
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Bottom Content Wrapper */}
        <div className="w-full flex flex-col items-center">
        <div className="w-full max-w-[420px] mx-auto px-6">
          <TypewriterText showEmailForm={showEmailForm} />
          {/* Actions in middle with animated switch */}
          <div className="w-full">
            {/* Smooth height-resizing wrapper focusing only on size, with cross-fade children */}
            <motion.div layout="size" initial={false} animate={{}} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: 'visible' }}>
              <AnimatePresence mode="wait" initial={false}>
                {!showEmailForm ? (
                  <motion.div
                    key="buttons"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full space-y-4 will-change-opacity"
                  >
                    <h2 className="text-[22px] font-bold text-gray-900 mb-3 font-inter text-left">Sign in</h2>
                    <div className="space-y-3.5">
                      <button
                        onClick={handleGoogleSignIn}
                        disabled={isLoading}
                        className="w-full bg-[#1c1c1e] text-white rounded-full py-4 px-5 flex items-center justify-center gap-3 transition-all duration-200 hover:opacity-90 shadow-md"
                      >
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <FcGoogle className="w-5 h-5 bg-white rounded-full" />
                            <span className="font-semibold font-inter text-[16px]">{t('auth.continueWithGoogle', 'Continue with Google')}</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setShowEmailForm(true)}
                        disabled={isLoading}
                        className="w-full bg-[#1c1c1e] text-white rounded-full py-4 px-5 flex items-center justify-center gap-3 transition-all duration-200 hover:opacity-90 shadow-md"
                      >
                        <FaEnvelope className="w-5 h-5" />
                        <span className="font-semibold font-inter text-[16px]">{t('auth.continueWithEmail', 'Continue with Email')}</span>
                      </button>

                      {/* Hardcoded Test Account Button */}
                      <button
                        onClick={() => handleEmailLogin('abderuhamanelfekky@gmail.com', 'abdo12345')}
                        disabled={isLoading}
                        className="w-full bg-gray-100 text-gray-800 rounded-full py-3.5 px-5 flex items-center justify-center gap-3 transition-all duration-200 hover:bg-gray-200 shadow-sm mt-5"
                      >
                        <span className="font-medium font-inter text-[16px]">Login with Test Account</span>
                      </button>
                    </div>

                    {authError && (
                      <p className="text-xs text-red-500 text-center mt-2">{authError}</p>
                    )}
                    <p className="text-center text-gray-500 text-xs mt-6 font-inter pt-4">
                      Terms of Use (EULA) & Privacy Policy
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="emailForm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="bg-white/90 backdrop-blur rounded-[32px] border border-gray-100 shadow-lg p-4 will-change-opacity"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setShowEmailForm(false)}
                        className="flex items-center gap-1 text-sm text-gray-700 hover:text-black transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        {t('auth.back', 'Back')}
                      </button>
                      <div className="flex-1" />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEmailMode('register')}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${emailMode === 'register' ? 'bg-black text-white border-black' : 'bg-white text-black border-gray-300'}`}
                        >
                          {t('auth.createAccount', 'Create account')}
                        </button>
                        <button
                          onClick={() => setEmailMode('login')}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${emailMode === 'login' ? 'bg-black text-white border-black' : 'bg-white text-black border-gray-300'}`}
                        >
                          {t('auth.login', 'Log in')}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence mode="wait" initial={false}>
                      {emailMode === 'register' ? (
                        <motion.div
                          key="register"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          className="space-y-3"
                        >
                          <input
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            ref={emailInputRef}
                            value={email}
                            onFocus={() => setIosInputFocus(true)}
                            onTouchStart={(e) => { try { (e.currentTarget as HTMLInputElement).focus(); } catch { } }}
                            onBlur={() => setIosInputFocus(false)}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t('auth.email', 'Email') as string}
                            className={`w-full rounded-full border px-4 py-3 outline-none focus:ring-2 focus:ring-black/20 ${email && !isAllowedEmail(email) ? 'border-red-400' : 'border-gray-300'}`}
                          />
                          <input
                            type="password"
                            autoComplete="new-password"
                            ref={passwordInputRef}
                            value={password}
                            onFocus={() => setIosInputFocus(true)}
                            onTouchStart={(e) => { try { (e.currentTarget as HTMLInputElement).focus(); } catch { } }}
                            onBlur={() => setIosInputFocus(false)}
                            onChange={async (e) => { setPassword(e.target.value); await assessPassword(e.target.value); }}
                            placeholder={t('auth.password', 'Password') as string}
                            className="w-full rounded-full border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-black/20"
                          />
                          <div className="flex items-center gap-2 px-1">
                            <div className="flex-1 h-1 rounded-full bg-gray-200 overflow-hidden">
                              <div className={`h-full transition-all duration-300 ${emailStrength <= 1 ? 'bg-red-400 w-1/4' : emailStrength === 2 ? 'bg-yellow-400 w-2/4' : emailStrength === 3 ? 'bg-lime-500 w-3/4' : 'bg-green-600 w-full'}`}></div>
                            </div>
                            <span className="text-[11px] text-gray-600">{emailStrength <= 1 ? t('auth.weak', 'Weak') : emailStrength === 2 ? t('auth.fair', 'Fair') : emailStrength === 3 ? t('auth.good', 'Good') : t('auth.strong', 'Strong')}</span>
                          </div>
                          {passwordHint && (<p className="text-[11px] text-gray-600 px-1">{passwordHint}</p>)}
                          <input
                            type="password"
                            autoComplete="new-password"
                            ref={confirmInputRef}
                            value={confirmPassword}
                            onFocus={() => setIosInputFocus(true)}
                            onTouchStart={(e) => { try { (e.currentTarget as HTMLInputElement).focus(); } catch { } }}
                            onBlur={() => setIosInputFocus(false)}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder={t('auth.passwordConfirm', 'Re-enter password') as string}
                            className={`w-full rounded-full border px-4 py-3 outline-none focus:ring-2 focus:ring-black/20 ${confirmPassword && confirmPassword !== password ? 'border-red-400' : 'border-gray-300'}`}
                          />
                          <div className="flex items-center justify-between">
                            <button type="button" onClick={handleEmailRegister} className="rounded-full bg-black text-white px-5 py-3 text-sm font-semibold shadow hover:opacity-90 disabled:opacity-60" disabled={isLoading}>
                              {isLoading ? t('auth.working', 'Working...') : t('auth.createAccount', 'Create account')}
                            </button>
                            <button type="button" onClick={handleForgotPassword} className="text-sm text-gray-700 hover:text-black underline underline-offset-2">
                              {t('auth.forgotPassword', 'Forgot password?')}
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="login"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          className="space-y-3"
                        >
                          <input
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            ref={emailInputRef}
                            value={email}
                            onFocus={() => setIosInputFocus(true)}
                            onTouchStart={(e) => { try { (e.currentTarget as HTMLInputElement).focus(); } catch { } }}
                            onBlur={() => setIosInputFocus(false)}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t('auth.email', 'Email') as string}
                            className={`w-full rounded-full border px-4 py-3 outline-none focus:ring-2 focus:ring-black/20 ${email && !isAllowedEmail(email) ? 'border-red-400' : 'border-gray-300'}`}
                          />
                          <input
                            type="password"
                            autoComplete="current-password"
                            ref={passwordInputRef}
                            value={password}
                            onFocus={() => setIosInputFocus(true)}
                            onTouchStart={(e) => { try { (e.currentTarget as HTMLInputElement).focus(); } catch { } }}
                            onBlur={() => setIosInputFocus(false)}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t('auth.password', 'Password') as string}
                            className="w-full rounded-full border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-black/20"
                          />
                          <div className="flex items-center justify-between">
                            <button type="button" onClick={() => handleEmailLogin()} className="rounded-full bg-black text-white px-5 py-3 text-sm font-semibold shadow hover:opacity-90 disabled:opacity-60" disabled={isLoading}>
                              {isLoading ? t('auth.working', 'Working...') : t('auth.login', 'Log in')}
                            </button>
                            <button type="button" onClick={handleForgotPassword} className="text-sm text-gray-700 hover:text-black underline underline-offset-2">
                              {t('auth.forgotPassword', 'Forgot password?')}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
        </div>
      </motion.div>
      {/* Email verification modal */}
      <AnimatePresence>
        {verifyModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="bg-white rounded-[24px] shadow-2xl border border-gray-100 max-w-md w-full p-5 text-center">
              <h3 className="text-xl font-extrabold mb-1">{t('auth.verifyEmailTitle', 'Verify your email')}</h3>
              <p className="text-sm text-gray-700 mb-3">{t('auth.verifyEmailPrompt', 'Please verify your email address sent to')} <span className="font-semibold">{pendingEmail}</span></p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <button onClick={handleResendVerification} disabled={resendCooldown > 0} className="rounded-full bg-black text-white px-4 py-2 text-sm font-semibold disabled:opacity-60">
                  {resendCooldown > 0 ? t('auth.resendIn', 'Resend in') + ` ${resendCooldown}s` : t('auth.resend', 'Resend')}
                </button>
                <button onClick={checkVerificationAndProceed} disabled={checkingVerification} className="rounded-full bg-white text-black border border-gray-300 px-4 py-2 text-sm font-semibold disabled:opacity-60">
                  {checkingVerification ? t('auth.checking', 'Checking...') : t('auth.alreadyVerified', 'I already verified')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Auth;