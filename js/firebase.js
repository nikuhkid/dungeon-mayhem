import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ============================================================
// REPLACE THIS BLOCK WITH YOUR FIREBASE PROJECT CONFIG
// Firebase Console → Project Settings → Your apps → Config
// ============================================================
const firebaseConfig = {
  /* REPLACE WITH YOUR CONFIG */
  apiKey: "AIzaSyBFjoTu7MpeX9_7MF6Dl-0LDmFkXM4_clE",
  authDomain: "dungeonmayhem-6c52e.firebaseapp.com",
  projectId: "dungeonmayhem-6c52e",
  storageBucket: "dungeonmayhem-6c52e.firebasestorage.app",
  messagingSenderId: "789284571553",
  appId: "1:789284571553:web:a30c3991582cd074bea3e0"
};
// ============================================================

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export async function roomExists(roomCode) {
  const snap = await getDoc(doc(db, 'rooms', roomCode));
  return snap.exists();
}

export async function createRoom(roomCode, hostId, hostName) {
  await setDoc(doc(db, 'rooms', roomCode), {
    hostId,
    status: 'lobby',
    players: {
      [hostId]: {
        name: hostName,
        heroId: null,
        hp: 10,
        shields: 0,
        hand: [],
        ready: false,
        eliminated: false
      }
    },
    decks: {},
    discardPiles: {},
    currentTurn: null,
    turnOrder: [],
    winner: null,
    lastAction: null,
    actionLog: []
  });
}

export async function joinRoom(roomCode, playerId, playerName) {
  await updateDoc(doc(db, 'rooms', roomCode), {
    [`players.${playerId}`]: {
      name: playerName,
      heroId: null,
      hp: 10,
      shields: 0,
      hand: [],
      ready: false,
      eliminated: false
    }
  });
}

export async function updateRoom(roomCode, data) {
  await updateDoc(doc(db, 'rooms', roomCode), data);
}

export async function updatePlayer(roomCode, playerId, data) {
  const prefixed = {};
  for (const [key, val] of Object.entries(data)) {
    prefixed[`players.${playerId}.${key}`] = val;
  }
  await updateDoc(doc(db, 'rooms', roomCode), prefixed);
}

export function subscribeToRoom(roomCode, callback) {
  return onSnapshot(doc(db, 'rooms', roomCode), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export { doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion, serverTimestamp };
