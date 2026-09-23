import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

// Bake the original metal/glass into nine-slice skins. Browser first-paint
// gradient and inset-shadow shaders otherwise interrupt the WebGL flight.
const metal = `background:linear-gradient(155deg,#b0c3c5,#657f8c 5px,#344d5a 15px,#203641 49%,#142833 51%,#405d69);border:1px solid #a3b7bb;border-bottom-color:#587480;box-shadow:inset 0 1px 0 #e4f7f3a1,inset 0 -2px 3px #001018,0 0 0 1px #04131c,0 4px 14px #0009;`;
/** @type {Array<[string, number, number, number[], string]>} */
const skins = [
  [
    '.solar-heading',
    580,
    65,
    [32, 34, 32, 34],
    metal + 'border-radius:34px 12px 27px 34px',
  ],
  [
    '.solar-console-body',
    820,
    120,
    [35, 35, 28, 28],
    metal + 'border-radius:17px 35px 21px 28px',
  ],
  [
    '.solar-inspector',
    326,
    250,
    [35, 35, 8, 28],
    metal + 'border-radius:27px 35px 0 0',
  ],
  [
    '.solar-system-chart',
    420,
    350,
    [24, 24, 16, 8],
    metal + 'border-radius:7px 24px 15px 7px',
  ],
  [
    '.solar-back',
    78,
    53,
    [26, 8, 26, 29],
    'background:linear-gradient(#4d6875,#1c343e 48%,#0c242f 51%,#344f58);border:1px solid #a3b7bb;border-radius:29px 8px 8px 29px',
  ],
  [
    '.solar-system-name',
    370,
    48,
    [8, 14, 8, 8],
    'background:linear-gradient(#10313b,#061e28);border-radius:5px 12px 5px 5px;box-shadow:inset 0 1px 4px #000a,0 1px #819ba05c',
  ],
  [
    '.solar-chart-toggle',
    96,
    53,
    [9, 20, 20, 9],
    'background:linear-gradient(#81969c55,#071e2955);border:1px solid #728b96;border-radius:9px 7px 20px 7px',
  ],
  [
    '.solar-orbit-strip',
    794,
    66,
    [12, 24, 12, 18],
    'background:linear-gradient(#06222d,#103039);border:1px solid #041720;border-radius:11px 22px 9px 17px;box-shadow:inset 0 2px 4px #000a,0 1px #8ea5a366',
  ],
  [
    '.solar-console-actions button',
    40,
    36,
    [18, 18, 18, 18],
    'background:linear-gradient(150deg,#9bb2b8,#3d5b68 16%,#183440 50%,#0c2632 52%,#46636c);border:1px solid #789399;border-radius:50% 50% 42% 42%;box-shadow:inset 0 1px #d4e7e777,0 1px 2px #0008',
  ],
  [
    '.solar-inspector-screen',
    326,
    160,
    [24, 12, 8, 24],
    'background:repeating-linear-gradient(0deg,#b8f3d704 0 1px,transparent 1px 3px),linear-gradient(#12353c,#071f29);border:1px solid #031720;border-radius:24px 12px 7px 7px;box-shadow:inset 0 2px 6px #000b,0 1px #9bb2b155',
  ],
  [
    '.solar-world-portrait',
    62,
    62,
    [30, 30, 30, 30],
    'background:radial-gradient(circle,#35525b,#051923 72%);border:2px solid #78959b;border-radius:50%;box-shadow:inset 0 1px 5px #000,0 1px #b4cac366',
  ],
  [
    '.solar-launch',
    320,
    42,
    [10, 18, 10, 10],
    'background:linear-gradient(#63786c,#344d42 48%,#183729 51%,#385747);border:1px solid #b4c3a0;border-radius:5px 16px 5px 5px;box-shadow:inset 0 1px #e1edbf66,0 2px 2px #001921',
  ],
];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  let css =
    '/* Generated original artwork: node scripts/generate-solar-chrome.mjs */\n';
  for (const [selector, width, height, edges, style] of skins) {
    await page.setViewportSize({ width: width + 32, height: height + 32 });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}div{box-sizing:border-box;position:absolute;left:16px;top:16px;width:${width}px;height:${height}px;${style}}</style><div></div>`,
    );
    const png = await page.screenshot({ omitBackground: true });
    const image = await page.evaluate(
      async (data) => {
        const bitmap = await createImageBitmap(
          await (await fetch(data)).blob(),
        );
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas
          .getContext('2d', { willReadFrequently: true })
          .drawImage(bitmap, 0, 0);
        bitmap.close();
        return canvas.toDataURL('image/webp', 0.88);
      },
      `data:image/png;base64,${png.toString('base64')}`,
    );
    css += `${selector} {\n  border-image: url("${image}") ${edges.map((edge) => (edge + 16) * 2).join(' ')} fill / ${edges.map((edge) => edge + 16 + 'px').join(' ')} / 16px stretch;\n}\n`;
  }
  await writeFile(new URL('../app/solar-chrome.css', import.meta.url), css);
  console.log(
    `Generated ${skins.length} nine-slice skins (${Buffer.byteLength(css)} CSS bytes).`,
  );
} finally {
  await browser.close();
}
