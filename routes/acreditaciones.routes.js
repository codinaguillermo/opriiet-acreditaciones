/**
 * Propósito: Definir los endpoints (rutas HTTP) para el módulo de acreditaciones y autenticación,
 *            asociando cada URL con su respectivo método en el controlador.
 * A quién alimenta: Al archivo principal del servidor (server.js) y al cliente frontend (Vue 3 + Axios).
 * Qué datos retorna: Enrutamiento de peticiones hacia el controlador y respuestas HTTP estructuradas.
 */

const express = require('express');
const router = express.Router();
const AcreditacionController = require('../controllers/AcreditacionController');

/**
 * Ruta: GET /api/acreditaciones/buscar?termino=...
 * Propósito: Endpoint para buscar inscriptos por DNI o Nombre.
 * A quién alimenta: Al componente de búsqueda rápida de la interfaz de acreditación.
 */
router.get('/buscar', AcreditacionController.buscarInscriptos);

/**
 * Ruta: POST /api/acreditaciones
 * Propósito: Endpoint para registrar o actualizar la acreditación de un alumno.
 * A quién alimenta: Al botón de check-in / confirmación de asistencia del operador.
 */
router.post('/', AcreditacionController.acreditarInscripto);

/**
 * Ruta: POST /api/acreditaciones/login
 * Propósito: Endpoint seguro para autenticar al operador mediante la clave maestra en el servidor.
 * A quién alimenta: Al formulario de acceso inicial en App.vue.
 */
router.post('/login', AcreditacionController.verificarClave);

module.exports = router;