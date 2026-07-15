#!/usr/bin/env node
// ── Climactix Global · Firestore seed script ────────────────────────────
//
// Populates a fresh Firestore project with the same demo data community.js
// ships with, using the Admin SDK (bypasses security rules). This is the
// correct way to load demo data now that firestore.rules enforces
// per-owner write authorization — a random client can no longer write
// content "authored" by seed_priya, seed_arjun, etc. See DB_SCHEMA.md for
// the full reasoning.
//
// Setup:
//   1. Firebase Console → Project Settings → Service Accounts →
//      "Generate new private key" → save the JSON file somewhere safe,
//      OUTSIDE this repo (never commit a service account key to git).
//   2. cd scripts && npm install
//   3. GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json npm run seed
//
// Safe to re-run: skips any collection that already has documents, unless
// --force is passed (which overwrites every seed doc, leaving any
// user-created documents in the same collection untouched).

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  CX,
  SEED_PROFILES, SEED_POSTS, SEED_THREADS, SEED_FUNDING, SEED_SOLUTIONS, SEED_BATTLES,
} from '../community.js';

const FORCE = process.argv.includes('--force');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account key path first — see this file\'s header comment.');
  process.exit(1);
}

const app = initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);

const COLLECTIONS = [
  { name: CX.PROFILES,  seed: SEED_PROFILES,  idField: 'uid' },
  { name: CX.POSTS,     seed: SEED_POSTS,     idField: 'id'  },
  { name: CX.FORUM,     seed: SEED_THREADS,   idField: 'id'  },
  { name: CX.FUNDING,   seed: SEED_FUNDING,   idField: 'id'  },
  { name: CX.SOLUTIONS, seed: SEED_SOLUTIONS, idField: 'id'  },
  { name: CX.BATTLES,   seed: SEED_BATTLES,   idField: 'id'  },
];

async function seedCollection({ name, seed, idField }) {
  const existing = await db.collection(name).limit(1).get();
  if (!existing.empty && !FORCE) {
    console.log(`skip   ${name} (already has data — pass --force to overwrite)`);
    return;
  }
  const batch = db.batch();
  seed.forEach(item => batch.set(db.collection(name).doc(item[idField]), item));
  await batch.commit();
  console.log(`seeded ${name} (${seed.length} docs)`);
}

for (const collection of COLLECTIONS) {
  await seedCollection(collection);
}
console.log('Done.');
