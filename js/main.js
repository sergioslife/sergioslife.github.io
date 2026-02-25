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
/* =========================
       GALERÍA — LIGHTBOX
    ========================= */

    const items = document.querySelectorAll(".galeria-item");
    const lightbox = document.getElementById("lightbox");
    const lightboxContent = document.querySelector(".lightbox-content");
    const lightboxImg = document.querySelector(".lightbox-img");
    const cerrar = document.querySelector(".cerrar");
    const embedContainer = document.getElementById("lb-embed");

    const lbTitle = document.getElementById("lb-title");
    const lbCategory = document.getElementById("lb-category");
    const lbYear = document.getElementById("lb-year");
    const lbDescription = document.getElementById("lb-description");
    const lbLink = document.getElementById("lb-link");

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

    cerrar.addEventListener("click", cerrarLightbox);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") cerrarLightbox();
    });

    lightbox.addEventListener("click", (e) => {
        if (e.target === lightbox) cerrarLightbox();
    });

    function cerrarLightbox() {
        lightbox.style.display = "none";
        document.body.style.overflow = "auto";
        embedContainer.innerHTML = "";
    }

    /* ==================================================
       GALERÍA — FILTROS
    ================================================== */
    const filtros = document.querySelectorAll(".filtro");
    const proyectos = document.querySelectorAll(".galeria-item");

    if (filtros.length && proyectos.length) {
        filtros.forEach(btn => {
            btn.addEventListener("click", () => {

                const activo = document.querySelector(".filtro.activo");
                if (activo) activo.classList.remove("activo");

                btn.classList.add("activo");

                const filter = btn.getAttribute("data-filter");

                proyectos.forEach(item => {
                    if (filter === "all" || item.classList.contains(filter)) {
                        item.style.display = "block";
                    } else {
                        item.style.display = "none";
                    }
                });
            });
        });
    }

});