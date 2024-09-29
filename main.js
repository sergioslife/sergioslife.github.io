// main.js

// Variables globales
const navLinks = document.getElementById('nav-links');
const menuIcon = document.getElementById('menu-icon');
const verMasButton = document.getElementById('ver-mas');
const trabajosRows = document.querySelectorAll('.trabajos-row');

// Función para abrir y cerrar el menú en modo móvil
menuIcon.onclick = function() {
    navLinks.classList.toggle('show-menu');
};

// Scroll suave entre secciones
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Inicializar la primera fila de trabajos
trabajosRows.forEach((row, index) => {
    if (index > 0) {
        row.classList.add('hidden');
    }
});

// Evento de clic en el botón "Ver Más"
verMasButton.addEventListener('click', function() {
    // Muestra todas las filas de trabajos
    trabajosRows.forEach(row => row.classList.remove('hidden'));
    verMasButton.style.display = 'none'; // Oculta el botón después de hacer clic
});

// Animaciones de texto al cargar la página
window.onload = () => {
    const helloText = document.getElementById('hello-text');
    const nameText = document.getElementById('name-text');

    helloText.style.opacity = '1';
    helloText.style.transition = 'opacity 1s ease-in';
    nameText.style.opacity = '1';
    nameText.style.transition = 'opacity 1s ease-in';
};

// Función para simular el efecto de escribir y borrar
function typeWriter(element, text, speed) {
    let index = 0;
    let originalText = element.textContent;

    // Función para borrar el texto
    function erase() {
        if (originalText.length > 0) {
            originalText = originalText.slice(0, -1); // Eliminar la última letra
            element.textContent = originalText;
            setTimeout(erase, speed); // Esperar y seguir borrando
        } else {
            write(); // Comienza a escribir el nuevo texto cuando se haya borrado
        }
    }

    // Función para escribir el nuevo texto
    function write() {
        if (index < text.length) {
            element.textContent += text.charAt(index); // Añadir una letra del nuevo texto
            index++;
            setTimeout(write, speed); // Continuar escribiendo con un retraso
        }
    }

    erase(); // Iniciar la animación borrando primero el texto
}

// Iniciar el cambio después de 2 segundos
setTimeout(function() {
    const element = document.getElementById('hello-text');
    typeWriter(element, 'Yo soy', 150); // Cambia 'HELLO!!' a 'Yo soy' con velocidad de 150ms
}, 2000); // 2000 milisegundos = 2 segundos
