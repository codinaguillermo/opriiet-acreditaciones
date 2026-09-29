/**
 * Propósito: Configurar y exportar el Pool de conexiones a la base de datos MySQL 
 *            utilizando promesas para asegurar operaciones asíncronas limpias y eficientes.
 * A quién alimenta: A los modelos de la aplicación (capa de datos).
 * Qué datos retorna: Una instancia de conexión activa (Pool) para realizar consultas SQL seguras.
 */

const mysql = require('mysql2/promise');

// Configuración de la conexión utilizando variables de entorno o valores por defecto seguros
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'acreditaciones_opriiet',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

/**
 * Propósito: Verificar de manera inicial el estado de la conexión con MySQL.
 * A quién alimenta: Al script principal al momento de arrancar el servidor.
 * Qué datos retorna: Un mensaje por consola confirmando el éxito o lanza un error crítico si falla.
 */
async function probarConexion() {
    try {
        const connection = await pool.getConnection();
        console.log('¡Conexión establecida correctamente con la base de datos MySQL (Pool activo)!');
        connection.release();
    } catch (error) {
        console.error('Error crítico al conectar con la base de datos:', error.message);
        process.exit(1);
    }
}

probarConexion();

module.exports = pool;