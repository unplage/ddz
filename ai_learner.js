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

// ======================== 4. PARAMETER OPTIMIZER (CEM) ========================
const ParameterOptimizer = {
    _pendingGames: [],
    _lastOptimizeTime: 0,
    _MIN_GAMES_FOR_DEEP: 20,
    _INCREMENTAL_INTERVAL: 10,
    _running: false,

    _onGameEnd(game) {
        if (!game || !game.result) return;
        if (this._pendingGames.length >= 100) this._pendingGames.shift();
        this._pendingGames.push(game);
        if (this._pendingGames.length >= this._INCREMENTAL_INTERVAL) {
            this._scheduleIncremental();
        }
    },

    _scheduleIncremental() {
        if (this._running) return;
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(() => this._runIncremental(), { timeout: 5000 });
        } else {
            setTimeout(() => this._runIncremental(), 2000);
        }
    },

    _runIncremental() {
        if (this._running || this._pendingGames.length < this._INCREMENTAL_INTERVAL) return;
        this._running = true;
        let games = this._pendingGames.splice(0, this._INCREMENTAL_INTERVAL);
        let currentWinRate = games.filter(g => g.result && g.result.isPlayerWin).length / games.length;
        let candidate = this._mutate(ParamConfig._overrides || DEFAULT_PARAMS, 0.15);
        let candidateWins = 0, candidateTotal = Math.min(10, this._INCREMENTAL_INTERVAL);
        for (let i = 0; i < candidateTotal; i++) {
            if (this._simulateGame(candidate)) candidateWins++;
        }
        let candidateWinRate = candidateWins / candidateTotal;
        if (candidateWinRate > currentWinRate || (candidateWinRate >= currentWinRate && Math.random() < 0.3)) {
            ParamConfig._overrides = candidate;
            ParamConfig._persist();
        }
        this._running = false;
    },

    runDeepOptimization(onProgress, onComplete) {
        if (this._running) { if (onComplete) onComplete(false); return; }
        this._running = true;
        setTimeout(() => {
            let N_CANDIDATES = 15, N_SIMS = 20, N_ELITE = 5;
            let candidates = [];
            let baseParams = ParamConfig._overrides || DEFAULT_PARAMS;
            for (let i = 0; i < N_CANDIDATES; i++) {
                candidates.push(this._mutate(JSON.parse(JSON.stringify(baseParams)), 0.25));
            }
            let results = [];
            for (let i = 0; i < candidates.length; i++) {
                let wins = 0;
                for (let j = 0; j < N_SIMS; j++) {
                    if (this._simulateGame(candidates[i])) wins++;
                    if (onProgress) onProgress(i * N_SIMS + j + 1, N_CANDIDATES * N_SIMS);
                }
                results.push({ params: candidates[i], winRate: wins / N_SIMS });
            }
            results.sort((a, b) => b.winRate - a.winRate);
            let elite = results.slice(0, N_ELITE);
            let avg = JSON.parse(JSON.stringify(baseParams));
            let totalWeight = 0;
            for (let e of elite) {
                let w = e.winRate;
                totalWeight += w;
                this._mergeParams(avg, e.params, w);
            }
            if (totalWeight > 0) {
                this._divideParams(avg, totalWeight);
            }
            avg.version = DEFAULT_PARAMS.version;
            ParamConfig._overrides = avg;
            ParamConfig._persist();
            this._running = false;
            if (onComplete) onComplete(true, results[0].winRate);
        }, 100);
    },

    _mutate(params, strength) {
        let p = JSON.parse(JSON.stringify(params));
        let r = () => 1 + (Math.random() - 0.5) * strength * 2;
        if (p.weights) {
            for (let k in p.weights) {
                if (typeof p.weights[k] === 'number' && Math.random() < 0.5) {
                    p.weights[k] *= r();
                    p.weights[k] = Math.round(p.weights[k] * 100) / 100;
                }
            }
        }
        if (p.callThresholds) {
            for (let diff in p.callThresholds) {
                let ct = p.callThresholds[diff];
                if (ct && typeof ct === 'object') {
                    for (let k in ct) {
                        if (typeof ct[k] === 'number' && Math.random() < 0.4) {
                            ct[k] += (Math.random() - 0.5) * 6;
                            ct[k] = Math.round(ct[k]);
                            ct[k] = Math.max(-50, Math.min(100, ct[k]));
                        }
                    }
                }
            }
        }
        if (p.playHeuristics) this._mutateNested(p.playHeuristics, strength, 0.3);
        if (p.passScores) {
            for (let k in p.passScores) {
                if (typeof p.passScores[k] === 'number' && Math.random() < 0.3) {
                    p.passScores[k] *= r();
                    p.passScores[k] = Math.round(p.passScores[k]);
                }
            }
        }
        if (p.evalCoeffs) {
            for (let k in p.evalCoeffs) {
                if (typeof p.evalCoeffs[k] === 'number' && Math.random() < 0.4) {
                    p.evalCoeffs[k] *= r();
                    p.evalCoeffs[k] = Math.round(p.evalCoeffs[k] * 10) / 10;
                }
            }
        }
        return p;
    },

    _mutateNested(obj, strength, prob) {
        if (!obj || typeof obj !== 'object') return;
        for (let k in obj) {
            if (typeof obj[k] === 'number' && Math.random() < prob) {
                obj[k] *= 1 + (Math.random() - 0.5) * strength * 2;
                obj[k] = Math.round(obj[k]);
            } else if (typeof obj[k] === 'object') {
                this._mutateNested(obj[k], strength, prob);
            }
        }
    },

    _mergeParams(target, source, weight) {
        for (let key in source) {
            if (typeof source[key] === 'number' && typeof target[key] === 'number') {
                target[key] = (target[key] || 0) + source[key] * weight;
            } else if (typeof source[key] === 'object' && typeof target[key] === 'object') {
                this._mergeParams(target[key], source[key], weight);
            }
        }
    },

    _divideParams(target, divisor) {
        for (let key in target) {
            if (typeof target[key] === 'number') {
                target[key] /= divisor;
            } else if (typeof target[key] === 'object') {
                this._divideParams(target[key], divisor);
            }
        }
    },

    _simulateGame(params) {
        if (typeof heuristicPlayoutDeterministic !== 'function') return Math.random() < 0.4;
        let savedOverrides = ParamConfig._overrides;
        ParamConfig._overrides = params;
        try {
            const suits = ['♠','♥','♣','♦'], ranks = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
            let deck = [];
            for (let suit of suits) for (let i=0;i<ranks.length;i++) deck.push({ suit, rank: ranks[i], value: i, id: suit+ranks[i] });
            deck.push({ suit:'JOKER', rank:'小王', value:13, id:'joker1' }, { suit:'JOKER', rank:'大王', value:14, id:'joker2' });
            for (let i=deck.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]]; }
            let players = [[],[],[]];
            for (let i = 0; i < 51; i++) players[i % 3].push(deck[i]);
            let lordCards = deck.slice(51, 54);
            let landlord = Math.floor(Math.random() * 3);
            players[landlord].push(...lordCards);
            players.forEach(p => p.sort((a,b) => a.value - b.value));
            let sim = { players, landlord, currentPlayer: landlord, lastPlay: null, lastPlayerId: -1, passCount: 0, phase: 'playing', baseScore: 1, bombCount: 0 };
            let mem = new MasterMemory();
            return heuristicPlayoutDeterministic(sim, sim.currentPlayer, 0, mem);
        } catch (e) {
            return Math.random() < 0.4;
        } finally {
            ParamConfig._overrides = savedOverrides;
        }
    },

    getStats() {
        return {
            pendingGames: this._pendingGames.length,
            lastOptimizeTime: this._lastOptimizeTime,
            running: this._running
        };
    }
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
        if (!analysis || !analysis.mistakes || analysis.mistakes.length === 0) return;
        this.init();

        for (let mistake of analysis.mistakes) {
            if (mistake.category === 'overkill') {
                this._addOrStrengthen({
                    context: {
                        needBeat: true,
                        isBombPlay: false,
                        isRocketPlay: false,
                        hasSmallJoker: false
                    },
                    comparators: {},
                    category: 'overkill',
                    avoidType: mistake.chosenType === CardType.ROCKET ? 'rocket' : 'bomb',
                    penalty: mistake.chosenType === CardType.ROCKET ? -350 : -300,
                    reason: '避免过度压制，有更经济的出法'
                });
            } else if (mistake.category === 'high_kicker') {
                this._addOrStrengthen({
                    context: {
                        playType: CardType.TRIPLE_WITH_SINGLE,
                        kickerValue: 11
                    },
                    comparators: { kickerValue: 'gte' },
                    category: 'high_kicker',
                    avoidType: 'high_kicker',
                    penalty: -250,
                    reason: '三带中避免用高牌做带牌'
                });
            } else if (mistake.category === 'bad_pass') {
                this._addOrStrengthen({
                    context: {
                        needBeat: true,
                        isBombPlay: false,
                        isRocketPlay: false
                    },
                    comparators: { handSize: 'gte' },
                    category: 'bad_pass',
                    avoidType: 'pass',
                    penalty: -300,
                    reason: '对手剩余牌少时不应放过'
                });
            }
        }
        this._prune();
        this._persist();
    },

    _addOrStrengthen(template) {
        let existing = this._rules.find(r => {
            if (r.category !== template.category) return false;
            let rKeys = Object.keys(r.context).sort();
            let tKeys = Object.keys(template.context).sort();
            if (rKeys.length !== tKeys.length) return false;
            return rKeys.every((k, i) => k === tKeys[i] && r.context[k] === template.context[k]);
        });
        if (existing) {
            existing.confidence = Math.min(1, existing.confidence + 0.08);
            existing.triggerCount++;
            existing.penalty = Math.max(existing.penalty, template.penalty);
        } else {
            this._rules.push({
                id: 'rule_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                category: template.category,
                context: template.context,
                comparators: template.comparators || {},
                avoidType: template.avoidType,
                penalty: template.penalty,
                confidence: 0.15,
                triggerCount: 1,
                helpCount: 0,
                reason: template.reason
            });
        }
    },

    _prune() {
        this._rules.sort((a, b) => b.confidence - a.confidence);
        if (this._rules.length > this.MAX_RULES) {
            this._rules = this._rules.slice(0, this.MAX_RULES);
        }
        this._rules.forEach(r => {
            r.confidence = Math.max(0.05, r.confidence - 0.02);
        });
        this._rules = this._rules.filter(r => {
            if (r.confidence < 0.2 && r.triggerCount > 3) return false;
            return true;
        });
    },

    recordDecision(state, playerId, chosenPlay, scored) {
        // Stub for future use: match live decisions against rules
    },

    getStats() {
        this.init();
        let active = this._rules.filter(r => r.confidence >= this.MIN_CONFIDENCE).length;
        return { total: this._rules.length, active };
    }
};

// ======================== 7. GOD VIEW COUNTERFACTUAL LEARNER ========================
const GodViewLearner = {
    _queue: [],
    _running: false,
    _correctionsHistory: null,
    _lastAdjustmentTime: 0,
    _ADJUST_INTERVAL: 3000,
    _statsCache: { total: 0, recent20: 0, passMiss: 0, bombMiss: 0 },

    _initCache() {
        GameDatabase.countCorrections().then(total => { this._statsCache.total = total; }).catch(() => {});
        GameDatabase.getRecentCorrections(20).then(data => {
            if (data && data.length) {
                let recent = data.filter(c => c.diff > 0.25);
                this._statsCache.recent20 = recent.length;
                this._statsCache.passMiss = recent.filter(c => c.actualType === 'pass').length;
                this._statsCache.bombMiss = recent.filter(c => c.actualType !== 'bomb' && c.actualType !== 'rocket' && (c.bestType === 'bomb' || c.bestType === 'rocket')).length;
            }
        }).catch(() => {});
    },

    learn(game) {
        if (!game || !game.initialDeal || !game.actions || game.actions.length < 3) return;
        if (game.mode !== 'single') return;
        if (this._running) { this._queue.push(game); return; }
        this._running = true;
        setTimeout(() => this._run(game), 200);
    },

    _run(game) {
        try {
            let corrections = this._analyzeGame(game);
            if (corrections.length > 0) {
                this._saveCorrections(corrections);
                this._applyAdjustments(corrections);
            }
        } catch (e) {
            console.warn('GodViewLearner error:', e.message);
        }
        this._running = false;
        if (this._queue.length > 0) this.learn(this._queue.shift());
    },

    _analyzeGame(game) {
        let lordCards = game.initialDeal.lordCards.map(c => ({ ...c }));
        let players = game.initialDeal.players.map(p => p.map(c => ({ ...c })));
        let lordIdx = game.calling.landlord;
        if (lordIdx < 0) return [];
        players[lordIdx].push(...lordCards);
        players.forEach(p => p.sort((a, b) => a.value - b.value));

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
                    let corr = this._checkCounterfactual(state, action, hand, lordIdx, i);
                    if (corr) corrections.push(corr);
                }
            }
            this._advanceState(state, action);
        }
        return corrections;
    },

    _checkCounterfactual(state, action, hand, lordIdx, turnIdx) {
        let aiRole = action.p === lordIdx ? 'landlord' : 'farmer';
        let isLead = !state.lastPlay || state.lastPlayerId === action.p;

        let allPlays = getAllValidPlays(hand, isLead ? null : state.lastPlay);
        if (!isLead && allPlays.length === 0) return null;

        let memory = new MasterMemory();
        let scored = allPlays.map(play => {
            let feat = extractPlayFeatures(play, hand, state.lastPlay, aiRole, memory, state);
            return { play, score: scorePlay(feat, aiRole, memory, state, hand) };
        });
        scored.sort((a, b) => b.score - a.score);

        let topN = Math.min(4, scored.length);
        let simResults = [];

        for (let j = 0; j < topN; j++) {
            let play = scored[j].play;
            let ids = new Set(play.map(c => c.id));
            let simState = JSON.parse(JSON.stringify(state));
            simState.players[action.p] = simState.players[action.p].filter(c => !ids.has(c.id));
            simState.lastPlay = getCardType(play);
            simState.lastPlayerId = action.p;
            simState.passCount = 0;

            if (simState.players[action.p].length === 0) {
                simResults.push({ play, score: scored[j].score, winRate: 1 });
                continue;
            }
            let nextP = (action.p + 1) % 3;
            let wins = 0, trials = 4;
            for (let t = 0; t < trials; t++) {
                if (this._simulateGame(simState, nextP, action.p, lordIdx)) wins++;
            }
            simResults.push({ play, score: scored[j].score, winRate: wins / trials });
        }

        if (!isLead) {
            let passState = JSON.parse(JSON.stringify(state));
            passState.passCount++;
            let wins = 0, trials = 3;
            for (let t = 0; t < trials; t++) {
                if (this._simulateGame(passState, (action.p + 1) % 3, action.p, lordIdx)) wins++;
            }
            simResults.push({ play: [], score: -9999, winRate: wins / trials });
        }

        simResults.sort((a, b) => {
            if (Math.abs(a.winRate - b.winRate) > 0.15) return b.winRate - a.winRate;
            return b.score - a.score;
        });

        let actualPlay = action.pass ? [] : action.c;
        let actualSim = simResults.find(s => {
            if (actualPlay.length === 0 && s.play.length === 0) return true;
            if (actualPlay.length === 0 || s.play.length === 0) return false;
            let ids1 = new Set(actualPlay.map(c => c.id));
            let ids2 = new Set(s.play.map(c => c.id));
            if (ids1.size !== ids2.size) return false;
            return [...ids1].every(id => ids2.has(id));
        });

        let bestSim = simResults[0];
        if (!actualSim || !bestSim || actualSim === bestSim) return null;
        if (bestSim.winRate - actualSim.winRate < 0.25) return null;
        if (bestSim.winRate <= 0.3) return null;

        let bestType = bestSim.play.length > 0 ? getCardType(bestSim.play) : null;
        let actualType = actualPlay.length > 0 ? getCardType(actualPlay) : null;
        if (bestType && actualType && bestType.type === actualType.type && bestType.value === actualType.value) return null;

        return {
            turnIdx, player: action.p, role: aiRole, diff: bestSim.winRate - actualSim.winRate,
            bestWinRate: bestSim.winRate, actualWinRate: actualSim.winRate,
            handSize: hand.length, lordSize: state.players[lordIdx]?.length || 0,
            lastPlayType: state.lastPlay?.type || 'none', lastPlayPower: state.lastPlay?.value || 0,
            isLead, actualType: actualType?.type || 'pass', bestType: bestType?.type || 'pass',
            bestScore: bestSim.score, actualScore: actualSim?.score || 0
        };
    },

    _simulateGame(startState, startPlayer, aiPlayerId, lordIdx) {
        let s = JSON.parse(JSON.stringify(startState));
        let cp = startPlayer;
        let limit = 50;
        for (let step = 0; step < limit; step++) {
            for (let i = 0; i < 3; i++) {
                if (s.players[i].length === 0) {
                    if (aiPlayerId === lordIdx) return i === lordIdx;
                    return i !== lordIdx;
                }
            }
            if (s.passCount >= 2) { s.lastPlay = null; s.lastPlayerId = -1; s.passCount = 0; }
            let hand = s.players[cp];
            if (!hand || hand.length === 0) { cp = (cp + 1) % 3; continue; }
            let needBeat = s.lastPlay && s.lastPlayerId !== cp;
            let plays = needBeat ? getAllValidPlays(hand, s.lastPlay) : getAllValidPlays(hand, null);
            if (plays.length === 0) { s.passCount++; cp = (cp + 1) % 3; continue; }
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
            cp = (cp + 1) % 3;
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
            state.lastPlay = getCardType(action.c.map(c => ({ ...c })));
            state.lastPlayerId = action.p;
            state.passCount = 0;
        }
        state.currentPlayer = (action.p + 1) % 3;
    },

    _saveCorrections(corrections) {
        let entries = corrections.map(c => ({ ...c, ts: Date.now() }));
        let count = entries.length;
        Promise.all(entries.map(e => GameDatabase.saveCorrection(e))).then(() => {
            GameDatabase.countCorrections().then(total => { this._statsCache.total = total; });
            GameDatabase.getRecentCorrections(20).then(data => {
                if (data && data.length) {
                    let recent = data.filter(c => c.diff > 0.25);
                    this._statsCache.recent20 = recent.length;
                    this._statsCache.passMiss = recent.filter(c => c.actualType === 'pass').length;
                    this._statsCache.bombMiss = recent.filter(c => c.actualType !== 'bomb' && c.actualType !== 'rocket' && (c.bestType === 'bomb' || c.bestType === 'rocket')).length;
                }
            });
        });
        this._statsCache.total += count;
        let recentPass = entries.filter(c => c.actualType === 'pass').length;
        let recentBomb = entries.filter(c => c.actualType !== 'bomb' && c.actualType !== 'rocket' && (c.bestType === 'bomb' || c.bestType === 'rocket')).length;
        this._statsCache.passMiss += recentPass;
        this._statsCache.bombMiss += recentBomb;
    },

    _applyAdjustments(corrections) {
        let now = Date.now();
        if (now - this._lastAdjustmentTime < this._ADJUST_INTERVAL) return;
        this._lastAdjustmentTime = now;

        let lr = 0.1;
        for (let corr of corrections) {
            if (corr.diff < 0.3) continue;

            if (corr.isLead) {
                if (corr.bestType === 'single' && corr.actualType === 'pair') {
                    this._adjust('playHeuristics.landlordLeadSingle.le6', 2);
                }
                continue;
            }

            let isBombBest = corr.bestType === 'bomb' || corr.bestType === 'rocket';
            let isBombActual = corr.actualType === 'bomb' || corr.actualType === 'rocket';

            if (isBombBest && !isBombActual) {
                this._adjust('playHeuristics.bombUrgent.oppAboutToWin', 8 * lr);
                this._adjust('playHeuristics.bombUrgent.landlordRemainLe4', 5 * lr);
                this._adjust('playHeuristics.bombUrgent.remainLe2', 5 * lr);
            }

            if (!isBombBest && isBombActual) {
                this._adjust('playHeuristics.bombWasted.lowLastPower', -5 * lr);
                this._adjust('playHeuristics.bombWasted.highLastPower', -5 * lr);
                this._adjust('playHeuristics.bombWasted.notCritical', -5 * lr);
            }

            if (corr.actualType === 'pass' && corr.bestWinRate > 0.5) {
                this._adjust('passScores.lordHandGt4', -3 * lr);
                this._adjust('passScores.farmerPartnerBase', -3 * lr);
            }

            if (corr.actualType === 'single' && (corr.bestType === 'bomb' || corr.bestType === 'pair' || corr.bestType === 'triple')) {
                this._adjust('playHeuristics.suppressSingle.diffLe4', -3 * lr);
                this._adjust('playHeuristics.suppressSingle.diffLe7', -2 * lr);
            }

            if (corr.actualType === 'pair' && corr.bestType === 'single') {
                this._adjust('playHeuristics.suppressPair.diffLe4', -3 * lr);
                this._adjust('playHeuristics.suppressPair.diffLe7', -2 * lr);
            }

            if (corr.category === 'overkill' && corr.bestWinRate > 0.6 && corr.actualWinRate < 0.3) {
                this._adjust('playHeuristics.overkill.singleLe12', 5 * lr);
                this._adjust('playHeuristics.overkill.pairLe10', 5 * lr);
            }
        }
    },

    _adjust(path, delta) {
        if (Math.abs(delta) < 0.01) return;
        let current = ParamConfig.get(path);
        if (current === undefined || current === null) return;
        let maxClamp = 500, minClamp = -500;
        if (path.startsWith('passScores')) { minClamp = -999; maxClamp = 999; }
        let newVal = Math.max(minClamp, Math.min(maxClamp, current + delta));
        if (Math.abs(newVal - current) > 0.01) ParamConfig.set(path, Math.round(newVal * 100) / 100);
    },

    getStats() {
        return this._statsCache;
    },

    getRecentCorrections(limit) {
        return GameDatabase.getRecentCorrections(limit).then(data => data || []);
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
        container.innerHTML = `<div class="text-[10px] text-gray-300 mb-3 space-y-1">
            <div>📊 总复盘次数: ${stats.total}</div>
            <div>🎯 近期修正: ${stats.recent20} 条</div>
            <div>⏱ 不该PASS却PASS: ${stats.passMiss} 次</div>
            <div>💣 该用炸弹却未用: ${stats.bombMiss} 次</div>
        </div><div id="learnTabBody" class="text-center text-gray-400 text-[10px] py-4">⏳ 加载中...</div>
        <div class="text-[8px] text-gray-500 mt-2">每局结束后自动分析AI决策，发现错失机会后微调参数</div>`;
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
        progressEl.textContent = '⏳ 深度优化进行中 (0%)...';
        let buttons = document.querySelectorAll('#aiParamModal .pixel-btn');
        buttons.forEach(b => b.disabled = true);
        ParameterOptimizer.runDeepOptimization(
            (done, total) => {
                let pct = Math.round(done / total * 100);
                progressEl.textContent = `⏳ 深度优化进行中 (${pct}%)...`;
            },
            (success, bestWinRate) => {
                progressEl.textContent = success
                    ? `✅ 优化完成！最优胜率: ${Math.round(bestWinRate * 100)}%`
                    : '❌ 优化失败或已取消';
                buttons.forEach(b => b.disabled = false);
                this._refreshUI();
                setTimeout(() => { progressEl.classList.add('hidden'); }, 5000);
            }
        );
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
