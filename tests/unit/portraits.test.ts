import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { portraitUrls } from '@/data/portraits';

const portraitDirectory = path.join(
  process.cwd(),
  'public',
  'selfies',
  'portraits',
);

function containsAscii(contents: Uint8Array, value: string) {
  const needle = Uint8Array.from(value, (character) => character.charCodeAt(0));

  for (let start = 0; start <= contents.length - needle.length; start += 1) {
    if (needle.every((byte, offset) => contents[start + offset] === byte)) {
      return true;
    }
  }

  return false;
}

describe('easter egg portraits', () => {
  it('publishes only the sanitized portrait inventory', async () => {
    const files = (await readdir(portraitDirectory)).sort();

    expect(files).toEqual(portraitUrls.map((url) => path.basename(url)).sort());
    expect(files).toHaveLength(9);
    expect(files.every((file) => /^portrait-\d{2}\.webp$/.test(file))).toBe(
      true,
    );
  });

  it('keeps every derivative small and free of ancillary metadata chunks', async () => {
    for (const url of portraitUrls) {
      const filePath = path.join(process.cwd(), 'public', url);
      const [contents, details] = await Promise.all([
        readFile(filePath),
        stat(filePath),
      ]);

      expect(Array.from(contents.subarray(0, 4))).toEqual([82, 73, 70, 70]);
      expect(Array.from(contents.subarray(8, 12))).toEqual([87, 69, 66, 80]);
      expect(details.size).toBeLessThan(30_000);

      expect(containsAscii(contents, 'EXIF')).toBe(false);
      expect(containsAscii(contents, 'XMP ')).toBe(false);
      expect(containsAscii(contents, 'ICCP')).toBe(false);
    }
  });
});
