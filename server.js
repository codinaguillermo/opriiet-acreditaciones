/**
 * Propósito: Punto de entrada (Entry Point) principal del servidor Node.js. 
 *            Configura Express, los middlewares de seguridad globales (CORS, JSON), 
 *            registra las rutas de la API, sirve los archivos estáticos de Vue y arranca el servidor HTTP.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const acreditacionesRoutes = require('./routes/acreditaciones.routes');
const equiposRoutes = require('./routes/equipos.routes');
const torneoRoutes = require('./routes/torneo.routes');

const app = express();
const PORT = process.env.PORT || 80;

// Middlewares globales de seguridad y procesamiento
app.use(cors());
app.use(express.json());

// 1. Registro de Rutas de la API (Siempre antes de las rutas estáticas y del comodín)
app.use('/api/acreditaciones', acreditacionesRoutes);
app.use('/api/equipos', equiposRoutes);
app.use('/api/torneo', torneoRoutes);

/**
 * Ruta: GET /api/health
 * Propósito: Verificar el estado operativo del backend.
 */
app.get('/api/health', (req, res) => {
    res.json({
        estado: 'ok',
        mensaje: 'Servidor backend de acreditaciones OPRIIET funcionando correctamente bajo arquitectura MVC',
        timestamp: new Date()
    });
});

// 2. Exponer la carpeta "dist" del frontend compilado como archivos estáticos
app.use(express.static(path.join(__dirname, 'dist')));

// 3. Fallback para la SPA (Vue Router)
// Cualquier petición GET que no coincida con "/api/..." devolverá el index.html del frontend.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Inicialización del servidor HTTP
app.listen(PORT, () => {
    console.log(`Servidor de producción OPRIIET corriendo en el puerto ${PORT}`);
});