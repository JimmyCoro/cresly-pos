// Tema claro/oscuro. Se carga en el <head>, antes del CSS, para que la
// página no parpadee en blanco al abrirse en modo oscuro. La preferencia
// vive en este navegador (localStorage); el CSS está en CSS/tema.css.
(function () {
  var CLAVE = 'cresly-tema';
  var raiz = document.documentElement;

  function leer() {
    try { return localStorage.getItem(CLAVE); } catch (e) { return null; }
  }
  function guardar(valor) {
    try { localStorage.setItem(CLAVE, valor); } catch (e) { /* sin storage: solo dura esta página */ }
  }

  function pintarBoton() {
    var oscuro = raiz.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('.pzh-theme-btn').forEach(function (btn) {
      var icono = btn.querySelector('i');
      if (icono) icono.className = oscuro ? 'bi bi-sun' : 'bi bi-moon';
      var texto = oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
      btn.setAttribute('aria-label', texto);
      btn.title = texto;
    });
  }

  function aplicar(tema) {
    if (tema === 'dark') raiz.setAttribute('data-theme', 'dark');
    else raiz.removeAttribute('data-theme');
    pintarBoton();
  }

  aplicar(leer());

  // Delegado: el botón del header aparece después de este script.
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.pzh-theme-btn')) return;
    var nuevo = raiz.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    guardar(nuevo);
    aplicar(nuevo);
  });
  document.addEventListener('DOMContentLoaded', pintarBoton);
})();
