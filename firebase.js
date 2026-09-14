import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Firebaseのウェブ設定。apiKeyはアクセス制御の要ではない（Firestoreのセキュリティルール側で制御する）ため、
// 公式にコードへ直書きしてよいとされている値。
const firebaseConfig = {
  apiKey: 'AIzaSyCefUWA1zHGXrz7xg4RLe2n8hLjzRXXaTg',
  authDomain: 'recipe-book-de1e2.firebaseapp.com',
  projectId: 'recipe-book-de1e2',
  storageBucket: 'recipe-book-de1e2.firebasestorage.app',
  messagingSenderId: '886483465257',
  appId: '1:886483465257:web:a5e902b36b159d8b439838',
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const recipesRef = collection(db, 'recipes');

/* ---------- 認証 ---------- */

export function signIn() {
  return signInWithPopup(auth, googleProvider);
}

export function signOutUser() {
  return firebaseSignOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export function currentUser() {
  return auth.currentUser;
}

/* ---------- レシピデータ（Firestore） ---------- */

function normalizeIngredientName(name) {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60)); // カタカナ→ひらがな
}

export function ingredientNamesOf(ingredients) {
  return [...new Set((ingredients || []).map((item) => normalizeIngredientName(item.name)).filter(Boolean))];
}

export function normalizeSearchTerm(term) {
  return normalizeIngredientName(term);
}

export function createRecipe(fields = {}) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: '',
    servings: '',
    ingredients: [],
    ingredientNames: [],
    steps: [],
    tags: [],
    sourceType: 'manual',
    sourceUrl: '',
    photoUrl: '',
    creator: '',
    memo: '',
    createdBy: '',
    updatedBy: '',
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}

let cache = [];
let unsubscribeSnapshot = null;
const listeners = new Set();

function notify() {
  for (const listener of listeners) listener();
}

/* サインイン中の家族のFirestoreを購読する。サインアウト中は購読を止めてキャッシュを空にする。 */
export function startSync() {
  unsubscribeSnapshot?.();
  cache = [];
  unsubscribeSnapshot = onSnapshot(
    query(recipesRef, orderBy('updatedAt', 'desc')),
    (snapshot) => {
      cache = snapshot.docs.map((d) => d.data());
      notify();
    },
    (error) => {
      console.error('recipes onSnapshot error', error);
    }
  );
}

export function stopSync() {
  unsubscribeSnapshot?.();
  unsubscribeSnapshot = null;
  cache = [];
  notify();
}

export function onChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function listRecipes() {
  return cache;
}

export async function getRecipe(id) {
  return cache.find((r) => r.id === id) || null;
}

export async function saveRecipe(recipe) {
  const record = {
    ...recipe,
    ingredientNames: ingredientNamesOf(recipe.ingredients),
    updatedAt: new Date().toISOString(),
  };
  await setDoc(doc(recipesRef, record.id), record);
  return record;
}

export async function deleteRecipe(id) {
  await deleteDoc(doc(recipesRef, id));
}
