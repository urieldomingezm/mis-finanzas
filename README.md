# Mis Finanzas 💸

App web (funciona en celular y computadora, se puede instalar como app) para:

- **Ver cuánto ganas y gastas por semana y por mes**, con gráficas.
- **Controlar deudas** con apps de préstamo, tarjetas y tiendas: saldo, próximo pago, intereses al mes, en cuánto tiempo la terminas y cuál pagar primero.
- **Gastos fijos y suscripciones**: cuánto te cuestan al mes/año y cuáles pagas sin usar.
- **Detector de fugas**: gastos hormiga, suscripciones sin uso, deudas caras, pagos que no cubren intereses, comisiones, presupuestos rebasados, cargos que se repiten, mes en negativo y metas en riesgo.
- **Calendario**: tus pagos programados, eventos propios (con hora y repetición), lo que registraste cada día y un botón para pasar cualquier evento a Google Calendar.
- **Metas a largo plazo**: cuánto ahorrar al mes/semana para llegar a tiempo y cuándo llegas a tu ritmo actual (también metas compartidas).
- **Varios usuarios y grupos de roomies**: cada quien tiene su cuenta y ve solo lo suyo. Si quieren, crean un grupo para compartir gastos, fijos (renta, internet), metas y eventos; la app calcula **quién le debe a quién** y el mínimo de pagos para quedar a mano.
- **Evidencias**: foto del ticket, comprobante de transferencia o PDF en gastos, ingresos, deudas, eventos y pagos entre compañeros. Las fotos se comprimen solas.

Todo gratis: **GitHub Pages** (web) + **Supabase** (base de datos y login) + **GitHub Actions** (compila la app Android).

## 📱 Descargar la app Android
**[⬇️ Descargar mis-finanzas.apk](https://github.com/urieldomingezm/mis-finanzas/releases/latest/download/mis-finanzas.apk)**

1. Abre el enlace desde tu celular Android y descarga el archivo.
2. Ábrelo. Si Android lo pide, permite *instalar apps de origen desconocido* para tu navegador.
3. Entra con la misma cuenta que usas en la web: tus datos son los mismos en todos lados.

Cada vez que se suben cambios a GitHub se compila una APK nueva (pestaña *Releases*). Se instala encima de la anterior sin perder nada.

## Proyecto Node
Necesitas [Node.js 22+](https://nodejs.org).
```bash
npm install            # instala todo
npm run dev            # web en http://localhost:5173 (recompila los estilos al guardar)
npm run build          # deja la versión final en dist/
npm run preview        # sirve dist/ para probarla
npm run android:abrir  # abre el proyecto en Android Studio
npm run android:apk    # compila la APK en tu compu (requiere Android Studio / SDK y Java 21)
```
No necesitas compilar la APK tú: **GitHub Actions lo hace solo** en cada `git push` (archivo `.github/workflows/android.yml`).

---

## 0. Pruébala antes de configurar nada
Abre `index.html` en tu navegador (o súbela a GitHub, paso 3). Sin configurar Supabase entra en **modo demo**: los datos se guardan solo en ese navegador. Usa el botón **“Cargar datos de ejemplo”** para verla funcionando.

## 1. Crear la base de datos en Supabase (gratis)
1. Entra a <https://supabase.com>, crea una cuenta y un **New project** (elige región cercana, p. ej. `us-east` o `us-west`; guarda la contraseña de la BD).
2. Abre **SQL Editor → New query**, pega todo el contenido de `supabase/schema.sql` y presiona **Run**. Debe decir *Success*. Esto crea las tablas, la seguridad entre usuarios y el almacenamiento privado `evidencias` para las fotos.
   > **¿Ya habías corrido la versión anterior?** Vuelve a correr el `schema.sql` nuevo completo. No borra tus datos; solo agrega grupos, calendario y evidencias.
3. Ve a **Project Settings → API** (o “API Keys”) y copia:
   - **Project URL** (`https://xxxx.supabase.co`)
   - La llave **pública**: `anon` o `publishable`.
   > ⚠️ Nunca uses la llave `service_role` / `secret` en esta app.

## 2. Conectar la app
Abre `config.js` y pega los dos valores:
```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://xxxx.supabase.co",
  SUPABASE_ANON_KEY: "tu-llave-publica"
};
```
Es seguro que esta llave quede pública: las políticas **RLS** del `schema.sql` hacen que cada usuario solo pueda ver sus propios datos y lo que sus grupos le compartan.

## 3. Publicarla gratis con GitHub Pages
1. Crea un repositorio en GitHub (p. ej. `mis-finanzas`). Puede ser público.
2. Sube **todos** los archivos de esta carpeta a la raíz del repo (botón *Add file → Upload files*, o con git).
3. En el repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)` → **Save**.
4. En 1–2 minutos tendrás tu link: `https://TU-USUARIO.github.io/mis-finanzas/`

## 4. Ajustar el login en Supabase
En Supabase → **Authentication → URL Configuration**:
- **Site URL**: tu link de GitHub Pages.
- **Redirect URLs**: agrega el mismo link.

Por defecto Supabase pide confirmar el correo al crear cuenta. Si la app es solo para ti y quieres entrar directo, puedes desactivar *Confirm email* en **Authentication → Sign In / Providers → Email**.

## 4b. Entrar con Google (opcional)
El botón **Continuar con Google** aparece solo cuando Google está activado en Supabase; mientras tanto el login sigue siendo con correo.

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **Pantalla de consentimiento de OAuth**: tipo *Externo*, nombre "Mis Finanzas", tu correo de soporte, y publícala (**En producción**; con los permisos básicos no pide verificación).
2. **Credenciales → Crear credenciales → ID de cliente de OAuth**, tipo **Aplicación web**:
   - Orígenes autorizados de JavaScript: `https://urieldomingezm.github.io`
   - URI de redireccionamiento autorizados: `https://pdmcxbdbtbykpfofmxrn.supabase.co/auth/v1/callback`
3. En Supabase → **Authentication → Sign In / Providers → Google**: actívalo y pega el *Client ID* y el *Client Secret*. (El secreto solo va ahí, nunca en el repo.)
4. En Supabase → **Authentication → URL Configuration → Redirect URLs**, agrega también `io.github.urieldomingezm.misfinanzas://login-callback` (para que la app Android reciba la sesión).

En la app Android, Google se abre en el navegador del sistema (Google no permite iniciar sesión dentro de apps web incrustadas) y al terminar regresa sola a la app. Si ya tenías cuenta con el mismo correo de Gmail, Supabase la vincula y ves tus mismos datos.

## 5. Instalarla en tu celular
Abre tu link en el celular:
- **Android (Chrome)**: menú ⋮ → *Agregar a pantalla principal / Instalar app*.
- **iPhone (Safari)**: botón compartir → *Agregar a pantalla de inicio*.

---

## Compartir con roomies
1. Cada persona crea **su propia cuenta** en tu link.
2. Uno entra a **Grupo → Crear grupo** (p. ej. “Depa Roma”) y toca **Invitar**: se comparte por WhatsApp un mensaje con el link y un **código de 6 letras**.
3. Los demás entran a **Grupo → Unirme con código**.
4. Al registrar un gasto eliges **Compartir con: Solo yo / Depa Roma**, quién lo pagó y entre quiénes se divide. En tus finanzas personales solo cuenta **tu parte**.
5. En **Grupo → Para quedar a mano** aparece quién le debe a quién y de qué conceptos (ej. *Hamburguesa $140 · Almohada $50*). Toca **Pagar** y elige:
   - **Todo junto**, o marca solo algunos conceptos;
   - cambia el monto si es un **abono** (pago parcial): lo que falte queda pendiente en ese concepto;
   - adjunta **uno o varios comprobantes** (toca *Agregar otra evidencia* para sumar más).
   Cada gasto compartido muestra su estado: *Debes $X* con botón **Pagar esto**, *Te falta $X*, *Tu parte ya está pagada*, *Te deben $X* o *Compensado* (cuando las deudas entre ustedes se cancelan entre sí).
6. Para la renta o el internet, da de alta un **gasto fijo compartido**; cuando se pague, toca **Ya se pagó** y queda registrado y dividido.

**Qué ve cada quien**
| | Tú | Tus compañeros de grupo | Otros usuarios |
|---|---|---|---|
| Ingresos, deudas, presupuestos | ✅ | ❌ nunca | ❌ |
| Gastos, fijos, metas y eventos en “Solo yo” | ✅ | ❌ | ❌ |
| Lo que compartes con el grupo (y sus evidencias) | ✅ | ✅ solo lectura* | ❌ |

\*Solo quien registró algo puede editarlo o borrarlo. Excepción: en las metas compartidas todos pueden aportar.

Si alguien sale del grupo deja de ver lo compartido. Lo que esa persona registró sigue visible para el grupo, así las cuentas no cambian.

## Seguridad
- **Privacidad por fila (RLS)** en todas las tablas: la base de datos misma impide ver o cambiar datos ajenos, aunque alguien modifique la app.
- **Validaciones en la base**: en gastos compartidos solo se puede dividir entre miembros reales del grupo; las evidencias solo pueden ligarse a archivos de tu propia carpeta y a tus propios registros; nadie puede hacerse admin ni cambiar códigos; textos y montos tienen límites.
- **Códigos de invitación** de 8 caracteres aleatorios y bloqueo de 1 hora tras 10 códigos incorrectos (anti fuerza bruta).
- **Funciones internas** en un esquema privado que no se publica en la API.
- **Evidencias privadas**: el almacén no es público y cada foto se abre con un enlace temporal de 1 hora.
- **En el navegador**: las librerías van incluidas en el repo (carpeta `vendor/`, sin depender de CDNs), una política de seguridad (CSP) solo permite ejecutar código del propio sitio y hablar con Supabase, y la app no se deja incrustar en otras páginas.
- La llave de `config.js` es pública por diseño; **nunca** pongas ahí la `service_role` / `secret`.

**Recomendado en el panel de Supabase** (Authentication → Sign In / Providers → Email): deja activado *Confirm email* y sube *Minimum password length* a 8.

## Notificaciones
**Campanita (web y app):** junta en un solo lugar
- pagos de deudas, gastos fijos, eventos y fechas de metas de los próximos 7 días;
- presupuestos al 80% o rebasados, metas logradas o en riesgo y fugas importantes;
- lo que registren tus roomies (gastos, pagos, eventos, fijos, metas, nuevos miembros) y si debes o te deben.

El número rojo indica cuántos avisos no has visto. Al tocar un aviso te lleva a su sección.

**App Android:** recordatorios programados en el celular que llegan **aunque la app esté cerrada** (también tras reiniciar el teléfono). La primera vez la app pregunta si quieres activarlos. Se vuelven a programar cada vez que abres la app o cambian tus datos.

**Web:** al abrir la página, si tienes pagos hoy o mañana, aparece un aviso del navegador (una vez al día). El navegador no puede avisar con la página cerrada; para eso está la app Android.

**Ajustes** (campanita → *Ajustes*): con cuánta anticipación (mismo día, 1, 2, 3 días o una semana antes), a qué hora, si avisa también el mismo día, de qué tipos (deudas, fijos, eventos, metas, actividad del grupo) y el resumen semanal de los domingos 7 pm. Incluye un botón para enviar una notificación de prueba.

> Los recordatorios no usan alarmas exactas, así que Android puede entregarlos con unos minutos de diferencia para ahorrar batería. Si no te llegan, revisa *Ajustes del celular → Apps → Mis Finanzas → Notificaciones* y que la app no tenga restringida la batería.

## Ventanas y formularios
Todas las ventanas usan [SweetAlert2](https://sweetalert2.github.io): formularios, confirmaciones, menú rápido, visor de evidencias y cambio de contraseña. Los formularios largos son un **wizard por pasos** con *Siguiente / Atrás*:
- **Gasto**: qué gastaste → con quién se comparte (solo si tienes grupo) → notas y evidencia
- **Deuda**: a quién le debes → cómo la pagas → documentos
- **Ingreso**, **gasto fijo**, **evento** y **pago entre compañeros**: 2 pasos

Cada paso se valida antes de avanzar. En celular los formularios salen desde abajo como hoja.

## Guía dentro de la app
La primera vez que entras aparece un recorrido por todas las secciones. Después, el botón **?** (arriba a la derecha) explica la sección donde estés. Usa [Driver.js](https://driverjs.com).

## Cómo sacarle provecho
1. **Registra todo lo que entra** (cada pago semanal, ventas, extras).
2. **Registra los gastos el mismo día**, aunque sean $20. Las fugas aparecen con los gastos pequeños.
3. **Da de alta tus deudas** con su tasa/CAT (viene en el contrato o en la app). Con eso calcula intereses y orden de pago.
4. **Da de alta tus gastos fijos** y sé honesto con “lo uso / no lo uso”.
5. **Ponle presupuesto** a 2–3 categorías donde sientas que se te va el dinero.
6. **Crea metas**: empieza por un fondo de emergencia de 3 meses de gastos.
7. **Toma foto del ticket** al momento: si hay dudas con tus roomies, ahí está la prueba.
8. Cada domingo revisa **Inicio → Fugas** y **Calendario**. Pasa a Google Calendar los pagos que no quieras olvidar (botón **+📅**), así te llega la notificación al celular.

## Archivos
| Archivo | Qué es |
|---|---|
| `index.html` | Estructura de la app |
| `src/app.css` | Diseño con **Tailwind CSS** (fuente). Claro/oscuro automático, responsivo para celular, tablet y escritorio |
| `css/app.css` | CSS ya compilado que usa la página (no lo edites a mano) |
| `package.json` | Proyecto Node: dependencias y comandos (`dev`, `build`, `android:*`) |
| `scripts/` | Servidor local, compilación a `dist/` y compilación de la APK |
| `capacitor.config.json` | Configuración de la app Android (Capacitor) |
| `android/` | Proyecto Android nativo generado por Capacitor (ícono, permisos, firma) |
| `.github/workflows/android.yml` | Compila y publica la APK en cada push |
| `app.js` | Toda la lógica: datos, cálculos, fugas, gráficas, calendario, grupos, evidencias |
| `config.js` | Tus llaves de Supabase |
| `supabase/schema.sql` | Tablas, seguridad entre usuarios y almacenamiento de evidencias |
| `manifest.json`, `sw.js`, `icon.svg` | Para instalarla como app en el celular |
| `vendor/` | Supabase JS, Chart.js, Driver.js, SweetAlert2, Bootstrap Icons y las tipografías Bricolage Grotesque e Instrument Sans (licencias MIT y OFL en `LICENSES.txt`) |

## Versión
La versión está en `package.json` (`"version"`) y es la misma para la web y la app. Se ve abajo del login y al final de cada sección (p. ej. *Mis Finanzas v1.2.0 · Web* o *· App Android*; en la app también el número de compilación). Para publicar una versión nueva, súbela en `package.json` antes de hacer push.

## Editar el diseño (Tailwind CSS)
La página usa `css/app.css`, que se genera desde `src/app.css` con Tailwind. Si cambias clases en `index.html` o `app.js`, o estilos en `src/app.css`, recompila:
```bash
npm install        # solo la primera vez (necesitas Node.js 20+)
npm run build      # genera css/app.css
npm run dev        # o déjalo recompilando solo mientras editas
```
Luego sube `css/app.css` junto con tus cambios. Los íconos son de [Bootstrap Icons](https://icons.getbootstrap.com): `<i class="bi bi-nombre-del-icono"></i>`.

## Firma de la APK
La APK se firma con una **llave de desarrollo incluida en el repo** (`android/app/firma-desarrollo.keystore`). Sirve para instalar y actualizar la app en tus celulares, pero como el repo es público, cualquiera podría firmar una APK con ella: **instala la app solo desde este repo**.

Para una llave privada (necesaria si algún día la subes a Play Store):
```bash
keytool -genkeypair -keystore mi-llave.keystore -alias misfinanzas -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 mi-llave.keystore     # copia el resultado
```
En GitHub: *Settings → Secrets and variables → Actions* crea `ANDROID_KEYSTORE_BASE64` (lo copiado), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`misfinanzas`) y `ANDROID_KEY_PASSWORD`. Guarda bien ese archivo: si lo pierdes no podrás actualizar la app. Al cambiar de llave hay que desinstalar la versión anterior una vez.

## Límites del plan gratis (a considerar)
- Supabase gratis **pausa el proyecto tras ~1 semana sin uso**; si pasa, entra a supabase.com y dale *Restore*. Usándola seguido no ocurre.
- **Almacenamiento: 1 GB gratis** para evidencias. Como las fotos se comprimen (~100–250 KB cada una), alcanza para miles de tickets.
- La app trae los cambios de tus compañeros cada vez que la abres o vuelves a ella (también hay botón **↻ Actualizar** en Grupo).
- Los datos del **modo demo** no se pasan solos a Supabase; empieza a registrar en serio ya con Supabase configurado.
