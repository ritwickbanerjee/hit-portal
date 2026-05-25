const mongoose = require('mongoose');
const uri = 'mongodb+srv://portal_admin:Ritamnow1259@cluster0.b639hgw.mongodb.net/portal_app?retryWrites=true&w=majority';

async function run() {
    try {
        await mongoose.connect(uri);
        const start = new Date('2026-04-03T03:30:00Z'); // 9:00 AM IST
        const end = new Date('2026-04-03T05:00:00Z');   // 10:30 AM IST

        console.log(`--- Investigating ADMIN activity (03:30 - 05:00 UTC) ---`);

        // 1. Check User Logins
        const adminLogins = await mongoose.connection.db.collection('users').find({
            $or: [
                { lastLogin: { $gte: start, $lte: end } },
                { updatedAt: { $gte: start, $lte: end } }
            ]
        }).toArray();
        console.log(`Admin Logins found: ${adminLogins.length}`);
        adminLogins.forEach(u => console.log(`  [${(u.lastLogin || u.updatedAt).toISOString()}] ${u.email} (${u.name})`));

        // 2. Check for UPLOADS/CREATIONS in key admin collections
        const adminCollections = ['onlinetests', 'assignments', 'resources', 'questions', 'folders'];
        for (const col of adminCollections) {
            const count = await mongoose.connection.db.collection(col).countDocuments({
                createdAt: { $gte: start, $lte: end }
            });
            if (count > 0) {
                console.log(`\n- NEW records in "${col}": ${count}`);
                const docs = await mongoose.connection.db.collection(col).find({
                    createdAt: { $gte: start, $lte: end }
                }).limit(5).toArray();
                docs.forEach(d => console.log(`  [${d.createdAt.toISOString()}] ${d.title || d.name || d._id} (By: ${d.createdBy || d.uploadedBy || 'Unknown'})`));
            } else {
                // Also check for updates
                const upCount = await mongoose.connection.db.collection(col).countDocuments({
                    updatedAt: { $gte: start, $lte: end }
                });
                if (upCount > 0) {
                    console.log(`\n- UPDATED records in "${col}": ${upCount}`);
                }
            }
        }

        // 3. Check for specific UploadChunk activity (file uploads)
        const uploads = await mongoose.connection.db.collection('uploadchunks').countDocuments({
            createdAt: { $gte: start, $lte: end }
        });
        console.log(`\nUpload chunks detected: ${uploads}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
