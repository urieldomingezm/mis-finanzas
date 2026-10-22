// =====================================================================
//  Configuración de Supabase
//  1) En Supabase ve a Project Settings → API (o "API Keys").
//  2) Copia la "Project URL" y la llave pública ("anon" / "publishable").
//  3) Pégalas aquí abajo y sube el archivo a GitHub.
//
//  Si dejas estos valores vacíos, la app funciona en MODO DEMO:
//  los datos se guardan solo en el navegador de ese dispositivo.
//
//  ⚠️ NUNCA pongas aquí la llave "service_role" / "secret".
//     La llave pública sí puede ir aquí: la seguridad la dan las
//     políticas RLS del archivo supabase/schema.sql.
// =====================================================================
window.APP_CONFIG = {
  SUPABASE_URL: "",       // ej. "https://abcdxyz.supabase.co"
  SUPABASE_ANON_KEY: ""   // ej. "eyJhbGciOi..." o "sb_publishable_..."
};
