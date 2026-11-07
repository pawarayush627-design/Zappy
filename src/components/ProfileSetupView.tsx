import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Camera,
  Check,
  User as UserIcon,
  Calendar,
  Sparkles,
  Upload,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { saveUserProfile, UserProfileData, saveRegisteredEmailToFirestore } from '../firebase';
import { ALL_GENRES } from '../data/catalog';
import { Genre } from '../types/media';

function createAvatarSvgDataUri(bgStart: string, bgEnd: string, label: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgStart}" />
        <stop offset="100%" stop-color="${bgEnd}" />
      </linearGradient>
    </defs>
    <rect width="160" height="160" rx="36" fill="url(#g)" />
    <circle cx="128" cy="34" r="38" fill="${accent}" fill-opacity="0.18" />
    <circle cx="80" cy="64" r="24" fill="#ffffff" fill-opacity="0.92" />
    <path d="M38 134c6-24 24-36 42-36s36 12 42 36" fill="#ffffff" fill-opacity="0.92" />
    <text x="80" y="72" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="18" fill="${bgStart}">${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const CURATED_AVATARS = [
  {
    id: 'gold',
    label: 'Solar Gold',
    url: createAvatarSvgDataUri('#1A1405', '#FFB800', 'ZF', '#FFF3B0'),
  },
  {
    id: 'crimson',
    label: 'Cinema Red',
    url: createAvatarSvgDataUri('#1F0812', '#FF168B', 'ZF', '#FF5A36'),
  },
  {
    id: 'violet',
    label: 'Cosmic Purple',
    url: createAvatarSvgDataUri('#120924', '#8B5CF6', 'ZF', '#C4B5FD'),
  },
  {
    id: 'ocean',
    label: 'Cyber Cyan',
    url: createAvatarSvgDataUri('#061826', '#06B6D4', 'ZF', '#67E8F9'),
  },
  {
    id: 'emerald',
    label: 'Emerald',
    url: createAvatarSvgDataUri('#061F14', '#10B981', 'ZF', '#6EE7B7'),
  },
  {
    id: 'sunset',
    label: 'Sunset Flame',
    url: createAvatarSvgDataUri('#240B06', '#FF5A36', 'ZF', '#FFB800'),
  },
];

interface ProfileSetupViewProps {
  currentUser: User;
  existingProfile: UserProfileData | null;
  isFirstTimeSetup?: boolean;
  onComplete: (updatedProfile: UserProfileData) => void;
  onCancel?: () => void;
}

/**
 * Resizes an uploaded image file to a compact 256x256 JPEG data URI
 * so it loads instantaneously and fits cleanly in Firestore & localStorage.
 */
async function compressImageFileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('Invalid image format.'));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const dataUri = canvas.toDataURL('image/jpeg', 0.84);
        resolve(dataUri);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export const ProfileSetupView: React.FC<ProfileSetupViewProps> = ({
  currentUser,
  existingProfile,
  isFirstTimeSetup = false,
  onComplete,
  onCancel,
}) => {
  const initialName =
    existingProfile?.displayName ||
    currentUser.displayName ||
    currentUser.email?.split('@')[0] ||
    '';
  const initialAge =
    existingProfile?.age && existingProfile.age >= 10
      ? String(existingProfile.age)
      : '';
  const initialPhoto =
    existingProfile?.photoURL ||
    currentUser.photoURL ||
    CURATED_AVATARS[0].url;
  const initialGenres =
    existingProfile?.favoriteGenres && existingProfile.favoriteGenres.length > 0
      ? existingProfile.favoriteGenres
      : ['Action', 'Sci-Fi', 'Thriller'];

  const [displayName, setDisplayName] = useState<string>(initialName);
  const [age, setAge] = useState<string>(initialAge);
  const [photoURL, setPhotoURL] = useState<string>(initialPhoto);
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>(initialGenres);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const compressed = await compressImageFileToDataUri(file);
      setPhotoURL(compressed);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to process image.'
      );
    }
  };

  const toggleGenre = (genre: Genre) => {
    setFavoriteGenres((prev) => {
      if (prev.includes(genre)) {
        return prev.filter((g) => g !== genre);
      }
      if (prev.length >= 5) return prev;
      return [...prev, genre];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = displayName.trim();
    if (!cleanName || cleanName.length < 2) {
      setError('Please enter your name (at least 2 characters).');
      return;
    }

    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge < 10 || parsedAge > 120) {
      setError('Please enter a valid age between 10 and 120.');
      return;
    }

    setIsSaving(true);
    try {
      const updated: UserProfileData = {
        uid: currentUser.uid,
        email: currentUser.email || '',
        displayName: cleanName,
        age: parsedAge,
        photoURL,
        favoriteGenres,
        onboardingCompleted: true,
        updatedAtMs: Date.now(),
      };
      await saveUserProfile(updated);
      if (currentUser.email) {
        await saveRegisteredEmailToFirestore(currentUser.email, {
          displayName: cleanName,
          uid: currentUser.uid,
        });
      }
      onComplete(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save profile.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-xl mx-auto py-4 sm:py-8 px-2"
    >
      <div className="rounded-3xl bg-[#14161D] border border-[#292C35] shadow-2xl overflow-hidden p-5 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#FFB800]">
              {isFirstTimeSetup ? 'Welcome to ZappyFun' : 'Profile Settings'}
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight mt-0.5">
              {isFirstTimeSetup ? 'Complete Your Profile' : 'Edit Your Profile'}
            </h1>
          </div>

          {onCancel && !isFirstTimeSetup && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-2 rounded-xl bg-[#08090D] hover:bg-[#252832] border border-[#292C35] text-xs font-semibold text-[#A7A9B4] hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 font-medium"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Picture Uploader & Preset Selector */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-[#A7A9B4] uppercase tracking-wider">
              Profile Picture
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-[#08090D] border border-[#292C35]">
              <div className="relative group shrink-0">
                <img
                  src={photoURL}
                  alt="Selected profile avatar"
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-2xl object-cover ring-2 ring-[#FFB800]/60 shadow-xl bg-[#14161D]"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-xl bg-[#FFB800] hover:bg-[#FFD54A] text-[#08090D] flex items-center justify-center shadow-lg cursor-pointer transition-transform active:scale-95"
                  title="Upload custom photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="flex-1 w-full space-y-2.5 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-[#14161D] hover:bg-[#252832] border border-[#292C35] hover:border-[#FFB800]/50 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#FFB800]" />
                    <span>Upload Photo</span>
                  </button>

                  {currentUser.photoURL && photoURL !== currentUser.photoURL && (
                    <button
                      type="button"
                      onClick={() => setPhotoURL(currentUser.photoURL || '')}
                      className="px-3 py-2 rounded-xl bg-[#14161D] hover:bg-[#252832] border border-[#292C35] text-xs font-semibold text-[#A7A9B4] hover:text-white cursor-pointer transition-colors"
                    >
                      Use GitHub Photo
                    </button>
                  )}
                </div>

                {/* Preset Avatars */}
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap pt-1">
                  {CURATED_AVATARS.map((preset) => {
                    const isSelected = photoURL === preset.url;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setPhotoURL(preset.url)}
                        title={preset.label}
                        className={`relative w-9 h-9 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#FFB800] scale-105 shadow-md shadow-[#FFB800]/25'
                            : 'border-transparent opacity-75 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.label}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Name & Age Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-[#A7A9B4] uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-[#7E8292] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Name"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#08090D] border border-[#292C35] text-white placeholder-[#5A5E70] text-sm focus:outline-none focus:border-[#FFB800] transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#A7A9B4] uppercase tracking-wider">
                Age
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#7E8292] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="number"
                  min={10}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="21"
                  required
                  className="w-full pl-10 pr-3 py-3 rounded-xl bg-[#08090D] border border-[#292C35] text-white placeholder-[#5A5E70] text-sm focus:outline-none focus:border-[#FFB800] transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Favorite Genres for Personalized Recommendations */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#A7A9B4] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#FFB800]" />
                <span>Favorite Genres (Up to 5)</span>
              </label>
              <span className="text-[11px] text-[#7E8292]">
                {favoriteGenres.length}/5 selected
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {ALL_GENRES.map((genre) => {
                const active = favoriteGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      active
                        ? 'bg-[#FFB800] text-[#08090D] shadow-sm'
                        : 'bg-[#08090D] border border-[#292C35] text-[#A7A9B4] hover:text-white hover:border-[#FFB800]/40'
                    }`}
                  >
                    {active && <Check className="w-3 h-3 shrink-0" />}
                    <span>{genre}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#FFB800] via-[#FF5A36] to-[#FF168B] hover:brightness-110 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#FF5A36]/25 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Profile...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{isFirstTimeSetup ? 'Save & Start Watching' : 'Save Changes'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </motion.section>
  );
};
