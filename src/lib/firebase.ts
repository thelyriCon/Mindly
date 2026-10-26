/**
 * Firebase Client SDK Initialization & Identity Engine
 * Configured with Firebase Authentication and Cloud Firestore.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  setDoc,
  getDocFromServer,
  runTransaction,
} from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { User } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('[Firebase Auth] Persistence configuration notice:', err);
});

// Initialize Firebase Storage
export const storage = getStorage(app);

// Configure Google OAuth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Initialize Cloud Firestore with target database ID
const dbId = firebaseConfig.firestoreDatabaseId;
export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

// Validate Connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

/**
 * Normalizes username (removes leading @, lowercases, trims)
 */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

/**
 * Checks whether a normalized username is available
 */
export async function checkUsernameAvailable(cleanUsername: string, excludeUid?: string): Promise<boolean> {
  const norm = normalizeUsername(cleanUsername);
  if (!norm || norm.length < 3) return false;

  try {
    const snap = await getDoc(doc(db, 'usernames', norm));
    if (!snap.exists()) return true;
    const data = snap.data();
    return Boolean(excludeUid && data?.uid === excludeUid);
  } catch (err) {
    console.warn('[Firebase] Username availability check warning:', err);
    return true;
  }
}

/**
 * Fetches user profile from Firestore /users/{uid}
 */
export async function getUserProfileFromFirestore(uid: string): Promise<User | null> {
  if (!uid) return null;
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return null;
    const data = snap.data();

    const user: User = {
      id: uid,
      name: data.realName || data.name || 'Mindly Learner',
      realName: data.realName || data.name || 'Mindly Learner',
      username: data.username || `@learner_${uid.slice(0, 5)}`,
      email: data.email || '',
      profileImage: data.profileImage,
      bio: data.bio || '',
      interests: Array.isArray(data.interests) ? data.interests : ['General Knowledge'],
      createdAt: data.createdAt || new Date().toISOString(),
      hasCompletedOnboarding: data.hasCompletedOnboarding ?? false,
      dailyStudyGoalMinutes: data.dailyStudyGoalMinutes || 30,
      todayStudySeconds: data.todayStudySeconds || 0,
      privacySettings: data.privacySettings || {
        profileVisibility: 'public',
        showCompletedCourses: true,
        showCertificates: true,
        showStudyActivity: true,
      },
      settings: data.settings || {
        theme: 'dark',
        fontSize: 'normal',
        aiStrictness: 'balanced',
        dailyStudyGoalMinutes: 30,
      },
    };

    return user;
  } catch (err) {
    console.error('[Firebase] Failed to fetch user profile:', err);
    return null;
  }
}

/**
 * Transactionally registers a unique username and creates /users/{uid}
 */
export async function createUserProfileInFirestore(
  uid: string,
  profile: {
    email: string;
    realName: string;
    username: string;
    interests?: string[];
    dailyStudyGoalMinutes?: number;
    profileImage?: string;
  }
): Promise<User> {
  const cleanUser = normalizeUsername(profile.username);
  if (!cleanUser || cleanUser.length < 3) {
    throw new Error('Username must be at least 3 characters long.');
  }

  const userDocRef = doc(db, 'users', uid);
  const usernameDocRef = doc(db, 'usernames', cleanUser);

  const now = new Date().toISOString();
  const formattedUsername = `@${cleanUser}`;
  const finalRealName = profile.realName.trim();

  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userDocRef);
    const usernameSnap = await transaction.get(usernameDocRef);

    if (usernameSnap.exists()) {
      const existingData = usernameSnap.data();
      if (existingData.uid !== uid) {
        throw new Error(`The username "${formattedUsername}" is already taken. Please choose another.`);
      }
    }

    // Reserve username
    transaction.set(usernameDocRef, {
      uid,
      username: cleanUser,
      createdAt: now,
    });

    const userPayload: Record<string, any> = {
      uid,
      id: uid,
      email: profile.email.toLowerCase().trim(),
      realName: finalRealName,
      name: finalRealName,
      username: formattedUsername,
      profileImage:
        profile.profileImage !== undefined
          ? (profile.profileImage || null)
          : (userSnap.exists() ? userSnap.data()?.profileImage || null : null),
      interests: profile.interests || ['General Knowledge'],
      dailyStudyGoalMinutes: profile.dailyStudyGoalMinutes || 30,
      todayStudySeconds: 0,
      hasCompletedOnboarding: true,
      createdAt: userSnap.exists() ? userSnap.data()?.createdAt || now : now,
      updatedAt: now,
      privacySettings: {
        profileVisibility: 'public',
        showCompletedCourses: true,
        showCertificates: true,
        showStudyActivity: true,
      },
      settings: {
        theme: 'dark',
        fontSize: 'normal',
        aiStrictness: 'balanced',
        dailyStudyGoalMinutes: 30,
      },
    };

    transaction.set(userDocRef, userPayload, { merge: true });
  });

  const createdUser = await getUserProfileFromFirestore(uid);
  if (!createdUser) {
    throw new Error('Failed to retrieve newly created user profile.');
  }
  return createdUser;
}

/**
 * Updates an authenticated user's profile in Cloud Firestore.
 * Always includes `uid` to satisfy firestore.rules owner verification.
 */
export async function updateUserProfileInFirestore(
  uid: string,
  updates: Partial<User>
): Promise<User | null> {
  if (!uid) return null;
  try {
    const userDocRef = doc(db, 'users', uid);
    const cleanUpdates: Record<string, any> = {
      ...updates,
      uid,
      id: uid,
      updatedAt: new Date().toISOString(),
    };

    // Remove undefined fields
    Object.keys(cleanUpdates).forEach((key) => {
      if (cleanUpdates[key] === undefined) {
        delete cleanUpdates[key];
      }
    });

    await setDoc(userDocRef, cleanUpdates, { merge: true });
    return await getUserProfileFromFirestore(uid);
  } catch (err) {
    console.error('[Firebase] Error updating profile in Firestore:', err);
    throw err;
  }
}

/**
 * Attempts to upload an avatar to Firebase Storage.
 * Returns public download URL if successful, or null if storage bucket is not configured.
 */
export async function uploadAvatarToStorage(
  uid: string,
  dataUrlOrBase64: string
): Promise<string | null> {
  try {
    const storageRef = ref(storage, `users/${uid}/avatar.webp`);
    await uploadString(storageRef, dataUrlOrBase64, 'data_url');
    return await getDownloadURL(storageRef);
  } catch (err: any) {
    // Expected when Firebase Storage bucket is not enabled or provisioned on the cloud project
    console.info('[Firebase Storage] Cloud storage upload skipped (falling back to direct Firestore profile image):', err.message);
    return null;
  }
}
