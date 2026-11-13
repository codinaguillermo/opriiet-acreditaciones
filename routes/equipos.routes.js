/**
 * Propósito: Definir los endpoints HTTP para la gestión de equipos, categorías y modalidades,
 *            asociando cada ruta con su respectivo método en el EquipoController.
 * A quién alimenta: Al archivo principal del servidor (server.js) y al cliente frontend (Vue 3 + Axios).
 * Qué datos retorna: Enrutamiento de peticiones hacia el controlador y respuestas HTTP estructuradas.
 */

const express = require('express');
const router = express.Router();
const EquipoController = require('../controllers/EquipoController');

/**
 * IMPORTANTE: Las rutas estáticas específicas deben declararse SIEMPRE 
 * antes de las rutas raíz o genéricas para evitar conflictos en Express.
 */

/**
 * Ruta: GET /api/equipos/categorias-modalidades
 * Propósito: Obtener el listado de categorías y modalidades para los selectores.
 * A quién alimenta: Al formulario de alta/edición de equipos en el frontend.
 */
router.get('/categorias-modalidades', EquipoController.listarCategoriasModalidades);

/**
 * Ruta: GET /api/equipos/buscar-alumnos?modalidad_id=...&termino=...
 * Propósito: Buscar alumnos inscriptos filtrados estrictamente por modalidad y término (DNI o Nombre).
 * A quién alimenta: Al buscador del formulario de creación/edición de equipos en el frontend.
 */
router.get('/buscar-alumnos', EquipoController.buscarAlumnosPorModalidad);

/**
 * Ruta: GET /api/equipos
 * Propósito: Obtener el listado general de equipos registrados con sus integrantes.
 * A quién alimenta: Al panel visual de listado de equipos.
 */
router.get('/', EquipoController.listarEquipos);

/**
 * Ruta: POST /api/equipos
 * Propósito: Registrar un nuevo equipo y sus alumnos integrantes mediante transacción.
 * A quién alimenta: Al formulario de creación de equipos.
 */
router.post('/', EquipoController.crearEquipo);

/**
 * Ruta: PUT /api/equipos/:id
 * Propósito: Actualizar los datos de un equipo existente y sincronizar sus integrantes.
 * A quién alimenta: Al módulo de edición de equipos.
 */
router.put('/:id', EquipoController.actualizarEquipo);

/**
 * Ruta: PUT /api/equipos/:id/presencia
 * Propósito: Actualizar el estado de presencia física del equipo para el sorteo del torneo.
 * A quién alimenta: Al botón de presencia interactivo en la vista de equipos del frontend.
 */
router.put('/:id/presencia', EquipoController.cambiarPresencia);

/**
 * Ruta: DELETE /api/equipos/:id
 * Propósito: Eliminar un equipo registrado del sistema.
 * A quién alimenta: Al botón de borrado de equipos.
 */
router.delete('/:id', EquipoController.eliminarEquipo);

module.exports = router;