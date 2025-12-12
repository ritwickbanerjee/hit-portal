require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;

console.log('Testing connection to:', uri ? uri.replace(/:([^:@]+)@/, ':****@') : 'UNDEFINED');

if (!uri) {
    console.error('ERROR: MONGODB_URI is undefined in .env.local');
    process.exit(1);
}

mongoose.connect(uri)
    .then(() => {
        console.log('✅ SUCCESS: Connected to MongoDB successfully!');
        console.log('Database Name:', mongoose.connection.name);
        return mongoose.connection.close();
    })
    .catch((err) => {
        console.error('❌ CONNECTION FAILED:');
        console.error('Name:', err.name);
        console.error('Message:', err.message);
        if (err.message.includes('authentication failed')) {
            console.error('\n--> HINT: Double check your Username and Password.');
            console.error('    Ensure you encoded special characters like @ as %40');
        } else if (err.message.includes('bad auth')) {
            console.error('\n--> HINT: Authentication failed. Check password/username.');
        } else if (err.message.includes('querySrv')) {
            console.error('\n--> HINT: DNS Error. Check your internet or if the cluster address is correct.');
        }
    });
