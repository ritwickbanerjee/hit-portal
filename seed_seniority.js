import { MongoClient } from 'mongodb';

const uri = "mongodb://localhost:27017"; // Assuming local mongodb or replace with process.env.MONGODB_URI
// Actually, it's a Next.js app, let's use the local mongodb or check .env.local

async function seed() {
    const client = new MongoClient(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/portal");
    await client.connect();
    const db = client.db();

    const seniorityList = ['sc', 'dc', 'ms', 'sd', 'sds', 'sb', 'mp', 'vb', 'sg', 'ap', 'rb', 'sk', 'sr', 'nf'];
    const seniorityMap = new Map();
    seniorityList.forEach((code, index) => {
        seniorityMap.set(code.toUpperCase(), index + 1); // sc=1, dc=2, etc.
    });

    const routines = await db.collection('routines').find({}).toArray();
    let updated = 0;

    for (const routine of routines) {
        if (!routine.faculties) continue;
        
        let changed = false;
        routine.faculties.forEach(fac => {
            const sn = seniorityMap.get(fac.code.toUpperCase());
            if (sn !== undefined) {
                fac.seniority = sn;
                changed = true;
            }
        });

        if (changed) {
            await db.collection('routines').updateOne(
                { _id: routine._id },
                { $set: { faculties: routine.faculties } }
            );
            updated++;
        }
    }

    console.log(`Updated ${updated} routines with seniority data.`);
    await client.close();
}

seed().catch(console.error);
