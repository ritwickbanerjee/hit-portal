const fs = require('fs');

async function test() {
    const baseUrl = 'http://localhost:3001';
    
    const loginRes = await fetch(`${baseUrl}/api/student/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roll: '1234', password: '1234' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    const dummyPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 44 >>
stream
BT
/F1 24 Tf
100 700 Td
(Hello World) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000222 00000 n 
0000000310 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
405
%%EOF`;

    const base64Pdf = 'data:application/pdf;base64,' + Buffer.from(dummyPdf).toString('base64');
    
    console.log('Sending upload request...');
    const uploadRes = await fetch(`${baseUrl}/api/student/upload-to-drive/direct`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
            scriptUrl: 'https://script.google.com/macros/s/AKfycbwfzmqyrSXUL9WXHRL_TU7zoyNEC9FCpA-5n3d5NCUjBQVB1tlCE3OY89omenNAsNzyjA/exec',
            fileName: '1234_test.pdf',
            folderPath: 'TEST_FOLDER',
            fileData: base64Pdf
        })
    });
    
    console.log('Status:', uploadRes.status);
    console.log('Response:', await uploadRes.json());
}

test();
