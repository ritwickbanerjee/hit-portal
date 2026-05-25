const mongoose = require('mongoose');
const uri = 'mongodb+srv://portal_admin:Ritamnow1259@cluster0.b639hgw.mongodb.net/portal_app?retryWrites=true&w=majority';

async function run() {
    try {
        await mongoose.connect(uri);
        const start = new Date('2026-04-03T03:30:00Z');
        const end = new Date('2026-04-03T05:00:00Z');

        const notes = await mongoose.connection.db.collection('notifications').find({
            updatedAt: { $gte: start, $lte: end }
        }).toArray();

        console.log(`Found ${notes.length} notifications in spike window:`);
        notes.forEach(n => {
            console.log(`- [${n.updatedAt.toISOString()}] ${n.title}`);
            console.log(`  Target: ${n.department} ${n.year} ${n.courseCode || ''}`);
            console.log(`  Fields: ${Object.keys(n).join(', ')}`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
