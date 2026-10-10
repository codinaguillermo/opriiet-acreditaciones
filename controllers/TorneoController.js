/**
 * Propósito: Gestionar la lógica del torneo de sumo mediante una función evaluadora central,
 *            aplicando el razonamiento estricto de lápiz y papel para el avance de rondas, 
 *            zonas y control global de pases libres.
 * A quién alimenta: A las rutas de torneo (/api/torneo/*).
 * Qué datos retorna: Objetos JSON con el estado de las operaciones, llaves y avisos.
 */
const pool = require('../config/db');

const TorneoController = {

    async generarSorteoRonda1(req, res) {
        const { modalidad_id } = req.body;

        if (!modalidad_id) {
            return res.status(400).json({ exito: false, error: 'Debe especificar el ID de la modalidad.' });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [combatesExistentes] = await connection.query(
                `SELECT id FROM llaves_combates WHERE modalidad_id = ? AND ronda = 1 LIMIT 1`,
                [modalidad_id]
            );

            if (combatesExistentes.length > 0) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ 
                    exito: false, 
                    error: 'Ya se ha generado el sorteo de la Ronda 1 para esta modalidad.' 
                });
            }

            const [equipos] = await connection.query(
                `SELECT id, nombre_equipo FROM equipos WHERE modalidad_id = ? AND estado = 'activo'`,
                [modalidad_id]
            );

            if (equipos.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(200).json({ 
                    exito: false, 
                    estado_modalidad: 'vacante',
                    error: 'Modalidad vacante: no hay equipos activos registrados.' 
                });
            }

            if (equipos.length === 1) {
                await connection.rollback();
                connection.release();
                return res.status(200).json({ 
                    exito: false, 
                    estado_modalidad: 'campeon_directo',
                    equipo: equipos[0],
                    error: `Hay un solo equipo (${equipos[0].nombre_equipo}) registrado. ¡Es el campeón directo!` 
                });
            }

            await connection.query(
                `INSERT INTO estado_zonas_torneo (modalidad_id, ganador_zona_a_id, ganador_zona_b_id) VALUES (?, NULL, NULL)
                 ON DUPLICATE KEY UPDATE ganador_zona_a_id = NULL, ganador_zona_b_id = NULL`,
                [modalidad_id]
            );

            const equiposMezclados = [...equipos];
            for (let i = equiposMezclados.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [equiposMezclados[i], equiposMezclados[j]] = [equiposMezclados[j], equiposMezclados[i]];
            }

            let equiposParaPelear = [...equiposMezclados];
            let equipoConPaseLibre = null;

            if (equiposParaPelear.length % 2 !== 0) {
                equipoConPaseLibre = equiposParaPelear.pop();
                
                // Se registra en la tabla temporal y también en el historial definitivo desde la Ronda 1
                await connection.query(
                    `INSERT INTO pases_libres (modalidad_id, equipo_id, ronda, grupo) VALUES (?, ?, 1, 'A')`,
                    [modalidad_id, equipoConPaseLibre.id]
                );
                await connection.query(
                    `INSERT INTO historial_pases_libres (modalidad_id, equipo_id, ronda, grupo) VALUES (?, ?, 1, 'A')`,
                    [modalidad_id, equipoConPaseLibre.id]
                );
                await connection.query(
                    `UPDATE equipos SET grupo_actual = 'A', recibio_pase_libre = 1 WHERE id = ?`,
                    [equipoConPaseLibre.id]
                );
            }

            const combatesGenerados = [];
            for (let i = 0; i < equiposParaPelear.length; i += 2) {
                const robot1 = equiposParaPelear[i];
                const robot2 = equiposParaPelear[i + 1];

                const [resultadoCombate] = await connection.query(
                    `INSERT INTO llaves_combates (modalidad_id, ronda, grupo, robot_1_id, robot_2_id, estado) 
                     VALUES (?, 1, 'A', ?, ?, 'pendiente')`,
                    [modalidad_id, robot1.id, robot2.id]
                );

                combatesGenerados.push({
                    combate_id: resultadoCombate.insertId,
                    robot_1: robot1,
                    robot_2: robot2
                });
            }

            await connection.commit();
            connection.release();

            return res.json({
                exito: true,
                mensaje: 'Sorteo de Ronda 1 generado exitosamente.',
                combates: combatesGenerados
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            console.error('Error al generar sorteo:', error);
            return res.status(500).json({ exito: false, error: 'Error interno al generar el sorteo.' });
        }
    },

    async obtenerPaseLibre(req, res) {
        const { modalidad_id } = req.params;
        const { ronda, grupo } = req.query;

        try {
            const rondaConsultar = ronda || 1;
            const grupoConsultar = grupo || 'A';
            
            const query = `
                SELECT 
                    e.id, 
                    e.nombre_equipo,
                    esc.nombre AS escuela_nombre
                FROM pases_libres pl
                JOIN equipos e ON pl.equipo_id = e.id
                LEFT JOIN escuelas esc ON e.escuela_id = esc.id
                WHERE pl.modalidad_id = ? AND pl.ronda = ? AND pl.grupo = ?
                GROUP BY e.id, e.nombre_equipo, esc.nombre
                LIMIT 1;
            `;
            const [rows] = await pool.query(query, [modalidad_id, rondaConsultar, grupoConsultar]);

            return res.json({
                exito: true,
                pase_libre: rows.length > 0 ? rows[0] : null
            });

        } catch (error) {
            console.error('Error al obtener pase libre:', error);
            return res.status(500).json({ exito: false, error: 'Error interno al obtener el pase libre.' });
        }
    },

    async generarSorteoSiguienteRonda(req, res) {
        const { modalidad_id, forzar_desempate } = req.body;

        if (!modalidad_id) {
            return res.status(400).json({ exito: false, error: 'Debe especificar el ID de la modalidad.' });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [rondaActualRows] = await connection.query(
                `SELECT MAX(ronda) as max_ronda FROM llaves_combates WHERE modalidad_id = ?`,
                [modalidad_id]
            );
            const ultimaRonda = rondaActualRows[0].max_ronda || 0;

            if (ultimaRonda === 0) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ exito: false, error: 'Debe generar y jugar la Ronda 1 primero.' });
            }

            const [combatesUltimaRonda] = await connection.query(
                `SELECT * FROM llaves_combates WHERE modalidad_id = ? AND ronda = ?`,
                [modalidad_id, ultimaRonda]
            );

            const pendientes = combatesUltimaRonda.filter(c => c.estado !== 'finalizado');
            if (pendientes.length > 0) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ 
                    exito: false, 
                    error: `Hay combates pendientes en la Ronda ${ultimaRonda}. Deben finalizarse todos antes de continuar.` 
                });
            }

            const nuevaRonda = ultimaRonda + 1;

            // 1. Censo de Zona A (0 derrotas)
            const [equiposZonaA] = await connection.query(
                `SELECT e.id, e.nombre_equipo, esc.nombre as escuela_nombre 
                 FROM equipos e 
                 LEFT JOIN escuelas esc ON e.escuela_id = esc.id 
                 WHERE e.modalidad_id = ? AND e.estado = 'activo' AND e.derrotas = 0
                 GROUP BY e.id, e.nombre_equipo, esc.nombre`,
                [modalidad_id]
            );

            // 2. Censo de Zona B (1 derrota)
            const [equiposZonaB] = await connection.query(
                `SELECT e.id, e.nombre_equipo, esc.nombre as escuela_nombre 
                 FROM equipos e 
                 LEFT JOIN escuelas esc ON e.escuela_id = esc.id 
                 WHERE e.modalidad_id = ? AND e.estado = 'activo' AND e.derrotas = 1
                 GROUP BY e.id, e.nombre_equipo, esc.nombre`,
                [modalidad_id]
            );

            let ganadorAId = equiposZonaA.length === 1 ? equiposZonaA[0].id : null;
            let ganadorBId = equiposZonaB.length === 1 ? equiposZonaB[0].id : null;

            if (equiposZonaA.length === 0) ganadorAId = -1; 
            if (equiposZonaB.length === 0) ganadorBId = -1; 

            await connection.query(
                `INSERT INTO estado_zonas_torneo (modalidad_id, ganador_zona_a_id, ganador_zona_b_id) 
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE ganador_zona_a_id = VALUES(ganador_zona_a_id), ganador_zona_b_id = VALUES(ganador_zona_b_id)`,
                [modalidad_id, ganadorAId === -1 ? null : ganadorAId, ganadorBId === -1 ? null : ganadorBId]
            );

            // CASO 1: AMBOS FINALISTAS LISTOS (Hay Gran Final)
            if (equiposZonaA.length === 1 && equiposZonaB.length === 1) {
                const [eqA] = await connection.query(`SELECT e.id, e.nombre_equipo, esc.nombre as escuela_nombre FROM equipos e LEFT JOIN escuelas esc ON e.escuela_id = esc.id WHERE e.id = ?`, [ganadorAId]);
                const [eqB] = await connection.query(`SELECT e.id, e.nombre_equipo, esc.nombre as escuela_nombre FROM equipos e LEFT JOIN escuelas esc ON e.escuela_id = esc.id WHERE e.id = ?`, [ganadorBId]);
                
                await connection.commit();
                connection.release();
                return await TorneoController.pelea_Zona_A_vs_ZonaB(modalidad_id, nuevaRonda, eqA[0], eqB[0], forzar_desempate, res);
            }

            // CASO 2: VICTORIA DIRECTA POR FALTA DE RIVALES EN LA OTRA ZONA
            if (equiposZonaA.length === 1 && equiposZonaB.length === 0) {
                await connection.commit();
                connection.release();
                return res.json({
                    exito: true,
                    torneo_finalizado: true,
                    campeon_absoluto_id: ganadorAId,
                    mensaje: '¡No hay final! La Zona B se ha quedado sin contendientes activos. El finalista de la Zona A es el Campeón Absoluto.'
                });
            }

            if (equiposZonaA.length === 0 && equiposZonaB.length === 1) {
                await connection.commit();
                connection.release();
                return res.json({
                    exito: true,
                    torneo_finalizado: true,
                    campeon_absoluto_id: ganadorBId,
                    mensaje: '¡No hay final! La Zona A se ha quedado sin contendientes activos. El finalista de la Zona B es el Campeón Absoluto.'
                });
            }

            // CASO 3: TORNEO DESIERTO
            if (equiposZonaA.length === 0 && equiposZonaB.length === 0) {
                await connection.commit();
                connection.release();
                return res.json({
                    exito: false,
                    error: 'Ambas zonas se han quedado vacías por dobles descalificaciones masivas. El torneo finaliza sin campeón.'
                });
            }

            // CASO 4: EL TORNEO CONTINÚA
            let seGeneraronCombates = false;

            if (equiposZonaA.length > 1) {
                await TorneoController._procesarZonaA(connection, modalidad_id, nuevaRonda, equiposZonaA);
                seGeneraronCombates = true;
            }

            if (equiposZonaB.length > 1) {
                await TorneoController._procesarZonaB(connection, modalidad_id, nuevaRonda, equiposZonaB);
                seGeneraronCombates = true;
            }

            if (seGeneraronCombates) {
                await connection.commit();
                connection.release();
                return res.json({
                    exito: true,
                    mensaje: `Sorteo de la Ronda ${nuevaRonda} generado correctamente.`,
                    ronda: nuevaRonda
                });
            }

            await connection.rollback();
            connection.release();
            return res.status(400).json({
                exito: false,
                error: 'Estado del torneo inconsistente. Controle los equipos activos.'
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            console.error('Error en generarSorteoSiguienteRonda:', error);
            return res.status(500).json({ exito: false, error: 'Error interno al evaluar la siguiente ronda.' });
        }
    },

    /**
     * Propósito: Armar los combates de la Zona A aislando a los equipos para que no repiten rivales
     *            y garantizando que ningún equipo reciba más de un pase libre en todo el torneo.
     */
    async _procesarZonaA(connection, modalidad_id, nuevaRonda, equiposZonaA) {
        let equiposParaEmparejar = [...equiposZonaA];
        if (equiposParaEmparejar.length < 2) return;

        const rondaAnterior = nuevaRonda - 1;

        const [paseAnteriorRows] = await connection.query(
            `SELECT equipo_id FROM pases_libres WHERE modalidad_id = ? AND ronda = ? AND grupo = 'A'`,
            [modalidad_id, rondaAnterior]
        );
        const equipoConPaseAnteriorId = paseAnteriorRows.length > 0 ? paseAnteriorRows[0].equipo_id : null;

        if (equipoConPaseAnteriorId) {
            const [eqAnteriorRows] = await connection.query(
                `SELECT e.id, e.nombre_equipo, esc.nombre as escuela_nombre 
                 FROM equipos e 
                 LEFT JOIN escuelas esc ON e.escuela_id = esc.id 
                 WHERE e.id = ?`,
                [equipoConPaseAnteriorId]
            );
            if (eqAnteriorRows.length > 0) {
                const eqAnterior = eqAnteriorRows[0];
                const yaEsta = equiposParaEmparejar.some(e => e.id === eqAnterior.id);
                if (!yaEsta) {
                    equiposParaEmparejar.push(eqAnterior);
                }
            }

            await connection.query(
                `DELETE FROM pases_libres WHERE modalidad_id = ? AND ronda = ? AND grupo = 'A'`,
                [modalidad_id, rondaAnterior]
            );
        }

        // Consultamos la "lista negra" en la tabla histórica definitiva
        const [historialPasesRows] = await connection.query(
            `SELECT equipo_id FROM historial_pases_libres WHERE modalidad_id = ?`,
            [modalidad_id]
        );
        const equiposConPaseHistorico = historialPasesRows.map(r => r.equipo_id);

        if (equiposParaEmparejar.length % 2 === 0) {
            await connection.query(
                `DELETE FROM pases_libres WHERE modalidad_id = ? AND ronda = ? AND grupo = 'A'`,
                [modalidad_id, nuevaRonda]
            );
        } else {
            // Filtramos a los que NUNCA tuvieron pase libre
            const candidatosPase = equiposParaEmparejar.filter(e => !equiposConPaseHistorico.includes(e.id));
            
            const poolElegible = candidatosPase.length > 0 ? candidatosPase : equiposParaEmparejar;

            const randomIndex = Math.floor(Math.random() * poolElegible.length);
            const nuevoEquipoPaseLibre = poolElegible[randomIndex];

            await connection.query(
                `DELETE FROM pases_libres WHERE modalidad_id = ? AND ronda = ? AND grupo = 'A'`,
                [modalidad_id, nuevaRonda]
            );
            
            // Registramos el nuevo pase en ambas tablas
            await connection.query(
                `INSERT INTO pases_libres (modalidad_id, equipo_id, ronda, grupo) VALUES (?, ?, ?, 'A')`,
                [modalidad_id, nuevoEquipoPaseLibre.id, nuevaRonda]
            );
            await connection.query(
                `INSERT INTO historial_pases_libres (modalidad_id, equipo_id, ronda, grupo) VALUES (?, ?, ?, 'A')`,
                [modalidad_id, nuevoEquipoPaseLibre.id, nuevaRonda]
            );

            await connection.query(
                `UPDATE equipos SET recibio_pase_libre = 1 WHERE id = ?`,
                [nuevoEquipoPaseLibre.id]
            );

            equiposParaEmparejar = equiposParaEmparejar.filter(e => e.id !== nuevoEquipoPaseLibre.id);
        }

        const [historial] = await connection.query(
            `SELECT robot_a_id, robot_b_id FROM historial_enfrentamientos WHERE modalidad_id = ?`,
            [modalidad_id]
        );
        const yaSeEnfrentaron = (id1, id2) => {
            return historial.some(h => 
                (h.robot_a_id === id1 && h.robot_b_id === id2) || 
                (h.robot_a_id === id2 && h.robot_b_id === id1)
            );
        };

        for (let i = equiposParaEmparejar.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [equiposParaEmparejar[i], equiposParaEmparejar[j]] = [equiposParaEmparejar[j], equiposParaEmparejar[i]];
        }

        let emparejamientos = [];
        let disponibles = [...equiposParaEmparejar];

        while (disponibles.length >= 2) {
            let r1 = disponibles.shift();
            let encontradoR2 = false;

            for (let i = 0; i < disponibles.length; i++) {
                let r2 = disponibles[i];
                if (!yaSeEnfrentaron(r1.id, r2.id)) {
                    emparejamientos.push({ r1, r2 });
                    disponibles.splice(i, 1);
                    encontradoR2 = true;
                    break;
                }
            }

            if (!encontradoR2 && disponibles.length > 0) {
                let r2 = disponibles.shift();
                emparejamientos.push({ r1, r2 });
            }
        }

        for (const par of emparejamientos) {
            await connection.query(
                `INSERT INTO llaves_combates (modalidad_id, ronda, grupo, robot_1_id, robot_2_id, estado) 
                 VALUES (?, ?, 'A', ?, ?, 'pendiente')`,
                [modalidad_id, nuevaRonda, par.r1.id, par.r2.id]
            );
        }
    },

    /**
     * Propósito: Armar los combates de la Zona B (llave de perdedores), asegurando que
     *            ningún equipo reciba un pase libre si ya lo obtuvo en esta o en otra zona.
     */
    async _procesarZonaB(connection, modalidad_id, nuevaRonda, equiposZonaB) {
        let equiposParaEmparejar = [...equiposZonaB];
        if (equiposParaEmparejar.length < 2) return;

        const rondaAnterior = nuevaRonda - 1;

        const [paseAnteriorRowsB] = await connection.query(
            `SELECT equipo_id FROM pases_libres WHERE modalidad_id = ? AND ronda = ? AND grupo = 'B'`,
            [modalidad_id, rondaAnterior]
        );
        const equipoConPaseAnteriorIdB = paseAnteriorRowsB.length > 0 ? paseAnteriorRowsB[0].equipo_id : null;

        if (equipoConPaseAnteriorIdB) {
            const [eqAnteriorRowsB] = await connection.query(
                `SELECT e.id, e.nombre_equipo, esc.nombre as escuela_nombre 
                 FROM equipos e 
                 LEFT JOIN escuelas esc ON e.escuela_id = esc.id 
                 WHERE e.id = ?`,
                [equipoConPaseAnteriorIdB]
            );
            if (eqAnteriorRowsB.length > 0) {
                const eqAnteriorB = eqAnteriorRowsB[0];
                const yaEstaB = equiposParaEmparejar.some(e => e.id === eqAnteriorB.id);
                if (!yaEstaB) {
                    equiposParaEmparejar.push(eqAnteriorB);
                }
            }

            await connection.query(
                `DELETE FROM pases_libres WHERE modalidad_id = ? AND ronda = ? AND grupo = 'B'`,
                [modalidad_id, rondaAnterior]
            );
        }

        // Consultamos la "lista negra" en la tabla histórica definitiva
        const [historialPasesRowsB] = await connection.query(
            `SELECT equipo_id FROM historial_pases_libres WHERE modalidad_id = ?`,
            [modalidad_id]
        );
        const equiposConPaseHistoricoB = historialPasesRowsB.map(r => r.equipo_id);

        if (equiposParaEmparejar.length % 2 === 0) {
            await connection.query(
                `DELETE FROM pases_libres WHERE modalidad_id = ? AND ronda = ? AND grupo = 'B'`,
                [modalidad_id, nuevaRonda]
            );
        } else {
            // Filtramos a los que NUNCA tuvieron pase libre
            const candidatosPaseB = equiposParaEmparejar.filter(e => !equiposConPaseHistoricoB.includes(e.id));
            
            const poolElegibleB = candidatosPaseB.length > 0 ? candidatosPaseB : equiposParaEmparejar;

            const randomIndex = Math.floor(Math.random() * poolElegibleB.length);
            const nuevoEquipoPaseLibreB = poolElegibleB[randomIndex];

            await connection.query(
                `DELETE FROM pases_libres WHERE modalidad_id = ? AND ronda = ? AND grupo = 'B'`,
                [modalidad_id, nuevaRonda]
            );
            
            // Registramos el nuevo pase en ambas tablas
            await connection.query(
                `INSERT INTO pases_libres (modalidad_id, equipo_id, ronda, grupo) VALUES (?, ?, ?, 'B')`,
                [modalidad_id, nuevoEquipoPaseLibreB.id, nuevaRonda]
            );
            await connection.query(
                `INSERT INTO historial_pases_libres (modalidad_id, equipo_id, ronda, grupo) VALUES (?, ?, ?, 'B')`,
                [modalidad_id, nuevoEquipoPaseLibreB.id, nuevaRonda]
            );

            await connection.query(
                `UPDATE equipos SET recibio_pase_libre = 1 WHERE id = ?`,
                [nuevoEquipoPaseLibreB.id]
            );

            equiposParaEmparejar = equiposParaEmparejar.filter(e => e.id !== nuevoEquipoPaseLibreB.id);
        }

        const [historial] = await connection.query(
            `SELECT robot_a_id, robot_b_id FROM historial_enfrentamientos WHERE modalidad_id = ?`,
            [modalidad_id]
        );
        const yaSeEnfrentaron = (id1, id2) => {
            return historial.some(h => 
                (h.robot_a_id === id1 && h.robot_b_id === id2) || 
                (h.robot_a_id === id2 && h.robot_b_id === id1)
            );
        };

        for (let i = equiposParaEmparejar.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [equiposParaEmparejar[i], equiposParaEmparejar[j]] = [equiposParaEmparejar[j], equiposParaEmparejar[i]];
        }

        let emparejamientos = [];
        let disponibles = [...equiposParaEmparejar];

        while (disponibles.length >= 2) {
            let r1 = disponibles.shift();
            let encontradoR2 = false;

            for (let i = 0; i < disponibles.length; i++) {
                let r2 = disponibles[i];
                if (!yaSeEnfrentaron(r1.id, r2.id)) {
                    emparejamientos.push({ r1, r2 });
                    disponibles.splice(i, 1);
                    encontradoR2 = true;
                    break;
                }
            }

            if (!encontradoR2 && disponibles.length > 0) {
                let r2 = disponibles.shift();
                emparejamientos.push({ r1, r2 });
            }
        }

        for (const par of emparejamientos) {
            await connection.query(
                `INSERT INTO llaves_combates (modalidad_id, ronda, grupo, robot_1_id, robot_2_id, estado) 
                 VALUES (?, ?, 'B', ?, ?, 'pendiente')`,
                [modalidad_id, nuevaRonda, par.r1.id, par.r2.id]
            );
        }
    },

    async pelea_Zona_A_vs_ZonaB(modalidad_id, nuevaRonda, finalistaA, finalistaB, forzar_desempate, res) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [finalesExistentes] = await connection.query(
                `SELECT * FROM llaves_combates WHERE modalidad_id = ? AND grupo = 'FINAL' ORDER BY ronda ASC`,
                [modalidad_id]
            );

            if (finalesExistentes.length === 0) {
                const [resIns] = await connection.query(
                    `INSERT INTO llaves_combates (modalidad_id, ronda, grupo, robot_1_id, robot_2_id, estado) 
                     VALUES (?, ?, 'FINAL', ?, ?, 'pendiente')`,
                    [modalidad_id, nuevaRonda, finalistaA.id, finalistaB.id]
                );
                await connection.commit();
                connection.release();
                return res.json({
                    exito: true,
                    mensaje: '¡Zonas concluidas! Gran Final configurada.',
                    ronda: nuevaRonda,
                    modal_aviso: '¡Las zonas han concluido! Pasamos a la Gran Final.'
                });
            } else if (forzar_desempate && finalesExistentes.length === 1) {
                const [resIns] = await connection.query(
                    `INSERT INTO llaves_combates (modalidad_id, ronda, grupo, robot_1_id, robot_2_id, estado) 
                     VALUES (?, ?, 'FINAL', ?, ?, 'pendiente')`,
                    [modalidad_id, nuevaRonda, finalistaA.id, finalistaB.id]
                );
                await connection.commit();
                connection.release();
                return res.json({
                    exito: true,
                    mensaje: '¡Empate en derrotas! Gran Final de Desempate configurada.',
                    ronda: nuevaRonda
                });
            }

            await connection.commit();
            connection.release();
            return res.json({ exito: true, mensaje: 'La Gran Final ya se encuentra configurada.' });

        } catch (error) {
            await connection.rollback();
            connection.release();
            console.error('Error en pelea_Zona_A_vs_ZonaB:', error);
            return res.status(500).json({ exito: false, error: 'Error al programar la Gran Final.' });
        }
    },

    async obtenerLlaves(req, res) {
        const { modalidad_id } = req.params;

        try {
            const [combates] = await pool.query(
                `SELECT c.*, 
                        r1.nombre_equipo AS robot_1_nombre, 
                        r2.nombre_equipo AS robot_2_nombre,
                        g.nombre_equipo AS ganador_nombre,
                        esc_g.nombre AS ganador_escuela_nombre,
                        p.nombre_equipo AS perdedor_nombre
                 FROM llaves_combates c
                 LEFT JOIN equipos r1 ON c.robot_1_id = r1.id
                 LEFT JOIN equipos r2 ON c.robot_2_id = r2.id
                 LEFT JOIN equipos g ON c.ganador_id = g.id
                 LEFT JOIN escuelas esc_g ON g.escuela_id = esc_g.id
                 LEFT JOIN equipos p ON c.perdedor_id = p.id
                 WHERE c.modalidad_id = ?
                 ORDER BY c.ronda ASC, c.grupo ASC, c.id ASC`,
                [modalidad_id]
            );

            return res.json({ exito: true, data: combates });
        } catch (error) {
            console.error('Error al obtener llaves:', error);
            return res.status(500).json({ exito: false, error: 'Error interno al obtener el cuadro de llaves.' });
        }
    },

    async registrarResultadoCombate(req, res) {
        const { combate_id, ganador_id, doble_descalificacion } = req.body;

        if (!combate_id) {
            return res.status(400).json({ exito: false, error: 'Falta el ID del combate.' });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [combates] = await connection.query(`SELECT * FROM llaves_combates WHERE id = ? FOR UPDATE`, [combate_id]);
            if (combates.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ exito: false, error: 'Combate no encontrado.' });
            }

            const combate = combates[0];
            if (combate.estado === 'finalizado') {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ exito: false, error: 'El combate ya fue finalizado.' });
            }

            const robot1Id = combate.robot_1_id;
            const robot2Id = combate.robot_2_id;

            if (doble_descalificacion) {
                await connection.query(
                    `UPDATE llaves_combates SET ganador_id = NULL, perdedor_id = NULL, estado = 'finalizado' WHERE id = ?`,
                    [combate_id]
                );

                if (robot1Id && robot2Id) {
                    await connection.query(
                        `INSERT INTO historial_enfrentamientos (robot_a_id, robot_b_id, modalidad_id) VALUES (?, ?, ?)`,
                        [robot1Id, robot2Id, combate.modalidad_id]
                    );
                }

                for (const equipoId of [robot1Id, robot2Id]) {
                    if (equipoId) {
                        const [pData] = await connection.query(`SELECT derrotas FROM equipos WHERE id = ?`, [equipoId]);
                        const nuevasDerrotas = pData[0].derrotas + 1;
                        const nuevoEstado = nuevasDerrotas >= 2 ? 'eliminado' : 'activo';
                        const nuevoGrupo = nuevasDerrotas >= 2 ? 'A' : 'B';

                        await connection.query(
                            `UPDATE equipos SET derrotas = ?, estado = ?, grupo_actual = ? WHERE id = ?`,
                            [nuevasDerrotas, nuevoEstado, nuevoGrupo, equipoId]
                        );
                    }
                }

                await connection.commit();
                connection.release();
                return res.json({ exito: true, mensaje: 'Doble descalificación registrada correctamente.' });
            }

            if (!ganador_id) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ exito: false, error: 'Debe indicar un ganador o especificar doble descalificación.' });
            }

            if (ganador_id !== robot1Id && ganador_id !== robot2Id) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ exito: false, error: 'El ganador indicado no participa de este combate.' });
            }

            const perdedor_id = (ganador_id === robot1Id) ? robot2Id : robot1Id;

            await connection.query(
                `UPDATE llaves_combates SET ganador_id = ?, perdedor_id = ?, estado = 'finalizado' WHERE id = ?`,
                [ganador_id, perdedor_id, combate_id]
            );

            if (robot1Id && robot2Id) {
                await connection.query(
                    `INSERT INTO historial_enfrentamientos (robot_a_id, robot_b_id, modalidad_id) VALUES (?, ?, ?)`,
                    [robot1Id, robot2Id, combate.modalidad_id]
                );
            }

            if (combate.grupo !== 'FINAL' && perdedor_id) {
                const [perdedorData] = await connection.query(`SELECT derrotas, grupo_actual FROM equipos WHERE id = ?`, [perdedor_id]);
                const derrotasActuales = perdedorData[0].derrotas;
                
                let nuevasDerrotas = derrotasActuales;
                let nuevoEstado = 'activo';
                let nuevoGrupo = perdedorData[0].grupo_actual;

                if (combate.grupo === 'A') {
                    nuevasDerrotas = 1;
                    nuevoGrupo = 'B';
                } else if (combate.grupo === 'B') {
                    nuevasDerrotas = 2;
                    nuevoEstado = 'eliminado';
                }

                await connection.query(
                    `UPDATE equipos SET derrotas = ?, estado = ?, grupo_actual = ? WHERE id = ?`,
                    [nuevasDerrotas, nuevoEstado, nuevoGrupo, perdedor_id]
                );
            }

            await connection.commit();
            connection.release();

            return res.json({ exito: true, mensaje: 'Resultado registrado correctamente.' });

        } catch (error) {
            await connection.rollback();
            connection.release();
            console.error('Error al registrar resultado:', error);
            return res.status(500).json({ exito: false, error: 'Error interno.' });
        }
    },

    async descalificarEquipoPermanentemente(req, res) {
        const { combate_id, equipo_a_descalificar_id } = req.body;

        if (!combate_id || !equipo_a_descalificar_id) {
            return res.status(400).json({ exito: false, error: 'Faltan datos obligatorios (combate_id o equipo_a_descalificar_id).' });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [combates] = await connection.query(`SELECT * FROM llaves_combates WHERE id = ? FOR UPDATE`, [combate_id]);
            if (combates.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ exito: false, error: 'Combate no encontrado.' });
            }

            const combate = combates[0];
            if (combate.estado === 'finalizado') {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ exito: false, error: 'Este combate ya ha finalizado. No se puede descalificar de esta forma.' });
            }

            const robot1Id = combate.robot_1_id;
            const robot2Id = combate.robot_2_id;

            if (equipo_a_descalificar_id !== robot1Id && equipo_a_descalificar_id !== robot2Id) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ exito: false, error: 'El equipo a descalificar no participa en este combate.' });
            }

            const ganador_id = (equipo_a_descalificar_id === robot1Id) ? robot2Id : robot1Id;
            const perdedor_id = equipo_a_descalificar_id;

            await connection.query(
                `UPDATE llaves_combates SET ganador_id = ?, perdedor_id = ?, estado = 'finalizado' WHERE id = ?`,
                [ganador_id, perdedor_id, combate_id]
            );

            if (robot1Id && robot2Id) {
                await connection.query(
                    `INSERT INTO historial_enfrentamientos (robot_a_id, robot_b_id, modalidad_id) VALUES (?, ?, ?)`,
                    [robot1Id, robot2Id, combate.modalidad_id]
                );
            }

            await connection.query(
                `UPDATE equipos SET estado = 'eliminado', derrotas = 2 WHERE id = ?`,
                [perdedor_id]
            );

            await connection.commit();
            connection.release();

            return res.json({
                exito: true,
                mensaje: 'Equipo descalificado permanentemente. El rival ha avanzado de forma automática.'
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            console.error('Error al descalificar permanentemente:', error);
            return res.status(500).json({ exito: false, error: 'Error interno al procesar la descalificación.' });
        }
    },
    
    async revertirResultadoCombate(req, res) {
        const { combate_id } = req.body;
        if (!combate_id) return res.status(400).json({ exito: false, error: 'Falta ID de combate.' });

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [combates] = await connection.query(`SELECT * FROM llaves_combates WHERE id = ? FOR UPDATE`, [combate_id]);
            if (combates.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ exito: false, error: 'Combate no encontrado.' });
            }

            const combate = combates[0];
            if (combate.estado !== 'finalizado') {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ exito: false, error: 'Solo se pueden revertir combates finalizados.' });
            }

            if (combate.perdedor_id) {
                const [pData] = await connection.query(`SELECT derrotas FROM equipos WHERE id = ?`, [combate.perdedor_id]);
                if (pData.length > 0) {
                    const restadas = Math.max(0, pData[0].derrotas - 1);
                    const grupoRestaurado = restadas === 1 ? 'B' : 'A';
                    await connection.query(
                        `UPDATE equipos SET derrotas = ?, grupo_actual = ?, estado = 'activo' WHERE id = ?`,
                        [restadas, grupoRestaurado, combate.perdedor_id]
                    );
                }
            } else if (!combate.ganador_id && combate.robot_1_id && combate.robot_2_id) {
                for (const equipoId of [combate.robot_1_id, combate.robot_2_id]) {
                    const [pData] = await connection.query(`SELECT derrotas FROM equipos WHERE id = ?`, [equipoId]);
                    if (pData.length > 0) {
                        const restadas = Math.max(0, pData[0].derrotas - 1);
                        const grupoRestaurado = restadas === 1 ? 'B' : 'A';
                        await connection.query(
                            `UPDATE equipos SET derrotas = ?, grupo_actual = ?, estado = 'activo' WHERE id = ?`,
                            [restadas, grupoRestaurado, equipoId]
                        );
                    }
                }
            }

            if (combate.robot_1_id && combate.robot_2_id) {
                await connection.query(
                    `DELETE FROM historial_enfrentamientos 
                     WHERE ((robot_a_id = ? AND robot_b_id = ?) OR (robot_a_id = ? AND robot_b_id = ?)) 
                     AND modalidad_id = ?`,
                    [combate.robot_1_id, combate.robot_2_id, combate.robot_2_id, combate.robot_1_id, combate.modalidad_id]
                );
            }

            await connection.query(
                `UPDATE llaves_combates SET ganador_id = NULL, perdedor_id = NULL, estado = 'pendiente' WHERE id = ?`,
                [combate_id]
            );

            await connection.commit();
            connection.release();

            return res.json({ exito: true, mensaje: 'Combate revertido exitosamente.' });

        } catch (error) {
            await connection.rollback();
            connection.release();
            console.error('Error al revertir:', error);
            return res.status(500).json({ exito: false, error: 'Error interno al revertir.' });
        }
    },

    async resetearTorneoModalidad(req, res) {
        const { modalidad_id } = req.params;
        if (!modalidad_id) return res.status(400).json({ exito: false, error: 'Falta ID de modalidad.' });

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            await connection.query(`DELETE FROM llaves_combates WHERE modalidad_id = ?`, [modalidad_id]);
            await connection.query(`DELETE FROM historial_enfrentamientos WHERE modalidad_id = ?`, [modalidad_id]);
            await connection.query(`DELETE FROM pases_libres WHERE modalidad_id = ?`, [modalidad_id]);
            await connection.query(`DELETE FROM historial_pases_libres WHERE modalidad_id = ?`, [modalidad_id]);
            await connection.query(`DELETE FROM estado_zonas_torneo WHERE modalidad_id = ?`, [modalidad_id]);
            await connection.query(
                `UPDATE equipos SET estado = 'activo', grupo_actual = 'A', derrotas = 0, recibio_pase_libre = 0 WHERE modalidad_id = ?`,
                [modalidad_id]
            );

            await connection.commit();
            connection.release();

            return res.json({ exito: true, mensaje: 'Torneo reiniciado correctamente.' });

        } catch (error) {
            await connection.rollback();
            connection.release();
            console.error('Error al resetear:', error);
            return res.status(500).json({ exito: false, error: 'Error interno al reiniciar.' });
        }
    }
};

module.exports = TorneoController;