// ai_learner.js — AI Learning & Parameter Optimization Module
// Load this before the main script in index.html

// ======================== 1. PARAM CONFIG ========================
const DEFAULT_PARAMS = {
    version: 3,
    weights: {
        playPower: 1.0, isBomb: -30, isRocket: -50,
        remainTotal: -2, remainSingle: -1.5, remainPair: -2,
        remainTriple: -4, remainBomb: 15, remainMaxStraight: 3,
        remainBigCards: 1, hasRocket: 10, isLandlord: 5, isFarmer: 0,
        opponentHandCount: -1, partnerHandCount: 3, outsideBombCount: -5,
        isCritical: 40, needBeat: 25
    },
    evalCoeffs: {
        bomb: 50, triple: 10, pair: 3,
        bothJokers: 50, bigJokerOnly: 18, smallJokerOnly: 10,
        ace: 9, king: 7, queen: 5, straightLenFactor: 4,
        singlePenalty: -3, pairExtra: 2, tripleExtra: 3,
        bombOutsideBonus: 8, position2Bonus: 8, landlordBonus: 20
    },
    callThresholds: {
        easy: { one: 28 },
        medium: { one: 22, two: 32, three: 42 },
        hard: { one: 20, two: 30, three: 42, bombBonus: 20, bothJokersBonus: 20, singlePenaltyFactor: 3, positionBonus: 8 },
        grandmaster: { one: 20, two: 30, three: 42, bombBonus: 20, bothJokersBonus: 20, singlePenaltyFactor: 3, positionBonus: 8 },
        legendary: null
    },
    endgameThresholds: { legendary: 14, grandmaster: 12, hard: 10, medium: 10, easy: 10 },
    mcts: {
        ucbC: 1.4,
        iterations: { legendary: 10000, grandmaster: 3000, hard: 1000, medium: 0, easy: 0 },
        handLimit: { legendary: 17, grandmaster: 14, hard: 12, medium: 0, easy: 0 },
        timeLimit: 3000
    },
    simulation: {
        depth: { legendary: 2, grandmaster: 1, hard: 1, medium: 0, easy: 0 },
        handLimit: { legendary: 17, grandmaster: 15, hard: 15, medium: 0, easy: 0 },
        dpBonusFactor: { legendary: 0.3 },
        oppSampleSize: { depth1: 8, depth2: 15 }
    },
    randomFactors: { legendary: 0, grandmaster: 0.05, hard: 0.1, medium: 0.3, easy: 0.6 },
    playHeuristics: {
        partnerPlay: { handLe3: -200, lastPowerGe40: -80, lastPowerLe20: -50 },
        lordBeatPartner: { needBeat: 80, handLe4: 120 },
        farmerAssist: { partnerHandLe2PlayLe2: 60 },
        farmerBeatSmallSingle: { diffLe3: 40 },
        needBeatLastHighRemain: { lastPowerGe13: -40 },
        landlordLeadSingle: { le6: 20 },
        suppressSingle: { diffLe4: 80, diffLe7: 50, diffLe10: -20, diffGt10: -40 },
        suppressPair: { diffLe4: 60, diffLe7: 35, diffLe10: -10, diffGt10: -30 },
        farmerOppLowCards: { handLe6LastPowerLe10: 100 },
        farmerVsLord: { lastPowerLe8: 40, lastPowerLe11: 20 },
        landlordLeadLowPower: { powerLe6: 30, powerGe12: -40 },
        farmerLeadHigh: { powerGe12: -40, power1114PartnerLe4: -60 },
        bombUrgent: { oppAboutToWin: 150, landlordRemainLe4: 120, remainLe2: 200 },
        bombStrategic: { fewOutside: 40, rocketBonus: 30 },
        bombWasted: { lowLastPower: -120, highLastPower: -60, notCritical: -80 },
        nearWin: { remainLe3: 100 },
        kickerPenalty: { ge11: -60, ge13: -100, hasSmallerAlternative: -120 },
        overkill: { singleLe12: -250, pairLe10: -200 }
    },
    passScores: {
        farmerPartnerBase: 200, farmerPartnerHandLe3: -50,
        lordHandLe2: -999, lordHandLe4: -150, lordHandGt4: 20,
        landlordFarmerPlayed: -50, landlordFarmerHandLe3: -200,
        passCountGe1: -40
    },
    selectLead: {
        landlord: {
            bombPenalty: 100, longGte5: 20, longGte3: 10, pairPlay: 5,
            straightBonus: 15, straightPairBonus: 10, tripleWithBonus: 8,
            planeBonus: 12, planeWithBonus: 10,
            smallValLe6: 15, controlValGe12LenLe2: 30
        },
        farmer: {
            bombPenalty: -200, comboGte3: 10, partnerLow: 50, lordNext: 10
        }
    },
    dpScores: {
        rocket: 60, bomb: 50, straight: 30, straightLenFactor: 2,
        straightPair: 25, straightPairLenFactor: 2, tripleWith: 20,
        plane: 40, planeLenFactor: 3, planeWith: 30,
        pair: 5, triple: 8, single: -5, completeBonus: 100
    },
    heuristicPlayout: {
        bestProb: 0.80, top2Prob: 0.95, stepLimit: 60
    },
    endgame: {
        maxDepth: 20, bombDepthPenalty: 1
    },
        aiTiming: {
            thinkingSeconds: { legendary: 4, grandmaster: 3, hard: 2, medium: 2, easy: 2 },
            delayMs: { fast: 300, normal: 700, slow: 1200 }
        },
    analysis: {
        maxGames: -1,
        deterministic: true,
        minGameInterval: 2000
    }
};

const ParamConfig = {
    _overrides: null,
    _defaults: DEFAULT_PARAMS,

    init() {
        let saved = localStorage.getItem('landlord_ai_params');
        if (saved) {
            try {
                let data = JSON.parse(saved);
                if (data.version === this._defaults.version) {
                    this._overrides = data;
                    return;
                }
            } catch (e) {}
        }
        this._overrides = null;
    },

    get(path) {
        let parts = path.split('.');
        let val = this._overrides;
        if (val) {
            for (let p of parts) { if (val && typeof val === 'object') val = val[p]; else { val = undefined; break; } }
            if (val !== undefined) return val;
        }
        val = this._defaults;
        for (let p of parts) { val = val[p]; if (val === undefined) break; }
        return val;
    },

    getNested(category, key) {
        let cat = this.get(category);
        return cat && typeof cat === 'object' ? cat[key] : undefined;
    },

    set(path, value) {
        if (!this._overrides) {
            this._overrides = JSON.parse(JSON.stringify(this._defaults));
        }
        let parts = path.split('.');
        let obj = this._overrides;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
            obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
        this._persist();
    },

    export() {
        let base = this._overrides ? this._overrides : this._defaults;
        return JSON.stringify(base, null, 2);
    },

    import(jsonStr) {
        try {
            let data = JSON.parse(jsonStr);
            if (!data.version) data.version = this._defaults.version;
            this._overrides = data;
            this._persist();
            return true;
        } catch (e) {
            return false;
        }
    },

    reset() {
        this._overrides = null;
        localStorage.removeItem('landlord_ai_params');
    },

    _persist() {
        if (this._overrides) {
            localStorage.setItem('landlord_ai_params', JSON.stringify(this._overrides));
        } else {
            localStorage.removeItem('landlord_ai_params');
        }
        if (typeof window !== 'undefined' && window.AiWorkerPool && window.AiWorkerPool.ready) {
            try {
                let params = this._overrides ? this._overrides : null;
                let msg = { cmd: 'init' };
                if (params) msg.params = params;
                for (let w of window.AiWorkerPool.workers) {
                    if (w._ready && !w._dead) w.postMessage(msg);
                }
            } catch (e) {}
        }
    }
};

// ======================== 2. GAME DATABASE (IndexedDB) ========================
const GameDatabase = {
    db: null,
    DB_NAME: 'ddz_ai_db',
    DB_VERSION: 4,
    STORE_NAME: 'games',
    ANALYSIS_STORE: 'analysis',
    CORRECTIONS_STORE: 'corrections',
    _initPromise: null,

    open() {
        if (this._initPromise) return this._initPromise;
        this._initPromise = new Promise((resolve, reject) => {
            if (!window.indexedDB) { resolve(null); return; }
            let req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            req.onupgradeneeded = (e) => {
                let db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    let store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('difficulty', 'difficulty', { unique: false });
                    store.createIndex('result', 'result.isPlayerWin', { unique: false });
                }
                if (!db.objectStoreNames.contains(this.ANALYSIS_STORE)) {
                    let analysisStore = db.createObjectStore(this.ANALYSIS_STORE, { keyPath: 'gameId' });
                    analysisStore.createIndex('timestamp', 'timestamp', { unique: false });
                    analysisStore.createIndex('mistakeCount', 'mistakeCount', { unique: false });
                }
                if (!db.objectStoreNames.contains(this.CORRECTIONS_STORE)) {
                    let correctionsStore = db.createObjectStore(this.CORRECTIONS_STORE, { keyPath: 'id', autoIncrement: true });
                    correctionsStore.createIndex('timestamp', 'ts', { unique: false });
                }
            };
            req.onsuccess = (e) => { this.db = e.target.result; resolve(this.db); };
            req.onerror = (e) => { console.warn('IndexedDB open failed:', e); resolve(null); };
        });
        return this._initPromise;
    },

    save(record) {
        return this.open().then(db => {
            if (!db) return false;
            return new Promise((resolve) => {
                try {
                    let tx = db.transaction(this.STORE_NAME, 'readwrite');
                    let store = tx.objectStore(this.STORE_NAME);
                    store.add(record);
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                } catch (e) { resolve(false); }
            });
        });
    },

    saveAnalysis(gameId, analysis) {
        return this.open().then(db => {
            if (!db) return false;
            return new Promise((resolve) => {
                try {
                    let tx = db.transaction(this.ANALYSIS_STORE, 'readwrite');
                    let store = tx.objectStore(this.ANALYSIS_STORE);
                    store.put({ gameId, ...analysis });
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                } catch (e) { resolve(false); }
            });
        });
    },

    getAnalysis(gameId) {
        return this.open().then(db => {
            if (!db) return null;
            return new Promise((resolve) => {
                try {
                    let tx = db.transaction(this.ANALYSIS_STORE, 'readonly');
                    let store = tx.objectStore(this.ANALYSIS_STORE);
                    let req = store.get(gameId);
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => resolve(null);
                } catch (e) { resolve(null); }
            });
        });
    },

    getAllAnalysis() {
        return this.open().then(db => {
            if (!db) return [];
            return new Promise((resolve) => {
                try {
                    let tx = db.transaction(this.ANALYSIS_STORE, 'readonly');
                    let store = tx.objectStore(this.ANALYSIS_STORE);
                    let req = store.getAll();
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => resolve([]);
                } catch (e) { resolve([]); }
            });
        });
    },

    getRecent(limit = 50, offset = 0) {
        return this.open().then(db => {
            if (!db) return [];
            return new Promise((resolve) => {
                try {
                    let tx = db.transaction(this.STORE_NAME, 'readonly');
                    let store = tx.objectStore(this.STORE_NAME);
                    let idx = store.index('timestamp');
                    let req = idx.openCursor(null, 'prev');
                    let results = [], pos = 0;
                    req.onsuccess = (e) => {
                        let cursor = e.target.result;
                        if (cursor && results.length < limit) {
                            if (pos >= offset) results.push(cursor.value);
                            pos++;
                            cursor.continue();
                        } else { resolve(results); }
                    };
                    req.onerror = () => resolve([]);
                } catch (e) { resolve([]); }
            });
        });
    },

    getAll() {
        return this.open().then(db => {
            if (!db) return [];
            return new Promise((resolve) => {
                try {
                    let tx = db.transaction(this.STORE_NAME, 'readonly');
                    let store = tx.objectStore(this.STORE_NAME);
                    let req = store.getAll();
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => resolve([]);
                } catch (e) { resolve([]); }
            });
        });
    },

    get(id) {
        return this.open().then(db => {
            if (!db) return null;
            return new Promise((resolve) => {
                try {
                    let tx = db.transaction(this.STORE_NAME, 'readonly');
                    let store = tx.objectStore(this.STORE_NAME);
                    let req = store.get(id);
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => resolve(null);
                } catch (e) { resolve(null); }
            });
        });
    },

    count() {
        return this.open().then(db => {
            if (!db) return 0;
            return new Promise((resolve) => {
                try {
                    let tx = db.transaction(this.STORE_NAME, 'readonly');
                    let store = tx.objectStore(this.STORE_NAME);
                    let req = store.count();
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => resolve(0);
                } catch (e) { resolve(0); }
            });
        });
    },

    deleteOldest(n) {
        return this.open().then(db => {
            if (!db) return;
            return new Promise((resolve) => {
                try {
                    let tx = db.transaction(this.STORE_NAME, 'readwrite');
                    let store = tx.objectStore(this.STORE_NAME);
                    let idx = store.index('timestamp');
                    let req = idx.openCursor(null, 'next');
                    let deleted = 0;
                    req.onsuccess = (e) => {
                        let cursor = e.target.result;
                        if (cursor && deleted < n) {
                            store.delete(cursor.primaryKey);
                            deleted++;
                            cursor.continue();
                        } else { resolve(); }
                    };
                    req.onerror = () => resolve();
                } catch (e) { resolve(); }
            });
        });
    },

    deleteAll() {
        return this.open().then(db => {
            if (!db) return;
            return new Promise((resolve) => {
                try {
                    let tx = db.transaction([this.STORE_NAME, this.ANALYSIS_STORE, this.CORRECTIONS_STORE], 'readwrite');
                    tx.objectStore(this.STORE_NAME).clear();
                    tx.objectStore(this.ANALYSIS_STORE).clear();
                    tx.objectStore(this.CORRECTIONS_STORE).clear();
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => resolve();
                } catch (e) { resolve(); }
            });
        });
    },

    saveCorrection(entry) {
        return this.open().then(db => {
            if (!db) return false;
            return new Promise((resolve) => {
                try {
                    let tx = db.transaction(this.CORRECTIONS_STORE, 'readwrite');
                    let store = tx.objectStore(this.CORRECTIONS_STORE);
                    store.add(entry);
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                } catch (e) { resolve(false); }
            });
        });
    },

    getRecentCorrections(limit = 50) {
        return this.open().then(db => {
            if (!db) return [];
            return new Promise((resolve) => {
                try {
                    let tx = db.transaction(this.CORRECTIONS_STORE, 'readonly');
                    let store = tx.objectStore(this.CORRECTIONS_STORE);
                    let idx = store.index('timestamp');
                    let req = idx.openCursor(null, 'prev');
                    let results = [];
                    req.onsuccess = (e) => {
                        let cursor = e.target.result;
                        if (cursor && results.length < limit) {
                            results.push(cursor.value);
                            cursor.continue();
                        } else { resolve(results); }
                    };
                    req.onerror = () => resolve([]);
                } catch (e) { resolve([]); }
            });
        });
    },

    countCorrections() {
        return this.open().then(db => {
            if (!db) return 0;
            return new Promise((resolve) => {
                try {
                    let tx = db.transaction(this.CORRECTIONS_STORE, 'readonly');
                    let store = tx.objectStore(this.CORRECTIONS_STORE);
                    let req = store.count();
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => resolve(0);
                } catch (e) { resolve(0); }
            });
        });
    }
};

// ======================== 3. GAME RECORDER ========================
const GameRecorder = {
    currentGame: null,
    _hooksInstalled: false,
    _callReasoning: null,

    installHooks() {
        if (this._hooksInstalled) return;
        this._hooksInstalled = true;
        let self = this;

        let origStartCallPhase = window.startCallPhase;
        if (origStartCallPhase) {
            window._origStartCallPhase = origStartCallPhase;
            window.startCallPhase = function() {
                self.startGame(GameState);
                origStartCallPhase();
            };
        }

        let origCallScore = window.callScore;
        if (origCallScore) {
            window._origCallScore = origCallScore;
            window.callScore = function(score) {
                if (GameState.phase === 'calling') {
                    self.recordCall(GameState.currentPlayer, score);
                }
                origCallScore(score);
            };
        }

        let origBecomeLandlord = window.becomeLandlord;
        if (origBecomeLandlord) {
            window._origBecomeLandlord = origBecomeLandlord;
            window.becomeLandlord = function() {
                origBecomeLandlord();
                if (GameState.landlord >= 0) {
                    self.recordLandlord(GameState.landlord);
                }
            };
        }

        let origExecutePlayCards = window.executePlayCards;
        if (origExecutePlayCards) {
            window._origExecutePlayCards = origExecutePlayCards;
            window.executePlayCards = function(player, cards) {
                if (GameState.phase === 'playing') {
                    self.recordAction(player, cards);
                }
                return origExecutePlayCards(player, cards);
            };
        }

        let origEndGame = window.endGame;
        if (origEndGame) {
            window._origEndGame = origEndGame;
            window.endGame = function(winner) {
                self.endGameResult(winner);
                return origEndGame(winner);
            };
        }
    },

    startGame(state) {
        if (!state || state.mode !== 'single') return;
        let safePlayers = state.players.map(p =>
            p.map(c => ({ id: c.id, suit: c.suit, rank: c.rank, value: c.value }))
        );
        this.currentGame = {
            id: 'game_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
            timestamp: Date.now(),
            mode: state.mode,
            difficulty: state.difficulty,
            paramVersion: ParamConfig.get('version'),
            initialDeal: {
                players: safePlayers,
                lordCards: []
            },
            calling: { order: [], scores: {}, landlord: -1 },
            actions: [],
            result: null,
            analysed: false
        };
    },

    recordCall(player, score) {
        if (!this.currentGame) return;
        this.currentGame.calling.order.push(player);
        this.currentGame.calling.scores[player] = score;
        let reasoning = window.__lastAICallReasoning;
        if (reasoning && reasoning.player === player) {
            if (!this.currentGame.calling.reasoning) this.currentGame.calling.reasoning = {};
            this.currentGame.calling.reasoning[player] = { strength: reasoning.strength, decision: reasoning.decision };
        }
    },

    recordLandlord(player) {
        if (!this.currentGame) return;
        this.currentGame.calling.landlord = player;
        let gs = GameState;
        if (gs && gs.lordCards) {
            this.currentGame.initialDeal.lordCards = gs.lordCards.map(c => ({ id: c.id, suit: c.suit, rank: c.rank, value: c.value }));
        }
    },

    recordAction(player, cards) {
        if (!this.currentGame) return;
        let isPlay = cards && cards.length > 0;
        let action = {
            p: player,
            t: Date.now(),
            c: isPlay ? cards.map(c => ({ id: c.id, suit: c.suit, rank: c.rank, value: c.value })) : [],
            pass: !isPlay
        };
        let reasoning = window.__lastAIPlayReasoning;
        if (reasoning && reasoning.player === player && reasoning.turn === this.currentGame.actions.length) {
            action.reasoning = {
                chosenScore: reasoning.chosenScore,
                candidates: reasoning.candidates
            };
            window.__lastAIPlayReasoning = null;
        }
        this.currentGame.actions.push(action);
    },

    endGameResult(winner) {
        if (!this.currentGame) return;
        let gs = GameState;
        if (!gs) return;
        let isPlayerWin = (gs.mode === 'single')
            ? ((winner === gs.myIndex) || (winner !== gs.myIndex && gs.landlord !== gs.myIndex && winner !== gs.landlord))
            : (winner === gs.myIndex);
        let isLordWin = (winner === gs.landlord);
        let isSpring = isLordWin && !gs.farmerPlayed && gs.firstPlayMade;
        let isAntiSpring = !isLordWin && gs.lordPlayCount === 1 && gs.firstPlayMade;
        let multiplier = gs.baseScore;
        if (isSpring || isAntiSpring) multiplier *= 2;

        this.currentGame.result = {
            winner,
            isPlayerWin,
            multiplier,
            bombCount: gs.bombCount,
            baseScore: gs.baseScore,
            isSpring,
            isAntiSpring
        };

        let game = this.currentGame;
        this.currentGame = null;
        GameDatabase.save(game).then(() => {
            GameAnalyzer.analyze(game);
            GodViewLearner.learn(game);
        }).then(() => {
            game.analysed = true;
        });
        ParameterOptimizer._onGameEnd(game);
    }
};

// ======================== 4. PARAMETER OPTIMIZER (DISABLED) ========================
// 已由 GodViewLearner（反事实学习）替代。保留结构避免引用错误。
const ParameterOptimizer = {
    _running: false,
    _onGameEnd() {},
    runDeepOptimization(_onProgress, onComplete) { if (onComplete) setTimeout(() => onComplete(false), 100); },
    getStats() { return { pendingGames: 0, running: false }; }
};

// ======================== 5. GAME ANALYZER ========================
const GameAnalyzer = {
    _running: false,
    _queue: [],

    analyze(game) {
        if (!game || !game.initialDeal || !game.actions || game.actions.length === 0) return;
        if (this._running) { this._queue.push(game); return; }
        this._running = true;
        setTimeout(() => this._runAnalysis(game), 500);
    },

    _runAnalysis(game) {
        try {
            let analysis = this._analyzeGame(game);
            GameDatabase.saveAnalysis(game.id, analysis).then(() => {
                CorrectionRules._learnFromAnalysis(game.id, analysis);
                this._running = false;
                if (this._queue.length > 0) this.analyze(this._queue.shift());
            });
        } catch (e) {
            console.warn('GameAnalyzer error:', e);
            this._running = false;
            if (this._queue.length > 0) this.analyze(this._queue.shift());
        }
    },

    _analyzeGame(game) {
        let initialDeal = game.initialDeal;
        let lordIdx = game.calling.landlord;
        if (lordIdx < 0) return { gameId: game.id, timestamp: game.timestamp, mistakeCount: 0, mistakes: [], wouldWinIfOptimal: false };

        // Rebuild initial hands
        let players = initialDeal.players.map(p => p.map(c => ({ ...c })));
        let lordCards = initialDeal.lordCards.map(c => ({ ...c }));
        players[lordIdx].push(...lordCards);
        players.forEach(p => p.sort((a, b) => a.value - b.value));

        let mistakes = [];
        let state = {
            players: players.map(p => [...p]),
            landlord: lordIdx,
            currentPlayer: 0,
            lastPlay: null,
            lastPlayerId: -1,
            passCount: 0,
            phase: 'playing',
            baseScore: game.result?.baseScore || 1,
            bombCount: game.result?.bombCount || 0
        };

        // Determine play order from calling
        let order = game.calling.order;
        state.currentPlayer = order.length > 0 ? order[0] : 0;

        // Replay and analyze each action
        let memory = new MasterMemory();
        for (let i = 0; i < game.actions.length; i++) {
            let action = game.actions[i];
            if (state.phase !== 'playing') break;
            if (state.players.some(p => p.length === 0)) break;

            // Only check AI decisions (players 1 and 2)
            if (action.p === 1 || action.p === 2) {
                let playerHand = state.players[action.p];
                if (playerHand && playerHand.length > 0) {
                    let m = this._checkDecision(state, action, playerHand, game.difficulty, memory);
                    if (m) {
                        m.turnIndex = i;
                        m.player = action.p;
                        mistakes.push(m);
                    }
                }
            }

            // Apply the actual action to advance state
            this._applyAction(state, action);
            if (!action.pass && action.c && action.c.length > 0) memory.record(action.c);
        }

        let wouldWinIfOptimal = false;
        if (mistakes.length > 0) {
            wouldWinIfOptimal = this._simulateOptimal(game, mistakes);
        }

        return {
            gameId: game.id,
            timestamp: game.timestamp,
            difficulty: game.difficulty,
            mistakeCount: mistakes.length,
            mistakes: mistakes.slice(0, 20),
            wouldWinIfOptimal,
            totalActions: game.actions.length
        };
    },

    _checkDecision(state, action, hand, difficulty, memory) {
        let lastPlay = state.lastPlay;
        let needBeat = lastPlay && state.lastPlayerId !== action.p;
        let role = action.p === state.landlord ? 'landlord' : 'farmer';
        let chosenCards = action.pass ? [] : action.c;

        if (!needBeat) return null;

        let allPlays = getAllValidPlays(hand, lastPlay);
        let beatable = allPlays.filter(p => canBeat(getCardType(p), lastPlay));

        if (beatable.length === 0 && action.pass) return null;

        // Score all options
        let scored = beatable.map(p => {
            let feat = extractPlayFeatures(p, hand, lastPlay, role, memory, { ...state, players: state.players.map(arr => [...arr]) });
            return { play: p, score: scorePlay(feat, role, memory, { ...state }, hand) };
        });
        scored.sort((a, b) => b.score - a.score);

        let chosenPlay = action.pass ? null : chosenCards;
        let chosenScore = chosenPlay ? (scored.find(s => {
            let ids1 = new Set(s.play.map(c => c.id));
            let ids2 = new Set(chosenPlay.map(c => c.id));
            if (ids1.size !== ids2.size) return false;
            return [...ids1].every(id => ids2.has(id));
        })?.score || -9999) : -1;

        // Check for mistakes
        let mistakes = [];

        // 1. Overkill: used bomb/rocket when smaller works
        if (chosenPlay) {
            let chosenType = getCardType(chosenPlay);
            if (chosenType && (chosenType.type === CardType.BOMB || chosenType.type === CardType.ROCKET)) {
                let hasCheaperBeat = scored.some(s => {
                    let t = getCardType(s.play);
                    return t && t.type !== CardType.BOMB && t.type !== CardType.ROCKET;
                });
                if (hasCheaperBeat) {
                    let cheaper = scored.find(s => {
                        let t = getCardType(s.play);
                        return t && t.type !== CardType.BOMB && t.type !== CardType.ROCKET;
                    });
                    mistakes.push({
                        severity: 'high',
                        category: 'overkill',
                        chosenType: chosenType.type,
                        reason: chosenType.type === CardType.ROCKET
                            ? '用王炸过度压制，可改用单张'
                            : '用炸弹过度压制，有更小牌型可用',
                        wouldWin: false
                    });
                }
            }

            // 2. High kicker waste
            if (chosenType && (chosenType.type === CardType.TRIPLE_WITH_SINGLE || chosenType.type === CardType.TRIPLE_WITH_PAIR)) {
                let cnt = countValues(chosenPlay.map(c => c.value));
                let target = chosenType.type === CardType.TRIPLE_WITH_SINGLE ? 1 : 2;
                let kickerVal = parseInt(Object.keys(cnt).find(k => cnt[k] === target && parseInt(k) !== chosenType.value)) || 0;
                if (kickerVal >= 11) {
                    let hasSmallerKicker = hand.some(c => c.value !== chosenType.value && c.value < kickerVal);
                    if (hasSmallerKicker) {
                        mistakes.push({
                            severity: 'medium',
                            category: 'high_kicker',
                            chosenType: chosenType.type,
                            reason: `三带中使用高牌(值=${kickerVal})做带牌，手上有更小牌可选`,
                            wouldWin: false
                        });
                    }
                }
            }
        }

        // 3. Pass when should beat (opponent about to win)
        if (action.pass) {
            let oppIdx = state.lastPlayerId;
            if (oppIdx >= 0 && state.players[oppIdx] && state.players[oppIdx].length <= 3 && beatable.length > 0) {
                mistakes.push({
                    severity: 'high',
                    category: 'bad_pass',
                    chosenType: 'pass',
                    reason: '对手剩余牌少，不应放过，有牌可压',
                    wouldWin: false
                });
            }
        }

        return mistakes.length > 0 ? mistakes[0] : null;
    },

    _applyAction(state, action) {
        if (action.pass) {
            state.passCount++;
            if (state.passCount >= 2) {
                state.lastPlay = null;
                state.lastPlayerId = -1;
                state.passCount = 0;
            }
        } else {
            let playIds = new Set(action.c.map(c => c.id));
            state.players[action.p] = state.players[action.p].filter(c => !playIds.has(c.id));
            state.lastPlay = getCardType(action.c.map(c => ({ ...c })));
            state.lastPlayerId = action.p;
            state.passCount = 0;
        }
        state.currentPlayer = (action.p + 1) % 3;
    },

    _simulateOptimal(game, mistakes) {
        if (!game.initialDeal) return false;
        let lordIdx = game.calling.landlord;
        if (lordIdx < 0) return false;
        let players = game.initialDeal.players.map(p => p.map(c => ({ ...c })));
        let lordCards = game.initialDeal.lordCards.map(c => ({ ...c }));
        players[lordIdx].push(...lordCards);
        players.forEach(p => p.sort((a, b) => a.value - b.value));

        let mem = new MasterMemory();
        let state = {
            players: players.map(p => [...p]),
            landlord: lordIdx,
            currentPlayer: game.actions[0]?.p || 0,
            lastPlay: null,
            lastPlayerId: -1,
            passCount: 0,
            phase: 'playing',
            baseScore: game.result?.baseScore || 1,
            bombCount: game.result?.bombCount || 0
        };

        let mistakeSet = new Set(mistakes.filter(m => m.severity === 'high').map(m => m.turnIndex));

        for (let i = 0; i < game.actions.length; i++) {
            if (state.players.some(p => p.length === 0)) break;
            let action = game.actions[i];

            if (mistakeSet.has(i) && (action.p === 1 || action.p === 2)) {
                let hand = state.players[action.p];
                let lastPlay = state.lastPlay;
                let needBeat = lastPlay && state.lastPlayerId !== action.p;
                if (needBeat && hand.length > 0) {
                    let role = action.p === state.landlord ? 'landlord' : 'farmer';
                    let allPlays = getAllValidPlays(hand, lastPlay);
                    let beatable = allPlays.filter(p => canBeat(getCardType(p), lastPlay));
                    if (beatable.length > 0) {
                        let scored = beatable.map(p => {
                            let feat = extractPlayFeatures(p, hand, lastPlay, role, mem, { ...state, players: state.players.map(arr => [...arr]) });
                            return { play: p, score: scorePlay(feat, role, mem, { ...state }, hand) };
                        });
                        scored.sort((a, b) => b.score - a.score);
                        let bestPlay = scored[0].play;
                        let playIds = new Set(bestPlay.map(c => c.id));
                        state.players[action.p] = state.players[action.p].filter(c => !playIds.has(c.id));
                        state.lastPlay = getCardType(bestPlay);
                        state.lastPlayerId = action.p;
                        state.passCount = 0;
                        state.currentPlayer = (action.p + 1) % 3;
                        continue;
                    }
                }
            }
            this._applyAction(state, action);
        }

        let lordWon = state.players[game.calling.landlord]?.length === 0;
        let farmerWon = state.players.some((p, idx) => p.length === 0 && idx !== game.calling.landlord);
        if (lordWon || farmerWon) {
            let simulationHumanWon = lordWon ? game.calling.landlord === 0 : game.calling.landlord !== 0;
            return simulationHumanWon && !game.result?.isPlayerWin;
        }
        return false;
    }
};

// ======================== 6. CORRECTION RULES ========================
const CorrectionRules = {
    _rules: [],
    _loaded: false,
    MAX_RULES: 50,
    MIN_CONFIDENCE: 0.5,

    init() {
        if (this._loaded) return;
        this._loaded = true;
        try {
            let saved = localStorage.getItem('landlord_correction_rules');
            if (saved) {
                let data = JSON.parse(saved);
                if (Array.isArray(data)) this._rules = data;
            }
        } catch (e) {}
    },

    _persist() {
        try {
            localStorage.setItem('landlord_correction_rules', JSON.stringify(this._rules));
        } catch (e) {}
        if (typeof window !== 'undefined' && window.AiWorkerPool && window.AiWorkerPool.ready) {
            try {
                let msg = { cmd: 'init', correctionRules: this._rules };
                for (let w of window.AiWorkerPool.workers) {
                    if (w._ready && !w._dead) w.postMessage(msg);
                }
            } catch (e) {}
        }
    },

    match(context) {
        this.init();
        let results = [];
        for (let rule of this._rules) {
            if (rule.confidence < this.MIN_CONFIDENCE) continue;
            if (this._ruleMatches(rule, context)) {
                results.push(rule);
            }
        }
        return results;
    },

    _ruleMatches(rule, ctx) {
        for (let key in rule.context) {
            let val = rule.context[key];
            if (val === true && !ctx[key]) return false;
            if (val === false && ctx[key]) return false;
            if (typeof val === 'number' && typeof ctx[key] === 'number') {
                if (rule.comparators && rule.comparators[key] === 'lte') {
                    if (ctx[key] > val) return false;
                } else if (rule.comparators && rule.comparators[key] === 'gte') {
                    if (ctx[key] < val) return false;
                } else {
                    if (ctx[key] !== val) return false;
                }
            }
            if (typeof val === 'string' && ctx[key] !== val) return false;
        }
        return true;
    },

    _learnFromAnalysis(gameId, analysis) {
        // Deprecated: 学习功能已由 GodViewLearner 接管
    },

    getStats() {
        this.init();
        let active = this._rules.filter(r => r.confidence >= this.MIN_CONFIDENCE).length;
        return { total: this._rules.length, active };
    }
};

// ======================== 7. TRUE SKILL LEARNER ========================
// 基于真实对局 replay + minimax/rollout 最优解搜索的权重学习引擎
const GodViewLearner = {
    _queue: [],
    _running: false,
    _adjustCount: 0,
    _ADJUST_INTERVAL: 1500,
    _lastAdjustTime: 0,
    _statsCache: { total: 0, recent20: 0, totalAdjustments: 0, avgDiff: 0 },

    _initCache() {
        GameDatabase.countCorrections().then(t => { this._statsCache.total = t; }).catch(()=>{});
        GameDatabase.getRecentCorrections(20).then(d => {
            if (d && d.length) {
                this._statsCache.recent20 = d.length;
                this._statsCache.avgDiff = d.reduce((s,c)=>s+c.diff,0)/d.length;
            }
        }).catch(()=>{});
    },

    // 权重表中与 extractPlayFeatures 字段名一致的键
    _WEIGHT_KEYS: [
        'playPower','isBomb','isRocket','remainTotal','remainSingle','remainPair',
        'remainTriple','remainBomb','remainMaxStraight','remainBigCards','hasRocket',
        'opponentHandCount','partnerHandCount','outsideBombCount','isCritical','needBeat'
    ],

    learn(game) {
        if (!game || !game.initialDeal || !game.actions || game.actions.length < 3) return;
        if (game.mode !== 'single') return;
        if (this._running) { this._queue.push(game); return; }
        this._running = true;
        let fn = () => this._run(game);
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(fn, { timeout: 4000 });
        } else {
            setTimeout(fn, 300);
        }
    },

    _run(game) {
        try {
            let stats = { checked: 0, corrected: 0, totalDelta: 0 };
            let corrections = this._analyzeGame(game, stats);
            if (corrections.length > 0) {
                this._saveCorrections(corrections);
                this._applyAdjustments(corrections, stats);
            }
            if (stats.corrected > 0) {
                ParamConfig._persist();
            }
        } catch (e) {
            console.warn('GodViewLearner error:', e.message);
        }
        this._running = false;
        if (this._queue.length > 0) this.learn(this._queue.shift());
    },

    _analyzeGame(game, stats) {
        let lordCards = game.initialDeal.lordCards.map(c => ({...c}));
        let players = game.initialDeal.players.map(p => p.map(c => ({...c})));
        let lordIdx = game.calling.landlord;
        if (lordIdx < 0) return [];
        players[lordIdx].push(...lordCards);
        players.forEach(p => p.sort((a,b)=>a.value-b.value));

        let state = {
            players: players.map(p => [...p]),
            landlord: lordIdx,
            currentPlayer: game.actions[0]?.p || 0,
            lastPlay: null, lastPlayerId: -1, passCount: 0, phase: 'playing'
        };
        let corrections = [];
        let aiPlayers = [1, 2];

        for (let i = 0; i < game.actions.length; i++) {
            let action = game.actions[i];
            if (state.players.some(p => p.length === 0)) break;

            if (aiPlayers.includes(action.p)) {
                let hand = state.players[action.p];
                if (hand && hand.length > 0) {
                    stats.checked++;
                    let corr = this._checkCounterfactual(state, action, hand, lordIdx, i);
                    if (corr) { corrections.push(corr); stats.corrected++; stats.totalDelta += corr.diff; }
                }
            }
            this._advanceState(state, action);
        }
        return corrections;
    },

    _checkCounterfactual(state, action, hand, lordIdx, turnIdx) {
        let aiRole = action.p === lordIdx ? 'landlord' : 'farmer';
        let needBeat = state.lastPlay && state.lastPlayerId !== action.p;
        let isLead = !needBeat;

        let allPlays = getAllValidPlays(hand, needBeat ? state.lastPlay : null);
        if (!isLead && allPlays.length === 0) return null;

        // Step 1: Find optimal play + its win rate
        let opt = this._findOptimal(state, action.p, allPlays);
        let bestPlay = opt && opt.bestPlay ? opt.bestPlay : null;
        let bestWinRate = opt ? opt.bestWinRate : 0;

        // Step 2: If not lead, also evaluate "pass"
        let passWinRate = -1;
        if (!isLead) {
            let ps = JSON.parse(JSON.stringify(state));
            ps.passCount++;
            let pw = 0, pt = 6;
            for (let t = 0; t < pt; t++) {
                if (this._simulateGame(ps, (action.p+1)%3, action.p, lordIdx)) pw++;
            }
            passWinRate = pw / pt;
            if (passWinRate > bestWinRate + 0.05) {
                bestPlay = [];
                bestWinRate = passWinRate;
            }
        }

        // Step 3: Evaluate actual action's win rate
        let actualWinRate = this._evalPlay(state, action, action.p, lordIdx);

        // Step 4: Compare
        if (bestWinRate - actualWinRate < 0.20) return null;
        if (bestWinRate <= 0.3) return null;

        let actualPlay = action.pass ? [] : action.c;

        // Check they're truly different
        if (bestPlay.length === 0 && actualPlay.length === 0) return null;
        if (bestPlay.length > 0 && actualPlay.length > 0) {
            let ids1 = new Set(bestPlay.map(c => c.id));
            let ids2 = new Set(actualPlay.map(c => c.id));
            if (ids1.size === ids2.size && [...ids1].every(id => ids2.has(id))) return null;
        }

        let bestType = bestPlay.length > 0 ? getCardType(bestPlay) : null;
        let actualType = actualPlay.length > 0 ? getCardType(actualPlay) : null;

        // Step 5: Extract feature vectors for weight update
        let memory = new MasterMemory();
        let optFeat = null;
        if (bestPlay.length > 0) {
            optFeat = extractPlayFeatures(bestPlay, hand, state.lastPlay, aiRole, memory, state);
        }
        let actualFeat = null;
        if (actualPlay.length > 0) {
            actualFeat = extractPlayFeatures(actualPlay, hand, state.lastPlay, aiRole, memory, state);
        }

        return {
            turnIdx, player: action.p, role: aiRole,
            diff: bestWinRate - actualWinRate,
            bestWinRate, actualWinRate,
            handSize: hand.length,
            lordSize: state.players[lordIdx]?.length || 0,
            lastPlayType: state.lastPlay?.type || 'none', lastPlayPower: state.lastPlay?.value || 0,
            isLead,
            actualType: actualType?.type || 'pass', bestType: bestType?.type || 'pass',
            optFeat, actualFeat
        };
    },

    _findOptimal(state, playerId, allPlays) {
        let hand = state.players[playerId];
        if (!hand || hand.length === 0 || allPlays.length === 0) return null;
        let totalCards = state.players.reduce((s, p) => s + p.length, 0);

        // Phase 1: Exact minimax for small endgames (deterministic optimal)
        if (hand.length <= 14 && totalCards <= 20) {
            return this._solveExact(state, playerId, allPlays);
        }

        // Phase 2: Rollout-based approximation
        return this._solveRollout(state, playerId, allPlays);
    },

    _solveExact(state, playerId, allPlays) {
        let bestPlay = null, bestScore = -Infinity;
        for (let p of allPlays) {
            let simState = JSON.parse(JSON.stringify(state));
            let pIds = new Set(p.map(c => c.id));
            simState.players[playerId] = simState.players[playerId].filter(c => !pIds.has(c.id));
            if (simState.players[playerId].length === 0) {
                return { bestPlay: p, bestWinRate: 1.0 };
            }
            simState.lastPlay = getCardType(p);
            simState.lastPlayerId = playerId;
            simState.passCount = 0;
            let score = minimaxEndgame(simState, (playerId+1)%3, playerId, 0, 20);
            if (score > bestScore) { bestScore = score; bestPlay = p; }
        }
        if (bestPlay) {
            let wr = Math.max(0, Math.min(1, (bestScore + 100) / 200));
            return { bestPlay, bestWinRate: wr };
        }
        return null;
    },

    _solveRollout(state, playerId, allPlays) {
        let memory = new MasterMemory();
        let role = playerId === state.landlord ? 'landlord' : 'farmer';
        let scored = allPlays.map(p => {
            let feat = extractPlayFeatures(p, state.players[playerId], state.lastPlay, role, memory, state);
            return { play: p, score: scorePlay(feat, role, memory, state, state.players[playerId]) };
        });
        scored.sort((a, b) => b.score - a.score);
        let topN = Math.min(Math.min(8, scored.length), Math.max(3, Math.floor(scored.length * 0.3)));
        let bestPlay = null, bestWinRate = -1;

        for (let j = 0; j < topN; j++) {
            let play = scored[j].play;
            let ids = new Set(play.map(c => c.id));
            let simState = JSON.parse(JSON.stringify(state));
            simState.players[playerId] = simState.players[playerId].filter(c => !ids.has(c.id));
            simState.lastPlay = getCardType(play);
            simState.lastPlayerId = playerId;
            simState.passCount = 0;
            if (simState.players[playerId].length === 0) {
                return { bestPlay: play, bestWinRate: 1.0 };
            }
            let wins = 0, trials = 6;
            for (let t = 0; t < trials; t++) {
                if (this._simulateGame(simState, (playerId+1)%3, playerId, state.landlord)) wins++;
            }
            let wr = wins / trials;
            if (wr > bestWinRate) { bestWinRate = wr; bestPlay = play; }
        }
        if (bestPlay && bestWinRate >= 0) return { bestPlay, bestWinRate };
        return null;
    },

    _evalPlay(state, action, aiPlayerId, lordIdx) {
        let simState = JSON.parse(JSON.stringify(state));
        if (action.pass) {
            simState.passCount++;
        } else {
            let ids = new Set(action.c.map(c => c.id));
            simState.players[action.p] = simState.players[action.p].filter(c => !ids.has(c.id));
            simState.lastPlay = getCardType(action.c.map(c => ({...c})));
            simState.lastPlayerId = action.p;
            simState.passCount = 0;
        }
        if (simState.players[action.p].length === 0) return 1.0;
        let wins = 0, trials = 6;
        for (let t = 0; t < trials; t++) {
            if (this._simulateGame(simState, (action.p+1)%3, aiPlayerId, lordIdx)) wins++;
        }
        return wins / trials;
    },

    _simulateGame(startState, startPlayer, aiPlayerId, lordIdx) {
        let s = JSON.parse(JSON.stringify(startState));
        let cp = startPlayer;
        let limit = 50;
        for (let step = 0; step < limit; step++) {
            for (let i = 0; i < 3; i++) {
                if (s.players[i].length === 0) {
                    return aiPlayerId === lordIdx ? i === lordIdx : i !== lordIdx;
                }
            }
            if (s.passCount >= 2) { s.lastPlay = null; s.lastPlayerId = -1; s.passCount = 0; }
            let hand = s.players[cp];
            if (!hand || hand.length === 0) { cp = (cp+1)%3; continue; }
            let needBeat = s.lastPlay && s.lastPlayerId !== cp;
            let plays = needBeat ? getAllValidPlays(hand, s.lastPlay) : getAllValidPlays(hand, null);
            if (plays.length === 0) { s.passCount++; cp = (cp+1)%3; continue; }
            let role = cp === s.landlord ? 'landlord' : 'farmer';
            let mem = new MasterMemory();
            let scored = plays.map(p => {
                let feat = extractPlayFeatures(p, hand, s.lastPlay, role, mem, s);
                return { play: p, score: scorePlay(feat, role, mem, s, hand) };
            });
            scored.sort((a, b) => b.score - a.score);
            let chosen = scored[0].play;
            if (Math.random() < 0.12 && scored.length > 1 && scored[1].play.length > 0) {
                chosen = scored[1].play;
            }
            s.players[cp] = s.players[cp].filter(c => !chosen.includes(c));
            s.lastPlay = getCardType(chosen);
            s.lastPlayerId = cp;
            s.passCount = 0;
            cp = (cp+1)%3;
        }
        return false;
    },

    _advanceState(state, action) {
        if (action.pass) {
            state.passCount++;
            if (state.passCount >= 2) { state.lastPlay = null; state.lastPlayerId = -1; state.passCount = 0; }
        } else {
            let ids = new Set(action.c.map(c => c.id));
            state.players[action.p] = state.players[action.p].filter(c => !ids.has(c.id));
            state.lastPlay = getCardType(action.c.map(c => ({...c})));
            state.lastPlayerId = action.p;
            state.passCount = 0;
        }
        state.currentPlayer = (action.p + 1) % 3;
    },

    _saveCorrections(corrections) {
        let entries = corrections.map(c => ({...c, ts: Date.now()}));
        Promise.all(entries.map(e => GameDatabase.saveCorrection(e))).then(() => {
            GameDatabase.countCorrections().then(t => { this._statsCache.total = t; });
            GameDatabase.getRecentCorrections(20).then(d => {
                if (d && d.length) {
                    this._statsCache.recent20 = d.length;
                    this._statsCache.avgDiff = d.reduce((s,c)=>s+c.diff,0)/d.length;
                }
            });
        });
        this._statsCache.total += entries.length;
    },

    _applyAdjustments(corrections, stats) {
        let now = Date.now();
        if (now - this._lastAdjustTime < this._ADJUST_INTERVAL) return;
        this._lastAdjustTime = now;

        // 学习率随调整次数衰减
        let lr = 0.02 / (1 + 0.001 * this._adjustCount);
        if (lr < 0.001) return;

        let weightDeltas = {};
        let heuristicDeltas = {};

        for (let corr of corrections) {
            if (corr.diff < 0.25) continue;

            // --- A: 线性权重更新（成对特征差）---
            if (corr.optFeat && corr.actualFeat) {
                for (let key of this._WEIGHT_KEYS) {
                    let vOpt = corr.optFeat[key];
                    let vAct = corr.actualFeat[key];
                    if (vOpt === undefined || vAct === undefined) continue;
                    let delta = vOpt - vAct;
                    if (Math.abs(delta) < 0.01) continue;
                    if (!weightDeltas[key]) weightDeltas[key] = 0;
                    weightDeltas[key] += delta * lr;
                }
            }

            // --- B: 启发式惩罚调整 ---
            if (corr.actualType === 'pass' && corr.bestWinRate > 0.5 && corr.handSize >= 3) {
                heuristicDeltas['passScores.lordHandGt4'] = (heuristicDeltas['passScores.lordHandGt4'] || 0) - 3 * lr;
                heuristicDeltas['passScores.farmerPartnerBase'] = (heuristicDeltas['passScores.farmerPartnerBase'] || 0) - 3 * lr;
            }

            let isBombBest = corr.bestType === 'bomb' || corr.bestType === 'rocket';
            let isBombActual = corr.actualType === 'bomb' || corr.actualType === 'rocket';

            if (isBombBest && !isBombActual && corr.bestWinRate > 0.6) {
                heuristicDeltas['playHeuristics.bombUrgent.oppAboutToWin'] = (heuristicDeltas['playHeuristics.bombUrgent.oppAboutToWin'] || 0) + 8 * lr;
            }
            if (!isBombBest && isBombActual && corr.actualWinRate < 0.4) {
                heuristicDeltas['playHeuristics.bombWasted.lowLastPower'] = (heuristicDeltas['playHeuristics.bombWasted.lowLastPower'] || 0) - 5 * lr;
                heuristicDeltas['playHeuristics.bombWasted.highLastPower'] = (heuristicDeltas['playHeuristics.bombWasted.highLastPower'] || 0) - 5 * lr;
            }
        }

        // 应用权重更新
        for (let key in weightDeltas) {
            this._adjust('weights.' + key, weightDeltas[key]);
        }
        // 应用启发式更新
        for (let path in heuristicDeltas) {
            this._adjust(path, heuristicDeltas[path]);
        }

        let totalAdj = Object.keys(weightDeltas).length + Object.keys(heuristicDeltas).length;
        if (totalAdj > 0) {
            this._adjustCount++;
            this._statsCache.totalAdjustments = this._adjustCount;
        }
    },

    _adjust(path, delta) {
        if (Math.abs(delta) < 0.001) return;
        let current = ParamConfig.get(path);
        if (current === undefined || current === null) return;
        let minClamp = -500, maxClamp = 500;
        if (path.startsWith('passScores')) { minClamp = -999; maxClamp = 999; }
        let newVal = Math.max(minClamp, Math.min(maxClamp, current + delta));
        if (Math.abs(newVal - current) > 0.001) ParamConfig.set(path, Math.round(newVal * 10000) / 10000);
    },

    getStats() { return this._statsCache; },

    getRecentCorrections(limit) {
        return GameDatabase.getRecentCorrections(limit).then(d => d || []);
    }
};

// ======================== 10. PARAM EXPORTER + UI ========================
const ParamExporter = {
    _currentTab: 'params',

    showUI(tab) {
        let modal = document.getElementById('aiParamModal');
        if (tab) this._currentTab = tab;
        if (modal) {
            modal.classList.remove('hidden');
            this._refreshUI();
            return;
        }
        modal = document.createElement('div');
        modal.id = 'aiParamModal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:460px;max-height:80vh;overflow-y:auto;">
                <div class="flex gap-1 mb-4">
                    <button id="aiTabParams" class="pixel-btn ${this._currentTab==='params'?'bg-yellow-500':'bg-gray-600'} text-[10px] flex-1" onclick="ParamExporter.switchTab('params')">⚙ 参数</button>
                    <button id="aiTabGames" class="pixel-btn ${this._currentTab==='games'?'bg-yellow-500':'bg-gray-600'} text-[10px] flex-1" onclick="ParamExporter.switchTab('games')">🎮 记录</button>
                    <button id="aiTabRules" class="pixel-btn ${this._currentTab==='rules'?'bg-yellow-500':'bg-gray-600'} text-[10px] flex-1" onclick="ParamExporter.switchTab('rules')">📏 规则</button>
                    <button id="aiTabStats" class="pixel-btn ${this._currentTab==='stats'?'bg-yellow-500':'bg-gray-600'} text-[10px] flex-1" onclick="ParamExporter.switchTab('stats')">📊 战绩</button>
                    <button id="aiTabLearn" class="pixel-btn ${this._currentTab==='learn'?'bg-yellow-500':'bg-gray-600'} text-[10px] flex-1" onclick="ParamExporter.switchTab('learn')">🧠 学习</button>
                </div>
                <div id="aiParamContent"></div>
                <button onclick="document.getElementById('aiParamModal').classList.add('hidden')" class="pixel-btn bg-gray-500 text-[10px] w-full mt-2">关闭</button>
            </div>
        `;
        document.body.appendChild(modal);
        this._refreshUI();
    },

    switchTab(tab) {
        this._currentTab = tab;
        ['aiTabParams','aiTabGames','aiTabRules','aiTabStats','aiTabLearn'].forEach(id => {
            let btn = document.getElementById(id);
            if (btn) btn.className = `pixel-btn ${id.includes(tab)?'bg-yellow-500':'bg-gray-600'} text-[10px] flex-1`;
        });
        this._refreshUI();
    },

    _refreshUI() {
        let content = document.getElementById('aiParamContent');
        if (!content) return;
        if (this._currentTab === 'params') this._renderParamsTab(content);
        else if (this._currentTab === 'games') this._renderGamesTab(content);
        else if (this._currentTab === 'rules') this._renderRulesTab(content);
        else if (this._currentTab === 'stats') this._renderStatsTab(content);
        else if (this._currentTab === 'learn') this._renderLearnTab(content);
    },

    _renderParamsTab(container) {
        let isCustom = ParamConfig._overrides !== null;
        let ruleStats = CorrectionRules.getStats();
        let learnStats = GodViewLearner.getStats();
        container.innerHTML = `
            <div id="aiParamInfo" class="text-[10px] text-gray-300 mb-3 space-y-1">
                <div>📌 参数版本: v${ParamConfig.get('version')} ${isCustom ? '✨ 已自定义' : '📄 默认'}</div>
                <div>📏 纠错规则: ${ruleStats.active}/${ruleStats.total} 条生效</div>
                <div>🧠 反事实学习: ${learnStats.total} 次复盘 · ${learnStats.recent20} 近期修正</div>
            </div>
            <div class="flex flex-col gap-2">
                <button onclick="ParamExporter.copyToClipboard()" class="pixel-btn bg-blue-500 text-[10px] w-full">📋 复制参数 JSON</button>
                <button onclick="ParamExporter.downloadFile()" class="pixel-btn bg-green-500 text-[10px] w-full">💾 下载参数文件</button>
                <button onclick="ParamExporter.importFromClipboard()" class="pixel-btn bg-yellow-500 text-[10px] w-full">📂 从剪贴板导入</button>
                <button onclick="document.getElementById('aiParamFileInput').click()" class="pixel-btn bg-purple-500 text-[10px] w-full">📁 从文件导入</button>
                <input type="file" id="aiParamFileInput" accept=".json" style="display:none" onchange="ParamExporter.importFromFile(event)">
                <button onclick="ParamExporter.runDeepOptimization()" class="pixel-btn bg-red-500 text-[10px] w-full">⚡ 开始深度优化</button>
                <button onclick="ParamExporter.resetParams()" class="pixel-btn bg-gray-600 text-[10px] w-full">↩ 恢复默认参数</button>
            </div>
            <div id="aiParamProgress" class="hidden mt-3 text-[10px] text-center text-yellow-400"></div>
            <textarea id="aiParamTextArea" class="hidden" style="width:100%;height:100px;background:#1e1e2e;color:#aaa;border:1px solid #555;border-radius:4px;font-size:8px;margin-top:8px;padding:4px;"></textarea>
        `;
    },

    _renderGamesTab(container) {
        container.innerHTML = '<div class="text-[10px] text-gray-400 text-center py-4">⏳ 加载中...</div>';
        let limit = 50;
        GameDatabase.getRecent(limit).then(games => {
            if (!games || games.length === 0) {
                container.innerHTML = '<div class="text-[10px] text-gray-400 text-center py-4">暂无对局记录</div>';
                return;
            }
            let html = `<div class="flex justify-between mb-2">
                <span class="text-[10px] text-gray-400">最近 ${games.length} 局</span>
                <button onclick="ParamExporter._deleteAllGames()" class="text-[8px] text-red-400 underline">清空全部</button>
            </div>`;
            for (let g of games) {
                let resultIcon = g.result?.isPlayerWin ? '🎉' : '💔';
                let timeStr = new Date(g.timestamp).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
                let mistakeBadge = '';
                if (g.analysed && g.id) {
                    mistakeBadge = `<span class="text-yellow-400">📊</span>`;
                }
                html += `<div class="bg-gray-800/50 rounded p-2 mb-1 flex justify-between items-center text-[10px] cursor-pointer" onclick="ParamExporter._showGameDetail('${g.id}')">
                    <div>${resultIcon} ${g.difficulty} ${timeStr}</div>
                    <div class="text-gray-400">×${g.result?.multiplier || 1} ${mistakeBadge}</div>
                </div>`;
            }
            container.innerHTML = html;
        }).catch(() => {
            container.innerHTML = '<div class="text-[10px] text-gray-400 text-center py-4">加载失败</div>';
        });
    },

    _renderRulesTab(container) {
        CorrectionRules.init();
        let rules = CorrectionRules._rules;
        if (rules.length === 0) {
            container.innerHTML = '<div class="text-[10px] text-gray-400 text-center py-4">暂无纠错规则，完成对局后将自动生成</div>';
            return;
        }
        let html = `<div class="text-[10px] text-gray-400 mb-2">共 ${rules.length} 条规则（显示置信度 ≥ ${Math.round(CorrectionRules.MIN_CONFIDENCE*100)}% 的生效规则）</div>`;
        for (let r of rules) {
            let active = r.confidence >= CorrectionRules.MIN_CONFIDENCE;
            let categoryIcon = r.category === 'overkill' ? '💣' : r.category === 'high_kicker' ? '🃏' : r.category === 'bad_pass' ? '⏱' : '📋';
            html += `<div class="bg-gray-800/50 rounded p-2 mb-1 text-[9px] ${active?'border-l-2 border-green-500':'opacity-50'}">
                <div class="flex justify-between">
                    <span>${categoryIcon} ${r.reason}</span>
                    <span class="${active?'text-green-400':'text-gray-500'}">${Math.round(r.confidence*100)}%</span>
                </div>
                <div class="text-gray-500">触发${r.triggerCount}次 · 罚分 ${r.penalty}</div>
            </div>`;
        }
        html += `<button onclick="CorrectionRules._rules=[];CorrectionRules._persist();ParamExporter._refreshUI();" class="pixel-btn bg-red-500 text-[10px] w-full mt-2">🗑 清空全部规则</button>`;
        container.innerHTML = html;
    },

    _renderStatsTab(container) {
        let total = GameState.stats?.total || 0;
        let win = GameState.stats?.win || 0;
        let rate = total > 0 ? Math.round(win / total * 100) : 0;
        let coins = GameState.coins || 0;
        let html = `<div class="text-[10px] text-gray-300 mb-3 flex justify-between px-1">
            <span>🏆 ${win}/${total} (${rate}%)</span>
            <span>💰 ${coins}</span>
        </div>`;
        if (!matchHistory || matchHistory.length === 0) {
            html += '<div class="text-center text-gray-400 text-[10px] py-4">暂无对局记录</div>';
        } else {
            for (let rec of matchHistory) {
                let resultClass = rec.result === 'win' ? 'history-win' : 'history-lose';
                let deltaStr = rec.delta > 0 ? `+${rec.delta}` : `${rec.delta}`;
                html += `<div class="history-item ${resultClass} text-[10px]"><div>${rec.time}</div><div>${rec.result === 'win' ? '🎉 胜利' : '💔 失败'} (倍数:${rec.multiplier})</div><div>筹码变化: ${deltaStr} → ${rec.coinsAfter}</div></div>`;
            }
        }
        html += `<button onclick="clearHistory();ParamExporter._refreshUI();" class="pixel-btn bg-red-500 text-[10px] w-full mt-2">🗑 清空记录</button>`;
        container.innerHTML = html;
    },

    _renderLearnTab(container) {
        let stats = GodViewLearner.getStats();
        let adjTotal = ParamConfig._overrides ? ParamConfig.get('version') + stats.totalAdjustments : stats.totalAdjustments;
        container.innerHTML = `<div class="text-[10px] text-gray-300 mb-3 space-y-1">
            <div>📊 总复盘: ${stats.total} 次 · 修正 ${stats.recent20} 条</div>
            <div>⚡ 参数调整: ${stats.totalAdjustments} 次 · 平均差异 ${(stats.avgDiff*100).toFixed(0)}%</div>
            <div>🧠 特征权重: 线性更新 · 学习率 ${(0.02/(1+0.001*(stats.totalAdjustments||1))).toFixed(4)}</div>
        </div><div id="learnTabBody" class="text-center text-gray-400 text-[10px] py-4">⏳ 加载中...</div>
        <div class="text-[8px] text-gray-500 mt-2">每局结束后用 minimax/rollout 搜索最优解，基于特征差调整评分权重</div>`;
        GodViewLearner.getRecentCorrections(15).then(data => {
            let body = document.getElementById('learnTabBody');
            if (!body) return;
            if (!data || data.length === 0) {
                body.innerHTML = '暂无学习数据，完成对局后自动分析';
            } else {
                let html = '<div class="text-[10px] text-gray-500 mb-1">最近反事实分析：</div>';
                for (let c of data) {
                    let icon = c.diff > 0.5 ? '🔴' : '🟡';
                    let roleTag = c.role === 'landlord' ? '👑地主' : '🌾农民';
                    let detail = c.isLead
                        ? `先手应出 <b>${c.bestType}</b> 而非 ${c.actualType}`
                        : `拦截应出 <b>${c.bestType}</b> 而非 ${c.actualType}`;
                    html += `<div class="bg-gray-800/50 rounded p-1.5 mb-1 text-[9px]">${icon} P${c.player} ${roleTag} ${detail} (胜率差 ${Math.round(c.diff*100)}%)</div>`;
                }
                body.innerHTML = html;
            }
        });
    },

    _showGameDetail(gameId) {
        GameDatabase.getAnalysis(gameId).then(analysis => {
            GameDatabase.get(gameId).then(game => {
                if (!game) { ParamExporter._showToast('未找到对局数据'); return; }
                let modal = document.createElement('div');
                modal.className = 'modal';
                modal.style.zIndex = '1100';
                let analysisHtml = '';
                if (analysis && analysis.mistakes && analysis.mistakes.length > 0) {
                    analysisHtml = `<div class="text-[10px] text-red-400 mb-2">🔴 发现 ${analysis.mistakes.length} 处可改进：</div>`;
                    for (let m of analysis.mistakes) {
                        let sevIcon = m.severity === 'high' ? '🔴' : '🟡';
                        analysisHtml += `<div class="bg-gray-800/50 rounded p-1.5 mb-1 text-[9px]">${sevIcon} 第${m.turnIndex+1}手: ${m.reason}</div>`;
                    }
                    if (analysis.wouldWinIfOptimal) {
                        analysisHtml += `<div class="text-green-400 text-[10px] mt-2">✅ 如避免以上失误，本局本可获胜</div>`;
                    }
                } else {
                    analysisHtml = '<div class="text-green-400 text-[10px]">✅ 未发现明显失误</div>';
                }
                modal.innerHTML = `
                    <div class="modal-content" style="max-width:440px;max-height:80vh;overflow-y:auto;">
                        <h2 class="text-sm text-yellow-400 mb-3 retro-text text-center">🎮 对局详情</h2>
                        <div class="text-[10px] text-gray-300 space-y-1 mb-3">
                            <div>难度: ${game.difficulty} · 结果: ${game.result?.isPlayerWin ? '🎉 胜利' : '💔 失败'} · 倍数: ×${game.result?.multiplier || 1}</div>
                            <div>时间: ${new Date(game.timestamp).toLocaleString('zh-CN')}</div>
                            <div>总步数: ${game.actions?.length || 0}</div>
                        </div>
                        ${analysisHtml}
                        <div class="mt-2 text-[9px] text-gray-500">${game.actions?.slice(0, 30).map((a, i) =>
                            `<span>${i+1}. P${a.p} ${a.pass ? '不出' : '出'+a.c.length+'张'}</span>`
                        ).join(' · ')}${(game.actions?.length || 0) > 30 ? '...' : ''}</div>
                        <button onclick="this.closest('.modal').remove()" class="pixel-btn bg-gray-500 text-[10px] w-full mt-3">关闭</button>
                    </div>
                `;
                document.body.appendChild(modal);
            });
        });
    },

    _deleteAllGames() {
        if (confirm('确认清空全部对局记录？此操作不可撤销。')) {
            GameDatabase.deleteAll().then(() => {
                this._showToast('已清空全部记录');
                this._refreshUI();
            });
        }
    },

    copyToClipboard() {
        let json = ParamConfig.export();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(json);
            this._showToast('已复制到剪贴板');
        } else {
            let ta = document.getElementById('aiParamTextArea');
            if (!ta) return;
            ta.classList.remove('hidden');
            ta.value = json;
            ta.select();
            document.execCommand('copy');
            ta.classList.add('hidden');
            this._showToast('已复制到剪贴板');
        }
    },

    downloadFile() {
        let json = ParamConfig.export();
        let blob = new Blob([json], { type: 'application/json' });
        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.href = url;
        a.download = `ddz_ai_params_v${ParamConfig.get('version')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this._showToast('文件已下载');
    },

    importFromClipboard() {
        let ta = document.getElementById('aiParamTextArea');
        if (!ta) return;
        ta.classList.remove('hidden');
        ta.value = '';
        ta.placeholder = '在此粘贴 JSON...';
        let btn = document.createElement('button');
        btn.className = 'pixel-btn bg-green-500 text-[10px] w-full mt-1';
        btn.textContent = '确认导入';
        btn.onclick = () => {
            if (ParamConfig.import(ta.value)) {
                this._showToast('参数导入成功！');
                ta.classList.add('hidden');
                this._refreshUI();
                btn.remove();
            } else {
                this._showToast('JSON 格式错误');
            }
        };
        ta.parentNode.insertBefore(btn, ta.nextSibling);
        setTimeout(() => { if (btn.parentNode) btn.remove(); }, 30000);
    },

    importFromFile(event) {
        let file = event.target.files[0];
        if (!file) return;
        let reader = new FileReader();
        reader.onload = (e) => {
            if (ParamConfig.import(e.target.result)) {
                this._showToast('参数导入成功！');
                this._refreshUI();
            } else {
                this._showToast('文件格式错误');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    },

    runDeepOptimization() {
        let progressEl = document.getElementById('aiParamProgress');
        if (!progressEl) return;
        progressEl.classList.remove('hidden');
        progressEl.textContent = 'ℹ️ CEM 优化已禁用 — 使用 GodViewLearner 反事实学习替代';
        setTimeout(() => { progressEl.classList.add('hidden'); }, 3000);
    },

    resetParams() {
        if (confirm('确认恢复默认参数？自定义的参数将被清除。')) {
            ParamConfig.reset();
            this._refreshUI();
            this._showToast('已恢复默认参数');
        }
    },

    _showToast(msg) {
        if (typeof showToast === 'function') {
            showToast(msg);
        } else {
            let div = document.createElement('div');
            div.className = 'toast';
            div.textContent = msg;
            document.body.appendChild(div);
            setTimeout(() => div.remove(), 2000);
        }
    }
};

// ======================== 11. AUTO INIT ========================
ParamConfig.init();
CorrectionRules.init();
GameDatabase.open().then(() => {
    GodViewLearner._initCache();
});
if (document.readyState === 'complete') {
    GameRecorder.installHooks();
} else {
    window.addEventListener('load', () => GameRecorder.installHooks());
}
