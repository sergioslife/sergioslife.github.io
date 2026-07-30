document.addEventListener('DOMContentLoaded', () => {

    /* ==================================================
       CARRUSEL DE PROYECTOS (INFINITO)
    ================================================== */

    const carousel = document.getElementById("proyectosCarousel");
    const nextBtn = document.querySelector(".next");
    const prevBtn = document.querySelector(".prev");

    if (carousel) {

        carousel.innerHTML += carousel.innerHTML;

        nextBtn?.addEventListener("click", () => {
            carousel.scrollBy({
                left: 340,
                behavior: "smooth"
            });
        });

        prevBtn?.addEventListener("click", () => {
            carousel.scrollBy({
                left: -340,
                behavior: "smooth"
            });
        });

        setInterval(() => {

            carousel.scrollBy({
                left: 340,
                behavior: "smooth"
            });

            if (carousel.scrollLeft >= carousel.scrollWidth / 2) {

                carousel.scrollTo({
                    left: 0,
                    behavior: "auto"
                });

            }

        }, 5000);

    }


    /* ==================================================
        SCROLL SUAVE
    ================================================== */

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {

        anchor.addEventListener('click', e => {

            e.preventDefault();

            const target = document.querySelector(anchor.getAttribute('href'));

            if (target) {

                target.scrollIntoView({
                    behavior: 'smooth'
                });

            }

        });

    });


    /* ==================================================
       GALERÍA — LIGHTBOX
    ================================================== */

    const items = document.querySelectorAll(".galeria-item");
    const lightbox = document.getElementById("lightbox");
    const lightboxImg = document.querySelector(".lightbox-img");
    const cerrar = document.querySelector(".cerrar");
    const embedContainer = document.getElementById("lb-embed");

    const lbTitle = document.getElementById("lb-title");
    const lbCategory = document.getElementById("lb-category");
    const lbYear = document.getElementById("lb-year");
    const lbDescription = document.getElementById("lb-description");
    const lbLink = document.getElementById("lb-link");

    if (items.length && lightbox) {

        items.forEach(item => {

            item.addEventListener("click", () => {

                const img = item.querySelector("img");
                const type = item.dataset.type;
                const instagramURL = item.dataset.instagram;

                lightbox.style.display = "flex";
                document.body.style.overflow = "hidden";

                embedContainer.innerHTML = "";
                lightboxImg.style.display = "block";

                lbTitle.textContent = item.dataset.title || "";
                lbCategory.textContent = item.dataset.category || "";
                lbYear.textContent = item.dataset.year || "";
                lbDescription.textContent = item.dataset.description || "";

                if (type === "instagram" && instagramURL) {

                    lightboxImg.style.display = "none";

                    lbLink.href = instagramURL;
                    lbLink.style.display = "inline-block";

                    embedContainer.innerHTML = `
                        <blockquote class="instagram-media"
                            data-instgrm-permalink="${instagramURL}"
                            data-instgrm-version="14"
                            style="max-width:540px; margin:auto;">
                        </blockquote>
                    `;

                    if (window.instgrm) {
                        window.instgrm.Embeds.process();
                    }

                } else {

                    lightboxImg.src = img ? img.src : "";

                    const link = item.dataset.link;

                    if (link && link.trim() !== "") {

                        lbLink.href = link;
                        lbLink.style.display = "inline-block";

                    } else {

                        lbLink.removeAttribute("href");
                        lbLink.style.display = "none";

                    }

                }

            });

        });

    }


    /* ==================================================
       CERRAR LIGHTBOX
    ================================================== */

    function cerrarLightbox() {

        if (!lightbox) return;

        lightbox.style.display = "none";
        document.body.style.overflow = "auto";

        if (embedContainer) {
            embedContainer.innerHTML = "";
        }

    }

    if (cerrar) cerrar.addEventListener("click", cerrarLightbox);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") cerrarLightbox();
    });

    if (lightbox) {
        lightbox.addEventListener("click", (e) => {
            if (e.target === lightbox) cerrarLightbox();
        });
    }


    /* ==================================================
       GALERÍA — FILTROS
    ================================================== */

    const filtrosGaleria = document.querySelectorAll(".filtro");
    const proyectosGaleria = document.querySelectorAll(".galeria-item");

    if (filtrosGaleria.length && proyectosGaleria.length) {

        filtrosGaleria.forEach(btn => {

            btn.addEventListener("click", () => {

                const activo = document.querySelector(".filtro.activo");
                if (activo) activo.classList.remove("activo");

                btn.classList.add("activo");

                const filter = btn.getAttribute("data-filter");

                proyectosGaleria.forEach(item => {

                    if (filter === "all" || item.classList.contains(filter)) {
                        item.style.display = "block";
                    } else {
                        item.style.display = "none";
                    }

                });

            });

        });

    }


    /* ==================================================
       PROYECTOS — FILTRO
    ================================================== */

    const filtrosProyectos = document.querySelectorAll(".filtro-btn");
    const proyectos = document.querySelectorAll(".trabajo-card");

    if (filtrosProyectos.length && proyectos.length) {

        filtrosProyectos.forEach(btn => {

            btn.addEventListener("click", () => {

                const filtro = btn.dataset.filter;

                if (filtro === "all") {
                    filtrosProyectos.forEach(b => b.classList.remove("active"));
                    btn.classList.add("active");
                    proyectos.forEach(proyecto => {
                        proyecto.style.display = "block";
                    });
                    return;
                }

                const todosBtn = document.querySelector('.filtro-btn[data-filter="all"]');
                if (todosBtn && todosBtn.classList.contains("active")) {
                    todosBtn.classList.remove("active");
                }

                btn.classList.toggle("active");

                const activos = Array.from(filtrosProyectos)
                    .filter(b => b.classList.contains("active") && b.dataset.filter !== "all")
                    .map(b => b.dataset.filter);

                if (activos.length === 0) {
                    if (todosBtn) todosBtn.classList.add("active");
                    proyectos.forEach(proyecto => {
                        proyecto.style.display = "block";
                    });
                    return;
                }

                proyectos.forEach(proyecto => {
                    const coincide = activos.some(f => proyecto.classList.contains(f));
                    proyecto.style.display = coincide ? "block" : "none";
                });

            });

        });

    }


    /* ==================================================
       VER MÁS SOBRE MI
    ================================================== */

    const verMasButton = document.getElementById("verMasButton");
    const cerrarSobreMi = document.getElementById("cerrarSobreMi");
    const moreSection = document.getElementById("additional-sections");

    if (verMasButton && moreSection){

        verMasButton.addEventListener("click", () => {

            moreSection.classList.toggle("hidden");

            const isHidden = moreSection.classList.contains("hidden");

            verMasButton.setAttribute("aria-expanded", !isHidden);

            const lang = window.i18n?.currentLang || document.documentElement.lang || 'es';
            const t = window.i18n?.translations?.[lang] || {};

            verMasButton.textContent = isHidden
                ? (t['about.ver_mas'] || 'Ver más sobre mi')
                : (t['about.ver_menos'] || 'Ver menos sobre mi');

            if (cerrarSobreMi) {
                cerrarSobreMi.classList.toggle('hidden', isHidden);
            }

        });

    }

    if (cerrarSobreMi && moreSection) {

        cerrarSobreMi.addEventListener("click", () => {

            moreSection.classList.add("hidden");

            verMasButton.setAttribute("aria-expanded", "false");

            const lang = window.i18n?.currentLang || document.documentElement.lang || 'es';
            const t = window.i18n?.translations?.[lang] || {};

            verMasButton.textContent = t['about.ver_mas'] || 'Ver más sobre mi';

            cerrarSobreMi.classList.add("hidden");

        });

    }

});