const express = require('express');
const router = express.Router();
const DocenteController = require('../controllers/DocenteController');

router.get('/', DocenteController.listarTodos);
router.post('/nuevo', DocenteController.registrarNuevo);
router.put('/:id', DocenteController.actualizarDocente);
router.delete('/:id', DocenteController.eliminar);

module.exports = router;