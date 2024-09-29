if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $nombre = htmlspecialchars($_POST['nombre']);
    $email = htmlspecialchars($_POST['email']);
    $asunto = htmlspecialchars($_POST['asunto']);
    $mensaje = htmlspecialchars($_POST['mensaje']);

    // Valida que los campos no estén vacíos
    if (!empty($nombre) && !empty($email) && !empty($asunto) && !empty($mensaje)) {
        // Configuración del correo
        $to = "sergioalife@gmail.com";  
        $subject = "Formulario de Contacto: " . $asunto;
        $body = "Nombre: $nombre\nCorreo Electrónico: $email\nMensaje:\n$mensaje";
        $headers = "From: $email";

        // Envío del correo
        if (mail($to, $subject, $body, $headers)) {
            echo "Mensaje enviado con éxito.";
        } else {
            echo "Hubo un error al enviar el mensaje.";
        }
    } else {
        echo "Por favor, completa todos los campos.";
    }
}
?>
