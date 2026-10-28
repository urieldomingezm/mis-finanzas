// Tema claro / oscuro. Se carga en el <head> para que la página no parpadee al abrir.
// Sin elección guardada, sigue el modo del sistema; con el botón del encabezado se fija "light" o "dark".
(() => {
  try {
    const t = localStorage.getItem('mf-tema');
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  } catch { /* sin almacenamiento: sigue el sistema */ }
})();
