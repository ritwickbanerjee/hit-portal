const mongoose = require('mongoose');
const uri = 'mongodb+srv://portal_admin:Ritamnow1259@cluster0.b639hgw.mongodb.net/portal_app?retryWrites=true&w=majority';

async function run() {
    try {
        await mongoose.connect(uri);
        const start = new Date('2026-04-03T03:30:00Z'); // 9:00 AM IST
        const end = new Date('2026-04-03T05:00:00Z');   // 10:30 AM IST

        console.log(`Searching for auto-expired attempts between ${start.toISOString()} and ${end.toISOString()}`);
        
        const count = await mongoose.connection.db.collection('studenttestattempts').countDocuments({
            updatedAt: { $gte: start, $lte: end },
            terminationReason: 'server_auto_expired'
        });

        console.log(`\nFound ${count} attempts that were auto-expired in this window.`);

        if (count > 0) {
            const sample = await mongoose.connection.db.collection('studenttestattempts').find({
                updatedAt: { $gte: start, $lte: end },
                terminationReason: 'server_auto_expired'
            }).limit(1).toArray();
            
            if (sample.length > 0) {
                console.log(`Sample Test ID: ${sample[0].testId}`);
                const test = await mongoose.connection.db.collection('onlinetests').findOne({ _id: sample[0].testId });
                console.log(`Test Title: ${test ? test.title : 'Unknown'}`);
            }
        }

        // Also check for MANY updates to the same test
        const testUpdates = await mongoose.connection.db.collection('onlinetests').find({
            updatedAt: { $gte: start, $lte: end }
        }).toArray();
        console.log(`\nTests updated in window: ${testUpdates.length}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
