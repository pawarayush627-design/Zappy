import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

interface CinematicSplashScreenProps {
  isReady: boolean;
  onComplete: () => void;
  minDurationMs?: number;
  maxWaitTimeoutMs?: number;
}

const LOGO_ICON_URL = '/assets/aistudio/20261023_170257_6e6b6602.png';

export const CinematicSplashScreen: React.FC<CinematicSplashScreenProps> = ({
  isReady,
  onComplete,
  minDurationMs = 7000,
  maxWaitTimeoutMs = 12000,
}) => {
  const [animationStage, setAnimationStage] = useState<
    'initial' | 'opening' | 'wordmark' | 'settled' | 'exiting' | 'complete'
  >('initial');
  const [hasTimedOut, setHasTimedOut] = useState<boolean>(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState<boolean>(false);
  const prefersReducedMotion = useRef<boolean>(false);

  // Check accessibility reduced-motion preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      prefersReducedMotion.current = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;
    }
  }, []);

  // 7-Second Sequence timer orchestration
  useEffect(() => {
    if (prefersReducedMotion.current) {
      // Reduced motion: Quick graceful fade
      setAnimationStage('settled');
      const timer = setTimeout(() => {
        setMinTimeElapsed(true);
      }, 1200);
      return () => clearTimeout(timer);
    }

    // Scene 1: Cinematic large logo fade-in & smooth float (0.0s - 1.8s)
    const t1 = setTimeout(() => {
      setAnimationStage('opening');
    }, 200);

    // Scene 2: Selected component ZAPPYFUN large text reveal (1.8s - 5.2s)
    const t2 = setTimeout(() => {
      setAnimationStage('wordmark');
    }, 1800);

    // Settle & subtle radiant pulse (5.2s - 7.0s)
    const t3 = setTimeout(() => {
      setAnimationStage('settled');
    }, 5200);

    // Minimum 7-second animation duration elapsed
    const t4 = setTimeout(() => {
      setMinTimeElapsed(true);
    }, minDurationMs);

    // Max timeout to show retry if connection or initialization hangs
    const tTimeout = setTimeout(() => {
      setHasTimedOut(true);
    }, maxWaitTimeoutMs);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(tTimeout);
    };
  }, [minDurationMs, maxWaitTimeoutMs]);

  // Scene 4: Smooth transition when both min 7s elapsed AND app is ready
  useEffect(() => {
    if (
      minTimeElapsed &&
      isReady &&
      animationStage !== 'exiting' &&
      animationStage !== 'complete'
    ) {
      setAnimationStage('exiting');
      const exitTimer = setTimeout(() => {
        setAnimationStage('complete');
        onComplete();
      }, 750); // Smooth cinematic exit fade duration
      return () => clearTimeout(exitTimer);
    }
  }, [minTimeElapsed, isReady, animationStage, onComplete]);

  const handleRetry = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  if (animationStage === 'complete') {
    return null;
  }

  const isExiting = animationStage === 'exiting';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading ZappyFun"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050505] overflow-hidden select-none transition-all duration-750 ease-out ${
        isExiting
          ? 'opacity-0 scale-[1.05] pointer-events-none'
          : 'opacity-100 scale-100'
      }`}
      style={{
        backgroundColor: '#050505',
        willChange: 'opacity, transform',
      }}
    >
      {/* Cinematic Ambient Radial Glow Behind Centerpiece */}
      <div
        className="absolute w-[500px] h-[500px] sm:w-[750px] sm:h-[750px] rounded-full pointer-events-none transition-opacity duration-1000 ease-out"
        style={{
          background:
            'radial-gradient(circle, rgba(255, 90, 54, 0.22) 0%, rgba(139, 53, 255, 0.1) 45%, rgba(5, 5, 5, 0) 75%)',
          opacity: animationStage === 'initial' ? 0 : 1,
          transform: 'translate3d(0, -20px, 0)',
        }}
      />

      {/* Subtle Cinematic Vignette Texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.92) 100%)',
        }}
      />

      {/* Centerpiece Container */}
      <div className="relative flex flex-col items-center justify-center z-10 px-4">
        {/* =========================================================
            SCENE 1: LARGE BORDERLESS LOGO (BACKGROUND REMOVED)
        ========================================================= */}
        <div
          className={`relative transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            animationStage === 'initial'
              ? 'opacity-0 scale-[0.70] translate-y-8'
              : 'opacity-100 scale-100 -translate-y-3 sm:-translate-y-5'
          }`}
          style={{ willChange: 'transform, opacity' }}
        >
          {/* Ambient Flare Ring */}
          <div
            className="absolute -inset-6 rounded-full blur-3xl opacity-80 transition-opacity duration-1000 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(255, 184, 0, 0.5) 0%, rgba(255, 90, 54, 0.45) 45%, rgba(139, 53, 255, 0.35) 70%, transparent 85%)',
            }}
          />

          {/* New Official Logo with Background Removed (Large Size) */}
          <div className="relative w-40 h-40 sm:w-52 sm:h-52 md:w-64 md:h-64 flex items-center justify-center">
            <img
              src={LOGO_ICON_URL}
              alt="ZappyFun Logo"
              className="w-full h-full object-contain select-none filter drop-shadow-[0_0_35px_rgba(255,90,54,0.6)]"
              loading="eager"
            />
          </div>
        </div>

        {/* =========================================================
            SCENE 2: SELECTED COMPONENT AS BIG ANIMATED TEXT
        ========================================================= */}
        <div className="relative mt-6 sm:mt-8 px-4 flex items-center justify-center overflow-hidden">
          <div
            className="relative inline-block whitespace-nowrap"
            style={{
              clipPath:
                animationStage === 'initial' || animationStage === 'opening'
                  ? 'inset(0 100% 0 0)'
                  : 'inset(0 0% 0 0)',
              transition: prefersReducedMotion.current
                ? 'none'
                : 'clip-path 3.2s cubic-bezier(0.22, 1, 0.36, 1)',
              willChange: 'clip-path',
            }}
          >
            {/* Selected Component As Text: Big, Bold, and Cinematic */}
            <span className="font-display font-black tracking-tight text-white text-5xl sm:text-7xl md:text-8xl select-none inline-block filter drop-shadow-[0_4px_28px_rgba(255,90,54,0.45)]">
              ZAPPY
              <span className="bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] bg-clip-text text-transparent">
                FUN
              </span>
            </span>

            {/* Radiant Leading Edge "Laser Pen" Light Spark that sweeps across as it reveals */}
            {!prefersReducedMotion.current &&
              animationStage === 'wordmark' && (
                <div
                  className="absolute top-0 bottom-0 w-16 pointer-events-none animate-wordmarkSpark"
                  style={{
                    background:
                      'radial-gradient(ellipse at center, rgba(255, 184, 0, 0.95) 0%, rgba(255, 90, 54, 0.6) 45%, transparent 80%)',
                    filter: 'blur(5px)',
                    right: 0,
                  }}
                />
              )}
          </div>
        </div>
      </div>

      {/* =========================================================
          SCENE 3 & 4: ADAPTIVE INITIALIZATION PROGRESS / RETRY
      ========================================================= */}
      {/* If startup takes longer than 7s, show a sleek minimal streaming bar */}
      <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center justify-center px-4">
        {hasTimedOut && !isReady ? (
          <div className="flex flex-col items-center gap-2.5 animate-fadeIn">
            <span className="text-xs text-[#8E909D] text-center">
              Startup taking longer than expected.
            </span>
            <button
              type="button"
              onClick={handleRetry}
              className="py-1.5 px-3.5 rounded-lg bg-[#14161D] hover:bg-[#1F1B2B] border border-[#292C35] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer transition-colors shadow-md"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#FFB800]" />
              <span>Retry Connection</span>
            </button>
          </div>
        ) : (
          minTimeElapsed &&
          !isReady && (
            <div className="flex flex-col items-center gap-2 animate-fadeIn">
              <div className="w-36 sm:w-48 h-[2px] bg-[#14161D] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] rounded-full animate-indeterminateBar"
                  style={{ width: '45%' }}
                />
              </div>
              <span className="text-[10px] text-[#7A7686] font-medium tracking-wider">
                Loading Experience...
              </span>
            </div>
          )
        )}
      </div>

      {/* Keyframe Styles for the Handwriting Pen Spark and Shimmer */}
      <style>{`
        @keyframes wordmarkSpark {
          0% {
            opacity: 0;
            transform: translateX(-100%);
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateX(0%);
          }
        }
        @keyframes indeterminateBar {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(120%);
          }
          100% {
            transform: translateX(300%);
          }
        }
        .animate-wordmarkSpark {
          animation: wordmarkSpark 3.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .animate-indeterminateBar {
          animation: indeterminateBar 1.6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
