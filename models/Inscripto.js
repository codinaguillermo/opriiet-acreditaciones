/**
 * Propósito: Capa de Modelo (Capa de Datos) para gestionar las consultas y operaciones 
 *            relacionadas con los inscriptos, sus escuelas, modalidades y estados de acreditación.
 * A quién alimenta: A los controladores del backend (ej. AcreditacionController).
 * Qué datos retorna: Registros y conjuntos de datos estructurados desde la base de datos MySQL.
 */

const pool = require('../config/db');

class InscriptoModel {

    /**
     * Propósito: Obtener únicamente los alumnos que YA pasaron por acreditación (presente = true).
     */
    static async obtenerAcreditados() {
        const query = `
            SELECT 
                i.id AS inscripto_id,
                i.alumno,
                i.dni,
                i.es_suplente,
                e.nombre AS escuela,
                m.nombre AS modalidad,
                a.fecha_hora
            FROM inscriptos i
            JOIN escuelas e ON i.escuela_id = e.id
            JOIN modalidades m ON i.modalidad_id = m.id
            JOIN acreditaciones a ON i.id = a.inscripto_id
            WHERE a.presente = TRUE
            ORDER BY a.fecha_hora DESC;
        `;
        const [rows] = await pool.query(query);
        return rows;
    }

    /**
     * Propósito: Obtener el listado de todas las escuelas existentes para los selectores.
     * A quién alimenta: Al formulario de alta de un nuevo alumno reemplazante.
     */
    static async obtenerEscuelas() {
        const query = `SELECT id AS escuela_id, nombre AS escuela_nombre FROM escuelas ORDER BY nombre ASC;`;
        const [rows] = await pool.query(query);
        return rows;
    }

    /**
     * Propósito: Registrar un nuevo alumno inscripto en el sistema (reemplazante).
     * A quién alimenta: Al controlador de alta de inscriptos.
     */
    static async registrarNuevo(datos) {
        const { alumno, dni, escuela_id, modalidad_id, es_suplente } = datos;
        
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

        return resultado.insertId;
    }

    /**
     * Propósito: Obtener únicamente los alumnos PENDIENTES (la resta/diferencia: inscriptos que NO están acreditados).
     */
    static async obtenerPendientes() {
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
            WHERE i.id NOT IN (
                SELECT inscripto_id FROM acreditaciones WHERE presente = TRUE
            )
            ORDER BY i.alumno ASC;
        `;
        const [rows] = await pool.query(query);
        return rows;
    }

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

    /**
     * Propósito: Actualizar los datos de un alumno inscripto existente.
     * A quién alimenta: Al controlador de edición de inscriptos.
     */
    static async actualizar(id, datos) {
        const { alumno, dni, escuela_id, modalidad_id, es_suplente } = datos;
        
        const query = `
            UPDATE inscriptos 
            SET alumno = ?, dni = ?, escuela_id = ?, modalidad_id = ?, es_suplente = ?
            WHERE id = ?;
        `;
        const [resultado] = await pool.query(query, [
            alumno.trim().toUpperCase(),
            dni.trim(),
            escuela_id,
            modalidad_id,
            es_suplente ? 1 : 0,
            id
        ]);

        return resultado.affectedRows;
    }
}

module.exports = InscriptoModel;