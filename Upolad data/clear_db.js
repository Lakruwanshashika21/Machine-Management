import admin from 'firebase-admin';
import fs from 'fs';

// 1. Initialize Firebase Admin
// Using readFileSync to load the JSON file in an ES Module environment
const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

/**
 * Deletes a collection in batches
 */
async function deleteCollection(collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  console.log(`Deleted ${batchSize} documents...`);

  // Recurse until the collection is empty
  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

// 2. Run the deletion
console.log("🗑️ Starting deletion of 'machines' collection...");
deleteCollection('machines', 400)
  .then(() => {
    console.log("✅ Successfully cleared all machine data from database.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Error clearing database:", err);
    process.exit(1);
  });