// Copia la web lista para producción a dist/ (la carpeta que Capacitor mete en la app Android).
// La web de GitHub Pages se sirve tal cual desde la raíz del repo.
import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';

const ARCHIVOS = ['index.html', 'app.js', 'config.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png', 'sw.js', 'css', 'vendor'];

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const a of ARCHIVOS) await cp(a, `dist/${a}`, { recursive: true });

// Versión visible dentro de la app (útil para saber qué APK tienes instalada)
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const version = pkg.version, build = process.env.GITHUB_RUN_NUMBER || '';
const html = (await readFile('dist/index.html', 'utf8')).replace('<meta charset="utf-8">',
  `<meta charset="utf-8">\n  <meta name="app-version" content="${version}">${build ? `\n  <meta name="app-build" content="${build}">` : ''}`);
await writeFile('dist/index.html', html);

console.log(`dist/ lista (versión ${version}${build ? ', compilación ' + build : ''})`);
