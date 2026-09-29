/**
 * Propósito: Punto de entrada (Entry Point) principal del servidor Node.js. 
 *            Configura Express, los middlewares de seguridad globales (CORS, JSON), 
 *            registra las rutas de la API e inicia el servidor HTTP.
 * A quién alimenta: Al frontend en Vue 3 + Vite mediante peticiones Axios.
 * Qué datos retorna: Respuestas JSON de la API y estado general del servidor.
 */

const express = require('express');
const cors = require('cors');
const acreditacionesRoutes = require('./routes/acreditaciones.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales de seguridad y procesamiento
app.use(cors());
app.use(express.json());

// Registro de Rutas de la API
app.use('/api/acreditaciones', acreditacionesRoutes);

/**
 * Ruta: GET /api/health
 * Propósito: Verificar el estado operativo del backend (Health Check).
 * A quién alimenta: Al cliente o herramientas de monitoreo.
 */
app.get('/api/health', (req, res) => {
    res.json({
        estado: 'ok',
        mensaje: 'Servidor backend de acreditaciones OPRIIET funcionando correctamente bajo arquitectura MVC',
        timestamp: new Date()
    });
});

// Inicialización del servidor HTTP
app.listen(PORT, () => {
    console.log(`Servidor backend corriendo de manera profesional en http://localhost:${PORT}`);
});