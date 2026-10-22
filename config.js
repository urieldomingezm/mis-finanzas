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
  SUPABASE_URL: "https://pdmcxbdbtbykpfofmxrn.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_DzFbyUJFS4GDxnOo9iZSFg_wSg8aUFN",

  // Dirección pública de la web: a ella regresan los correos de confirmación y las invitaciones
  SITE_URL: "https://urieldomingezm.github.io/mis-finanzas/",
  // Última APK de Android (la publica GitHub Actions en "Releases")
  APK_URL: "https://github.com/urieldomingezm/mis-finanzas/releases/latest/download/mis-finanzas.apk"
};
