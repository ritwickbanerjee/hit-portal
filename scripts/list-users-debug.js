require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

// Define inline schema to avoid importing .ts file in Node.js
const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema);

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('ERROR: MONGODB_URI is missing.');
    process.exit(1);
}

mongoose.connect(uri)
    .then(async () => {
        console.log('✅ Connected to DB:', mongoose.connection.name);

        // List Name, Email, Role of all users
        const users = await User.find({}, { name: 1, email: 1, role: 1 });

        console.log('\n--- FOUND USERS ---');
        if (users.length === 0) {
            console.log('❌ NO USERS FOUND in this database.');
            console.log('Reason: The database "' + mongoose.connection.name + '" is empty.');
            console.log('Solution: You may need to change the URI to point to the correct DB name (e.g. /admin_portal instead of /test).');
        } else {
            console.table(users.map(u => ({
                Name: u.name,
                Email: u.email,
                Role: u.role,
                ID: u._id.toString()
            })));
        }

        return mongoose.connection.close();
    })
    .catch(err => {
        console.error('❌ Error:', err);
        process.exit(1);
    });
