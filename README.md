# Dungeon Mayhem — Browser Multiplayer

Vanilla JS + Firebase Firestore + GitHub Pages. No backend.

## Setup

### 1. Create Firebase project
Go to [console.firebase.google.com](https://console.firebase.google.com), create a new project.

### 2. Enable Firestore
Firebase Console → Build → Firestore Database → Create database → Start in **test mode** (or use the rules below).

### 3. Set Firestore rules to open
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 4. Replace config in firebase.js
Firebase Console → Project Settings → Your apps → Web app → Config.
Copy the config object into the marked block at the top of `js/firebase.js`.

### 5. Deploy to GitHub Pages
```bash
git init
git add .
git commit -m "initial"
gh repo create dungeon-mayhem --public --push --source=.
# GitHub repo → Settings → Pages → Source: Deploy from branch → main / root
```

## File structure
```
index.html
css/style.css
js/
  firebase.js   — Firebase init + Firestore helpers
  cards.js      — Card definitions for all 6 heroes
  game.js       — Game logic, turn management, card resolution
  ui.js         — DOM rendering, event listeners (entry point)
  room.js       — Room create/join, lobby management
README.md
```

## Heroes
- Sutha the Skullcrusher (Barbarian)
- Azzan the Mystic (Wizard)
- Lia the Radiant (Paladin)
- Oriax the Clever (Rogue)
- Minsc & Boo (Ranger)
- Jaheira (Druid)
