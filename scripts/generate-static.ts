import { access, mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { dimensions, profile, theme } from "./config.ts";
import { RAMP, type PortraitCell, loadPortrait } from "./lib/portrait.ts";
import { mix, svgDocument, xml } from "./lib/svg.ts";

const outputDirectory = "assets";
const portraitSource = profile.portrait;

const heading = (label: string, code: string): string => {
  const width = dimensions.width;
  const height = 62;
  const content = `
    <line x1="0" y1="51" x2="${width}" y2="51" stroke="${theme.border}" />
    <rect x="0" y="49" width="86" height="3" rx="1.5" fill="url(#accent)" />
    <text x="0" y="31" fill="${theme.primaryBright}" font-size="11" letter-spacing="2">${xml(code)}</text>
    <text x="56" y="32" fill="${theme.text}" font-size="18" font-weight="700" letter-spacing="3">${xml(label.toUpperCase())}</text>
  `;
  return svgDocument({
    width,
    height,
    content,
    label: `${label} section`,
  });
};

/** Ink level 1..7 mapped from deep violet through to near-white. */
const inkColor = (level: number): string => {
  const stops = [theme.secondary, theme.primary, theme.primaryBright, theme.text];
  const position = ((level - 1) / (RAMP.length - 2)) * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(position));
  return mix(stops[index] ?? theme.primary, stops[index + 1] ?? theme.text, position - index);
};

const portraitArt = (cells: PortraitCell[][], left: number, top: number, fontSize: number, lineHeight: number): string =>
  cells
    .map((line, row) => {
      // Group neighbouring cells that share a colour into tspans. Blank cells
      // inherit the run they sit in, which keeps the element count sane
      // without disturbing the monospace grid.
      const runs: Array<{ color: string; text: string }> = [];
      for (const cell of line) {
        const color = cell.level === 0 ? runs.at(-1)?.color : inkColor(cell.level);
        const last = runs.at(-1);
        if (last && last.color === (color ?? last.color)) {
          last.text += cell.character;
        } else {
          runs.push({ color: color ?? theme.secondary, text: cell.character });
        }
      }
      const spans = runs
        .map((run) => `<tspan fill="${run.color}">${xml(run.text)}</tspan>`)
        .join("");
      return `<text x="${left}" y="${(top + row * lineHeight).toFixed(1)}" font-size="${fontSize}" xml:space="preserve">${spans}</text>`;
    })
    .join("\n");

const ascii = async (): Promise<string> => {
  const width = dimensions.width;
  const columns = 76;
  const fontSize = 9.5;
  const characterWidth = fontSize * 0.6;
  // A monospace cell is about twice as tall as it is wide. The sampler is told
  // the same ratio, so the face keeps its proportions instead of stretching.
  const cellAspect = 0.5;
  const lineHeight = characterWidth / cellAspect;
  const artWidth = columns * characterWidth;
  const left = Math.round((width - artWidth) / 2);
  const top = 46;

  const { cells, rows } = await loadPortrait(portraitSource, columns, cellAspect);
  const artHeight = rows * lineHeight;
  const art = portraitArt(cells, left, top, fontSize, lineHeight);

  const artBottom = top + artHeight;
  const dividerY = Math.round(artBottom + 26);
  const height = dividerY + 76;

  return svgDocument({
    width,
    height,
    label: profile.displayName,
    content: `
      <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="18" fill="url(#panel)" stroke="${theme.border}" />
      <circle cx="25" cy="21" r="3" fill="${theme.primary}" />
      <circle cx="37" cy="21" r="3" fill="${theme.secondary}" opacity=".75" />
      <circle cx="49" cy="21" r="3" fill="${theme.quiet}" opacity=".65" />
      <text x="${width - 25}" y="25" text-anchor="end" fill="${theme.quiet}" font-size="10" letter-spacing="1.2">${xml(profile.location)}</text>
      ${art}
      <line x1="92" y1="${dividerY}" x2="${width - 92}" y2="${dividerY}" stroke="${theme.border}" />
      <text x="${width / 2}" y="${dividerY + 32}" text-anchor="middle" fill="${theme.text}" font-size="17" font-weight="700" letter-spacing="4">${xml(profile.displayName.toUpperCase())}</text>
      <text x="${width / 2}" y="${dividerY + 56}" text-anchor="middle" fill="${theme.muted}" font-size="10" letter-spacing="1.4">${xml(profile.role)}</text>
    `,
  });
};

/**
 * The portrait is baked: `assets/ascii.svg` is committed, and the source
 * photograph does not have to stay in the repository. When it is absent the
 * committed portrait is left untouched instead of failing the daily run.
 */
const regeneratePortrait = async (): Promise<boolean> => {
  try {
    await access(portraitSource);
  } catch {
    return false;
  }
  await writeFile(`${outputDirectory}/ascii.svg`, await ascii());
  return true;
};

export const generateStaticAssets = async (): Promise<void> => {
  await mkdir(outputDirectory, { recursive: true });
  const headings = [
    ["ABOUT", "01"],
    ["STACK", "02"],
    ["PROJECTS", "03"],
    ["EXPERIENCE", "04"],
    ["STATS", "05"],
    ["ABOUT THIS PAGE", "06"],
  ] as const;

  const [portrait] = await Promise.all([
    regeneratePortrait(),
    ...headings.map(([label, code]) =>
      writeFile(
        `${outputDirectory}/hd-${label.toLowerCase().replaceAll(" ", "-")}.svg`,
        heading(label, code),
      ),
    ),
  ]);

  if (!portrait) {
    console.log(
      `No portrait source at ${portraitSource}; keeping the committed assets/ascii.svg.`,
    );
  }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await generateStaticAssets();
  console.log("Generated static profile SVGs.");
}
