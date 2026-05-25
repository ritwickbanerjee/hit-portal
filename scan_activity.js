const mongoose = require('mongoose');
const uri = 'mongodb+srv://portal_admin:Ritamnow1259@cluster0.b639hgw.mongodb.net/portal_app?retryWrites=true&w=majority';

async function run() {
    try {
        await mongoose.connect(uri);
        const start = new Date('2026-04-03T03:30:00Z');
        const end = new Date('2026-04-03T05:00:00Z');

        console.log(`Checking ALL collections for activity between ${start.toISOString()} and ${end.toISOString()}`);
        
        const collections = await mongoose.connection.db.listCollections().toArray();
        for (const colDef of collections) {
            const colName = colDef.name;
            const count = await mongoose.connection.db.collection(colName).countDocuments({
                $or: [
                    { updatedAt: { $gte: start, $lte: end } },
                    { createdAt: { $gte: start, $lte: end } },
                    { submittedAt: { $gte: start, $lte: end } }
                ]
            });

            if (count > 0) {
                console.log(`\n- Collection "${colName}": ${count} records modified`);
                const docs = await mongoose.connection.db.collection(colName).find({
                    $or: [
                        { updatedAt: { $gte: start, $lte: end } },
                        { createdAt: { $gte: start, $lte: end } },
                        { submittedAt: { $gte: start, $lte: end } }
                    ]
                }).sort({updatedAt: 1}).limit(5).toArray();
                
                docs.forEach(d => {
                    const time = d.updatedAt || d.createdAt || d.submittedAt;
                    console.log(`  [${time.toISOString()}] ${d._id} - ${d.title || d.name || d.email || ''}`);
                });
            }
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
