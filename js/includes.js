document.addEventListener("DOMContentLoaded", () => {

    const basePath = window.location.pathname.includes('/Page/') ? '../' : '';

    const adjustPaths = (html) => {
        if (!basePath) return html;
        return html
            .replace(/src="Recursos\//g, `src="${basePath}Recursos/`)
            .replace(/src="\/Recursos\//g, `src="${basePath}Recursos/`)
            .replace(/href="index\.html/g, `href="${basePath}index.html`)
            .replace(/href="\/index\.html/g, `href="${basePath}index.html`)
            .replace(/href="Page\/galeria\.html/g, `href="galeria.html`)
            .replace(/href="\/Page\/galeria\.html/g, `href="galeria.html`);
    };

    const loadLang = () => {
        const lang = localStorage.getItem('lang') || 'es';
        document.documentElement.lang = lang;

        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });

        if (window.setLanguage) {
            window.setLanguage(lang);
        }
    };

    const updateYear = () => {
        const yearEl = document.getElementById("year");
        if (yearEl) {
            yearEl.textContent = new Date().getFullYear();
        }
    };

    const setupMobileMenu = () => {
        const navLinks = document.getElementById('nav-links');
        const menuIcon = document.getElementById('menu-icon');

        if (menuIcon && navLinks) {
            menuIcon.addEventListener('click', () => {
                navLinks.classList.toggle('show-menu');
            });

            navLinks.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    navLinks.classList.remove('show-menu');
                });
            });
        }
    };

    const injectNav = () => {
        const navHTML = adjustPaths(`
            <nav class="navigation">
                <div class="left-menu">
                    <div class="logo">
                        <a href="${basePath}index.html" aria-label="Ir al inicio">
                            <img src="${basePath}Recursos/logo.png" alt="Sergio's Life" width="50" height="50">
                        </a>
                    </div>
                    <ul class="nav-links" id="nav-links">
                        <li><a href="${basePath}index.html#inicio" class="inicio">Inicio</a></li>
                        <li><a href="${basePath}ilustracion.html" class="ilustracion">Ilustración</a></li>
                        <li><a href="${basePath}sobre-mi.html" class="sobre-mi">Sobre Mi</a></li>
                        <li><a href="${basePath}Page/galeria.html" class="trabajos">Trabajos</a></li>
                        <li><a href="${basePath}contacto.html" class="contacto">Contacto</a></li>
                    </ul>
                </div>
                <div class="right-menu">
                    <button class="menu-icon" id="menu-icon" aria-label="Abrir menú" aria-expanded="false" aria-controls="nav-links"><i class="fas fa-bars"></i></button>
                </div>
            </nav>
        `);

        document.getElementById("nav-placeholder").innerHTML = navHTML;
        setupMobileMenu();
        loadLang();
        updateYear();
        return Promise.resolve();
    };

    const injectFooter = () => {
        const footerHTML = adjustPaths(`
            <footer class="site-footer" role="contentinfo">
                <div class="footer-brand">
                    <a href="${basePath}index.html" aria-label="Ir al inicio">
                        <img src="${basePath}Recursos/logo.png" alt="Sergio's Life" width="100" height="100" loading="lazy">
                    </a>
                </div>
                <nav class="footer-social" aria-label="Redes sociales">
                    <ul>
                        <li><a href="https://www.instagram.com/sergio.s_life_" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><i class="fab fa-instagram"></i></a></li>
                        <li><a href="https://www.linkedin.com/in/sergios-life/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><i class="fab fa-linkedin"></i></a></li>
                        <li><a href="https://www.behance.net/sergioslife" target="_blank" rel="noopener noreferrer" aria-label="Behance"><i class="fab fa-behance"></i></a></li>
                        <li><a href="https://www.youtube.com/channel/UCgFbHfY98Y5TGWT6fQaTXIw" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><i class="fab fa-youtube"></i></a></li>
                        <li><a href="https://vimeo.com/user179129330" target="_blank" rel="noopener noreferrer" aria-label="Vimeo"><i class="fab fa-vimeo"></i></a></li>
                    </ul>
                </nav>
                <div class="footer-legal">
                    <p data-i18n="footer.copyright">&copy; <span id="year"></span> Sergio's Life. Todos los derechos reservados.</p>
                </div>
                <div class="footer-links">
                    <a href="politica-de-privacidad.html" target="_blank" rel="noopener noreferrer">Política de Tratamiento de Datos</a>
                </div>
                <address class="footer-contact">
                    <a href="mailto:sergioalife@gmail.com" aria-label="Enviar correo a Sergio's Life"><i class="fas fa-envelope"></i> sergioalife@gmail.com</a>
                </address>
            </footer>
        `);

        document.getElementById("footer-placeholder").innerHTML = footerHTML;
        loadLang();
        updateYear();
        return Promise.resolve();
    };

    injectNav();
    injectFooter();
});
