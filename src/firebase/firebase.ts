import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  serverTimestamp
} from 'firebase/firestore';

// ============================================================
// REPLACE THIS BLOCK WITH YOUR FIREBASE PROJECT CONFIG
// Firebase Console → Project Settings → Your apps → Config
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyAdLxpkzBjjdzZ29HGDEvhPGXn8DBmpLa8",
  authDomain: "games-rooms.firebaseapp.com",
  projectId: "games-rooms",
  storageBucket: "games-rooms.firebasestorage.app",
  messagingSenderId: "1023357290194",
  appId: "1:1023357290194:web:f9f0bd056690a31af20f0b"
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

export async function getRoomState(roomCode) {
  const snap = await getDoc(doc(db, 'rooms', roomCode));
  return snap.exists() ? snap.data() : null;
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
