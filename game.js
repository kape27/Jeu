
        // --- NOUVELLES FONCTIONS DE NAVIGATION STITCH ---
        function navToScreen(targetScreenId) {
            const screens = ['screenMainMenu', 'screenSetup', 'screenLobby', 'screenGame'];
            screens.forEach(id => {
                const el = document.getElementById(id);
                if(el) el.classList.add('screen-hidden');
            });
            const target = document.getElementById(targetScreenId);
            if(target) target.classList.remove('screen-hidden');
        }

        function showGameView() {
            if (document.getElementById('screenGame')) {
                navToScreen('screenGame');
            }
            const setupView = document.getElementById('setup');
            const gameView = document.getElementById('game');
            if (setupView && !document.getElementById('screenSetup')) {
                setupView.style.display = 'none';
            }
            if (gameView) {
                gameView.style.display = 'block';
            }
            document.body.classList.add('in-game');
        }

        function showSetupView() {
            if (document.getElementById('screenSetup')) {
                navToScreen('screenSetup');
            }
            const setupView = document.getElementById('setup');
            const gameView = document.getElementById('game');
            if (gameView) {
                gameView.style.display = 'none';
            }
            if (setupView && !document.getElementById('screenSetup')) {
                setupView.style.display = 'block';
            }
            document.body.classList.remove('in-game');
        }

        function selectModeAndGoSetup(mode) {
            const selectEl = document.getElementById('gameMode');
            if(selectEl) {
                selectEl.value = mode;
            }
            const modeText = document.getElementById('setupModeText');
            const modeIcon = document.getElementById('setupModeIcon');
            const aiSection = document.getElementById('aiConfigSection');
            
            if(modeText && modeIcon && aiSection) {
                if(mode === 'ai') {
                    modeText.innerText = 'Contre IA';
                    modeIcon.innerText = 'smart_toy';
                    aiSection.classList.remove('hidden');
                } else if(mode === 'bluetooth') {
                    modeText.innerText = 'Multijoueur en Ligne';
                    modeIcon.innerText = 'public';
                    aiSection.classList.add('hidden');
                } else {
                    const count = Number.parseInt(mode, 10);
                    modeText.innerText = `Partie Locale (${Number.isFinite(count) ? count : 2} Joueurs)`;
                    modeIcon.innerText = 'groups';
                    aiSection.classList.add('hidden');
                }
            }
            if(typeof updatePlayerCards === 'function') updatePlayerCards();

            if (mode === 'bluetooth') {
                const hostCard = document.getElementById('cardHost');
                const joinCard = document.getElementById('cardJoin');
                const actionArea = document.getElementById('webrtcActionArea');
                const hostArea = document.getElementById('webrtcHostArea');
                const joinArea = document.getElementById('webrtcJoinArea');

                if (hostCard) hostCard.classList.remove('active');
                if (joinCard) joinCard.classList.remove('active');
                if (hostArea) hostArea.style.display = 'none';
                if (joinArea) joinArea.style.display = 'none';
                if (actionArea) actionArea.style.display = 'block';
                setJoinerSetupLocked(false);

                navToScreen('screenLobby');
                return;
            }

            navToScreen('screenSetup');
        }

        function goToHostSetupFromLobby() {
            selectWebRTCRole('host');
            initNetworkSetupUI('host');

            const modeText = document.getElementById('setupModeText');
            const modeIcon = document.getElementById('setupModeIcon');
            const aiSection = document.getElementById('aiConfigSection');
            const gameModeInput = document.getElementById('gameMode');
            if (gameModeInput) gameModeInput.value = 'bluetooth';
            if (modeText) modeText.innerText = 'Multijoueur en Ligne';
            if (modeIcon) modeIcon.innerText = 'public';
            if (aiSection) aiSection.classList.add('hidden');

            setJoinerSetupLocked(false);
            if (typeof updatePlayerCards === 'function') {
                updatePlayerCards();
            }
            navToScreen('screenSetup');
        }

        function setGridSize(size) {
            const gridSelect = document.getElementById('gridSize');
            const currentMode = document.getElementById('gameMode')?.value;
            if (gridSelect?.disabled && currentMode === 'bluetooth') {
                return;
            }

            const selectEl = document.getElementById('gridSize');
            if(selectEl) selectEl.value = size;
            
            const displayEl = document.getElementById('displayGridSize');
            if(displayEl) displayEl.innerText = size + ' x ' + size;
            
            [6, 8, 10, 12].forEach(s => {
                const btn = document.getElementById('gridBtn' + s);
                if(btn) {
                    if(s == size) {
                        btn.className = "py-3 text-sm font-bold rounded-xl bg-primary text-white shadow-lg shadow-primary/30 border border-primary/50 transition-all";
                    } else {
                        btn.className = "py-3 text-sm font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 transition-all border border-transparent";
                    }
                }
            });
        }

        function setLocalPlayersMode(count, skipSave = false) {
            const normalizedCount = [2, 3, 4].includes(Number(count)) ? Number(count) : 2;
            const modeValue = `${normalizedCount}players`;
            const selectEl = document.getElementById('gameMode');
            if (selectEl) {
                selectEl.value = modeValue;
            }

            const displayEl = document.getElementById('localPlayersDisplay');
            if (displayEl) {
                displayEl.textContent = `${normalizedCount} joueurs`;
            }

            [2, 3, 4].forEach((value) => {
                const btn = document.getElementById(`localPlayersBtn${value}`);
                if (!btn) return;
                if (value === normalizedCount) {
                    btn.className = "py-3 text-sm font-bold rounded-xl bg-primary text-white shadow-lg shadow-primary/30 border border-primary/50 transition-all";
                } else {
                    btn.className = "py-3 text-sm font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 transition-all border border-transparent";
                }
            });

            const modeText = document.getElementById('setupModeText');
            const modeIcon = document.getElementById('setupModeIcon');
            if (modeText && modeIcon) {
                modeText.innerText = `Partie Locale (${normalizedCount} Joueurs)`;
                modeIcon.innerText = 'groups';
            }

            if (typeof updatePlayerCards === 'function') {
                updatePlayerCards();
            }
            if (!skipSave && typeof saveSetupPreferences === 'function') {
                saveSetupPreferences();
            }
        }

        function normalizeOnlinePlayersCount(value) {
            const parsed = Number.parseInt(value, 10);
            if (!Number.isFinite(parsed)) return 2;
            return Math.min(4, Math.max(2, parsed));
        }

        function setOnlinePlayersCount(count, skipSave = false) {
            const onlineSelect = document.getElementById('onlinePlayersCount');
            const currentMode = document.getElementById('gameMode')?.value;
            if (onlineSelect?.disabled && currentMode === 'bluetooth') {
                return;
            }

            const normalizedCount = normalizeOnlinePlayersCount(count);
            const selectEl = document.getElementById('onlinePlayersCount');
            if (selectEl) {
                selectEl.value = String(normalizedCount);
            }

            const displayEl = document.getElementById('onlinePlayersDisplay');
            if (displayEl) {
                displayEl.textContent = `${normalizedCount} joueurs`;
            }

            [2, 3, 4].forEach((value) => {
                const btn = document.getElementById(`onlinePlayersBtn${value}`);
                if (!btn) return;
                if (value === normalizedCount) {
                    btn.className = "py-3 text-sm font-bold rounded-xl bg-primary text-white shadow-lg shadow-primary/30 border border-primary/50 transition-all";
                } else {
                    btn.className = "py-3 text-sm font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 transition-all border border-transparent";
                }
            });

            if (typeof updatePlayerCards === 'function') {
                updatePlayerCards();
            }
            if (!skipSave && typeof saveSetupPreferences === 'function') {
                saveSetupPreferences();
            }
        }

        function setAIDifficulty(diff) {
            const selectEl = document.getElementById('aiDifficulty');
            if(selectEl) selectEl.value = diff;
            
            const diffs = ['easy', 'medium', 'hard', 'very_hard'];
            diffs.forEach(d => {
                const btn = document.getElementById('aiBtn_' + d);
                if(btn) {
                    if(d === diff) {
                        btn.className = "flex-1 py-2.5 text-xs font-bold rounded-xl transition-all bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm border border-black/5 dark:border-white/5";
                    } else {
                        btn.className = "flex-1 py-2.5 text-xs font-bold rounded-xl transition-all text-slate-500 dark:text-slate-400";
                    }
                }
            });
        }

        function setPace(pace) {
            const paceSelect = document.getElementById('gamePace');
            const currentMode = document.getElementById('gameMode')?.value;
            if (paceSelect?.disabled && currentMode === 'bluetooth') {
                return;
            }

            const selectEl = document.getElementById('gamePace');
            if(selectEl) {
                selectEl.value = pace;
            }
            
            const btnClassic = document.getElementById('paceBtn_classic');
            const btnBlitz = document.getElementById('paceBtn_blitz');
            
            if(pace === 'classic') {
                if(btnClassic) btnClassic.className = "flex-1 p-4 rounded-2xl border-2 border-primary bg-primary/5 flex flex-col items-center gap-2 transition-all";
                if(btnBlitz) btnBlitz.className = "flex-1 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col items-center gap-2 transition-all opacity-70";
            } else {
                if(btnClassic) btnClassic.className = "flex-1 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col items-center gap-2 transition-all opacity-70";
                if(btnBlitz) btnBlitz.className = "flex-1 p-4 rounded-2xl border-2 border-primary bg-primary/5 flex flex-col items-center gap-2 transition-all";
            }
        }

        function setAdvancedToggleState(rowEl, enabled) {
            if (!rowEl) return;
            const track = rowEl.querySelector('.toggle-track');
            const knob = rowEl.querySelector('.toggle-knob');
            rowEl.classList.toggle('active', enabled);
            if (track) {
                track.classList.toggle('bg-primary', enabled);
                track.classList.toggle('bg-slate-200', !enabled);
                track.classList.toggle('dark:bg-slate-700', !enabled);
            }
            if (knob) {
                knob.classList.toggle('translate-x-5', enabled);
            }
        }

        function toggleAdvancedMode(inputId, uiRowId) {
            const inputEl = document.getElementById(inputId);
            const uiRow = document.getElementById(uiRowId);
            if(!inputEl || !uiRow || uiRow.classList.contains('locked')) return;

            const enabled = inputEl.value === 'off';
            inputEl.value = enabled ? 'on' : 'off';
            setAdvancedToggleState(uiRow, enabled);

            if (inputId === 'obstacleMode') {
                const densitySelector = document.getElementById('obstacleDensitySelector');
                if (densitySelector) {
                    densitySelector.classList.toggle('visible', enabled);
                }
            }

            saveSetupPreferences();
            if (soundEnabled) playSound('click');
        }

        function handleSetupStart() {
            const mode = document.getElementById('gameMode').value;
            if(mode === 'bluetooth') {
                navToScreen('screenLobby');
            } else {
                startGame();
            }
        }

        // IA avec niveaux de difficulte et heuristiques de choix de coups
        class AI {
            constructor(color, difficulty = 'hard') {
                this.color = color;
                this.difficulty = difficulty;
            }

            async makeMove(game) {
                const thinkingTime = {
                    easy: 260,
                    medium: 430,
                    hard: 620,
                    very_hard: 950
                };

                await new Promise(resolve => setTimeout(resolve, thinkingTime[this.difficulty] ?? 400));

                const availableMoves = this.getAvailableMoves(game);
                if (availableMoves.length === 0) {
                    return null;
                }

                const aiPlayerIndex = game.currentPlayerIndex;

                switch (this.difficulty) {
                    case 'easy':
                        return this.makeEasyMove(game, availableMoves, aiPlayerIndex);
                    case 'medium':
                        return this.makeMediumMove(game, availableMoves, aiPlayerIndex);
                    case 'hard':
                        return this.makeHardMove(game, availableMoves, aiPlayerIndex);
                    case 'very_hard':
                        return this.makeVeryHardMove(game, availableMoves, aiPlayerIndex);
                    default:
                        return this.getRandomMove(availableMoves);
                }
            }

            makeEasyMove(game, availableMoves, aiPlayerIndex) {
                const state = this.createState(game);
                const ranked = this.generateCandidateMoves(state, aiPlayerIndex, Math.min(6, availableMoves.length));

                if (ranked.length === 0 || Math.random() < 0.68) {
                    return this.getRandomMove(availableMoves);
                }
                if (Math.random() < 0.9) {
                    return ranked[0].move;
                }

                const top = ranked.slice(0, Math.min(3, ranked.length));
                return top[Math.floor(Math.random() * top.length)].move;
            }

            makeMediumMove(game, availableMoves, aiPlayerIndex) {
                if (Math.random() < 0.18) {
                    return this.getRandomMove(availableMoves);
                }
                return this.pickSearchMove(game, aiPlayerIndex, {
                    baseDepth: 2,
                    candidateLimit: 8
                });
            }

            makeHardMove(game, _availableMoves, aiPlayerIndex) {
                return this.pickSearchMove(game, aiPlayerIndex, {
                    baseDepth: 3,
                    candidateLimit: 10
                });
            }

            makeVeryHardMove(game, _availableMoves, aiPlayerIndex) {
                return this.pickSearchMove(game, aiPlayerIndex, {
                    baseDepth: 4,
                    candidateLimit: 14
                });
            }

            pickSearchMove(game, aiPlayerIndex, config) {
                const state = this.createState(game);
                const remainingMoves = state.totalPoints - state.points.size;
                if (remainingMoves <= 0) {
                    return null;
                }

                let depth = config.baseDepth;
                let candidateLimit = config.candidateLimit;

                if (remainingMoves > 60) {
                    depth = Math.min(depth, 2);
                    candidateLimit = Math.min(candidateLimit, 6);
                } else if (remainingMoves < 30) {
                    depth = Math.min(depth + 1, 5);
                    candidateLimit += 2;
                }
                if (remainingMoves < 14) {
                    depth = Math.min(depth + 2, 6);
                    candidateLimit += 4;
                }

                const candidates = this.generateCandidateMoves(state, aiPlayerIndex, candidateLimit);
                if (candidates.length === 0) {
                    return this.getRandomMove(this.getAvailableMovesFromState(state));
                }

                let bestMove = candidates[0].move;
                let bestScore = -Infinity;

                for (const candidate of candidates) {
                    const nextState = this.applyMove(state, candidate.move, aiPlayerIndex);
                    const nextPlayer = this.getNextPlayerIndex(aiPlayerIndex, state.playersCount);
                    const minimaxScore = this.minimax(
                        nextState,
                        depth - 1,
                        nextPlayer,
                        aiPlayerIndex,
                        -Infinity,
                        Infinity,
                        candidateLimit
                    );

                    const totalScore = minimaxScore + candidate.heuristic * 0.02;
                    if (totalScore > bestScore + 1e-6) {
                        bestScore = totalScore;
                        bestMove = candidate.move;
                    } else if (Math.abs(totalScore - bestScore) <= 1e-6 && Math.random() < 0.5) {
                        bestMove = candidate.move;
                    }
                }

                return bestMove;
            }

            minimax(state, depth, currentPlayerIndex, aiPlayerIndex, alpha, beta, candidateLimit) {
                const remainingMoves = state.totalPoints - state.points.size;
                if (depth <= 0 || remainingMoves <= 0) {
                    return this.evaluateState(state, aiPlayerIndex);
                }

                const dynamicLimit =
                    remainingMoves > 55
                        ? Math.min(candidateLimit, 7)
                        : remainingMoves < 18
                            ? candidateLimit + 4
                            : candidateLimit;

                const candidates = this.generateCandidateMoves(state, currentPlayerIndex, dynamicLimit);
                if (candidates.length === 0) {
                    return this.evaluateState(state, aiPlayerIndex);
                }

                const isMaximizing = currentPlayerIndex === aiPlayerIndex;
                if (isMaximizing) {
                    let value = -Infinity;
                    for (const candidate of candidates) {
                        const nextState = this.applyMove(state, candidate.move, currentPlayerIndex);
                        const nextPlayer = this.getNextPlayerIndex(currentPlayerIndex, state.playersCount);
                        const score = this.minimax(
                            nextState,
                            depth - 1,
                            nextPlayer,
                            aiPlayerIndex,
                            alpha,
                            beta,
                            candidateLimit
                        );
                        value = Math.max(value, score + candidate.heuristic * 0.005);
                        alpha = Math.max(alpha, value);
                        if (beta <= alpha) break;
                    }
                    return value;
                }

                let value = Infinity;
                for (const candidate of candidates) {
                    const nextState = this.applyMove(state, candidate.move, currentPlayerIndex);
                    const nextPlayer = this.getNextPlayerIndex(currentPlayerIndex, state.playersCount);
                    const score = this.minimax(
                        nextState,
                        depth - 1,
                        nextPlayer,
                        aiPlayerIndex,
                        alpha,
                        beta,
                        candidateLimit
                    );
                    value = Math.min(value, score - candidate.heuristic * 0.003);
                    beta = Math.min(beta, value);
                    if (beta <= alpha) break;
                }
                return value;
            }

            evaluateState(state, aiPlayerIndex) {
                const analysis = this.analyzeBoard(state);
                const aiScore = analysis.completed[aiPlayerIndex] ?? 0;
                const aiThreats = analysis.threats[aiPlayerIndex] ?? 0;
                const aiSetups = analysis.setups[aiPlayerIndex] ?? 0;
                const aiCenter = analysis.center[aiPlayerIndex] ?? 0;

                const opponentScore = this.getBestOpponentValue(analysis.completed, aiPlayerIndex);
                const opponentThreats = this.getBestOpponentValue(analysis.threats, aiPlayerIndex);
                const opponentSetups = this.getBestOpponentValue(analysis.setups, aiPlayerIndex);
                const opponentCenter = this.getBestOpponentValue(analysis.center, aiPlayerIndex);

                const fillRatio = state.points.size / state.totalPoints;
                const scoreWeight = fillRatio > 0.72 ? 180 : 130;
                const threatWeight = fillRatio > 0.72 ? 30 : 22;
                const setupWeight = fillRatio > 0.72 ? 6 : 10;
                const centerWeight = fillRatio > 0.55 ? 0.5 : 1.6;

                return (
                    (aiScore - opponentScore) * scoreWeight +
                    (aiThreats - opponentThreats) * threatWeight +
                    (aiSetups - opponentSetups) * setupWeight +
                    (aiCenter - opponentCenter) * centerWeight
                );
            }

            analyzeBoard(state) {
                const completed = Array(state.playersCount).fill(0);
                const threats = Array(state.playersCount).fill(0);
                const setups = Array(state.playersCount).fill(0);
                const center = Array(state.playersCount).fill(0);

                for (let x = 0; x < state.size; x++) {
                    for (let y = 0; y < state.size; y++) {
                        const info = this.getBoxInfo(state, x, y);
                        if (info.winner !== null) {
                            completed[info.winner] += 1;
                        } else if (info.threatOwner !== null) {
                            threats[info.threatOwner] += 1;
                        } else if (info.emptyCount === 2 && info.ownerCounts.size === 1) {
                            const owner = info.ownerCounts.keys().next().value;
                            setups[owner] += 1;
                        }
                    }
                }

                const centerPos = state.size / 2;
                for (const [key, owner] of state.points.entries()) {
                    const [x, y] = key.split(',').map(Number);
                    const distance = Math.abs(x - centerPos) + Math.abs(y - centerPos);
                    center[owner] += Math.max(0, state.size - distance);
                }

                return { completed, threats, setups, center };
            }

            generateCandidateMoves(state, playerIndex, limit) {
                const moves = this.getAvailableMovesFromState(state);
                if (moves.length === 0) return [];

                const ranked = moves.map(move => ({
                    move,
                    heuristic: this.evaluateMoveHeuristic(state, move, playerIndex)
                }));

                ranked.sort((a, b) => b.heuristic - a.heuristic);
                return ranked.slice(0, Math.min(limit, ranked.length));
            }

            evaluateMoveHeuristic(state, move, playerIndex) {
                let immediateBoxes = 0;
                let blockedThreats = 0;
                let createdThreats = 0;

                const adjacentBoxes = this.getAdjacentBoxes(state.size, move.x, move.y);
                for (const box of adjacentBoxes) {
                    const before = this.getBoxInfo(state, box.x, box.y, null, null, move);
                    const after = this.getBoxInfo(state, box.x, box.y, move, playerIndex, null);

                    if (before.threatOwner !== null && before.threatOwner !== playerIndex && before.emptyAtObserved) {
                        blockedThreats += 1;
                    }
                    if (after.winner === playerIndex) {
                        immediateBoxes += 1;
                    } else if (after.threatOwner === playerIndex) {
                        createdThreats += 1;
                    }
                }

                const neighbors = this.getNeighborPoints(state.size, move.x, move.y);
                let adjacentOwn = 0;
                let adjacentOpp = 0;
                for (const neighbor of neighbors) {
                    const owner = state.points.get(this.pointKey(neighbor.x, neighbor.y));
                    if (owner === undefined) continue;
                    if (owner === playerIndex) {
                        adjacentOwn += 1;
                    } else {
                        adjacentOpp += 1;
                    }
                }

                const center = state.size / 2;
                const distance = Math.abs(move.x - center) + Math.abs(move.y - center);
                const centerBonus = Math.max(0, state.size - distance);

                return (
                    immediateBoxes * 180 +
                    blockedThreats * 96 +
                    createdThreats * 34 +
                    adjacentOwn * 7 -
                    adjacentOpp * 5 +
                    centerBonus * 2
                );
            }

            getBoxInfo(state, x, y, virtualMove = null, virtualOwner = null, observedMove = null) {
                const corners = [
                    { x, y },
                    { x: x + 1, y },
                    { x, y: y + 1 },
                    { x: x + 1, y: y + 1 }
                ];

                const ownerCounts = new Map();
                let emptyCount = 0;
                let emptyAtObserved = false;
                let blockedCount = 0;

                for (const corner of corners) {
                    const cornerKey = this.pointKey(corner.x, corner.y);
                    if (state.obstacles?.has(cornerKey)) {
                        blockedCount += 1;
                        continue;
                    }

                    let owner;
                    if (virtualMove && corner.x === virtualMove.x && corner.y === virtualMove.y) {
                        owner = virtualOwner;
                    } else {
                        owner = state.points.get(cornerKey);
                    }

                    if (owner === undefined) {
                        emptyCount += 1;
                        if (observedMove && corner.x === observedMove.x && corner.y === observedMove.y) {
                            emptyAtObserved = true;
                        }
                        continue;
                    }

                    ownerCounts.set(owner, (ownerCounts.get(owner) || 0) + 1);
                }

                let winner = null;
                let threatOwner = null;
                if (blockedCount > 0) {
                    return { ownerCounts, emptyCount, winner, threatOwner, emptyAtObserved };
                }

                if (emptyCount === 0 && ownerCounts.size === 1) {
                    winner = ownerCounts.keys().next().value;
                } else if (emptyCount === 1 && ownerCounts.size === 1) {
                    threatOwner = ownerCounts.keys().next().value;
                }

                return { ownerCounts, emptyCount, winner, threatOwner, emptyAtObserved };
            }

            getAdjacentBoxes(size, x, y) {
                const positions = [
                    { x: x - 1, y: y - 1 },
                    { x, y: y - 1 },
                    { x: x - 1, y },
                    { x, y }
                ];

                return positions.filter(pos => pos.x >= 0 && pos.x < size && pos.y >= 0 && pos.y < size);
            }

            getNeighborPoints(size, x, y) {
                const neighbors = [];
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx <= size && ny >= 0 && ny <= size) {
                            neighbors.push({ x: nx, y: ny });
                        }
                    }
                }
                return neighbors;
            }

            createState(game) {
                const obstacleSet = game.obstacles instanceof Set ? new Set(game.obstacles) : new Set();
                return {
                    size: game.size,
                    playersCount: game.players.length,
                    totalPoints: Math.max(0, ((game.size + 1) * (game.size + 1)) - obstacleSet.size),
                    points: new Map(game.points),
                    obstacles: obstacleSet
                };
            }

            applyMove(state, move, playerIndex) {
                const nextPoints = new Map(state.points);
                nextPoints.set(this.pointKey(move.x, move.y), playerIndex);
                return {
                    size: state.size,
                    playersCount: state.playersCount,
                    totalPoints: state.totalPoints,
                    points: nextPoints,
                    obstacles: state.obstacles
                };
            }

            getAvailableMoves(game) {
                const moves = [];
                for (let x = 0; x <= game.size; x++) {
                    for (let y = 0; y <= game.size; y++) {
                        const key = this.pointKey(x, y);
                        if (!game.points.has(key) && !(game.obstacles instanceof Set && game.obstacles.has(key))) {
                            moves.push({ x, y });
                        }
                    }
                }
                return moves;
            }

            getAvailableMovesFromState(state) {
                const moves = [];
                for (let x = 0; x <= state.size; x++) {
                    for (let y = 0; y <= state.size; y++) {
                        const key = this.pointKey(x, y);
                        if (!state.points.has(key) && !state.obstacles?.has(key)) {
                            moves.push({ x, y });
                        }
                    }
                }
                return moves;
            }

            getNextPlayerIndex(currentIndex, playersCount) {
                return (currentIndex + 1) % playersCount;
            }

            getBestOpponentValue(values, aiPlayerIndex) {
                let best = -Infinity;
                for (let i = 0; i < values.length; i++) {
                    if (i === aiPlayerIndex) continue;
                    if (values[i] > best) {
                        best = values[i];
                    }
                }
                return Number.isFinite(best) ? best : 0;
            }

            pointKey(x, y) {
                return `${x},${y}`;
            }

            getRandomMove(moves) {
                return moves[Math.floor(Math.random() * moves.length)];
            }
        }

        function normalizeGridSize(value) {
            const parsed = Number.parseInt(value, 10);
            if (!Number.isFinite(parsed)) return 8;
            return Math.min(12, Math.max(6, parsed));
        }

        function normalizeBlitzTurnSeconds(value) {
            const parsed = Number.parseInt(value, 10);
            if (!Number.isFinite(parsed)) return 10;
            return Math.min(20, Math.max(5, parsed));
        }

        function normalizeObstacleDensity(value) {
            const normalized = String(value || '').toLowerCase();
            return ['low', 'medium', 'high'].includes(normalized) ? normalized : 'medium';
        }

        function toggleModeCard(inputId, cardId) {
            const input = document.getElementById(inputId);
            const card = document.getElementById(cardId);

            if (input.value === 'off') {
                input.value = 'on';
                card.classList.add('active');
            } else {
                input.value = 'off';
                card.classList.remove('active');
            }

            // Show/hide obstacle density selector
            if (inputId === 'obstacleMode') {
                const densitySelector = document.getElementById('obstacleDensitySelector');
                if (densitySelector) {
                    densitySelector.classList.toggle('visible', input.value === 'on');
                }
            }

            saveSetupPreferences();
            if (soundEnabled) playSound('click');
        }

        function selectObstacleDensity(density, silent) {
            const normalizedDensity = normalizeObstacleDensity(density);
            const options = document.querySelectorAll('.density-option');
            options.forEach(opt => {
                opt.classList.toggle('active', opt.dataset.density === normalizedDensity);
            });
            const input = document.getElementById('obstacleDensity');
            if (input) input.value = normalizedDensity;
            if (!silent) {
                saveSetupPreferences();
                if (soundEnabled) playSound('click');
            }
        }

        function selectWebRTCRole(role) {
            const hostCard = document.getElementById('cardHost');
            const joinCard = document.getElementById('cardJoin');
            const actionArea = document.getElementById('webrtcActionArea');
            const hostArea = document.getElementById('webrtcHostArea');
            const joinArea = document.getElementById('webrtcJoinArea');

            // Reset UI
            if (hostCard) hostCard.classList.remove('active');
            if (joinCard) joinCard.classList.remove('active');
            if (hostArea) hostArea.style.display = 'none';
            if (joinArea) joinArea.style.display = 'none';
            if (actionArea) actionArea.style.display = 'block';

            if (role === 'host') {
                if (hostCard) hostCard.classList.add('active');
                if (hostArea) hostArea.style.display = 'flex';
                isHost = true;
                setJoinerSetupLocked(false);
                bluetoothSession.hostConfig = null;

                // Generer un code temporaire pour l'affichage si on n'en a pas deja un actif
                if (!bluetoothSession.code) {
                    const tempCode = generateSessionCode();
                    bluetoothSession.code = tempCode;
                    bluetoothSession.expectedCode = tempCode;
                }
                setHostSessionCodeDisplay(bluetoothSession.code);
                setSessionCodePreview(`Code hote pret: ${bluetoothSession.code}`);

            } else if (role === 'join') {
                if (joinCard) joinCard.classList.add('active');
                if (joinArea) joinArea.style.display = 'flex';
                isHost = false;
                setJoinerSetupLocked(true);
                setSessionCodePreview('Saisissez le code de session de l hote.');

                // Focus automatique sur le champ code
                setTimeout(() => document.getElementById('sessionCodeInput')?.focus(), 50);
            }
            updateWebRTCActionButtons();
            if (soundEnabled) playSound('click');
        }

        function initNetworkSetupUI(role) {
            const modeInput = document.getElementById('gameMode');
            if (modeInput) {
                modeInput.value = 'bluetooth';
            }
            if (role === 'join') {
                setTimeout(() => document.getElementById('sessionCodeInput')?.focus(), 60);
            }
            updateWebRTCActionButtons();
            updateLobbyHint();
        }

        function getGameOptionsFromSetup() {
            const pace = document.getElementById('gamePace')?.value ?? 'classic';
            const blitzEnabled = pace === 'blitz';
            const blitzTurnSeconds = normalizeBlitzTurnSeconds(
                document.getElementById('blitzTurnTime')?.value ?? 10
            );

            const gravityEnabled = document.getElementById('gravityShift')?.value === 'on';

            return {
                blitzEnabled,
                blitzTurnSeconds,
                gravityEnabled,
                hyperNexusEnabled: document.getElementById('hyperNexus')?.value === 'on',
                obstacleEnabled: document.getElementById('obstacleMode')?.value === 'on',
                obstacleDensity: normalizeObstacleDensity(document.getElementById('obstacleDensity')?.value)
            };
        }

        function getOnlinePlayersConfigFromSetup() {
            const count = normalizeOnlinePlayersCount(document.getElementById('onlinePlayersCount')?.value ?? 2);
            const names = [];
            const colors = [];
            for (let index = 1; index <= count; index++) {
                names.push(normalizePlayerName(getPlayerName(`player${index}Name`, `Joueur ${index}`), `Joueur ${index}`));
                colors.push(getPlayerColor(`player${index}Color`, '#328DCB'));
            }
            return {
                onlinePlayersCount: count,
                onlinePlayerNames: names,
                onlinePlayerColors: colors
            };
        }

        function buildOnlinePlayersFromConfig({
            onlinePlayersCount = 2,
            onlinePlayerNames = [],
            onlinePlayerColors = []
        } = {}) {
            const count = normalizeOnlinePlayersCount(onlinePlayersCount);
            const names = normalizeHostPlayerNames(onlinePlayerNames, count);
            const colors = normalizeHostPlayerColors(onlinePlayerColors, count);
            const players = [];
            for (let index = 0; index < count; index++) {
                players.push({
                    name: names[index],
                    color: colors[index]
                });
            }
            return players;
        }

        function collectSetupPreferences() {
            const players = [];
            for (let i = 1; i <= 4; i++) {
                players.push({
                    name: document.getElementById(`player${i}Name`)?.value ?? '',
                    color: document.getElementById(`player${i}Color`)?.value ?? ''
                });
            }

            return {
                gameMode: document.getElementById('gameMode')?.value ?? '2players',
                gridSize: normalizeGridSize(document.getElementById('gridSize')?.value ?? 8),
                onlinePlayersCount: normalizeOnlinePlayersCount(document.getElementById('onlinePlayersCount')?.value ?? 2),
                gamePace: document.getElementById('gamePace')?.value ?? 'classic',
                blitzTurnTime: normalizeBlitzTurnSeconds(document.getElementById('blitzTurnTime')?.value ?? 10),
                aiDifficulty: document.getElementById('aiDifficulty')?.value ?? 'hard',
                gravityShift: document.getElementById('gravityShift')?.value ?? 'off',
                hyperNexus: document.getElementById('hyperNexus')?.value ?? 'off',
                obstacleMode: document.getElementById('obstacleMode')?.value ?? 'off',
                obstacleDensity: normalizeObstacleDensity(document.getElementById('obstacleDensity')?.value),
                signalingUrl: String(document.getElementById('signalingUrlInput')?.value || '').trim(),
                players
            };
        }

        function saveSetupPreferences() {
            if (!window.localStorage) return;
            try {
                localStorage.setItem(
                    SETUP_PREFERENCES_STORAGE_KEY,
                    JSON.stringify(collectSetupPreferences())
                );
            } catch (_error) {
                // Ignore storage errors.
            }
        }

        function loadSetupPreferences() {
            if (!window.localStorage) return;
            try {
                const raw = localStorage.getItem(SETUP_PREFERENCES_STORAGE_KEY);
                if (!raw) return;
                const prefs = JSON.parse(raw);
                if (!prefs || typeof prefs !== 'object') return;

                const gameMode = String(prefs.gameMode || '');
                const gameModeInput = document.getElementById('gameMode');
                if (gameModeInput && gameMode) {
                    gameModeInput.value = gameMode;
                }

                const gridSizeInput = document.getElementById('gridSize');
                if (gridSizeInput && prefs.gridSize !== undefined) {
                    gridSizeInput.value = String(normalizeGridSize(prefs.gridSize));
                }
                const onlinePlayersInput = document.getElementById('onlinePlayersCount');
                if (onlinePlayersInput && prefs.onlinePlayersCount !== undefined) {
                    onlinePlayersInput.value = String(normalizeOnlinePlayersCount(prefs.onlinePlayersCount));
                    setOnlinePlayersCount(onlinePlayersInput.value, true);
                }

                const gamePaceInput = document.getElementById('gamePace');
                if (gamePaceInput && prefs.gamePace) {
                    gamePaceInput.value = String(prefs.gamePace);
                }

                const blitzTurnInput = document.getElementById('blitzTurnTime');
                if (blitzTurnInput && prefs.blitzTurnTime !== undefined) {
                    blitzTurnInput.value = String(normalizeBlitzTurnSeconds(prefs.blitzTurnTime));
                }

                const aiDifficultyInput = document.getElementById('aiDifficulty');
                if (aiDifficultyInput && prefs.aiDifficulty) {
                    aiDifficultyInput.value = String(prefs.aiDifficulty);
                }

                const gravityShift = prefs.gravityShift === 'on' ? 'on' : 'off';
                const gravityInput = document.getElementById('gravityShift');
                if (gravityInput) gravityInput.value = gravityShift;
                const gravityCard = document.getElementById('uiToggleGravity') || document.getElementById('cardGravity');
                setAdvancedToggleState(gravityCard, gravityShift === 'on');

                const hyperNexus = prefs.hyperNexus === 'on' ? 'on' : 'off';
                const nexusInput = document.getElementById('hyperNexus');
                if (nexusInput) nexusInput.value = hyperNexus;
                const nexusCard = document.getElementById('uiToggleNexus') || document.getElementById('cardNexus');
                setAdvancedToggleState(nexusCard, hyperNexus === 'on');

                const obstacleMode = prefs.obstacleMode === 'on' ? 'on' : 'off';
                const obstacleInput = document.getElementById('obstacleMode');
                if (obstacleInput) obstacleInput.value = obstacleMode;
                const obstacleCard = document.getElementById('uiToggleObstacles') || document.getElementById('cardObstacles');
                setAdvancedToggleState(obstacleCard, obstacleMode === 'on');

                const savedDensity = normalizeObstacleDensity(prefs.obstacleDensity);
                const densityInput = document.getElementById('obstacleDensity');
                if (densityInput) densityInput.value = savedDensity;
                selectObstacleDensity(savedDensity, true);
                const densitySelector = document.getElementById('obstacleDensitySelector');
                if (densitySelector) densitySelector.classList.toggle('visible', obstacleMode === 'on');

                if (Array.isArray(prefs.players)) {
                    prefs.players.slice(0, 4).forEach((player, idx) => {
                        const index = idx + 1;
                        const nameInput = document.getElementById(`player${index}Name`);
                        const colorInput = document.getElementById(`player${index}Color`);
                        if (nameInput && player && typeof player.name === 'string') {
                            nameInput.value = player.name.slice(0, 20);
                        }
                        if (colorInput && player && typeof player.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(player.color)) {
                            colorInput.value = player.color;
                        }
                    });
                }

                const signalingInput = document.getElementById('signalingUrlInput');
                if (signalingInput && typeof prefs.signalingUrl === 'string' && prefs.signalingUrl.trim()) {
                    signalingInput.value = prefs.signalingUrl.trim();
                    persistSignalingUrl(signalingInput.value);
                }
            } catch (_error) {
                // Ignore malformed storage data.
            }
        }

        function initializeSetupPreferencePersistence() {
            const fieldsToWatch = [
                'gameMode',
                'gridSize',
                'onlinePlayersCount',
                'gamePace',
                'blitzTurnTime',
                'aiDifficulty',
                'player1Name',
                'player2Name',
                'player3Name',
                'player4Name',
                'player1Color',
                'player2Color',
                'player3Color',
                'player4Color',
                'signalingUrlInput'
            ];

            fieldsToWatch.forEach((fieldId) => {
                const element = document.getElementById(fieldId);
                if (!element) return;
                element.addEventListener('change', saveSetupPreferences);
                element.addEventListener('input', saveSetupPreferences);
            });
        }

        function setJoinerSetupLocked(locked) {
            const gridSizeInput = document.getElementById('gridSize');
            const onlinePlayersInput = document.getElementById('onlinePlayersCount');
            const gamePaceInput = document.getElementById('gamePace');
            const blitzTurnInput = document.getElementById('blitzTurnTime');
            const gravityCard = document.getElementById('uiToggleGravity') || document.getElementById('cardGravity');
            const nexusCard = document.getElementById('uiToggleNexus') || document.getElementById('cardNexus');
            const obstaclesCard = document.getElementById('uiToggleObstacles') || document.getElementById('cardObstacles');
            const densityOptions = document.querySelectorAll('.density-option');
            const gridButtons = [6, 8, 10, 12]
                .map(size => document.getElementById(`gridBtn${size}`))
                .filter(Boolean);
            const onlinePlayersButtons = [2, 3, 4]
                .map(count => document.getElementById(`onlinePlayersBtn${count}`))
                .filter(Boolean);
            const paceButtons = ['classic', 'blitz']
                .map(pace => document.getElementById(`paceBtn_${pace}`))
                .filter(Boolean);

            if (gridSizeInput) gridSizeInput.disabled = locked;
            if (onlinePlayersInput) onlinePlayersInput.disabled = locked;
            if (gamePaceInput) gamePaceInput.disabled = locked;
            if (blitzTurnInput) blitzTurnInput.disabled = locked;
            if (gravityCard) gravityCard.classList.toggle('locked', locked);
            if (nexusCard) nexusCard.classList.toggle('locked', locked);
            if (obstaclesCard) obstaclesCard.classList.toggle('locked', locked);
            densityOptions.forEach((option) => {
                option.disabled = locked;
            });
            gridButtons.forEach((button) => {
                button.disabled = locked;
                button.classList.toggle('opacity-60', locked);
                button.classList.toggle('cursor-not-allowed', locked);
            });
            onlinePlayersButtons.forEach((button) => {
                button.disabled = locked;
                button.classList.toggle('opacity-60', locked);
                button.classList.toggle('cursor-not-allowed', locked);
            });
            paceButtons.forEach((button) => {
                button.disabled = locked;
                button.classList.toggle('opacity-60', locked);
                button.classList.toggle('cursor-not-allowed', locked);
            });
        }

        function normalizeHostGameOptions(rawOptions = {}) {
            const options = rawOptions && typeof rawOptions === 'object' ? rawOptions : {};
            return {
                blitzEnabled: Boolean(options.blitzEnabled),
                blitzTurnSeconds: normalizeBlitzTurnSeconds(options.blitzTurnSeconds ?? 10),
                gravityEnabled: Boolean(options.gravityEnabled),
                hyperNexusEnabled: Boolean(options.hyperNexusEnabled),
                obstacleEnabled: Boolean(options.obstacleEnabled),
                obstacleDensity: normalizeObstacleDensity(options.obstacleDensity)
            };
        }

        function normalizeHostPlayerNames(rawNames = [], count = 2) {
            const safeCount = normalizeOnlinePlayersCount(count);
            const names = Array.isArray(rawNames) ? rawNames : [];
            const normalized = [];
            for (let index = 0; index < safeCount; index++) {
                const fallback = `Joueur ${index + 1}`;
                normalized.push(normalizePlayerName(names[index], fallback));
            }
            return normalized;
        }

        function normalizeHostPlayerColors(rawColors = [], count = 2) {
            const safeCount = normalizeOnlinePlayersCount(count);
            const colors = Array.isArray(rawColors) ? rawColors : [];
            const fallbackColors = ['#328DCB', '#FF4081', '#10B981', '#F59E0B'];
            const normalized = [];
            for (let index = 0; index < safeCount; index++) {
                const candidate = String(colors[index] || '').trim();
                normalized.push(/^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate : fallbackColors[index % fallbackColors.length]);
            }
            return normalized;
        }

        function applyHostConfigToSetup(hostConfig, lockJoiner = false) {
            if (!hostConfig) return;
            const gridSize = normalizeGridSize(hostConfig.gridSize ?? 8);
            const options = normalizeHostGameOptions(hostConfig.gameOptions);
            const onlinePlayersCount = normalizeOnlinePlayersCount(hostConfig.onlinePlayersCount ?? 2);
            const onlinePlayerNames = normalizeHostPlayerNames(hostConfig.onlinePlayerNames, onlinePlayersCount);
            const onlinePlayerColors = normalizeHostPlayerColors(hostConfig.onlinePlayerColors, onlinePlayersCount);

            const gridSizeInput = document.getElementById('gridSize');
            const onlinePlayersInput = document.getElementById('onlinePlayersCount');
            const gamePaceInput = document.getElementById('gamePace');
            const blitzTurnInput = document.getElementById('blitzTurnTime');
            const gravityInput = document.getElementById('gravityShift');
            const nexusInput = document.getElementById('hyperNexus');
            const obstacleInput = document.getElementById('obstacleMode');
            const obstacleDensityInput = document.getElementById('obstacleDensity');
            const densitySelector = document.getElementById('obstacleDensitySelector');
            const gravityCard = document.getElementById('uiToggleGravity') || document.getElementById('cardGravity');
            const nexusCard = document.getElementById('uiToggleNexus') || document.getElementById('cardNexus');
            const obstaclesCard = document.getElementById('uiToggleObstacles') || document.getElementById('cardObstacles');

            if (gridSizeInput) {
                gridSizeInput.value = String(gridSize);
            }
            if (onlinePlayersInput) {
                onlinePlayersInput.value = String(onlinePlayersCount);
            }
            setOnlinePlayersCount(onlinePlayersCount, true);
            if (gamePaceInput) {
                gamePaceInput.value = options.blitzEnabled ? 'blitz' : 'classic';
            }
            if (blitzTurnInput) {
                blitzTurnInput.value = String(options.blitzTurnSeconds);
            }
            if (gravityInput) {
                gravityInput.value = options.gravityEnabled ? 'on' : 'off';
            }
            if (nexusInput) {
                nexusInput.value = options.hyperNexusEnabled ? 'on' : 'off';
            }
            if (obstacleInput) {
                obstacleInput.value = options.obstacleEnabled ? 'on' : 'off';
            }
            if (obstacleDensityInput) {
                obstacleDensityInput.value = options.obstacleDensity;
            }
            if (densitySelector) {
                densitySelector.classList.toggle('visible', options.obstacleEnabled);
            }
            selectObstacleDensity(options.obstacleDensity, true);
            setAdvancedToggleState(gravityCard, options.gravityEnabled);
            setAdvancedToggleState(nexusCard, options.hyperNexusEnabled);
            setAdvancedToggleState(obstaclesCard, options.obstacleEnabled);
            onlinePlayerNames.forEach((name, idx) => {
                const nameInput = document.getElementById(`player${idx + 1}Name`);
                if (nameInput) {
                    nameInput.value = name;
                }
            });
            onlinePlayerColors.forEach((color, idx) => {
                const colorInput = document.getElementById(`player${idx + 1}Color`);
                if (colorInput) {
                    colorInput.value = color;
                }
            });
            syncLobbyPlayerName(document.getElementById('player1Name')?.value ?? '', true);

            if (lockJoiner) {
                setJoinerSetupLocked(true);
            }
            updateGamePaceUI();
        }

        async function applyHostSessionConfig(sessionInfo) {
            if (isHost || !sessionInfo) return;

            const hostConfig = {
                gridSize: normalizeGridSize(sessionInfo.gridSize ?? 8),
                gameOptions: normalizeHostGameOptions(sessionInfo.gameOptions),
                onlinePlayersCount: normalizeOnlinePlayersCount(sessionInfo.onlinePlayersCount ?? (sessionInfo.playerNames?.length || 2)),
                onlinePlayerNames: normalizeHostPlayerNames(
                    sessionInfo.playerNames || sessionInfo.onlinePlayerNames || [],
                    sessionInfo.onlinePlayersCount ?? (sessionInfo.playerNames?.length || 2)
                ),
                onlinePlayerColors: normalizeHostPlayerColors(
                    sessionInfo.playerColors || sessionInfo.onlinePlayerColors || [],
                    sessionInfo.onlinePlayersCount ?? (sessionInfo.playerNames?.length || 2)
                )
            };
            bluetoothSession.hostConfig = hostConfig;
            applyHostConfigToSetup(hostConfig, true);

            if (!window.game) return;

            const currentGridSize = normalizeGridSize(window.game.size);
            const currentOptions = {
                blitzEnabled: Boolean(window.game.blitzEnabled),
                blitzTurnSeconds: normalizeBlitzTurnSeconds(window.game.turnDurationMs ? window.game.turnDurationMs / 1000 : 10),
                gravityEnabled: Boolean(window.game.gravityEnabled),
                hyperNexusEnabled: Boolean(window.game.hyperNexusEnabled),
                obstacleEnabled: Boolean(window.game.obstacleEnabled),
                obstacleDensity: normalizeObstacleDensity(window.game.obstacleDensity)
            };
            const currentPlayersCount = normalizeOnlinePlayersCount(window.game.players?.length || 2);
            const currentNames = (window.game.players || []).map((player, idx) =>
                normalizePlayerName(player?.name, `Joueur ${idx + 1}`)
            );
            const hasDifference =
                currentGridSize !== hostConfig.gridSize ||
                currentOptions.blitzEnabled !== hostConfig.gameOptions.blitzEnabled ||
                currentOptions.blitzTurnSeconds !== hostConfig.gameOptions.blitzTurnSeconds ||
                currentOptions.gravityEnabled !== hostConfig.gameOptions.gravityEnabled ||
                currentOptions.hyperNexusEnabled !== hostConfig.gameOptions.hyperNexusEnabled ||
                currentOptions.obstacleEnabled !== hostConfig.gameOptions.obstacleEnabled ||
                currentOptions.obstacleDensity !== hostConfig.gameOptions.obstacleDensity ||
                currentPlayersCount !== hostConfig.onlinePlayersCount ||
                currentNames.slice(0, hostConfig.onlinePlayersCount).join('|') !== hostConfig.onlinePlayerNames.join('|');

            if (!hasDifference) return;

            const players = buildOnlinePlayersFromConfig(hostConfig);
            window.game = new Game(players, false, hostConfig.gridSize, hostConfig.gameOptions);
            const undoButton = document.getElementById('undoButton');
            if (undoButton) {
                undoButton.disabled = true;
            }
            if (connectionStatus.connected) {
                await sendBluetoothData({ type: 'requestSync' });
            }
            showToast('Parametres synchronises avec l hote.', 'info');
        }

        class Game {
            constructor(players, withAI = false, size = 8, options = {}) {
                this.size = normalizeGridSize(size);
                this.players = players;
                this.currentPlayerIndex = 0;
                this.points = new Map();
                this.boxes = new Map();
                this.withAI = withAI;
                this.ai = withAI ? new AI(players[1].color) : null;
                this.gameOver = false;
                this.blitzEnabled = Boolean(options.blitzEnabled);
                this.turnDurationMs = this.blitzEnabled
                    ? normalizeBlitzTurnSeconds(options.blitzTurnSeconds) * 1000
                    : 0;
                this.turnDeadlineTs = null;
                this.turnTickerId = null;
                this.endReason = 'board';
                this.timedOutPlayerIndex = null;

                // Gravity Shift properties
                this.gravityEnabled = Boolean(options.gravityEnabled);
                this.gravityDirection = 'down';
                this.movesUntilShiftCount = 10;
                this.initialMovesUntilShift = 10;

                // Hyper-Nexus properties
                this.hyperNexusEnabled = Boolean(options.hyperNexusEnabled);
                this.isNexusChain = false;

                // Obstacles mode properties
                this.obstacleEnabled = Boolean(options.obstacleEnabled);
                this.obstacleDensity = normalizeObstacleDensity(options.obstacleDensity);
                this.obstacles = new Set();

                this.players.forEach(player => {
                    player.score = 0;
                    player.boxCounter = 0;
                });

                this.initializeGame();
                if (withAI) {
                    this.handleAITurn();
                }

                // Gravity UI init
                this.refreshGravityIndicator();
            }

            async handleAITurn() {
                if (this.withAI && this.currentPlayerIndex === 1 && !this.gameOver) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const move = await this.ai.makeMove(this);
                    if (move) {
                        await this.handlePointClick(move.x, move.y, 'ai');
                    }
                }
            }

            initializeGame() {
                this.gameOver = false;
                this.endReason = 'board';
                this.timedOutPlayerIndex = null;
                moveHistory = [];
                this.stopTurnTimer();

                const undoButton = document.getElementById('undoButton');
                if (undoButton) {
                    undoButton.disabled = true;
                }

                if (!this.obstacleEnabled) {
                    this.obstacles.clear();
                } else if (this.obstacles.size === 0) {
                    this.generateObstacles();
                }

                this.initGrid();
                this.initScoreBoard();
                this.updateUI();
                this.startTurnTimer(true);
            }

            initScoreBoard() {
                const scoreBoard = document.getElementById('playerScoresHeader') || document.getElementById('playerScores');
                if (!scoreBoard) return;
                scoreBoard.innerHTML = '';

                this.players.forEach((player, index) => {
                    const scoreCard = document.createElement('div');
                    scoreCard.id = `player${index}Score`;
                    scoreCard.className = 'rounded-lg border px-2 py-1.5 bg-slate-900/45 border-slate-700/55 transition-all';
                    scoreCard.innerHTML = `
                <div class="flex items-center justify-between gap-1.5">
                    <div class="flex items-center gap-1.5 min-w-0">
                        <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${player.color}"></span>
                        <span class="text-[10px] font-bold text-slate-100 truncate">${player.name}</span>
                    </div>
                    <span class="text-[8px] uppercase tracking-wider text-slate-400 shrink-0">J${index + 1}</span>
                </div>
                <div class="mt-0.5 flex items-end justify-between gap-2 leading-none">
                    <div class="flex items-end gap-1">
                        <span id="boxes${index}" class="text-xl leading-none font-black text-white">${player.boxCounter ?? 0}</span>
                        <span class="text-[9px] font-bold uppercase tracking-wider text-slate-300">carres</span>
                    </div>
                    <div class="text-[9px] text-slate-400 whitespace-nowrap">Pts: <span id="score${index}" class="font-bold text-slate-200">${player.score}</span></div>
                </div>
            `;
                    scoreBoard.appendChild(scoreCard);
                });
            }

            initGrid() {
                const grid = document.getElementById('grid');
                grid.innerHTML = '';
                grid.style.setProperty('--grid-size', String(this.size));
                const cellSize = 100 / this.size;

                // Layer for obstacles
                const obstaclesLayer = document.createElement('div');
                obstaclesLayer.id = 'obstaclesLayer';
                obstaclesLayer.className = 'grid-layer';
                grid.appendChild(obstaclesLayer);

                // Layer for boxes
                const boxesLayer = document.createElement('div');
                boxesLayer.id = 'boxesLayer';
                boxesLayer.className = 'grid-layer';
                grid.appendChild(boxesLayer);

                // Layer for points
                const pointsLayer = document.createElement('div');
                pointsLayer.id = 'pointsLayer';
                pointsLayer.className = 'grid-layer';
                grid.appendChild(pointsLayer);

                this.renderObstacles();

                // Hitboxes for clicks
                for (let y = 0; y <= this.size; y++) {
                    for (let x = 0; x <= this.size; x++) {
                        const hitbox = document.createElement('div');
                        hitbox.className = 'point-hitbox';
                        hitbox.style.left = `${x * cellSize}%`;
                        hitbox.style.top = `${y * cellSize}%`;
                        hitbox.dataset.x = x;
                        hitbox.dataset.y = y;
                        if (this.isObstaclePoint(x, y)) {
                            hitbox.classList.add('blocked');
                        } else {
                            hitbox.addEventListener('click', () => this.handlePointClick(x, y, 'local'));
                        }
                        grid.appendChild(hitbox);
                    }
                }
            }

            getObstacleTargetCount() {
                const interiorPoints = Math.max(0, (this.size - 1) * (this.size - 1));
                if (interiorPoints === 0) return 0;

                const densityRatios = { low: 0.08, medium: 0.14, high: 0.22 };
                const ratio = densityRatios[normalizeObstacleDensity(this.obstacleDensity)] || 0.14;
                const minCount = interiorPoints >= 16 ? 2 : 1;
                const maxCount = Math.max(minCount, Math.floor(interiorPoints * 0.3));
                const targetCount = Math.max(minCount, Math.round(interiorPoints * ratio));
                return Math.min(targetCount, maxCount);
            }

            generateObstacles() {
                this.obstacles.clear();
                if (!this.obstacleEnabled) return;

                const targetCount = this.getObstacleTargetCount();
                if (targetCount <= 0) return;

                const interiorCells = [];
                for (let y = 1; y < this.size; y++) {
                    for (let x = 1; x < this.size; x++) {
                        interiorCells.push({ x, y });
                    }
                }
                if (interiorCells.length === 0) return;

                const shuffle = (cells) => {
                    const copy = [...cells];
                    for (let i = copy.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [copy[i], copy[j]] = [copy[j], copy[i]];
                    }
                    return copy;
                };

                const getNeighborCount = (x, y) => {
                    let neighbors = 0;
                    for (let ny = Math.max(1, y - 1); ny <= Math.min(this.size - 1, y + 1); ny++) {
                        for (let nx = Math.max(1, x - 1); nx <= Math.min(this.size - 1, x + 1); nx++) {
                            if (nx === x && ny === y) continue;
                            if (this.obstacles.has(`${nx},${ny}`)) {
                                neighbors++;
                            }
                        }
                    }
                    return neighbors;
                };

                const addIfFree = (x, y) => {
                    const key = `${x},${y}`;
                    if (this.obstacles.has(key)) return false;
                    this.obstacles.add(key);
                    return true;
                };

                const halfX = Math.ceil((this.size - 1) / 2);
                const halfY = Math.ceil((this.size - 1) / 2);
                const quadrants = [
                    { x0: 1, x1: halfX, y0: 1, y1: halfY },
                    { x0: halfX + 1, x1: this.size - 1, y0: 1, y1: halfY },
                    { x0: 1, x1: halfX, y0: halfY + 1, y1: this.size - 1 },
                    { x0: halfX + 1, x1: this.size - 1, y0: halfY + 1, y1: this.size - 1 }
                ].filter(q => q.x1 >= q.x0 && q.y1 >= q.y0);

                const buckets = quadrants.length > 0
                    ? quadrants.map((q) =>
                        shuffle(
                            interiorCells.filter(
                                (cell) =>
                                    cell.x >= q.x0 && cell.x <= q.x1 &&
                                    cell.y >= q.y0 && cell.y <= q.y1
                            )
                        )
                    )
                    : [shuffle(interiorCells)];

                const perBucket = Math.floor(targetCount / buckets.length);
                let remaining = targetCount - (perBucket * buckets.length);

                buckets.forEach((cells, index) => {
                    const quota = perBucket + (index < remaining ? 1 : 0);
                    if (quota <= 0) return;

                    let placed = 0;
                    cells.forEach((cell) => {
                        if (placed >= quota || this.obstacles.size >= targetCount) return;
                        if (getNeighborCount(cell.x, cell.y) === 0 && addIfFree(cell.x, cell.y)) {
                            placed++;
                        }
                    });

                    if (placed < quota) {
                        const relaxed = cells
                            .filter((cell) => !this.obstacles.has(`${cell.x},${cell.y}`))
                            .sort((a, b) => getNeighborCount(a.x, a.y) - getNeighborCount(b.x, b.y));

                        relaxed.forEach((cell) => {
                            if (placed >= quota || this.obstacles.size >= targetCount) return;
                            if (addIfFree(cell.x, cell.y)) {
                                placed++;
                            }
                        });
                    }
                });

                if (this.obstacles.size < targetCount) {
                    const fallback = shuffle(interiorCells)
                        .filter((cell) => !this.obstacles.has(`${cell.x},${cell.y}`))
                        .sort((a, b) => getNeighborCount(a.x, a.y) - getNeighborCount(b.x, b.y));

                    for (const cell of fallback) {
                        if (this.obstacles.size >= targetCount) break;
                        addIfFree(cell.x, cell.y);
                    }
                }
            }

            renderObstacles() {
                const obstaclesLayer = document.getElementById('obstaclesLayer');
                if (!obstaclesLayer) return;
                obstaclesLayer.innerHTML = '';

                // Update obstacle count badge
                const badge = document.getElementById('obstacleCountBadge');
                const badgeText = document.getElementById('obstacleCountText');
                if (badge && badgeText) {
                    if (this.obstacleEnabled && this.obstacles.size > 0) {
                        badge.style.display = 'inline-flex';
                        badgeText.textContent = `${this.obstacles.size} obstacle${this.obstacles.size > 1 ? 's' : ''}`;
                    } else {
                        badge.style.display = 'none';
                    }
                }

                if (!this.obstacleEnabled || this.obstacles.size === 0) return;

                const cellSize = 100 / this.size;
                const markerSize = Math.max(4.8, 68 / this.size);
                let animDelay = 0;
                this.obstacles.forEach((key) => {
                    const [x, y] = key.split(',').map(Number);
                    const marker = document.createElement('div');
                    marker.className = 'obstacle-marker';
                    marker.style.left = `${x * cellSize}%`;
                    marker.style.top = `${y * cellSize}%`;
                    marker.style.width = `${markerSize}%`;
                    marker.style.height = `${markerSize}%`;
                    marker.style.animationDelay = `${animDelay}s, 0s`;
                    const tooltip = document.createElement('span');
                    tooltip.className = 'obstacle-tooltip';
                    tooltip.textContent = 'Point bloque';
                    marker.appendChild(tooltip);
                    obstaclesLayer.appendChild(marker);
                    animDelay += 0.04;
                });
            }

            isObstaclePoint(x, y) {
                return this.obstacleEnabled && this.obstacles.has(`${x},${y}`);
            }

            isObstacleKey(pointKey) {
                return this.obstacleEnabled && this.obstacles.has(pointKey);
            }

            getTotalPlayablePoints() {
                const totalPoints = (this.size + 1) * (this.size + 1);
                const blockedPoints = this.obstacleEnabled ? this.obstacles.size : 0;
                return Math.max(0, totalPoints - blockedPoints);
            }

            isLocalTurn() {
                if (this.withAI) {
                    return this.currentPlayerIndex === 0;
                }

                if (bluetoothConnection) {
                    if (!connectionStatus.connected) {
                        return false;
                    }
                    if (!networkMatchState.started) {
                        return false;
                    }
                    const localIndices = getLocalPlayerIndices(this.players.length);
                    return localIndices.includes(this.currentPlayerIndex);
                }

                return true;
            }

            getRemainingTurnMs() {
                if (!this.blitzEnabled || this.gameOver || !this.turnDeadlineTs) {
                    return null;
                }
                return Math.max(0, this.turnDeadlineTs - Date.now());
            }

            shouldPauseBlitzTimer() {
                return Boolean(
                    this.blitzEnabled &&
                    bluetoothConnection &&
                    (!connectionStatus.connected || !networkMatchState.started)
                );
            }

            refreshTurnTimerUI(remainingMs = this.getRemainingTurnMs()) {
                const turnTimer = document.getElementById('turnTimer');
                const blitzCountdown = document.getElementById('blitzCountdown');

                if (!this.blitzEnabled) {
                    if (turnTimer) {
                        turnTimer.textContent = 'Mode classique';
                        turnTimer.classList.remove('urgent');
                    }
                    if (blitzCountdown) {
                        blitzCountdown.style.display = 'none';
                        blitzCountdown.classList.remove('urgent');
                        blitzCountdown.textContent = 'Decompte: --';
                    }
                    return;
                }

                if (this.shouldPauseBlitzTimer()) {
                    if (turnTimer) {
                        turnTimer.textContent = connectionStatus.connected && !networkMatchState.started
                            ? 'Blitz en attente du demarrage...'
                            : 'Blitz en attente de connexion...';
                        turnTimer.classList.remove('urgent');
                    }
                    if (blitzCountdown) {
                        blitzCountdown.style.display = 'block';
                        blitzCountdown.classList.remove('urgent');
                        blitzCountdown.textContent = 'Decompte: --';
                    }
                    return;
                }

                if (this.gameOver) {
                    if (turnTimer) {
                        turnTimer.textContent = 'Chrono termine';
                        turnTimer.classList.remove('urgent');
                    }
                    if (blitzCountdown) {
                        blitzCountdown.style.display = 'block';
                        blitzCountdown.classList.remove('urgent');
                        blitzCountdown.textContent = 'Decompte: 0.0s';
                    }
                    return;
                }

                const safeRemaining = Math.max(0, remainingMs ?? this.turnDurationMs);
                const remainingText = `${(safeRemaining / 1000).toFixed(1)}s`;
                const isUrgent = safeRemaining <= 3000;

                if (turnTimer) {
                    turnTimer.textContent = `Temps restant: ${remainingText}`;
                    turnTimer.classList.toggle('urgent', isUrgent);
                }
                if (blitzCountdown) {
                    blitzCountdown.style.display = 'block';
                    blitzCountdown.textContent = `Decompte: ${remainingText}`;
                    blitzCountdown.classList.toggle('urgent', isUrgent);
                }
            }

            stopTurnTimer() {
                if (this.turnTickerId) {
                    clearInterval(this.turnTickerId);
                    this.turnTickerId = null;
                }
            }

            startTurnTimer(resetDeadline = true) {
                this.stopTurnTimer();
                if (!this.blitzEnabled || this.gameOver) {
                    this.refreshTurnTimerUI();
                    return;
                }

                if (this.shouldPauseBlitzTimer()) {
                    this.turnDeadlineTs = null;
                    this.refreshTurnTimerUI();
                    return;
                }

                if (resetDeadline || !Number.isFinite(this.turnDeadlineTs)) {
                    this.turnDeadlineTs = Date.now() + this.turnDurationMs;
                }

                this.refreshTurnTimerUI();
                this.turnTickerId = window.setInterval(() => {
                    if (this.shouldPauseBlitzTimer()) {
                        this.turnDeadlineTs = null;
                        this.stopTurnTimer();
                        this.refreshTurnTimerUI();
                        return;
                    }

                    const remaining = this.getRemainingTurnMs();
                    if (remaining === null) {
                        this.stopTurnTimer();
                        return;
                    }

                    if (remaining <= 0) {
                        if (bluetoothConnection && !isHost) {
                            this.stopTurnTimer();
                            this.refreshTurnTimerUI(0);
                            return;
                        }
                        this.handleTurnTimeout().catch((error) => {
                            console.error('Erreur timeout Blitz:', error);
                        });
                        return;
                    }

                    this.refreshTurnTimerUI(remaining);
                }, 100);
            }

            async handleTurnTimeout() {
                if (!this.blitzEnabled || this.gameOver) return;
                if (bluetoothConnection && !isHost) return;

                const timedOutPlayerIndex = this.currentPlayerIndex;
                const finished = this.finishGame('timeout', timedOutPlayerIndex);
                if (!finished) return;

                if (soundEnabled) {
                    playSound('timeout');
                }

                if (bluetoothConnection && isHost) {
                    await sendBluetoothData({
                        type: 'timeout',
                        playerIndex: timedOutPlayerIndex
                    });
                }
            }

            applyTimeout(playerIndex) {
                if (this.gameOver) return;
                if (Number.isInteger(playerIndex) && playerIndex >= 0 && playerIndex < this.players.length) {
                    this.currentPlayerIndex = playerIndex;
                }
                if (soundEnabled) {
                    playSound('timeout');
                }
                this.finishGame('timeout', this.currentPlayerIndex);
            }

            finishGame(reason = 'board', timedOutPlayerIndex = null) {
                if (this.gameOver) return false;

                this.gameOver = true;
                this.endReason = reason;
                this.timedOutPlayerIndex = Number.isInteger(timedOutPlayerIndex) ? timedOutPlayerIndex : null;
                this.stopTurnTimer();
                this.refreshTurnTimerUI();
                this.updateUI();
                this.showGameOverScreen();
                return true;
            }

            createSnapshot() {
                return {
                    size: this.size,
                    points: Array.from(this.points.entries()),
                    boxes: Array.from(this.boxes.entries()),
                    currentPlayerIndex: this.currentPlayerIndex,
                    players: this.players.map(player => ({ ...player })),
                    gameOver: this.gameOver,
                    blitzEnabled: this.blitzEnabled,
                    turnDurationMs: this.turnDurationMs,
                    turnRemainingMs: this.getRemainingTurnMs(),
                    gravityEnabled: this.gravityEnabled,
                    gravityDirection: this.gravityDirection,
                    movesUntilShiftCount: this.movesUntilShiftCount,
                    initialMovesUntilShift: this.initialMovesUntilShift,
                    hyperNexusEnabled: this.hyperNexusEnabled,
                    obstacleEnabled: this.obstacleEnabled,
                    obstacleDensity: normalizeObstacleDensity(this.obstacleDensity),
                    obstacles: Array.from(this.obstacles),
                    endReason: this.endReason,
                    timedOutPlayerIndex: this.timedOutPlayerIndex
                };
            }

            restoreSnapshot(snapshot, clearHistory = false) {
                if (!snapshot) return;

                if (snapshot.size !== undefined) {
                    this.size = normalizeGridSize(snapshot.size);
                }
                if (snapshot.blitzEnabled !== undefined) {
                    this.blitzEnabled = Boolean(snapshot.blitzEnabled);
                }
                if (snapshot.turnDurationMs !== undefined) {
                    const snapshotDurationMs = Number.parseInt(snapshot.turnDurationMs, 10);
                    this.turnDurationMs = Number.isFinite(snapshotDurationMs) && snapshotDurationMs > 0
                        ? snapshotDurationMs
                        : this.turnDurationMs;
                }
                if (snapshot.gravityEnabled !== undefined) {
                    this.gravityEnabled = Boolean(snapshot.gravityEnabled);
                }
                if (snapshot.gravityDirection !== undefined) {
                    this.gravityDirection = ['up', 'down', 'left', 'right'].includes(snapshot.gravityDirection)
                        ? snapshot.gravityDirection
                        : this.gravityDirection;
                }
                if (snapshot.initialMovesUntilShift !== undefined) {
                    const restoredInitial = Number.parseInt(snapshot.initialMovesUntilShift, 10);
                    this.initialMovesUntilShift = Number.isFinite(restoredInitial) && restoredInitial > 0
                        ? restoredInitial
                        : this.initialMovesUntilShift;
                }
                if (snapshot.movesUntilShiftCount !== undefined) {
                    const restoredMoves = Number.parseInt(snapshot.movesUntilShiftCount, 10);
                    this.movesUntilShiftCount = Number.isFinite(restoredMoves) && restoredMoves >= 0
                        ? restoredMoves
                        : this.initialMovesUntilShift;
                }
                if (snapshot.hyperNexusEnabled !== undefined) {
                    this.hyperNexusEnabled = Boolean(snapshot.hyperNexusEnabled);
                }
                if (snapshot.obstacleEnabled !== undefined) {
                    this.obstacleEnabled = Boolean(snapshot.obstacleEnabled);
                }
                if (snapshot.obstacleDensity !== undefined) {
                    this.obstacleDensity = normalizeObstacleDensity(snapshot.obstacleDensity);
                }
                if (Array.isArray(snapshot.obstacles)) {
                    const restoredObstacles = new Set();
                    snapshot.obstacles.forEach((key) => {
                        const coords = String(key).split(',').map(Number);
                        if (coords.length !== 2) return;
                        const [ox, oy] = coords;
                        if (!Number.isInteger(ox) || !Number.isInteger(oy)) return;
                        if (ox < 0 || ox > this.size || oy < 0 || oy > this.size) return;
                        restoredObstacles.add(`${ox},${oy}`);
                    });
                    this.obstacles = restoredObstacles;
                } else if (!this.obstacleEnabled) {
                    this.obstacles.clear();
                }
                this.points = new Map(snapshot.points);
                this.boxes = new Map(snapshot.boxes);
                this.currentPlayerIndex = snapshot.currentPlayerIndex;
                this.players = snapshot.players.map(player => ({ ...player }));
                this.gameOver = Boolean(snapshot.gameOver);
                this.endReason = snapshot.endReason || 'board';
                this.timedOutPlayerIndex = Number.isInteger(snapshot.timedOutPlayerIndex)
                    ? snapshot.timedOutPlayerIndex
                    : null;

                const restoredRemainingMs = Number.parseInt(snapshot.turnRemainingMs, 10);
                if (this.blitzEnabled && !this.gameOver) {
                    const safeRemaining = Number.isFinite(restoredRemainingMs) && restoredRemainingMs > 0
                        ? restoredRemainingMs
                        : this.turnDurationMs;
                    this.turnDeadlineTs = Date.now() + safeRemaining;
                } else {
                    this.turnDeadlineTs = null;
                }

                if (clearHistory) {
                    moveHistory = [];
                }

                const gameOverScreen = document.querySelector('.game-over-screen');
                if (gameOverScreen) {
                    gameOverScreen.remove();
                }

                this.initScoreBoard();
                this.initGrid();
                this.renderBoardState();
                this.updateUI();

                this.refreshGravityIndicator();

                if (this.gameOver) {
                    this.stopTurnTimer();
                    this.refreshTurnTimerUI();
                    this.showGameOverScreen();
                } else {
                    this.startTurnTimer(false);
                }
            }

            createBoxElement(x, y, boxOwnerIndex, boxNumber) {
                const boxOwner = this.players[boxOwnerIndex];
                const cellSize = 100 / this.size;
                const box = document.createElement('div');
                box.className = 'box visible';
                box.id = `box-${x}-${y}`;
                box.style.left = `${x * cellSize}%`;
                box.style.top = `${y * cellSize}%`;
                box.style.width = `${cellSize}%`;
                box.style.height = `${cellSize}%`;
                box.style.setProperty('--box-color-soft', `${boxOwner.color}8A`);

                const normalizedNumber = Number.isFinite(Number(boxNumber))
                    ? Number(boxNumber)
                    : Math.max(1, boxOwner.boxCounter || 1);
                const boxNumberElement = document.createElement('span');
                boxNumberElement.className = 'box-number';
                boxNumberElement.textContent = String(normalizedNumber);
                box.appendChild(boxNumberElement);

                return box;
            }

            addPointToUI(x, y, color, key) {
                const pointsLayer = document.getElementById('pointsLayer');
                if (!pointsLayer) return;

                const cellSize = 100 / this.size;
                const point = document.createElement('div');
                point.className = 'point visible';
                point.id = `point-${key.replace(',', '-')}`;
                point.style.left = `${x * cellSize}%`;
                point.style.top = `${y * cellSize}%`;
                point.style.setProperty('--point-color', color);
                pointsLayer.appendChild(point);
            }

            renderBoardState() {
                const pointsLayer = document.getElementById('pointsLayer');
                const boxesLayer = document.getElementById('boxesLayer');
                if (!pointsLayer || !boxesLayer) return;

                pointsLayer.innerHTML = '';
                boxesLayer.innerHTML = '';

                this.points.forEach((playerIndex, key) => {
                    const [x, y] = key.split(',').map(Number);
                    this.addPointToUI(x, y, this.players[playerIndex].color, key);
                });

                const boxCounters = this.players.map(() => 0);
                this.boxes.forEach((boxOwnerIndex, boxKey) => {
                    const [x, y] = boxKey.split(',').map(Number);
                    boxCounters[boxOwnerIndex] += 1;
                    const box = this.createBoxElement(x, y, boxOwnerIndex, boxCounters[boxOwnerIndex]);
                    boxesLayer.appendChild(box);
                });

                this.players.forEach((player, index) => {
                    player.boxCounter = boxCounters[index];
                    player.score = boxCounters[index];
                });
            }

            async handlePointClick(x, y, source = 'local', forcedPlayerIndex = null) {
                if (this.gameOver) return;

                if (source === 'local' && !this.isLocalTurn()) return;
                if (source === 'remote' && this.isLocalTurn()) return;

                const pointKey = `${x},${y}`;
                if (this.isObstacleKey(pointKey)) return;
                if (this.points.has(pointKey)) return;

                moveHistory.push(this.createSnapshot());
                const undoButton = document.getElementById('undoButton');
                if (undoButton) {
                    undoButton.disabled = Boolean(bluetoothConnection) || moveHistory.length === 0;
                }

                const actingPlayerIndex = forcedPlayerIndex !== null ? forcedPlayerIndex : this.currentPlayerIndex;
                const currentPlayer = this.players[actingPlayerIndex];
                this.points.set(pointKey, actingPlayerIndex);

                this.addPointToUI(x, y, currentPlayer.color, pointKey);

                const isNexus = source === 'nexus';

                if (isNexus) {
                    const pointEl = document.getElementById(`point-${pointKey.replace(',', '-')}`);
                    if (pointEl) pointEl.classList.add('nexus-point');
                }

                if (soundEnabled) {
                    playSound('click');
                }

                const boxesCompleted = this.checkForCompletedBoxes(x, y, actingPlayerIndex, isNexus);
                if (boxesCompleted > 0 && soundEnabled) {
                    playSound('complete');
                }
                if (boxesCompleted > 0) {
                    const suffix = boxesCompleted > 1 ? 's' : '';
                    showToast(`${currentPlayer.name} complete ${boxesCompleted} carre${suffix}.`, 'success');
                }

                if (bluetoothConnection && source === 'local') {
                    const sent = await sendBluetoothData({
                        type: 'move',
                        move: { x, y }
                    });
                    if (!sent) {
                        const previousState = moveHistory.pop();
                        if (previousState) {
                            this.restoreSnapshot(previousState);
                        }
                        showToast('Coup annule: connexion WebRTC indisponible.', 'error');
                        return;
                    }
                }

                if (source !== 'nexus') {
                    this.nextTurn();
                }

                if (this.gravityEnabled && source !== 'nexus') {
                    this.movesUntilShiftCount--;
                    if (this.movesUntilShiftCount <= 3 && this.movesUntilShiftCount > 0) {
                        if (soundEnabled) playSound('warning');
                    }
                    if (this.movesUntilShiftCount <= 0) {
                        this.applyGravityShift(actingPlayerIndex);
                    }
                }
                this.updateUI();
                this.checkGameEnd();

                if (this.withAI && source !== 'ai' && !isNexus) {
                    await this.handleAITurn();
                }
            }

            checkForCompletedBoxes(x, y, playerIndex, isNexus = false) {
                let boxesCompleted = 0;
                const positions = [
                    { x: x - 1, y: y - 1 }, { x: x, y: y - 1 },
                    { x: x - 1, y: y }, { x: x, y: y }
                ];

                positions.forEach(pos => {
                    if (this.isValidPosition(pos.x, pos.y)) {
                        if (this.checkBox(pos.x, pos.y)) {
                            this.completeBox(pos.x, pos.y, playerIndex, isNexus);
                            boxesCompleted++;
                        }
                    }
                });
                return boxesCompleted;
            }

            isValidPosition(x, y) {
                return x >= 0 && x < this.size && y >= 0 && y < this.size;
            }

            checkBox(x, y) {
                const pointKeys = [
                    `${x},${y}`, `${x + 1},${y}`,
                    `${x},${y + 1}`, `${x + 1},${y + 1}`
                ];

                if (pointKeys.some(key => this.isObstacleKey(key))) return false;
                if (!pointKeys.every(key => this.points.has(key))) return false;
                if (this.boxes.has(`${x},${y}`)) return false;


                const playerIndices = pointKeys.map(key => this.points.get(key));
                const firstPlayer = playerIndices[0];

                return playerIndices.every(player => player === firstPlayer);
            }

            canPlayerCompleteBox(x, y, playerIndex) {
                const corners = [
                    `${x},${y}`, `${x + 1},${y}`,
                    `${x},${y + 1}`, `${x + 1},${y + 1}`
                ];

                if (corners.some(key => this.isObstacleKey(key))) {
                    return false;
                }

                for (const key of corners) {
                    if (this.points.has(key) && this.points.get(key) !== playerIndex) {
                        return false;
                    }
                }
                return true;
            }

            isAnyBoxPossible() {
                for (let y = 0; y < this.size; y++) {
                    for (let x = 0; x < this.size; x++) {
                        if (this.boxes.has(`${x},${y}`)) continue;
                        for (let pIdx = 0; pIdx < this.players.length; pIdx++) {
                            if (this.canPlayerCompleteBox(x, y, pIdx)) return true;
                        }
                    }
                }
                return false;
            }

            completeBox(x, y, playerIndex, isNexus = false) {
                const pointKeys = [
                    `${x},${y}`, `${x + 1},${y}`,
                    `${x},${y + 1}`, `${x + 1},${y + 1}`
                ];

                const boxOwnerIndex = playerIndex;
                const boxOwner = this.players[boxOwnerIndex];

                boxOwner.score += isNexus ? 2 : 1;
                boxOwner.boxCounter++;

                this.boxes.set(`${x},${y}`, boxOwnerIndex);
                const box = this.createBoxElement(x, y, boxOwnerIndex, boxOwner.boxCounter);
                if (isNexus) box.classList.add('nexus-box');

                const boxesLayer = document.getElementById('boxesLayer');
                if (boxesLayer) {
                    boxesLayer.appendChild(box);
                } else {
                    document.getElementById('grid').appendChild(box);
                }

                if (typeof triggerConfetti === 'function') {
                    const rect = box.getBoundingClientRect();
                    triggerConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2, boxOwner.color);
                }

                if (this.hyperNexusEnabled) {
                    this.checkHyperNexus(x, y, boxOwnerIndex);
                }
            }

            nextTurn() {
                this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
                this.startTurnTimer(true);
                this.refreshGravityIndicator();
            }

            getGravityRotationDegrees() {
                if (this.gravityDirection === 'up') return 180;
                if (this.gravityDirection === 'left') return 90;
                if (this.gravityDirection === 'right') return -90;
                return 0;
            }

            refreshGravityIndicator() {
                const panel = document.getElementById('gravityPanel');
                if (panel) {
                    panel.style.display = this.gravityEnabled ? 'block' : 'none';
                    panel.classList.toggle('gravity-glow', this.gravityEnabled && this.movesUntilShiftCount <= 3);
                }

                if (!this.gravityEnabled) return;

                const movesEl = document.getElementById('movesUntilShift');
                const dirTextEl = document.getElementById('gravityDirectionText');
                const iconEl = document.getElementById('gravityIcon');

                if (movesEl) movesEl.textContent = this.movesUntilShiftCount;
                if (dirTextEl) dirTextEl.textContent = this.getGravityDirectionName();
                if (iconEl) iconEl.style.transform = `rotate(${this.getGravityRotationDegrees()}deg)`;
            }

            getGravityDirectionName() {
                switch (this.gravityDirection) {
                    case 'up': return 'Vers le haut';
                    case 'down': return 'Vers le bas';
                    case 'left': return 'Vers la gauche';
                    case 'right': return 'Vers la droite';
                    default: return 'Vers le bas';
                }
            }

            applyGravityShift(triggeringPlayerIndex = null) {
                const directions = ['up', 'down', 'left', 'right'];
                let newDirection = this.gravityDirection;
                while (newDirection === this.gravityDirection) {
                    newDirection = directions[Math.floor(Math.random() * directions.length)];
                }
                this.gravityDirection = newDirection;
                this.movesUntilShiftCount = this.initialMovesUntilShift;
                this.refreshGravityIndicator();

                const cellSize = 100 / this.size;

                // Overlay sequence
                const overlay = document.getElementById('gravityOverlay');
                const overlayIcon = document.getElementById('gravityOverlayIcon');
                if (overlay) {
                    const rot = this.getGravityRotationDegrees();
                    if (overlayIcon) overlayIcon.style.transform = `rotate(${rot}deg)`;

                    overlay.style.display = 'flex';
                    setTimeout(() => overlay.style.opacity = '1', 10);
                    if (soundEnabled) playSound('shift_slide');
                    setTimeout(() => {
                        overlay.style.opacity = '0';
                        setTimeout(() => overlay.style.display = 'none', 400);
                    }, 1200);
                }

                // 1. Group points into clusters (connected by squares)
                const clusters = this.findClusters();

                // 2. Sort clusters by their position according to gravity direction
                // to avoid collisions between moving clusters
                clusters.sort((a, b) => {
                    const boundsA = this.getClusterBounds(a);
                    const boundsB = this.getClusterBounds(b);
                    if (this.gravityDirection === 'down') return boundsB.maxY - boundsA.maxY;
                    if (this.gravityDirection === 'up') return boundsA.minY - boundsB.minY;
                    if (this.gravityDirection === 'right') return boundsB.maxX - boundsA.maxX;
                    if (this.gravityDirection === 'left') return boundsA.minX - boundsB.minX;
                    return 0;
                });

                const newPoints = new Map();
                const newBoxes = new Map();

                // Track occupied positions as we move clusters
                const occupied = new Set(this.obstacleEnabled ? this.obstacles : []);

                clusters.forEach(cluster => {
                    let slideDistance = 0;
                    let canMove = true;

                    while (canMove) {
                        const nextDistance = slideDistance + 1;
                        for (const pointKey of cluster.points) {
                            let [x, y] = pointKey.split(',').map(Number);
                            if (this.gravityDirection === 'down') y += nextDistance;
                            else if (this.gravityDirection === 'up') y -= nextDistance;
                            else if (this.gravityDirection === 'left') x -= nextDistance;
                            else if (this.gravityDirection === 'right') x += nextDistance;

                            if (x < 0 || x > this.size || y < 0 || y > this.size || occupied.has(`${x},${y}`)) {
                                canMove = false;
                                break;
                            }
                        }
                        if (canMove) slideDistance = nextDistance;
                    }

                    // Move all points in the cluster
                    cluster.points.forEach(pointKey => {
                        const playerIndex = this.points.get(pointKey);
                        let [x, y] = pointKey.split(',').map(Number);
                        if (this.gravityDirection === 'down') y += slideDistance;
                        else if (this.gravityDirection === 'up') y -= slideDistance;
                        else if (this.gravityDirection === 'left') x -= slideDistance;
                        else if (this.gravityDirection === 'right') x += slideDistance;

                        const newKey = `${x},${y}`;
                        newPoints.set(newKey, playerIndex);
                        occupied.add(newKey);

                        // Move Point DOM element
                        const pointEl = document.getElementById(`point-${pointKey.replace(',', '-')}`);
                        if (pointEl) {
                            pointEl.id = `point-${newKey.replace(',', '-')}`;
                            pointEl.style.left = `${x * cellSize}%`;
                            pointEl.style.top = `${y * cellSize}%`;
                        }
                    });

                    // Move all associated boxes
                    cluster.boxes.forEach(boxKey => {
                        const ownerIndex = this.boxes.get(boxKey);
                        let [x, y] = boxKey.split(',').map(Number);
                        if (this.gravityDirection === 'down') y += slideDistance;
                        else if (this.gravityDirection === 'up') y -= slideDistance;
                        else if (this.gravityDirection === 'left') x -= slideDistance;
                        else if (this.gravityDirection === 'right') x += slideDistance;

                        const newBoxKey = `${x},${y}`;
                        newBoxes.set(newBoxKey, ownerIndex);

                        // Move Box DOM element
                        const boxEl = document.getElementById(`box-${boxKey.replace(',', '-')}`);
                        if (boxEl) {
                            boxEl.id = `box-${newBoxKey.replace(',', '-')}`;
                            boxEl.style.left = `${x * cellSize}%`;
                            boxEl.style.top = `${y * cellSize}%`;
                        }
                    });
                });

                this.points = newPoints;
                this.boxes = newBoxes;

                // Recalculate if NEW boxes formed after movement
                setTimeout(() => {
                    let newBoxesCount = 0;
                    for (let y = 0; y < this.size; y++) {
                        for (let x = 0; x < this.size; x++) {
                            if (!this.boxes.has(`${x},${y}`) && this.checkBox(x, y)) {
                                const ownerIndex = this.points.get(`${x},${y}`);
                                this.completeBox(x, y, ownerIndex !== undefined ? ownerIndex : (triggeringPlayerIndex !== null ? triggeringPlayerIndex : this.currentPlayerIndex));
                                newBoxesCount++;
                            }
                        }
                    }
                    if (newBoxesCount > 0 && soundEnabled) {
                        if (newBoxesCount > 1) playSound('combo');
                        else playSound('complete');
                    }
                    if (soundEnabled) playSound('shift_impact');
                    this.refreshGravityIndicator();
                    this.updateUI();
                }, 600);

                const grid = document.getElementById('grid');
                grid.classList.add('gravity-shake');
                setTimeout(() => grid.classList.remove('gravity-shake'), 600);

                showToast(`Gravity Shift : ${this.getGravityDirectionName()} !`, 'info');
            }

            checkHyperNexus(bx, by, playerIndex) {
                const neighbors = [
                    { x: bx - 1, y: by }, { x: bx + 1, y: by },
                    { x: bx, y: by - 1 }, { x: bx, y: by + 1 }
                ];

                neighbors.forEach(pos => {
                    if (pos.x >= 0 && pos.x < this.size && pos.y >= 0 && pos.y < this.size) {
                        if (!this.boxes.has(`${pos.x},${pos.y}`)) {
                            this.tryCompleteNexus(pos.x, pos.y, playerIndex);
                        }
                    }
                });
            }

            tryCompleteNexus(bx, by, playerIndex) {
                const corners = [
                    { x: bx, y: by }, { x: bx + 1, y: by },
                    { x: bx, y: by + 1 }, { x: bx + 1, y: by + 1 }
                ];

                const missing = corners.filter(c => !this.points.has(`${c.x},${c.y}`));

                if (missing.length === 1) {
                    const p = missing[0];

                    setTimeout(() => {
                        if (!this.points.has(`${p.x},${p.y}`)) {
                            this.handlePointClick(p.x, p.y, 'nexus', playerIndex);
                        }
                    }, 250);
                }
            }

            findClusters() {
                const visitedPoints = new Set();
                const clusters = [];

                this.points.forEach((_, pointKey) => {
                    if (visitedPoints.has(pointKey)) return;

                    const clusterPoints = new Set();
                    const clusterBoxes = new Set();
                    const queue = [pointKey];
                    visitedPoints.add(pointKey);

                    while (queue.length > 0) {
                        const currentPoint = queue.shift();
                        clusterPoints.add(currentPoint);

                        const [cx, cy] = currentPoint.split(',').map(Number);

                        // Check all 4 potential boxes this point could be a corner of
                        const potentialBoxes = [
                            { bx: cx, by: cy }, { bx: cx - 1, by: cy },
                            { bx: cx, by: cy - 1 }, { bx: cx - 1, by: cy - 1 }
                        ];

                        potentialBoxes.forEach(({ bx, by }) => {
                            if (this.boxes.has(`${bx},${by}`)) {
                                clusterBoxes.add(`${bx},${by}`);
                                // All 4 corners of this box belong to the cluster
                                const corners = [`${bx},${by}`, `${bx + 1},${by}`, `${bx},${by + 1}`, `${bx + 1},${by + 1}`];
                                corners.forEach(cornerKey => {
                                    if (!visitedPoints.has(cornerKey)) {
                                        visitedPoints.add(cornerKey);
                                        queue.push(cornerKey);
                                    }
                                });
                            }
                        });
                    }
                    clusters.push({ points: Array.from(clusterPoints), boxes: Array.from(clusterBoxes) });
                });

                return clusters;
            }

            getClusterBounds(cluster) {
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                cluster.points.forEach(key => {
                    const [x, y] = key.split(',').map(Number);
                    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                });
                return { minX, maxX, minY, maxY };
            }

            updateUI() {
                const currentPlayer = this.players[this.currentPlayerIndex];

                this.players.forEach((player, index) => {
                    const scoreElement = document.getElementById(`score${index}`);
                    if (scoreElement) {
                        const oldScore = parseInt(scoreElement.textContent, 10) || 0;
                        if (oldScore !== player.score) {
                            scoreElement.textContent = player.score;
                            scoreElement.classList.add('bump');
                            setTimeout(() => scoreElement.classList.remove('bump'), 200);
                        }
                    }

                    const boxesElement = document.getElementById(`boxes${index}`);
                    if (boxesElement) {
                        const boxesCount = Number.isFinite(player.boxCounter) ? player.boxCounter : player.score;
                        const oldBoxes = parseInt(boxesElement.textContent, 10) || 0;
                        if (oldBoxes !== boxesCount) {
                            boxesElement.textContent = boxesCount;
                            boxesElement.classList.add('bump');
                            setTimeout(() => boxesElement.classList.remove('bump'), 200);
                        }
                    }

                    const scoreCard = document.getElementById(`player${index}Score`);
                    if (!scoreCard) return;

                    if (index === this.currentPlayerIndex) {
                        scoreCard.classList.add('ring-2', 'scale-[1.01]');
                        scoreCard.style.borderColor = `${player.color}CC`;
                        scoreCard.style.boxShadow = `0 0 0 1px ${player.color}66, 0 10px 18px rgba(2, 6, 23, 0.35)`;
                    } else {
                        scoreCard.classList.remove('ring-2', 'scale-[1.01]');
                        scoreCard.style.borderColor = 'rgba(100, 116, 139, 0.45)';
                        scoreCard.style.boxShadow = 'none';
                    }
                });

                const grid = document.getElementById('grid');
                if (grid) {
                    const isLocked = this.gameOver || !this.isLocalTurn();
                    grid.style.pointerEvents = isLocked ? 'none' : 'auto';
                    grid.dataset.locked = isLocked ? 'true' : 'false';
                    if (currentPlayer) {
                        grid.style.setProperty('--hover-color', `${currentPlayer.color}CC`);
                    }
                }

                const undoButton = document.getElementById('undoButton');
                if (undoButton) {
                    undoButton.disabled = Boolean(bluetoothConnection) || moveHistory.length === 0;
                }

                this.refreshGravityIndicator();
                this.updateStatusPanels();
            }

            updateStatusPanels() {
                const currentPlayer = this.players[this.currentPlayerIndex];
                const turnIndicator = document.getElementById('turnIndicator');
                const turnText = document.getElementById('turnText');
                const turnDot = document.getElementById('turnDot');
                const progressText = document.getElementById('progressText');
                const progressFill = document.getElementById('progressFill');
                const progressCount = document.getElementById('progressCount');
                const progressBar = document.getElementById('progressBar');
                const gameHint = document.getElementById('gameHint');
                const totalPossiblePoints = this.getTotalPlayablePoints();
                const completion = totalPossiblePoints > 0
                    ? Math.round((this.points.size / totalPossiblePoints) * 100)
                    : 0;

                if (turnIndicator && currentPlayer) {
                    turnIndicator.style.setProperty('--turn-color', currentPlayer.color);
                }
                if (turnText && currentPlayer) {
                    turnText.textContent = currentPlayer.name;
                }
                if (turnDot && currentPlayer) {
                    turnDot.style.backgroundColor = currentPlayer.color;
                }

                const turnHintState = (() => {
                    if (this.gameOver) {
                        return { text: 'Partie terminee.', persistent: true };
                    }
                    if (bluetoothConnection && !connectionStatus.connected) {
                        if (connectionStatus.reconnecting) {
                            const attempt = Math.max(1, connectionStatus.reconnectAttempt || 1);
                            const total = Math.max(1, connectionStatus.reconnectTotal || RECONNECTION_ATTEMPTS);
                            const retryCountdown = formatRetryCountdown(connectionStatus.nextRetryInMs);
                            return {
                                text: `Reconnexion auto ${attempt}/${total} dans ${retryCountdown}s...`,
                                persistent: true
                            };
                        }
                        return { text: 'Connexion WebRTC indisponible.', persistent: true };
                    }
                    if (bluetoothConnection && !networkMatchState.started) {
                        if (isMatchCountdownRunning()) {
                            return {
                                text: `Demarrage automatique dans ${getMatchCountdownRemainingSeconds()}s...`,
                                persistent: true
                            };
                        }
                        return {
                            text: isHost
                                ? (networkMatchState.guestReady
                                    ? 'Adversaire pret. Demarrage automatique...'
                                    : 'En attente que l adversaire soit pret.')
                                : 'En attente du demarrage automatique par l hote.',
                            persistent: true
                        };
                    }
                    if (!this.isLocalTurn()) {
                        return { text: 'Attendez le tour adverse.', persistent: false };
                    }
                    return { text: 'Selectionnez un point libre sur la grille.', persistent: false };
                })();
                setTurnHintMessage(turnHintState.text, { persistent: turnHintState.persistent });

                if (progressText) {
                    progressText.textContent = `${this.points.size} / ${totalPossiblePoints} points poses (${completion}%)`;
                }
                if (progressFill) {
                    progressFill.style.width = `${completion}%`;
                }
                if (progressCount) {
                    progressCount.textContent = `${this.points.size} / ${totalPossiblePoints}`;
                }
                if (progressBar) {
                    progressBar.style.height = `${completion}%`;
                }

                if (gameHint) {
                    if (bluetoothConnection) {
                        const sessionLabel = connectionStatus.sessionCode || '--';
                        const latencyLabel = formatLatencyForDisplay(connectionStatus.latencyMs);
                        if (connectionStatus.connected) {
                            if (!networkMatchState.started) {
                                if (isMatchCountdownRunning()) {
                                    gameHint.textContent = `Session ${sessionLabel} | ${latencyLabel} | Demarrage dans ${getMatchCountdownRemainingSeconds()}s.`;
                                } else {
                                    gameHint.textContent = isHost
                                        ? (networkMatchState.guestReady
                                            ? `Session ${sessionLabel} | ${latencyLabel} | Demarrage automatique de la manche.`
                                            : `Session ${sessionLabel} | ${latencyLabel} | En attente de l adversaire.`)
                                        : `Session ${sessionLabel} | ${latencyLabel} | En attente du demarrage automatique.`;
                                }
                            } else {
                                gameHint.textContent = this.blitzEnabled
                                    ? `Session ${sessionLabel} | ${latencyLabel} | Blitz ${Math.round(this.turnDurationMs / 1000)}s par tour.`
                                    : `Session ${sessionLabel} | ${latencyLabel} | Coups synchronises automatiquement.`;
                            }
                        } else if (connectionStatus.reconnecting) {
                            const attempt = Math.max(1, connectionStatus.reconnectAttempt || 1);
                            const total = Math.max(1, connectionStatus.reconnectTotal || RECONNECTION_ATTEMPTS);
                            const retryCountdown = formatRetryCountdown(connectionStatus.nextRetryInMs);
                            gameHint.textContent = `Reprise auto active: tentative ${attempt}/${total}, reprise dans ${retryCountdown}s.`;
                        } else {
                            gameHint.textContent = 'WebRTC indisponible. Reprise automatique en attente.';
                        }
                    } else if (this.blitzEnabled) {
                        gameHint.textContent = `Mode Blitz actif: ${Math.round(this.turnDurationMs / 1000)}s par tour.`;
                    } else {
                        gameHint.textContent = 'Astuce: completez des carres pour accelerer votre score.';
                    }
                }

                this.refreshTurnTimerUI();
            }

            checkGameEnd() {
                if (this.gameOver) return;

                const totalPossiblePoints = this.getTotalPlayablePoints();

                if (this.points.size === totalPossiblePoints || !this.isAnyBoxPossible()) {
                    this.finishGame(this.points.size === totalPossiblePoints ? 'board' : 'blocked');
                }
            }

            async showGameOverScreenLegacyOld() {
                const sortedPlayers = [...this.players].sort((a, b) => {
                    const indexA = this.players.indexOf(a);
                    const indexB = this.players.indexOf(b);

                    if (this.endReason === 'timeout' && Number.isInteger(this.timedOutPlayerIndex)) {
                        if (indexA === this.timedOutPlayerIndex) return 1;
                        if (indexB === this.timedOutPlayerIndex) return -1;
                    }

                    if (b.score !== a.score) {
                        return b.score - a.score;
                    }

                    return indexA - indexB;
                });

                const winner = sortedPlayers[0];
                const leaders = sortedPlayers.filter(player => player.score === winner.score);
                const timedOutPlayer = Number.isInteger(this.timedOutPlayerIndex)
                    ? this.players[this.timedOutPlayerIndex]
                    : null;

                let winnerMessage;
                if (this.endReason === 'timeout' && timedOutPlayer) {
                    winnerMessage = leaders.length > 1
                        ? `Temps ecoule pour ${timedOutPlayer.name}. Egalite en tete (${winner.score} pts).`
                        : `Temps ecoule pour ${timedOutPlayer.name}. ${winner.name} l'emporte !`;
                } else if (this.endReason === 'blocked') {
                    winnerMessage = leaders.length > 1
                        ? `Égalité ! (${winner.score} pts)`
                        : `${winner.name} l'emporte !`;
                } else {
                    winnerMessage = leaders.length > 1
                        ? `Égalité ! (${winner.score} pts)`
                        : `${winner.name} gagne !`;
                }

                const winnerColor = leaders.length > 1
                    ? 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)'
                    : winner.color;

                const winnerShadow = leaders.length > 1
                    ? 'rgba(16, 185, 129, 0.3)'
                    : `${winner.color}4D`;

                const gameOverScreen = document.createElement('div');
                gameOverScreen.className = 'game-over-screen';

                let scoresHtml = '';
                sortedPlayers.forEach((player, idx) => {
                    scoresHtml += `
                        <div class="final-score-card" style="transition-delay: ${0.4 + idx * 0.15}s">
                            <div class="final-score-player">
                                <span class="final-score-dot" style="--player-color: ${player.color}"></span>
                                ${player.name}
                            </div>
                            <div class="final-score-value">${player.score} pts</div>
                        </div>
                    `;
                });

                gameOverScreen.innerHTML = `
                    <div class="game-over-content">
                        <div class="game-over-header">
                            <h2>Partie Terminée</h2>
                        </div>
                        <div class="winner-badge" style="--winner-color: ${winnerColor}; --winner-shadow: ${winnerShadow}">
                            <span>🏆</span>
                            <span>${winnerMessage}</span>
                        </div>
                        <div class="final-scores">
                            ${scoresHtml}
                        </div>
                        <button class="start-button" onclick="restartGame()" style="margin-top: 1rem; animation: popIn 0.5s both; animation-delay: 1s;">
                            Recommencer
                        </button>
                    </div>
                `;

                document.body.appendChild(gameOverScreen);

                // Reveal scores sequentially
                setTimeout(() => {
                    const cards = gameOverScreen.querySelectorAll('.final-score-card');
                    cards.forEach(card => card.classList.add('reveal'));
                }, 50);

                // Celebratory confetti
                if (typeof triggerConfetti === 'function') {
                    const centerX = window.innerWidth / 2;
                    const centerY = window.innerHeight / 2;

                    // Multiple bursts
                    setTimeout(() => triggerConfetti(centerX, centerY, leaders.length > 1 ? '#10b981' : winner.color), 400);
                    setTimeout(() => triggerConfetti(centerX - 100, centerY + 50, '#3b82f6'), 700);
                    setTimeout(() => triggerConfetti(centerX + 100, centerY + 50, '#f59e0b'), 900);
                }

                if (soundEnabled) {
                    playSound('complete');
                }
            }

            async showGameOverScreen() {
                const sortedPlayers = [...this.players].sort((a, b) => {
                    const indexA = this.players.indexOf(a);
                    const indexB = this.players.indexOf(b);

                    if (this.endReason === 'timeout' && Number.isInteger(this.timedOutPlayerIndex)) {
                        if (indexA === this.timedOutPlayerIndex) return 1;
                        if (indexB === this.timedOutPlayerIndex) return -1;
                    }

                    if (b.score !== a.score) {
                        return b.score - a.score;
                    }

                    return indexA - indexB;
                });

                const winner = sortedPlayers[0];
                const leaders = sortedPlayers.filter(player => player.score === winner.score);
                const timedOutPlayer = Number.isInteger(this.timedOutPlayerIndex)
                    ? this.players[this.timedOutPlayerIndex]
                    : null;

                let winnerMessage;
                if (this.endReason === 'timeout' && timedOutPlayer) {
                    winnerMessage = leaders.length > 1
                        ? `Temps ecoule pour ${timedOutPlayer.name}. Egalite en tete (${winner.score} pts).`
                        : `Temps ecoule pour ${timedOutPlayer.name}. ${winner.name} l'emporte !`;
                } else if (this.endReason === 'blocked') {
                    winnerMessage = leaders.length > 1
                        ? `Egalite en tete (${winner.score} pts).`
                        : `${winner.name} l'emporte !`;
                } else {
                    winnerMessage = leaders.length > 1
                        ? `Egalite en tete (${winner.score} pts).`
                        : `${winner.name} gagne !`;
                }

                const reasonLabel = this.endReason === 'timeout'
                    ? 'Fin sur timeout'
                    : this.endReason === 'blocked'
                        ? 'Fin sur blocage'
                        : 'Fin sur grille pleine';

                const scoreRowsHtml = sortedPlayers.map((player, idx) => {
                    const rank = idx + 1;
                    const isLeader = player.score === winner.score;
                    const rankLabel = rank === 1 ? '1er' : rank === 2 ? '2e' : rank === 3 ? '3e' : `${rank}e`;
                    const cardClass = isLeader
                        ? 'bg-primary/10 dark:bg-primary/5 border-primary/30'
                        : 'bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60';
                    const statusLabel = timedOutPlayer === player
                        ? 'Temps ecoule'
                        : isLeader
                            ? 'Leader'
                            : 'Chasseur';

                    return `
                        <div class="flex items-center gap-4 border rounded-2xl px-4 py-3 ${cardClass}">
                            <div class="relative">
                                <div class="h-12 w-12 rounded-full border-2 flex items-center justify-center text-white font-black text-sm"
                                    style="background:${player.color}; border-color:${player.color};">${rank}</div>
                                <div class="absolute -top-1 -right-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-900 text-white">${rankLabel}</div>
                            </div>
                            <div class="flex-1">
                                <p class="font-bold text-slate-900 dark:text-slate-100">${player.name}</p>
                                <p class="text-[11px] text-slate-500 dark:text-slate-400">${statusLabel}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-xl font-bold ${isLeader ? 'text-primary' : 'text-slate-900 dark:text-slate-100'}">${player.score}</p>
                                <p class="text-[10px] uppercase font-bold tracking-wider text-slate-500">points</p>
                            </div>
                        </div>
                    `;
                }).join('');

                const gameOverScreen = document.createElement('div');
                gameOverScreen.className = 'game-over-screen fixed inset-0 z-[120] bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm overflow-y-auto no-scrollbar';
                gameOverScreen.innerHTML = `
                    <div class="min-h-screen w-full max-w-[430px] mx-auto flex flex-col px-4 pt-6 pb-8">
                        <div class="flex items-center justify-between mb-4">
                            <button onclick="restartGame()" class="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
                                <span class="material-symbols-outlined">close</span>
                            </button>
                            <h2 class="text-lg font-bold uppercase tracking-widest text-slate-900 dark:text-slate-100">Resultats</h2>
                            <div class="w-11"></div>
                        </div>

                        <div class="rounded-3xl border border-primary/20 overflow-hidden mb-5"
                            style="background-image: linear-gradient(160deg, rgba(19,127,236,0.28), rgba(16,25,34,0.95));">
                            <div class="p-6">
                                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">${reasonLabel}</p>
                                <p class="text-3xl font-black text-white leading-tight mb-2">${leaders.length > 1 ? 'Egalite en tete' : 'Victoire'}</p>
                                <p class="text-sm text-slate-200">${winnerMessage}</p>
                            </div>
                        </div>

                        <div class="mb-4 px-1">
                            <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">Classement final</h3>
                        </div>
                        <div class="space-y-2">
                            ${scoreRowsHtml}
                        </div>

                        <div class="mt-auto pt-6 space-y-3">
                            <button onclick="restartGame()" class="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-primary/30">
                                <span class="material-symbols-outlined">refresh</span>
                                Rejouer
                            </button>
                            <button onclick="restartGame()" class="w-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95">
                                <span class="material-symbols-outlined">home</span>
                                Menu principal
                            </button>
                        </div>
                    </div>
                `;

                document.body.appendChild(gameOverScreen);

                if (typeof triggerConfetti === 'function') {
                    const centerX = window.innerWidth / 2;
                    const centerY = window.innerHeight / 2;
                    setTimeout(() => triggerConfetti(centerX, centerY, leaders.length > 1 ? '#10b981' : winner.color), 350);
                    setTimeout(() => triggerConfetti(centerX - 90, centerY + 40, '#3b82f6'), 650);
                    setTimeout(() => triggerConfetti(centerX + 90, centerY + 40, '#f59e0b'), 850);
                }

                if (soundEnabled) {
                    playSound('complete');
                }
            }

        }

        let bluetoothConnection = null;
        let isHost = false;
        let connectionStatus = {
            connected: false,
            connecting: false,
            reconnecting: false,
            error: null,
            sessionCode: null,
            sessionVerified: false,
            latencyMs: null,
            latencyQuality: 'unknown',
            reconnectAttempt: 0,
            reconnectTotal: 0,
            nextRetryInMs: 0,
            statusDetail: ''
        };

        const RECONNECTION_ATTEMPTS = 4;
        const RECONNECTION_DELAY = 1800;
        const RECONNECTION_PROGRESS_TICK = 200;
        const CONNECTION_TIMEOUT = 12000;
        const HEARTBEAT_INTERVAL = 6000;
        const HEARTBEAT_TIMEOUT = 20000;
        const SIGNALING_CONNECT_TIMEOUT = 12000;
        const WEBRTC_CONNECT_TIMEOUT = 30000;
        const WEBRTC_HOST_WAIT_TIMEOUT = 180000;
        const WEBRTC_JOIN_WAIT_TIMEOUT = 60000;
        const AUTO_RESYNC_PUSH_INTERVAL = 2500;
        const AUTO_RESYNC_STALE_THRESHOLD = 7000;
        const AUTO_RESYNC_REQUEST_COOLDOWN = 3200;
        const AUTO_RESYNC_TICK_INTERVAL = 1000;
        const SIGNALING_URL_STORAGE_KEY = 'points.webrtc.signalingUrl';
        const SETUP_PREFERENCES_STORAGE_KEY = 'points.setupPreferences.v1';
        const BLUETOOTH_STATUS_COLLAPSED_KEY = 'points.webrtc.statusCollapsed.v1';
        const MATCH_START_COUNTDOWN_MS = 3000;
        const MATCH_START_GO_MS = 460;
        const TURN_HINT_AUTO_HIDE_MS = 3400;
        const WEBRTC_ICE_SERVERS = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ];

        let moveHistory = [];
        let soundEnabled = true;
        let heartbeatIntervalId = null;
        let heartbeatWatchdogId = null;
        let lastBluetoothActivityAt = 0;
        let reconnectInProgress = false;
        let pendingPings = new Map();
        let pingSequence = 0;
        let autoResyncIntervalId = null;
        let autoResyncTickInFlight = false;
        let lastSyncReceivedAt = 0;
        let lastAutoResyncSentAt = 0;
        let lastAutoResyncRequestAt = 0;
        let reconnectionBlockedReason = null;
        let bluetoothStatusCollapsed = false;
        let bluetoothSession = {
            code: null,
            expectedCode: null,
            verified: false,
            hostConfig: null
        };
        let pendingDataChannelReady = null;
        let networkMatchState = {
            started: false,
            hostReady: false,
            guestReady: false
        };
        let matchStartCountdown = {
            active: false,
            starting: false,
            endAtTs: 0,
            intervalId: null,
            hideTimeoutId: null,
            lastStep: null
        };
        let turnHintHideTimeoutId = null;

        function clearTurnHintHideTimer() {
            if (turnHintHideTimeoutId) {
                clearTimeout(turnHintHideTimeoutId);
                turnHintHideTimeoutId = null;
            }
        }

        function hideTurnHintMessage() {
            const wrapper = document.getElementById('turnHintWrapper');
            if (!wrapper) return;
            clearTurnHintHideTimer();
            wrapper.classList.add('opacity-0', 'invisible', 'translate-y-2');
        }

        function setTurnHintMessage(message, { persistent = false } = {}) {
            const wrapper = document.getElementById('turnHintWrapper');
            const turnHint = document.getElementById('turnHint');
            if (!wrapper || !turnHint) return;

            const text = String(message ?? '').trim();
            if (!text) {
                hideTurnHintMessage();
                return;
            }

            turnHint.textContent = text;
            wrapper.classList.remove('opacity-0', 'invisible', 'translate-y-2');
            clearTurnHintHideTimer();

            if (!persistent) {
                turnHintHideTimeoutId = setTimeout(() => {
                    wrapper.classList.add('opacity-0', 'invisible', 'translate-y-2');
                }, TURN_HINT_AUTO_HIDE_MS);
            }
        }

        function getLocalPlayerIndices(playersCount = 2) {
            const totalPlayers = normalizeOnlinePlayersCount(playersCount);
            if (totalPlayers <= 2) {
                return isHost ? [0] : [1];
            }
            if (totalPlayers === 3) {
                return isHost ? [0, 2] : [1];
            }
            return isHost ? [0, 2] : [1, 3];
        }

        function getRemotePlayerIndices(playersCount = 2) {
            const totalPlayers = normalizeOnlinePlayersCount(playersCount);
            const localIndices = new Set(getLocalPlayerIndices(totalPlayers));
            const remoteIndices = [];
            for (let idx = 0; idx < totalPlayers; idx++) {
                if (!localIndices.has(idx)) {
                    remoteIndices.push(idx);
                }
            }
            return remoteIndices;
        }

        function getPlayerName(inputId, fallbackName) {
            const input = document.getElementById(inputId);
            const name = input ? input.value.trim() : '';
            return name || fallbackName;
        }

        function syncLobbyPlayerName(rawName, skipSave = false) {
            const safeValue = String(rawName ?? '').slice(0, 20);
            const setupInput = document.getElementById('player1Name');
            const lobbyInput = document.getElementById('lobbyPlayerName');

            if (setupInput && setupInput.value !== safeValue) {
                setupInput.value = safeValue;
            }
            if (lobbyInput && lobbyInput.value !== safeValue) {
                lobbyInput.value = safeValue;
            }

            if (typeof renderLobbyStatus === 'function') {
                renderLobbyStatus();
            }

            if (!skipSave && typeof saveSetupPreferences === 'function') {
                saveSetupPreferences();
            }
        }

        function getPlayerColor(inputId, fallbackColor = '#328DCB') {
            const input = document.getElementById(inputId);
            const color = input ? String(input.value || '').trim() : '';
            return color || fallbackColor;
        }

        function ensureHiddenPlayerConfigInputs() {
            const container = document.getElementById('playerConfigsHidden');
            if (!container) return;

            const defaultColors = ['#328DCB', '#FF4081', '#10B981', '#F59E0B'];
            for (let i = 1; i <= 4; i += 1) {
                const nameId = `player${i}Name`;
                const colorId = `player${i}Color`;

                if (!document.getElementById(nameId)) {
                    const nameInput = document.createElement('input');
                    nameInput.type = 'hidden';
                    nameInput.id = nameId;
                    nameInput.value = `Joueur ${i}`;
                    container.appendChild(nameInput);
                }

                if (!document.getElementById(colorId)) {
                    const colorInput = document.createElement('input');
                    colorInput.type = 'hidden';
                    colorInput.id = colorId;
                    colorInput.value = defaultColors[i - 1] || '#328DCB';
                    container.appendChild(colorInput);
                }
            }
        }

        function normalizePlayerName(rawName, fallbackName = 'Joueur') {
            const cleaned = String(rawName || '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 20);
            return cleaned || fallbackName;
        }

        function applyNetworkPlayerNames({ hostName = null, guestName = null } = {}) {
            if (!window.game || !Array.isArray(window.game.players)) return;

            let changed = false;
            if (hostName && window.game.players[0]) {
                const normalizedHostName = normalizePlayerName(hostName, 'Hote');
                if (window.game.players[0].name !== normalizedHostName) {
                    window.game.players[0].name = normalizedHostName;
                    changed = true;
                }
            }
            if (guestName && window.game.players[1]) {
                const normalizedGuestName = normalizePlayerName(guestName, 'Adversaire');
                if (window.game.players[1].name !== normalizedGuestName) {
                    window.game.players[1].name = normalizedGuestName;
                    changed = true;
                }
            }

            if (!changed) {
                renderLobbyStatus();
                return;
            }
            if (typeof window.game.initScoreBoard === 'function') {
                window.game.initScoreBoard();
            }
            if (typeof window.game.updateUI === 'function') {
                window.game.updateUI();
            }
            renderLobbyStatus();
        }

        function setLobbyChipState({ chip, nameEl, stateEl, playerName, isReady, isConnected, offlineLabel }) {
            if (!chip || !nameEl || !stateEl) return;

            nameEl.textContent = normalizePlayerName(playerName, 'Joueur');
            chip.classList.remove('ready', 'pending');
            chip.classList.add(isConnected && isReady ? 'ready' : 'pending');

            if (!isConnected) {
                stateEl.textContent = offlineLabel;
                return;
            }

            stateEl.textContent = isReady ? 'Pret' : 'Attente';
        }

        function renderLobbyStatus() {
            const panel = document.getElementById('lobbyStatusPanel');
            if (!panel) return;

            if (!bluetoothConnection) {
                panel.style.display = 'none';
                return;
            }

            panel.style.display = 'block';

            const sessionLabel = document.getElementById('lobbySessionLabel');
            const roundState = document.getElementById('lobbyRoundState');
            const hostChip = document.getElementById('hostReadyChip');
            const hostName = document.getElementById('hostReadyName');
            const hostState = document.getElementById('hostReadyState');
            const guestChip = document.getElementById('guestReadyChip');
            const guestName = document.getElementById('guestReadyName');
            const guestState = document.getElementById('guestReadyState');

            const sessionCode = sanitizeSessionCode(
                connectionStatus.sessionCode ||
                bluetoothConnection.sessionCode ||
                bluetoothSession.code ||
                bluetoothSession.expectedCode ||
                ''
            );
            if (sessionLabel) {
                sessionLabel.textContent = `Session ${sessionCode || '--'}`;
            }

            const isConnected = Boolean(connectionStatus.connected);
            const isConnecting = Boolean(connectionStatus.connecting || connectionStatus.reconnecting);
            const offlineLabel = isConnecting ? 'Connexion' : 'Hors ligne';

            let roundLabel = 'En attente';
            if (connectionStatus.reconnecting) {
                roundLabel = 'Reconnexion en cours';
            } else if (connectionStatus.connecting) {
                roundLabel = 'Connexion en cours';
            } else if (!isConnected) {
                roundLabel = 'Hors ligne';
            } else if (isMatchCountdownRunning()) {
                roundLabel = `Demarrage ${getMatchCountdownRemainingSeconds()}s`;
            } else if (networkMatchState.started) {
                roundLabel = 'Manche en cours';
            } else if (isHost) {
                roundLabel = networkMatchState.guestReady ? 'Demarrage imminent' : 'En attente adversaire';
            } else {
                roundLabel = networkMatchState.hostReady ? 'En attente demarrage auto' : 'Sync hote';
            }

            if (roundState) {
                roundState.textContent = roundLabel;
            }

            const hostDisplayName = normalizePlayerName(
                window.game?.players?.[0]?.name || (isHost ? getPlayerName('player1Name', 'Hote') : 'Hote'),
                'Hote'
            );
            const guestDisplayName = normalizePlayerName(
                window.game?.players?.[1]?.name || (!isHost ? getPlayerName('player1Name', 'Joueur') : 'Adversaire'),
                'Adversaire'
            );

            const hostReady = Boolean(networkMatchState.hostReady || isHost);
            const guestReady = Boolean(networkMatchState.guestReady);

            setLobbyChipState({
                chip: hostChip,
                nameEl: hostName,
                stateEl: hostState,
                playerName: hostDisplayName,
                isReady: hostReady,
                isConnected,
                offlineLabel
            });

            setLobbyChipState({
                chip: guestChip,
                nameEl: guestName,
                stateEl: guestState,
                playerName: guestDisplayName,
                isReady: guestReady,
                isConnected,
                offlineLabel
            });
        }

        function clearMatchCountdownTimers() {
            if (matchStartCountdown.intervalId) {
                clearInterval(matchStartCountdown.intervalId);
                matchStartCountdown.intervalId = null;
            }
            if (matchStartCountdown.hideTimeoutId) {
                clearTimeout(matchStartCountdown.hideTimeoutId);
                matchStartCountdown.hideTimeoutId = null;
            }
        }

        function showMatchCountdownOverlay(value, label, goState = false) {
            const overlay = document.getElementById('matchCountdownOverlay');
            if (!overlay) return;

            const valueEl = document.getElementById('matchCountdownValue');
            const labelEl = document.getElementById('matchCountdownLabel');
            if (valueEl) {
                valueEl.textContent = String(value);
                valueEl.style.animation = 'none';
                // Restart pulse animation on each step.
                void valueEl.offsetWidth;
                valueEl.style.animation = 'countdownPulse 0.62s cubic-bezier(0.34, 1.56, 0.64, 1)';
            }
            if (labelEl) {
                labelEl.textContent = String(label);
            }

            overlay.classList.toggle('go', Boolean(goState));
            overlay.classList.add('active');
        }

        function hideMatchCountdownOverlay() {
            const overlay = document.getElementById('matchCountdownOverlay');
            if (!overlay) return;
            overlay.classList.remove('active', 'go');
        }

        function isMatchCountdownRunning() {
            return Boolean(matchStartCountdown.active);
        }

        function getMatchCountdownRemainingSeconds() {
            if (!matchStartCountdown.active || !Number.isFinite(matchStartCountdown.endAtTs)) {
                return 0;
            }
            return Math.max(1, Math.ceil((matchStartCountdown.endAtTs - Date.now()) / 1000));
        }

        function abortMatchStartCountdown() {
            clearMatchCountdownTimers();
            matchStartCountdown.active = false;
            matchStartCountdown.starting = false;
            matchStartCountdown.endAtTs = 0;
            matchStartCountdown.lastStep = null;
            hideMatchCountdownOverlay();
        }

        async function finalizeNetworkMatchStart(isHostFinalization) {
            if (networkMatchState.started) return;

            networkMatchState.started = true;
            networkMatchState.hostReady = true;
            networkMatchState.guestReady = true;
            updateWebRTCActionButtons();
            updateLobbyHint();

            if (window.game && !window.game.gameOver) {
                window.game.startTurnTimer(true);
                window.game.updateUI();
            }

            if (!isHostFinalization || !connectionStatus.connected) {
                return;
            }

            await sendLobbyStateToPeer();
            await sendBluetoothData({
                type: 'sync',
                gameState: getGameState()
            });
        }

        function startLocalMatchCountdown(durationMs, isHostFinalization) {
            abortMatchStartCountdown();
            if (networkMatchState.started) return;

            matchStartCountdown.active = true;
            matchStartCountdown.endAtTs = Date.now() + durationMs;
            matchStartCountdown.lastStep = null;

            const tick = () => {
                if (!matchStartCountdown.active) return;

                const remainingMs = matchStartCountdown.endAtTs - Date.now();
                if (remainingMs <= 0) {
                    clearMatchCountdownTimers();
                    matchStartCountdown.active = false;
                    matchStartCountdown.endAtTs = 0;
                    matchStartCountdown.lastStep = null;
                    showMatchCountdownOverlay('GO', 'Manche lancee', true);
                    matchStartCountdown.hideTimeoutId = setTimeout(() => {
                        hideMatchCountdownOverlay();
                    }, MATCH_START_GO_MS);
                    void finalizeNetworkMatchStart(isHostFinalization);
                    return;
                }

                const step = Math.max(1, Math.ceil(remainingMs / 1000));
                if (step !== matchStartCountdown.lastStep) {
                    matchStartCountdown.lastStep = step;
                    showMatchCountdownOverlay(step, 'La manche commence');
                    updateLobbyHint();
                }
            };

            tick();
            matchStartCountdown.intervalId = setInterval(tick, 80);
            if (window.game && !window.game.gameOver) {
                window.game.updateUI();
            }
        }

        async function startNetworkMatchCountdown({ durationMs = MATCH_START_COUNTDOWN_MS, broadcast = false } = {}) {
            if (!bluetoothConnection || !connectionStatus.connected) return false;
            if (networkMatchState.started || matchStartCountdown.active || matchStartCountdown.starting) return false;
            if (isHost && !networkMatchState.guestReady) return false;

            const safeDuration = Math.max(1000, Number.parseInt(durationMs, 10) || MATCH_START_COUNTDOWN_MS);
            matchStartCountdown.starting = true;

            if (broadcast && isHost) {
                const sent = await sendBluetoothData({
                    type: 'startCountdown',
                    durationMs: safeDuration
                });
                if (!sent) {
                    matchStartCountdown.starting = false;
                    showToast('Impossible de lancer le decompte.', 'error');
                    return false;
                }
            }

            startLocalMatchCountdown(safeDuration, Boolean(broadcast && isHost));
            matchStartCountdown.starting = false;
            return true;
        }

        async function maybeAutoStartMatchCountdown() {
            if (!isHost || !bluetoothConnection || !connectionStatus.connected) return false;
            if (!networkMatchState.guestReady || networkMatchState.started) return false;
            if (matchStartCountdown.active || matchStartCountdown.starting) return false;
            return startNetworkMatchCountdown({ broadcast: true });
        }

        function loadBluetoothStatusCollapsedPreference() {
            if (!window.localStorage) return;
            try {
                bluetoothStatusCollapsed = localStorage.getItem(BLUETOOTH_STATUS_COLLAPSED_KEY) === '1';
            } catch (_error) {
                bluetoothStatusCollapsed = false;
            }
        }

        function syncBluetoothStatusCollapseUI() {
            const statusDiv = document.getElementById('bluetoothStatus');
            if (!statusDiv) return;

            statusDiv.classList.toggle('collapsed', bluetoothStatusCollapsed);
            const toggleButton = document.getElementById('bluetoothStatusToggle');
            if (!toggleButton) return;

            const isExpanded = !bluetoothStatusCollapsed;
            const label = isExpanded
                ? 'Reduire le statut reseau'
                : 'Afficher le statut reseau';
            toggleButton.textContent = bluetoothStatusCollapsed ? '▸' : '▾';
            toggleButton.setAttribute('aria-expanded', String(isExpanded));
            toggleButton.setAttribute('aria-label', label);
            toggleButton.setAttribute('title', label);
            statusDiv.setAttribute('aria-expanded', String(isExpanded));
            statusDiv.setAttribute('aria-label', label);
            statusDiv.setAttribute('title', label);
        }

        function setBluetoothStatusCollapsed(collapsed, persist = true) {
            bluetoothStatusCollapsed = Boolean(collapsed);
            if (persist && window.localStorage) {
                try {
                    localStorage.setItem(BLUETOOTH_STATUS_COLLAPSED_KEY, bluetoothStatusCollapsed ? '1' : '0');
                } catch (_error) {
                    // Ignore storage errors.
                }
            }
            syncBluetoothStatusCollapseUI();
        }

        function toggleBluetoothStatusCollapsed() {
            setBluetoothStatusCollapsed(!bluetoothStatusCollapsed, true);
        }

        function handleBluetoothStatusContainerClick(event) {
            if (event?.target?.closest('#bluetoothStatusToggle')) return;
            if (bluetoothStatusCollapsed) {
                toggleBluetoothStatusCollapsed();
            }
        }

        function handleBluetoothStatusContainerKeydown(event) {
            if (!bluetoothStatusCollapsed) return;
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleBluetoothStatusCollapsed();
            }
        }

        function sanitizeSessionCode(rawCode) {
            return String(rawCode || '')
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .slice(0, 6);
        }

        function generateSessionCode() {
            const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let code = '';
            for (let i = 0; i < 6; i++) {
                const randomIndex = Math.floor(Math.random() * alphabet.length);
                code += alphabet[randomIndex];
            }
            return code;
        }

        function normalizeSessionCodeInput() {
            const input = document.getElementById('sessionCodeInput');
            if (!input) return;
            input.value = sanitizeSessionCode(input.value);
        }

        function setSessionCodePreview(message) {
            const preview = document.getElementById('sessionCodePreview');
            if (!preview) return;
            preview.textContent = message;
        }

        function setHostSessionCodeDisplay(code) {
            const codeDisplay = document.getElementById('hostSessionCodeDisplay');
            if (!codeDisplay) return;
            codeDisplay.textContent = sanitizeSessionCode(code) || '......';
        }

        function persistSignalingUrl(value) {
            if (!window.localStorage) return;
            try {
                const normalized = String(value || '').trim();
                if (!normalized) {
                    localStorage.removeItem(SIGNALING_URL_STORAGE_KEY);
                    return;
                }
                localStorage.setItem(SIGNALING_URL_STORAGE_KEY, normalized);
            } catch (_error) {
                // Ignore storage errors.
            }
        }

        function persistSignalingUrlFromInput() {
            const input = document.getElementById('signalingUrlInput');
            if (!input) return;
            persistSignalingUrl(input.value);
        }

        function readStoredSignalingUrl() {
            if (!window.localStorage) return '';
            try {
                return String(localStorage.getItem(SIGNALING_URL_STORAGE_KEY) || '').trim();
            } catch (_error) {
                return '';
            }
        }

        function updateWebRTCActionButtons() {
            const hostButton = document.getElementById('btnStartHosting');
            const joinButton = document.getElementById('btnStartJoining');
            const resyncButton = document.getElementById('resyncButton');
            const reconnectButton = document.getElementById('reconnectButton');
            const isBusy = connectionStatus.connecting || connectionStatus.reconnecting;

            if (hostButton) {
                hostButton.dataset.defaultLabel = hostButton.dataset.defaultLabel || hostButton.textContent;
                hostButton.disabled = isBusy;
                hostButton.textContent = isBusy
                    ? (connectionStatus.reconnecting ? 'Reconnexion...' : 'Connexion...')
                    : hostButton.dataset.defaultLabel;
            }

            if (joinButton) {
                joinButton.dataset.defaultLabel = joinButton.dataset.defaultLabel || joinButton.textContent;
                joinButton.disabled = isBusy;
                joinButton.textContent = isBusy
                    ? (connectionStatus.reconnecting ? 'Reconnexion...' : 'Connexion...')
                    : joinButton.dataset.defaultLabel;
            }

            if (resyncButton) {
                resyncButton.disabled = !bluetoothConnection || !connectionStatus.connected || isBusy;
            }

            if (reconnectButton) {
                reconnectButton.disabled = !bluetoothConnection || connectionStatus.connected || isBusy;
            }

            renderLobbyStatus();
        }

        function resetNetworkMatchState() {
            abortMatchStartCountdown();
            networkMatchState.started = false;
            networkMatchState.hostReady = false;
            networkMatchState.guestReady = false;
            renderLobbyStatus();
        }

        function updateLobbyHint() {
            if (!bluetoothConnection || !window.game || window.game.gameOver) return;
            if (networkMatchState.started) return;

            const gameHint = document.getElementById('gameHint');
            const countdownSeconds = getMatchCountdownRemainingSeconds();

            if (isMatchCountdownRunning()) {
                setTurnHintMessage(`Demarrage automatique dans ${countdownSeconds}s...`, { persistent: true });
            } else {
                setTurnHintMessage(
                    isHost
                        ? (networkMatchState.guestReady
                            ? 'Adversaire pret. Demarrage automatique...'
                            : 'En attente que l adversaire soit pret.')
                        : 'En attente du demarrage automatique par l hote.',
                    { persistent: true }
                );
            }
            if (gameHint) {
                if (isMatchCountdownRunning()) {
                    gameHint.textContent = `Lobby pret. Demarrage automatique dans ${countdownSeconds}s.`;
                } else {
                    gameHint.textContent = isHost
                        ? (networkMatchState.guestReady
                            ? 'Lobby pret. Demarrage automatique en cours.'
                            : 'Lobby en attente du joueur adverse.')
                        : 'Lobby connecte. En attente du demarrage automatique.';
                }
            }
        }

        function applyLobbyStateFromPayload(payload) {
            if (!payload || typeof payload !== 'object') return;
            let startedUpdated = false;
            let startedValue = networkMatchState.started;

            if (payload.hostReady !== undefined) {
                networkMatchState.hostReady = Boolean(payload.hostReady);
            }
            if (payload.guestReady !== undefined) {
                networkMatchState.guestReady = Boolean(payload.guestReady);
            }
            if (payload.started !== undefined) {
                startedUpdated = true;
                startedValue = Boolean(payload.started);
                networkMatchState.started = startedValue;
            }

            if (startedUpdated && startedValue) {
                abortMatchStartCountdown();
                if (window.game && !window.game.gameOver) {
                    window.game.startTurnTimer(true);
                }
            }

            updateWebRTCActionButtons();
            if (window.game && typeof window.game.updateUI === 'function') {
                window.game.updateUI();
            }
            updateLobbyHint();
        }

        async function sendLobbyStateToPeer() {
            if (!isHost || !connectionStatus.connected) return;
            await sendBluetoothData({
                type: 'lobbyState',
                hostReady: networkMatchState.hostReady,
                guestReady: networkMatchState.guestReady,
                started: networkMatchState.started
            });
        }

        async function hostStartMatch() {
            if (!bluetoothConnection || !isHost) {
                showToast('Action reservee a l hote.', 'info');
                return;
            }
            if (!connectionStatus.connected) {
                showToast('Connexion WebRTC indisponible.', 'error');
                return;
            }
            if (networkMatchState.started) {
                showToast('La manche est deja en cours.', 'info');
                return;
            }
            if (!networkMatchState.guestReady) {
                showToast('Adversaire pas encore pret.', 'info');
                return;
            }
            await startNetworkMatchCountdown({ broadcast: true });
        }

        async function copyTextToClipboard(value, successMessage) {
            const text = String(value || '').trim();
            if (!text) {
                showToast('Aucune valeur a copier.', 'info');
                return false;
            }

            try {
                if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                    await navigator.clipboard.writeText(text);
                } else {
                    const fallbackInput = document.createElement('textarea');
                    fallbackInput.value = text;
                    fallbackInput.style.position = 'fixed';
                    fallbackInput.style.opacity = '0';
                    document.body.appendChild(fallbackInput);
                    fallbackInput.focus();
                    fallbackInput.select();
                    document.execCommand('copy');
                    fallbackInput.remove();
                }
                showToast(successMessage, 'success');
                return true;
            } catch (_error) {
                showToast('Impossible de copier automatiquement.', 'error');
                return false;
            }
        }

        async function copyHostSessionCode() {
            const code = sanitizeSessionCode(bluetoothSession.code || document.getElementById('hostSessionCodeDisplay')?.textContent);
            if (!code) {
                showToast('Code de session indisponible.', 'info');
                return;
            }
            await copyTextToClipboard(code, `Code ${code} copie.`);
        }

        function buildSessionInviteLink() {
            const code = sanitizeSessionCode(bluetoothSession.code);
            if (!code) return '';

            const base = new URL(window.location.href);
            base.searchParams.set('mode', 'bluetooth');
            base.searchParams.set('role', 'join');
            base.searchParams.set('session', code);

            const signalingUrl = getSelectedSignalingUrl();
            if (signalingUrl) {
                base.searchParams.set('signal', signalingUrl);
            }
            return base.toString();
        }

        async function copySessionInviteLink() {
            const inviteLink = buildSessionInviteLink();
            if (!inviteLink) {
                showToast('Lien indisponible: code de session manquant.', 'info');
                return;
            }
            await copyTextToClipboard(inviteLink, 'Lien d invitation copie.');
        }

        function applyWebRTCParamsFromUrl() {
            let params;
            try {
                params = new URLSearchParams(window.location.search || '');
            } catch (_error) {
                return;
            }

            const signalParam = params.get('signal');
            const sessionParam = sanitizeSessionCode(params.get('session'));
            const modeParam = params.get('mode');
            const roleParam = params.get('role');

            if (signalParam) {
                const signalingInput = document.getElementById('signalingUrlInput');
                if (signalingInput) {
                    signalingInput.value = signalParam;
                    persistSignalingUrl(signalParam);
                }
            }

            if (sessionParam) {
                const sessionInput = document.getElementById('sessionCodeInput');
                if (sessionInput) {
                    sessionInput.value = sessionParam;
                }
                bluetoothSession.expectedCode = sessionParam;
                bluetoothSession.code = modeParam === 'bluetooth' && roleParam === 'host'
                    ? sessionParam
                    : bluetoothSession.code;
            }

            if (modeParam === 'bluetooth') {
                const gameModeInput = document.getElementById('gameMode');
                if (gameModeInput) {
                    gameModeInput.value = 'bluetooth';
                }
                updatePlayerCards();

                if (roleParam === 'join' || (sessionParam && roleParam !== 'host')) {
                    selectWebRTCRole('join');
                    if (sessionParam) {
                        setSessionCodePreview(`Code pre-rempli: ${sessionParam}`);
                    }
                    return;
                }

                if (roleParam === 'host') {
                    selectWebRTCRole('host');
                    return;
                }
            }
        }

        function restoreSetupAfterWebRTCFailure() {
            if (window.game && typeof window.game.stopTurnTimer === 'function') {
                window.game.stopTurnTimer();
            }
            window.game = null;
            moveHistory = [];

            showSetupView();
            resetNetworkMatchState();
            updatePlayerCards();
            updateWebRTCActionButtons();
        }

        function prepareHostSession() {
            const input = document.getElementById('sessionCodeInput');
            const existingHostCode = sanitizeSessionCode(bluetoothSession.code);
            const manualCodeCandidate = sanitizeSessionCode(input?.value);
            const manualCode = manualCodeCandidate.length >= 4 ? manualCodeCandidate : '';
            const code = existingHostCode || manualCode || generateSessionCode();
            if (input) {
                input.value = code;
            }

            bluetoothSession.code = code;
            bluetoothSession.expectedCode = code;
            bluetoothSession.verified = true;
            reconnectionBlockedReason = null;
            setHostSessionCodeDisplay(code);
            setSessionCodePreview(`Code de session hote: ${code}`);
            updateConnectionStatus({
                sessionCode: code,
                sessionVerified: true,
                latencyMs: null,
                latencyQuality: 'unknown'
            });
        }

        function prepareJoinSession() {
            const input = document.getElementById('sessionCodeInput');
            const expectedCandidate = sanitizeSessionCode(input?.value);
            const expectedCode = expectedCandidate.length >= 4 ? expectedCandidate : '';
            if (input) {
                input.value = expectedCode;
                input.focus();
            }

            bluetoothSession.code = null;
            bluetoothSession.expectedCode = expectedCode || null;
            bluetoothSession.verified = false;
            reconnectionBlockedReason = null;

            if (expectedCode) {
                setSessionCodePreview(`Verification attendue: ${expectedCode}`);
            } else {
                setSessionCodePreview('Entrez le code de session fourni par l hote.');
            }

            updateConnectionStatus({
                sessionCode: expectedCode || null,
                sessionVerified: false,
                latencyMs: null,
                latencyQuality: 'unknown'
            });
        }

        function evaluateLatencyQuality(latencyMs) {
            if (!Number.isFinite(latencyMs) || latencyMs < 0) return 'unknown';
            if (latencyMs <= 120) return 'good';
            if (latencyMs <= 280) return 'fair';
            return 'poor';
        }

        function formatLatencyForDisplay(latencyMs) {
            if (!Number.isFinite(latencyMs)) {
                return 'Latence --';
            }
            return `Latence ${Math.max(0, Math.round(latencyMs))} ms`;
        }

        function formatRetryCountdown(nextRetryInMs) {
            if (!Number.isFinite(nextRetryInMs)) return '--';
            return (Math.max(0, nextRetryInMs) / 1000).toFixed(1);
        }

        function getNextPingId() {
            pingSequence = (pingSequence + 1) & 0xffff;
            if (pingSequence === 0) {
                pingSequence = 1;
            }
            return pingSequence;
        }

        function clearLatencyState() {
            pendingPings.clear();
            updateConnectionStatus({
                latencyMs: null,
                latencyQuality: 'unknown'
            });
        }

        async function sleepWithProgress(durationMs, onTick) {
            const startTs = Date.now();
            if (typeof onTick === 'function') {
                onTick(durationMs);
            }

            while (true) {
                const elapsed = Date.now() - startTs;
                const remaining = Math.max(0, durationMs - elapsed);
                if (remaining <= 0) {
                    if (typeof onTick === 'function') {
                        onTick(0);
                    }
                    return;
                }
                await sleep(Math.min(RECONNECTION_PROGRESS_TICK, remaining));
                if (typeof onTick === 'function') {
                    onTick(Math.max(0, durationMs - (Date.now() - startTs)));
                }
            }
        }

        function closeSignalingSocket() {
            if (!bluetoothConnection?.signalingSocket) return;
            try {
                bluetoothConnection.signalingSocket.onopen = null;
                bluetoothConnection.signalingSocket.onmessage = null;
                bluetoothConnection.signalingSocket.onerror = null;
                bluetoothConnection.signalingSocket.onclose = null;
                bluetoothConnection.signalingSocket.close();
            } catch (_error) {
                // Ignore close errors.
            }
            bluetoothConnection.signalingSocket = null;
        }

        function resetPeerConnection(keepSignaling = true) {
            if (!bluetoothConnection) return;

            if (bluetoothConnection.dataChannel) {
                try {
                    bluetoothConnection.dataChannel.onopen = null;
                    bluetoothConnection.dataChannel.onmessage = null;
                    bluetoothConnection.dataChannel.onerror = null;
                    bluetoothConnection.dataChannel.onclose = null;
                    bluetoothConnection.dataChannel.close();
                } catch (_error) {
                    // Ignore close errors.
                }
                bluetoothConnection.dataChannel = null;
            }

            if (bluetoothConnection.peerConnection) {
                try {
                    bluetoothConnection.peerConnection.onicecandidate = null;
                    bluetoothConnection.peerConnection.onconnectionstatechange = null;
                    bluetoothConnection.peerConnection.oniceconnectionstatechange = null;
                    bluetoothConnection.peerConnection.ondatachannel = null;
                    bluetoothConnection.peerConnection.close();
                } catch (_error) {
                    // Ignore close errors.
                }
                bluetoothConnection.peerConnection = null;
            }

            if (!keepSignaling) {
                closeSignalingSocket();
            }
        }

        function disconnectBluetoothDevice() {
            resetPeerConnection(false);
            bluetoothConnection = null;
        }

        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        function createBluetoothError(message, name = 'Error') {
            const error = new Error(message);
            error.name = name;
            return error;
        }

        function ensureBluetoothSupported() {
            if (window.RTCPeerConnection && window.WebSocket) {
                return true;
            }
            handleConnectionError(
                createBluetoothError('WebRTC non supporte sur ce navigateur.', 'NotSupportedError')
            );
            return false;
        }

        function getDefaultSignalingUrl() {
            const publicFallback = 'wss://jeu-points.onrender.com/ws';
            const hostname = window.location?.hostname || '';
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                return publicFallback;
            }
            if (hostname.endsWith('.netlify.app') || hostname.endsWith('.vercel.app')) {
                return publicFallback;
            }
            if (window.location?.host) {
                const isSecure = window.location.protocol === 'https:';
                const wsProto = isSecure ? 'wss:' : 'ws:';
                return `${wsProto}//${window.location.host}/ws`;
            }
            return publicFallback;
        }

        function getSelectedSignalingUrl() {
            const input = document.getElementById('signalingUrlInput');
            const rawUrl = input?.value?.trim();
            if (rawUrl) {
                persistSignalingUrl(rawUrl);
                return rawUrl;
            }
            const fallback = getDefaultSignalingUrl();
            if (input) {
                input.value = fallback;
            }
            persistSignalingUrl(fallback);
            return fallback;
        }

        function ensureSignalingUrlInputDefault() {
            const input = document.getElementById('signalingUrlInput');
            if (!input) return;
            const current = input.value.trim();
            if (current) {
                persistSignalingUrl(current);
                return;
            }
            const stored = readStoredSignalingUrl();
            input.value = stored || getDefaultSignalingUrl();
        }

        function parseWebSocketUrl(urlCandidate) {
            let raw = String(urlCandidate || '').trim();
            if (!raw) {
                throw createBluetoothError('URL de signalisation invalide.');
            }
            if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) {
                raw = `ws://${raw}`;
            }

            try {
                const parsed = new URL(raw);
                if (parsed.protocol === 'http:') {
                    parsed.protocol = 'ws:';
                } else if (parsed.protocol === 'https:') {
                    parsed.protocol = 'wss:';
                }
                return parsed;
            } catch (_error) {
                throw createBluetoothError('URL de signalisation invalide.');
            }
        }

        async function connectSignalingSocket(sessionCode) {
            const normalizedCode = sanitizeSessionCode(sessionCode);
            if (!normalizedCode) {
                throw createBluetoothError('Code de session invalide.');
            }

            closeSignalingSocket();

            if (!bluetoothConnection) {
                bluetoothConnection = {
                    signalingSocket: null,
                    peerConnection: null,
                    dataChannel: null,
                    listenersAttached: false,
                    onDisconnected: null,
                    onValueChanged: null,
                    sessionCode: normalizedCode,
                    role: isHost ? 'host' : 'guest',
                    peerReady: false,
                    pendingIceCandidates: []
                };
            }

            const selectedUrl = getSelectedSignalingUrl();
            const candidateUrls = [];
            const addCandidateUrl = (candidate) => {
                try {
                    const parsed = parseWebSocketUrl(candidate);
                    if (!/^wss?:$/.test(parsed.protocol)) {
                        return;
                    }
                    const normalized = parsed.toString();
                    if (!candidateUrls.includes(normalized)) {
                        candidateUrls.push(normalized);
                    }
                } catch (_error) {
                    // Ignore malformed candidate.
                }
            };

            addCandidateUrl(selectedUrl);
            addCandidateUrl(getDefaultSignalingUrl());
            addCandidateUrl('wss://jeu-points.onrender.com/ws');
            if ((window.location?.hostname || '') === 'localhost' || (window.location?.hostname || '') === '127.0.0.1') {
                addCandidateUrl('ws://localhost:8080/ws');
            }

            let connectedSocket = null;
            let connectedUrl = '';
            let lastConnectError = null;

            for (const candidateUrl of candidateUrls) {
                try {
                    connectedSocket = await new Promise((resolve, reject) => {
                        const socket = new WebSocket(candidateUrl);
                        let settled = false;
                        const timeoutId = setTimeout(() => {
                            if (settled) return;
                            settled = true;
                            try {
                                socket.close();
                            } catch (_error) {
                                // Ignore.
                            }
                            reject(createBluetoothError(`Delai de connexion depasse (${candidateUrl})`));
                        }, SIGNALING_CONNECT_TIMEOUT);

                        socket.onopen = () => {
                            if (settled) return;
                            settled = true;
                            clearTimeout(timeoutId);
                            resolve(socket);
                        };

                        socket.onerror = () => {
                            if (settled) return;
                            settled = true;
                            clearTimeout(timeoutId);
                            reject(createBluetoothError(`Connexion impossible (${candidateUrl})`));
                        };
                    });
                    connectedUrl = candidateUrl;
                    break;
                } catch (error) {
                    lastConnectError = error;
                }
            }

            if (!connectedSocket) {
                throw lastConnectError || createBluetoothError('Connexion au serveur de signalisation impossible');
            }

            bluetoothConnection.signalingSocket = connectedSocket;
            persistSignalingUrl(connectedUrl);
            const signalingInput = document.getElementById('signalingUrlInput');
            if (signalingInput) {
                signalingInput.value = connectedUrl;
            }

            const socket = bluetoothConnection.signalingSocket;
            socket.onmessage = async (event) => {
                let message;
                try {
                    message = JSON.parse(event.data);
                } catch (error) {
                    // Ignore non-JSON pings from the server like "connected" or "reload"
                    return;
                }

                try {
                    await handleSignalingMessage(message);
                } catch (error) {
                    console.error('Erreur traitement signalisation:', error, message);
                    if (pendingDataChannelReady?.reject) {
                        pendingDataChannelReady.reject(error);
                        pendingDataChannelReady = null;
                    }
                    if (connectionStatus.connected && !reconnectInProgress) {
                        handleDisconnection();
                    }
                }
            };
            const onSocketInterrupted = () => {
                if (pendingDataChannelReady?.reject) {
                    pendingDataChannelReady.reject(createBluetoothError('Signalisation interrompue.'));
                    pendingDataChannelReady = null;
                }
                if (!connectionStatus.connected && !connectionStatus.connecting && !reconnectInProgress) return;
                handleDisconnection();
            };
            socket.onclose = onSocketInterrupted;
            socket.onerror = onSocketInterrupted;

            bluetoothConnection.sessionCode = normalizedCode;
            bluetoothConnection.role = isHost ? 'host' : 'guest';
            bluetoothConnection.peerReady = false;
            bluetoothConnection.pendingIceCandidates = [];

            sendSignalingMessage({
                type: 'join',
                room: normalizedCode,
                role: bluetoothConnection.role
            });
            updateConnectionStatus({
                sessionCode: normalizedCode,
                statusDetail: 'Signalisation connectee. En attente de l adversaire...'
            });
        }

        function sendSignalingMessage(payload) {
            const socket = bluetoothConnection?.signalingSocket;
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                throw createBluetoothError('Socket de signalisation indisponible.');
            }
            socket.send(JSON.stringify(payload));
        }

        function setupPeerConnectionIfNeeded() {
            if (!bluetoothConnection) {
                bluetoothConnection = {
                    signalingSocket: null,
                    peerConnection: null,
                    dataChannel: null,
                    listenersAttached: false,
                    onDisconnected: null,
                    onValueChanged: null,
                    sessionCode: bluetoothSession.code || bluetoothSession.expectedCode || null,
                    role: isHost ? 'host' : 'guest',
                    peerReady: false,
                    pendingIceCandidates: []
                };
            }

            if (bluetoothConnection.peerConnection) {
                return bluetoothConnection.peerConnection;
            }

            const peerConnection = new RTCPeerConnection({ iceServers: WEBRTC_ICE_SERVERS });
            peerConnection.onicecandidate = (event) => {
                if (!event.candidate) return;
                try {
                    sendSignalingMessage({
                        type: 'signal',
                        room: bluetoothConnection.sessionCode,
                        payload: {
                            type: 'ice',
                            candidate: event.candidate
                        }
                    });
                } catch (_error) {
                    // Ignore transient signaling errors.
                }
            };
            peerConnection.onconnectionstatechange = () => {
                const state = peerConnection.connectionState;
                if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                    handleDisconnection();
                }
            };
            peerConnection.oniceconnectionstatechange = () => {
                const state = peerConnection.iceConnectionState;
                if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                    handleDisconnection();
                }
            };
            peerConnection.ondatachannel = (event) => {
                attachDataChannel(event.channel);
            };

            bluetoothConnection.peerConnection = peerConnection;
            return peerConnection;
        }

        function attachDataChannel(channel) {
            if (!bluetoothConnection) return;

            if (bluetoothConnection.dataChannel && bluetoothConnection.dataChannel !== channel) {
                try {
                    bluetoothConnection.dataChannel.close();
                } catch (_error) {
                    // Ignore.
                }
            }

            bluetoothConnection.dataChannel = channel;
            channel.onopen = () => {
                if (pendingDataChannelReady?.resolve) {
                    pendingDataChannelReady.resolve(true);
                    pendingDataChannelReady = null;
                }
            };
            channel.onmessage = async (event) => {
                touchBluetoothActivity();
                if (typeof event.data === 'string') {
                    await processBluetoothMessage(event.data);
                    return;
                }
                try {
                    const raw = event.data instanceof ArrayBuffer
                        ? new Uint8Array(event.data)
                        : new Uint8Array(await event.data.arrayBuffer());
                    const text = new TextDecoder().decode(raw);
                    await processBluetoothMessage(text);
                } catch (error) {
                    console.error('Erreur message datachannel:', error);
                }
            };
            channel.onerror = () => {
                handleDisconnection();
            };
            channel.onclose = () => {
                handleDisconnection();
            };
        }

        async function createOfferAndSend() {
            const peerConnection = setupPeerConnectionIfNeeded();
            if (peerConnection.signalingState !== 'stable') {
                try {
                    await peerConnection.setLocalDescription({ type: 'rollback' });
                } catch (_error) {
                    // Ignore rollback errors.
                }
            }
            if (!bluetoothConnection.dataChannel) {
                const channel = peerConnection.createDataChannel('points-game', {
                    ordered: true
                });
                attachDataChannel(channel);
            }

            const offer = await peerConnection.createOffer({
                iceRestart: reconnectInProgress
            });
            await peerConnection.setLocalDescription(offer);
            sendSignalingMessage({
                type: 'signal',
                room: bluetoothConnection.sessionCode,
                payload: {
                    type: 'offer',
                    sdp: peerConnection.localDescription
                }
            });
        }

        async function flushPendingIceCandidates() {
            if (!bluetoothConnection?.peerConnection) return;
            if (!Array.isArray(bluetoothConnection.pendingIceCandidates)) return;
            if (!bluetoothConnection.pendingIceCandidates.length) return;

            const pending = [...bluetoothConnection.pendingIceCandidates];
            bluetoothConnection.pendingIceCandidates.length = 0;
            for (const candidate of pending) {
                try {
                    await bluetoothConnection.peerConnection.addIceCandidate(candidate);
                } catch (_error) {
                    // Ignore stale candidate errors.
                }
            }
        }

        async function initializeNetworkLobbyAfterConnect() {
            if (!bluetoothConnection || !connectionStatus.connected) return;

            abortMatchStartCountdown();
            networkMatchState.started = false;
            networkMatchState.hostReady = true;
            networkMatchState.guestReady = isHost ? false : true;
            updateWebRTCActionButtons();
            updateLobbyHint();

            if (isHost) {
                await sendLobbyStateToPeer();
                return;
            }

            await sendBluetoothData({
                type: 'guestReady',
                guestName: normalizePlayerName(getPlayerName('player1Name', 'Joueur'), 'Joueur')
            });
            await sendBluetoothData({ type: 'requestLobbyState' });
        }

        async function markConnectionReady() {
            reconnectionBlockedReason = null;
            updateConnectionStatus({
                connected: true,
                connecting: false,
                reconnecting: false,
                error: null,
                reconnectAttempt: 0,
                reconnectTotal: 0,
                nextRetryInMs: 0,
                statusDetail: ''
            });
            if (window.game && typeof window.game.updateUI === 'function') {
                window.game.updateUI();
            }
            clearLatencyState();
            startBluetoothHeartbeat();
            await announceBluetoothSession();
            await initializeNetworkLobbyAfterConnect();

            if (!isHost && window.game) {
                await sendBluetoothData({ type: 'requestSync' });
            }
        }

        async function handleSignalingMessage(message) {
            if (!bluetoothConnection || !message || typeof message !== 'object') {
                return;
            }

            const type = String(message.type || '');
            switch (type) {
                case 'joined':
                    if (message.room) {
                        const roomCode = sanitizeSessionCode(message.room);
                        if (roomCode) {
                            bluetoothConnection.sessionCode = roomCode;
                            updateConnectionStatus({
                                sessionCode: roomCode
                            });
                        }
                    }
                    if (message.role === 'host' || message.role === 'guest') {
                        bluetoothConnection.role = message.role;
                    }
                    if (Number.isFinite(message.peerCount) && message.peerCount >= 2) {
                        bluetoothConnection.peerReady = true;
                        updateConnectionStatus({
                            statusDetail: 'Adversaire detecte. Negotiation WebRTC...'
                        });
                    } else {
                        updateConnectionStatus({
                            statusDetail: 'Salon cree. En attente de l adversaire...'
                        });
                    }
                    break;
                case 'peer-ready':
                    bluetoothConnection.peerReady = true;
                    updateConnectionStatus({
                        statusDetail: 'Adversaire connecte. Negotiation WebRTC...'
                    });
                    if (isHost) {
                        await createOfferAndSend();
                    }
                    break;
                case 'peer-left':
                    bluetoothConnection.peerReady = false;
                    showToast('Adversaire deconnecte, reprise automatique...', 'info');
                    if (connectionStatus.connected && !reconnectInProgress) {
                        handleDisconnection();
                    }
                    break;
                case 'signal':
                    {
                        const payload = message.payload || {};
                        const signalType = String(payload.type || '');
                        const peerConnection = setupPeerConnectionIfNeeded();

                        if (signalType === 'offer' && payload.sdp) {
                            await peerConnection.setRemoteDescription(payload.sdp);
                            await flushPendingIceCandidates();
                            const answer = await peerConnection.createAnswer();
                            await peerConnection.setLocalDescription(answer);
                            sendSignalingMessage({
                                type: 'signal',
                                room: bluetoothConnection.sessionCode,
                                payload: {
                                    type: 'answer',
                                    sdp: peerConnection.localDescription
                                }
                            });
                            updateConnectionStatus({
                                statusDetail: 'Offre recue. Creation de la reponse...'
                            });
                            return;
                        }

                        if (signalType === 'answer' && payload.sdp) {
                            await peerConnection.setRemoteDescription(payload.sdp);
                            await flushPendingIceCandidates();
                            updateConnectionStatus({
                                statusDetail: 'Reponse recue. Finalisation du canal...'
                            });
                            return;
                        }

                        if (signalType === 'ice' && payload.candidate) {
                            if (peerConnection.remoteDescription) {
                                await peerConnection.addIceCandidate(payload.candidate);
                            } else {
                                bluetoothConnection.pendingIceCandidates.push(payload.candidate);
                            }
                        }
                    }
                    break;
                case 'error':
                    throw createBluetoothError(message.message || 'Erreur de signalisation.');
                default:
                    // Ignore unsupported signaling message.
                    break;
            }
        }

        function waitForDataChannelOpen(timeoutMs = WEBRTC_CONNECT_TIMEOUT) {
            if (bluetoothConnection?.dataChannel?.readyState === 'open') {
                return Promise.resolve(true);
            }

            return new Promise((resolve, reject) => {
                if (pendingDataChannelReady?.reject) {
                    pendingDataChannelReady.reject(createBluetoothError('Connexion remplacee.'));
                }
                const timeoutId = setTimeout(() => {
                    if (pendingDataChannelReady?.resolve === resolve) {
                        pendingDataChannelReady = null;
                    }
                    const roleMessage = isHost
                        ? 'Aucun adversaire detecte. Verifiez le code et reessayez.'
                        : 'Connexion WebRTC non etablie. Verifiez le code et le serveur.';
                    reject(createBluetoothError(roleMessage));
                }, timeoutMs);

                pendingDataChannelReady = {
                    resolve: () => {
                        clearTimeout(timeoutId);
                        resolve(true);
                    },
                    reject: (error) => {
                        clearTimeout(timeoutId);
                        reject(error);
                    }
                };
            });
        }

        function touchBluetoothActivity() {
            lastBluetoothActivityAt = Date.now();
        }

        function resetBluetoothTransportState() {
            pendingPings.clear();
            if (pendingDataChannelReady?.reject) {
                pendingDataChannelReady.reject(createBluetoothError('Connexion interrompue.'));
            }
            pendingDataChannelReady = null;
            touchBluetoothActivity();
        }

        function cleanupStaleIncomingPackets() {
            // No-op in WebRTC mode.
        }

        function stopAutoResyncLoop() {
            if (autoResyncIntervalId) {
                clearInterval(autoResyncIntervalId);
                autoResyncIntervalId = null;
            }
            autoResyncTickInFlight = false;
            lastAutoResyncSentAt = 0;
            lastAutoResyncRequestAt = 0;
        }

        async function runAutoResyncTick() {
            if (autoResyncTickInFlight) return;
            autoResyncTickInFlight = true;

            try {
                if (!bluetoothConnection?.dataChannel || bluetoothConnection.dataChannel.readyState !== 'open') {
                    return;
                }
                if (!connectionStatus.connected || reconnectInProgress || connectionStatus.connecting || connectionStatus.reconnecting) {
                    return;
                }
                if (!window.game) return;

                const now = Date.now();
                if (isHost) {
                    if (now - lastAutoResyncSentAt < AUTO_RESYNC_PUSH_INTERVAL) return;
                    const gameState = getGameState();
                    if (!gameState) return;
                    const sent = await sendBluetoothData({
                        type: 'sync',
                        gameState
                    });
                    if (sent) {
                        lastAutoResyncSentAt = now;
                    }
                    return;
                }

                if (now - lastSyncReceivedAt < AUTO_RESYNC_STALE_THRESHOLD) return;
                if (now - lastAutoResyncRequestAt < AUTO_RESYNC_REQUEST_COOLDOWN) return;
                const sent = await sendBluetoothData({ type: 'requestSync' });
                if (sent) {
                    lastAutoResyncRequestAt = now;
                }
            } catch (_error) {
                // Ignore tick errors, transport recovery handles disruptions.
            } finally {
                autoResyncTickInFlight = false;
            }
        }

        function startAutoResyncLoop() {
            stopAutoResyncLoop();
            lastSyncReceivedAt = Date.now();
            autoResyncIntervalId = setInterval(() => {
                runAutoResyncTick();
            }, AUTO_RESYNC_TICK_INTERVAL);
        }

        function stopBluetoothHeartbeat() {
            if (heartbeatIntervalId) {
                clearInterval(heartbeatIntervalId);
                heartbeatIntervalId = null;
            }
            if (heartbeatWatchdogId) {
                clearInterval(heartbeatWatchdogId);
                heartbeatWatchdogId = null;
            }
            pendingPings.clear();
            stopAutoResyncLoop();
        }

        function startBluetoothHeartbeat() {
            stopBluetoothHeartbeat();
            touchBluetoothActivity();
            pendingPings.clear();

            heartbeatIntervalId = setInterval(() => {
                if (!bluetoothConnection?.dataChannel || bluetoothConnection.dataChannel.readyState !== 'open') {
                    return;
                }
                if (!connectionStatus.connected || reconnectInProgress) {
                    return;
                }
                const now = performance.now();
                pendingPings.forEach((sentAt, pingId) => {
                    if (now - sentAt > HEARTBEAT_TIMEOUT) {
                        pendingPings.delete(pingId);
                    }
                });

                const pingId = getNextPingId();
                pendingPings.set(pingId, performance.now());
                sendBluetoothData({ type: 'ping', id: pingId, ts: Date.now() }).catch(() => {
                    pendingPings.delete(pingId);
                });
            }, HEARTBEAT_INTERVAL);

            heartbeatWatchdogId = setInterval(() => {
                if (!bluetoothConnection?.peerConnection || !connectionStatus.connected || reconnectInProgress) {
                    return;
                }
                if (Date.now() - lastBluetoothActivityAt <= HEARTBEAT_TIMEOUT) {
                    return;
                }

                console.warn('Connexion WebRTC inactive, tentative de reconnexion.');
                handleDisconnection();
            }, 1500);

            startAutoResyncLoop();
        }

        function detachBluetoothListeners(connection = bluetoothConnection) {
            if (!connection) return;
            if (connection === bluetoothConnection) {
                resetPeerConnection(true);
            } else {
                try {
                    connection.dataChannel?.close();
                } catch (_error) {
                    // Ignore.
                }
                try {
                    connection.peerConnection?.close();
                } catch (_error) {
                    // Ignore.
                }
            }
            connection.listenersAttached = false;
        }

        function configureBluetoothConnection(hostRole, sessionCode = null) {
            if (bluetoothConnection) {
                detachBluetoothListeners(bluetoothConnection);
                closeSignalingSocket();
            }

            const normalizedCode = sanitizeSessionCode(
                sessionCode || bluetoothSession.code || bluetoothSession.expectedCode || ''
            );

            bluetoothConnection = {
                signalingSocket: null,
                peerConnection: null,
                dataChannel: null,
                listenersAttached: false,
                onDisconnected: null,
                onValueChanged: null,
                role: hostRole ? 'host' : 'guest',
                sessionCode: normalizedCode || null,
                peerReady: false,
                pendingIceCandidates: []
            };
            isHost = hostRole;
            reconnectInProgress = false;
            resetNetworkMatchState();
            resetBluetoothTransportState();
        }

        async function hostGame() {
            if (!ensureBluetoothSupported()) return;
            if (connectionStatus.connecting || connectionStatus.reconnecting) {
                showToast('Connexion en cours.', 'info');
                return;
            }

            try {
                prepareHostSession();
                const onlineConfig = getOnlinePlayersConfigFromSetup();
                bluetoothSession.hostConfig = {
                    gridSize: normalizeGridSize(document.getElementById('gridSize')?.value ?? 8),
                    gameOptions: getGameOptionsFromSetup(),
                    onlinePlayersCount: onlineConfig.onlinePlayersCount,
                    onlinePlayerNames: onlineConfig.onlinePlayerNames,
                    onlinePlayerColors: onlineConfig.onlinePlayerColors
                };
                updateConnectionStatus({
                    connecting: true,
                    reconnecting: false,
                    error: null,
                    reconnectAttempt: 0,
                    reconnectTotal: 0,
                    nextRetryInMs: 0,
                    statusDetail: ''
                });
                configureBluetoothConnection(true, bluetoothSession.code);
                await startBluetoothGame();
            } catch (error) {
                console.error('Erreur de connexion WebRTC:', error);
                restoreSetupAfterWebRTCFailure();
                handleConnectionError(error);
            }
        }

        function handleConnectionError(error) {
            stopBluetoothHeartbeat();
            reconnectInProgress = false;
            resetNetworkMatchState();
            let message;
                switch (error.name) {
                    case 'NotSupportedError':
                        message = 'WebRTC non supporte sur ce navigateur.';
                        break;
                    default:
                        if (String(error?.message || '').toLowerCase().includes('role guest est deja occupe')) {
                            message = 'Ce salon est deja complet (2 appareils max). Pour jouer a 3/4, utilisez 1 hote + 1 invite.';
                        } else {
                            message = `Erreur de connexion: ${error.message}`;
                        }
                }

            updateConnectionStatus({
                connected: false,
                connecting: false,
                reconnecting: false,
                error: message,
                latencyMs: null,
                latencyQuality: 'unknown',
                reconnectAttempt: 0,
                reconnectTotal: 0,
                nextRetryInMs: 0,
                statusDetail: ''
            });

            if (bluetoothConnection) {
                resetPeerConnection(false);
            }
            if (!window.game) {
                bluetoothConnection = null;
            }

            pendingPings.clear();

            showError(message);
        }

        function showError(message) {
            const errorModal = document.createElement('div');
            errorModal.className = 'modal active fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm';
            errorModal.innerHTML = `
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-[340px] w-full p-8 shadow-2xl border border-slate-200 dark:border-slate-700 text-center">
            <div class="w-14 h-14 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                <span class="material-symbols-outlined text-[28px]">warning</span>
            </div>
            <h2 class="text-xl font-bold mb-2 dark:text-white text-slate-900">Erreur reseau</h2>
            <p class="mb-6 text-sm dark:text-slate-300 text-slate-600">${message}</p>
            <button class="w-full bg-slate-100 dark:bg-slate-700 dark:text-white text-slate-700 font-bold py-3.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" onclick="this.closest('.modal').remove()">Fermer</button>
        </div>
    `;
            document.body.appendChild(errorModal);
            showToast(message, 'error', 3000);
        }

        async function handleDisconnection() {
            if (!bluetoothConnection || reconnectInProgress) return;

            reconnectInProgress = true;
            stopBluetoothHeartbeat();
            resetBluetoothTransportState();
            resetNetworkMatchState();
            updateWebRTCActionButtons();

            const sessionCode = sanitizeSessionCode(
                bluetoothConnection.sessionCode || bluetoothSession.code || bluetoothSession.expectedCode || ''
            );
            if (!sessionCode) {
                reconnectInProgress = false;
                updateConnectionStatus({
                    connected: false,
                    connecting: false,
                    reconnecting: false,
                    error: 'Code de session manquant',
                    latencyMs: null,
                    latencyQuality: 'unknown',
                    reconnectAttempt: 0,
                    reconnectTotal: 0,
                    nextRetryInMs: 0,
                    statusDetail: ''
                });
                return;
            }

            updateConnectionStatus({
                connected: false,
                connecting: false,
                reconnecting: true,
                error: null,
                latencyMs: null,
                latencyQuality: 'unknown',
                reconnectAttempt: 0,
                reconnectTotal: RECONNECTION_ATTEMPTS,
                nextRetryInMs: RECONNECTION_DELAY,
                statusDetail: 'Reprise automatique active.'
            });

            for (let attempts = 0; attempts < RECONNECTION_ATTEMPTS; attempts++) {
                try {
                    const attemptNumber = attempts + 1;
                    await sleepWithProgress(RECONNECTION_DELAY, (remainingMs) => {
                        updateConnectionStatus({
                            reconnecting: true,
                            reconnectAttempt: attemptNumber,
                            reconnectTotal: RECONNECTION_ATTEMPTS,
                            nextRetryInMs: remainingMs,
                            statusDetail: 'Reprise automatique active.'
                        });
                    });

                    resetPeerConnection(false);
                    bluetoothConnection.sessionCode = sessionCode;
                    bluetoothConnection.role = isHost ? 'host' : 'guest';
                    bluetoothConnection.peerReady = false;
                    bluetoothConnection.pendingIceCandidates = [];

                    await connectSignalingSocket(sessionCode);
                    setupPeerConnectionIfNeeded();
                    if (isHost && bluetoothConnection.peerReady) {
                        await createOfferAndSend();
                    }
                    await waitForDataChannelOpen();
                    bluetoothConnection.listenersAttached = true;
                    await markConnectionReady();

                    reconnectInProgress = false;
                    updateConnectionStatus({
                        reconnectAttempt: 0,
                        reconnectTotal: 0,
                        nextRetryInMs: 0,
                        statusDetail: 'Session stable.'
                    });
                    showToast('Connexion WebRTC retablie.', 'success');
                    return;
                } catch (error) {
                    console.log(`Echec de la tentative ${attempts + 1}:`, error);
                }
            }

            reconnectInProgress = false;
            const finalError = 'Reconnexion impossible';
            const finalDetail = 'Echec de la reprise automatique.';
            updateConnectionStatus({
                connected: false,
                connecting: false,
                reconnecting: false,
                error: finalError,
                latencyMs: null,
                latencyQuality: 'unknown',
                reconnectAttempt: 0,
                reconnectTotal: 0,
                nextRetryInMs: 0,
                statusDetail: finalDetail
            });
            showError('Connexion perdue. Redemarrez la partie.');
        }

        function updateConnectionStatus(status) {
            connectionStatus = { ...connectionStatus, ...status };
            const statusDiv = document.getElementById('bluetoothStatus');
            if (!statusDiv) return;

            let statusClass = 'disconnected';
            let statusTitle = 'Deconnecte';
            let statusMeta = 'Session -- | Latence --';

            const sessionText = connectionStatus.sessionCode
                ? `Session ${connectionStatus.sessionCode}`
                : 'Session --';
            const latencyText = formatLatencyForDisplay(connectionStatus.latencyMs);

            if (connectionStatus.connecting) {
                statusClass = 'connecting';
                statusTitle = 'Connexion en cours...';
                statusMeta = `${sessionText} | Initialisation...`;
            } else if (connectionStatus.reconnecting) {
                statusClass = 'reconnecting';
                const attempt = Math.max(1, connectionStatus.reconnectAttempt || 1);
                const total = Math.max(1, connectionStatus.reconnectTotal || RECONNECTION_ATTEMPTS);
                const retryCountdown = formatRetryCountdown(connectionStatus.nextRetryInMs);
                statusTitle = `Reconnexion ${attempt}/${total}`;
                statusMeta = `${sessionText} | Reprise auto dans ${retryCountdown}s`;
            } else if (connectionStatus.connected) {
                statusClass = 'connected';
                statusTitle = connectionStatus.sessionVerified ? 'Connecte' : 'Connecte (verification)';
                statusMeta = `${sessionText} | ${latencyText}`;
            } else if (connectionStatus.error) {
                statusClass = 'error';
                statusTitle = 'Erreur reseau';
                statusMeta = connectionStatus.error;
            } else {
                statusMeta = `${sessionText} | ${latencyText}`;
            }

            if (connectionStatus.statusDetail && (connectionStatus.reconnecting || connectionStatus.connecting)) {
                statusMeta = `${statusMeta} | ${connectionStatus.statusDetail}`;
            }

            statusDiv.dataset.latency = connectionStatus.connected
                ? (connectionStatus.latencyQuality || 'unknown')
                : 'unknown';
            statusDiv.className = `bluetooth-status ${statusClass}${bluetoothStatusCollapsed ? ' collapsed' : ''}`;
            statusDiv.innerHTML = `
        <span class="status-indicator"></span>
        <span class="status-copy">
            <span class="status-title">${statusTitle}</span>
            <span class="status-meta">${statusMeta}</span>
        </span>
        <button
            type="button"
            class="status-toggle"
            id="bluetoothStatusToggle"
            aria-label="Reduire le statut reseau"
            aria-expanded="true"
            title="Reduire le statut reseau"
            onclick="toggleBluetoothStatusCollapsed()">▾</button>
    `;
            syncBluetoothStatusCollapseUI();
            updateWebRTCActionButtons();
            if (window.game && typeof window.game.updateUI === 'function') {
                window.game.updateUI();
            }
        }

        async function joinGame() {
            if (!ensureBluetoothSupported()) return;
            if (connectionStatus.connecting || connectionStatus.reconnecting) {
                showToast('Connexion en cours.', 'info');
                return;
            }

            try {
                prepareJoinSession();
                if (!bluetoothSession.expectedCode) {
                    showToast('Saisissez le code de session de l hote.', 'info');
                    document.getElementById('sessionCodeInput')?.focus();
                    return;
                }
                updateConnectionStatus({
                    connecting: true,
                    reconnecting: false,
                    error: null,
                    reconnectAttempt: 0,
                    reconnectTotal: 0,
                    nextRetryInMs: 0,
                    statusDetail: ''
                });
                configureBluetoothConnection(false, bluetoothSession.expectedCode);
                await startBluetoothGame();
            } catch (error) {
                console.error('Erreur WebRTC:', error);
                restoreSetupAfterWebRTCFailure();
                handleConnectionError(error);
            }
        }

        async function startBluetoothGame() {
            const localName = getPlayerName('player1Name', 'Joueur 1');
            const localColor = getPlayerColor('player1Color', '#328DCB');
            let selectedGridSize = normalizeGridSize(document.getElementById('gridSize')?.value ?? 8);
            let gameOptions = getGameOptionsFromSetup();
            let onlineConfig = getOnlinePlayersConfigFromSetup();

            if (!isHost && bluetoothSession.hostConfig) {
                applyHostConfigToSetup(bluetoothSession.hostConfig, true);
                selectedGridSize = normalizeGridSize(bluetoothSession.hostConfig.gridSize);
                gameOptions = normalizeHostGameOptions(bluetoothSession.hostConfig.gameOptions);
                onlineConfig = {
                    onlinePlayersCount: normalizeOnlinePlayersCount(bluetoothSession.hostConfig.onlinePlayersCount ?? 2),
                    onlinePlayerNames: normalizeHostPlayerNames(
                        bluetoothSession.hostConfig.onlinePlayerNames || [],
                        bluetoothSession.hostConfig.onlinePlayersCount ?? 2
                    ),
                    onlinePlayerColors: normalizeHostPlayerColors(
                        bluetoothSession.hostConfig.onlinePlayerColors || [],
                        bluetoothSession.hostConfig.onlinePlayersCount ?? 2
                    )
                };
            } else if (!isHost) {
                onlineConfig = {
                    onlinePlayersCount: 2,
                    onlinePlayerNames: ['Hote', normalizePlayerName(localName, 'Joueur')],
                    onlinePlayerColors: ['#328DCB', localColor]
                };
            }
            const players = buildOnlinePlayersFromConfig(onlineConfig);

            showGameView();

            window.game = new Game(players, false, selectedGridSize, gameOptions);
            const undoButton = document.getElementById('undoButton');
            if (undoButton) {
                undoButton.disabled = true;
            }

            const listenersReady = await setupBluetoothListeners();
            if (!listenersReady) {
                restoreSetupAfterWebRTCFailure();
                showError('Connexion WebRTC impossible. Verifiez le code de session et le serveur.');
                return;
            }
            const blitzSuffix = gameOptions.blitzEnabled
                ? ` | Blitz ${gameOptions.blitzTurnSeconds}s`
                : '';
            const obstaclesSuffix = gameOptions.obstacleEnabled ? ' | Obstacles' : '';
            const playersSuffix = ` | ${players.length} joueurs`;
            const sessionSuffix = bluetoothSession.code
                ? ` | Session ${bluetoothSession.code}`
                : (bluetoothSession.expectedCode ? ` | Session attendue ${bluetoothSession.expectedCode}` : '');
            showToast(
                `Partie WebRTC lancee (${selectedGridSize}x${selectedGridSize}${playersSuffix}${blitzSuffix}${obstaclesSuffix}${sessionSuffix}).`,
                'success'
            );
        }

        async function announceBluetoothSession() {
            if (!bluetoothConnection?.dataChannel || bluetoothConnection.dataChannel.readyState !== 'open') {
                return;
            }
            if (!connectionStatus.connected) {
                return;
            }

            if (isHost) {
                const code = bluetoothSession.code || generateSessionCode();
                bluetoothSession.code = code;
                bluetoothSession.expectedCode = code;
                bluetoothSession.verified = true;
                setHostSessionCodeDisplay(code);
                setSessionCodePreview(`Code de session hote: ${code}`);
                updateConnectionStatus({
                    sessionCode: code,
                    sessionVerified: true
                });

                await sendBluetoothData({
                    type: 'sessionInfo',
                    code,
                    hostName: normalizePlayerName(getPlayerName('player1Name', 'Hote'), 'Hote'),
                    gridSize: window.game ? window.game.size : 8,
                    onlinePlayersCount: normalizeOnlinePlayersCount(window.game?.players?.length || 2),
                    playerNames: window.game ? window.game.players.map((player, idx) => normalizePlayerName(player?.name, `Joueur ${idx + 1}`)) : [],
                    playerColors: window.game ? window.game.players.map((player) => String(player?.color || '#328DCB')) : [],
                    gameOptions: window.game ? {
                        blitzEnabled: window.game.blitzEnabled,
                        blitzTurnSeconds: window.game.turnDurationMs ? window.game.turnDurationMs / 1000 : 10,
                        gravityEnabled: window.game.gravityEnabled,
                        hyperNexusEnabled: window.game.hyperNexusEnabled,
                        obstacleEnabled: window.game.obstacleEnabled,
                        obstacleDensity: normalizeObstacleDensity(window.game.obstacleDensity)
                    } : {}
                });
                return;
            }

            await sendBluetoothData({
                type: 'sessionHello',
                expectedCode: bluetoothSession.expectedCode,
                playerName: normalizePlayerName(getPlayerName('player1Name', 'Joueur'), 'Joueur')
            });
        }

        async function setupBluetoothListeners() {
            if (!bluetoothConnection) return false;

            const sessionCode = sanitizeSessionCode(
                bluetoothConnection.sessionCode || bluetoothSession.code || bluetoothSession.expectedCode || ''
            );
            if (!sessionCode) {
                updateConnectionStatus({
                    connected: false,
                    connecting: false,
                    reconnecting: false,
                    error: 'Code de session invalide.',
                    latencyMs: null,
                    latencyQuality: 'unknown',
                    reconnectAttempt: 0,
                    reconnectTotal: 0,
                    nextRetryInMs: 0,
                    statusDetail: ''
                });
                return false;
            }

            try {
                resetPeerConnection(false);
                bluetoothConnection.sessionCode = sessionCode;
                bluetoothConnection.role = isHost ? 'host' : 'guest';
                bluetoothConnection.peerReady = false;
                bluetoothConnection.pendingIceCandidates = [];

                await connectSignalingSocket(sessionCode);
                setupPeerConnectionIfNeeded();
                if (isHost && bluetoothConnection.peerReady) {
                    await createOfferAndSend();
                }
                updateConnectionStatus({
                    statusDetail: 'Connexion du canal de donnees...'
                });
                const connectionTimeout = isHost ? WEBRTC_HOST_WAIT_TIMEOUT : WEBRTC_JOIN_WAIT_TIMEOUT;
                await waitForDataChannelOpen(connectionTimeout);
                bluetoothConnection.listenersAttached = true;
                await markConnectionReady();
                return true;
            } catch (error) {
                const errorMessage = String(error && error.message ? error.message : error);
                updateConnectionStatus({
                    connected: false,
                    connecting: false,
                    reconnecting: false,
                    error: errorMessage,
                    latencyMs: null,
                    latencyQuality: 'unknown',
                    reconnectAttempt: 0,
                    reconnectTotal: 0,
                    nextRetryInMs: 0,
                    statusDetail: ''
                });
                return false;
            }
        }

        async function handleRemoteMove(move) {
            if (!window.game) return;
            const remoteIndices = getRemotePlayerIndices(window.game.players?.length || 2);
            if (!remoteIndices.includes(window.game.currentPlayerIndex)) return;
            await window.game.handlePointClick(move.x, move.y, 'remote');
        }

        async function processBluetoothMessage(payload) {
            if (!payload) return;

            let data;
            try {
                data = JSON.parse(payload);
            } catch (_error) {
                // Ignore non-JSON payloads sent through the data channel.
                return;
            }

            touchBluetoothActivity();
            switch (data.type) {
                case 'move':
                    await handleRemoteMove(data.move);
                    break;
                case 'sessionHello':
                    if (isHost) {
                        const expectedCode = sanitizeSessionCode(data.expectedCode);
                        const hostCode = bluetoothSession.code || generateSessionCode();
                        const guestName = normalizePlayerName(data.playerName, 'Adversaire');
                        bluetoothSession.code = hostCode;
                        bluetoothSession.expectedCode = hostCode;
                        applyNetworkPlayerNames({ guestName });
                        networkMatchState.guestReady = true;

                        await sendBluetoothData({
                            type: 'sessionInfo',
                            code: hostCode,
                            hostName: normalizePlayerName(getPlayerName('player1Name', 'Hote'), 'Hote'),
                            match: !expectedCode || expectedCode === hostCode,
                            expectedCode: expectedCode || null,
                            gridSize: window.game ? window.game.size : 8,
                            onlinePlayersCount: normalizeOnlinePlayersCount(window.game?.players?.length || 2),
                            playerNames: window.game ? window.game.players.map((player, idx) => normalizePlayerName(player?.name, `Joueur ${idx + 1}`)) : [],
                            playerColors: window.game ? window.game.players.map((player) => String(player?.color || '#328DCB')) : [],
                            gameOptions: window.game ? {
                                blitzEnabled: window.game.blitzEnabled,
                                blitzTurnSeconds: window.game.turnDurationMs ? window.game.turnDurationMs / 1000 : 10,
                                gravityEnabled: window.game.gravityEnabled,
                                hyperNexusEnabled: window.game.hyperNexusEnabled,
                                obstacleEnabled: window.game.obstacleEnabled,
                                obstacleDensity: normalizeObstacleDensity(window.game.obstacleDensity)
                            } : {}
                        });
                        updateConnectionStatus({
                            sessionCode: hostCode,
                            sessionVerified: true
                        });

                        if (expectedCode && expectedCode !== hostCode) {
                            showToast('Code saisi par le client different du code hote.', 'info');
                        }
                        await sendLobbyStateToPeer();
                        updateWebRTCActionButtons();
                        updateLobbyHint();
                        await maybeAutoStartMatchCountdown();
                    }
                    break;
                case 'sessionInfo':
                    if (!isHost) {
                        const receivedCode = sanitizeSessionCode(data.code);
                        if (!receivedCode) break;
                        const hostName = normalizePlayerName(data.hostName, 'Hote');

                        const expectedCode = sanitizeSessionCode(bluetoothSession.expectedCode);
                        if (expectedCode && expectedCode !== receivedCode) {
                            reconnectionBlockedReason = null;
                            bluetoothSession.code = receivedCode;
                            bluetoothSession.verified = false;
                            updateConnectionStatus({
                                sessionCode: receivedCode,
                                sessionVerified: false
                            });
                            setSessionCodePreview(
                                `Code different: attendu ${expectedCode}, recu ${receivedCode}.`
                            );
                            showToast(
                                `Code de session different (attendu ${expectedCode}, recu ${receivedCode}).`,
                                'info',
                                3200
                            );
                            break;
                        }

                        const shouldNotify = !bluetoothSession.verified || bluetoothSession.code !== receivedCode;
                        bluetoothSession.code = receivedCode;
                        bluetoothSession.verified = true;
                        reconnectionBlockedReason = null;
                        applyNetworkPlayerNames({ hostName });
                        networkMatchState.hostReady = true;
                        updateWebRTCActionButtons();
                        updateLobbyHint();
                        await applyHostSessionConfig(data);
                        updateConnectionStatus({
                            sessionCode: receivedCode,
                            sessionVerified: true,
                            error: null
                        });
                        setSessionCodePreview(`Session connectee: ${receivedCode}`);
                        if (shouldNotify) {
                            showToast(`Session ${receivedCode} verifiee.`, 'success');
                        }
                    }
                    break;
                case 'guestReady':
                    if (isHost) {
                        networkMatchState.guestReady = true;
                        if (data.guestName) {
                            applyNetworkPlayerNames({ guestName: data.guestName });
                        }
                        await sendLobbyStateToPeer();
                        updateWebRTCActionButtons();
                        updateLobbyHint();
                        await maybeAutoStartMatchCountdown();
                    }
                    break;
                case 'requestLobbyState':
                    if (isHost) {
                        await sendLobbyStateToPeer();
                    }
                    break;
                case 'lobbyState':
                    if (!isHost) {
                        applyLobbyStateFromPayload(data);
                    }
                    break;
                case 'startCountdown':
                    if (!networkMatchState.started) {
                        const durationMs = Math.max(
                            1000,
                            Number.parseInt(data.durationMs, 10) || MATCH_START_COUNTDOWN_MS
                        );
                        await startNetworkMatchCountdown({ durationMs, broadcast: false });
                    }
                    break;
                case 'startMatch':
                    abortMatchStartCountdown();
                    applyLobbyStateFromPayload({ started: true, hostReady: true, guestReady: true });
                    showToast('La manche a demarre.', 'success');
                    break;
                case 'sync':
                    syncGameState(data.gameState);
                    break;
                case 'requestSync':
                    if (isHost) {
                        await sendBluetoothData({
                            type: 'sync',
                            gameState: getGameState()
                        });
                    }
                    break;
                case 'timeout':
                    if (window.game) {
                        window.game.applyTimeout(data.playerIndex);
                    }
                    break;
                case 'ping':
                    await sendBluetoothData({ type: 'pong', id: data.id ?? null });
                    break;
                case 'pong':
                    {
                        const pingId = Number.parseInt(data.id, 10);
                        if (Number.isFinite(pingId) && pendingPings.has(pingId)) {
                            const sentAt = pendingPings.get(pingId);
                            pendingPings.delete(pingId);
                            const rttMs = Math.max(0, Math.round(performance.now() - sentAt));
                            updateConnectionStatus({
                                latencyMs: rttMs,
                                latencyQuality: evaluateLatencyQuality(rttMs)
                            });
                        }
                    }
                    break;
                case 'sessionReject':
                    if (!isHost) {
                        const expectedCode = sanitizeSessionCode(data.expectedCode);
                        const reason = expectedCode
                            ? `Code de session invalide. Code attendu par l'hote: ${expectedCode}.`
                            : 'Code de session invalide.';
                        reconnectionBlockedReason = null;
                        bluetoothSession.verified = false;
                        updateConnectionStatus({
                            sessionVerified: false
                        });
                        setSessionCodePreview(reason);
                        showToast(reason, 'info', 3200);
                    }
                    break;
                default:
                    console.warn('Type de message reseau inconnu:', data.type);
            }
        }

        async function sendBluetoothData(data) {
            const channel = bluetoothConnection?.dataChannel;
            if (!channel || channel.readyState !== 'open' || !connectionStatus.connected) {
                return false;
            }

            try {
                channel.send(JSON.stringify(data));
                touchBluetoothActivity();
                return true;
            } catch (error) {
                console.error('Erreur d envoi:', error);
                updateConnectionStatus({
                    connected: false,
                    error: 'Erreur d envoi',
                    statusDetail: 'Tentative de reprise automatique...'
                });
                if (!reconnectInProgress && bluetoothConnection) {
                    handleDisconnection();
                }
                return false;
            }
        }

        function syncGameState(gameState) {
            if (!window.game || !gameState) return;
            lastSyncReceivedAt = Date.now();

            if (!isHost) {
                const syncedCount = normalizeOnlinePlayersCount(
                    gameState.onlinePlayersCount ?? (Array.isArray(gameState.players) ? gameState.players.length : 2)
                );
                const hostConfig = {
                    gridSize: normalizeGridSize(gameState.size ?? 8),
                    gameOptions: {
                        blitzEnabled: Boolean(gameState.blitzEnabled),
                        blitzTurnSeconds: normalizeBlitzTurnSeconds(
                            gameState.turnDurationMs ? Math.round(gameState.turnDurationMs / 1000) : 10
                        ),
                        gravityEnabled: Boolean(gameState.gravityEnabled),
                        hyperNexusEnabled: Boolean(gameState.hyperNexusEnabled),
                        obstacleEnabled: Boolean(gameState.obstacleEnabled),
                        obstacleDensity: normalizeObstacleDensity(gameState.obstacleDensity)
                    },
                    onlinePlayersCount: syncedCount,
                    onlinePlayerNames: normalizeHostPlayerNames(
                        (gameState.players || []).map(player => player?.name),
                        syncedCount
                    ),
                    onlinePlayerColors: normalizeHostPlayerColors(
                        (gameState.players || []).map(player => player?.color),
                        syncedCount
                    )
                };
                bluetoothSession.hostConfig = hostConfig;
                applyHostConfigToSetup(hostConfig, true);
            }
            applyLobbyStateFromPayload({
                started: Boolean(gameState.matchStarted),
                hostReady: gameState.matchHostReady !== undefined ? Boolean(gameState.matchHostReady) : true,
                guestReady: gameState.matchGuestReady !== undefined ? Boolean(gameState.matchGuestReady) : true
            });

            window.game.restoreSnapshot({
                size: gameState.size,
                points: gameState.points || [],
                boxes: gameState.boxes || [],
                currentPlayerIndex: gameState.currentPlayerIndex ?? 0,
                players: (gameState.players || []).map(player => ({ ...player })),
                gameOver: Boolean(gameState.gameOver),
                blitzEnabled: Boolean(gameState.blitzEnabled),
                turnDurationMs: gameState.turnDurationMs,
                turnRemainingMs: gameState.turnRemainingMs,
                gravityEnabled: Boolean(gameState.gravityEnabled),
                gravityDirection: gameState.gravityDirection,
                movesUntilShiftCount: gameState.movesUntilShiftCount,
                initialMovesUntilShift: gameState.initialMovesUntilShift,
                hyperNexusEnabled: Boolean(gameState.hyperNexusEnabled),
                obstacleEnabled: Boolean(gameState.obstacleEnabled),
                obstacleDensity: normalizeObstacleDensity(gameState.obstacleDensity),
                obstacles: gameState.obstacles || [],
                endReason: gameState.endReason || 'board',
                timedOutPlayerIndex: gameState.timedOutPlayerIndex
            }, true);

            if (!isHost && gameState.sessionCode) {
                const syncedCode = sanitizeSessionCode(gameState.sessionCode);
                if (syncedCode) {
                    bluetoothSession.code = syncedCode;
                    bluetoothSession.verified = true;
                    updateConnectionStatus({
                        sessionCode: syncedCode,
                        sessionVerified: true
                    });
                    setSessionCodePreview(`Session connectee: ${syncedCode}`);
                }
            }
        }

        function getGameState() {
            if (!window.game) return null;
            return {
                size: window.game.size,
                points: Array.from(window.game.points.entries()),
                boxes: Array.from(window.game.boxes.entries()),
                currentPlayerIndex: window.game.currentPlayerIndex,
                players: window.game.players.map(player => ({ ...player })),
                gameOver: window.game.gameOver,
                blitzEnabled: window.game.blitzEnabled,
                turnDurationMs: window.game.turnDurationMs,
                turnRemainingMs: window.game.getRemainingTurnMs(),
                gravityEnabled: window.game.gravityEnabled,
                gravityDirection: window.game.gravityDirection,
                movesUntilShiftCount: window.game.movesUntilShiftCount,
                initialMovesUntilShift: window.game.initialMovesUntilShift,
                hyperNexusEnabled: window.game.hyperNexusEnabled,
                obstacleEnabled: window.game.obstacleEnabled,
                obstacleDensity: normalizeObstacleDensity(window.game.obstacleDensity),
                onlinePlayersCount: normalizeOnlinePlayersCount(window.game.players?.length || 2),
                obstacles: Array.from(window.game.obstacles || []),
                endReason: window.game.endReason,
                timedOutPlayerIndex: window.game.timedOutPlayerIndex,
                matchStarted: networkMatchState.started,
                matchHostReady: networkMatchState.hostReady,
                matchGuestReady: networkMatchState.guestReady,
                sessionCode: bluetoothSession.code || connectionStatus.sessionCode || null
            };
        }

        function updateGamePaceUI() {
            const blitzTurnSelector = document.getElementById('blitzTurnSelector');
            const gamePace = document.getElementById('gamePace')?.value ?? 'classic';
            if (blitzTurnSelector) {
                blitzTurnSelector.style.display = gamePace === 'blitz' ? 'block' : 'none';
            }

            const modeDescription = document.getElementById('modeDescription');
            if (!modeDescription) return;

            const baseDescription = modeDescription.dataset.baseDescription || modeDescription.textContent || '';
            modeDescription.textContent = gamePace === 'blitz'
                ? `${baseDescription} Mode Blitz: chrono limite a chaque tour.`
                : baseDescription;
        }

        function updatePlayerCards() {
            const gameModeInput = document.getElementById('gameMode');
            const gameMode = gameModeInput?.value ?? '2players';
            const aiDifficultySelector = document.getElementById('aiDifficultySelector');
            const localPlayersSection = document.getElementById('localPlayersSection');
            const localPlayersDisplay = document.getElementById('localPlayersDisplay');
            const onlinePlayersSection = document.getElementById('onlinePlayersSection');
            const onlinePlayersDisplay = document.getElementById('onlinePlayersDisplay');
            const playerNamesSection = document.getElementById('playerNamesSection');
            const setupPlayerNameInput = document.getElementById('player1Name');
            const lobbyPlayerNameInput = document.getElementById('lobbyPlayerName');
            const webrtcSettingsGroup = document.getElementById('webrtcSettingsGroup');
            const webrtcActionArea = document.getElementById('webrtcActionArea');
            const hostCard = document.getElementById('cardHost');
            const joinCard = document.getElementById('cardJoin');
            const hostArea = document.getElementById('webrtcHostArea');
            const joinArea = document.getElementById('webrtcJoinArea');
            const setupStartButton = document.getElementById('setupStartButton');
            const setupStartLabel = setupStartButton?.querySelector('.setup-start-label');
            const setupStartIcon = setupStartButton?.querySelector('.setup-start-icon');
            const modeDescription = document.getElementById('modeDescription');

            const isAiMode = gameMode === 'ai';
            const isBluetoothMode = gameMode === 'bluetooth';
            const parsedLocalCount = Number.parseInt(gameMode, 10);
            const localPlayerCount = [2, 3, 4].includes(parsedLocalCount) ? parsedLocalCount : 2;
            const onlinePlayersInput = document.getElementById('onlinePlayersCount');
            const onlinePlayerCount = normalizeOnlinePlayersCount(onlinePlayersInput?.value ?? 2);
            const isJoinRole = isBluetoothMode && !isHost;

            if (setupPlayerNameInput && lobbyPlayerNameInput && lobbyPlayerNameInput.value !== setupPlayerNameInput.value) {
                lobbyPlayerNameInput.value = setupPlayerNameInput.value;
            }

            if (setupStartButton) {
                setupStartButton.style.display = 'block';
                if (setupStartLabel) {
                    setupStartLabel.textContent = isBluetoothMode ? 'Acceder au Lobby' : 'Lancer la Partie';
                }
                if (setupStartIcon) {
                    setupStartIcon.textContent = isBluetoothMode ? 'groups' : 'play_arrow';
                }
            }

            if (localPlayersSection) {
                localPlayersSection.style.display = (!isAiMode && !isBluetoothMode) ? 'block' : 'none';
            }
            if (!isAiMode && !isBluetoothMode) {
                if (gameModeInput && gameModeInput.value !== `${localPlayerCount}players`) {
                    gameModeInput.value = `${localPlayerCount}players`;
                }
                if (localPlayersDisplay) {
                    localPlayersDisplay.textContent = `${localPlayerCount} joueurs`;
                }
                [2, 3, 4].forEach((count) => {
                    const button = document.getElementById(`localPlayersBtn${count}`);
                    if (!button) return;
                    if (count === localPlayerCount) {
                        button.className = "py-3 text-sm font-bold rounded-xl bg-primary text-white shadow-lg shadow-primary/30 border border-primary/50 transition-all";
                    } else {
                        button.className = "py-3 text-sm font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 transition-all border border-transparent";
                    }
                });
            }

            if (onlinePlayersSection) {
                onlinePlayersSection.style.display = isBluetoothMode ? 'block' : 'none';
            }
            if (isBluetoothMode) {
                if (onlinePlayersInput) {
                    onlinePlayersInput.value = String(onlinePlayerCount);
                }
                if (onlinePlayersDisplay) {
                    onlinePlayersDisplay.textContent = `${onlinePlayerCount} joueurs`;
                }
                [2, 3, 4].forEach((count) => {
                    const button = document.getElementById(`onlinePlayersBtn${count}`);
                    if (!button) return;
                    if (count === onlinePlayerCount) {
                        button.className = "py-3 text-sm font-bold rounded-xl bg-primary text-white shadow-lg shadow-primary/30 border border-primary/50 transition-all";
                    } else {
                        button.className = "py-3 text-sm font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 transition-all border border-transparent";
                    }
                });
            }

            if (playerNamesSection) {
                playerNamesSection.style.display = 'block';
                const visibleNameCount = isAiMode
                    ? 1
                    : (isBluetoothMode ? (isJoinRole ? 1 : onlinePlayerCount) : localPlayerCount);
                for (let index = 1; index <= 4; index++) {
                    const row = document.getElementById(`playerNameRow${index}`);
                    const label = document.getElementById(`playerNameLabel${index}`);
                    const input = document.getElementById(`player${index}Name`);
                    const showRow = index <= visibleNameCount;
                    if (row) {
                        row.style.display = showRow ? 'block' : 'none';
                    }
                    if (label) {
                        label.textContent = (isAiMode || isJoinRole)
                            ? 'Votre pseudo'
                            : `Joueur ${index}`;
                    }
                    if (input) {
                        const placeholderText = (isAiMode || isJoinRole)
                            ? 'Entrez votre pseudo'
                            : `Joueur ${index}`;
                        input.placeholder = placeholderText;
                    }
                }
            }

            if (modeDescription) {
                if (isBluetoothMode) {
                    modeDescription.dataset.baseDescription = 'Connectez deux navigateurs via WebRTC.';
                    setSessionCodePreview("L'hote peut partager un code pour verifier la bonne session.");
                } else if (isAiMode) {
                    modeDescription.dataset.baseDescription = 'Affrontez une IA et reglez sa difficulte.';
                } else {
                    modeDescription.dataset.baseDescription = `${localPlayerCount} joueurs sur le meme ecran.`;
                }
            }

            if (aiDifficultySelector) {
                aiDifficultySelector.style.display = isAiMode ? 'block' : 'none';
            }

            // Webrtc controls switch
            if (webrtcSettingsGroup) {
                webrtcSettingsGroup.style.display = isBluetoothMode ? 'block' : 'none';
            }
            if (!isBluetoothMode) {
                if (webrtcActionArea) {
                    webrtcActionArea.style.display = 'none';
                }
                if (hostCard) {
                    hostCard.classList.remove('active');
                }
                if (joinCard) {
                    joinCard.classList.remove('active');
                }
                if (hostArea) {
                    hostArea.style.display = 'none';
                }
                if (joinArea) {
                    joinArea.style.display = 'none';
                }
                setJoinerSetupLocked(false);
                bluetoothSession.hostConfig = null;
            }

            updateGamePaceUI();
        }

        function startGame() {
            const gameMode = document.getElementById('gameMode').value;
            const selectedGridSize = normalizeGridSize(document.getElementById('gridSize')?.value ?? 8);
            const gameOptions = getGameOptionsFromSetup();
            const blitzSuffix = gameOptions.blitzEnabled ? ` | Blitz ${gameOptions.blitzTurnSeconds}s` : '';
            const obstaclesSuffix = gameOptions.obstacleEnabled ? ' | Obstacles' : '';
            if (gameMode === 'bluetooth') {
                showError('Utilisez les boutons WebRTC pour lancer la partie.');
                return;
            }

            const players = [];
            if (gameMode === 'ai') {
                players.push({
                    name: getPlayerName('player1Name', 'Joueur 1'),
                    color: getPlayerColor('player1Color', '#328DCB')
                });
                players.push({
                    name: 'IA',
                    color: '#FF4081'
                });

                showGameView();

                const difficulty = document.getElementById('aiDifficulty').value;
                window.game = new Game(players, true, selectedGridSize, gameOptions);
                window.game.ai.difficulty = difficulty;
                showToast(
                    `Partie contre IA (${difficulty}) lancee (${selectedGridSize}x${selectedGridSize}${blitzSuffix}${obstaclesSuffix}).`,
                    'success'
                );
                return;
            }

            const playerCount = parseInt(gameMode, 10);
            for (let i = 1; i <= playerCount; i++) {
                players.push({
                    name: getPlayerName(`player${i}Name`, `Joueur ${i}`),
                    color: getPlayerColor(`player${i}Color`, '#328DCB')
                });
            }

            showGameView();
            window.game = new Game(players, false, selectedGridSize, gameOptions);
            showToast(`Partie lancee (${selectedGridSize}x${selectedGridSize}${blitzSuffix}${obstaclesSuffix}).`, 'success');
        }

        function undoLastMove() {
            if (!window.game || moveHistory.length === 0) {
                return;
            }
            if (bluetoothConnection) {
                showError('Annulation indisponible en mode WebRTC.');
                return;
            }

            const previousState = moveHistory.pop();
            window.game.restoreSnapshot(previousState);
            const undoButton = document.getElementById('undoButton');
            if (undoButton) {
                undoButton.disabled = moveHistory.length === 0;
            }
            showToast('Dernier coup annule.', 'info');
        }

        async function requestGameResync() {
            if (!bluetoothConnection) {
                showToast('Resync disponible uniquement en mode WebRTC.', 'info');
                return;
            }
            if (!connectionStatus.connected) {
                showToast('Connexion non etablie.', 'error');
                return;
            }

            if (isHost) {
                const gameState = getGameState();
                if (!gameState) {
                    showToast('Etat de partie indisponible.', 'info');
                    return;
                }
                await sendBluetoothData({
                    type: 'sync',
                    gameState
                });
                showToast('Synchronisation envoyee.', 'success');
                return;
            }

            await sendBluetoothData({ type: 'requestSync' });
            showToast('Resynchronisation demandee a l hote.', 'info');
        }

        function manualReconnect() {
            if (!bluetoothConnection) {
                showToast('Reconnect disponible uniquement en mode WebRTC.', 'info');
                return;
            }
            if (connectionStatus.connecting || connectionStatus.reconnecting || reconnectInProgress) {
                showToast('Reconnexion deja en cours.', 'info');
                return;
            }
            if (connectionStatus.connected) {
                showToast('Connexion deja active.', 'success');
                return;
            }

            handleDisconnection();
        }

        function showRules() {
            const modal = document.getElementById('rulesModal');
            if (!modal) return;
            modal.classList.remove('hidden');
            modal.classList.add('active');
        }

        function hideRules() {
            const modal = document.getElementById('rulesModal');
            if (!modal) return;
            modal.classList.remove('active');
            modal.classList.add('hidden');
        }

        function confirmRestart() {
            const modal = document.getElementById('confirmModal');
            if (!modal) return;
            modal.classList.remove('hidden');
            modal.classList.add('active');
        }

        function hideConfirmModal() {
            const modal = document.getElementById('confirmModal');
            if (!modal) return;
            modal.classList.remove('active');
            modal.classList.add('hidden');
        }

        function restartGame() {
            hideConfirmModal();
            location.reload();
        }

        function toggleSound() {
            soundEnabled = !soundEnabled;
            const soundButton = document.getElementById('soundButton');
            if (!soundButton) return;
            soundButton.textContent = soundEnabled ? 'Son: ON' : 'Son: OFF';
            showToast(soundEnabled ? 'Son active.' : 'Son desactive.', 'info');
        }

        function playSound(type) {
            if (!soundEnabled) return;
            try {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) return;
                if (!window.gameAudioContext) {
                    window.gameAudioContext = new AudioContextClass();
                }

                const context = window.gameAudioContext;
                if (context.state === 'suspended') {
                    context.resume();
                }

                const now = context.currentTime;
                const oscillator = context.createOscillator();
                const gainNode = context.createGain();

                const isComplete = type === 'complete';
                const isTimeout = type === 'timeout';
                const isWarning = type === 'warning';
                const isSlide = type === 'shift_slide';
                const isImpact = type === 'shift_impact';
                const isCombo = type === 'combo';

                let duration = 0.1;
                if (isTimeout) duration = 0.22;
                else if (isComplete) duration = 0.16;
                else if (isWarning) duration = 0.15;
                else if (isSlide) duration = 0.6;
                else if (isImpact) duration = 0.2;
                else if (isCombo) duration = 0.4;

                oscillator.type = isTimeout ? 'sawtooth' : (isComplete ? 'triangle' : (isWarning ? 'sine' : (isSlide ? 'sine' : (isImpact ? 'sine' : (isCombo ? 'triangle' : 'sine')))));

                if (isSlide) {
                    oscillator.frequency.setValueAtTime(200, now);
                    oscillator.frequency.exponentialRampToValueAtTime(600, now + duration);
                } else if (isImpact) {
                    oscillator.frequency.setValueAtTime(150, now);
                    oscillator.frequency.exponentialRampToValueAtTime(40, now + 0.1);
                } else if (isCombo) {
                    oscillator.frequency.setValueAtTime(523.25, now); // C5
                    oscillator.frequency.setValueAtTime(659.25, now + 0.1); // E5
                    oscillator.frequency.setValueAtTime(783.99, now + 0.2); // G5
                } else {
                    oscillator.frequency.setValueAtTime(isTimeout ? 360 : (isComplete ? 620 : (isWarning ? 150 : 420)), now);
                    oscillator.frequency.exponentialRampToValueAtTime(
                        isTimeout ? 180 : (isComplete ? 900 : (isWarning ? 100 : 310)),
                        now + 0.08
                    );
                }

                gainNode.gain.setValueAtTime(0.0001, now);
                if (isSlide) {
                    gainNode.gain.exponentialRampToValueAtTime(0.05, now + 0.1);
                    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
                } else if (isImpact) {
                    gainNode.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
                    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
                } else {
                    gainNode.gain.exponentialRampToValueAtTime(isWarning ? 0.1 : 0.16, now + 0.01);
                    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
                }

                oscillator.connect(gainNode);
                gainNode.connect(context.destination);
                oscillator.start(now);
                oscillator.stop(now + duration);
            } catch (_error) {
                // Ignore audio errors silently.
            }
        }

        function showToast(message, type = 'info', duration = 2200) {
            const container = document.getElementById('toastContainer');
            if (!container || !message) return;

            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;
            container.appendChild(toast);

            requestAnimationFrame(() => {
                toast.classList.add('show');
            });

            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 220);
            }, duration);
        }

        function initializeGlobalUI() {
            const soundButton = document.getElementById('soundButton');
            if (soundButton) {
                soundButton.textContent = soundEnabled ? 'Son: ON' : 'Son: OFF';
            }

            document.querySelectorAll('.modal').forEach((modal) => {
                modal.addEventListener('click', (event) => {
                    if (event.target !== modal) return;
                    if (modal.id === 'rulesModal') {
                        hideRules();
                    } else if (modal.id === 'confirmModal') {
                        hideConfirmModal();
                    }
                });
            });

            document.addEventListener('keydown', (event) => {
                if (event.key !== 'Escape') return;
                hideRules();
                hideConfirmModal();
                document.querySelectorAll('.modal.active').forEach((modal) => {
                    if (modal.id !== 'rulesModal' && modal.id !== 'confirmModal') {
                        modal.remove();
                    }
                });
            });
        }

        document.addEventListener('DOMContentLoaded', () => {
            ensureHiddenPlayerConfigInputs();
            loadBluetoothStatusCollapsedPreference();
            loadSetupPreferences();
            updatePlayerCards();
            const setupNameInput = document.getElementById('player1Name');
            if (setupNameInput) {
                setupNameInput.addEventListener('input', () => syncLobbyPlayerName(setupNameInput.value, true));
                syncLobbyPlayerName(setupNameInput.value, true);
            }
            initializeGlobalUI();
            ensureSignalingUrlInputDefault();
            applyWebRTCParamsFromUrl();
            initializeSetupPreferencePersistence();
            updateConnectionStatus({
                connected: false,
                connecting: false,
                reconnecting: false,
                error: null,
                sessionCode: null,
                sessionVerified: false,
                latencyMs: null,
                latencyQuality: 'unknown',
                reconnectAttempt: 0,
                reconnectTotal: 0,
                nextRetryInMs: 0,
                statusDetail: ''
            });
            updateWebRTCActionButtons();
            saveSetupPreferences();
        });
        function triggerConfetti(x, y, color) {
            const particleCount = 20;
            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                particle.className = 'confetti';
                particle.style.setProperty('--c-color', color);
                particle.style.left = `${x}px`;
                particle.style.top = `${y}px`;

                const angle = Math.random() * Math.PI * 2;
                const velocity = 40 + Math.random() * 80;
                const dx = Math.cos(angle) * velocity;
                const dy = Math.sin(angle) * velocity - 40;

                particle.style.setProperty('--dx', `${dx}px`);
                particle.style.setProperty('--dy', `${dy}px`);

                document.body.appendChild(particle);

                setTimeout(() => particle.remove(), 800);
            }
        }

        const themeToggle = document.getElementById('themeToggle');
        const themeIcon = document.getElementById('themeIcon');

        function setTheme(isDark) {
            document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
            themeIcon.innerHTML = isDark
                ? '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>'
                : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        }

        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                setTheme(!isDark);
            });
        }

        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            setTheme(true);
        }
    
