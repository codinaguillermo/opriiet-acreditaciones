/**
 * Propósito: Capa de Controlador para gestionar los Docentes Referentes.
 * A quién alimenta: A las rutas de la API (routes/docentes.routes.js).
 * Qué datos retorna: Respuestas HTTP en formato JSON.
 */

const pool = require('../config/db');

class DocenteController {
    
    /**
     * Propósito: Obtener la lista completa de docentes con nombres de relaciones resueltos mediante JOINs y sus IDs para edición.
     * A quién alimenta: Al endpoint GET /api/docentes consumido por el frontend.
     * Qué datos retorna: JSON con el array de docentes.
     */
    static async listarTodos(req, res) {
        try {
            const query = `
                SELECT d.id, d.dni, d.nombre_completo, d.escuela_id, d.categoria_id, d.modalidad_id,
                       e.nombre AS escuela, m.nombre AS modalidad, c.nombre AS categoria
                FROM docentes_referentes d
                INNER JOIN escuelas e ON d.escuela_id = e.id
                INNER JOIN modalidades m ON d.modalidad_id = m.id
                INNER JOIN categorias c ON d.categoria_id = c.id
                ORDER BY d.nombre_completo ASC;
            `;
            const [rows] = await pool.query(query);
            return res.status(200).json({ exito: true, data: rows });
        } catch (error) {
            console.error('Error en DocenteController.listarTodos:', error.message);
            return res.status(500).json({ exito: false, error: 'Error interno al obtener docentes.' });
        }
    }

    /**
     * Propósito: Registrar un nuevo docente referente en la base de datos.
     * A quién alimenta: Al endpoint POST /api/docentes/nuevo consumido por el frontend.
     * Qué datos retorna: JSON con mensaje de éxito o error.
     */
    static async registrarNuevo(req, res) {
        try {
            const { escuela_id, modalidad_id, categoria_id, nombre_completo, dni } = req.body;

            if (!escuela_id || !modalidad_id || !categoria_id || !nombre_completo) {
                return res.status(400).json({ exito: false, error: 'Todos los campos obligatorios deben completarse.' });
            }

            // Normalizamos el DNI: si viene vacío o nulo, guardamos NULL en la base de datos
            const dniValor = dni && dni.trim() !== '' ? dni.trim() : null;

            const query = `
                INSERT INTO docentes_referentes (escuela_id, modalidad_id, categoria_id, nombre_completo, dni)
                VALUES (?, ?, ?, ?, ?);
            `;
            
            await pool.query(query, [escuela_id, modalidad_id, categoria_id, nombre_completo.trim().toUpperCase(), dniValor]);
            
            return res.status(201).json({ exito: true, mensaje: 'Docente registrado exitosamente.' });
        } catch (error) {
            console.error('Error en DocenteController.registrarNuevo:', error.message);
            return res.status(500).json({ exito: false, error: 'Error interno al registrar el docente.' });
        }
    }

    /**
     * Propósito: Actualizar los datos de un docente referente existente en la base de datos.
     * A quién alimenta: Al endpoint PUT /api/docentes/:id consumido por el frontend.
     * Qué datos retorna: JSON con el mensaje de éxito o un error descriptivo.
     */
    static async actualizarDocente(req, res) {
        const { id } = req.params;
        const { nombre_completo, escuela_id, categoria_id, modalidad_id, dni } = req.body;

        if (!nombre_completo || !escuela_id || !categoria_id || !modalidad_id) {
            return res.status(400).json({ exito: false, error: 'Todos los campos obligatorios deben completarse.' });
        }

        try {
            const dniValor = dni && dni.trim() !== '' ? dni.trim() : null;

            const query = `
                UPDATE docentes_referentes 
                SET nombre_completo = ?, escuela_id = ?, categoria_id = ?, modalidad_id = ?, dni = ? 
                WHERE id = ?
            `;
            const [resultado] = await pool.query(query, [
                nombre_completo.trim().toUpperCase(), 
                escuela_id, 
                categoria_id, 
                modalidad_id, 
                dniValor,
                id
            ]);

            if (resultado.affectedRows === 0) {
                return res.status(404).json({ exito: false, error: 'Docente no encontrado.' });
            }

            return res.json({ exito: true, mensaje: 'Docente actualizado correctamente.' });
        } catch (error) {
            console.error('Error al actualizar docente:', error);
            return res.status(500).json({ exito: false, error: 'Error interno en base de datos al actualizar el docente.' });
        }
    }

    /**
     * Propósito: Realizar el borrado físico de un docente referente de la base de datos.
     * A quién alimenta: Al endpoint DELETE /api/docentes/:id consumido por el frontend.
     * Qué datos retorna: JSON con mensaje de éxito o error.
     */
    static async eliminar(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ exito: false, error: 'ID de docente no proporcionado.' });
            }
            
            const [resultado] = await pool.query(`DELETE FROM docentes_referentes WHERE id = ?`, [id]);
            
            if (resultado.affectedRows === 0) {
                return res.status(404).json({ exito: false, error: 'Docente no encontrado.' });
            }
            
            return res.status(200).json({ exito: true, mensaje: 'Docente eliminado correctamente.' });
        } catch (error) {
            console.error('Error en DocenteController.eliminar:', error.message);
            return res.status(500).json({ exito: false, error: 'Error interno al eliminar el docente.' });
        }
    }
}

module.exports = DocenteController;