/**
 * Propósito: Capa de Controlador para gestionar las operaciones HTTP relacionadas con los equipos,
 *            validando los datos de entrada, aplicando reglas de negocio por modalidad y conectando rutas[cite: 9].
 * A quién alimenta: Al enrutador del backend (equipos.routes.js)[cite: 9].
 * Qué datos retorna: Respuestas HTTP estructuradas en formato JSON (códigos 200, 201, 400 o 500)[cite: 9].
 */

const EquipoModel = require('../models/Equipo');
const pool = require('../config/db');

class EquipoController {

    /**
     * Propósito: Obtener el listado completo de equipos registrados agrupados por categoría y modalidad[cite: 9],
     *            incluyendo el detalle de sus escuelas y alumnos integrantes.
     * A quién alimenta: Al componente frontend del panel de "Equipos y Categorías"[cite: 9].
     * Qué datos retorna: Un objeto JSON con el estado de éxito y un array de equipos con sus integrantes[cite: 9].
     */
    static async listarEquipos(req, res) {
        try {
            const equipos = await EquipoModel.obtenerTodos();
            res.json({
                exito: true,
                data: equipos
            });
        } catch (error) {
            console.error('Error al listar equipos:', error);
            res.status(500).json({
                exito: false,
                error: 'Error interno al obtener el listado de equipos.'
            });
        }
    }

    /**
     * Propósito: Registrar un nuevo equipo en la base de datos junto con su lista de alumnos integrantes[cite: 9].
     * A quién alimenta: Al formulario de creación de equipos en el frontend[cite: 9].
     * Qué datos retorna: Un objeto JSON confirmando el éxito de la operación y el ID del equipo creado[cite: 9].
     */
    static async crearEquipo(req, res) {
        try {
            const { nombre_equipo, modalidad_id, integrantes } = req.body;

            if (!nombre_equipo || !nombre_equipo.trim()) {
                return res.status(400).json({ exito: false, error: 'El nombre del equipo es obligatorio.' });
            }
            if (!modalidad_id) {
                return res.status(400).json({ exito: false, error: 'La modalidad es obligatoria.' });
            }
            if (!integrantes || !Array.isArray(integrantes) || integrantes.length === 0) {
                return res.status(400).json({ exito: false, error: 'El equipo debe tener al menos un integrante seleccionado.' });
            }

            const nuevoEquipoId = await EquipoModel.crear({
                nombre_equipo,
                modalidad_id,
                integrantes
            });

            res.status(201).json({
                exito: true,
                mensaje: 'Equipo creado exitosamente.',
                equipo_id: nuevoEquipoId
            });

        } catch (error) {
            console.error('Error al crear equipo:', error);
            res.status(500).json({
                exito: false,
                error: error.message || 'Error interno al registrar el equipo.'
            });
        }
    }

    /**
     * Propósito: Actualizar los datos de un equipo existente y sincronizar su listado de integrantes[cite: 9].
     * A quién alimenta: Al módulo de edición de equipos en la interfaz de usuario[cite: 9].
     * Qué datos retorna: Un objeto JSON confirmando que la actualización se realizó correctamente[cite: 9].
     */
    static async actualizarEquipo(req, res) {
        try {
            const equipoId = req.params.id;
            const { nombre_equipo, modalidad_id, integrantes } = req.body;

            if (!nombre_equipo || !nombre_equipo.trim() || !modalidad_id) {
                return res.status(400).json({ exito: false, error: 'Nombre de equipo y modalidad son obligatorios.' });
            }
            if (!integrantes || !Array.isArray(integrantes) || integrantes.length === 0) {
                return res.status(400).json({ exito: false, error: 'El equipo debe mantener al menos un integrante.' });
            }

            await EquipoModel.actualizar(equipoId, {
                nombre_equipo,
                modalidad_id,
                integrantes
            });

            res.json({
                exito: true,
                mensaje: 'Equipo actualizado correctamente.'
            });

        } catch (error) {
            console.error('Error al actualizar equipo:', error);
            res.status(500).json({
                exito: false,
                error: error.message || 'Error interno al actualizar el equipo.'
            });
        }
    }

    /**
     * Propósito: Eliminar un equipo registrado del sistema[cite: 9].
     * A quién alimenta: Al botón de borrado de equipos en la interfaz de gestión[cite: 9].
     * Qué datos retorna: Un objeto JSON confirmando la eliminación del registro[cite: 9].
     */
    static async eliminarEquipo(req, res) {
        try {
            const equipoId = req.params.id;
            const eliminado = await EquipoModel.eliminar(equipoId);

            if (!eliminado) {
                return res.status(404).json({ exito: false, error: 'El equipo no fue encontrado.' });
            }

            res.json({
                exito: true,
                mensaje: 'Equipo eliminado correctamente.'
            });

        } catch (error) {
            console.error('Error al eliminar equipo:', error);
            res.status(500).json({
                exito: false,
                error: 'Error interno al eliminar el equipo.'
            });
        }
    }

    /**
     * Propósito: Consultar y listar todas las categorías y sus respectivas modalidades disponibles en la base de datos[cite: 9].
     * A quién alimenta: Al selector desplegable del formulario de equipos en el frontend[cite: 9].
     * Qué datos retorna: Un array JSON estructurado con las categorías y sus modalidades hijas[cite: 9].
     */
    static async listarCategoriasModalidades(req, res) {
        try {
            const queryReal = `
                SELECT 
                    m.id AS modalidad_id,
                    m.nombre AS modalidad_nombre,
                    c.id AS categoria_id,
                    c.nombre AS categoria_nombre
                FROM modalidades m
                JOIN categorias c ON m.categoria_id = c.id
                ORDER BY c.nombre, m.nombre;
            `;
            const [rows] = await pool.query(queryReal);

            res.json({
                exito: true,
                data: rows
            });
        } catch (error) {
            console.error('Error al obtener categorías y modalidades:', error);
            res.status(500).json({
                exito: false,
                error: 'Error interno al obtener las categorías y modalidades.'
            });
        }
    }

    /**
     * Propósito: Buscar alumnos inscriptos filtrados estrictamente por una modalidad y un término (DNI o Nombre).
     * A quién alimenta: Al buscador del formulario de creación/edición de equipos en el frontend.
     * Qué data retorna: Objeto JSON con el listado de alumnos filtrados por la disciplina elegida.
     */
    static async buscarAlumnosPorModalidad(req, res) {
        try {
            const { modalidad_id, termino } = req.query;

            if (!modalidad_id) {
                return res.status(400).json({ 
                    exito: false, 
                    error: 'Debe seleccionar una modalidad antes de buscar alumnos.' 
                });
            }

            if (!termino || termino.trim() === '') {
                return res.status(400).json({ 
                    exito: false, 
                    error: 'Debe ingresar un término de búsqueda válido.' 
                });
            }

            const busqueda = `%${termino.trim()}%`;
            const query = `
                SELECT 
                    i.id AS inscripto_id,
                    i.alumno,
                    i.dni,
                    i.es_suplente,
                    e.nombre AS escuela,
                    m.nombre AS modalidad
                FROM inscriptos i
                JOIN escuelas e ON i.escuela_id = e.id
                JOIN modalidades m ON i.modalidad_id = m.id
                WHERE i.modalidad_id = ? AND (i.dni LIKE ? OR i.alumno LIKE ?)
                LIMIT 50;
            `;

            const [rows] = await pool.query(query, [modalidad_id, busqueda, busqueda]);

            return res.status(200).json({
                exito: true,
                total: rows.length,
                data: rows
            });
        } catch (error) {
            console.error('Error al buscar alumnos por modalidad:', error);
            return res.status(500).json({ 
                exito: false, 
                error: 'Error interno al procesar la búsqueda por modalidad.' 
            });
        }
    }
}

module.exports = EquipoController;