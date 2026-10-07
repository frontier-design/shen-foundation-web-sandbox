# Shen Foundation Web

## Previewing and publishing content

The site has two branches:

- **`preview`**: the working branch. Pages CMS edits it, and Vercel deploys it to the preview site: https://shen-foundation-web-sandbox-git-preview-frontier-design.vercel.app/
- **`main`**: the live site, https://shen-foundation-web-sandbox.vercel.app

The preview site shows a "Preview" badge in the corner and is hidden from search engines. The live site has neither.

### Editors

1. Open [Pages CMS](https://app.pagescms.org) and check that the branch picker shows **`preview`**. Pages CMS can remember the last branch you used, so check every time; edits saved on `main` skip the preview step.
2. Edit content. Every save becomes a commit on `preview`.
3. Wait about a minute, then check your changes on the preview site: https://shen-foundation-web-sandbox-git-preview-frontier-design.vercel.app/
4. When everything looks right, click **Publish to live site** in the Pages CMS sidebar and confirm.
5. The live site updates about a minute later.

Publish sends *everything* currently on `preview` live at once, including other people's unfinished edits. Check with anyone else who is editing before you publish.

If you've just uploaded images or videos, Publish may stop with **"Images are still being optimized"**. Nothing is published in that case; wait a minute or two and click Publish again.

### Developers

- Pull `preview` before starting work; editors commit to it through Pages CMS.
- Commit code to `preview`, or to a feature branch that you merge into `preview`. Vercel builds a preview deployment for each branch.
- Changes reach `main` only through **Publish to live site**. Never commit or push to `main` directly.
- `.github/workflows/publish.yml` merges `preview` into `main` and pushes. If there's a merge conflict it fails without pushing; resolve the conflict on `preview`, then publish again.
- `.github/workflows/sync-preview.yml` copies anything pushed to `main` directly (for example, a Pages CMS edit accidentally saved on `main`) back into `preview`, so the branches don't drift. If that merge conflicts, it fails without pushing; merge `main` into `preview` by hand. Its own pushes and Publish's use `GITHUB_TOKEN`, which doesn't trigger workflows, so the two can't loop.
- Preview builds are detected from Vercel's `VERCEL_GIT_COMMIT_REF` / `VERCEL_ENV` in `vite.config.js`. They add the noindex tag and the preview badge.

## Image optimization

`scripts/optimize-images/optimize.mjs` keeps the images in `public/media/` high quality but not oversized. Image quality comes first: artworks must not visibly degrade.

What it does to each image that hasn't been processed before:

- **Resizes** anything with a longest edge over 3200px (aspect ratio kept, never enlarged).
- **JPEG:** re-encodes at quality 90 with full colour detail (4:4:4), but only if the image was resized or the file gets at least 10% smaller. Otherwise the pixels are left exactly as they are.
- **WebP:** re-encoded (quality 90) only when it has to be resized.
- **PNG:** optimized losslessly with [oxipng](https://github.com/shssoichiro/oxipng) (palette and every pixel preserved), and replaced only if the result is smaller.
- **Metadata:** removes GPS location, camera details, serial numbers, dates and software tags. It keeps colour profiles, the rotation flag (when pixels aren't re-encoded), and credits: EXIF `Copyright` and `Artist`, IPTC `CopyrightNotice`, `Credit` and `By-line`, and XMP `dc:rights`, `dc:creator` and `photoshop:Credit`. WebP and PNG can't hold IPTC, so for those only the EXIF/XMP credits are kept.
- Every pixel-exact step (metadata cleanup, oxipng) is verified by decoding the image before and after; if anything differs, or a colour profile or credit would be lost, the file is left untouched and reported as an error.

Formats it can't safely handle (HEIC, TIFF, GIF, SVG, AVIF) are left alone and listed; HEIC and TIFF must be converted to JPEG before uploading because browsers can't show them. Filenames that aren't lowercase and hyphenated are listed as warnings but never renamed automatically.

### Videos

Videos aren't stored in the repo. Editors add them in Pages CMS with the **Add video** button at the top of an exhibition, event, artist, the Home page or the About page: they choose the spot and paste a Google Drive or Dropbox share link. The **Add video** GitHub workflow (`.github/workflows/add-video.yml`, `scripts/add-video/`) downloads the file, checks that it plays in every browser (MP4 with H.264, or WebM with VP8/VP9; at most 100 MB), uploads it unchanged to Vercel Blob as `videos/<entry>-<random>/<width>x<height>-<bytes>.<ext>`, and writes the link into the entry on `preview`. The result, or the reason it failed, appears in the entry's read-only **Video status** field. The site plays these videos muted on a loop while they're on screen; cards only play videos up to 20 MB. Removing a video = clearing its field in Pages CMS; files nobody uses any more are deleted by a weekly cleanup after 30 days.

If an MP4 or WebM does end up in `public/media/` (for example added by hand), the optimizer never modifies it; it only records its width, height and duration, and warns about files over 20 MB.

### Never optimize a file

Add it to `scripts/optimize-images/exclude.json`. Paths start with `/media/`; `*` matches within a folder and `**` across folders:

```json
{ "exclude": ["/media/press-kit/**", "/media/artwork-master.jpg"] }
```

Excluded files are never modified, not even their metadata.

### Automatic runs

`.github/workflows/optimize-images.yml` runs the optimizer whenever something under `public/media/` is pushed to `preview` (for example an upload in Pages CMS), and commits the result back to `preview` as "Optimize images", usually within a minute or two. It can also be started by hand from the repo's Actions tab.

- It never loops: its own push uses `GITHUB_TOKEN`, which doesn't trigger workflows, and already-optimized files are skipped.
- If an editor commits while it's running, its push is rejected; it then redoes the run on the new `preview` tip (up to 3 times). Editors' saves are never overwritten.
- Publish refuses to run while an Optimize images run is in progress on `preview`, or while `npm run optimize-images -- --check` (run against `preview`) finds images that haven't been optimized yet or videos whose size hasn't been recorded. Files the optimizer failed on are recorded in the manifest and don't block Publishing; if the check itself can't run, Publish continues with a warning. Images synced from `main` by `sync-preview.yml` aren't picked up until the next upload or a manual run, so Publish waits for that.
- The run summary lists what changed and any filenames that aren't lowercase and hyphenated.

### Run it locally

```sh
npm --prefix scripts/optimize-images ci     # once
npm run optimize-images -- --dry-run        # report what would change
npm run optimize-images                     # apply
```

`scripts/optimize-images/manifest.json` records the checksum of every processed file, so a file is never re-encoded twice (including after it's renamed). A file that is replaced with new content under the same name is processed again. Changing the settings doesn't reprocess existing files, to avoid compressing them twice. oxipng is downloaded on first use from its official release, pinned to one version and checked against a SHA-256 checksum.

## Responsive images

On Vercel, images under `/media/` are delivered through Vercel Image Optimization: each `<img>` gets a `srcset` of `/_vercel/image` URLs at 640, 960, 1280 and 1920px wide, quality 80, served as WebP. AVIF is deliberately off: Vercel's AVIF encoder at the same quality setting measured noticeably lower fidelity than the approved settings (closer to quality 50), while its WebP matches them. The stored files in `public/media/` act as high-quality masters.

- `src/images.js` builds the URLs (`imageProps(src, SIZES.…)`), and holds the widths, the quality and three `sizes` presets: `fullBleed` (heroes and the carousel), `halfTall` (tall half-width images: callout, event, artist page) and `card` (card grids, gallery, people).
- `vercel.json` `images` must list the same widths and quality; Vercel rejects any other values.
- It's only switched on for builds on Vercel (`VERCEL=1`, see `vite.config.js`). `npm run dev` and `npm run preview` use the original files, because `/_vercel/image` only exists on Vercel.
- To change the delivered quality or widths, update both `src/images.js` and `vercel.json`, and check the result with `npm run quality-compare` first.

## Image quality comparison

`scripts/quality-compare/` generates a page with 100% crops of images as uploaded, as the stored master, and as delivered versions (AVIF/WebP at several qualities and widths), with file sizes. Use it to check that artworks don't visibly degrade before changing compression settings.

### Run it locally

```sh
npm --prefix scripts/quality-compare ci   # once: installs sharp for the script only
npm run quality-compare                   # the five reference images, today's settings
```

The page is written to `.quality-compare/index.html` (gitignored) and opens in your browser. Nothing is written to `public/` or included in the site build.

Options (`npm run quality-compare -- --help` lists them all):

```sh
npm run quality-compare -- \
  --image /media/danh-vo-guldenhof-hero.jpeg@0.45,0.86 \
  --image /media/covey-gong-portrait.jpeg \
  --formats avif,webp --qualities 80,85,90 --widths 1280,1920
```

- `--image` takes a path under `public/` (or any file), optionally followed by crop centres as fractions of the width and height (`@x,y;x,y`). Without crops, the busiest and smoothest areas are picked automatically.
- `--config file.json` takes a list of images with labels and named crops; `scripts/quality-compare/defaults.json` is the reference set and the default settings.
- `--master-max` and `--master-quality` change the stored-master settings; `--out` changes the output folder; `--no-open` skips opening the browser.

### Share a result with the client

The generated folder is tens of MB, so it goes on a temporary branch that is never merged into `preview` or `main`:

```sh
npm run quality-compare -- --no-open
git switch -c qc-<topic> preview
mkdir -p public/quality-compare && cp -R .quality-compare/. public/quality-compare/
git add public/quality-compare && git commit -m "Temporary quality comparison: <topic>"
git push -u origin qc-<topic>
git switch preview
```

Vercel builds the branch at `https://shen-foundation-web-git-qc-<topic>-frontier-design.vercel.app/quality-compare/index.html`. Preview deployments require a Vercel login, so send the client a link from the deployment's **Share** button in the Vercel dashboard instead. Editors shouldn't select the `qc-` branch in Pages CMS.

When you're done, delete the branch everywhere:

```sh
git push origin --delete qc-<topic>
git branch -D qc-<topic>
```
