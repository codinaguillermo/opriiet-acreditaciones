const express = require('express');
const router = express.Router();
const TorneoController = require('../controllers/TorneoController');

router.post('/sorteo-ronda-1', TorneoController.generarSorteoRonda1);
router.post('/sorteo-siguiente-ronda', TorneoController.generarSorteoSiguienteRonda);
router.get('/llaves/:modalidad_id', TorneoController.obtenerLlaves);
router.get('/pase-libre/:modalidad_id', TorneoController.obtenerPaseLibre);
router.post('/resultado', TorneoController.registrarResultadoCombate);
router.post('/descalificar-permanente', TorneoController.descalificarEquipoPermanentemente);
router.post('/revertir', TorneoController.revertirResultadoCombate);
router.delete('/resetear/:modalidad_id', TorneoController.resetearTorneoModalidad);

module.exports = router;