const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const W = 128, H = 128;
const raw = Buffer.alloc(H * (1 + W * 4));

function setPixel(x, y, r, g, b, a) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const idx = y * (1 + W * 4) + 1 + x * 4;
  raw[idx] = r; raw[idx+1] = g; raw[idx+2] = b; raw[idx+3] = a;
}

function fillRoundRect(x, y, w, h, rad, r, g, b, a) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      let inside = true;
      if (dx < rad && dy < rad) inside = (dx-rad)*(dx-rad)+(dy-rad)*(dy-rad) <= rad*rad;
      if (dx >= w-rad && dy < rad) inside = (dx-w+rad+1)*(dx-w+rad+1)+(dy-rad)*(dy-rad) <= rad*rad;
      if (dx < rad && dy >= h-rad) inside = (dx-rad)*(dx-rad)+(dy-h+rad+1)*(dy-h+rad+1) <= rad*rad;
      if (dx >= w-rad && dy >= h-rad) inside = (dx-w+rad+1)*(dx-w+rad+1)+(dy-h+rad+1)*(dy-h+rad+1) <= rad*rad;
      if (inside) setPixel(x + dx, y + dy, r, g, b, a);
    }
  }
}

// 4 rounded squares grid
fillRoundRect(12, 12, 46, 46, 8, 74, 144, 226, 255);
fillRoundRect(70, 12, 46, 46, 8, 74, 144, 226, 140);
fillRoundRect(12, 70, 46, 46, 8, 74, 144, 226, 140);
fillRoundRect(70, 70, 46, 46, 8, 74, 144, 226, 70);

// Star on top-left
const cx = 35, cy = 33;
const starPoints = [];
for (let i = 0; i < 10; i++) {
  const angle = Math.PI / 2 + (i * Math.PI) / 5;
  const r = i % 2 === 0 ? 12 : 5;
  starPoints.push([cx + r * Math.cos(angle), cy - r * Math.sin(angle)]);
}
for (let y = cy - 14; y <= cy + 14; y++) {
  for (let x = cx - 14; x <= cx + 14; x++) {
    let inside = false;
    for (let i = 0, j = starPoints.length - 1; i < starPoints.length; j = i++) {
      const [xi, yi] = starPoints[i], [xj, yj] = starPoints[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) setPixel(Math.round(x), Math.round(y), 255, 255, 255, 230);
  }
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let k = n; for (let i = 0; i < 8; i++) k = k & 1 ? 0xEDB88320 ^ (k >>> 1) : k >>> 1; table[n] = k; }
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const sig = Buffer.from([137,80,78,71,13,10,26,10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync(path.join(__dirname, 'icon.png'), png);
console.log('icon.png created:', png.length, 'bytes');
