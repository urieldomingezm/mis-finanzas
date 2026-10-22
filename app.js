'use strict';
/* =====================================================================
   Mis Finanzas — app.js (v2: multiusuario, grupos, calendario, evidencias)
   Sin frameworks ni compilación: funciona tal cual en GitHub Pages.
   ===================================================================== */

/* ---------- Protección contra que metan la app dentro de otra página (clickjacking) ---------- */
if (window.top !== window.self) { try { window.top.location = window.self.location; } catch { document.documentElement.innerHTML = ''; } }

/* ---------- Configuración / conexión ---------- */
const CFG  = window.APP_CONFIG || {};
const DEMO = !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY || !window.supabase;
const sb   = DEMO ? null : window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
const BUCKET = 'evidencias';
const DEMO_COMPA = 'demo-compa';
let ME = DEMO ? 'demo-yo' : null;   // id del usuario actual
let MI_ALIAS = 'Yo';

/* ---------- Utilidades ---------- */
const $  = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const money = n => fmtMXN.format(Number(n) || 0);
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const parse = s => { if (!s) return null; const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const hoyD = () => parse(today());
const startOfWeek = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const mesIni = (d = new Date(), off = 0) => new Date(d.getFullYear(), d.getMonth() + off, 1);
const sum = (arr, k = 'monto') => arr.reduce((a, b) => a + (Number(b[k]) || 0), 0);
const enRango = (a, b) => x => { const d = parse(x.fecha); return !!d && d >= a && d < b; };
const fCorta = d => (d instanceof Date ? d : parse(d))?.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) ?? '';
const fLarga = d => (d instanceof Date ? d : parse(d))?.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }) ?? '';
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const porFecha = (a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.created_at || '').localeCompare(a.created_at || '');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const CATEGORIAS = ['Comida', 'Súper', 'Transporte', 'Gasolina', 'Renta / vivienda', 'Servicios (luz, agua, gas)', 'Teléfono / internet',
  'Salud', 'Educación', 'Entretenimiento', 'Ropa', 'Suscripciones', 'Pago de deuda', 'Comisiones / intereses', 'Hogar / limpieza', 'Regalos', 'Otro'];
const FUENTES = ['Sueldo', 'Negocio', 'Freelance', 'Ventas', 'Propinas / comisiones', 'Otro'];
const METODOS = ['Efectivo', 'Débito', 'Crédito', 'Transferencia', 'App / monedero'];
const TIPOS_DEUDA = ['App de préstamo', 'Tarjeta de crédito', 'Tienda departamental', 'Préstamo personal', 'Familiar / amigo', 'Otro'];
const FRECUENCIAS = ['semanal', 'quincenal', 'mensual', 'anual'];
const REPETIR = ['no se repite', ...FRECUENCIAS];
const mensualEq = (monto, frec) => { const m = Number(monto) || 0; return ({ semanal: m * 52 / 12, quincenal: m * 2, mensual: m, anual: m / 12 })[frec] ?? m; };
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms);
}

/* ---------- Capa de datos (Supabase o navegador) ---------- */
const TABLAS = ['ingresos', 'gastos', 'deudas', 'recurrentes', 'metas', 'presupuestos', 'eventos', 'grupos', 'miembros', 'adjuntos', 'liquidaciones'];
const LS = 'misfinanzas_';
const lsGet = t => { try { return JSON.parse(localStorage.getItem(LS + t) || '[]'); } catch { return []; } };
const lsSet = (t, rows) => {
  try { localStorage.setItem(LS + t, JSON.stringify(rows)); }
  catch { throw new Error('Se llenó el espacio del navegador (modo demo). Configura Supabase para guardar más.'); }
};

const db = {
  async list(t) {
    if (DEMO) return lsGet(t);
    const { data, error } = await sb.from(t).select('*').order('created_at', { ascending: false });
    if (error) throw error; return data || [];
  },
  async insert(t, obj) {
    if (DEMO) { const row = { id: uid(), created_at: new Date().toISOString(), user_id: ME, ...obj }; lsSet(t, [row, ...lsGet(t)]); return row; }
    const { data, error } = await sb.from(t).insert(obj).select().single();
    if (error) throw error; return data;
  },
  async update(t, id, patch) {
    if (DEMO) { lsSet(t, lsGet(t).map(r => (r.id === id ? { ...r, ...patch } : r))); return; }
    const { error } = await sb.from(t).update(patch).eq('id', id);
    if (error) throw error;
  },
  async remove(t, id) {
    if (DEMO) { lsSet(t, lsGet(t).filter(r => r.id !== id)); return; }
    const { error } = await sb.from(t).delete().eq('id', id);
    if (error) throw error;
  }
};

/* ---------- Evidencias (Supabase Storage) ---------- */
const urlCache = new Map();
const storage = {
  async subir(ruta, blob) {
    if (DEMO) return await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });
    const { error } = await sb.storage.from(BUCKET).upload(ruta, blob, { contentType: blob.type, upsert: false });
    if (error) throw error; return ruta;
  },
  async url(ruta) {
    if (DEMO) return ruta;
    const c = urlCache.get(ruta); if (c && c.exp > Date.now()) return c.url;
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(ruta, 3600);
    if (error) { console.warn(error); return null; }
    urlCache.set(ruta, { url: data.signedUrl, exp: Date.now() + 3500e3 }); return data.signedUrl;
  },
  async borrar(ruta) { if (!DEMO) await sb.storage.from(BUCKET).remove([ruta]); }
};
// Reduce las fotos (un ticket de 4 MB queda en ~200 KB) para no gastar el espacio gratis.
async function comprimir(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const max = DEMO ? 900 : 1600, q = DEMO ? 0.6 : 0.78;
  let img;
  try { img = await createImageBitmap(file); }
  catch { img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); }); }
  const w = img.width, h = img.height, k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return await new Promise(ok => c.toBlob(b => ok(b || file), 'image/jpeg', q));
}
async function subirAdjuntos(ref, files) {
  for (const f of files) {
    if (f.size > 10 * 1024 * 1024 && !f.type.startsWith('image/')) { toast(`"${f.name}" pesa más de 10 MB`); continue; }
    const blob = await comprimir(f);
    const ext = blob.type === 'application/pdf' ? 'pdf' : blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const ruta = await storage.subir(`${ME}/${uid()}.${ext}`, blob);
    await db.insert('adjuntos', { tabla: ref.tabla, registro_id: ref.id, grupo_id: ref.grupo_id || null, ruta, nombre: f.name, tipo_mime: blob.type });
  }
}
async function borrarAdjunto(a) {
  try { await storage.borrar(a.ruta); } catch (e) { console.warn(e); }
  await db.remove('adjuntos', a.id);
  R.adjuntos = R.adjuntos.filter(x => x.id !== a.id);
}

/* ---------- Estado: R = datos crudos, S = vista personal (tu parte) ---------- */
const R = Object.fromEntries(TABLAS.map(t => [t, []]));
const S = {};
let avisoMigracion = false;
async function cargar() {
  let falta = false;
  const res = await Promise.all(TABLAS.map(t => db.list(t).catch(err => { console.warn(t, err); falta = true; return []; })));
  TABLAS.forEach((t, i) => { R[t] = res[i]; });
  derivar();
  if (falta && !avisoMigracion) { avisoMigracion = true; toast('Falta actualizar la base: ejecuta otra vez supabase/schema.sql en Supabase', 6000); }
}
async function refrescar() { await cargar(); render(); }

const esMio = row => (row.user_id ?? ME) === ME;
const misGrupos = () => R.grupos.filter(g => R.miembros.some(m => m.grupo_id === g.id && m.user_id === ME));
const miembrosDe = gid => R.miembros.filter(m => m.grupo_id === gid);
const nombreGrupo = gid => R.grupos.find(g => g.id === gid)?.nombre || 'Grupo';
const aliasDe = (u, gid) => u === ME ? 'Tú' : (R.miembros.find(m => m.user_id === u && (!gid || m.grupo_id === gid))?.alias || 'Compañero');
const participantesDe = g => (Array.isArray(g.participantes) && g.participantes.length) ? g.participantes : miembrosDe(g.grupo_id).map(m => m.user_id);
function miParte(g) {
  if (!g.grupo_id) return Number(g.monto) || 0;
  const p = participantesDe(g);
  return p.includes(ME) ? (Number(g.monto) || 0) / p.length : 0;
}
const parteFijo = r => r.grupo_id ? (Number(r.monto) || 0) / Math.max(1, miembrosDe(r.grupo_id).length) : (Number(r.monto) || 0);
function derivar() {
  ['ingresos', 'deudas', 'metas', 'presupuestos', 'eventos'].forEach(t => { S[t] = R[t]; });
  S.gastos = R.gastos.map(g => ({ ...g, total: Number(g.monto), monto: miParte(g) })).filter(g => g.monto > 0);
  S.recurrentes = R.recurrentes.map(r => ({ ...r, total: Number(r.monto), monto: parteFijo(r) }));
}
const rawRow = (t, id) => R[t].find(r => String(r.id) === String(id));
const adjuntosDe = (t, id) => R.adjuntos.filter(a => a.tabla === t && a.registro_id === id);
const clip = (t, id) => { const n = adjuntosDe(t, id).length; return n ? ` · <i class="bi bi-paperclip" aria-hidden="true"></i>${n}` : ''; };
const puedeEditar = (t, row) => !row || esMio(row);   // en metas compartidas los demás solo pueden "Aportar"

/* ---------- Definición de formularios ---------- */
const num = (k, l, o = {}) => ({ k, l, t: 'number', ...o });
const notas = { k: 'notas', l: 'Notas (opcional)', t: 'text' };
const GRUPO = { k: 'grupo_id', l: 'Compartir con', t: 'grupo' };
const ADJ = { k: '_adjuntos', l: 'Evidencia (foto del ticket, comprobante, PDF)', t: 'files' };
const FORMS = {
  ingresos: { nuevo: 'Nuevo ingreso', fields: [
    { k: 'fecha', l: 'Fecha', t: 'date', req: 1, def: today },
    { k: 'concepto', l: 'Concepto', t: 'text', req: 1, ph: 'Pago de la semana, venta, proyecto…' },
    { k: 'fuente', l: 'Fuente', t: 'select', opts: FUENTES },
    num('monto', 'Monto', { req: 1 }), notas, ADJ],
    pasos: [{ t: 'El ingreso', k: ['fecha', 'concepto', 'fuente', 'monto'] }, { t: 'Notas y evidencia', k: ['notas', '_adjuntos'] }] },
  gastos: { nuevo: 'Nuevo gasto', fields: [
    { k: 'fecha', l: 'Fecha', t: 'date', req: 1, def: today },
    { k: 'concepto', l: 'Concepto', t: 'text', req: 1, ph: 'Tacos, Uber, súper, luz…' },
    { k: 'categoria', l: 'Categoría', t: 'select', opts: CATEGORIAS },
    { k: 'metodo', l: 'Cómo se pagó', t: 'select', opts: METODOS },
    num('monto', 'Monto total', { req: 1 }),
    GRUPO,
    { k: 'pagado_por', l: '¿Quién lo pagó?', t: 'pagador' },
    { k: 'participantes', l: 'Dividir en partes iguales entre', t: 'participantes' },
    notas, ADJ],
    pasos: [{ t: '¿Qué gastaste?', k: ['fecha', 'concepto', 'categoria', 'metodo', 'monto'] },
      { t: '¿Se comparte?', k: ['grupo_id', 'pagado_por', 'participantes'], soloConGrupos: true },
      { t: 'Notas y evidencia', k: ['notas', '_adjuntos'] }] },
  deudas: { nuevo: 'Nueva deuda', fields: [
    { k: 'acreedor', l: '¿Con quién?', t: 'text', req: 1, ph: 'Mercado Pago, Nu, Didi, Kueski, Coppel…' },
    { k: 'tipo', l: 'Tipo', t: 'select', opts: TIPOS_DEUDA },
    num('saldo', 'Saldo que debes hoy', { req: 1 }),
    num('monto_original', 'Monto original (para ver tu avance)'),
    num('pago_minimo', 'Pago por periodo', { req: 1 }),
    { k: 'frecuencia', l: 'Cada cuándo pagas', t: 'select', opts: ['semanal', 'quincenal', 'mensual'], def: 'mensual' },
    { k: 'proximo_pago', l: 'Próxima fecha de pago', t: 'date', req: 1, def: today },
    num('tasa_anual', 'Tasa anual o CAT (%)', { step: '0.1', max: 5000, ph: 'Viene en tu contrato o en la app' }),
    notas, { ...ADJ, l: 'Contrato o estado de cuenta (opcional)' }],
    pasos: [{ t: '¿A quién le debes?', k: ['acreedor', 'tipo', 'saldo', 'monto_original'] },
      { t: '¿Cómo la pagas?', k: ['pago_minimo', 'frecuencia', 'proximo_pago', 'tasa_anual'] },
      { t: 'Documentos', k: ['notas', '_adjuntos'] }] },
  recurrentes: { nuevo: 'Nuevo gasto fijo', fields: [
    { k: 'nombre', l: 'Nombre', t: 'text', req: 1, ph: 'Renta, internet, Netflix, gimnasio, plan de celular…' },
    num('monto', 'Monto total', { req: 1 }),
    { k: 'frecuencia', l: 'Cada cuándo se cobra', t: 'select', opts: FRECUENCIAS, def: 'mensual' },
    { k: 'proximo_cobro', l: 'Próximo cobro', t: 'date', req: 1, def: today },
    { k: 'categoria', l: 'Categoría', t: 'select', opts: CATEGORIAS, def: 'Suscripciones' },
    { ...GRUPO, l: 'Compartir con (se divide entre todos)' },
    { k: 'en_uso', l: 'Sí lo uso / sí lo necesito', t: 'check', def: true }, notas],
    pasos: [{ t: '¿Qué pagas?', k: ['nombre', 'monto', 'frecuencia', 'proximo_cobro'] },
      { t: 'Detalles', k: ['categoria', 'grupo_id', 'en_uso', 'notas'] }] },
  metas: { nuevo: 'Nueva meta', fields: [
    { k: 'nombre', l: 'Meta', t: 'text', req: 1, ph: 'Fondo de emergencia, moto, viaje, sala del depa…' },
    num('objetivo', '¿Cuánto necesitas?', { req: 1 }),
    num('ahorrado', '¿Cuánto llevas?', { def: 0 }),
    { k: 'fecha_limite', l: '¿Para cuándo?', t: 'date' },
    { ...GRUPO, l: 'Meta compartida con' }, notas] },
  presupuestos: { nuevo: 'Nuevo presupuesto', fields: [
    { k: 'categoria', l: 'Categoría', t: 'select', opts: CATEGORIAS },
    num('limite_mensual', 'Límite al mes', { req: 1 })] },
  eventos: { nuevo: 'Nuevo evento', fields: [
    { k: 'titulo', l: '¿Qué?', t: 'text', req: 1, ph: 'Pagar renta, cobro de quincena, revisar cuentas del depa…' },
    { k: 'fecha', l: 'Fecha', t: 'date', req: 1, def: today },
    { k: 'hora', l: 'Hora (opcional)', t: 'time' },
    { k: 'tipo', l: 'Tipo', t: 'select', opts: ['Recordatorio', 'Pago', 'Cobro', 'Otro'] },
    num('monto', 'Monto (opcional)'),
    { k: 'repetir', l: 'Se repite', t: 'select', opts: REPETIR },
    { ...GRUPO, l: 'Mostrar también en el calendario de' }, notas, ADJ],
    pasos: [{ t: '¿Qué y cuándo?', k: ['titulo', 'fecha', 'hora', 'tipo', 'monto'] },
      { t: 'Repetir y compartir', k: ['repetir', 'grupo_id', 'notas', '_adjuntos'] }] },
  liquidaciones: { nuevo: 'Pago entre compañeros', fields: [
    { k: 'de', l: '¿Quién pagó?', t: 'miembro' },
    { k: 'para', l: '¿A quién le pagó?', t: 'miembro' },
    num('monto', 'Monto', { req: 1 }),
    { k: 'fecha', l: 'Fecha', t: 'date', req: 1, def: today },
    notas, { ...ADJ, l: 'Comprobante de transferencia (opcional)' }],
    pasos: [{ t: 'El pago', k: ['de', 'para', 'monto', 'fecha'] }, { t: 'Comprobante', k: ['notas', '_adjuntos'] }] },
  abono: { nuevo: 'Registrar abono', fields: [
    num('monto', 'Monto del abono', { req: 1 }),
    { k: 'fecha', l: 'Fecha', t: 'date', req: 1, def: today },
    { k: 'registrar_gasto', l: 'Registrarlo también como gasto del mes', t: 'check', def: true },
    { ...ADJ, l: 'Comprobante de pago (opcional)' }] },
  aporte: { nuevo: 'Aportar a la meta', fields: [num('monto', 'Monto', { req: 1 })] },
  grupo_nuevo: { nuevo: 'Crear grupo', fields: [
    { k: 'nombre', l: 'Nombre del grupo', t: 'text', req: 1, ph: 'Depa Roma, Casa, Roomies…' },
    { k: 'alias', l: 'Tu nombre en el grupo', t: 'text', req: 1 }] },
  grupo_unirse: { nuevo: 'Unirme a un grupo', fields: [
    { k: 'codigo', l: 'Código que te compartieron', t: 'text', req: 1, ph: 'Ej. A1B2C3' },
    { k: 'alias', l: 'Tu nombre en el grupo', t: 'text', req: 1 }] },
  alias: { nuevo: 'Tu nombre en el grupo', fields: [{ k: 'alias', l: 'Nombre', t: 'text', req: 1 }] }
};

/* ---------- Ventanas (SweetAlert2) ---------- */
const clasesSwal = (extra = {}) => ({
  popup: 'swal-app', title: 'swal-titulo', htmlContainer: 'swal-cuerpo', actions: 'swal-acciones',
  confirmButton: 'btn primary', denyButton: 'btn ghost', cancelButton: 'btn ghost',
  validationMessage: 'swal-error', image: 'swal-imagen', ...extra
});
const SWAL = Swal.mixin({
  heightAuto: false, buttonsStyling: false, reverseButtons: true, returnFocus: false,
  customClass: clasesSwal(), cancelButtonText: 'Cancelar'
});
// Confirmación con SweetAlert2 (reemplaza al confirm() del navegador)
async function confirmar({ titulo, texto = '', ok = 'Sí, continuar', peligro = false, icono = 'warning' }) {
  const r = await SWAL.fire({
    icon: icono, title: titulo, text: texto, showCancelButton: true, confirmButtonText: ok, focusCancel: peligro,
    customClass: clasesSwal({ confirmButton: peligro ? 'btn primary peligro' : 'btn primary' })
  });
  return r.isConfirmed;
}

/* ---------- Formularios (con wizard por pasos cuando son largos) ---------- */
let ctx = null;
const fm = () => document.getElementById('swal-form');
function campo(f, v) {
  const req = f.req ? 'required' : '';
  switch (f.t) {
    case 'select': {
      const opts = v && !f.opts.includes(v) ? [v, ...f.opts] : f.opts;
      return `<label>${f.l}<select name="${f.k}" ${req}>${opts.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    }
    case 'check': return `<label class="check"><input type="checkbox" name="${f.k}" ${v !== false ? 'checked' : ''}>${f.l}</label>`;
    case 'grupo': {
      const gs = misGrupos();
      if (!gs.length) return `<input type="hidden" name="grupo_id" value="${esc(v || '')}">`;
      return `<label>${f.l}<select name="grupo_id" data-grupo><option value="">Solo yo (privado)</option>${gs.map(g => `<option value="${g.id}" ${g.id === v ? 'selected' : ''}>${esc(g.nombre)}</option>`).join('')}</select></label>`;
    }
    case 'pagador': return `<label data-solo-grupo>${f.l}<select name="pagado_por" data-v="${esc(v || ME)}"></select></label>`;
    case 'participantes': return `<fieldset data-solo-grupo class="chips-field" data-v="${esc(JSON.stringify(v || []))}"><legend>${f.l}</legend><div class="chips"></div><small class="muted" data-parte></small></fieldset>`;
    case 'miembro': return `<label>${f.l}<select name="${f.k}" data-miembro data-v="${esc(v || '')}" required></select></label>`;
    case 'files': return `<div class="adj-field"><span class="lbl">${f.l}</span><div class="thumbs" id="adj-exist"></div><div class="thumbs" id="adj-nuevos"></div>
      <label class="btn ghost small file-btn"><i class="bi bi-camera" aria-hidden="true"></i>Tomar foto o elegir archivo<input type="file" name="_adjuntos" multiple accept="image/*,application/pdf" hidden></label></div>`;
    default: {
      const extra = f.t === 'number' ? `step="${f.step || '0.01'}" min="0" ${f.max ? `max="${f.max}"` : ''} inputmode="decimal"` : '';
      const val = f.t === 'time' && v ? String(v).slice(0, 5) : v;
      const largo = f.t === 'text' ? `maxlength="${f.k === 'notas' ? 1000 : 120}"` : '';
      return `<label>${f.l}<input type="${f.t}" name="${f.k}" value="${esc(val ?? '')}" ${req} ${extra} ${largo} placeholder="${esc(f.ph || '')}"></label>`;
    }
  }
}
const grupoDelForm = () => fm()?.elements.grupo_id?.value || ctx?.pre?.grupo_id || ctx?.row?.grupo_id || '';
function actualizarGrupoCampos(reset = false) {
  const form = fm(); if (!form) return;
  const gid = grupoDelForm(), ms = gid ? miembrosDe(gid) : [];
  form.querySelectorAll('[data-solo-grupo]').forEach(el => { el.hidden = !gid; });
  form.querySelectorAll('select[name=pagado_por], select[data-miembro]').forEach(sel => {
    let v = reset ? '' : (sel.value || sel.dataset.v || '');
    if (!ms.some(m => m.user_id === v)) v = sel.name === 'para' ? (ms.find(m => m.user_id !== ME)?.user_id || '') : ME;
    sel.innerHTML = ms.map(m => `<option value="${m.user_id}" ${m.user_id === v ? 'selected' : ''}>${esc(aliasDe(m.user_id, gid))}</option>`).join('');
  });
  const fs = form.querySelector('.chips-field');
  if (fs) {
    let marcados = [];
    if (!reset) { try { marcados = JSON.parse(fs.dataset.v || '[]'); } catch { marcados = []; } }
    if (!marcados.length) marcados = ms.map(m => m.user_id);
    fs.querySelector('.chips').innerHTML = ms.map(m => `<label class="chip"><input type="checkbox" value="${m.user_id}" ${marcados.includes(m.user_id) ? 'checked' : ''}>${esc(aliasDe(m.user_id, gid))}</label>`).join('');
    fs.dataset.v = '';
    actualizarParte();
  }
}
function actualizarParte() {
  const form = fm(), el = form?.querySelector('[data-parte]'); if (!el) return;
  const n = form.querySelectorAll('.chips-field input:checked').length, total = Number(form.elements.monto?.value) || 0;
  el.textContent = n && total ? `Cada quien: ${money(total / n)}` : '';
}
function pintarAdjuntos(cont, lista, borrable) {
  cont.innerHTML = lista.map(a => `<div class="thumb">
    <button type="button" data-act="ver-adj" data-id="${a.id}" title="${esc(a.nombre || 'Evidencia')}">${a.tipo_mime === 'application/pdf' ? '<span class="pdf"><i class="bi bi-file-earmark-pdf" aria-hidden="true"></i></span>' : `<img data-adj="${a.id}" alt="${esc(a.nombre || 'evidencia')}">`}</button>
    ${borrable && esMio(a) ? `<button type="button" class="x" data-act="borrar-adj" data-id="${a.id}" aria-label="Quitar evidencia" title="Quitar"><i class="bi bi-x-lg" aria-hidden="true"></i></button>` : ''}</div>`).join('');
  hidratar(cont);
}
function hidratar(root) {
  root.querySelectorAll('img[data-adj]:not([src])').forEach(img => {
    const a = R.adjuntos.find(x => x.id === img.dataset.adj);
    if (a) storage.url(a.ruta).then(u => { if (u) img.src = u; });
  });
}
// Lee los valores del formulario abierto
function recolectar(def) {
  const form = fm(), obj = {};
  def.fields.forEach(f => {
    if (['files', 'pagador', 'participantes'].includes(f.t)) return;
    const el = form.elements[f.k]; if (!el) return;
    if (f.t === 'check') obj[f.k] = el.checked;
    else { const v = String(el.value).trim(); obj[f.k] = v === '' ? null : (f.t === 'number' ? Number(v) : v); }
  });
  const gid = ('grupo_id' in obj ? obj.grupo_id : ctx.pre.grupo_id) || null;
  if (def.fields.some(f => f.t === 'pagador')) obj.pagado_por = gid ? (form.elements.pagado_por?.value || ME) : ME;
  if (def.fields.some(f => f.t === 'participantes')) {
    const ch = [...form.querySelectorAll('.chips-field input:checked')].map(i => i.value);
    obj.participantes = gid ? (ch.length ? ch : miembrosDe(gid).map(m => m.user_id)) : null;
  }
  return obj;
}
async function guardar(c, obj, files) {
  let ref = null;
  if (c.custom) ref = await c.custom(obj);
  else if (c.row) {
    await db.update(c.tipo, c.row.id, obj);
    const g = 'grupo_id' in obj ? obj.grupo_id : (c.row.grupo_id || null);
    ref = { tabla: c.tipo, id: c.row.id, grupo_id: g };
    if ('grupo_id' in obj && (c.row.grupo_id || null) !== g)   // las evidencias siguen al registro
      for (const a of adjuntosDe(c.tipo, c.row.id).filter(esMio)) await db.update('adjuntos', a.id, { grupo_id: g });
  } else {
    const r = await db.insert(c.tipo, { ...c.pre, ...obj });
    ref = { tabla: c.tipo, id: r.id, grupo_id: r.grupo_id || null };
  }
  if (files.length && ref) await subirAdjuntos(ref, files);
}
async function eliminarRegistro(t, row) {
  for (const a of adjuntosDe(t, row.id).filter(esMio)) await borrarAdjunto(a);
  await db.remove(t, row.id);
}

function abrirForm(tipo, row = null, extra = {}) {
  const def = FORMS[tipo];
  const c = { pre: {}, ...extra, tipo, row };
  ctx = c;
  const ro = !!row && !puedeEditar(tipo, row);
  const valor = f => (c.draft && f.k in c.draft) ? c.draft[f.k] : row ? row[f.k] : (c.pre[f.k] ?? (typeof f.def === 'function' ? f.def() : f.def));
  const titulo = extra.titulo || (ro ? 'Detalle' : row ? def.nuevo.replace(/^(Nuev[oa]|Crear|Registrar) /, 'Editar ') : def.nuevo);

  // Pasos: todos los campos van en algún panel; los pasos que no aplican quedan ocultos
  const definidos = (!ro && def.pasos) ? def.pasos : [{ t: null, k: def.fields.map(f => f.k) }];
  const usados = new Set(definidos.flatMap(p => p.k));
  const sobrantes = def.fields.map(f => f.k).filter(k => !usados.has(k));
  const pasos = definidos.map((p, i) => ({ ...p, k: i === definidos.length - 1 ? [...p.k, ...sobrantes] : p.k,
    visible: !(p.soloConGrupos && !misGrupos().length) }));
  const visibles = pasos.map((p, i) => (p.visible ? i : -1)).filter(i => i >= 0);
  const total = visibles.length;
  const campoHtml = k => { const f = def.fields.find(x => x.k === k); return f ? campo(f, valor(f)) : ''; };
  const stepper = total > 1 ? `<ol class="wizard-pasos" aria-label="Pasos">${visibles.map((i, n) => `<li data-paso="${n}"><span>${n + 1}</span><em>${esc(pasos[i].t)}</em></li>`).join('')}</ol>` : '';
  const paneles = pasos.map((p, i) => `<section class="wizard-panel grid gap-3" data-panel="${i}" ${p.visible ? '' : 'hidden'}>${p.k.map(campoHtml).join('')}</section>`).join('');
  const nota = row && (row.grupo_id || !esMio(row)) ? `<p class="small muted nota-grupo"><i class="bi bi-info-circle" aria-hidden="true"></i> Registrado por ${esc(aliasDe(row.user_id, row.grupo_id))}${row.grupo_id ? ` · compartido en ${esc(nombreGrupo(row.grupo_id))}` : ''}${tipo === 'gastos' && row.grupo_id ? ` · tu parte: <b>${money(miParte(row))}</b>` : ''}.${ro ? ' Solo esa persona puede modificarlo.' : ''}</p>` : '';
  const borrar = row && !ro && esMio(row) && !def.sinBorrar ? `<button type="button" class="link-btn text-bad justify-self-start no-underline" data-act="eliminar-registro"><i class="bi bi-trash3" aria-hidden="true"></i> Eliminar este registro</button>` : '';
  const html = `<form id="swal-form" class="grid gap-3 text-left" novalidate>${stepper}${paneles}${nota}${borrar}</form>`;

  let paso = 0;
  const mostrarPaso = n => {
    paso = n;
    const form = fm();
    pasos.forEach((p, i) => { const el = form.querySelector(`[data-panel="${i}"]`); el.hidden = total > 1 ? i !== visibles[n] : !p.visible; });
    form.querySelectorAll('.wizard-pasos li').forEach((li, i) => { li.classList.toggle('activo', i === n); li.classList.toggle('hecho', i < n); });
    const deny = Swal.getDenyButton(), conf = Swal.getConfirmButton();
    if (deny) deny.style.display = n > 0 ? '' : 'none';
    if (conf) conf.innerHTML = n < total - 1 ? 'Siguiente <i class="bi bi-arrow-right" aria-hidden="true"></i>' : '<i class="bi bi-check2" aria-hidden="true"></i> Guardar';
    Swal.resetValidationMessage();
    if (!ro) setTimeout(() => form.querySelector(`[data-panel="${visibles[n]}"] input:not([type=date]):not([type=checkbox]):not([type=hidden]):not([type=file]), [data-panel="${visibles[n]}"] select`)?.focus(), 30);
  };
  const validarPaso = () => {
    const panel = fm().querySelector(`[data-panel="${visibles[paso]}"]`);
    for (const el of panel.querySelectorAll('input, select, textarea')) {
      if (el.closest('[hidden]') || el.type === 'hidden') continue;
      if (!el.checkValidity()) {
        const etiqueta = (el.closest('label')?.childNodes[0]?.textContent || 'Campo').trim();
        Swal.showValidationMessage(`${etiqueta}: ${el.validationMessage}`);
        el.focus();
        return false;
      }
    }
    return true;
  };

  return SWAL.fire({
    title: titulo, html, width: 560,
    showConfirmButton: !ro, showDenyButton: total > 1, denyButtonText: '<i class="bi bi-arrow-left" aria-hidden="true"></i> Atrás',
    showCancelButton: true, cancelButtonText: ro ? 'Cerrar' : 'Cancelar',
    focusConfirm: false, allowEnterKey: false,
    allowOutsideClick: () => !Swal.isLoading(),
    didOpen: () => {
      const form = fm();
      actualizarGrupoCampos();
      const ex = form.querySelector('#adj-exist'); if (ex && row) pintarAdjuntos(ex, adjuntosDe(tipo, row.id), !ro);
      if (ro) { form.querySelectorAll('input,select,textarea').forEach(el => { el.disabled = true; }); form.querySelector('.file-btn')?.setAttribute('hidden', ''); }
      form.addEventListener('submit', e => { e.preventDefault(); if (!ro) Swal.clickConfirm(); });
      form.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'file') { e.preventDefault(); if (!ro) Swal.clickConfirm(); } });
      form.addEventListener('change', e => {
        if (e.target.name === 'grupo_id') actualizarGrupoCampos(true);
        if (e.target.closest('.chips-field')) actualizarParte();
        if (e.target.name === '_adjuntos') form.querySelector('#adj-nuevos').innerHTML = [...e.target.files].map(f => `<div class="thumb nuevo">${f.type.startsWith('image/') ? `<img src="${URL.createObjectURL(f)}" alt="">` : '<span class="pdf"><i class="bi bi-file-earmark-pdf" aria-hidden="true"></i></span>'}</div>`).join('');
      });
      form.addEventListener('input', e => { if (e.target.name === 'monto') actualizarParte(); });
      form.querySelector('[data-act="eliminar-registro"]')?.addEventListener('click', async () => {
        const borrador = recolectar(def);
        const ok = await confirmar({ titulo: '¿Eliminar este registro?', texto: 'También se borran sus evidencias. No se puede deshacer.', ok: 'Sí, eliminar', peligro: true });
        if (!ok) return abrirForm(tipo, row, { ...c, draft: borrador });
        try { await eliminarRegistro(tipo, row); await refrescar(); toast('Eliminado'); }
        catch (err) { toast('Error: ' + err.message, 5000); }
      });
      mostrarPaso(0);
    },
    preDeny: () => { if (paso > 0) mostrarPaso(paso - 1); return false; },
    preConfirm: async () => {
      if (!validarPaso()) return false;
      if (paso < total - 1) { mostrarPaso(paso + 1); return false; }
      const obj = recolectar(def);
      if (tipo === 'liquidaciones') {
        if (obj.de === obj.para) { Swal.showValidationMessage('Elige dos personas distintas'); return false; }
        if (!DEMO && obj.de !== ME && obj.para !== ME) { Swal.showValidationMessage('Solo puedes registrar pagos donde tú pagas o recibes'); return false; }
      }
      const files = [...(fm().elements._adjuntos?.files || [])];
      try { await guardar(c, obj, files); return true; }
      catch (err) { Swal.showValidationMessage('No se pudo guardar: ' + (err.message || err)); return false; }
    }
  }).then(async r => { if (r.isConfirmed) { await refrescar(); toast('Guardado'); } return r; });
}

/* ---------- Menú rápido del botón + ---------- */
function menuRapido() {
  const op = [['gastos', 'arrow-up-circle', 'Gasto', 'neg'], ['ingresos', 'arrow-down-circle', 'Ingreso', 'pos'], ['deudas', 'credit-card-2-front', 'Deuda', ''],
    ['recurrentes', 'arrow-repeat', 'Gasto fijo', ''], ['metas', 'bullseye', 'Meta', ''], ['presupuestos', 'wallet2', 'Presupuesto', ''], ['eventos', 'calendar-event', 'Evento', '']];
  SWAL.fire({
    title: '¿Qué quieres agregar?', showConfirmButton: false, showCancelButton: true, width: 520,
    html: `<div class="quick-grid">${op.map(([t, i, l, c]) => `<button type="button" class="q ${c}" data-q="${t}"><i class="bi bi-${i}" aria-hidden="true"></i>${l}</button>`).join('')}</div>`,
    didOpen: popup => popup.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => abrirForm(b.dataset.q)))
  });
}

/* ---------- Visor de evidencias ---------- */
async function verAdjunto(a) {
  const url = await storage.url(a.ruta);
  if (!url) return toast('No se pudo abrir la evidencia');
  if (a.tipo_mime === 'application/pdf') {
    if (DEMO) { const w = window.open(); w?.document.write(`<iframe src="${url}" style="border:0;width:100%;height:100%"></iframe>`); }
    else window.open(url, '_blank', 'noopener');
    return;
  }
  // Si se abrió desde un formulario, al cerrar el visor regresamos al formulario sin perder lo escrito
  const volver = Swal.isVisible() && fm() && ctx ? { c: ctx, draft: recolectar(FORMS[ctx.tipo]) } : null;
  const r = await SWAL.fire({
    title: a.nombre || 'Evidencia', text: `Subida por ${aliasDe(a.user_id, a.grupo_id)} · ${fLarga(a.created_at)}`,
    imageUrl: url, imageAlt: a.nombre || 'Evidencia', width: 900,
    showConfirmButton: !DEMO, confirmButtonText: '<i class="bi bi-box-arrow-up-right" aria-hidden="true"></i> Abrir original',
    showCancelButton: true, cancelButtonText: volver ? '<i class="bi bi-arrow-left" aria-hidden="true"></i> Volver' : 'Cerrar'
  });
  if (r.isConfirmed) window.open(url, '_blank', 'noopener');
  if (volver) abrirForm(volver.c.tipo, volver.c.row, { ...volver.c, draft: volver.draft });
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act="ver-adj"],[data-act="borrar-adj"]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const a = R.adjuntos.find(x => x.id === b.dataset.id); if (!a) return;
  if (b.dataset.act === 'ver-adj') return verAdjunto(a);
  // Quitar dentro del formulario: se confirma con un segundo toque (no cierra el formulario)
  if (!b.classList.contains('confirmar')) {
    b.classList.add('confirmar'); b.innerHTML = '<i class="bi bi-trash3" aria-hidden="true"></i>'; b.title = 'Toca otra vez para quitar';
    setTimeout(() => { if (b.isConnected) { b.classList.remove('confirmar'); b.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>'; b.title = 'Quitar'; } }, 2500);
    return;
  }
  try { await borrarAdjunto(a); b.closest('.thumb')?.remove(); toast('Evidencia eliminada'); } catch (err) { toast('Error: ' + err.message); }
}, true);

/* ---------- Calendario ---------- */
// Días del mes (y, m) en que cae algo que empieza en `ancla` y se repite con `frec`.
function ocurrenciasMes(ancla, frec, y, m) {
  const a = parse(ancla); if (!a) return [];
  const dim = new Date(y, m + 1, 0).getDate();
  const ini = new Date(y, m, 1), fin = new Date(y, m, dim);
  if (a > fin) return [];
  if (!frec || frec === 'no se repite') return (a.getFullYear() === y && a.getMonth() === m) ? [a.getDate()] : [];
  if (frec === 'semanal') {
    let d = new Date(a); const out = [];
    if (d < ini) d = addDays(d, Math.ceil(Math.round((ini - d) / 864e5) / 7) * 7);
    while (d <= fin) { out.push(d.getDate()); d = addDays(d, 7); }
    return out;
  }
  const base = a.getDate();
  let dias = [base];
  if (frec === 'quincenal') dias = base <= 15 ? [base, base + 15] : [base - 15, base];
  if (frec === 'anual') dias = a.getMonth() === m ? [base] : [];
  return [...new Set(dias.map(d => Math.min(d, dim)))].filter(d => new Date(y, m, d) >= a);
}
function eventosMes(y, m) {
  const ev = [];
  S.deudas.filter(d => Number(d.saldo) > 0).forEach(d =>
    ocurrenciasMes(d.proximo_pago, d.frecuencia || 'mensual', y, m).forEach(day =>
      ev.push({ day, tipo: 'deuda', txt: 'Pago ' + d.acreedor, monto: Number(d.pago_minimo) || 0, ref: { t: 'deudas', id: d.id }, repetir: d.frecuencia })));
  S.recurrentes.forEach(r =>
    ocurrenciasMes(r.proximo_cobro, r.frecuencia, y, m).forEach(day =>
      ev.push({ day, tipo: 'fijo', txt: r.nombre, monto: r.monto, sinUso: r.en_uso === false, grupo: r.grupo_id, ref: { t: 'recurrentes', id: r.id }, repetir: r.frecuencia })));
  S.metas.forEach(mt => {
    const d = parse(mt.fecha_limite);
    if (d && d.getFullYear() === y && d.getMonth() === m)
      ev.push({ day: d.getDate(), tipo: 'meta', txt: 'Fecha meta: ' + mt.nombre, monto: Math.max(0, mt.objetivo - mt.ahorrado), info: true, grupo: mt.grupo_id, ref: { t: 'metas', id: mt.id } });
  });
  S.eventos.forEach(e =>
    ocurrenciasMes(e.fecha, e.repetir, y, m).forEach(day =>
      ev.push({ day, tipo: 'evento', txt: e.titulo, hora: e.hora, monto: Number(e.monto) || 0, info: e.tipo !== 'Pago', etiqueta: e.tipo,
        grupo: e.grupo_id, de: esMio(e) ? null : aliasDe(e.user_id, e.grupo_id), ref: { t: 'eventos', id: e.id }, repetir: e.repetir })));
  return ev.sort((a, b) => a.day - b.day || String(a.hora || '').localeCompare(String(b.hora || '')));
}
function proximos(dias = 14) {
  const hoy = hoyD(), lim = addDays(hoy, dias), out = [];
  for (let i = 0; i < 2 + Math.floor(dias / 31); i++) {
    const ref = mesIni(hoy, i);
    eventosMes(ref.getFullYear(), ref.getMonth()).forEach(e => {
      const f = new Date(ref.getFullYear(), ref.getMonth(), e.day);
      if (f >= hoy && f <= lim) out.push({ ...e, fecha: f });
    });
  }
  return out.sort((a, b) => a.fecha - b.fecha);
}
function proximaFecha(ancla, frec) {
  const hoy = hoyD();
  for (let i = 0; i < 14; i++) {
    const ref = mesIni(hoy, i);
    const f = ocurrenciasMes(ancla, frec, ref.getFullYear(), ref.getMonth())
      .map(d => new Date(ref.getFullYear(), ref.getMonth(), d)).find(x => x >= hoy);
    if (f) return f;
  }
  return null;
}
// Enlace para pasar el evento a Google Calendar (con repetición)
function gcalUrl(e, fecha) {
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.txt, details: [e.monto ? 'Monto: ' + money(e.monto) : '', 'Desde Mis Finanzas'].filter(Boolean).join('\n') });
  const d = iso(fecha).replace(/-/g, '');
  if (e.hora) { const h = String(e.hora).slice(0, 5).replace(':', ''); const fin = String(Number(h.slice(0, 2)) + 1).padStart(2, '0') + h.slice(2); p.set('dates', `${d}T${h}00/${d}T${fin.slice(0, 4)}00`); }
  else p.set('dates', `${d}/${iso(addDays(fecha, 1)).replace(/-/g, '')}`);
  const rr = { semanal: 'FREQ=WEEKLY', quincenal: 'FREQ=WEEKLY;INTERVAL=2', mensual: 'FREQ=MONTHLY', anual: 'FREQ=YEARLY' }[e.repetir];
  if (rr) p.set('recur', 'RRULE:' + rr);
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}

/* ---------- Cálculos financieros ---------- */
function liquidacion(d) {
  let saldo = Number(d.saldo) || 0;
  const pago = mensualEq(d.pago_minimo, d.frecuencia || 'mensual');
  const r = (Number(d.tasa_anual) || 0) / 100 / 12;
  if (saldo <= 0) return { meses: 0, interes: 0 };
  if (pago <= 0 || pago <= saldo * r) return { meses: Infinity, interes: Infinity };
  let m = 0, int = 0;
  while (saldo > 0.01 && m < 600) { const i = saldo * r; int += i; saldo = saldo + i - pago; m++; }
  return { meses: m, interes: int };
}
const duracion = m => m === Infinity ? 'Nunca con este pago' : m === 0 ? 'Liquidada'
  : m < 12 ? `${m} ${m === 1 ? 'mes' : 'meses'}` : `${Math.floor(m / 12)} a ${m % 12} m`;

function totalesMes(off = 0) {
  const a = mesIni(new Date(), off), b = mesIni(new Date(), off + 1);
  return { ing: sum(S.ingresos.filter(enRango(a, b))), gas: sum(S.gastos.filter(enRango(a, b))) };
}
function promedios() {
  const ms = [1, 2, 3].map(i => totalesMes(-i)).filter(t => t.ing > 0 || t.gas > 0);
  const act = totalesMes(0);
  if (!ms.length) return { ing: act.ing, gas: act.gas, neto: act.ing - act.gas };
  const ing = sum(ms, 'ing') / ms.length, gas = sum(ms, 'gas') / ms.length;
  return { ing: Math.max(ing, act.ing), gas, neto: ing - gas };
}
// Saldo de cada miembro del grupo: positivo = le deben, negativo = debe
function balances(gid) {
  const bal = {};
  miembrosDe(gid).forEach(m => { bal[m.user_id] = 0; });
  R.gastos.filter(g => g.grupo_id === gid).forEach(g => {
    const p = participantesDe(g), total = Number(g.monto) || 0, quien = g.pagado_por || g.user_id;
    if (!p.length) return;
    bal[quien] = (bal[quien] || 0) + total;
    p.forEach(u => { bal[u] = (bal[u] || 0) - total / p.length; });
  });
  R.liquidaciones.filter(l => l.grupo_id === gid).forEach(l => {
    bal[l.de] = (bal[l.de] || 0) + Number(l.monto);
    bal[l.para] = (bal[l.para] || 0) - Number(l.monto);
  });
  return bal;
}
// Mínimo de pagos para quedar a mano
function simplificar(bal) {
  const cred = [], deb = [];
  Object.entries(bal).forEach(([u, v]) => { v = Math.round(v * 100) / 100; if (v > 0.009) cred.push({ u, v }); else if (v < -0.009) deb.push({ u, v: -v }); });
  cred.sort((a, b) => b.v - a.v); deb.sort((a, b) => b.v - a.v);
  const out = []; let i = 0, j = 0;
  while (i < deb.length && j < cred.length) {
    const m = Math.min(deb[i].v, cred[j].v);
    out.push({ de: deb[i].u, para: cred[j].u, monto: Math.round(m * 100) / 100 });
    deb[i].v -= m; cred[j].v -= m;
    if (deb[i].v < 0.01) i++; if (cred[j].v < 0.01) j++;
  }
  return out;
}

/* ---------- Detector de fugas ---------- */
function detectarFugas() {
  const f = [];
  const a = mesIni(), b = mesIni(new Date(), 1);
  const gm = S.gastos.filter(enRango(a, b));
  const totalG = sum(gm);
  const { ing: ingRef, neto: netoRef } = promedios();
  const mesNombre = MESES[a.getMonth()];

  const hormiga = gm.filter(g => !g.grupo_id && Number(g.monto) <= 150 && !['Pago de deuda', 'Renta / vivienda'].includes(g.categoria));
  const sh = sum(hormiga);
  if (hormiga.length >= 8 || (totalG > 0 && sh / totalG >= 0.12))
    f.push({ nivel: sh / Math.max(totalG, 1) > 0.2 ? 'alta' : 'media', titulo: 'Gastos hormiga',
      detalle: `${hormiga.length} gastos pequeños en ${mesNombre} suman ${money(sh)} (${pct(sh, totalG)}% de tus gastos).`, ahorro: sh * 0.5 });

  S.recurrentes.filter(r => r.en_uso === false).forEach(r => {
    const mm = mensualEq(r.monto, r.frecuencia);
    f.push({ nivel: 'alta', titulo: `Pagas "${r.nombre}" y no lo usas`, detalle: `Te cuesta ${money(mm)} al mes, ${money(mm * 12)} al año.`, ahorro: mm });
  });

  const fijos = S.recurrentes.reduce((s, r) => s + mensualEq(r.monto, r.frecuencia), 0);
  if (ingRef > 0 && fijos / ingRef > 0.5)
    f.push({ nivel: 'media', titulo: 'Gastos fijos muy altos', detalle: `Tus fijos (${money(fijos)}/mes) se comen el ${pct(fijos, ingRef)}% de tu ingreso. Lo sano es menos de 50%.` });

  const activas = S.deudas.filter(d => Number(d.saldo) > 0);
  activas.filter(d => Number(d.tasa_anual) >= 60).forEach(d => {
    const im = Number(d.saldo) * Number(d.tasa_anual) / 100 / 12;
    f.push({ nivel: 'alta', titulo: `Deuda cara: ${d.acreedor}`, detalle: `Tasa ${d.tasa_anual}% anual. Solo en intereses pagas ≈ ${money(im)} al mes. Prioriza liquidarla.`, ahorro: im });
  });
  activas.filter(d => liquidacion(d).meses === Infinity).forEach(d =>
    f.push({ nivel: 'alta', titulo: `${d.acreedor}: tu pago no alcanza`, detalle: 'Con el pago actual los intereses son mayores que el abono; la deuda nunca baja. Sube el pago o renegocia.' }));

  const pagosDeuda = activas.reduce((s, d) => s + mensualEq(d.pago_minimo, d.frecuencia), 0);
  if (ingRef > 0 && pagosDeuda / ingRef > 0.3)
    f.push({ nivel: pagosDeuda / ingRef > 0.45 ? 'alta' : 'media', titulo: 'Mucho ingreso comprometido en deudas',
      detalle: `Pagas ${money(pagosDeuda)}/mes en deudas: ${pct(pagosDeuda, ingRef)}% de tu ingreso (lo recomendable es menos de 30%).` });

  const com = sum(gm.filter(g => g.categoria === 'Comisiones / intereses'));
  if (com > 0) f.push({ nivel: 'media', titulo: 'Pagaste comisiones o intereses', detalle: `${money(com)} en ${mesNombre}. Revisa pagos tardíos, retiros en cajeros ajenos o anualidades.`, ahorro: com });

  S.presupuestos.forEach(p => {
    const g = sum(gm.filter(x => x.categoria === p.categoria));
    if (g > p.limite_mensual) f.push({ nivel: 'media', titulo: `Te pasaste en ${p.categoria}`, detalle: `Llevas ${money(g)} de un límite de ${money(p.limite_mensual)}.`, ahorro: g - p.limite_mensual });
  });

  const hace60 = addDays(hoyD(), -60), nombresFijos = S.recurrentes.map(r => r.nombre.toLowerCase());
  const conteo = {};
  S.gastos.filter(g => !g.grupo_id).filter(enRango(hace60, addDays(hoyD(), 1))).forEach(g => {
    const k = (g.concepto || '').trim().toLowerCase(); if (!k) return;
    (conteo[k] ||= { n: 0, total: 0, nombre: g.concepto }); conteo[k].n++; conteo[k].total += Number(g.monto) || 0;
  });
  Object.entries(conteo).filter(([k, v]) => v.n >= 4 && !nombresFijos.some(n => k.includes(n) || n.includes(k)))
    .sort((x, y) => y[1].total - x[1].total).slice(0, 3)
    .forEach(([, v]) => f.push({ nivel: 'baja', titulo: `"${v.nombre}" se repite mucho`, detalle: `${v.n} veces en 60 días, ${money(v.total)} en total. ¿Vale la pena?` }));

  // Dinero que te deben tus compañeros y lleva tiempo sin cobrarse
  misGrupos().forEach(g => {
    const mio = balances(g.id)[ME] || 0;
    if (mio > 300) f.push({ nivel: 'baja', titulo: `Te deben ${money(mio)} en ${g.nombre}`, detalle: 'Es dinero tuyo prestado sin intereses. Cóbralo y registra el pago en la pestaña Grupo.' });
  });

  const act = totalesMes(0);
  if (act.gas > act.ing && act.gas > 0)
    f.push({ nivel: 'alta', titulo: `Gastas más de lo que ganas en ${mesNombre}`, detalle: `Te faltan ${money(act.gas - act.ing)} para cubrir lo gastado.` });

  S.metas.forEach(m => {
    const lim = parse(m.fecha_limite), falta = m.objetivo - m.ahorrado;
    if (!lim || falta <= 0) return;
    const meses = Math.max(1, (lim.getFullYear() - a.getFullYear()) * 12 + lim.getMonth() - a.getMonth());
    const req = falta / meses / (m.grupo_id ? Math.max(1, miembrosDe(m.grupo_id).length) : 1);
    if (req > Math.max(netoRef, 0)) f.push({ nivel: 'media', titulo: `Meta "${m.nombre}" en riesgo`,
      detalle: `Necesitas aportar ${money(req)}/mes${m.grupo_id ? ' (tu parte)' : ''} y tu sobrante promedio es ${money(Math.max(netoRef, 0))}.` });
  });

  const orden = { alta: 0, media: 1, baja: 2 };
  return f.sort((x, y) => orden[x.nivel] - orden[y.nivel]);
}

/* ---------- Gráficas ---------- */
const charts = {};
function dibujar(id, config) {
  charts[id]?.destroy();
  const c = document.getElementById(id);
  if (!c || !window.Chart) return;
  Chart.defaults.color = css('--muted');
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.borderColor = css('--line');
  charts[id] = new Chart(c, config);
}
function serie(tipo) {
  const labels = [], ing = [], gas = [];
  if (tipo === 'semanas') {
    let s = addDays(startOfWeek(new Date()), -7 * 7);
    for (let i = 0; i < 8; i++) {
      const e = addDays(s, 7);
      labels.push(fCorta(s)); ing.push(sum(S.ingresos.filter(enRango(s, e)))); gas.push(sum(S.gastos.filter(enRango(s, e)))); s = e;
    }
  } else {
    for (let i = -5; i <= 0; i++) {
      const s = mesIni(new Date(), i), t = totalesMes(i);
      labels.push(MESES[s.getMonth()].slice(0, 3)); ing.push(t.ing); gas.push(t.gas);
    }
  }
  return { labels, ing, gas };
}

/* ---------- Vistas ---------- */
let tab = 'resumen', vistaSerie = 'semanas', movTipo = 'gastos', movMes = today().slice(0, 7), grupoSel = null;
let agY = new Date().getFullYear(), agM = new Date().getMonth(), agSel = null;

const vacio = (txt, tipo, pre) => `<div class="empty">${txt}${tipo ? `<br><br><button class="btn primary small" data-act="nuevo" data-t="${tipo}"${pre ? ` data-g="${pre}"` : ''}><i class="bi bi-plus-lg" aria-hidden="true"></i>Agregar</button>` : ''}</div>`;
const etiquetaGrupo = gid => gid ? ` <span class="badge grupo"><i class="bi bi-people-fill" aria-hidden="true"></i>${esc(nombreGrupo(gid))}</span>` : '';

function vResumen() {
  const hoy = new Date(), sw = startOfWeek(hoy), ew = addDays(sw, 7), sm = mesIni(), em = mesIni(hoy, 1);
  const iw = sum(S.ingresos.filter(enRango(sw, ew))), gw = sum(S.gastos.filter(enRango(sw, ew)));
  const im = sum(S.ingresos.filter(enRango(sm, em))), gm = sum(S.gastos.filter(enRango(sm, em)));
  const deuda = sum(S.deudas, 'saldo');
  const fijos = S.recurrentes.reduce((s, r) => s + mensualEq(r.monto, r.frecuencia), 0);
  const ahorrado = sum(S.metas.filter(m => !m.grupo_id), 'ahorrado');
  const fugas = detectarFugas(), prox = proximos(14);
  const potencial = fugas.reduce((s, x) => s + (x.ahorro || 0), 0);
  const gs = misGrupos(), saldoGrupos = gs.reduce((s, g) => s + (balances(g.id)[ME] || 0), 0);

  const periodo = (titulo, i, g) => `
    <div class="card periodo"><h3>${titulo}</h3>
      <div class="fila"><span>Ingresos</span><b class="pos">${money(i)}</b></div>
      <div class="fila"><span>Gastos (tu parte)</span><b class="neg">${money(g)}</b></div>
      <div class="fila neto"><span>Te queda</span><span class="${i - g >= 0 ? 'pos' : 'neg'}">${money(i - g)}</span></div>
    </div>`;

  return `
  <div class="grid grid-cols-1 gap-3 md:grid-cols-2" id="t-periodos">
    ${periodo(`Esta semana · ${fCorta(sw)} – ${fCorta(addDays(sw, 6))}`, iw, gw)}
    ${periodo(`Este mes · ${MESES[hoy.getMonth()]}`, im, gm)}
  </div>
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4 section" id="t-kpis">
    <div class="card kpi"><span>Deuda total</span><b class="${deuda > 0 ? 'neg' : ''}">${money(deuda)}</b><small>${S.deudas.filter(d => d.saldo > 0).length} activas</small></div>
    <div class="card kpi"><span>Gastos fijos / mes</span><b>${money(fijos)}</b><small>${money(fijos * 12)} al año</small></div>
    ${gs.length ? `<div class="card kpi clickable" data-act="tab" data-v="grupo"><span>Con tus roomies</span><b class="${saldoGrupos >= 0 ? 'pos' : 'neg'}">${saldoGrupos >= 0 ? 'Te deben ' : 'Debes '}${money(Math.abs(saldoGrupos))}</b><small>${gs.length} grupo${gs.length > 1 ? 's' : ''}</small></div>`
      : `<div class="card kpi"><span>Ahorrado en metas</span><b class="pos">${money(ahorrado)}</b><small>${S.metas.length} metas</small></div>`}
    <div class="card kpi"><span>Tasa de ahorro del mes</span><b>${im > 0 ? pct(im - gm, im) : 0}%</b><small>Ideal: 10–20% o más</small></div>
  </div>

  <div class="grid grid-cols-1 gap-3 md:grid-cols-2 section">
    <div class="card" id="t-grafica">
      <div class="section-head"><h2>Ingresos vs gastos</h2>
        <div class="seg"><button data-act="serie" data-v="semanas" class="${vistaSerie === 'semanas' ? 'on' : ''}">Semanas</button><button data-act="serie" data-v="meses" class="${vistaSerie === 'meses' ? 'on' : ''}">Meses</button></div>
      </div>
      <div class="chart-box"><canvas id="ch-serie"></canvas></div>
    </div>
    <div class="card">
      <div class="section-head"><h2>¿En qué se va? (${MESES[hoy.getMonth()]})</h2></div>
      <div class="chart-box">${gm > 0 ? '<canvas id="ch-cat"></canvas>' : '<div class="empty">Sin gastos este mes</div>'}</div>
    </div>
  </div>

  <div class="section" id="t-fugas">
    <div class="section-head"><h2>Fugas detectadas</h2>${potencial > 0 ? `<span class="badge ok">Podrías liberar ≈ ${money(potencial)}/mes</span>` : ''}</div>
    <div class="list">${fugas.length ? fugas.map(x => `
      <div class="fuga ${x.nivel}"><div><b>${esc(x.titulo)}</b><p>${esc(x.detalle)}</p></div>
      ${x.ahorro ? `<div class="ahorro">ahorro posible<strong>${money(x.ahorro)}</strong>al mes</div>` : ''}</div>`).join('')
      : vacio('No hay fugas detectadas. Entre más registres, mejor te puedo avisar.')}</div>
  </div>

  <div class="section" id="t-proximos">
    <div class="section-head"><h2>Próximos 14 días</h2><span class="muted small">${money(sum(prox.filter(p => !p.info)))} por pagar</span></div>
    <div class="list">${prox.length ? prox.map(p => itemEvento(p, p.fecha)).join('')
      : vacio('Nada programado. Agrega deudas, gastos fijos o eventos para verlos aquí.')}</div>
  </div>`;
}
function dibujarResumen() {
  const s = serie(vistaSerie);
  dibujar('ch-serie', { type: 'bar', data: { labels: s.labels, datasets: [
    { label: 'Ingresos', data: s.ing, backgroundColor: css('--ok'), borderRadius: 4 },
    { label: 'Gastos', data: s.gas, backgroundColor: css('--bad'), borderRadius: 4 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${money(c.raw)}` } } },
      scales: { y: { ticks: { callback: v => '$' + Number(v).toLocaleString('es-MX') } }, x: { grid: { display: false } } } } });

  const gm = S.gastos.filter(enRango(mesIni(), mesIni(new Date(), 1)));
  const porCat = {};
  gm.forEach(g => { const k = g.categoria || 'Otro'; porCat[k] = (porCat[k] || 0) + Number(g.monto); });
  const ord = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const top = ord.slice(0, 5); const resto = ord.slice(5).reduce((s, x) => s + x[1], 0);
  if (resto > 0) top.push(['Otras', resto]);
  const colores = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'].map(css);
  dibujar('ch-cat', { type: 'doughnut', data: { labels: top.map(x => x[0]), datasets: [{ data: top.map(x => x[1]), backgroundColor: colores, borderColor: css('--surface'), borderWidth: 2 }] },
    options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right', labels: { boxWidth: 10 } },
      tooltip: { callbacks: { label: c => `${c.label}: ${money(c.raw)}` } } } } });
}

function vMovimientos() {
  const rows = S[movTipo].filter(r => (r.fecha || '').startsWith(movMes)).sort(porFecha);
  const total = sum(rows);
  const grupos = {};
  rows.forEach(r => { const k = iso(startOfWeek(parse(r.fecha))); (grupos[k] ||= []).push(r); });
  const det = r => movTipo === 'gastos'
    ? `${esc(r.categoria || 'Sin categoría')}${r.grupo_id ? ` · <i class="bi bi-people-fill" aria-hidden="true"></i> tu parte de ${money(r.total)} · pagó ${esc(aliasDe(r.pagado_por || r.user_id, r.grupo_id))}` : ''}`
    : esc(r.fuente || '');
  return `
  <div class="section-head">
    <div class="seg" id="t-movtipo"><button data-act="movtipo" data-v="gastos" class="${movTipo === 'gastos' ? 'on' : ''}">Gastos</button><button data-act="movtipo" data-v="ingresos" class="${movTipo === 'ingresos' ? 'on' : ''}">Ingresos</button></div>
    <input type="month" id="mov-mes" value="${movMes}" style="width:auto;margin:0">
  </div>
  <div class="card kpi"><span>Total de ${movTipo} en ${MESES[Number(movMes.slice(5)) - 1]}${movTipo === 'gastos' ? ' (tu parte)' : ''}</span><b class="${movTipo === 'gastos' ? 'neg' : 'pos'}">${money(total)}</b><small>${rows.length} registros</small></div>
  ${rows.length ? Object.entries(grupos).map(([sem, rs]) => `
    <div class="section"><div class="section-head"><h2 class="muted small">Semana del ${fCorta(sem)}</h2><span class="muted small">${money(sum(rs))}</span></div>
    <div class="list">${rs.map(r => `
      <button class="item" data-act="edit" data-t="${movTipo}" data-id="${r.id}">
        <div class="main"><b>${esc(r.concepto)}</b><small>${fLarga(r.fecha)} · ${det(r)}${clip(movTipo, r.id)}</small></div>
        <span class="amt ${movTipo === 'gastos' ? 'neg' : 'pos'}">${movTipo === 'gastos' ? '−' : '+'}${money(r.monto)}</span></button>`).join('')}</div></div>`).join('')
    : `<div class="section">${vacio(`No hay ${movTipo} en este mes.`, movTipo)}</div>`}`;
}

function vDeudas() {
  const act = S.deudas.filter(d => Number(d.saldo) > 0).sort((a, b) => (Number(b.tasa_anual) || 0) - (Number(a.tasa_anual) || 0));
  const pagadas = S.deudas.filter(d => !(Number(d.saldo) > 0));
  const total = sum(act, 'saldo');
  const pagoMes = act.reduce((s, d) => s + mensualEq(d.pago_minimo, d.frecuencia), 0);
  const intMes = act.reduce((s, d) => s + Number(d.saldo) * (Number(d.tasa_anual) || 0) / 100 / 12, 0);
  const card = (d, i) => {
    const l = liquidacion(d), prox = proximaFecha(d.proximo_pago, d.frecuencia || 'mensual');
    const avance = d.monto_original > 0 ? Math.min(100, pct(d.monto_original - d.saldo, d.monto_original)) : null;
    return `<div class="card dcard">
      <div class="top"><div><b>${esc(d.acreedor)}</b><div class="muted small">${esc(d.tipo || '')}${clip('deudas', d.id)}</div></div>
        ${i === 0 && act.length > 1 ? '<span class="badge bad">Paga esta primero</span>' : ''}${Number(d.saldo) <= 0 ? '<span class="badge ok">Liquidada</span>' : ''}</div>
      <div class="saldo">${money(d.saldo)}</div>
      ${avance !== null ? `<div class="bar"><i style="width:${avance}%"></i></div><small class="muted">Llevas pagado ${avance}% de ${money(d.monto_original)}</small>` : ''}
      <div class="meta-row">
        <div><span>Pago ${esc(d.frecuencia || 'mensual')}</span>${money(d.pago_minimo)}</div>
        <div><span>Próximo pago</span>${prox ? fLarga(prox) : '—'}</div>
        <div><span>Tasa anual</span>${Number(d.tasa_anual) || 0}%</div>
        <div><span>Intereses / mes ≈</span>${money(Number(d.saldo) * (Number(d.tasa_anual) || 0) / 1200)}</div>
        <div><span>La terminas en</span>${duracion(l.meses)}</div>
        <div><span>Intereses totales ≈</span>${l.interes === Infinity ? '∞' : money(l.interes)}</div>
      </div>
      <div class="actions">${Number(d.saldo) > 0 ? `<button class="btn primary small" data-act="abonar" data-id="${d.id}">Abonar</button>` : ''}<button class="btn ghost small" data-act="edit" data-t="deudas" data-id="${d.id}">Editar</button></div>
    </div>`;
  };
  return `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" id="t-deudas-kpis">
    <div class="card kpi"><span>Debes en total</span><b class="neg">${money(total)}</b></div>
    <div class="card kpi"><span>Pagos al mes</span><b>${money(pagoMes)}</b></div>
    <div class="card kpi"><span>Intereses al mes ≈</span><b class="neg">${money(intMes)}</b><small>dinero que se va sin bajar la deuda</small></div>
    <div class="card kpi"><span>Deudas activas</span><b>${act.length}</b></div>
  </div>
  ${act.length > 1 ? `<p class="muted small section">Estrategia <b>avalancha</b>: paga el mínimo en todas y todo lo extra a la de tasa más alta (están ordenadas así). Es la forma de pagar menos intereses.</p>` : ''}
  <div class="grid grid-cols-1 gap-3 md:grid-cols-2 section">${act.map(card).join('') || vacio('Sin deudas registradas. Agrega las de apps, tarjetas o tiendas. Tus deudas siempre son privadas.', 'deudas')}</div>
  ${pagadas.length ? `<div class="section"><h2 class="section-head"><i class="bi bi-trophy text-ok" aria-hidden="true"></i> Liquidadas</h2><div class="grid grid-cols-1 gap-3 md:grid-cols-2">${pagadas.map(card).join('')}</div></div>` : ''}`;
}

function vFijos() {
  const rows = [...S.recurrentes].sort((a, b) => mensualEq(b.monto, b.frecuencia) - mensualEq(a.monto, a.frecuencia));
  const total = rows.reduce((s, r) => s + mensualEq(r.monto, r.frecuencia), 0);
  const sinUso = rows.filter(r => r.en_uso === false).reduce((s, r) => s + mensualEq(r.monto, r.frecuencia), 0);
  return `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" id="t-fijos-kpis">
    <div class="card kpi"><span>Fijos al mes (tu parte)</span><b>${money(total)}</b></div>
    <div class="card kpi"><span>Al año</span><b>${money(total * 12)}</b></div>
    <div class="card kpi"><span>Pagas sin usar</span><b class="${sinUso ? 'neg' : ''}">${money(sinUso)}</b><small>al mes</small></div>
    <div class="card kpi"><span>Cargos</span><b>${rows.length}</b></div>
  </div>
  <p class="muted small section">Marca “no lo uso” en lo que pagas por costumbre; aparecerá como fuga en tu resumen. Si compartes renta o internet, elige el grupo y se divide solo.</p>
  <div class="list">${rows.map(r => {
    const prox = proximaFecha(r.proximo_cobro, r.frecuencia);
    return `<div class="item" data-act="edit" data-t="recurrentes" data-id="${r.id}">
      <div class="main"><b>${esc(r.nombre)}${etiquetaGrupo(r.grupo_id)}</b><small>${money(r.total)} ${esc(r.frecuencia)}${r.grupo_id ? ` · tu parte ${money(r.monto)}` : ''} · próximo ${prox ? fCorta(prox) : '—'}</small></div>
      ${esMio(r) ? `<button class="badge ${r.en_uso === false ? 'bad' : 'ok'}" style="border:0;cursor:pointer" data-act="uso" data-id="${r.id}">${r.en_uso === false ? 'No lo uso' : 'Lo uso'}</button>` : ''}
      <span class="amt">${money(mensualEq(r.monto, r.frecuencia))}<small class="muted">/mes</small></span></div>`;
  }).join('') || vacio('Agrega renta, servicios, plan de celular, streaming, gimnasio…', 'recurrentes')}</div>`;
}

function vMetas() {
  const { neto } = promedios();
  const metas = S.metas.map(m => {
    const falta = Math.max(0, m.objetivo - m.ahorrado), p = Math.min(100, pct(m.ahorrado, m.objetivo));
    const lim = parse(m.fecha_limite), n = m.grupo_id ? Math.max(1, miembrosDe(m.grupo_id).length) : 1;
    const meses = lim ? Math.max(1, (lim.getFullYear() - new Date().getFullYear()) * 12 + lim.getMonth() - new Date().getMonth()) : null;
    const req = meses ? falta / meses : null;
    const ritmo = neto > 0 ? Math.ceil(falta / n / neto) : Infinity;
    return `<div class="card dcard">
      <div class="top"><b>${esc(m.nombre)}${etiquetaGrupo(m.grupo_id)}</b>${falta <= 0 ? '<span class="badge ok">¡Lograda!</span>' : req !== null ? `<span class="badge ${req / n > neto ? 'bad' : 'ok'}">${req / n > neto ? 'En riesgo' : 'A tiempo'}</span>` : ''}</div>
      <div class="saldo">${money(m.ahorrado)} <small class="muted" style="font-size:.9rem;font-weight:500">de ${money(m.objetivo)}</small></div>
      <div class="bar"><i style="width:${p}%"></i></div>
      <div class="meta-row">
        <div><span>Falta</span>${money(falta)}</div>
        <div><span>Fecha objetivo</span>${lim ? fLarga(lim) : 'Sin fecha'}</div>
        ${req !== null ? `<div><span>Ahorrar al mes${n > 1 ? ' (c/u)' : ''}</span>${money(req / n)}</div><div><span>Por semana${n > 1 ? ' (c/u)' : ''}</span>${money(req / n * 12 / 52)}</div>` : ''}
        <div><span>A tu ritmo actual</span>${falta <= 0 ? '—' : ritmo === Infinity ? 'Sin sobrante para ahorrar' : duracion(ritmo)}</div>
      </div>
      <div class="actions">${falta > 0 ? `<button class="btn primary small" data-act="aportar" data-id="${m.id}">Aportar</button>` : ''}<button class="btn ghost small" data-act="edit" data-t="metas" data-id="${m.id}">${puedeEditar('metas', m) ? 'Editar' : 'Ver'}</button></div>
    </div>`;
  });
  const gm = S.gastos.filter(enRango(mesIni(), mesIni(new Date(), 1)));
  const pres = S.presupuestos.map(p => {
    const g = sum(gm.filter(x => x.categoria === p.categoria)), pp = pct(g, p.limite_mensual);
    return `<div class="item" data-act="edit" data-t="presupuestos" data-id="${p.id}"><div class="main"><b>${esc(p.categoria)}</b>
      <div class="bar ${pp > 100 ? 'over' : ''}" style="margin:6px 0"><i style="width:${Math.min(pp, 100)}%"></i></div>
      <small>${money(g)} de ${money(p.limite_mensual)} · ${pp > 100 ? 'te pasaste' : 'quedan ' + money(p.limite_mensual - g)}</small></div><span class="amt">${pp}%</span></div>`;
  });
  return `
  <div class="card kpi" id="t-sobrante"><span>Tu sobrante promedio al mes (ingresos − gastos)</span><b class="${neto >= 0 ? 'pos' : 'neg'}">${money(neto)}</b><small>Con esto se calcula cuándo llegas a cada meta.</small></div>
  <div class="section" id="t-metas"><div class="section-head"><h2>Metas a largo plazo</h2><button class="btn ghost small" data-act="nuevo" data-t="metas"><i class="bi bi-plus-lg" aria-hidden="true"></i>Meta</button></div>
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">${metas.join('') || vacio('Crea tu primera meta: fondo de emergencia (3 meses de gastos), algo que quieras comprar, un viaje…', 'metas')}</div></div>
  <div class="section" id="t-presupuestos"><div class="section-head"><h2>Presupuestos de ${MESES[new Date().getMonth()]}</h2><button class="btn ghost small" data-act="nuevo" data-t="presupuestos"><i class="bi bi-plus-lg" aria-hidden="true"></i>Presupuesto</button></div>
    <div class="list">${pres.join('') || vacio('Ponle un tope mensual a comida, salidas, ropa… y te aviso cuando te pases.')}</div></div>`;
}

function itemEvento(e, fecha) {
  const ic = (n, t) => `<span class="inline-flex items-center gap-1"><i class="bi bi-${n}" aria-hidden="true"></i>${esc(t)}</span>`;
  const sub = [esc(fLarga(fecha)), e.hora ? ic('clock', String(e.hora).slice(0, 5)) : '', e.etiqueta && e.etiqueta !== 'Recordatorio' ? esc(e.etiqueta) : '',
    e.grupo ? ic('people-fill', nombreGrupo(e.grupo)) : '', e.de ? esc('de ' + e.de) : '', e.sinUso ? '<span class="text-bad">no lo usas</span>' : '',
    e.repetir && e.repetir !== 'no se repite' ? ic('arrow-repeat', e.repetir) : ''].filter(Boolean).join(' · ');
  return `<div class="item" ${e.ref ? `data-act="edit" data-t="${e.ref.t}" data-id="${e.ref.id}"` : ''}><i class="dot t-${e.tipo}"></i>
    <div class="main"><b>${esc(e.txt)}</b><small class="flex flex-wrap items-center gap-x-1">${sub}${e.ref ? clip(e.ref.t, e.ref.id) : ''}</small></div>
    ${e.monto ? `<span class="amt">${money(e.monto)}</span>` : ''}
    <a class="gcal" data-act="link" href="${gcalUrl(e, fecha)}" target="_blank" rel="noopener" title="Agregar a Google Calendar" aria-label="Agregar a Google Calendar"><i class="bi bi-calendar-plus" aria-hidden="true"></i><span class="hidden sm:inline">Google</span></a></div>`;
}

function vAgenda() {
  const ev = eventosMes(agY, agM), dim = new Date(agY, agM + 1, 0).getDate(), off = (new Date(agY, agM, 1).getDay() + 6) % 7;
  const hoy = today();
  const movs = d => [...S.ingresos.filter(x => x.fecha === d).map(x => ({ ...x, tipo: 'ingreso' })), ...S.gastos.filter(x => x.fecha === d).map(x => ({ ...x, tipo: 'gasto' }))];
  let celdas = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<div class="dow">${d}</div>`).join('') + '<div></div>'.repeat(off);
  for (let d = 1; d <= dim; d++) {
    const f = `${agY}-${pad(agM + 1)}-${pad(d)}`;
    const tipos = [...new Set([...ev.filter(e => e.day === d).map(e => e.tipo), ...movs(f).map(m => m.tipo)])];
    celdas += `<button class="day ${f === hoy ? 'hoy' : ''} ${agSel === d ? 'sel' : ''}" data-act="dia" data-v="${d}" aria-label="${d} de ${MESES[agM]}">${d}<span class="dots">${tipos.slice(0, 4).map(t => `<i class="t-${t}"></i>`).join('')}</span></button>`;
  }
  const lista = agSel ? ev.filter(e => e.day === agSel) : ev;
  const fSel = agSel ? `${agY}-${pad(agM + 1)}-${pad(agSel)}` : null;
  const reales = fSel ? movs(fSel) : [];
  const porPagar = sum(ev.filter(e => !e.info));
  return `
  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
    <div class="card">
      <div class="cal-head"><button class="btn ghost small" data-act="mes" data-v="-1" aria-label="Mes anterior"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
        <h2>${MESES[agM]} ${agY}</h2>
        <div class="actions"><button class="btn ghost small" data-act="mes" data-v="0">Hoy</button><button class="btn ghost small" data-act="mes" data-v="1" aria-label="Mes siguiente"><i class="bi bi-chevron-right" aria-hidden="true"></i></button></div></div>
      <div class="cal" id="t-cal">${celdas}</div>
      <div class="leyenda"><span><i class="t-deuda"></i>Deuda</span><span><i class="t-fijo"></i>Fijo</span><span><i class="t-evento"></i>Evento</span><span><i class="t-meta"></i>Meta</span><span><i class="t-gasto"></i>Gasto</span><span><i class="t-ingreso"></i>Ingreso</span></div>
    </div>
    <div>
      <div class="card kpi"><span>Programado por pagar en ${MESES[agM]} (tu parte)</span><b>${money(porPagar)}</b><small>deudas + fijos + eventos tipo pago</small></div>
      <div class="section"><div class="section-head"><h2>${agSel ? `${fLarga(fSel)}` : 'Todo el mes'}</h2>
        <div class="actions">${agSel ? '<button class="btn ghost small" data-act="dia" data-v="0">Ver mes</button>' : ''}<button class="btn primary small" data-act="nuevo-evento" data-v="${fSel || ''}"><i class="bi bi-calendar-plus" aria-hidden="true"></i>Evento</button></div></div>
      <div class="list">
        ${lista.map(e => itemEvento(e, new Date(agY, agM, e.day))).join('')}
        ${reales.map(m => `<button class="item" data-act="edit" data-t="${m.tipo === 'ingreso' ? 'ingresos' : 'gastos'}" data-id="${m.id}"><i class="dot t-${m.tipo}"></i><div class="main"><b>${esc(m.concepto)}</b><small>${m.tipo} registrado${m.grupo_id ? ' · <i class="bi bi-people-fill" aria-hidden="true"></i> ' + esc(nombreGrupo(m.grupo_id)) : ''}${clip(m.tipo === 'ingreso' ? 'ingresos' : 'gastos', m.id)}</small></div><span class="amt ${m.tipo === 'ingreso' ? 'pos' : 'neg'}">${money(m.monto)}</span></button>`).join('')}
        ${!lista.length && !reales.length ? vacio(agSel ? 'Nada en este día.' : 'Nada programado este mes.') : ''}
      </div></div>
    </div>
  </div>`;
}

function vGrupo() {
  const gs = misGrupos();
  const intro = `<div class="card intro">
    <h2>Comparte gastos con tus roomies</h2>
    <p class="muted">Crea un grupo y pásales el código. Cada quien decide qué compartir: al registrar un gasto, fijo, meta o evento eliges <b>“Solo yo”</b> o el grupo. Tus ingresos y deudas nunca se comparten.</p>
    <div class="actions"><button class="btn primary" data-act="crear-grupo">Crear grupo</button><button class="btn ghost" data-act="unirse-grupo">Unirme con código</button></div>
    ${DEMO ? '<p class="small muted">Modo demo: el grupo se simula con un compañero ficticio. Para invitar a alguien de verdad configura Supabase.</p>' : ''}</div>`;
  if (!gs.length) return intro;
  if (!gs.some(g => g.id === grupoSel)) grupoSel = gs[0].id;
  const g = gs.find(x => x.id === grupoSel), ms = miembrosDe(g.id), bal = balances(g.id), pagos = simplificar(bal);
  const sm = mesIni(), em = mesIni(new Date(), 1);
  const gastosG = R.gastos.filter(x => x.grupo_id === g.id).sort(porFecha);
  const delMes = gastosG.filter(enRango(sm, em));
  const fijosG = R.recurrentes.filter(r => r.grupo_id === g.id);
  const metasG = R.metas.filter(m => m.grupo_id === g.id);
  const liqs = R.liquidaciones.filter(l => l.grupo_id === g.id).sort(porFecha);
  const evs = proximos(30).filter(e => e.grupo === g.id);
  const yo = ms.find(m => m.user_id === ME);
  const ini = s => esc((s || '?').trim().charAt(0).toUpperCase());

  return `
  ${gs.length > 1 ? `<div class="seg scroll section-head">${gs.map(x => `<button data-act="grupo-sel" data-v="${x.id}" class="${x.id === g.id ? 'on' : ''}">${esc(x.nombre)}</button>`).join('')}</div>` : ''}
  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
    <div class="card">
      <div class="section-head"><h2><i class="bi bi-people-fill text-brand" aria-hidden="true"></i> ${esc(g.nombre)}</h2><span class="badge">${ms.length} miembro${ms.length > 1 ? 's' : ''}</span></div>
      <div class="codigo"><span class="muted small">Código de invitación</span><b>${esc(g.codigo)}</b><button class="btn primary small" data-act="invitar"><i class="bi bi-share" aria-hidden="true"></i>Invitar</button></div>
      <div class="members">${ms.map(m => { const v = Math.round((bal[m.user_id] || 0) * 100) / 100; return `
        <div class="member"><span class="avatar">${ini(m.alias)}</span><div class="main"><b>${esc(aliasDe(m.user_id, g.id))}</b>${m.rol === 'admin' ? ' <small class="muted">· creó el grupo</small>' : ''}</div>
        <span class="amt small ${v > 0 ? 'pos' : v < 0 ? 'neg' : 'muted'}">${v > 0 ? 'le deben ' + money(v) : v < 0 ? 'debe ' + money(-v) : 'a mano'}</span></div>`; }).join('')}</div>
      <div class="actions"><button class="btn ghost small" data-act="mi-alias" data-id="${yo?.id || ''}"><i class="bi bi-pencil-square" aria-hidden="true"></i>Cambiar mi nombre</button><button class="btn ghost small danger" data-act="salir-grupo"><i class="bi bi-box-arrow-right" aria-hidden="true"></i>Salir del grupo</button>${DEMO ? '' : '<button class="btn ghost small" data-act="actualizar"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i>Actualizar</button>'}</div>
    </div>
    <div class="card" id="t-amano">
      <h2>Para quedar a mano</h2>
      <div class="list" style="margin-top:12px">${pagos.length ? pagos.map(p => `
        <div class="pago-sug"><div><b>${esc(aliasDe(p.de, g.id))}</b> <i class="bi bi-arrow-right text-muted" aria-hidden="true"></i> <b>${esc(aliasDe(p.para, g.id))}</b></div><b class="amt">${money(p.monto)}</b>
        ${DEMO || p.de === ME || p.para === ME ? `<button class="btn primary small" data-act="liquidar" data-de="${p.de}" data-para="${p.para}" data-monto="${p.monto}">Registrar pago</button>` : ''}</div>`).join('')
        : '<div class="empty"><i class="bi bi-check2-circle text-ok text-2xl block mb-1" aria-hidden="true"></i>Están a mano</div>'}</div>
      <p class="small muted" style="margin-top:10px">Se calcula con los gastos compartidos y los pagos entre ustedes. Adjunta el comprobante de la transferencia como evidencia.</p>
      <button class="btn ghost small" data-act="liquidar"><i class="bi bi-plus-lg" aria-hidden="true"></i>Otro pago entre compañeros</button>
    </div>
  </div>

  <div class="section" id="t-gastos-comp"><div class="section-head"><h2>Gastos compartidos · ${MESES[sm.getMonth()]}</h2><span class="muted small">Total ${money(sum(delMes))} · tu parte ${money(delMes.reduce((s, x) => s + miParte(x), 0))}</span></div>
    <div class="list">${gastosG.slice(0, 30).map(x => `
      <button class="item" data-act="edit" data-t="gastos" data-id="${x.id}"><div class="main"><b>${esc(x.concepto)}</b>
        <small>${fLarga(x.fecha)} · pagó ${esc(aliasDe(x.pagado_por || x.user_id, g.id))} · entre ${participantesDe(x).length} · tu parte ${money(miParte(x))}${clip('gastos', x.id)}</small></div>
        <span class="amt">${money(x.monto)}</span></button>`).join('') || vacio('Aún no hay gastos compartidos. Súper, luz, gas, garrafones…', 'gastos', g.id)}
    ${gastosG.length ? `<button class="btn ghost small" data-act="nuevo" data-t="gastos" data-g="${g.id}"><i class="bi bi-plus-lg" aria-hidden="true"></i>Gasto compartido</button>` : ''}</div></div>

  <div class="grid grid-cols-1 gap-3 md:grid-cols-2 section">
    <div id="t-fijos-grupo"><div class="section-head"><h2>Fijos del grupo</h2><button class="btn ghost small" data-act="nuevo" data-t="recurrentes" data-g="${g.id}"><i class="bi bi-plus-lg" aria-hidden="true"></i>Fijo</button></div>
      <div class="list">${fijosG.map(r => { const prox = proximaFecha(r.proximo_cobro, r.frecuencia); return `
        <div class="item" data-act="edit" data-t="recurrentes" data-id="${r.id}"><div class="main"><b>${esc(r.nombre)}</b>
          <small>${money(r.monto)} ${esc(r.frecuencia)} · ${money(parteFijo(r))} c/u · próximo ${prox ? fCorta(prox) : '—'}</small></div>
          <button class="btn primary small" data-act="pagar-fijo" data-id="${r.id}">Ya se pagó</button></div>`; }).join('') || '<div class="empty">Renta, internet, luz… se dividen entre todos.</div>'}</div></div>
    <div><div class="section-head"><h2>Próximos 30 días</h2><button class="btn ghost small" data-act="nuevo" data-t="eventos" data-g="${g.id}"><i class="bi bi-plus-lg" aria-hidden="true"></i>Evento</button></div>
      <div class="list">${evs.map(e => itemEvento(e, e.fecha)).join('') || '<div class="empty">Sin eventos compartidos.</div>'}</div></div>
  </div>

  ${metasG.length ? `<div class="section"><div class="section-head"><h2>Metas del grupo</h2></div><div class="list">${metasG.map(m => `
    <div class="item" data-act="edit" data-t="metas" data-id="${m.id}"><div class="main"><b>${esc(m.nombre)}</b><div class="bar" style="margin:6px 0"><i style="width:${Math.min(100, pct(m.ahorrado, m.objetivo))}%"></i></div><small>${money(m.ahorrado)} de ${money(m.objetivo)}</small></div>
    <button class="btn primary small" data-act="aportar" data-id="${m.id}">Aportar</button></div>`).join('')}</div></div>` : ''}

  <div class="section"><div class="section-head"><h2>Pagos entre ustedes</h2></div>
    <div class="list">${liqs.map(l => `
      <button class="item" data-act="edit" data-t="liquidaciones" data-id="${l.id}"><div class="main"><b>${esc(aliasDe(l.de, g.id))} le pagó a ${esc(aliasDe(l.para, g.id))}</b><small>${fLarga(l.fecha)}${l.notas ? ' · ' + esc(l.notas) : ''}${clip('liquidaciones', l.id)}</small></div>
      <span class="amt pos">${money(l.monto)}</span></button>`).join('') || '<div class="empty">Sin pagos registrados.</div>'}</div></div>

  <div class="section actions"><button class="btn ghost small" data-act="crear-grupo"><i class="bi bi-plus-lg" aria-hidden="true"></i>Crear otro grupo</button><button class="btn ghost small" data-act="unirse-grupo">Unirme a otro grupo</button></div>`;
}

const VISTAS = { resumen: vResumen, movimientos: vMovimientos, deudas: vDeudas, fijos: vFijos, metas: vMetas, agenda: vAgenda, grupo: vGrupo };
function render() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('#view').innerHTML = VISTAS[tab]();
  if (tab === 'resumen') dibujarResumen();
}

/* ---------- Acciones de grupo ---------- */
const grupoApi = {
  async crear(nombre, alias) {
    if (DEMO) {
      const g = await db.insert('grupos', { nombre, codigo: Math.random().toString(36).slice(2, 8).toUpperCase(), creado_por: ME });
      await db.insert('miembros', { grupo_id: g.id, user_id: ME, alias, rol: 'admin' });
      await db.insert('miembros', { grupo_id: g.id, user_id: DEMO_COMPA, alias: 'Compa (demo)', rol: 'miembro' });
      return g.id;
    }
    const { data, error } = await sb.rpc('crear_grupo', { p_nombre: nombre, p_alias: alias });
    if (error) throw error; return data;
  },
  async unirse(codigo, alias) {
    if (DEMO) throw new Error('En modo demo no hay otros usuarios. Configura Supabase para unirte a grupos reales.');
    const { data, error } = await sb.rpc('unirse_grupo', { p_codigo: codigo, p_alias: alias });
    if (error) throw error;
    if (!data) throw new Error('Ese código no existe. Revisa que esté bien escrito.');
    return data;
  }
};
async function invitar(g) {
  const url = location.origin + location.pathname;
  const texto = `Únete a mi grupo "${g.nombre}" en Mis Finanzas para dividir gastos.\n1) Entra a ${url} y crea tu cuenta\n2) Ve a Grupo → Unirme con código\n3) Código: ${g.codigo}`;
  try {
    if (navigator.share) await navigator.share({ title: 'Mis Finanzas', text: texto });
    else { await navigator.clipboard.writeText(texto); toast('Invitación copiada. Pégala en WhatsApp.'); }
  } catch { /* el usuario canceló */ }
}

/* ---------- Eventos de la vista ---------- */
$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-tab]'); if (!b) return;
  tab = b.dataset.tab; render(); window.scrollTo({ top: 0 });
});
$('#view').addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const { act, t, id, v } = b.dataset;
  if (act === 'link') return;          // enlaces externos (Google Calendar)
  try {
    switch (act) {
      case 'edit': { const row = rawRow(t, id); if (row) abrirForm(t, row); break; }
      case 'nuevo': abrirForm(t, null, { pre: b.dataset.g ? { grupo_id: b.dataset.g } : {} }); break;
      case 'nuevo-evento': abrirForm('eventos', null, { pre: { fecha: v || today(), ...(tab === 'grupo' && grupoSel ? { grupo_id: grupoSel } : {}) } }); break;
      case 'tab': tab = v; render(); window.scrollTo({ top: 0 }); break;
      case 'serie': vistaSerie = v; render(); break;
      case 'movtipo': movTipo = v; render(); break;
      case 'dia': agSel = Number(v) && agSel !== Number(v) ? Number(v) : null; render(); break;
      case 'mes': {
        const d = v === '0' ? new Date() : new Date(agY, agM + Number(v), 1);
        agY = d.getFullYear(); agM = d.getMonth(); agSel = v === '0' ? d.getDate() : null; render(); break;
      }
      case 'uso': { e.stopPropagation(); const r = rawRow('recurrentes', id); await db.update('recurrentes', r.id, { en_uso: r.en_uso === false }); await refrescar(); break; }
      case 'abonar': {
        const d = rawRow('deudas', id);
        abrirForm('abono', null, { titulo: 'Abono a ' + d.acreedor, custom: async x => {
          await db.update('deudas', d.id, { saldo: Math.max(0, Math.round((Number(d.saldo) - x.monto) * 100) / 100) });
          if (x.registrar_gasto) {
            const g = await db.insert('gastos', { fecha: x.fecha, concepto: 'Abono ' + d.acreedor, categoria: 'Pago de deuda', metodo: 'Transferencia', monto: x.monto, pagado_por: ME });
            return { tabla: 'gastos', id: g.id };
          }
          return { tabla: 'deudas', id: d.id };
        } });
        break;
      }
      case 'aportar': {
        e.stopPropagation();
        const m = rawRow('metas', id);
        abrirForm('aporte', null, { titulo: 'Aportar a ' + m.nombre, custom: async x => {
          await db.update('metas', m.id, { ahorrado: Math.round((Number(m.ahorrado) + x.monto) * 100) / 100 });
          return null;
        } });
        break;
      }
      // Grupo
      case 'crear-grupo':
        abrirForm('grupo_nuevo', null, { pre: { alias: MI_ALIAS }, custom: async x => { grupoSel = await grupoApi.crear(x.nombre, x.alias); tab = 'grupo'; return null; } });
        break;
      case 'unirse-grupo':
        abrirForm('grupo_unirse', null, { pre: { alias: MI_ALIAS }, custom: async x => { grupoSel = await grupoApi.unirse(x.codigo, x.alias); tab = 'grupo'; return null; } });
        break;
      case 'grupo-sel': grupoSel = v; render(); break;
      case 'invitar': invitar(R.grupos.find(g => g.id === grupoSel)); break;
      case 'actualizar': await refrescar(); toast('Actualizado'); break;
      case 'mi-alias': {
        const m = rawRow('miembros', id); if (!m) break;
        abrirForm('alias', null, { pre: { alias: m.alias }, custom: async x => { await db.update('miembros', m.id, { alias: x.alias }); return null; } });
        break;
      }
      case 'salir-grupo': {
        const g = R.grupos.find(x => x.id === grupoSel), yo = miembrosDe(grupoSel).find(m => m.user_id === ME);
        const soloYo = miembrosDe(grupoSel).filter(m => m.user_id !== DEMO_COMPA).length <= 1;
        const ok = await confirmar(soloYo
          ? { titulo: `¿Eliminar "${g.nombre}"?`, texto: 'Eres el único miembro, así que el grupo se elimina.', ok: 'Sí, eliminar', peligro: true }
          : { titulo: `¿Salir de "${g.nombre}"?`, texto: 'Dejarás de ver lo compartido ahí. Lo que tú registraste seguirá visible para el grupo.', ok: 'Sí, salir', peligro: true });
        if (!ok) break;
        if (soloYo && esMio({ user_id: g.creado_por })) await db.remove('grupos', g.id);
        else await db.remove('miembros', yo.id);
        if (DEMO && soloYo) {   // en demo no hay base de datos que limpie: lo hacemos aquí
          lsSet('miembros', lsGet('miembros').filter(m => m.grupo_id !== g.id));
          ['gastos', 'recurrentes', 'metas', 'eventos', 'adjuntos'].forEach(t => lsSet(t, lsGet(t).map(r => r.grupo_id === g.id ? { ...r, grupo_id: null, participantes: null } : r)));
          lsSet('liquidaciones', lsGet('liquidaciones').filter(l => l.grupo_id !== g.id));
        }
        grupoSel = null; await refrescar(); toast('Saliste del grupo');
        break;
      }
      case 'liquidar':
        abrirForm('liquidaciones', null, { pre: { grupo_id: grupoSel, de: b.dataset.de || ME, para: b.dataset.para || '', monto: b.dataset.monto ? Number(b.dataset.monto) : null } });
        break;
      case 'pagar-fijo': {
        e.stopPropagation();
        const r = rawRow('recurrentes', id);
        abrirForm('gastos', null, { titulo: 'Registrar pago de ' + r.nombre, pre: { concepto: r.nombre, monto: Number(r.monto), categoria: r.categoria, grupo_id: r.grupo_id, metodo: 'Transferencia' } });
        break;
      }
    }
  } catch (err) { toast('Error: ' + err.message, 4500); }
});
$('#view').addEventListener('change', e => { if (e.target.id === 'mov-mes' && e.target.value) { movMes = e.target.value; render(); } });

$('#fab').addEventListener('click', () => {
  if (tab === 'grupo') return misGrupos().length ? abrirForm('gastos', null, { pre: { grupo_id: grupoSel } }) : $('#view [data-act="crear-grupo"]')?.click();
  if (tab === 'agenda') return abrirForm('eventos', null, { pre: { fecha: agSel ? `${agY}-${pad(agM + 1)}-${pad(agSel)}` : today() } });
  const directo = { movimientos: movTipo, deudas: 'deudas', fijos: 'recurrentes', metas: 'metas' }[tab];
  directo ? abrirForm(directo) : menuRapido();
});

/* ---------- Datos de ejemplo (solo modo demo) ---------- */
async function cargarEjemplo() {
  if (!await confirmar({ titulo: '¿Cargar datos de ejemplo?', texto: 'Se agregan datos ficticios, incluido un grupo con un roomie de prueba, para que veas cómo funciona.', ok: 'Sí, cargar', icono: 'question' })) return;
  const h = hoyD(), f = n => iso(addDays(h, -n)), fut = n => iso(addDays(h, n));
  for (let s = 0; s < 10; s++) await db.insert('ingresos', { fecha: f(s * 7 + 1), concepto: 'Pago semanal', fuente: 'Sueldo', monto: 3800 + (s % 3) * 250 });
  await db.insert('ingresos', { fecha: f(9), concepto: 'Venta de bocina', fuente: 'Ventas', monto: 900 });
  const g = [['Tacos', 'Comida', 95], ['Uber', 'Transporte', 78], ['Café', 'Comida', 55], ['Gasolina', 'Gasolina', 500],
    ['Refresco y papas', 'Comida', 42], ['Recarga', 'Teléfono / internet', 100], ['Café', 'Comida', 55], ['Didi Food', 'Comida', 189], ['Comisión cajero', 'Comisiones / intereses', 35]];
  for (let i = 0; i < 34; i++) { const [c, cat, m] = g[i % g.length]; await db.insert('gastos', { fecha: f(Math.floor(i * 1.8)), concepto: c, categoria: cat, metodo: i % 2 ? 'Débito' : 'Efectivo', monto: m }); }
  await db.insert('deudas', { acreedor: 'App de préstamo', tipo: 'App de préstamo', saldo: 4200, monto_original: 6000, pago_minimo: 650, frecuencia: 'quincenal', proximo_pago: fut(4), tasa_anual: 110 });
  await db.insert('deudas', { acreedor: 'Tarjeta de crédito', tipo: 'Tarjeta de crédito', saldo: 12500, monto_original: 15000, pago_minimo: 900, frecuencia: 'mensual', proximo_pago: fut(12), tasa_anual: 62 });
  await db.insert('deudas', { acreedor: 'Tienda (celular)', tipo: 'Tienda departamental', saldo: 3100, monto_original: 5200, pago_minimo: 189, frecuencia: 'semanal', proximo_pago: fut(2), tasa_anual: 45 });
  await db.insert('recurrentes', { nombre: 'Streaming de video', monto: 219, frecuencia: 'mensual', proximo_cobro: fut(9), categoria: 'Suscripciones', en_uso: false });
  await db.insert('recurrentes', { nombre: 'Música', monto: 129, frecuencia: 'mensual', proximo_cobro: fut(15), categoria: 'Suscripciones', en_uso: true });
  await db.insert('recurrentes', { nombre: 'Gimnasio', monto: 450, frecuencia: 'mensual', proximo_cobro: fut(3), categoria: 'Salud', en_uso: true });
  await db.insert('metas', { nombre: 'Fondo de emergencia', objetivo: 25000, ahorrado: 4000, fecha_limite: fut(300) });
  await db.insert('metas', { nombre: 'Laptop', objetivo: 14000, ahorrado: 2500, fecha_limite: fut(120) });
  await db.insert('presupuestos', { categoria: 'Comida', limite_mensual: 1500 });
  await db.insert('eventos', { titulo: 'Revisar estado de cuenta', fecha: fut(5), tipo: 'Recordatorio', repetir: 'mensual' });
  // Grupo con roomie de prueba
  const gid = await grupoApi.crear('Depa (demo)', 'Yo');
  const ambos = [ME, DEMO_COMPA];
  await db.insert('recurrentes', { nombre: 'Renta del depa', monto: 9000, frecuencia: 'mensual', proximo_cobro: fut(6), categoria: 'Renta / vivienda', en_uso: true, grupo_id: gid });
  await db.insert('recurrentes', { nombre: 'Internet', monto: 499, frecuencia: 'mensual', proximo_cobro: fut(11), categoria: 'Teléfono / internet', en_uso: true, grupo_id: gid, user_id: DEMO_COMPA });
  await db.insert('gastos', { fecha: f(3), concepto: 'Súper del depa', categoria: 'Súper', metodo: 'Débito', monto: 1460, grupo_id: gid, pagado_por: DEMO_COMPA, participantes: ambos, user_id: DEMO_COMPA });
  await db.insert('gastos', { fecha: f(6), concepto: 'Gas', categoria: 'Servicios (luz, agua, gas)', metodo: 'Efectivo', monto: 420, grupo_id: gid, pagado_por: ME, participantes: ambos });
  await db.insert('gastos', { fecha: f(10), concepto: 'Garrafones y limpieza', categoria: 'Hogar / limpieza', metodo: 'Efectivo', monto: 260, grupo_id: gid, pagado_por: ME, participantes: ambos });
  await db.insert('gastos', { fecha: f(1), concepto: 'Luz (CFE)', categoria: 'Servicios (luz, agua, gas)', metodo: 'Transferencia', monto: 640, grupo_id: gid, pagado_por: DEMO_COMPA, participantes: ambos, user_id: DEMO_COMPA });
  await db.insert('liquidaciones', { grupo_id: gid, de: ME, para: DEMO_COMPA, monto: 300, fecha: f(2), notas: 'Transferencia' });
  await db.insert('eventos', { titulo: 'Juntar dinero de la renta', fecha: fut(4), tipo: 'Pago', repetir: 'mensual', grupo_id: gid, user_id: DEMO_COMPA });
  await db.insert('metas', { nombre: 'Sala para el depa', objetivo: 8000, ahorrado: 1500, fecha_limite: fut(150), grupo_id: gid });
  grupoSel = gid;
  await refrescar(); toast('Datos de ejemplo cargados');
}

/* ---------- Tours guiados (Driver.js) ---------- */
const P = (element, title, description, side) => ({ element, title, description, side });
const TOURS = {
  bienvenida: [
    P(null, '¡Bienvenido a Mis Finanzas!', 'Te enseño en un minuto dónde está cada cosa. Puedes salir cuando quieras con la X o la tecla Esc.'),
    P('#tabs [data-tab="resumen"]', 'Inicio', 'Lo que ganas y gastas esta semana y este mes, las fugas de dinero que detecto y lo que viene por pagar.'),
    P('#tabs [data-tab="movimientos"]', 'Movimientos', 'Todos tus ingresos y gastos, mes por mes y agrupados por semana.'),
    P('#tabs [data-tab="deudas"]', 'Deudas', 'Apps de préstamo, tarjetas y tiendas: cuánto debes, cuánto pagas de intereses y cuál conviene liquidar primero. Siempre son privadas.'),
    P('#tabs [data-tab="fijos"]', 'Gastos fijos', 'Renta, servicios y suscripciones. Marca lo que pagas y no usas para detectar fugas.'),
    P('#tabs [data-tab="metas"]', 'Metas', 'Lo que quieres lograr a largo plazo y cuánto ahorrar cada semana para llegar a tiempo.'),
    P('#tabs [data-tab="agenda"]', 'Calendario', 'Todos tus pagos y eventos del mes. Pásalos a Google Calendar para que te lleguen recordatorios.'),
    P('#tabs [data-tab="grupo"]', 'Grupo', 'Comparte gastos con tus roomies: la app calcula quién le debe a quién. Tú decides qué compartir.'),
    P('#fab', 'Botón +', 'Agrega lo que necesites. Cambia según la sección donde estés.', 'left'),
    P('#btn-tour', '¿Dudas?', 'Toca este botón en cualquier sección y te explico lo que hay en ella.', 'bottom')
  ],
  resumen: [
    P('#t-periodos', 'Tu semana y tu mes', 'Ingresos, gastos (solo tu parte de lo compartido) y lo que te queda.'),
    P('#t-kpis', 'Indicadores clave', 'Deuda total, cuánto te cuestan los fijos y tu tasa de ahorro. La meta sana es ahorrar 10–20% de lo que ganas.'),
    P('#t-grafica', 'Tendencia', 'Compara ingresos contra gastos por semana o por mes.'),
    P('#t-fugas', 'Fugas detectadas', 'Aquí te aviso dónde se te escapa el dinero y cuánto podrías ahorrar cada mes.'),
    P('#t-proximos', 'Próximos 14 días', 'Pagos y eventos que vienen. Con el botón del calendario los pasas a tu Google Calendar.')
  ],
  movimientos: [
    P('#t-movtipo', 'Gastos o ingresos', 'Cambia entre lo que sale y lo que entra.'),
    P('#mov-mes', 'Mes', 'Elige qué mes quieres revisar.'),
    P('#view .item', 'Cada registro', 'Tócalo para editarlo o ver su evidencia (el clip). Si es compartido, verás quién pagó y tu parte.'),
    P('#fab', 'Agregar', 'Registra un gasto o ingreso. Puedes tomar foto del ticket como evidencia.', 'left')
  ],
  deudas: [
    P('#t-deudas-kpis', 'Tus deudas en números', 'Lo que debes, lo que pagas al mes y lo que se va solo en intereses.'),
    P('#view .dcard', 'Cada deuda', 'Saldo, próximo pago, intereses y en cuánto tiempo la terminas con tu pago actual. Están ordenadas de la más cara a la más barata.'),
    P('#view [data-act="abonar"]', 'Abonar', 'Registra un pago: baja el saldo y, si quieres, lo cuenta como gasto del mes.'),
    P('#fab', 'Nueva deuda', 'Agrega una deuda con su tasa o CAT (viene en tu contrato o en la app).', 'left')
  ],
  fijos: [
    P('#t-fijos-kpis', 'Lo que pagas cada mes', 'Total de tus gastos fijos, al mes y al año, y lo que pagas sin usar.'),
    P('#view [data-act="uso"]', '¿Lo usas?', 'Toca para marcar "No lo uso". Aparecerá como fuga en tu inicio.'),
    P('#fab', 'Nuevo fijo', 'Renta, internet, streaming, gimnasio… Si es compartido, elige el grupo y se divide solo.', 'left')
  ],
  metas: [
    P('#t-sobrante', 'Tu sobrante', 'Lo que te queda en promedio cada mes. Con esto calculo cuándo llegas a cada meta.'),
    P('#t-metas', 'Metas', 'Cuánto llevas, cuánto ahorrar por mes y por semana, y si vas a tiempo.'),
    P('#t-presupuestos', 'Presupuestos', 'Ponle tope mensual a una categoría y te aviso cuando te pases.')
  ],
  agenda: [
    P('#t-cal', 'Tu mes', 'Los puntos de colores marcan deudas, fijos, eventos, metas y lo que registraste ese día. Toca un día para ver su detalle.'),
    P('#view [data-act="mes"][data-v="0"]', 'Hoy', 'Regresa al día de hoy.'),
    P('#view [data-act="nuevo-evento"]', 'Nuevo evento', 'Recordatorios, cobros o pagos, con hora y repetición. Puedes compartirlos con tu grupo.'),
    P('#view .gcal', 'Google Calendar', 'Pasa cualquier evento a tu Google Calendar para recibir la notificación en tu celular.')
  ],
  grupo_sin: [
    P('#view .intro', 'Compartir con roomies', 'Cada quien con su cuenta. Solo se comparte lo que tú eliges.'),
    P('#view [data-act="crear-grupo"]', 'Crear grupo', 'Crea el grupo del depa y te doy un código para invitar.'),
    P('#view [data-act="unirse-grupo"]', 'Unirte', 'Si te pasaron un código, entra aquí.')
  ],
  grupo_con: [
    P('#view .codigo', 'Invitar', 'Comparte el código por WhatsApp con el botón Invitar.'),
    P('#view .members', 'Miembros', 'Quién está en el grupo y cuánto debe o le deben.'),
    P('#t-amano', 'Para quedar a mano', 'El mínimo de pagos para quedar parejos. Al transferir, registra el pago con su comprobante.'),
    P('#t-gastos-comp', 'Gastos compartidos', 'Quién pagó y cuánto le toca a cada quien. Toca uno para ver su evidencia.'),
    P('#t-fijos-grupo', 'Fijos del grupo', 'Renta, internet, luz… Cuando se pague, toca "Ya se pagó".')
  ]
};
function iniciarTour(nombre, alTerminar) {
  const D = window.driver?.js?.driver;
  if (!D) return;
  const visible = el => el && el.getClientRects().length > 0;
  if (nombre === 'grupo') nombre = misGrupos().length ? 'grupo_con' : 'grupo_sin';
  const pasos = (TOURS[nombre] || []).filter(p => !p.element || visible(document.querySelector(p.element)));
  if (!pasos.length) return;
  const d = D({
    showProgress: pasos.length > 1, allowClose: true, smoothScroll: true, overlayOpacity: 0.55,
    stagePadding: 6, stageRadius: 12, popoverClass: 'tour',
    nextBtnText: 'Siguiente', prevBtnText: 'Atrás', doneBtnText: '¡Listo!', progressText: '{{current}} de {{total}}',
    steps: pasos.map(p => ({ element: p.element || undefined, popover: { title: p.title, description: p.description, side: p.side, align: 'start' } })),
    onDestroyed: () => alTerminar?.()
  });
  d.drive();
}
const claveTour = () => 'misfinanzas_tour_' + ME;
function tourBienvenida() {
  let visto = false;
  try { visto = localStorage.getItem(claveTour()) === '1'; } catch { /* sin almacenamiento */ }
  if (visto) return;
  setTimeout(() => iniciarTour('bienvenida', () => { try { localStorage.setItem(claveTour(), '1'); } catch { /* nada */ } }), 600);
}
$('#btn-tour').addEventListener('click', () => iniciarTour(tab));

/* ---------- Arranque y sesión ---------- */
let usuario = null;
async function mostrarApp() {
  $('#login').hidden = true; $('#app').hidden = false;
  $('#demo-badge').hidden = !DEMO; $('#demo-banner').hidden = !DEMO; $('#btn-logout').hidden = DEMO;
  if (!DEMO) { ME = usuario.id; MI_ALIAS = (usuario.email || 'Yo').split('@')[0]; $('#user-chip').textContent = usuario.email; $('#user-chip').hidden = false; }
  $('#view').innerHTML = '<div class="empty">Cargando…</div>';
  try { await cargar(); } catch (err) { toast('No se pudieron cargar tus datos: ' + err.message); }
  render();
  tourBienvenida();
}
function mostrarLogin() { $('#app').hidden = true; $('#login').hidden = false; }

$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target), email = fd.get('email'), password = fd.get('password');
  const modo = e.submitter?.dataset.modo || 'login', msg = $('#login-msg');
  msg.textContent = 'Un momento…';
  try {
    if (modo === 'signup') {
      if (String(password).length < 8) { msg.textContent = 'Usa una contraseña de al menos 8 caracteres.'; return; }
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      msg.textContent = data.session ? '' : 'Cuenta creada. Revisa tu correo para confirmarla y luego entra.';
    } else if (modo === 'reset') {
      if (!email) { msg.textContent = 'Escribe tu correo primero.'; return; }
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (error) throw error;
      msg.textContent = 'Te enviamos un correo para cambiar tu contraseña.';
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      msg.textContent = '';
    }
  } catch (err) { msg.textContent = err.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : err.message; }
});
$('#btn-logout').addEventListener('click', async () => { await sb.auth.signOut(); });
$('#btn-ejemplo').addEventListener('click', cargarEjemplo);

async function boot() {
  if (DEMO) { mostrarApp(); return; }
  const { data: { session } } = await sb.auth.getSession();
  usuario = session?.user || null;
  usuario ? mostrarApp() : mostrarLogin();
  sb.auth.onAuthStateChange((ev, s) => {
    if (ev === 'PASSWORD_RECOVERY') setTimeout(async () => {
      const { value: nueva } = await SWAL.fire({
        icon: 'info', title: 'Elige tu nueva contraseña', input: 'password', inputLabel: 'Mínimo 8 caracteres',
        inputAttributes: { autocomplete: 'new-password', maxlength: '72' }, showCancelButton: true, confirmButtonText: 'Guardar contraseña',
        customClass: clasesSwal({ input: 'swal-input' }),
        inputValidator: v => (!v || v.length < 8) ? 'Usa al menos 8 caracteres' : undefined
      });
      if (nueva) { const { error } = await sb.auth.updateUser({ password: nueva }); toast(error ? error.message : 'Contraseña actualizada'); }
    }, 0);
    if (ev === 'SIGNED_IN' && !usuario) { usuario = s.user; setTimeout(mostrarApp, 0); }
    if (ev === 'SIGNED_OUT') { usuario = null; ME = null; TABLAS.forEach(t => (R[t] = [])); urlCache.clear(); mostrarLogin(); }
  });
  // Al volver a la app, trae lo que hayan registrado tus compañeros
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && usuario && !Swal.isVisible()) refrescar(); });
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => !$('#app').hidden && render());
boot();

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
