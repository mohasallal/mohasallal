import { inflateSync } from "node:zlib";

export interface DecodedImage {
  width: number;
  height: number;
  /** Straight RGBA, four bytes per pixel, row-major. */
  data: Uint8Array;
}

const SIGNATURE = "89504e470d0a1a0a";

const CHANNELS: Record<number, number> = {
  0: 1, // grayscale
  2: 3, // truecolour
  4: 2, // grayscale + alpha
  6: 4, // truecolour + alpha
};

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
};

/**
 * Minimal PNG reader for 8-bit non-interlaced images. Palette images and
 * 16-bit samples are rejected rather than guessed at, so a bad source file
 * fails loudly instead of producing a corrupt portrait.
 */
export const decodePng = (buffer: Buffer): DecodedImage => {
  if (buffer.subarray(0, 8).toString("hex") !== SIGNATURE) {
    throw new Error("Source image is not a PNG file.");
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const parts: Buffer[] = [];

  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8] ?? 0;
      colorType = body[9] ?? 0;
      if (body[12] !== 0) {
        throw new Error("Interlaced PNG files are not supported.");
      }
    } else if (type === "IDAT") {
      parts.push(body);
    } else if (type === "IEND") {
      break;
    }

    offset += 12 + length;
  }

  if (bitDepth !== 8) {
    throw new Error(`Unsupported PNG bit depth ${bitDepth}; expected 8.`);
  }
  const channels = CHANNELS[colorType];
  if (!channels) {
    throw new Error(`Unsupported PNG colour type ${colorType}.`);
  }
  if (!width || !height || !parts.length) {
    throw new Error("PNG file is missing image data.");
  }

  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const pixels = new Uint8Array(width * height * 4);
  const previous = new Uint8Array(stride);
  const current = new Uint8Array(stride);

  let read = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[read];
    read += 1;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[read + x] ?? 0;
      const left = x >= channels ? (current[x - channels] ?? 0) : 0;
      const up = previous[x] ?? 0;
      const upLeft = x >= channels ? (previous[x - channels] ?? 0) : 0;

      let restored: number;
      switch (filter) {
        case 0:
          restored = value;
          break;
        case 1:
          restored = value + left;
          break;
        case 2:
          restored = value + up;
          break;
        case 3:
          restored = value + ((left + up) >> 1);
          break;
        case 4:
          restored = value + paeth(left, up, upLeft);
          break;
        default:
          throw new Error(`Unknown PNG row filter ${filter}.`);
      }
      current[x] = restored & 0xff;
    }
    read += stride;

    for (let x = 0; x < width; x += 1) {
      const source = x * channels;
      const target = (y * width + x) * 4;
      if (channels === 1) {
        const grey = current[source] ?? 0;
        pixels[target] = grey;
        pixels[target + 1] = grey;
        pixels[target + 2] = grey;
        pixels[target + 3] = 255;
      } else if (channels === 2) {
        const grey = current[source] ?? 0;
        pixels[target] = grey;
        pixels[target + 1] = grey;
        pixels[target + 2] = grey;
        pixels[target + 3] = current[source + 1] ?? 255;
      } else {
        pixels[target] = current[source] ?? 0;
        pixels[target + 1] = current[source + 1] ?? 0;
        pixels[target + 2] = current[source + 2] ?? 0;
        pixels[target + 3] = channels === 4 ? (current[source + 3] ?? 255) : 255;
      }
    }

    previous.set(current);
  }

  return { width, height, data: pixels };
};
