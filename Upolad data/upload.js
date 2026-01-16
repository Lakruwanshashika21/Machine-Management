import admin from 'firebase-admin';
import fs from 'fs';
import csv from 'csv-parser';

// 1. Initialize Firebase Admin
const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// CONFIG: Set this to your current CSV file name
const CSV_FILE = 'Book1_Sheet3.csv'; 

const clean = (val) => {
  if (!val || val === '#REF!' || val === 'NaN' || val === 'undefined' || val === '#N/A') return "";
  return String(val).trim();
};

/**
 * STRICT STATUS MAPPING
 * "P/Breakdown" is mapped to "REMOVED"
 */
const mapHealth = (status) => {
  const s = clean(status).toUpperCase();
  if (s.includes('P/BREAKDOWN') || s.includes('REMOVED')) return 'REMOVED';
  if (s.includes('BREAKDOWN')) return 'BREAKDOWN';
  if (s.includes('HALF')) return 'HALF_WORKING';
  return 'WORKING'; 
};

async function startUpload() {
  // REMOVED: clearMachines() call is gone to keep your database data safe.

  const results = [];
  console.log(`🚀 Starting update from ${CSV_FILE} (Existing data will be kept)...`);

  fs.createReadStream(CSV_FILE)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      console.log(`📊 Processing ${results.length} rows...`);
      const chunkSize = 400;

      for (let i = 0; i < results.length; i += chunkSize) {
        const batch = db.batch();
        const chunk = results.slice(i, i + chunkSize);

        chunk.forEach((row) => {
          const section = clean(row.section || row.SECTION).toUpperCase() || "UNKNOWN";
          const rawType = clean(row.type || row.Section);
          const serial = clean(row.serialNo || row['Serial No.']);
          
          const docId = serial 
            ? `${section}-${rawType.toUpperCase().replace(/\s+/g, '')}-${serial}` 
            : `${section}-TEMP-${Math.random().toString(36).substr(2, 5)}`;

          const machineData = {
            id: docId,
            // Uses your renamed Excel headers
            rowNumber: clean(row.rowNumber) || "N/A",
            machineNumber: clean(row.machineNumber) || "N/A",
            
            operationalStatus: mapHealth(row.operationalStatus || row.Status),
            // We set status to IDLE for imported rows to ensure a fresh production start
            status: "IDLE", 
            
            name: clean(row.name || row.DECRIPTION).toLowerCase(),
            brand: clean(row.brand || row.Section).toLowerCase(),
            type: rawType,
            section: section,
            serialNo: serial,
            barcodeValue: clean(row.barcodeValue || row.Barcode),
            companyId: clean(row.companyId || row.ID),
            modelNo: clean(row.modelNo || row['MC NO.']),
            lastUpdated: new Date().toISOString(),
            purchaseDate: clean(row.purchaseDate || row.Acquisition) || "N/A",
            location: clean(row.location || row.Location) || "Negombo",
            machineValue: clean(row.machineValue || row.Cost).replace(/[$,]/g, '') || "0",
            needleSize: clean(row.needleSize || row['Niddle Size']) || "N/A",
            needleType: clean(row.needleType) || "N/A",
            userId: "system-update-import"
          };

          const docRef = db.collection('machines').doc(docId);
          // VITAL: { merge: true } prevents overwriting scan history or existing fields
          batch.set(docRef, machineData, { merge: true });
        });

        await batch.commit();
        console.log(`✅ Updated batch: Rows ${i + 1} to ${Math.min(i + chunkSize, results.length)}`);
      }
      console.log('🏁 Update Finished Successfully!');
      process.exit(0);
    });
}

startUpload().catch(err => {
    console.error("❌ Fatal Error during update:", err);
    process.exit(1);
});