
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

function generateIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#10b981'); // Emerald 500
    gradient.addColorStop(1, '#06b6d4'); // Cyan 500
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // Text (H)
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${size * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', size / 2, size / 2);

    return canvas.toBuffer('image/png');
}

async function main() {
    const iconsDir = path.join(process.cwd(), 'public', 'icons');
    if (!fs.existsSync(iconsDir)) {
        fs.mkdirSync(iconsDir, { recursive: true });
    }

    fs.writeFileSync(path.join(iconsDir, 'icon-192x192.png'), generateIcon(192));
    fs.writeFileSync(path.join(iconsDir, 'icon-512x512.png'), generateIcon(512));
    console.log('Generated icons in public/icons');
}

main();
