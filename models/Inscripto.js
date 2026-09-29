/**
 * Propósito: Capa de Modelo (Capa de Datos) para gestionar las consultas y operaciones 
 *            relacionadas con los inscriptos, sus escuelas, modalidades y estados de acreditación.
 * A quién alimenta: A los controladores del backend (ej. AcreditacionController).
 * Qué datos retorna: Registros y conjuntos de datos estructurados desde la base de datos MySQL.
 */

const pool = require('../config/db');

class InscriptoModel {

    /**
     * Propósito: Buscar inscriptos por DNI o coincidencia en el nombre del alumno, 
     *            uniendo las tablas de escuelas, modalidades y el estado actual de acreditación.
     * A quién alimenta: Al controlador de búsqueda para el puesto de acreditación en la entrada.
     * Qué datos retorna: Un Array de objetos JSON con los datos del inscripto, escuela, modalidad y estado de acreditación.
     * 
     * @param {string} termino - Término de búsqueda ingresado por el operador (DNI o Nombre/Apellido).
     * @returns {Promise<Array>} Lista de registros coincidentes obtenidos de MySQL.
     */
    static async buscarPorTermino(termino) {
        const query = `
            SELECT 
                i.id AS inscripto_id,
                i.alumno,
                i.dni,
                i.es_suplente,
                e.nombre AS escuela,
                m.nombre AS modalidad,
                COALESCE(a.presente, FALSE) AS presente,
                COALESCE(a.documentacion_ok, FALSE) AS documentacion_ok,
                a.fecha_hora
            FROM inscriptos i
            JOIN escuelas e ON i.escuela_id = e.id
            JOIN modalidades m ON i.modalidad_id = m.id
            LEFT JOIN acreditaciones a ON i.id = a.inscripto_id
            WHERE i.dni LIKE ? OR i.alumno LIKE ?
            LIMIT 50;
        `;

        const busqueda = `%${termino.trim()}%`;
        const [rows] = await pool.query(query, [busqueda, busqueda]);
        return rows;
    }

    /**
     * Propósito: Obtener un inscripto específico por su ID primario junto con su información asociada.
     * A quién alimenta: Al controlador para verificar la existencia del alumno antes de impactar una acreditación.
     * Qué datos retorna: Un objeto JSON plano con los datos del inscripto y su acreditación, o null si no se encuentra.
     * 
     * @param {number} id - ID único del inscripto en la base de datos.
     * @returns {Promise<Object|null>} Objeto con el registro del alumno o null si no existe.
     */
    static async obtenerPorId(id) {
        const query = `
            SELECT 
                i.id AS inscripto_id,
                i.alumno,
                i.dni,
                i.es_suplente,
                e.nombre AS escuela,
                m.nombre AS modalidad,
                COALESCE(a.presente, FALSE) AS presente,
                COALESCE(a.documentacion_ok, FALSE) AS documentacion_ok,
                a.fecha_hora
            FROM inscriptos i
            JOIN escuelas e ON i.escuela_id = e.id
            JOIN modalidades m ON i.modalidad_id = m.id
            LEFT JOIN acreditaciones a ON i.id = a.inscripto_id
            WHERE i.id = ?
            LIMIT 1;
        `;

        const [rows] = await pool.query(query, [id]);
        return rows.length > 0 ? rows[0] : null;
    }
}

module.exports = InscriptoModel;