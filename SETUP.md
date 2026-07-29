# Profile Repository Setup

This project is designed for the public GitHub profile repository:

```text
mohasallal/mohasallal
```

GitHub displays `README.md` on the profile page only when the public repository
name exactly matches the account username.

## Install the profile

1. Create the public repository `mohasallal/mohasallal` if it does not already
   exist.
2. Copy every file and directory from this project into the repository.
3. Commit and push the files to the `main` branch.
4. Open the repository's **Actions** tab.
5. Select **Generate profile graphics** and run it once with
   **Run workflow**.

The workflow also runs automatically:

- After relevant generator or workflow files are pushed.
- Every day at `02:17 UTC`.
- Whenever it is started manually.

## Permissions

The workflow uses GitHub's automatically provided `GITHUB_TOKEN`. No personal
access token or additional secret is required for public profile statistics.

If the workflow can generate graphics but cannot commit them:

1. Open **Settings → Actions → General**.
2. Find **Workflow permissions**.
3. Select **Read and write permissions**.
4. Save the setting and run the workflow again.

The workflow itself requests only:

```yaml
permissions:
  contents: write
```

## Generated files

The action updates only files inside `assets/`:

```text
assets/
├── ascii.svg
├── stats.svg
├── streak.svg
├── langs.svg
├── year.svg
├── hd-about.svg
├── hd-stack.svg
├── hd-projects.svg
├── hd-experience.svg
├── hd-stats.svg
└── hd-about-this-page.svg
```

The local SVG files are referenced with relative paths from `README.md`.
Visitors therefore never load statistics from an external card provider.

## The ASCII portrait

`assets/ascii.svg` is your photograph converted to text. The source image lives
at `source/me.png` and is read by `scripts/lib/portrait.ts`, which:

1. Decodes the PNG with `scripts/lib/png.ts` (Node's built-in `zlib`, no
   third-party image library).
2. Composites onto white, so a transparent or plain backdrop drops out.
3. Crops to the subject's bounding box.
4. Averages each character cell and maps its darkness onto the ramp
   `. : + * # % @`, colouring denser characters brighter.

The portrait is **baked**: `assets/ascii.svg` is committed, and the source
photograph is not kept in the repository. When `source/me.png` is absent the
generator logs a note and leaves the committed portrait alone, so the daily run
never fails over a missing photo.

To change the portrait, put an image back at `source/me.png` and run
`npm run generate`. The file must be an **8-bit, non-interlaced PNG**; palette
and 16-bit PNGs are rejected with a clear error rather than silently mangled.
Portraits work best with a plain or removed background and strong contrast.

Output is deterministic: the same photo always produces the same SVG, so the
daily workflow only commits when something actually changed.

## Customize the design

Edit `scripts/config.ts` to change:

- GitHub username
- Display name
- Professional headline
- Location
- Portrait source path
- Colors
- Shared graphic width

Edit `README.md` to change the written content, project descriptions, links,
and experience.

## Generate locally

Node.js 24 or newer is required. There are no third-party runtime dependencies.

```bash
npm run check
npm run generate
```

Without `GITHUB_TOKEN`, local generation creates placeholder statistics cards.
The live cards are populated by the GitHub Actions workflow after the project
is pushed.

To generate live cards locally:

```bash
GITHUB_TOKEN=your_token npm run generate
```

Do not commit a personal access token or place it inside `README.md`,
`package.json`, the workflow file, or the scripts.
