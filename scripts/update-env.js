const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');

console.log('Reading .env.local...\n');
let envContent = fs.readFileSync(envPath, 'utf-8');

console.log('Current MONGODB_URI:');
const currentUri = envContent.match(/MONGODB_URI=.*/)?.[0];
console.log(currentUri);

// Update the MONGODB_URI to include the database name
// Update the MONGODB_URI to include the database name
const newUri = 'MONGODB_URI=YOUR_SECURE_MONGODB_URI_HERE'; // REPLACED FOR SECURITY; Set this manually or via environment variables

envContent = envContent.replace(/MONGODB_URI=.*/, newUri);

console.log('\nNew MONGODB_URI:');
console.log(newUri);

fs.writeFileSync(envPath, envContent);

console.log('\n✅ Updated .env.local successfully!');
console.log('\nThe localhost server will now connect to the portal_app database with:');
console.log('  - 209 students');
console.log('  - Correct admin user (ritwick92@gmail.com)');
console.log('  - Password: ritwick@12');
console.log('\nRestart the dev server (npm run dev) for changes to take effect.');
