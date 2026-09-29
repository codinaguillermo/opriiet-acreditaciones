/**
 * Propósito: Capa de Controlador para gestionar la lógica de negocio relacionada con 
 *            la búsqueda de inscriptos, el registro de acreditaciones y la autenticación segura por clave maestra.
 * A quién alimenta: A las rutas de la API (routes/acreditaciones.routes.js).
 * Qué datos retorna: Respuestas HTTP en formato JSON con resultados, confirmaciones de éxito/error y estados de autenticación.
 */

const InscriptoModel = require('../models/Inscripto');
const AcreditacionModel = require('../models/Acreditacion');

class AcreditacionController {

    /**
     * Propósito: Buscar inscriptos por término (DNI o Nombre) y retornar los resultados con sus estados.
     * A quién alimenta: A la ruta GET de búsqueda consultada desde el frontend en Vue.
     * Qué datos retorna: Un objeto JSON con el array de alumnos encontrados o un mensaje de error.
     * 
     * @param {Object} req - Objeto de petición HTTP (contiene req.query.termino).
     * @param {Object} res - Objeto de respuesta HTTP.
     * @returns {Object} Respuesta JSON con los registros o error.
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
     * Propósito: Registrar o actualizar la acreditación (asistencia y documentación) de un inscripto.
     * A quién alimenta: A la ruta POST de acreditaciones al momento de hacer check-in en el evento.
     * Qué datos retorna: Un objeto JSON confirmando el éxito de la operación y el ID procesado.
     * 
     * @param {Object} req - Objeto de petición HTTP (contiene req.body con inscripto_id, presente, documentacion_ok).
     * @param {Object} res - Objeto de respuesta HTTP.
     * @returns {Object} Respuesta JSON con la confirmación de la acreditación.
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

            // Verificamos que el inscripto realmente exista antes de acreditar
            const inscriptoExiste = await InscriptoModel.obtenerPorId(inscripto_id);
            if (!inscriptoExiste) {
                return res.status(404).json({ 
                    exito: false, 
                    error: 'El inscripto especificado no existe en el sistema.' 
                });
            }

            // Guardamos o actualizamos la acreditación mediante el modelo
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
     *            evitando exponer credenciales sensibles en el frontend.
     * A quién alimenta: A la ruta POST /api/acreditaciones/login consumida desde App.vue.
     * Qué datos retorna: Un objeto JSON indicando si el acceso fue autorizado o denegado.
     * 
     * @param {Object} req - Objeto de petición HTTP (contiene req.body.clave).
     * @param {Object} res - Objeto de respuesta HTTP.
     * @returns {Object} Respuesta JSON con el estado de la autenticación.
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
}

module.exports = AcreditacionController;