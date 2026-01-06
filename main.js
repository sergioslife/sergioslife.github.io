/* ==================================================
   SOBRE MÍ — VER MÁS / VER MENOS (FINAL Y LIMPIO)
================================================== */
document.addEventListener('DOMContentLoaded', () => {
    const verMasBtn = document.getElementById('verMasButton');
    const cerrarBtn = document.getElementById('cerrarSobreMi');
    const additionalSection = document.getElementById('additional-sections');
    const sobreMiSection = document.getElementById('sobre-mi');

    if (!verMasBtn || !additionalSection || !cerrarBtn) return;

    /* Estado inicial */
    additionalSection.classList.add('hidden');
    cerrarBtn.classList.add('hidden');
    verMasBtn.setAttribute('aria-expanded', 'false');
    verMasBtn.textContent = 'Ver más sobre mí';

    /* Abrir / cerrar desde botón principal */
    verMasBtn.addEventListener('click', () => {
        const expanded = verMasBtn.getAttribute('aria-expanded') === 'true';

        if (!expanded) {
            // ABRIR
            additionalSection.classList.remove('hidden');
            cerrarBtn.classList.remove('hidden');

            verMasBtn.textContent = 'Ver menos';
            verMasBtn.setAttribute('aria-expanded', 'true');
        } else {
            cerrarSeccion();
        }
    });

    /* Cerrar desde botón secundario */
    cerrarBtn.addEventListener('click', cerrarSeccion);

    function cerrarSeccion() {
        additionalSection.classList.add('hidden');
        cerrarBtn.classList.add('hidden');

        verMasBtn.textContent = 'Ver más sobre mí';
        verMasBtn.setAttribute('aria-expanded', 'false');

        if (sobreMiSection) {
            sobreMiSection.scrollIntoView({
                behavior: 'smooth'
            });
        }
    }
});
