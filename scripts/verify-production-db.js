const mongoose = require('mongoose');

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function checkProductionDB() {
    try {
        // Connect to portal_app database
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('MONGODB_URI is not defined in .env.local');
        }

        console.log('Connecting to portal_app database...\n');
        await mongoose.connect(uri);
        console.log('✓ Connected to MongoDB\n');

        const connection = mongoose.connection;
        console.log('Database Name:', connection.db.databaseName);
        console.log('='.repeat(80));

        // List all collections
        const collections = await connection.db.listCollections().toArray();
        console.log('\nCollections:');
        for (const collection of collections) {
            const count = await connection.db.collection(collection.name).countDocuments();
            console.log(`  ${collection.name}: ${count} documents`);
        }

        console.log('\n' + '='.repeat(80));
        console.log('CHECKING USERS:');
        console.log('='.repeat(80));

        const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
        const users = await User.find({ email: 'ritwick92@gmail.com' });

        console.log(`\nFound ${users.length} user(s) with email ritwick92@gmail.com\n`);

        const bcrypt = require('bcryptjs');
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            console.log(`USER #${i + 1}:`);
            console.log(`  ID: ${user._id}`);
            console.log(`  Name: ${user.name}`);
            console.log(`  Email: ${user.email}`);
            console.log(`  Role: ${user.role}`);

            // Test password
            const isRitwick12 = await bcrypt.compare('ritwick@12', user.password);
            if (isRitwick12) {
                console.log(`  ✅ Password: ritwick@12`);
            }
            console.log();
        }

        console.log('='.repeat(80));
        console.log('CHECKING STUDENTS:');
        console.log('='.repeat(80));

        const Student = mongoose.model('Student', new mongoose.Schema({}, { strict: false }));
        const studentCount = await Student.countDocuments();

        console.log(`\n📚 Total students: ${studentCount}`);

        if (studentCount === 74) {
            console.log('✅ CORRECT DATABASE! This has your 74 students!');
        } else {
            console.log(`⚠️ Expected 74 students, found ${studentCount}`);
        }

        await mongoose.connection.close();
        console.log('\n✓ Connection closed');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkProductionDB();
