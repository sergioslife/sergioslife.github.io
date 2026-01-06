document.addEventListener("DOMContentLoaded", () => {

    fetch("nav.html")
        .then(response => {
            if (!response.ok) throw new Error("No se pudo cargar nav.html");
            return response.text();
        })
        .then(data => {
            document.getElementById("nav-placeholder").innerHTML = data;
        })
        .catch(error => console.error(error));

    fetch("footer.html")
        .then(response => {
            if (!response.ok) throw new Error("No se pudo cargar footer.html");
            return response.text();
        })
        .then(data => {
            document.getElementById("footer-placeholder").innerHTML = data;
        })
        .catch(error => console.error(error));
});

