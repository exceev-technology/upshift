#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const UPSHIFT_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const BRANDING_DIRECTORY = path.join(UPSHIFT_DIRECTORY, 'branding');
const OVERLAY_DIRECTORY = path.join(BRANDING_DIRECTORY, 'overlay');
const ASSETS_DIRECTORY = path.join(BRANDING_DIRECTORY, 'assets');
const ICONS_RELATIVE_DIRECTORY = 'packages/twenty-front/public/images/icons';
const INTEGRATION_LOGO_RELATIVE_PATH =
  'packages/twenty-front/public/images/integrations/twenty-logo.svg';
const BACKGROUND_COLOR = '#18181B';
const WIDE_MARK_SCALE = 0.6;

const { values: options } = parseArgs({
  options: { root: { type: 'string' } },
});

const twentyRoot = path.resolve(
  options.root ?? path.join(UPSHIFT_DIRECTORY, '..'),
);
const brand = JSON.parse(
  readFileSync(path.join(BRANDING_DIRECTORY, 'brand.json'), 'utf8'),
);

const roundedLogoPath = path.join(BRANDING_DIRECTORY, 'logo.svg');
const squareLogoPath = path.join(BRANDING_DIRECTORY, 'logo-square.svg');
const markContent = readFileSync(
  path.join(BRANDING_DIRECTORY, 'mark.svg'),
  'utf8',
)
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '');

const workDirectory = mkdtempSync(path.join(tmpdir(), 'upshift-icons-'));

const listFiles = (directory) =>
  readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);

    return statSync(entryPath).isDirectory() ? listFiles(entryPath) : [entryPath];
  });

const readPngSize = (filePath) => {
  const buffer = readFileSync(filePath);

  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};

const render = ({ svgPath, outputPath, width, height }) => {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  execFileSync('rsvg-convert', [
    '--width',
    String(width),
    '--height',
    String(height),
    '--output',
    outputPath,
    svgPath,
  ]);
};

const writeCanvasSvg = ({ width, height, markScale, wordmark }) => {
  const markSize = Math.round(Math.min(width, height) * markScale);
  const wordmarkFontSize = Math.round(markSize * 0.42);
  const wordmarkWidth = wordmark ? Math.round(wordmarkFontSize * 3.4) : 0;
  const gap = 0;
  const markX = Math.round((width - markSize - gap - wordmarkWidth) / 2);
  const markY = Math.round((height - markSize) / 2);
  const wordmarkElement = wordmark
    ? `<text x="${markX + markSize + gap}" y="${Math.round(height / 2 + wordmarkFontSize * 0.35)}" font-family="Inter, Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${wordmarkFontSize}" font-weight="600" fill="#FFFFFF">${wordmark}</text>`
    : '';
  const svgPath = path.join(workDirectory, `canvas-${width}x${height}.svg`);

  writeFileSync(
    svgPath,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${BACKGROUND_COLOR}"/><svg x="${markX}" y="${markY}" width="${markSize}" height="${markSize}" viewBox="0 0 64 64">${markContent}</svg>${wordmarkElement}</svg>`,
  );

  return svgPath;
};

const pickSource = ({ relativePath, width, height }) => {
  if (relativePath.includes('unplated') || relativePath.startsWith('android/')) {
    return roundedLogoPath;
  }

  if (width === height) {
    return squareLogoPath;
  }

  return writeCanvasSvg({ width, height, markScale: WIDE_MARK_SCALE });
};

try {
  const iconsDirectory = path.join(twentyRoot, ICONS_RELATIVE_DIRECTORY);
  const iconPaths = listFiles(iconsDirectory).filter((filePath) =>
    filePath.endsWith('.png'),
  );

  rmSync(path.join(OVERLAY_DIRECTORY, ICONS_RELATIVE_DIRECTORY), {
    recursive: true,
    force: true,
  });

  for (const iconPath of iconPaths) {
    const relativePath = path.relative(iconsDirectory, iconPath);
    const { width, height } = readPngSize(iconPath);

    render({
      svgPath: pickSource({ relativePath, width, height }),
      outputPath: path.join(
        OVERLAY_DIRECTORY,
        ICONS_RELATIVE_DIRECTORY,
        relativePath,
      ),
      width,
      height,
    });
  }

  const integrationLogoPath = path.join(
    OVERLAY_DIRECTORY,
    INTEGRATION_LOGO_RELATIVE_PATH,
  );

  mkdirSync(path.dirname(integrationLogoPath), { recursive: true });
  writeFileSync(
    integrationLogoPath,
    readFileSync(roundedLogoPath, 'utf8').replace(
      /width="\d+" height="\d+"/,
      'width="96" height="96"',
    ),
  );

  render({
    svgPath: roundedLogoPath,
    outputPath: path.join(ASSETS_DIRECTORY, 'logo-email.png'),
    width: 150,
    height: 150,
  });
  render({
    svgPath: roundedLogoPath,
    outputPath: path.join(ASSETS_DIRECTORY, 'logo-512.png'),
    width: 512,
    height: 512,
  });
  render({
    svgPath: writeCanvasSvg({
      width: 1200,
      height: 630,
      markScale: 0.36,
      wordmark: brand.name,
    }),
    outputPath: path.join(ASSETS_DIRECTORY, 'social-card.png'),
    width: 1200,
    height: 630,
  });

  console.log(
    `Generated ${iconPaths.length} app icons, the integration logo and 3 shared assets.`,
  );
} finally {
  rmSync(workDirectory, { recursive: true, force: true });
}
