/**
 * Propósito: Capa de Controlador para gestionar la lógica de negocio relacionada con 
 *            la búsqueda de inscriptos, el registro de acreditaciones y la autenticación segura por clave maestra[cite: 6].
 * A quién alimenta: A las rutas de la API (routes/acreditaciones.routes.js)[cite: 6].
 * Qué datos retorna: Respuestas HTTP en formato JSON con resultados, confirmaciones de éxito/error y estados de autenticación[cite: 6].
 */

const InscriptoModel = require('../models/Inscripto');
const AcreditacionModel = require('../models/Acreditacion');
const pool = require('../config/db');

class AcreditacionController {

    /**
     * Propósito: Obtener el listado general de todos los inscriptos con su estado de acreditación.
     * A quién alimenta: A la ruta GET para poblar las pestañas de acreditados y pendientes.
     * Qué datos retorna: Un objeto JSON con el array completo de inscriptos.
     */
    static async listarTodos(req, res) {
        try {
            const inscriptos = await InscriptoModel.obtenerTodosConEstado();
            return res.status(200).json({
                exito: true,
                total: inscriptos.length,
                data: inscriptos
            });
        } catch (error) {
            console.error('Error en AcreditacionController.listarTodos:', error.message);
            return res.status(500).json({ 
                exito: false, 
                error: 'Error interno al obtener el listado de inscriptos.' 
            });
        }
    }

    /**
     * Propósito: Buscar inscriptos por término (DNI o Nombre) y retornar los resultados con sus estados[cite: 6].
     * A quién alimenta: Al controlador de búsqueda para el puesto de acreditación en la entrada[cite: 6].
     * Qué datos retorna: Un objeto JSON con el array de alumnos encontrados o un mensaje de error[cite: 6].
     * 
     * @param {Object} req - Objeto de petición HTTP (contiene req.query.termino)[cite: 6].
     * @param {Object} res - Objeto de respuesta HTTP[cite: 6].
     * @returns {Object} Respuesta JSON con los registros o error[cite: 6].
     */
    static async buscarInscriptos(req, res) {
        try {
            const { termino } = req.query;

            if (!termino || termino.trim() === '') {
                return res.status(400).json({ 
                    exito: false, 
                    error: 'Debe proveer un término de búsqueda válido (DNI o Nombre).' 
                });
            }

            const inscriptos = await InscriptoModel.buscarPorTermino(termino);

            return res.status(200).json({
                exito: true,
                total: inscriptos.length,
                data: inscriptos
            });
        } catch (error) {
            console.error('Error en AcreditacionController.buscarInscriptos:', error.message);
            return res.status(500).json({ 
                exito: false, 
                error: 'Error interno al procesar la búsqueda en la base de datos.' 
            });
        }
    }

    /**
     * Propósito: Registrar o actualizar la acreditación (asistencia y documentación) de un inscripto[cite: 6].
     * A quién alimenta: A la ruta POST de acreditaciones al momento de hacer check-in en el evento[cite: 6].
     * Qué datos retorna: Un objeto JSON confirmando el éxito de la operación y el ID procesado[cite: 6].
     * 
     * @param {Object} req - Objeto de petición HTTP (contiene req.body con inscripto_id, presente, documentacion_ok)[cite: 6].
     * @param {Object} res - Objeto de respuesta HTTP[cite: 6].
     * @returns {Object} Respuesta JSON con la confirmación de la acreditación[cite: 6].
     */
    static async acreditarInscripto(req, res) {
        try {
            const { inscripto_id, presente, documentacion_ok } = req.body;

            if (!inscripto_id) {
                return res.status(400).json({ 
                    exito: false, 
                    error: 'El campo inscripto_id es obligatorio para realizar la acreditación.' 
                });
            }

            // Verificamos que el inscripto realmente exista antes de acreditar[cite: 6]
            const inscriptoExiste = await InscriptoModel.obtenerPorId(inscripto_id);
            if (!inscriptoExiste) {
                return res.status(404).json({ 
                    exito: false, 
                    error: 'El inscripto especificado no existe en el sistema.' 
                });
            }

            // Guardamos o actualizamos la acreditación mediante el modelo[cite: 6]
            await AcreditacionModel.guardarOActualizar(inscripto_id, presente, documentacion_ok);

            return res.status(200).json({
                exito: true,
                mensaje: 'Acreditación registrada correctamente.',
                inscripto_id
            });
        } catch (error) {
            console.error('Error en AcreditacionController.acreditarInscripto:', error.message);
            return res.status(500).json({ 
                exito: false, 
                error: 'Error interno al registrar la acreditación.' 
            });
        }
    }

    /**
     * Propósito: Validar de forma segura la clave maestra de acceso en el servidor, 
     *            evitando exponer credenciales sensibles en el frontend[cite: 6].
     * A quién alimenta: A la ruta POST /api/acreditaciones/login consumida desde App.vue[cite: 6].
     * Qué datos retorna: Un objeto JSON indicando si el acceso fue autorizado o denegado[cite: 6].
     * 
     * @param {Object} req - Objeto de petición HTTP (contiene req.body.clave)[cite: 6].
     * @param {Object} res - Objeto de respuesta HTTP[cite: 6].
     * @returns {Object} Respuesta JSON con el estado de la autenticación[cite: 6].
     */
    static async verificarClave(req, res) {
        try {
            const { clave } = req.body;
            const claveMaestra = process.env.CLAVE_MAESTRA || 'opriiet24';

            if (clave === claveMaestra) {
                return res.status(200).json({ 
                    exito: true, 
                    mensaje: 'Acceso autorizado correctamente.' 
                });
            } else {
                return res.status(401).json({ 
                    exito: false, 
                    error: 'Clave de acceso incorrecta.' 
                });
            }
        } catch (error) {
            console.error('Error en AcreditacionController.verificarClave:', error.message);
            return res.status(500).json({ 
                exito: false, 
                error: 'Error interno al procesar la autenticación.' 
            });
        }
    }
    /**
     * Propósito: Obtener los datos separados para el módulo de control (Acreditados vs Pendientes).
     */
    static async obtenerReporteAsistencia(req, res) {
        try {
            const acreditados = await InscriptoModel.obtenerAcreditados();
            const pendientes = await InscriptoModel.obtenerPendientes();

            return res.status(200).json({
                exito: true,
                acreditados,
                pendientes
            });
        } catch (error) {
            console.error('Error en AcreditacionController.obtenerReporteAsistencia:', error.message);
            return res.status(500).json({ 
                exito: false, 
                error: 'Error interno al generar el reporte de asistencia.' 
            });
        }
    }

    /**
     * Propósito: Obtener el listado de escuelas existentes para el selector de altas.
     * A quién alimenta: Al formulario de alta de un nuevo alumno reemplazante.
     */
    static async listarEscuelas(req, res) {
        try {
            const query = `SELECT id AS escuela_id, nombre AS escuela_nombre FROM escuelas ORDER BY nombre ASC;`;
            const [rows] = await pool.query(query);
            res.json({ exito: true, data: rows });
        } catch (error) {
            console.error('Error al listar escuelas:', error);
            res.status(500).json({ exito: false, error: 'Error al obtener las escuelas.' });
        }
    }
    /**
     * Propósito: Registrar un nuevo alumno reemplazante (inscripto) en la base de datos.
     * A quién alimenta: Al formulario frontend de alta de nuevos alumnos.
     */
    static async registrarNuevoInscripto(req, res) {
        try {
            const { alumno, dni, escuela_id, modalidad_id, es_suplente } = req.body;

            if (!alumno || !dni || !escuela_id || !modalidad_id) {
                return res.status(400).json({ 
                    exito: false, 
                    error: 'Todos los campos obligatorios deben completarse.' 
                });
            }

            const query = `
                INSERT INTO inscriptos (alumno, dni, escuela_id, modalidad_id, es_suplente)
                VALUES (?, ?, ?, ?, ?);
            `;
            const [resultado] = await pool.query(query, [
                alumno.trim().toUpperCase(),
                dni.trim(),
                escuela_id,
                modalidad_id,
                es_suplente ? 1 : 0
            ]);

            res.status(201).json({
                exito: true,
                mensaje: 'Alumno registrado exitosamente.',
                inscripto_id: resultado.insertId
            });
        } catch (error) {
            console.error('Error al registrar nuevo inscripto:', error);
            res.status(500).json({ 
                exito: false, 
                error: 'Error interno al registrar el alumno.' 
            });
        }
    }

}

module.exports = AcreditacionController;