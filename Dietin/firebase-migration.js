// Firebase Migration Script
// Run this script to migrate data from old Firebase project to new one
// Usage:
//   OLD_FIREBASE_API_KEY=... OLD_FIREBASE_PROJECT_ID=... \
//   NEW_FIREBASE_API_KEY=... NEW_FIREBASE_PROJECT_ID=... \
//   node firebase-migration.js
// All Firebase config values come from env vars; this file MUST NOT contain
// real keys, even if both keys belong to projects the team controls.
require('dotenv').config();

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const {
  getFirestore, collection, getDocs, doc, setDoc,
  writeBatch, query, limit
} = require('firebase/firestore');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`[migration] Missing env ${name} — aborting.`);
    process.exit(1);
  }
  return v;
}

const oldConfig = {
  apiKey: requireEnv('OLD_FIREBASE_API_KEY'),
  authDomain: requireEnv('OLD_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('OLD_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('OLD_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('OLD_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('OLD_FIREBASE_APP_ID'),
};

const newConfig = {
  apiKey: requireEnv('NEW_FIREBASE_API_KEY'),
  authDomain: requireEnv('NEW_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('NEW_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('NEW_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('NEW_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('NEW_FIREBASE_APP_ID'),
};

// Initialize old Firebase
const oldApp = initializeApp(oldConfig, 'oldApp');
const oldDb = getFirestore(oldApp);

// Initialize new Firebase
const newApp = initializeApp(newConfig, 'newApp');
const newDb = getFirestore(newApp);

// Helper to handle authentication
async function authenticateUser(email, password) {
  try {
    const oldAuth = getAuth(oldApp);
    await signInWithEmailAndPassword(oldAuth, email, password);
    console.log('Authentication successful for old project');

    const newAuth = getAuth(newApp);
    await signInWithEmailAndPassword(newAuth, email, password);
    console.log('Authentication successful for new project');

    return true;
  } catch (error) {
    console.error('Authentication error:', error.message);
    return false;
  }
}

// Migrate user data
async function migrateUsers() {
  console.log('Starting user migration...');
  try {
    const usersCol = collection(oldDb, 'users');
    const userSnapshot = await getDocs(usersCol);

    let userCount = 0;
    for (const userDoc of userSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;

      // Set the document with the same ID in the new database
      await setDoc(doc(newDb, 'users', userId), userData);

      console.log(`Migrated user ${userId}`);
      userCount++;

      // Migrate user's subcollections
      await migrateSubcollections(userId);
    }

    console.log(`Completed migration of ${userCount} users`);
  } catch (error) {
    console.error('Error migrating users:', error);
  }
}

// Migrate user's subcollections
async function migrateSubcollections(userId) {
  try {
    // Migrate daily calorie data
    await migrateCollection('users', userId, 'dailyCalories');

    // Migrate yearly calorie data
    await migrateCollection('users', userId, 'yearlyCalories');

    // You can add more subcollections here as needed

  } catch (error) {
    console.error(`Error migrating subcollections for user ${userId}:`, error);
  }
}

// Helper to migrate a collection or subcollection
async function migrateCollection(parentCollection, documentId, subcollectionName) {
  console.log(`Migrating ${parentCollection}/${documentId}/${subcollectionName}...`);

  const path = documentId ?
    `${parentCollection}/${documentId}/${subcollectionName}` :
    parentCollection;

  const sourceCollection = collection(oldDb, ...path.split('/'));

  // Use batched writes for better performance
  let batch = writeBatch(newDb);
  let operationCount = 0;
  const BATCH_LIMIT = 500; // Firestore batch write limit

  try {
    const snapshot = await getDocs(sourceCollection);

    if (snapshot.empty) {
      console.log(`No documents found in ${path}`);
      return;
    }

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const docRef = doc(newDb, ...path.split('/'), docSnapshot.id);

      batch.set(docRef, data);
      operationCount++;

      // If we reach the batch limit, commit the batch and create a new one
      if (operationCount >= BATCH_LIMIT) {
        await batch.commit();
        console.log(`Committed batch of ${operationCount} documents from ${path}`);
        batch = writeBatch(newDb);
        operationCount = 0;
      }
    }

    // Commit any remaining writes
    if (operationCount > 0) {
      await batch.commit();
      console.log(`Committed final batch of ${operationCount} documents from ${path}`);
    }

    console.log(`Successfully migrated ${snapshot.size} documents from ${path}`);
  } catch (error) {
    console.error(`Error migrating collection ${path}:`, error);
  }
}

// Migrate subscriptions
async function migrateSubscriptions() {
  console.log('Starting subscriptions migration...');
  try {
    await migrateCollection('subscriptions', null, null);
    console.log('Completed migration of subscriptions');
  } catch (error) {
    console.error('Error migrating subscriptions:', error);
  }
}

// Main migration function
async function migrateAllData() {
  console.log('=== Starting Firebase Data Migration ===');
  console.log('Old project: dietin-4e618');
  console.log('New project: dietin-web');

  // Skip authentication for now, or uncomment and provide credentials if needed
  // const isAuthenticated = await authenticateUser('your-admin-email@example.com', 'password');
  // if (!isAuthenticated) {
  //   console.error('Authentication failed. Cannot proceed with migration.');
  //   return;
  // }

  try {
    await migrateUsers();
    await migrateSubscriptions();

    console.log('=== Migration completed successfully ===');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the migration
migrateAllData().catch(console.error);

/*
MIGRATION INSTRUCTIONS:

1. Make sure you've created the new Firebase project and set up authentication
2. Install the required dependencies:
   npm install firebase

3. Run this script from the command line:
   node firebase-migration.js

4. Check the console output for any errors or issues
5. Verify that data was migrated correctly in Firebase Console
*/ 