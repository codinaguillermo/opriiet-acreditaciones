/**
 * Propósito: Definir las rutas HTTP específicas para la gestión de jueces y sorteos.
 * A quién alimenta: Al archivo principal server.js para ser montadas en el prefijo /api/jueces.
 * Qué datos retorna: Deriva el tráfico de red hacia los métodos correspondientes en JuecesController.
 */
const express = require('express');
const router = express.Router();
const JuecesController = require('../controllers/JuecesController');

router.get('/sorteo/previsualizar', JuecesController.previsualizarSorteo);
router.post('/sorteo/confirmar', JuecesController.confirmarSorteo);
router.get('/actual', JuecesController.obtenerJuradoActual);

module.exports = router;