/**
 * Propósito: Definir los endpoints (rutas HTTP) para el módulo de acreditaciones y autenticación,
 *            asociando cada URL con su respectivo método en el controlador[cite: 5].
 * A quién alimenta: Al archivo principal del servidor (server.js) y al cliente frontend (Vue 3 + Axios)[cite: 5].
 * Qué datos retorna: Enrutamiento de peticiones hacia el controlador y respuestas HTTP estructuradas[cite: 5].
 */

const express = require('express');
const router = express.Router();
const AcreditacionController = require('../controllers/AcreditacionController');

router.post('/inscriptos-nuevo', AcreditacionController.registrarNuevoInscripto);


/**
 * Ruta: GET /api/acreditaciones/escuelas
 * Propósito: Obtener el listado de escuelas existentes para el selector de altas.
 * A quién alimenta: Al formulario de alta de nuevo alumno.
 */
router.get('/escuelas', AcreditacionController.listarEscuelas);

/**
 * Ruta: GET /api/acreditaciones/reporte
 * Propósito: Obtener el reporte separado de acreditados y pendientes (resta de bases de datos) para solo lectura.
 * A quién alimenta: Al componente frontend de Acreditaciones.vue.
 */
router.get('/reporte', AcreditacionController.obtenerReporteAsistencia);

/**
 * Ruta: GET /api/acreditaciones/buscar?termino=...
 * Propósito: Endpoint para buscar inscriptos por DNI o Nombre[cite: 5].
 * A quién alimenta: Al componente de búsqueda rápida de la interfaz de acreditación[cite: 5].
 */
router.get('/buscar', AcreditacionController.buscarInscriptos);

/**
 * Ruta: GET /api/acreditaciones
 * Propósito: Obtener el listado general de inscriptos[cite: 5].
 * A quién alimenta: A componentes secundarios.
 */
router.get('/', AcreditacionController.listarTodos);

/**
 * Ruta: POST /api/acreditaciones
 * Propósito: Endpoint para registrar o actualizar la acreditación de un alumno[cite: 5].
 * A quién alimenta: Al botón de check-in / confirmación de asistencia del operador[cite: 5].
 */
router.post('/', AcreditacionController.acreditarInscripto);

/**
 * Ruta: POST /api/acreditaciones/login
 * Propósito: Endpoint seguro para autenticar al operador mediante la clave maestra en el servidor[cite: 5].
 * A quién alimenta: Al formulario de acceso inicial en App.vue[cite: 5].
 */
router.post('/login', AcreditacionController.verificarClave);

module.exports = router;