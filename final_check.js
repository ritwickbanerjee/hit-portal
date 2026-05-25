const mongoose = require('mongoose');
const uri = 'mongodb+srv://portal_admin:Ritamnow1259@cluster0.b639hgw.mongodb.net/portal_app?retryWrites=true&w=majority';

async function run() {
    try {
        await mongoose.connect(uri);
        
        console.log('--- Checking for LATEST activity across ALL collections ---');
        
        const collections = await mongoose.connection.db.listCollections().toArray();
        for (const colDef of collections) {
            const colName = colDef.name;
            const latest = await mongoose.connection.db.collection(colName).find().sort({ updatedAt: -1, createdAt: -1, lastLogin: -1, _id: -1 }).limit(1).toArray();
            
            if (latest.length > 0) {
                const doc = latest[0];
                const time = doc.updatedAt || doc.createdAt || doc.lastLogin || (doc._id.getTimestamp ? doc._id.getTimestamp() : null);
                if (time) {
                    const istStr = new Date(time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                    console.log(`- ${colName}: Latest activity at ${istStr} (UTC: ${new Date(time).toISOString()})`);
                }
            }
        }

        console.log('\n--- Checking for suspicious patterns ---');
        // Any students with many updates today?
        const studentActivity = await mongoose.connection.db.collection('students').countDocuments({
            updatedAt: { $gte: new Date('2026-04-03T00:00:00Z') }
        });
        console.log(`Student records updated today: ${studentActivity}`);

        // Any API Usage records today (any format)?
        const usageCount = await mongoose.connection.db.collection('apiusages').countDocuments({
            $or: [
                { date: '2026-04-03' },
                { createdAt: { $gte: new Date('2026-04-03T00:00:00Z') } }
            ]
        });
        console.log(`ApiUsage records today: ${usageCount}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
