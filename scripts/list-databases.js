require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;

mongoose.connect(uri)
    .then(async () => {
        console.log('✅ Connected to Cluster');

        // List all databases
        const admin = new mongoose.mongo.Admin(mongoose.connection.db);
        const result = await admin.listDatabases();

        console.log('\n--- AVAILABLE DATABASES ---');
        console.table(result.databases.map(db => ({
            Name: db.name,
            Size: (db.sizeOnDisk / 1024 / 1024).toFixed(2) + ' MB',
            Empty: db.empty
        })));

        console.log('\n--> HINT: One of these is your REAL database. You need to add its name to your URI.');
        console.log('    Example: ...mongodb.net/YOUR_DB_NAME?retryWrites...');

        return mongoose.connection.close();
    })
    .catch(err => {
        console.error('❌ Error:', err);
        process.exit(1);
    });
