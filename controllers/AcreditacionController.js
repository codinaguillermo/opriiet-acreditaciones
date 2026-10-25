/**
 * Propósito: Capa de Controlador para gestionar la lógica de negocio relacionada con 
 *            la búsqueda de inscriptos, el registro de acreditaciones, la eliminación y la autenticación.
 * A quién alimenta: A las rutas de la API (routes/acreditaciones.routes.js).
 * Qué datos retorna: Respuestas HTTP en formato JSON con resultados y confirmaciones.
 */

const InscriptoModel = require('../models/Inscripto');
const AcreditacionModel = require('../models/Acreditacion');
const pool = require('../config/db');

class AcreditacionController {

    static async listarTodos(req, res) {
        try {
            const inscriptos = await InscriptoModel.obtenerTodosConEstado();
            return res.status(200).json({ exito: true, total: inscriptos.length, data: inscriptos });
        } catch (error) {
            console.error('Error en AcreditacionController.listarTodos:', error.message);
            return res.status(500).json({ exito: false, error: 'Error interno al obtener el listado de inscriptos.' });
        }
    }

    static async buscarInscriptos(req, res) {
        try {
            const { termino } = req.query;
            if (!termino || termino.trim() === '') {
                return res.status(400).json({ exito: false, error: 'Debe proveer un término de búsqueda válido.' });
            }
            const inscriptos = await InscriptoModel.buscarPorTermino(termino);
            return res.status(200).json({ exito: true, total: inscriptos.length, data: inscriptos });
        } catch (error) {
            console.error('Error en AcreditacionController.buscarInscriptos:', error.message);
            return res.status(500).json({ exito: false, error: 'Error interno al procesar la búsqueda en la base de datos.' });
        }
    }

    static async acreditarInscripto(req, res) {
        try {
            const { inscripto_id, presente, documentacion_ok } = req.body;
            if (!inscripto_id) {
                return res.status(400).json({ exito: false, error: 'El campo inscripto_id es obligatorio.' });
            }
            const inscriptoExiste = await InscriptoModel.obtenerPorId(inscripto_id);
            if (!inscriptoExiste) {
                return res.status(404).json({ exito: false, error: 'El inscripto especificado no existe.' });
            }
            await AcreditacionModel.guardarOActualizar(inscripto_id, presente, documentacion_ok);
            return res.status(200).json({ exito: true, mensaje: 'Acreditación registrada correctamente.', inscripto_id });
        } catch (error) {
            console.error('Error en AcreditacionController.acreditarInscripto:', error.message);
            return res.status(500).json({ exito: false, error: 'Error interno al registrar la acreditación.' });
        }
    }

    static async verificarClave(req, res) {
        try {
            const { clave } = req.body;
            const claveMaestra = process.env.CLAVE_MAESTRA || 'opriiet24';
            if (clave === claveMaestra) {
                return res.status(200).json({ exito: true, mensaje: 'Acceso autorizado correctamente.' });
            } else {
                return res.status(401).json({ exito: false, error: 'Clave de acceso incorrecta.' });
            }
        } catch (error) {
            console.error('Error en AcreditacionController.verificarClave:', error.message);
            return res.status(500).json({ exito: false, error: 'Error interno al procesar la autenticación.' });
        }
    }

    static async obtenerReporteAsistencia(req, res) {
        try {
            const acreditados = await InscriptoModel.obtenerAcreditados();
            const pendientes = await InscriptoModel.obtenerPendientes();
            return res.status(200).json({ exito: true, acreditados, pendientes });
        } catch (error) {
            console.error('Error en AcreditacionController.obtenerReporteAsistencia:', error.message);
            return res.status(500).json({ exito: false, error: 'Error interno al generar el reporte.' });
        }
    }

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

    static async registrarNuevoInscripto(req, res) {
        try {
            const { alumno, dni, escuela_id, modalidades, es_suplente } = req.body;

            if (!alumno || !dni || !escuela_id || !modalidades || !Array.isArray(modalidades) || modalidades.length === 0) {
                return res.status(400).json({ 
                    exito: false, 
                    error: 'Todos los campos obligatorios deben completarse y debe seleccionar al menos una modalidad.' 
                });
            }

            const query = `
                INSERT INTO inscriptos (alumno, dni, escuela_id, modalidad_id, es_suplente)
                VALUES (?, ?, ?, ?, ?);
            `;
            
            const promesasInsert = modalidades.map(modalidad_id => {
                return pool.query(query, [
                    alumno.trim().toUpperCase(),
                    dni.trim(),
                    escuela_id,
                    modalidad_id,
                    es_suplente ? 1 : 0
                ]);
            });

            await Promise.all(promesasInsert);

            res.status(201).json({
                exito: true,
                mensaje: 'Alumno registrado exitosamente en las modalidades indicadas.'
            });
        } catch (error) {
            console.error('Error al registrar nuevo inscripto múltiple:', error);
            res.status(500).json({ 
                exito: false, 
                error: 'Error interno al registrar las inscripciones del alumno.' 
            });
        }
    }

    /**
     * Propósito: Eliminar físicamente a un estudiante, sus integraciones a equipos, 
     *            equipos huérfanos resultantes y sus registros de inscripción mediante una unica transacción.
     */
    static async eliminarInscriptosPorDni(req, res) {
        const { dni } = req.params;
        if (!dni) {
            return res.status(400).json({ exito: false, error: 'El DNI es requerido para la eliminación.' });
        }

        // Solicitamos una conexión dedicada del pool para manejar la transacción
        const conexion = await pool.getConnection();
        
        try {
            await conexion.beginTransaction();

            // 1. Obtener los IDs (clave primaria 'id') de los inscriptos con ese DNI
            const [inscriptos] = await conexion.query(`SELECT id FROM inscriptos WHERE dni = ?`, [dni.trim()]);
            
            if (inscriptos.length === 0) {
                await conexion.rollback();
                return res.status(404).json({ exito: false, error: 'No se encontraron inscripciones para el DNI indicado.' });
            }
            
            const inscriptosIds = inscriptos.map(i => i.id);

            // 2. Identificar equipos afectados antes de borrar a los integrantes
            // NOTA: Asumimos que los campos se llaman 'equipo_id' e 'inscripto_id'.
            const [integraciones] = await conexion.query(
                `SELECT DISTINCT equipo_id FROM equipo_integrantes WHERE inscripto_id IN (?)`,
                [inscriptosIds]
            );
            const equiposAfectadosIds = integraciones.map(i => i.equipo_id);

            // 3. Eliminar al alumno de los equipos a los que pertenece
            await conexion.query(`DELETE FROM equipo_integrantes WHERE inscripto_id IN (?)`, [inscriptosIds]);

            // 4. Limpiar equipos que hayan quedado sin ningún integrante (huérfanos)
            if (equiposAfectadosIds.length > 0) {
                // Buscamos si los equipos afectados aún tienen otros integrantes
                const [equiposActivos] = await conexion.query(
                    `SELECT DISTINCT equipo_id FROM equipo_integrantes WHERE equipo_id IN (?)`,
                    [equiposAfectadosIds]
                );
                
                const activosIds = equiposActivos.map(i => i.equipo_id);
                // Filtramos los equipos que ya no aparecen en equipo_integrantes
                const huerfanosIds = equiposAfectadosIds.filter(id => !activosIds.includes(id));

                if (huerfanosIds.length > 0) {
                    // La PK de equipos es 'id' según la estructura de la base de datos
                    await conexion.query(`DELETE FROM equipos WHERE id IN (?)`, [huerfanosIds]);
                }
            }

            // 5. Finalmente, eliminar los registros del estudiante en inscriptos
            const [resultadoFinal] = await conexion.query(`DELETE FROM inscriptos WHERE dni = ?`, [dni.trim()]);

            // Confirmar transacción
            await conexion.commit();

            return res.status(200).json({
                exito: true,
                mensaje: `Estudiante eliminado completamente. Se borraron ${resultadoFinal.affectedRows} registros de inscripción y se limpiaron equipos huérfanos de ser necesario.`
            });

        } catch (error) {
            // Si cualquier consulta falla, revertimos todos los cambios
            await conexion.rollback();
            console.error('Error en transacción de eliminación:', error);
            return res.status(500).json({ exito: false, error: 'Error interno de base de datos durante la eliminación en cascada.' });
        } finally {
            // Liberamos la conexión de vuelta al pool
            conexion.release();
        }
    }
}

module.exports = AcreditacionController;