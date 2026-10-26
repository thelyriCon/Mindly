/**
 * Mindly Firestore Certificates Service — Phase 3A
 * Authoritative Cloud Firestore persistence for Individual and Combined Certificates.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Certificate, CombinedCertificate } from '../types';
import { persistenceEngine } from './persistence';

/**
 * Strips undefined properties recursively so Firestore does not reject payloads.
 */
function cleanPayload<T>(val: T): T {
  if (val === undefined) return undefined as any;
  if (val === null || typeof val !== 'object') return val;
  if (val instanceof Date) return val as any;
  if (Array.isArray(val)) {
    return val
      .filter((item) => item !== undefined)
      .map((item) => cleanPayload(item)) as any;
  }
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (v !== undefined) {
      cleaned[k] = cleanPayload(v);
    }
  }
  return cleaned as any;
}

/**
 * Fetch all individual certificates for the authenticated user from Cloud Firestore.
 * /certificates/{certificateId}
 */
export async function getCertificatesFromFirestore(userId: string): Promise<Certificate[]> {
  if (!userId) return [];

  try {
    const certsRef = collection(db, 'certificates');
    const q = query(certsRef, where('userId', '==', userId));
    const snap = await getDocs(q);

    const certificates: Certificate[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as Certificate;
      certificates.push({
        ...data,
        id: data.id || docSnap.id,
        certificateId: data.certificateId || docSnap.id,
      });
    });

    // Cache to IndexedDB for offline resilience
    if (certificates.length > 0) {
      await persistenceEngine.saveCertificates(certificates).catch(() => {});
    }

    return certificates;
  } catch (err) {
    console.warn('[FIRESTORE] Failed to fetch certificates from Firestore:', err);
    throw err;
  }
}

/**
 * Fetch all combined master certificates for the authenticated user from Cloud Firestore.
 * /combinedCertificates/{combinedCertificateId}
 */
export async function getCombinedCertificatesFromFirestore(userId: string): Promise<CombinedCertificate[]> {
  if (!userId) return [];

  try {
    const combinedRef = collection(db, 'combinedCertificates');
    const q = query(combinedRef, where('userId', '==', userId));
    const snap = await getDocs(q);

    const combinedCertificates: CombinedCertificate[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as CombinedCertificate;
      combinedCertificates.push({
        ...data,
        id: data.id || docSnap.id,
        certificateId: data.certificateId || docSnap.id,
      });
    });

    // Cache to IndexedDB for offline resilience
    if (combinedCertificates.length > 0) {
      await persistenceEngine.saveCombinedCertificates(combinedCertificates).catch(() => {});
    }

    return combinedCertificates;
  } catch (err) {
    console.warn('[FIRESTORE] Failed to fetch combined certificates from Firestore:', err);
    throw err;
  }
}

/**
 * Persist an individual course completion certificate into Cloud Firestore.
 * Primary document ID uses the canonical certificateId (e.g. MND-7X9K2P) or id.
 */
export async function createCertificateInFirestore(cert: Certificate): Promise<Certificate> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to issue certificate in Firestore.');
  }

  const docId = cert.certificateId || cert.id;
  const certRef = doc(db, 'certificates', docId);

  const payload: Certificate = {
    ...cert,
    id: cert.id || docId,
    certificateId: cert.certificateId || docId,
    userId: currentUid,
    createdAt: cert.createdAt || new Date().toISOString(),
  };

  const cleaned = cleanPayload(payload);
  await setDoc(certRef, cleaned, { merge: true });

  // Update local IndexedDB cache
  await persistenceEngine.saveCertificates([payload]).catch(() => {});

  return payload;
}

/**
 * Persist a combined curriculum master certificate into Cloud Firestore.
 * Primary document ID uses the canonical certificateId (e.g. MND-COMB-4921) or id.
 */
export async function createCombinedCertificateInFirestore(
  combinedCert: CombinedCertificate
): Promise<CombinedCertificate> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to issue combined certificate in Firestore.');
  }

  const docId = combinedCert.certificateId || combinedCert.id;
  const certRef = doc(db, 'combinedCertificates', docId);

  const payload: CombinedCertificate = {
    ...combinedCert,
    id: combinedCert.id || docId,
    certificateId: combinedCert.certificateId || docId,
    userId: currentUid,
    createdAt: combinedCert.createdAt || new Date().toISOString(),
  };

  const cleaned = cleanPayload(payload);
  await setDoc(certRef, cleaned, { merge: true });

  // Update local IndexedDB cache
  await persistenceEngine.saveCombinedCertificates([payload]).catch(() => {});

  return payload;
}

/**
 * Idempotently migrate legacy certificates and combined certificates through the trusted server endpoint.
 * Running this multiple times will never duplicate certificates or overwrite valid records.
 */
export async function migrateCertificatesToFirestore(
  userId: string,
  legacyCerts: Certificate[] = [],
  legacyCombined: CombinedCertificate[] = []
): Promise<{ migratedCerts: number; migratedCombined: number }> {
  if (!userId || !auth.currentUser || auth.currentUser.uid !== userId) {
    return { migratedCerts: 0, migratedCombined: 0 };
  }

  try {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch('/api/certificates/migrate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        certificates: legacyCerts,
        combinedCertificates: legacyCombined,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        migratedCerts: data.migratedCerts || 0,
        migratedCombined: data.migratedCombined || 0,
      };
    }
  } catch (err) {
    console.warn('[MIGRATION] Certificate server migration error:', err);
  }

  return { migratedCerts: 0, migratedCombined: 0 };
}
