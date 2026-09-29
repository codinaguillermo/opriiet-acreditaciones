/**
 * Propósito: Capa de Modelo (Capa de Datos) para registrar o actualizar 
 *            las acreditaciones y asistencias de los alumnos en MySQL.
 * A quién alimenta: Al controlador de acreditaciones (AcreditacionController).
 * Qué datos retorna: Resultado de la operación de inserción o actualización en la base de datos.
 */

const pool = require('../config/db');

class AcreditacionModel {

    /**
     * Propósito: Registrar o actualizar la acreditación de un alumno inscripto (Upsert).
     * A quién alimenta: Al controlador de acreditaciones al momento de procesar un check-in.
     * Qué datos retorna: El ID del inscripto acreditado.
     * 
     * @param {number} inscriptoId - ID del registro en la tabla inscriptos.
     * @param {boolean} presente - Estado de asistencia.
     * @param {boolean} documentacionOk - Estado de la documentación.
     * @returns {Promise<number>} ID del inscripto procesado.
     */
    static async guardarOActualizar(inscriptoId, presente, documentacionOk) {
        const query = `
            INSERT INTO acreditaciones (inscripto_id, presente, documentacion_ok, fecha_hora)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE 
                presente = VALUES(presente),
                documentacion_ok = VALUES(documentacion_ok),
                fecha_hora = CURRENT_TIMESTAMP;
        `;

        await pool.query(query, [
            inscriptoId, 
            presente !== undefined ? presente : true, 
            documentacionOk !== undefined ? documentacionOk : true
        ]);

        return inscriptoId;
    }
}

module.exports = AcreditacionModel;