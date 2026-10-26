import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Clean, high-precision SVG matching the uploaded Mindly emblem
// Sky Blue (#00B4FF) stylized continuous-loop 'm'
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <defs>
    <style>
      .mindly-stroke {
        fill: none;
        stroke: #00B4FF;
        stroke-width: 96;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    </style>
  </defs>
  
  <!-- Mindly Official Monogram 'm' Loop -->
  <!-- Outer left pillar & arch -->
  <path class="mindly-stroke" d="M 124 760 L 124 380 C 124 230, 240 180, 360 210 C 440 230, 480 300, 480 390" />
  
  <!-- Inner left stem curving up and into the upper right crest -->
  <path class="mindly-stroke" d="M 276 760 L 276 430 C 276 340, 340 300, 400 300 C 490 300, 580 230, 640 180 C 720 120, 800 190, 770 290 C 740 380, 620 460, 530 570 C 470 640, 450 720, 500 760 C 560 800, 630 750, 660 670 C 690 590, 710 440, 760 360 C 800 290, 876 360, 876 460 L 876 760" />
</svg>`;

// We also create an alternate version with Deep Blue (#0B1F44) background for PWA app icon tiles
const appIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <rect width="1000" height="1000" rx="220" fill="#0B1F44"/>
  <rect width="992" height="992" x="4" y="4" rx="218" fill="none" stroke="#1a366f" stroke-width="8"/>
  <g transform="translate(100, 100) scale(0.8)">
    <path fill="none" stroke="#00B4FF" stroke-width="108" stroke-linecap="round" stroke-linejoin="round" d="M 124 760 L 124 380 C 124 230, 240 180, 360 210 C 440 230, 480 300, 480 390" />
    <path fill="none" stroke="#00B4FF" stroke-width="108" stroke-linecap="round" stroke-linejoin="round" d="M 276 760 L 276 430 C 276 340, 340 300, 400 300 C 490 300, 580 230, 640 180 C 720 120, 800 190, 770 290 C 740 380, 620 460, 530 570 C 470 640, 450 720, 500 760 C 560 800, 630 750, 660 670 C 690 590, 710 440, 760 360 C 800 290, 876 360, 876 460 L 876 760" />
  </g>
</svg>`;

async function run() {
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Save icon.svg and mindly-logo.svg
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), appIconSvg);
  fs.writeFileSync(path.join(publicDir, 'mindly-logo.svg'), svgContent);

  // 2. Generate PNGs using sharp
  const appSvgBuffer = Buffer.from(appIconSvg);
  
  await sharp(appSvgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Generated pwa-192x192.png');

  await sharp(appSvgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Generated pwa-512x512.png');

  await sharp(appSvgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // Also transparent version
  const logoBuffer = Buffer.from(svgContent);
  await sharp(logoBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'mindly-logo.png'));
  console.log('Generated mindly-logo.png');
}

run().catch(console.error);
