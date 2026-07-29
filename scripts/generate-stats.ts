import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { dimensions, profile, theme } from "./config.ts";
import {
  type ContributionDay,
  type LanguageTotal,
  type ProfileStats,
  fetchProfileStats,
} from "./lib/github.ts";
import {
  compact,
  metric,
  number,
  panel,
  progressBar,
  svgDocument,
  xml,
} from "./lib/svg.ts";

const outputDirectory = "assets";
const width = dimensions.width;

const placeholder = (title: string, filename: string): Promise<void> => {
  const height = 150;
  const content = `
    ${panel(width, height)}
    <text x="28" y="48" class="title">${xml(title.toUpperCase())}</text>
    <text x="28" y="82" fill="${theme.primaryBright}" font-size="13">READY FOR LIVE DATA</text>
    <text x="28" y="108" class="small">Run the Generate profile graphics workflow after pushing.</text>
    <circle cx="${width - 46}" cy="48" r="11" fill="none" stroke="${theme.primary}" stroke-width="3" stroke-dasharray="16 8">
      <animateTransform attributeName="transform" type="rotate" from="0 ${width - 46} 48" to="360 ${width - 46} 48" dur="2.5s" repeatCount="indefinite" />
    </circle>
  `;
  return writeFile(
    `${outputDirectory}/${filename}`,
    svgDocument({ width, height, content, label: title }),
  );
};

export const renderStats = (stats: ProfileStats): string => {
  const height = 184;
  return svgDocument({
    width,
    height,
    label: `${profile.displayName} GitHub statistics`,
    content: `
      ${panel(width, height)}
      <text x="26" y="36" class="title">THE LAST 365 DAYS</text>
      <text x="${width - 26}" y="35" text-anchor="end" class="label">@${profile.username}</text>
      ${metric({ x: 28, y: 70, label: "Contributions", value: number(stats.totalContributions), detail: "public + private count" })}
      ${metric({ x: 182, y: 70, label: "Commits", value: number(stats.commits) })}
      ${metric({ x: 310, y: 70, label: "Pull requests", value: number(stats.pullRequests) })}
      ${metric({ x: 466, y: 70, label: "Repositories", value: number(stats.repositories), detail: `${number(stats.stars)} stars · ${number(stats.forks)} forks` })}
    `,
  });
};

const streaks = (
  days: ContributionDay[],
): { current: number; longest: number; activeDays: number } => {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  let longest = 0;
  let activeDays = 0;
  for (const day of sorted) {
    if (day.contributionCount > 0) {
      running += 1;
      activeDays += 1;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }

  let index = sorted.length - 1;
  if (sorted[index]?.contributionCount === 0) index -= 1;
  let current = 0;
  while (index >= 0 && (sorted[index]?.contributionCount ?? 0) > 0) {
    current += 1;
    index -= 1;
  }
  return { current, longest, activeDays };
};

export const renderStreak = (stats: ProfileStats): string => {
  const height = 188;
  const values = streaks(stats.days);
  const activity = stats.days.length
    ? values.activeDays / stats.days.length
    : 0;
  return svgDocument({
    width,
    height,
    label: `${profile.displayName} contribution streaks`,
    content: `
      ${panel(width, height)}
      <text x="26" y="36" class="title">CONSISTENCY</text>
      <text x="${width - 26}" y="35" text-anchor="end" class="label">ROLLING 365 DAYS</text>
      ${metric({ x: 28, y: 72, label: "Current streak", value: `${values.current} days` })}
      ${metric({ x: 226, y: 72, label: "Longest streak", value: `${values.longest} days` })}
      ${metric({ x: 432, y: 72, label: "Active days", value: `${Math.round(activity * 100)}%` })}
      ${progressBar({ x: 28, y: 153, width: width - 56, percentage: activity, color: theme.primary })}
      <text x="28" y="173" class="small">${values.activeDays} days with at least one contribution</text>
    `,
  });
};

const topLanguages = (
  languages: LanguageTotal[],
  key: "bytes" | "repositories",
): LanguageTotal[] =>
  [...languages].sort((a, b) => b[key] - a[key]).slice(0, 5);

const languageColumn = ({
  languages,
  key,
  x,
  title,
}: {
  languages: LanguageTotal[];
  key: "bytes" | "repositories";
  x: number;
  title: string;
}): string => {
  const total = languages.reduce((sum, language) => sum + language[key], 0);
  const barWidth = 232;
  return `
    <text x="${x}" y="72" class="label">${xml(title)}</text>
    ${languages
      .map((language, index) => {
        const y = 100 + index * 38;
        const percentage = total ? language[key] / total : 0;
        const value =
          key === "bytes"
            ? `${Math.round(percentage * 100)}%`
            : `${language.repositories} repos`;
        return `
          <circle cx="${x + 4}" cy="${y - 4}" r="4" fill="${xml(language.color)}" />
          <text x="${x + 16}" y="${y}" fill="${theme.text}" font-size="11">${xml(language.name)}</text>
          <text x="${x + barWidth}" y="${y}" text-anchor="end" class="small">${xml(value)}</text>
          ${progressBar({ x, y: y + 8, width: barWidth, percentage, color: language.color })}
        `;
      })
      .join("")}
  `;
};

export const renderLanguages = (stats: ProfileStats): string => {
  const height = 310;
  const byBytes = topLanguages(stats.languages, "bytes");
  const byRepositories = topLanguages(stats.languages, "repositories");
  return svgDocument({
    width,
    height,
    label: `${profile.displayName} programming languages`,
    content: `
      ${panel(width, height)}
      <text x="26" y="36" class="title">LANGUAGE PROFILE</text>
      <text x="${width - 26}" y="35" text-anchor="end" class="label">PUBLIC OWNED REPOSITORIES</text>
      ${languageColumn({ languages: byBytes, key: "bytes", x: 28, title: "BY CODE SIZE" })}
      ${languageColumn({ languages: byRepositories, key: "repositories", x: 360, title: "BY REPOSITORY" })}
    `,
  });
};

export const renderYear = (stats: ProfileStats): string => {
  const height = 190;
  const cell = 9.5;
  const left = 55;
  const top = 72;
  const ramp = ["·", ":", "+", "#", "@"];
  const max = Math.max(1, ...stats.days.map((day) => day.contributionCount));
  const firstDate = stats.days[0]?.date;
  const firstWeekday = stats.days[0]?.weekday ?? 0;
  const cells = stats.days
    .map((day) => {
      const elapsedDays = firstDate
        ? Math.round(
            (Date.parse(day.date) - Date.parse(firstDate)) / 86_400_000,
          )
        : 0;
      const week = Math.floor((elapsedDays + firstWeekday) / 7);
      const row = day.weekday;
      const level =
        day.contributionCount === 0
          ? 0
          : Math.min(4, Math.ceil((day.contributionCount / max) * 4));
      return `<text x="${(left + week * cell).toFixed(1)}" y="${(top + row * 13).toFixed(1)}" fill="${theme.grid[level]}" font-size="11">${ramp[level]}</text>`;
    })
    .join("\n");
  return svgDocument({
    width,
    height,
    label: `${profile.displayName} yearly contribution map`,
    content: `
      ${panel(width, height)}
      <text x="26" y="36" class="title">ONE CHARACTER PER DAY</text>
      <text x="${width - 26}" y="35" text-anchor="end" class="label">${number(stats.totalContributions)} CONTRIBUTIONS</text>
      <text x="28" y="${top}" class="small">SUN</text>
      <text x="28" y="${top + 39}" class="small">WED</text>
      <text x="28" y="${top + 78}" class="small">SAT</text>
      ${cells}
      <text x="${width - 28}" y="${height - 19}" text-anchor="end" class="small">quiet  · : + # @  loud</text>
    `,
  });
};

export const generateStatsAssets = async (): Promise<void> => {
  await mkdir(outputDirectory, { recursive: true });
  try {
    const stats = await fetchProfileStats();
    await Promise.all([
      writeFile(`${outputDirectory}/stats.svg`, renderStats(stats)),
      writeFile(`${outputDirectory}/streak.svg`, renderStreak(stats)),
      writeFile(`${outputDirectory}/langs.svg`, renderLanguages(stats)),
      writeFile(`${outputDirectory}/year.svg`, renderYear(stats)),
    ]);
  } catch (error) {
    if (process.env.GITHUB_ACTIONS === "true") throw error;
    console.warn(
      `Live statistics were not generated: ${error instanceof Error ? error.message : String(error)}`,
    );
    await Promise.all([
      placeholder("GitHub statistics", "stats.svg"),
      placeholder("Contribution streaks", "streak.svg"),
      placeholder("Language profile", "langs.svg"),
      placeholder("Yearly activity", "year.svg"),
    ]);
  }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await generateStatsAssets();
  console.log("Generated profile statistics SVGs.");
}
