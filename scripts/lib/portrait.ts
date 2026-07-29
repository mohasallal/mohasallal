import { readFile } from "node:fs/promises";
import { decodePng, type DecodedImage } from "./png.ts";

/** Sparse to dense. Index 0 is blank so the background drops out entirely. */
export const RAMP = [" ", ".", ":", "+", "*", "#", "%", "@"] as const;

export interface PortraitCell {
  character: string;
  /** 0 (blank) to RAMP.length - 1 (densest). */
  level: number;
}

/**
 * Average the source region behind one character cell and return how much ink
 * it carries. The photo sits on a white background, so ink is measured as
 * darkness after compositing onto white: the backdrop falls to zero and the
 * hair, glasses, beard and jacket carry the drawing.
 */
const cellInk = (
  image: DecodedImage,
  left: number,
  top: number,
  right: number,
  bottom: number,
): number => {
  let total = 0;
  let samples = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const index = (y * image.width + x) * 4;
      const alpha = (image.data[index + 3] ?? 255) / 255;
      const r = (image.data[index] ?? 0) / 255;
      const g = (image.data[index + 1] ?? 0) / 255;
      const b = (image.data[index + 2] ?? 0) / 255;
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      // Composite onto white so transparent corners read as background.
      total += 1 - (alpha * luminance + (1 - alpha));
      samples += 1;
    }
  }
  return samples ? total / samples : 0;
};

export interface Region {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Tightest box containing the subject, so a photo shot on a plain backdrop
 * does not spend rows of the portrait on empty margin.
 */
export const contentBounds = (
  image: DecodedImage,
  threshold = 0.08,
): Region => {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (cellInk(image, x, y, x + 1, y + 1) <= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0 || maxY < 0) {
    return { left: 0, top: 0, width: image.width, height: image.height };
  }
  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
};

export const buildPortrait = ({
  image,
  region,
  columns,
  rows,
  gamma = 0.85,
  floor = 0.06,
}: {
  image: DecodedImage;
  region: Region;
  columns: number;
  rows: number;
  /** Below 1 lifts midtones so the face keeps detail against the hair. */
  gamma?: number;
  /** Ink under this fraction of the peak is treated as background. */
  floor?: number;
}): PortraitCell[][] => {
  const raw: number[][] = [];
  let peak = 0;

  for (let row = 0; row < rows; row += 1) {
    const top = region.top + Math.floor((row / rows) * region.height);
    const bottom = Math.max(
      top + 1,
      region.top + Math.floor(((row + 1) / rows) * region.height),
    );
    const line: number[] = [];
    for (let column = 0; column < columns; column += 1) {
      const left = region.left + Math.floor((column / columns) * region.width);
      const right = Math.max(
        left + 1,
        region.left + Math.floor(((column + 1) / columns) * region.width),
      );
      const ink = cellInk(image, left, top, right, bottom);
      peak = Math.max(peak, ink);
      line.push(ink);
    }
    raw.push(line);
  }

  const scale = peak > 0 ? 1 / peak : 0;
  const steps = RAMP.length - 1;

  return raw.map((line) =>
    line.map((ink) => {
      const normalised = ink * scale;
      if (normalised <= floor) return { character: RAMP[0], level: 0 };
      const shaped = normalised ** gamma;
      const level = Math.min(steps, Math.max(1, Math.round(shaped * steps)));
      return { character: RAMP[level] ?? RAMP[0], level };
    }),
  );
};

export interface LoadedPortrait {
  cells: PortraitCell[][];
  columns: number;
  rows: number;
}

/**
 * Crop to the subject, then pick a row count that keeps the face in proportion
 * for the given character cell aspect (cell width divided by line height).
 */
export const loadPortrait = async (
  path: string,
  columns: number,
  cellAspect: number,
): Promise<LoadedPortrait> => {
  const image = decodePng(await readFile(path));
  const region = contentBounds(image);
  const rows = Math.max(
    1,
    Math.round(columns * (region.height / region.width) * cellAspect),
  );
  return {
    cells: buildPortrait({ image, region, columns, rows }),
    columns,
    rows,
  };
};

/** Plain-text preview, used to check recognisability without rasterising. */
export const previewPortrait = (cells: PortraitCell[][]): string =>
  cells.map((line) => line.map((cell) => cell.character).join("")).join("\n");
