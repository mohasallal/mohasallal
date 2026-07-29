import { theme } from "../config.ts";

export const xml = (value: string | number): string =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const channel = (hex: string, offset: number): number =>
  Number.parseInt(hex.slice(offset, offset + 2), 16);

/** Linear blend between two #rrggbb colours. */
export const mix = (from: string, to: string, amount: number): string => {
  const t = Math.max(0, Math.min(1, amount));
  const parts = [1, 3, 5].map((offset) => {
    const value = channel(from, offset) + (channel(to, offset) - channel(from, offset)) * t;
    return Math.round(value).toString(16).padStart(2, "0");
  });
  return `#${parts.join("")}`;
};

export const number = (value: number): string =>
  new Intl.NumberFormat("en-US").format(value);

export const compact = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export const svgDocument = ({
  width,
  height,
  content,
  label,
}: {
  width: number;
  height: number;
  content: string;
  label: string;
}): string => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${xml(label)}</title>
  <desc id="desc">Self-generated GitHub profile graphic for Mohammad Alsallal.</desc>
  <defs>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.surface}" />
      <stop offset="100%" stop-color="${theme.background}" />
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${theme.secondary}" />
      <stop offset="100%" stop-color="${theme.primaryBright}" />
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <style>
      text {
        font-family: "JetBrains Mono", "Cascadia Code", "SFMono-Regular", Consolas, monospace;
      }
      .title { fill: ${theme.text}; font-size: 18px; font-weight: 700; letter-spacing: 1px; }
      .label { fill: ${theme.muted}; font-size: 11px; letter-spacing: 1px; }
      .value { fill: ${theme.text}; font-size: 25px; font-weight: 700; }
      .small { fill: ${theme.muted}; font-size: 10px; }
    </style>
  </defs>
  ${content}
</svg>
`;

export const panel = (
  width: number,
  height: number,
  radius = 16,
): string => `
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="${radius}" fill="url(#panel)" stroke="${theme.border}" />
  <rect x="20" y="0" width="96" height="2" rx="1" fill="url(#accent)" filter="url(#glow)" />
`;

export const metric = ({
  x,
  y,
  label,
  value,
  detail,
}: {
  x: number;
  y: number;
  label: string;
  value: string;
  detail?: string;
}): string => `
  <text x="${x}" y="${y}" class="label">${xml(label.toUpperCase())}</text>
  <text x="${x}" y="${y + 31}" class="value">${xml(value)}</text>
  ${detail ? `<text x="${x}" y="${y + 50}" class="small">${xml(detail)}</text>` : ""}
`;

export const progressBar = ({
  x,
  y,
  width,
  percentage,
  color,
}: {
  x: number;
  y: number;
  width: number;
  percentage: number;
  color: string;
}): string => {
  const safe = Math.max(0, Math.min(1, percentage));
  return `
    <rect x="${x}" y="${y}" width="${width}" height="5" rx="2.5" fill="${theme.empty}" />
    <rect x="${x}" y="${y}" width="${Math.max(2, width * safe).toFixed(1)}" height="5" rx="2.5" fill="${color}" />
  `;
};
