// Compila la APK firmada en tu computadora (necesitas Android Studio o el SDK de Android y Java 21):
//   npm run android:apk      → deja el archivo en ./mis-finanzas.apk
import { spawnSync } from 'node:child_process';
import { copyFile } from 'node:fs/promises';

const win = process.platform === 'win32';
const r = spawnSync(win ? 'gradlew.bat' : './gradlew', ['assembleRelease', '--no-daemon'], { cwd: 'android', stdio: 'inherit', shell: win });
if (r.status !== 0) process.exit(r.status ?? 1);
await copyFile('android/app/build/outputs/apk/release/app-release.apk', 'mis-finanzas.apk');
console.log('\n  APK lista: ./mis-finanzas.apk  (pásala a tu celular e instálala)\n');
