import admin from 'firebase-admin';
import fs from 'fs';
import csv from 'csv-parser';

// 1. Initialize Firebase Admin
const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const CSV_FILE = 'Book1_Sheet6.csv'; 

const clean = (val) => {
  if (!val || val === '#REF!' || val === 'NaN' || val === 'undefined' || val === '#N/A') return "";
  return String(val).trim();
};

const mapHealth = (status) => {
  const s = clean(status).toUpperCase();
  if (s.includes('P/BREAKDOWN') || s.includes('REMOVED')) return 'REMOVED';
  if (s.includes('BREAKDOWN')) return 'BREAKDOWN';
  if (s.includes('HALF')) return 'HALF_WORKING';
  return 'WORKING'; 
};

const mapOwnership = (val) => {
  const s = clean(val).toUpperCase();
  if (s.includes('RENT') || s.includes('HIRE')) return 'RENT';
  return 'OWNED';
};

async function startUpload() {
  const results = [];
  console.log(`🚀 Starting update from ${CSV_FILE}...`);

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
          // Clean basic strings
          const section = clean(row.section || row.SECTION).toUpperCase() || "UNKNOWN";
          const rawType = clean(row.type || row.Section);
          const serial = clean(row.serialNo || row['Serial No.']);
          
          // FIX: Sanitize components to remove forward slashes before creating docId
          const safeSection = section.replace(/\//g, '-');
          const safeType = rawType.toUpperCase().replace(/\s+/g, '').replace(/\//g, '-');
          const safeSerial = serial.replace(/\//g, '-');

          const docId = serial 
            ? `${safeSection}-${safeType}-${safeSerial}` 
            : `${safeSection}-TEMP-${Math.random().toString(36).substr(2, 5)}`;

          const machineType = rawType.toUpperCase().includes('KUPER') ? 'Koeper' : rawType;

          const machineData = {
            id: docId,
            rowNumber: clean(row.rowNumber) || "N/A",
            machineNumber: clean(row.machineNumber) || "N/A",
            operationalStatus: mapHealth(row.operationalStatus || row.Status),
            status: "IDLE", 
            ownership: mapOwnership(row.ownership || row.OWNERSHIP),
            rentedDate: clean(row.rentedDate || row['Rented Date']) || "",
            name: clean(row.name || row.DECRIPTION).toLowerCase(),
            brand: clean(row.brand || row.Section).toLowerCase(),
            type: machineType,
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
          batch.set(docRef, machineData, { merge: true });
        });

        try {
          await batch.commit();
          console.log(`✅ Updated batch: Rows ${i + 1} to ${Math.min(i + chunkSize, results.length)}`);
        } catch (batchError) {
          console.error(`❌ Error committing batch at row ${i + 1}:`, batchError);
        }
      }
      console.log('🏁 Update Finished Successfully!');
      process.exit(0);
    });
}

startUpload().catch(err => {
    console.error("❌ Fatal Error during update:", err);
    process.exit(1);
});