/**
 * Propósito: Gestionar la lógica de negocio para el sorteo, previsualización y confirmación de los jueces de robótica.
 * A quién alimenta: A las rutas definidas en jueces.routes.js, las cuales son consumidas por el frontend.
 * Qué datos retorna: JSON con el resultado de los sorteos (array de objetos) o confirmaciones de guardado.
 */
const db = require('../config/db');

class JuecesController {
  
  /**
   * Propósito: Realiza un sorteo aleatorio en memoria de 3 titulares y 2 suplentes. 
   *            Prioriza que sean de escuelas distintas. Si no hay suficientes escuelas, 
   *            completa el cupo de 5 garantizando que no se repita la persona.
   * A quién alimenta: Al endpoint GET /jueces/sorteo/previsualizar.
   * Qué datos retorna: JSON con un array de 5 docentes sorteados y su rol, sin tocar la base de datos.
   */
  static async previsualizarSorteo(req, res) {
    try {
      const query = `
        SELECT d.*, e.nombre AS escuela 
        FROM docentes_referentes d
        LEFT JOIN escuelas e ON d.escuela_id = e.id
      `;
      const [docentes] = await db.query(query);
      
      if (docentes.length < 5) {
        return res.status(400).json({ 
          exito: false, 
          error: `Se requieren al menos 5 docentes registrados. Actualmente hay ${docentes.length}.` 
        });
      }

      // Mezcla aleatoria de Fisher-Yates
      let mezclados = [...docentes];
      for (let i = mezclados.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mezclados[i], mezclados[j]] = [mezclados[j], mezclados[i]];
      }

      let seleccionados = [];
      let escuelasVistas = new Set();
      
      for (let docente of mezclados) {
        if (seleccionados.length === 5) break;
        if (!escuelasVistas.has(docente.escuela_id)) {
          seleccionados.push(docente);
          escuelasVistas.add(docente.escuela_id);
        }
      }

      if (seleccionados.length < 5) {
        for (let docente of mezclados) {
          if (seleccionados.length === 5) break;
          const yaEsta = seleccionados.some(d => d.id === docente.id);
          if (!yaEsta) {
            seleccionados.push(docente);
          }
        }
      }

      const resultado = seleccionados.map((doc, index) => ({
        ...doc,
        rol: index < 3 ? 'titular' : 'suplente'
      }));

      return res.json({ exito: true, data: resultado });

    } catch (error) {
      console.error('Error al previsualizar sorteo:', error);
      return res.status(500).json({ exito: false, error: 'Error interno al procesar el algoritmo de sorteo.' });
    }
  }

  /**
   * Propósito: Recuperar el jurado actualmente guardado en la base de datos para mostrarlo en el panel.
   * A quién alimenta: Al endpoint GET /jueces/actual.
   * Qué datos retorna: JSON con los 5 jueces actuales cruzados con los datos del docente y su escuela.
   */
  static async obtenerJuradoActual(req, res) {
     try {
         const query = `
            SELECT j.rol, d.*, e.nombre AS escuela 
            FROM jueces_robotica j
            INNER JOIN docentes_referentes d ON j.docente_id = d.id
            LEFT JOIN escuelas e ON d.escuela_id = e.id
            ORDER BY j.rol ASC, d.nombre_completo ASC
         `;
         const [jurado] = await db.query(query);
         res.json({ exito: true, data: jurado });
     } catch(error) {
         console.error('Error al obtener jurado:', error);
         res.status(500).json({ exito: false, error: 'Error interno al consultar el jurado vigente.' });
     }
  }

  /**
   * Propósito: Guardar de manera persistente el resultado de un sorteo validado, limpiando cualquier jurado anterior.
   * A quién alimenta: Al endpoint POST /jueces/sorteo/confirmar.
   * Qué datos retorna: JSON con el mensaje de éxito de la transacción.
   */
  static async confirmarSorteo(req, res) {
    const { jueces } = req.body; 

    if (!jueces || jueces.length !== 5) {
      return res.status(400).json({ exito: false, error: 'La carga útil debe contener exactamente 5 jueces.' });
    }

    const conexion = await db.getConnection();
    try {
      await conexion.beginTransaction();

      // Limpiar registros viejos (se mantiene un único jurado activo)
      await conexion.query('TRUNCATE TABLE jueces_robotica');

      // Inserción masiva de los 5 registros nuevos
      const values = jueces.map(j => [j.id, j.rol]); 
      await conexion.query('INSERT INTO jueces_robotica (docente_id, rol) VALUES ?', [values]);

      await conexion.commit();
      res.json({ exito: true, mensaje: 'Jurado oficial guardado exitosamente.' });
    } catch (error) {
      await conexion.rollback();
      console.error('Error al confirmar sorteo:', error);
      res.status(500).json({ exito: false, error: 'Error interno en base de datos al guardar el jurado.' });
    } finally {
      conexion.release();
    }
  }

}

module.exports = JuecesController;