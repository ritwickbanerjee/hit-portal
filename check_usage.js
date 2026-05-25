const mongoose = require('mongoose');
const uri = 'mongodb+srv://portal_admin:Ritamnow1259@cluster0.b639hgw.mongodb.net/portal_app?retryWrites=true&w=majority';

async function run() {
    try {
        await mongoose.connect(uri);
        const todayStr = '2026-04-03';
        
        console.log(`Checking ApiUsage for date: ${todayStr}`);
        
        const usage = await mongoose.connection.db.collection('apiusages').find({
            date: todayStr
        }).toArray();

        console.log(`\nFound ${usage.length} user usage records for today.`);
        
        usage.sort((a, b) => b.requestCount - a.requestCount);
        
        console.log('\nTop users by request count today:');
        usage.slice(0, 10).forEach(u => {
            console.log(`- ${u.userEmail}: ${u.requestCount} requests (Last reset: ${u.lastReset})`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
