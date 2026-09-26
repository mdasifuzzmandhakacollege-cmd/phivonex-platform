import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp({
  projectId: firebaseConfig.projectId,
  appId: firebaseConfig.appId,
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
});

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with specific database ID if configured
const configAny = firebaseConfig as any;
export const db = configAny.firestoreDatabaseId && configAny.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, configAny.firestoreDatabaseId)
  : getFirestore(app);

export default app;
