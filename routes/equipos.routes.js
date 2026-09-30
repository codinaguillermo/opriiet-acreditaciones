/**
 * Propósito: Definir los endpoints HTTP para la gestión de equipos, categorías y modalidades,
 *            asociando cada ruta con su respectivo método en el EquipoController[cite: 11].
 * A quién alimenta: Al archivo principal del servidor (server.js) y al cliente frontend (Vue 3 + Axios)[cite: 11].
 * Qué datos retorna: Enrutamiento de peticiones hacia el controlador y respuestas HTTP estructuradas[cite: 11].
 */

const express = require('express');
const router = express.Router();
const EquipoController = require('../controllers/EquipoController');

/**
 * IMPORTANTE: Las rutas estáticas específicas deben declararse SIEMPRE 
 * antes de las rutas raíz o genéricas para evitar conflictos en Express[cite: 11].
 */

/**
 * Ruta: GET /api/equipos/categorias-modalidades
 * Propósito: Obtener el listado de categorías y modalidades para los selectores[cite: 11].
 * A quién alimenta: Al formulario de alta/edición de equipos en el frontend[cite: 11].
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
 * Propósito: Obtener el listado general de equipos registrados con sus integrantes[cite: 11].
 * A quién alimenta: Al panel visual de listado de equipos[cite: 11].
 */
router.get('/', EquipoController.listarEquipos);

/**
 * Ruta: POST /api/equipos
 * Propósito: Registrar un nuevo equipo y sus alumnos integrantes mediante transacción[cite: 11].
 * A quién alimenta: Al formulario de creación de equipos[cite: 11].
 */
router.post('/', EquipoController.crearEquipo);

/**
 * Ruta: PUT /api/equipos/:id
 * Propósito: Actualizar los datos de un equipo existente y sincronizar sus integrantes[cite: 11].
 * A quién alimenta: Al módulo de edición de equipos[cite: 11].
 */
router.put('/:id', EquipoController.actualizarEquipo);

/**
 * Ruta: DELETE /api/equipos/:id
 * Propósito: Eliminar un equipo registrado del sistema[cite: 11].
 * A quién alimenta: Al botón de borrado de equipos[cite: 11].
 */
router.delete('/:id', EquipoController.eliminarEquipo);

module.exports = router;