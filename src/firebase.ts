import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Secondary app for creating users without logging out the admin
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
export const secondaryAuth = getAuth(secondaryApp);

export const loginWithCredentials = async (username: string, password: string) => {
  const cleanUsername = username.trim();
  const email = `${cleanUsername}@digitalregistrar.app`;
  let userCredential;
  
  try {
    userCredential = await signInWithEmailAndPassword(auth, email, password);
  } catch (error: any) {
    // Si es el administrador por defecto y no existe, lo creamos automáticamente la primera vez
    if ((cleanUsername === '41916759' && password === 'Joysse1809@') || cleanUsername === 'admin') {
      try {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } catch (createError) {
        throw error; // Lanza el error original de signIn
      }
    } else {
      throw error;
    }
  }

  // Una vez autenticado, verificamos/creamos el documento en Firestore
  try {
    const userDocRef = doc(db, 'users', userCredential.user.uid);
    const userDocSnap = await getDoc(userDocRef);
    
    if (!userDocSnap.exists()) {
      const role = (cleanUsername === '41916759' || cleanUsername === 'admin') ? 'admin' : 'teacher';
      const name = role === 'admin' ? 'Administrador Principal' : 'Profesor';
      
      await setDoc(userDocRef, {
        uid: userCredential.user.uid,
        username: cleanUsername,
        role: role,
        name: name
      });
    }
    return userCredential;
  } catch (firestoreError: any) {
    console.error("Error de Firestore al iniciar sesión:", firestoreError);
    if (firestoreError.message?.toLowerCase().includes('offline')) {
      throw new Error('No se pudo conectar a la base de datos (Cliente offline). Verifica tu conexión o la cuota de Firebase.');
    }
    throw new Error(`Error de base de datos: ${firestoreError.message}`);
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
  }
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
