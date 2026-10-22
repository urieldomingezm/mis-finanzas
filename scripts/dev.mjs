// Modo desarrollo:  npm run dev
// Recompila Tailwind cada vez que guardas y levanta la web en http://localhost:5173
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const win = process.platform === 'win32';
const tailwind = spawn(win ? 'npx.cmd' : 'npx', ['tailwindcss', '-i', 'src/app.css', '-o', 'css/app.css', '--watch'],
  { stdio: 'inherit', shell: win });
const servidor = spawn(process.execPath, [fileURLToPath(new URL('./servidor.mjs', import.meta.url)), '.'], { stdio: 'inherit' });

const salir = () => { tailwind.kill(); servidor.kill(); process.exit(0); };
process.on('SIGINT', salir);
process.on('SIGTERM', salir);
