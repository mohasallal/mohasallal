import { generateStaticAssets } from "./generate-static.ts";
import { generateStatsAssets } from "./generate-stats.ts";

await generateStaticAssets();
await generateStatsAssets();

console.log("Generated all profile graphics.");
