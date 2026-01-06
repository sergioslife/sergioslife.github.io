document.addEventListener("DOMContentLoaded", () => {
    const textElement = document.getElementById("hello-text");

    if (!textElement) return;

    const texts = ["HELLO!!", "YO SOY"];
    let textIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    const typingSpeed = 100;
    const deletingSpeed = 60;
    const delayBetweenTexts = 1500;

    function typeEffect() {
        const currentText = texts[textIndex];

        if (!isDeleting) {
            textElement.textContent = currentText.substring(0, charIndex + 1);
            charIndex++;

            if (charIndex === currentText.length) {
                setTimeout(() => {
                    isDeleting = true;
                }, delayBetweenTexts);
            }
        } else {
            textElement.textContent = currentText.substring(0, charIndex - 1);
            charIndex--;

            if (charIndex === 0) {
                isDeleting = false;
                textIndex = (textIndex + 1) % texts.length;
            }
        }

        setTimeout(
            typeEffect,
            isDeleting ? deletingSpeed : typingSpeed
        );
    }

    typeEffect();
});
