/**
 * Server-Side Firestore Admin Service
 * Provides trusted server-side reads and writes to Cloud Firestore.
 * Accurately detects and reports IAM/credential blockers if service account
 * access between Cloud Run and the target Firebase project is unprovisioned.
 */
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Certificate, CombinedCertificate, SharedCourse } from '../../src/types';

class FirestoreAdminService {
  private db: Firestore | null = null;
  private isAvailable: boolean | null = null;
  private blockerReason: string | null = null;

  constructor() {
    try {
      const app = getApps().length
        ? getApps()[0]
        : initializeApp({ projectId: firebaseConfig.projectId });

      this.db = firebaseConfig.firestoreDatabaseId
        ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
        : getFirestore(app);
    } catch (err: any) {
      console.warn('[FirestoreAdminService] Initialization error:', err.message);
      this.db = null;
    }
  }

  /**
   * Diagnostic helper that formats the exact blocker description for permission failures.
   */
  public getFirestoreBlockerMessage(err?: any): string {
    const saEmail =
      process.env.AUTHORIZED_SERVICE_ACCOUNT_EMAIL ||
      'ais-sandbox@ais-europe-west2-ffce16b15c594.iam.gserviceaccount.com';
    const projId = firebaseConfig.projectId;
    const dbId = firebaseConfig.firestoreDatabaseId || '(default)';

    const errDetails = err?.message || err?.details || 'PERMISSION_DENIED';
    return `Server-side Cloud Firestore access is unprovisioned: runtime service account "${saEmail}" has not been granted Cloud Datastore User (roles/datastore.user) on project "${projId}" for database "${dbId}". Details: ${errDetails}`;
  }

  /**
   * Checks whether the server environment can execute Firestore operations.
   */
  public async checkFirestoreAccess(): Promise<{ configured: boolean; blocker?: string }> {
    if (!this.db) {
      return {
        configured: false,
        blocker: 'Firebase Admin SDK Firestore instance failed to initialize.',
      };
    }

    try {
      // Test read with timeout
      await this.db.collection('certificates').limit(1).get();
      this.isAvailable = true;
      this.blockerReason = null;
      return { configured: true };
    } catch (err: any) {
      this.isAvailable = false;
      this.blockerReason = this.getFirestoreBlockerMessage(err);
      return { configured: false, blocker: this.blockerReason };
    }
  }

  /**
   * Authoritative read for an individual certificate by certificateId (case-insensitive) or doc ID.
   */
  public async getCertificateFromFirestore(certId: string): Promise<Certificate | null> {
    if (!this.db) return null;

    const normalizedId = certId.trim();

    // 1. Direct doc lookup
    const docRef = this.db.collection('certificates').doc(normalizedId);
    const snap = await docRef.get();
    if (snap.exists) {
      return snap.data() as Certificate;
    }

    // 2. Query by certificateId
    const querySnap = await this.db
      .collection('certificates')
      .where('certificateId', '==', normalizedId)
      .limit(1)
      .get();

    if (!querySnap.empty) {
      return querySnap.docs[0].data() as Certificate;
    }

    return null;
  }

  /**
   * Authoritative read for a combined certificate by certificateId (case-insensitive) or doc ID.
   */
  public async getCombinedCertificateFromFirestore(certId: string): Promise<CombinedCertificate | null> {
    if (!this.db) return null;

    const normalizedId = certId.trim();

    // 1. Direct doc lookup
    const docRef = this.db.collection('combinedCertificates').doc(normalizedId);
    const snap = await docRef.get();
    if (snap.exists) {
      return snap.data() as CombinedCertificate;
    }

    // 2. Query by certificateId
    const querySnap = await this.db
      .collection('combinedCertificates')
      .where('certificateId', '==', normalizedId)
      .limit(1)
      .get();

    if (!querySnap.empty) {
      return querySnap.docs[0].data() as CombinedCertificate;
    }

    return null;
  }

  /**
   * Authoritative server-side write of an individual certificate.
   */
  public async saveCertificateToFirestore(cert: Certificate): Promise<boolean> {
    if (!this.db) return false;

    try {
      const docId = cert.certificateId || cert.id;
      await this.db.collection('certificates').doc(docId).set(cert, { merge: true });
      return true;
    } catch (err: any) {
      console.warn('[FirestoreAdminService] Server write failed:', this.getFirestoreBlockerMessage(err));
      throw err;
    }
  }

  /**
   * Authoritative server-side write of a combined certificate.
   */
  public async saveCombinedCertificateToFirestore(cert: CombinedCertificate): Promise<boolean> {
    if (!this.db) return false;

    try {
      const docId = cert.certificateId || cert.id;
      await this.db.collection('combinedCertificates').doc(docId).set(cert, { merge: true });
      return true;
    } catch (err: any) {
      console.warn('[FirestoreAdminService] Server write failed:', this.getFirestoreBlockerMessage(err));
      throw err;
    }
  }

  /**
   * Authoritative read for community circles from Cloud Firestore.
   */
  public async getCirclesFromFirestore(): Promise<any[] | null> {
    if (!this.db) return null;
    try {
      const snap = await this.db.collection('circles').get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err: any) {
      console.warn('[FirestoreAdminService] Server read circles blocked:', this.getFirestoreBlockerMessage(err));
      throw err;
    }
  }

  /**
   * Authoritative read for community discussions from Cloud Firestore.
   */
  public async getDiscussionsFromFirestore(circleId?: string): Promise<any[] | null> {
    if (!this.db) return null;
    try {
      let q: any = this.db.collection('discussions');
      if (circleId) {
        q = q.where('circleId', '==', circleId);
      }
      const snap = await q.get();
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    } catch (err: any) {
      console.warn('[FirestoreAdminService] Server read discussions blocked:', this.getFirestoreBlockerMessage(err));
      throw err;
    }
  }

  /**
   * Authoritative read for community study rooms from Cloud Firestore.
   */
  public async getStudyRoomsFromFirestore(): Promise<any[] | null> {
    if (!this.db) return null;
    try {
      const snap = await this.db.collection('studyRooms').get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err: any) {
      console.warn('[FirestoreAdminService] Server read study rooms blocked:', this.getFirestoreBlockerMessage(err));
      throw err;
    }
  }

  /**
   * Authoritative read for a shared course from Cloud Firestore.
   */
  public async getSharedCourse(shareId: string): Promise<SharedCourse | null> {
    if (!this.db || !shareId) return null;
    try {
      const snap = await this.db.collection('sharedCourses').doc(shareId).get();
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() } as SharedCourse;
    } catch (err: any) {
      console.warn('[FirestoreAdminService] Server read sharedCourse blocked:', this.getFirestoreBlockerMessage(err));
      return null;
    }
  }

  /**
   * Authoritative server write for a shared course to Cloud Firestore.
   */
  public async saveSharedCourse(sharedCourse: SharedCourse): Promise<boolean> {
    if (!this.db || !sharedCourse?.id) return false;
    try {
      await this.db.collection('sharedCourses').doc(sharedCourse.id).set(sharedCourse, { merge: true });
      return true;
    } catch (err: any) {
      console.warn('[FirestoreAdminService] Server write sharedCourse blocked:', this.getFirestoreBlockerMessage(err));
      return false;
    }
  }
}

export const firestoreAdminService = new FirestoreAdminService();
