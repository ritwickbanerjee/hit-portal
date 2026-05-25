const mongoose = require('mongoose');
const uri = 'mongodb+srv://portal_admin:Ritamnow1259@cluster0.b639hgw.mongodb.net/portal_app?retryWrites=true&w=majority';

async function run() {
    try {
        await mongoose.connect(uri);
        // Window: 8:30 AM to 10:30 AM IST (03:00 to 05:00 UTC)
        const start = new Date('2026-04-03T03:00:00Z');
        const end = new Date('2026-04-03T05:00:00Z');

        console.log(`Checking for tests ending between ${start.toISOString()} and ${end.toISOString()}`);
        
        const tests = await mongoose.connection.db.collection('onlinetests').find({
            'deployment.endTime': { $gte: start, $lte: end }
        }).toArray();

        console.log(`\nFound ${tests.length} tests ending in this window:`);
        for (const t of tests) {
            const istTime = new Date(t.deployment.endTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
            console.log(`- "${t.title}" (ID: ${t._id})`);
            console.log(`  End Time (IST): ${istTime}`);
            
            // Check how many students were in progress for this test
            const attemptsCount = await mongoose.connection.db.collection('studenttestattempts').countDocuments({
                testId: t._id,
                updatedAt: { $gte: start, $lte: end }
            });
            console.log(`  Activity in window: ${attemptsCount} attempts updated`);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
