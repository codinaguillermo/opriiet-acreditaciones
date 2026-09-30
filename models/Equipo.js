/**
 * Propósito: Capa de Modelo (Capa de Datos) para gestionar la creación, consulta, 
 *            actualización y eliminación de equipos y sus relaciones con los integrantes,
 *            aplicando validaciones estrictas de reglas de negocio por modalidad.
 * A quién alimenta: Al controlador de equipos (EquipoController)[cite: 9].
 * Qué datos retorna: Registros de equipos, integrantes y estados de transacciones en MySQL[cite: 10].
 */

const pool = require('../config/db');

class EquipoModel {

    /**
     * Propósito: Crear un nuevo equipo y asociar su lista de integrantes mediante una transacción segura,
     *            verificando estrictamente que todos pertenezcan a la modalidad seleccionada.
     * A quién alimenta: Al controlador para procesar el formulario de alta de equipos[cite: 10].
     * Qué datos retorna: El ID del equipo recién creado[cite: 10].
     * 
     * @param {Object} datos - Datos del equipo (nombre_equipo, modalidad_id, integrantes: [inscripto_id, ...]).
     */
    static async crear(datos) {
        const { nombre_equipo, modalidad_id, integrantes } = datos;
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            if (!integrantes || integrantes.length === 0) {
                throw new Error('El equipo debe tener al menos un integrante.');
            }
            
            // 1. Validar estrictamente que TODOS los integrantes pertenezcan a la modalidad seleccionada
            for (const inscriptoId of integrantes) {
                const [alumnoRows] = await connection.query(
                    'SELECT id, alumno, modalidad_id, escuela_id FROM inscriptos WHERE id = ? LIMIT 1', 
                    [inscriptoId]
                );

                if (alumnoRows.length === 0) {
                    throw new Error(`El alumno con ID ${inscriptoId} no existe en el sistema.`);
                }

                const alumno = alumnoRows[0];

                if (Number(alumno.modalidad_id) !== Number(modalidad_id)) {
                    throw new Error(`El alumno "${alumno.alumno}" no está inscripto en la modalidad seleccionada para este equipo.`);
                }
            }

            // 2. Obtener la escuela_id del primer integrante para asignarla al equipo (asumiendo equipo unificado por escuela)
            const [alumnoPrincipal] = await connection.query(
                'SELECT escuela_id FROM inscriptos WHERE id = ? LIMIT 1', 
                [integrantes[0]]
            );
            const escuela_id = alumnoPrincipal[0].escuela_id;

            // 3. Insertar el equipo principal[cite: 10]
            const [resultadoEquipo] = await connection.query(
                `INSERT INTO equipos (escuela_id, modalidad_id, nombre_equipo) VALUES (?, ?, ?)`,
                [escuela_id, modalidad_id, nombre_equipo.trim()]
            );

            const equipoId = resultadoEquipo.insertId;

            // 4. Insertar los integrantes en la tabla intermedia[cite: 10]
            for (const inscriptoId of integrantes) {
                await connection.query(
                    `INSERT INTO equipo_integrantes (equipo_id, inscripto_id) VALUES (?, ?)`,
                    [equipoId, inscriptoId]
                );
            }

            await connection.commit();
            return equipoId;

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Propósito: Obtener todos los equipos registrados con su escuela, modalidad y listado de alumnos[cite: 10].
     * A quién alimenta: Al panel general de listado de equipos por categoría y modalidad[cite: 10].
     * Qué datos retorna: Un array estructurado con los equipos y sus respectivos integrantes[cite: 10].
     */
    static async obtenerTodos() {
        const queryEquipos = `
            SELECT 
                eq.id AS equipo_id,
                eq.nombre_equipo,
                e.nombre AS escuela,
                m.id AS modalidad_id,
                m.nombre AS modalidad,
                c.id AS categoria_id,
                c.nombre AS categoria
            FROM equipos eq
            JOIN escuelas e ON eq.escuela_id = e.id
            JOIN modalidades m ON eq.modalidad_id = m.id
            JOIN categorias c ON m.categoria_id = c.id
            ORDER BY c.nombre, m.nombre, eq.nombre_equipo;
        `;

        const [equipos] = await pool.query(queryEquipos);

        for (let equipo of equipos) {
            const queryIntegrantes = `
                SELECT 
                    i.id AS inscripto_id,
                    i.dni,
                    i.alumno,
                    ei.es_suplente
                FROM equipo_integrantes ei
                JOIN inscriptos i ON ei.inscripto_id = i.id
                WHERE ei.equipo_id = ?
            `;
            const [integrantes] = await pool.query(queryIntegrantes, [equipo.equipo_id]);
            equipo.integrantes = integrantes;
        }

        return equipos;
    }

    /**
     * Propósito: Actualizar un equipo existente validando que los integrantes pertenezcan a la modalidad[cite: 10].
     * A quién alimenta: Al controlador para la edición de equipos[cite: 10].
     */
    static async actualizar(equipoId, datos) {
        const { nombre_equipo, modalidad_id, integrantes } = datos;
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            if (!integrantes || integrantes.length === 0) {
                throw new Error('El equipo debe tener al menos un integrante.');
            }

            // Validar modalidad de cada integrante en actualización
            for (const inscriptoId of integrantes) {
                const [alumnoRows] = await connection.query(
                    'SELECT id, alumno, modalidad_id FROM inscriptos WHERE id = ? LIMIT 1', 
                    [inscriptoId]
                );

                if (alumnoRows.length === 0) {
                    throw new Error(`El alumno con ID ${inscriptoId} no existe.`);
                }

                const alumno = alumnoRows[0];
                if (Number(alumno.modalidad_id) !== Number(modalidad_id)) {
                    throw new Error(`El alumno "${alumno.alumno}" no pertenece a la modalidad seleccionada.`);
                }
            }

            const [alumnoPrincipal] = await connection.query(
                'SELECT escuela_id FROM inscriptos WHERE id = ? LIMIT 1', 
                [integrantes[0]]
            );
            const escuela_id = alumnoPrincipal[0].escuela_id;

            // Actualizar datos principales del equipo[cite: 10]
            await connection.query(
                `UPDATE equipos SET escuela_id = ?, modalidad_id = ?, nombre_equipo = ? WHERE id = ?`,
                [escuela_id, modalidad_id, nombre_equipo.trim(), equipoId]
            );

            // Reemplazar integrantes[cite: 10]
            await connection.query(`DELETE FROM equipo_integrantes WHERE equipo_id = ?`, [equipoId]);

            for (const inscriptoId of integrantes) {
                await connection.query(
                    `INSERT INTO equipo_integrantes (equipo_id, inscripto_id) VALUES (?, ?)`,
                    [equipoId, inscriptoId]
                );
            }

            await connection.commit();
            return true;

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Propósito: Eliminar un equipo de la base de datos[cite: 10].
     */
    static async eliminar(equipoId) {
        const [resultado] = await pool.query(`DELETE FROM equipos WHERE id = ?`, [equipoId]);
        return resultado.affectedRows > 0;
    }
}

module.exports = EquipoModel;