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

Todo gratis: **GitHub Pages** (hosting) + **Supabase** (base de datos y login).

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
5. En **Grupo → Para quedar a mano** aparece quién le debe a quién. Al transferir, toca **Registrar pago** y adjunta el comprobante.
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
| `styles.css` | Diseño responsivo (claro/oscuro automático) |
| `app.js` | Toda la lógica: datos, cálculos, fugas, gráficas, calendario, grupos, evidencias |
| `config.js` | Tus llaves de Supabase |
| `supabase/schema.sql` | Tablas, seguridad entre usuarios y almacenamiento de evidencias |
| `manifest.json`, `sw.js`, `icon.svg` | Para instalarla como app en el celular |
| `vendor/` | Supabase JS, Chart.js y Driver.js (licencias MIT en `LICENSES.txt`) |

## Límites del plan gratis (a considerar)
- Supabase gratis **pausa el proyecto tras ~1 semana sin uso**; si pasa, entra a supabase.com y dale *Restore*. Usándola seguido no ocurre.
- **Almacenamiento: 1 GB gratis** para evidencias. Como las fotos se comprimen (~100–250 KB cada una), alcanza para miles de tickets.
- La app trae los cambios de tus compañeros cada vez que la abres o vuelves a ella (también hay botón **↻ Actualizar** en Grupo).
- Los datos del **modo demo** no se pasan solos a Supabase; empieza a registrar en serio ya con Supabase configurado.
