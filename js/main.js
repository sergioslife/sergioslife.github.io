document.addEventListener('DOMContentLoaded', () => {

    /* ==================================================
       MENÚ RESPONSIVE
    ================================================== */
    const navLinks = document.getElementById('nav-links');
    const menuIcon = document.getElementById('menu-icon');

    if (menuIcon && navLinks) {
        menuIcon.addEventListener('click', () => {
            navLinks.classList.toggle('show-menu');
        });
    }

    /* ==================================================
       SCROLL SUAVE
    ================================================== */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', e => {
            e.preventDefault();
            const target = document.querySelector(anchor.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    /* ==================================================
       TRABAJOS — VER TODOS (AISLADO)
    ================================================== */
    const verMasTrabajosBtn = document.getElementById('ver-mas');
    const trabajosRows = document.querySelectorAll('.trabajos-row');

    if (trabajosRows.length) {
        trabajosRows.forEach((row, index) => {
            if (index > 0) {
                row.classList.add('hidden');
            }
        });
    }

    if (verMasTrabajosBtn && trabajosRows.length) {
        verMasTrabajosBtn.addEventListener('click', () => {
            trabajosRows.forEach(row => row.classList.remove('hidden'));
            verMasTrabajosBtn.style.display = 'none';
        });
    }

    /* ==================================================
       SOBRE MÍ — VER MÁS / VER MENOS (CONTROL ÚNICO)
    ================================================== */
    const verMasBtn = document.getElementById('verMasButton');
    const additionalSection = document.getElementById('additional-sections');
    const sobreMiSection = document.getElementById('sobre-mi');

    if (verMasBtn && additionalSection) {

        // Estado inicial forzado
        additionalSection.classList.add('hidden');
        verMasBtn.setAttribute('aria-expanded', 'false');
        verMasBtn.textContent = 'Ver más sobre mí';

        verMasBtn.addEventListener('click', () => {
            const expanded = verMasBtn.getAttribute('aria-expanded') === 'true';

            if (!expanded) {
                // ABRIR
                additionalSection.classList.remove('hidden');
                verMasBtn.textContent = 'Ver menos';
                verMasBtn.setAttribute('aria-expanded', 'true');
            } else {
                // CERRAR
                additionalSection.classList.add('hidden');
                verMasBtn.textContent = 'Ver más sobre mí';
                verMasBtn.setAttribute('aria-expanded', 'false');

                sobreMiSection?.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    /* ==================================================
       COLORES CÍCLICOS EN TRABAJOS
    ================================================== */
    const colores = ['#69C0AF', '#FDC415', '#E6135a'];
    document.querySelectorAll('.trabajo-item').forEach((item, index) => {
        item.style.borderColor = colores[index % colores.length];
    });

});
