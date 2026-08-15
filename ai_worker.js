// ai_worker.js — Web Worker: Pure AI computation (no DOM/window/locakStorage)
// Loaded by index.html via AiWorkerPool

// ======================== 常量与工具 ========================
const CardType = {
    SINGLE:'single', PAIR:'pair', TRIPLE:'triple', TRIPLE_WITH_SINGLE:'triple_single', TRIPLE_WITH_PAIR:'triple_pair',
    STRAIGHT:'straight', STRAIGHT_PAIR:'straight_pair', FOUR_WITH_TWO_SINGLE:'four_two_single', FOUR_WITH_TWO_PAIR:'four_two_pair',
    BOMB:'bomb', ROCKET:'rocket',
    PLANE:'plane', PLANE_WITH_SINGLE:'plane_single', PLANE_WITH_PAIR:'plane_pair'
};
function countValues(values) { let cnt = {}; values.forEach(v => cnt[v] = (cnt[v] || 0) + 1); return cnt; }
function isStraight(values) { for (let i = 1; i < values.length; i++) if (values[i] !== values[i-1] + 1) return false; return true; }
function getCombinations(arr, k) {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    let result = [];
    for (let i = 0; i <= arr.length - k; i++) {
        for (let sub of getCombinations(arr.slice(i + 1), k - 1))
            result.push([arr[i], ...sub]);
    }
    return result;
}
function getCardType(cards) {
    if (!cards || cards.length === 0) return null;
    const sorted = [...cards].sort((a,b)=>a.value-b.value);
    const values = sorted.map(c=>c.value);
    const uniq = [...new Set(values)];
    if (cards.length === 2 && cards.some(c=>c.id==='joker1') && cards.some(c=>c.id==='joker2')) return { type:CardType.ROCKET, value:100, cards:sorted };
    if (cards.length === 1) return { type:CardType.SINGLE, value:values[0], cards:sorted };
    if (cards.length === 2 && uniq.length === 1) return { type:CardType.PAIR, value:values[0], cards:sorted };
    if (cards.length === 3 && uniq.length === 1) return { type:CardType.TRIPLE, value:values[0], cards:sorted };
    if (cards.length === 4 && uniq.length === 1) return { type:CardType.BOMB, value:values[0]+50, cards:sorted };
    if (cards.length === 4 && uniq.length === 2) { let cnt = countValues(values); if (Object.values(cnt).includes(3)) return { type:CardType.TRIPLE_WITH_SINGLE, value:parseInt(Object.keys(cnt).find(k=>cnt[k]===3)), cards:sorted }; }
    if (cards.length === 5 && uniq.length === 2) { let cnt = countValues(values); if (Object.values(cnt).includes(3) && Object.values(cnt).includes(2)) return { type:CardType.TRIPLE_WITH_PAIR, value:parseInt(Object.keys(cnt).find(k=>cnt[k]===3)), cards:sorted }; }
    if (cards.length === 6) { let cnt = countValues(values); let four = Object.keys(cnt).find(k=>cnt[k]===4); if (four && Object.values(cnt).filter(v=>v===1).length === 2) return { type:CardType.FOUR_WITH_TWO_SINGLE, value:parseInt(four), cards:sorted }; }
    if (cards.length === 8) { let cnt = countValues(values); let four = Object.keys(cnt).find(k=>cnt[k]===4); if (four && Object.values(cnt).filter(v=>v===2).length === 2) return { type:CardType.FOUR_WITH_TWO_PAIR, value:parseInt(four), cards:sorted }; }
    if (cards.length >= 5 && uniq.length === cards.length && isStraight(values) && values[cards.length-1] <= 11 && !values.includes(12)) return { type:CardType.STRAIGHT, value:values[0], length:cards.length, cards:sorted };
    if (cards.length >= 6 && cards.length % 2 === 0) {
        let cnt = countValues(values);
        let pairs = Object.keys(cnt).filter(k=>cnt[k]===2).map(Number).sort((a,b)=>a-b);
        if (pairs.length === cards.length/2 && isStraight(pairs) && pairs[pairs.length-1] <= 11) return { type:CardType.STRAIGHT_PAIR, value:pairs[0], length:pairs.length, cards:sorted };
    }
    if (cards.length >= 6 && cards.length % 3 === 0) {
        let cnt = countValues(values);
        let tripVals = Object.keys(cnt).filter(k=>cnt[k]===3).map(Number).sort((a,b)=>a-b);
        let groupLen = cards.length / 3;
        if (tripVals.length === groupLen && groupLen >= 2 && isStraight(tripVals) && tripVals[groupLen-1] <= 11)
            return { type:CardType.PLANE, value:tripVals[0], length:groupLen, cards:sorted };
    }
    if (cards.length >= 8 && cards.length % 4 === 0) {
        let cnt = countValues(values);
        let groupLen = cards.length / 4;
        let tripVals = Object.keys(cnt).filter(k=>cnt[k]>=3).map(Number).sort((a,b)=>a-b);
        for (let i=0; i+groupLen<=tripVals.length; i++) {
            let seq = tripVals.slice(i, i+groupLen);
            if (!isStraight(seq) || seq[groupLen-1]>11) continue;
            let used = new Set(seq);
            let remain = Object.keys(cnt).filter(k=>!used.has(parseInt(k)) && cnt[k]===1);
            if (remain.length === groupLen)
                return { type:CardType.PLANE_WITH_SINGLE, value:seq[0], length:groupLen, cards:sorted };
        }
    }
    if (cards.length >= 10 && cards.length % 5 === 0) {
        let cnt = countValues(values);
        let groupLen = cards.length / 5;
        let tripVals = Object.keys(cnt).filter(k=>cnt[k]>=3).map(Number).sort((a,b)=>a-b);
        for (let i=0; i+groupLen<=tripVals.length; i++) {
            let seq = tripVals.slice(i, i+groupLen);
            if (!isStraight(seq) || seq[groupLen-1]>11) continue;
            let used = new Set(seq);
            let remain = Object.keys(cnt).filter(k=>!used.has(parseInt(k)) && cnt[k]===2);
            if (remain.length === groupLen)
                return { type:CardType.PLANE_WITH_PAIR, value:seq[0], length:groupLen, cards:sorted };
        }
    }
    return null;
}
function canBeat(current, last) {
    if (!last) return true;
    if (current.type === CardType.ROCKET) return true;
    if (last.type === CardType.ROCKET) return false;
    if (current.type === CardType.BOMB && last.type !== CardType.BOMB) return true;
    if (last.type === CardType.BOMB && current.type !== CardType.BOMB) return false;
    if (current.type !== last.type) return false;
    if (current.length && current.length !== last.length) return false;
    return current.value > last.value;
}
function getPlayPower(play) {
    if (!play) return 0;
    let type = getCardType(play);
    if (!type) return 0;
    if (type.type === CardType.ROCKET) return 1000;
    if (type.type === CardType.BOMB) return 500 + type.value;
    let base = 0;
    switch (type.type) {
        case CardType.SINGLE: base = type.value; break;
        case CardType.PAIR: base = type.value + 20; break;
        case CardType.TRIPLE: base = type.value + 40; break;
        case CardType.TRIPLE_WITH_SINGLE: base = type.value + 60; break;
        case CardType.TRIPLE_WITH_PAIR: base = type.value + 70; break;
        case CardType.STRAIGHT: base = type.value + 80 + type.length; break;
        case CardType.STRAIGHT_PAIR: base = type.value + 90 + type.length; break;
        case CardType.PLANE: base = type.value + 100 + type.length * 3; break;
        case CardType.PLANE_WITH_SINGLE: base = type.value + 110 + type.length * 3; break;
        case CardType.PLANE_WITH_PAIR: base = type.value + 120 + type.length * 3; break;
        case CardType.FOUR_WITH_TWO_SINGLE: base = type.value + 110; break;
        case CardType.FOUR_WITH_TWO_PAIR: base = type.value + 120; break;
        default: base = type.value;
    }
    return base;
}
function _canContend(lastPlay, type) {
    if (!lastPlay) return true;
    if (type === CardType.ROCKET) return true;
    if (type === CardType.BOMB) return lastPlay.type !== CardType.ROCKET;
    return type === lastPlay.type;
}

// ======================== 参数配置 ========================
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

let _params = null;
function paramGet(path) {
    let parts = path.split('.');
    let val = _params;
    if (val) {
        for (let p of parts) { if (val && typeof val === 'object') val = val[p]; else { val = undefined; break; } }
        if (val !== undefined) return val;
    }
    val = DEFAULT_PARAMS;
    for (let p of parts) { val = val[p]; if (val === undefined) break; }
    return val;
}

// ======================== 纠错规则 (无localStorage) ========================
let _correctionRules = [];
const _MIN_CONFIDENCE = 0.5;
function _ruleMatches(rule, ctx) {
    for (let key in rule.context) {
        let val = rule.context[key];
        if (val === true && !ctx[key]) return false;
        if (val === false && ctx[key]) return false;
        if (typeof val === 'number' && typeof ctx[key] === 'number') {
            if (rule.comparators && rule.comparators[key] === 'lte') { if (ctx[key] > val) return false; }
            else if (rule.comparators && rule.comparators[key] === 'gte') { if (ctx[key] < val) return false; }
            else { if (ctx[key] !== val) return false; }
        }
        if (typeof val === 'string' && ctx[key] !== val) return false;
    }
    return true;
}
function _matchCorrectionRules(ctx) {
    let results = [];
    for (let rule of _correctionRules) {
        if (rule.confidence < _MIN_CONFIDENCE) continue;
        if (_ruleMatches(rule, ctx)) results.push(rule);
    }
    return results;
}

// ======================== 记牌器 ========================
class MasterMemory {
    constructor() {
        this.remain = new Array(15).fill(4);
        this.remain[13] = 1; this.remain[14] = 1;
        this.seen = new Set();
        this.history = [];
        this.playerHistory = [[], [], []];
        this.totalCardsPlayed = [0, 0, 0];
    }
    record(cards) {
        cards.forEach(c => {
            if (!this.seen.has(c.id)) {
                this.seen.add(c.id);
                if (c.value >= 0 && c.value <= 14) this.remain[c.value]--;
            }
        });
        this.history.push(cards.map(c=>c.id));
    }
    recordPlayerPlay(playerId, cards) {
        if (this.playerHistory[playerId]) {
            this.playerHistory[playerId].push(cards.map(c=>c.id));
            this.totalCardsPlayed[playerId] += cards.length;
            this.record(cards);
        }
    }
    getRemain(v) { return this.remain[v] || 0; }
    getMaxOutside(myHand) {
        for (let v=14; v>=0; v--) {
            if (this.getRemain(v) > myHand.filter(c=>c.value===v).length) return v;
        }
        return 0;
    }
    getCriticalAbove(threshold) {
        for (let v=14; v>=threshold; v--) if (this.getRemain(v) > 0) return v;
        return null;
    }
    isBombPossible() {
        for (let v=0; v<=12; v++) if (this.getRemain(v) >= 4) return true;
        return false;
    }
    getOutsideBombCount() {
        let cnt = 0;
        for (let v=0; v<=12; v++) if (this.getRemain(v) >= 4) cnt++;
        return cnt;
    }
    getOutsideRocketPossible() {
        return this.getRemain(13) >= 1 && this.getRemain(14) >= 1;
    }
    getRemainingCounts() { return [...this.remain]; }
    getProbOpponentHas(value, minCount, opponentId, myHand) {
        let outside = this.getRemain(value);
        if (outside === 0) return 0;
        let myCount = myHand.filter(c=>c.value===value).length;
        let totalOutside = outside - myCount;
        if (totalOutside <= 0) return 0;
        let oppTotal = opponentId >= 0 ? Math.max(1, 17 - (this.totalCardsPlayed[opponentId] || 0)) : 10;
        let totalOppCards = 0;
        for (let i = 0; i < 3; i++) {
            if (i !== opponentId) totalOppCards += this.totalCardsPlayed[i] || 0;
        }
        let otherPlayersRemaining = Math.max(1, 34 - totalOppCards);
        let shareRatio = Math.min(1, oppTotal / otherPlayersRemaining);
        return Math.min(1, totalOutside / (totalOutside + 1)) * shareRatio;
    }
    getOpponentHandSize(playerId, isLandlord) {
        let base = isLandlord ? 20 : 17;
        return Math.max(0, base - (this.totalCardsPlayed[playerId] || 0));
    }
}

// ======================== 手牌分析 ========================
function extractHandFeatures(hand) {
    let values = hand.map(c => c.value);
    let counts = new Array(15).fill(0);
    values.forEach(v => counts[v]++);
    let features = { single:0, pair:0, triple:0, bomb:0, maxStraightLen:0, maxStraightPairLen:0, bigCards:0, hasRocket:0, total:hand.length };
    for (let v=0; v<=14; v++) {
        if (counts[v] === 1) features.single++;
        else if (counts[v] === 2) features.pair++;
        else if (counts[v] === 3) features.triple++;
        else if (counts[v] === 4) features.bomb++;
        if (v >= 12) features.bigCards += counts[v];
    }
    if (counts[13] === 1 && counts[14] === 1) features.hasRocket = 1;
    let straight = 0, best = 0;
    for (let v=0; v<=11; v++) {
        if (counts[v] >= 1) straight++;
        else { best = Math.max(best, straight); straight = 0; }
    }
    best = Math.max(best, straight);
    features.maxStraightLen = best;
    let pairStraight = 0, bestPair = 0;
    for (let v=0; v<=11; v++) {
        if (counts[v] >= 2) pairStraight++;
        else { bestPair = Math.max(bestPair, pairStraight); pairStraight = 0; }
    }
    bestPair = Math.max(bestPair, pairStraight);
    features.maxStraightPairLen = bestPair;
    return features;
}

function evaluateHandStrength(hand, memory, isLandlord, callPosition) {
    let ec = paramGet('evalCoeffs');
    let score = 0, values = hand.map(c=>c.value), cnt = countValues(values);
    for (let v in cnt) {
        if (cnt[v] === 4) score += ec.bomb;
        else if (cnt[v] === 3) score += ec.triple;
        else if (cnt[v] === 2) score += ec.pair;
    }
    if (hand.some(c=>c.value===14) && hand.some(c=>c.value===13)) score += ec.bothJokers;
    else { if (hand.some(c=>c.value===14)) score += ec.bigJokerOnly; if (hand.some(c=>c.value===13)) score += ec.smallJokerOnly; }
    score += (cnt[12]||0)*ec.ace + (cnt[11]||0)*ec.king + (cnt[10]||0)*ec.queen;
    let sortedUnique = [...new Set(values.filter(v=>v<13))].sort((a,b)=>a-b);
    let maxLen = 1, cur = 1;
    for (let i=1;i<sortedUnique.length;i++) { if (sortedUnique[i] === sortedUnique[i-1]+1) cur++; else { maxLen = Math.max(maxLen, cur); cur=1; } }
    maxLen = Math.max(maxLen, cur);
    score += maxLen * ec.straightLenFactor;
    let singleCount = Object.values(cnt).filter(c => c === 1).length;
    score += singleCount * ec.singlePenalty;
    let pairCount = Object.values(cnt).filter(c => c === 2).length;
    score += pairCount * ec.pairExtra;
    let tripleCount = Object.values(cnt).filter(c => c === 3).length;
    score += tripleCount * ec.tripleExtra;
    if (memory && memory.isBombPossible()) score += ec.bombOutsideBonus;
    if (callPosition === 2) score += ec.position2Bonus;
    if (isLandlord) score += ec.landlordBonus;
    return score;
}

function extractPlayFeatures(play, hand, lastPlay, role, memory, state) {
    let playType = getCardType(play);
    let newHand = hand.filter(c => !play.includes(c));
    let handFeatures = extractHandFeatures(newHand);
    let playPower = getPlayPower(play);
    let isBomb = [CardType.BOMB, CardType.ROCKET].includes(playType.type);
    let needBeat = (lastPlay && state.lastPlayerId !== state.currentPlayer);
    let partnerId = -1;
    if (role === 'farmer') {
        for (let i = 0; i < 3; i++) {
            if (i !== state.currentPlayer && i !== state.landlord) {
                partnerId = i;
                break;
            }
        }
    }
    let kickerValue = 0;
    if (playType.type === CardType.TRIPLE_WITH_SINGLE || playType.type === CardType.TRIPLE_WITH_PAIR) {
        let cnt = countValues(play.map(c=>c.value));
        let target = playType.type === CardType.TRIPLE_WITH_SINGLE ? 1 : 2;
        let kv = Object.keys(cnt).find(k => cnt[k] === target && parseInt(k) !== playType.value);
        if (kv !== undefined) kickerValue = parseInt(kv);
    }
    if (playType.type === CardType.PLANE_WITH_SINGLE || playType.type === CardType.PLANE_WITH_PAIR) {
        let cnt = countValues(play.map(c=>c.value));
        let target = playType.type === CardType.PLANE_WITH_SINGLE ? 1 : 2;
        let kickerVals = Object.keys(cnt).filter(k => cnt[k] === target).map(Number);
        kickerValue = kickerVals.length > 0 ? Math.max(...kickerVals) : 0;
    }
    let nextPlayerId = (state.currentPlayer + 1) % 3;
    return {
        playLength: play.length, playPower, isBomb: isBomb ? 1 : 0, isRocket: (playType.type === CardType.ROCKET) ? 1 : 0,
        remainTotal: newHand.length, remainSingle: handFeatures.single, remainPair: handFeatures.pair,
        remainTriple: handFeatures.triple, remainBomb: handFeatures.bomb, remainMaxStraight: handFeatures.maxStraightLen,
        remainBigCards: handFeatures.bigCards, hasRocket: handFeatures.hasRocket,
        isLandlord: (role === 'landlord') ? 1 : 0, isFarmer: (role === 'farmer') ? 1 : 0,
        opponentHandCount: state.lastPlayerId !== -1 ? state.players[state.lastPlayerId].length : 0,
        nextPlayerHandCount: state.players[nextPlayerId] ? state.players[nextPlayerId].length : 17,
        partnerHandCount: (role === 'farmer' && partnerId !== -1) ? (state.players[partnerId]?.length || 0) : 0,
        outsideBombCount: memory.getOutsideBombCount(), isCritical: (newHand.length <= 3) ? 1 : 0,
        needBeat: needBeat ? 1 : 0, lastPlayType: lastPlay ? lastPlay.type : 'none', lastPlayPower: lastPlay ? lastPlay.value : 0,
        playType: playType.type, kickerValue, mainValue: playType.value
    };
}

// ======================== 出牌生成 ========================
function getAllValidPlays(hand, lastPlay = null) {
    if (!hand || hand.length === 0) return [];
    if (lastPlay && lastPlay.type === CardType.ROCKET) return [];
    let candidates = [];
    const byValue = {};
    hand.forEach(c => { if (!byValue[c.value]) byValue[c.value] = []; byValue[c.value].push(c); });
    hand.forEach(c => candidates.push([c]));
    Object.values(byValue).forEach(arr => { if (arr.length >= 2) candidates.push([arr[0], arr[1]]); });
    Object.values(byValue).forEach(arr => { if (arr.length >= 3) candidates.push([arr[0], arr[1], arr[2]]); });
    Object.values(byValue).forEach(arr => { if (arr.length === 4) candidates.push(arr); });
    if (byValue[13] && byValue[14]) candidates.push([byValue[13][0], byValue[14][0]]);
    if (_canContend(lastPlay, CardType.TRIPLE_WITH_SINGLE)) {
        for (let triple of Object.values(byValue).filter(arr=>arr.length>=3)) {
            for (let single of hand) if (single.value !== triple[0].value) candidates.push([...triple.slice(0,3), single]);
        }
    }
    if (_canContend(lastPlay, CardType.TRIPLE_WITH_PAIR)) {
        for (let triple of Object.values(byValue).filter(arr=>arr.length>=3)) {
            for (let pair of Object.values(byValue).filter(arr=>arr.length>=2 && arr[0].value !== triple[0].value)) {
                candidates.push([...triple.slice(0,3), ...pair.slice(0,2)]);
            }
        }
    }
    if (_canContend(lastPlay, CardType.FOUR_WITH_TWO_SINGLE)) {
        for (let quad of Object.values(byValue).filter(arr=>arr.length===4)) {
            let singles = hand.filter(c => c.value !== quad[0].value);
            for (let i=0;i<singles.length;i++) for (let j=i+1;j<singles.length;j++) candidates.push([...quad, singles[i], singles[j]]);
        }
    }
    if (_canContend(lastPlay, CardType.FOUR_WITH_TWO_PAIR)) {
        for (let quad of Object.values(byValue).filter(arr=>arr.length===4)) {
            let pairs = Object.values(byValue).filter(arr=>arr.length>=2 && arr[0].value !== quad[0].value);
            for (let i=0;i<pairs.length;i++) for (let j=i+1;j<pairs.length;j++) candidates.push([...quad, ...pairs[i].slice(0,2), ...pairs[j].slice(0,2)]);
        }
    }
    if (_canContend(lastPlay, CardType.STRAIGHT)) {
        let uniqueValues = [...new Set(hand.map(c=>c.value).filter(v=>v<12))].sort((a,b)=>a-b);
        for (let len=5; len<=12; len++) {
            for (let i=0; i+len <= uniqueValues.length; i++) {
                let seq = uniqueValues.slice(i, i+len);
                if (isStraight(seq)) {
                    let cards = [], ok=true;
                    for (let v of seq) { if (!byValue[v]) { ok=false; break; } cards.push(byValue[v][0]); }
                    if (ok) candidates.push(cards);
                }
            }
        }
    }
    if (_canContend(lastPlay, CardType.STRAIGHT_PAIR)) {
        let pairValues = Object.keys(byValue).filter(v => byValue[v].length >= 2 && v<12).map(Number).sort((a,b)=>a-b);
        for (let len=3; len<=6; len++) {
            for (let i=0; i+len <= pairValues.length; i++) {
                let seq = pairValues.slice(i, i+len);
                if (isStraight(seq)) {
                    let cards = [], ok=true;
                    for (let v of seq) { if (!byValue[v] || byValue[v].length<2) { ok=false; break; } cards.push(byValue[v][0], byValue[v][1]); }
                    if (ok) candidates.push(cards);
                }
            }
        }
    }
    if (_canContend(lastPlay, CardType.PLANE)) {
        let tripleValues = Object.keys(byValue).filter(v => byValue[v].length >= 3 && v<12).map(Number).sort((a,b)=>a-b);
        for (let len=2; len<=tripleValues.length; len++) {
            for (let i=0; i+len<=tripleValues.length; i++) {
                let seq = tripleValues.slice(i, i+len);
                if (isStraight(seq)) {
                    let cards = [], ok=true;
                    for (let v of seq) { if (!byValue[v] || byValue[v].length<3) { ok=false; break; } cards.push(byValue[v][0], byValue[v][1], byValue[v][2]); }
                    if (ok) candidates.push(cards);
                }
            }
        }
    }
    if (_canContend(lastPlay, CardType.PLANE_WITH_SINGLE)) {
        let tripleValues = Object.keys(byValue).filter(v => byValue[v].length >= 3 && v<12).map(Number).sort((a,b)=>a-b);
        for (let len=2; len<=tripleValues.length; len++) {
            for (let i=0; i+len<=tripleValues.length; i++) {
                let seq = tripleValues.slice(i, i+len);
                if (!isStraight(seq)) continue;
                let tripleCards = [], ok=true;
                for (let v of seq) { if (!byValue[v] || byValue[v].length<3) { ok=false; break; } tripleCards.push(byValue[v][0], byValue[v][1], byValue[v][2]); }
                if (!ok) continue;
                let usedIds = new Set(tripleCards.map(c=>c.id));
                let kickers = hand.filter(c => !usedIds.has(c.id));
                for (let combo of getCombinations(kickers, len)) {
                    candidates.push([...tripleCards, ...combo]);
                }
            }
        }
    }
    if (_canContend(lastPlay, CardType.PLANE_WITH_PAIR)) {
        let tripleValues = Object.keys(byValue).filter(v => byValue[v].length >= 3 && v<12).map(Number).sort((a,b)=>a-b);
        let pairValues = Object.keys(byValue).filter(v => byValue[v].length >= 2 && v<12).map(Number).sort((a,b)=>a-b);
        for (let len=2; len<=Math.min(tripleValues.length, 6); len++) {
            for (let i=0; i+len<=tripleValues.length; i++) {
                let seq = tripleValues.slice(i, i+len);
                if (!isStraight(seq)) continue;
                let tripleCards = [], ok=true;
                for (let v of seq) { if (!byValue[v] || byValue[v].length<3) { ok=false; break; } tripleCards.push(byValue[v][0], byValue[v][1], byValue[v][2]); }
                if (!ok) continue;
                let usedVals = new Set(seq);
                let availPairs = pairValues.filter(v => !usedVals.has(v));
                for (let combo of getCombinations(availPairs, len)) {
                    let cards = [...tripleCards];
                    let ok2 = true;
                    for (let v of combo) { if (!byValue[v] || byValue[v].length<2) { ok2=false; break; } cards.push(byValue[v][0], byValue[v][1]); }
                    if (ok2) candidates.push(cards);
                }
            }
        }
    }
    let unique = new Map();
    candidates.forEach(arr => { let key = arr.map(c=>c.id).sort().join(','); if (!unique.has(key)) unique.set(key, arr); });
    let result = Array.from(unique.values()).filter(play => getCardType(play) !== null);
    if (lastPlay) result = result.filter(play => canBeat(getCardType(play), lastPlay));
    result.sort((a,b)=>getPlayPower(a)-getPlayPower(b));
    return result;
}

// ======================== 评分系统 ========================
function scorePlay(features, role, memory, state, playerHand) {
    let score = 0;
    let W = paramGet('weights');
    for (let key in W) if (features[key] !== undefined) score += features[key] * W[key];
    let isPartnerPlay = role === 'farmer' && state.lastPlayerId !== -1 && state.lastPlayerId !== state.currentPlayer && state.lastPlayerId !== state.landlord;
    let ph = paramGet('playHeuristics');
    let ps = paramGet('passScores');
    if (isPartnerPlay) {
        if (features.partnerHandCount <= 3) score += ph.partnerPlay.handLe3;
        if (features.lastPlayPower >= 40) score += ph.partnerPlay.lastPowerGe40;
        if (features.lastPlayPower <= 20) score += ph.partnerPlay.lastPowerLe20;
    }
    let lordBeatPartner = role === 'farmer' && state.lastPlayerId === state.landlord
        && state.lastPlay && state.passCount === 0;
    if (lordBeatPartner) {
        if (features.needBeat) score += ph.lordBeatPartner.needBeat;
        if (features.partnerHandCount <= 4) score += ph.lordBeatPartner.handLe4;
    }
    if (features.isFarmer && features.partnerHandCount <= 2 && features.playLength <= 2) score += ph.farmerAssist.partnerHandLe2PlayLe2;
    if (features.isFarmer && features.needBeat && features.lastPlayType === 'single' && features.lastPlayPower <= 10 && features.playPower > features.lastPlayPower && features.playPower - features.lastPlayPower <= 3) score += ph.farmerBeatSmallSingle.diffLe3;
    if (features.needBeat && features.lastPlayPower >= 13 && features.remainTotal > 3 && features.playPower > features.lastPlayPower && features.playPower < 14) score += ph.needBeatLastHighRemain.lastPowerGe13;
    if (features.isLandlord && !features.needBeat && features.playLength === 1 && features.playPower <= 6) score += ph.landlordLeadSingle.le6;
    if (features.needBeat && features.lastPlayType === 'single' && features.lastPlayPower <= 8 && features.playPower > features.lastPlayPower) {
        let efficiency = features.playPower - features.lastPlayPower;
        if (efficiency <= 4) score += ph.suppressSingle.diffLe4;
        else if (efficiency <= 7) score += ph.suppressSingle.diffLe7;
        else if (efficiency <= 10) score += ph.suppressSingle.diffLe10;
        else score += ph.suppressSingle.diffGt10;
    }
    if (features.needBeat && features.lastPlayType === 'pair' && features.lastPlayPower <= 8 && features.playPower > features.lastPlayPower) {
        let efficiency = features.playPower - features.lastPlayPower;
        if (efficiency <= 4) score += ph.suppressPair.diffLe4;
        else if (efficiency <= 7) score += ph.suppressPair.diffLe7;
        else if (efficiency <= 10) score += ph.suppressPair.diffLe10;
        else score += ph.suppressPair.diffGt10;
    }
    let lastPlayerCards = state.lastPlayerId >= 0 && state.players[state.lastPlayerId] ? state.players[state.lastPlayerId].length : 20;
    if (features.needBeat && role === 'farmer' && lastPlayerCards <= 6 && features.lastPlayPower <= 10 && features.playPower > features.lastPlayPower) {
        score += ph.farmerOppLowCards.handLe6LastPowerLe10;
    }
    if (features.needBeat && role === 'farmer' && state.lastPlayerId === state.landlord && features.playPower > features.lastPlayPower) {
        if (features.lastPlayPower <= 8) score += ph.farmerVsLord.lastPowerLe8;
        else if (features.lastPlayPower <= 11) score += ph.farmerVsLord.lastPowerLe11;
    }
    if (features.needBeat && features.nextPlayerHandCount <= 2 && !features.isBomb && !features.isRocket) {
        if (features.playPower <= 12) score -= 200;
    }
    if (!features.needBeat && features.isLandlord && features.playLength <= 2) {
        if (features.playPower <= 6) score += ph.landlordLeadLowPower.powerLe6;
        if (features.playPower >= 12) score += ph.landlordLeadLowPower.powerGe12;
    }
    if (!features.needBeat && features.isFarmer && features.playLength === 1) {
        if (features.playPower >= 12) score += ph.farmerLeadHigh.powerGe12;
        if (features.playPower >= 11 && features.playPower <= 14 && features.partnerHandCount <= 4) score += ph.farmerLeadHigh.power1114PartnerLe4;
    }
    let oppAboutToWin;
    if (role === 'farmer') {
        oppAboutToWin = (state.players[state.landlord]?.length || 20) <= 2;
    } else {
        oppAboutToWin = [0, 1, 2].some(i => i !== state.landlord && (state.players[i]?.length || 20) <= 2);
    }
    let farmerWinPossible = role === 'farmer' && oppAboutToWin && features.needBeat;
    let lordWinPossible = role === 'landlord' && oppAboutToWin;
    if ((features.isBomb || features.isRocket) && oppAboutToWin) score += ph.bombUrgent.oppAboutToWin;
    if ((features.isBomb || features.isRocket) && role === 'landlord' && features.remainTotal <= 4) score += ph.bombUrgent.landlordRemainLe4;
    if ((features.isBomb || features.isRocket) && features.remainTotal <= 2) score += ph.bombUrgent.remainLe2;
    if (features.isBomb && memory.getOutsideBombCount() <= 1 && !memory.getOutsideRocketPossible()) score += ph.bombStrategic.fewOutside;
    if (features.isRocket) score += ph.bombStrategic.rocketBonus;
    if ((features.isBomb || features.isRocket) && features.needBeat && features.remainTotal > 5) {
        if (features.lastPlayPower < 40) score += ph.bombWasted.lowLastPower;
        if (features.lastPlayPower >= 40 && features.remainTotal > 8) score += ph.bombWasted.highLastPower;
    }
    if ((features.isBomb || features.isRocket) && features.needBeat && features.remainTotal > 6 && !oppAboutToWin) score += ph.bombWasted.notCritical;
    if (features.needBeat && features.remainTotal <= 3 && features.remainTotal + features.playLength <= (playerHand ? playerHand.length : 20)) score += ph.nearWin.remainLe3;
    if (features.playType === CardType.TRIPLE_WITH_SINGLE || features.playType === CardType.TRIPLE_WITH_PAIR || features.playType === CardType.PLANE_WITH_SINGLE || features.playType === CardType.PLANE_WITH_PAIR) {
        if (features.kickerValue >= 11) score += ph.kickerPenalty.ge11;
        if (features.kickerValue >= 13) score += ph.kickerPenalty.ge13;
        if (features.kickerValue >= 11 && playerHand && features.kickerValue) {
            let mainVal = features.mainValue || 0;
            let hasSmaller = playerHand.some(c => c.value !== mainVal && c.value < features.kickerValue);
            if (hasSmaller) score += ph.kickerPenalty.hasSmallerAlternative || -100;
        }
    }
    if ((features.isBomb || features.isRocket) && features.needBeat && features.remainTotal > 3) {
        if (features.lastPlayType === 'single' && features.lastPlayPower <= 12) score += ph.overkill.singleLe12 || -200;
        if (features.lastPlayType === 'pair' && features.lastPlayPower <= 10) score += ph.overkill.pairLe10 || -150;
    }
    if (playerHand) {
        let ruleCtx = {
            needBeat: !!features.needBeat,
            lastPlayType: features.lastPlayType,
            lastPlayPower: features.lastPlayPower,
            playType: features.playType,
            playPower: features.playPower,
            kickerValue: features.kickerValue,
            role: role,
            handSize: playerHand.length,
            isBomb: !!features.isBomb,
            isRocket: !!features.isRocket,
            isBombPlay: !!features.isBomb,
            isRocketPlay: !!features.isRocket,
            hasBothJokers: playerHand.some(c=>c.value===14) && playerHand.some(c=>c.value===13),
            hasSmallJoker: playerHand.some(c=>c.value===13),
            hasBigJoker: playerHand.some(c=>c.value===14)
        };
        let rules = _matchCorrectionRules(ruleCtx);
        for (let rule of rules) score += rule.penalty;
    }
    return score;
}

function computePassScore(role, state) {
    let score = 0;
    let ps = paramGet('passScores');
    let lordCards = state.players[state.landlord] ? state.players[state.landlord].length : 17;
    if (role === 'farmer') {
        let isPartner = state.lastPlayerId !== -1 && state.lastPlayerId !== state.landlord;
        if (isPartner) {
            score += ps.farmerPartnerBase;
            let partnerCards = state.players[state.lastPlayerId] ? state.players[state.lastPlayerId].length : 17;
            if (partnerCards <= 3) score += ps.farmerPartnerHandLe3;
        } else if (state.lastPlayerId === state.landlord) {
            if (lordCards <= 2) score += ps.lordHandLe2;
            else if (lordCards <= 4) score += ps.lordHandLe4;
            else score += ps.lordHandGt4;
        }
    } else {
        if (state.lastPlayerId !== -1 && state.lastPlayerId !== state.landlord) {
            score += ps.landlordFarmerPlayed;
            let farmerCards = state.players[state.lastPlayerId] ? state.players[state.lastPlayerId].length : 17;
            if (farmerCards <= 3) score += ps.landlordFarmerHandLe3;
        }
    }
    let nextP = (state.currentPlayer + 1) % 3;
    let nextCards = state.players[nextP] ? state.players[nextP].length : 17;
    let isNextOpp = role === 'farmer' ? nextP === state.landlord : nextP !== state.landlord;
    if (nextCards <= 2 && isNextOpp && state.lastPlayerId !== -1 && state.lastPlayerId !== state.currentPlayer) score -= 300;
    if (state.passCount >= 1) score += ps.passCountGe1;
    return score;
}

// ======================== 对手响应模拟 ========================
function simulateOpponentResponseV2(play, hand, state, role, memory, depth = 1) {
    let newHand = hand.filter(c => !play.includes(c));
    let newState = JSON.parse(JSON.stringify(state));
    newState.players[state.currentPlayer] = newHand;
    let nextPlayer = (state.currentPlayer + 1) % 3;
    if (newState.players[nextPlayer].length === 0) return -100;
    let lastType = getCardType(play);
    function sampleOpponentPlays(oppHand, targetPlay) {
        let plays = getAllValidPlays(oppHand, targetPlay);
        if (!plays || plays.length === 0) return null;
        let n = depth >= 2 ? 15 : 8;
        if (plays.length <= n) return plays;
        let step = Math.floor(plays.length / n);
        let result = [];
        for (let i = 0; i < n; i++) result.push(plays[Math.min(i * step, plays.length - 1)]);
        return result;
    }
    function evalState(s, pid, myRoleId, depth) {
        if (s.players[pid].length === 0) {
            let winnerRole = pid === s.landlord ? 'landlord' : 'farmer';
            return winnerRole === myRoleId ? 100 : -100;
        }
        if (depth <= 0) {
            let str = evaluateHandStrength(s.players[pid], memory, pid === s.landlord);
            let sameRole = (pid === s.landlord) === (myRoleId === 'landlord');
            return sameRole ? str : -str;
        }
        let next = (pid + 1) % 3;
        if (s.players[next].length === 0) {
            let wRole = next === s.landlord ? 'landlord' : 'farmer';
            return wRole === myRoleId ? 100 : -100;
        }
        let samples = sampleOpponentPlays(s.players[next], s.lastPlay);
        if (!samples) {
            s.passCount++;
            if (s.passCount >= 2) { s.lastPlay = null; s.lastPlayerId = -1; s.passCount = 0; }
            return evalState(s, (next+1)%3, myRoleId, depth-1);
        }
        let total = 0, count = 0;
        for (let sp of samples) {
            let s2 = JSON.parse(JSON.stringify(s));
            let spIds = new Set(sp.map(c => c.id));
            s2.players[next] = s2.players[next].filter(c => !spIds.has(c.id));
            s2.lastPlay = getCardType(sp);
            s2.lastPlayerId = next;
            s2.passCount = 0;
            if (s2.players[next].length === 0) {
                let wRole = next === s2.landlord ? 'landlord' : 'farmer';
                total += wRole === myRoleId ? 100 : -100;
                count++;
            } else {
                let third = (next+1)%3;
                let thirdSamples = sampleOpponentPlays(s2.players[third], s2.lastPlay);
                if (!thirdSamples) {
                    s2.passCount++;
                    total += evalState(s2, (third+1)%3, myRoleId, depth-1);
                    count++;
                } else {
                    for (let tp of thirdSamples) {
                        let s3 = JSON.parse(JSON.stringify(s2));
                        let tpIds = new Set(tp.map(c => c.id));
                        s3.players[third] = s3.players[third].filter(c => !tpIds.has(c.id));
                        s3.lastPlay = getCardType(tp);
                        s3.lastPlayerId = third;
                        s3.passCount = 0;
                        if (s3.players[third].length === 0) {
                            let wRole = third === s3.landlord ? 'landlord' : 'farmer';
                            total += wRole === myRoleId ? 100 : -100;
                        } else {
                            total += evalState(s3, (third+1)%3, myRoleId, depth-1);
                        }
                        count++;
                    }
                }
            }
        }
        return count > 0 ? total / count : 0;
    }
    let score = 0;
    let opponentPlays = getAllValidPlays(newState.players[nextPlayer], lastType);
    if (!opponentPlays || opponentPlays.length === 0) {
        let thirdPlayer = (nextPlayer + 1) % 3;
        if (newState.players[thirdPlayer].length === 0) score = -100;
        else score = evalState(newState, thirdPlayer, role, depth);
    } else {
        let n = depth >= 2 ? 15 : 8;
        let samples = opponentPlays.length <= n ? opponentPlays :
            (() => { let step = Math.floor(opponentPlays.length / n); let r = []; for (let i = 0; i < n; i++) r.push(opponentPlays[Math.min(i * step, opponentPlays.length - 1)]); return r; })();
        let weighted = 0, count = 0;
        for (let sp of samples) {
            let s2 = JSON.parse(JSON.stringify(newState));
            let spIds = new Set(sp.map(c => c.id));
            s2.players[nextPlayer] = s2.players[nextPlayer].filter(c => !spIds.has(c.id));
            s2.lastPlay = getCardType(sp);
            s2.lastPlayerId = nextPlayer;
            if (s2.players[nextPlayer].length === 0) {
                let wRole = nextPlayer === s2.landlord ? 'landlord' : 'farmer';
                weighted += wRole === role ? 100 : -100;
            } else {
                let third = (nextPlayer + 1) % 3;
                weighted += evalState(s2, third, role, depth);
            }
            count++;
        }
        score = count > 0 ? weighted / count : 0;
    }
    return score;
}

// ======================== DP 手牌分解 ========================
function decomposeHandDP(hand) {
    if (!hand || hand.length === 0) return { plays: [], score: 0 };
    if (hand.length > 14) return { plays: [], score: -999 };
    const n = hand.length;
    const idxToCard = hand;
    let cardIndex = {};
    hand.forEach((c, i) => { if (!cardIndex[c.id]) cardIndex[c.id] = []; cardIndex[c.id].push(i); });
    function cardsFromMask(mask) {
        let result = [];
        for (let i = 0; i < n; i++) if (mask & (1 << i)) result.push(idxToCard[i]);
        return result;
    }
    let allPlays = getAllValidPlays(hand, null);
    let playEntries = [];
    for (let play of allPlays) {
        let mask = 0;
        let used = {};
        for (let c of play) {
            let idx = -1;
            let arr = cardIndex[c.id] || [];
            for (let j of arr) {
                if (!(mask & (1 << j)) && !used[j]) { idx = j; break; }
            }
            if (idx >= 0) { mask |= (1 << idx); used[idx] = true; }
        }
        let type = getCardType(play);
        let ds = paramGet('dpScores');
        let pscore = 0;
        if (type.type === CardType.ROCKET) pscore = ds.rocket;
        else if (type.type === CardType.BOMB) pscore = ds.bomb;
        else if (type.type === CardType.STRAIGHT) pscore = ds.straight + type.length * ds.straightLenFactor;
        else if (type.type === CardType.STRAIGHT_PAIR) pscore = ds.straightPair + type.length * ds.straightPairLenFactor;
        else if (type.type === CardType.PLANE) pscore = ds.plane + type.length * ds.planeLenFactor;
        else if (type.type === CardType.PLANE_WITH_SINGLE || type.type === CardType.PLANE_WITH_PAIR) {
            let target = type.type === CardType.PLANE_WITH_SINGLE ? 1 : 2;
            let cnt = countValues(play.map(c=>c.value));
            let kickerVals = Object.keys(cnt).filter(k => cnt[k] === target).map(Number);
            let maxKicker = kickerVals.length > 0 ? Math.max(...kickerVals) : 0;
            pscore = ds.planeWith - Math.max(0, maxKicker - 7) * 3 * type.length;
        }
        else if (type.type === CardType.TRIPLE_WITH_SINGLE || type.type === CardType.TRIPLE_WITH_PAIR) {
            let target = type.type === CardType.TRIPLE_WITH_SINGLE ? 1 : 2;
            let cnt = countValues(play.map(c=>c.value));
            let kickerVal = parseInt(Object.keys(cnt).find(k => cnt[k] === target && parseInt(k) !== type.value)) || 0;
            pscore = ds.tripleWith - Math.max(0, kickerVal - 7) * 3;
        }
        else if (type.type === CardType.PAIR) pscore = ds.pair;
        else if (type.type === CardType.TRIPLE) pscore = ds.triple;
        else pscore = ds.single;
        if (play.length === hand.length) pscore += ds.completeBonus;
        playEntries.push({ mask, score: pscore, play });
    }
    let totalMasks = 1 << n;
    let dp = new Array(totalMasks).fill(null);
    let prev = new Array(totalMasks).fill(null);
    dp[0] = 0;
    for (let mask = 0; mask < totalMasks; mask++) {
        if (dp[mask] === null) continue;
        for (let pe of playEntries) {
            if (mask & pe.mask) continue;
            let newMask = mask | pe.mask;
            let newScore = dp[mask] + pe.score;
            if (dp[newMask] === null || newScore > dp[newMask]) {
                dp[newMask] = newScore;
                prev[newMask] = { from: mask, entry: pe };
            }
        }
    }
    let bestMask = 0, bestScore = (dp[totalMasks-1] !== null) ? dp[totalMasks-1] : -999;
    if (dp[totalMasks-1] !== null) bestMask = totalMasks - 1;
    else {
        for (let mask = 0; mask < totalMasks; mask++) {
            if (dp[mask] !== null && dp[mask] > bestScore) { bestScore = dp[mask]; bestMask = mask; }
        }
    }
    let plays = [];
    let m = bestMask;
    while (m > 0 && prev[m] !== null) {
        plays.push(prev[m].entry.play);
        m = prev[m].from;
    }
    let uncovered = cardsFromMask(bestMask ^ (totalMasks - 1));
    for (let c of uncovered) plays.push([c]);
    plays.reverse();
    let remaining = hand.filter(c => !plays.flat().includes(c));
    for (let c of remaining) plays.push([c]);
    return { plays, score: bestScore };
}

// ======================== 残局求解 ========================
function solveEndgame(state, playerId) {
    let hand = state.players[playerId];
    if (!hand || hand.length > 14) return null;
    let totalCards = state.players.reduce((s, p) => s + p.length, 0);
    if (totalCards > 16) return null;
    let bestPlay = null, bestScore = -Infinity;
    let lastPlay = state.lastPlay;
    let needBeat = lastPlay && state.lastPlayerId !== playerId;
    let plays = needBeat ? getAllValidPlays(hand, lastPlay) : getAllValidPlays(hand, null);
    let ctx = { nodes: 0, limit: 40000, tt: new Map(), truncated: false };
    for (let p of plays) {
        let simState = JSON.parse(JSON.stringify(state));
        let pIds = new Set(p.map(c => c.id));
        simState.players[playerId] = simState.players[playerId].filter(c => !pIds.has(c.id));
        if (simState.players[playerId].length === 0) return p;
        simState.lastPlay = getCardType(p);
        simState.lastPlayerId = playerId;
        simState.passCount = 0;
        let win = minimaxEndgame(simState, (playerId + 1) % 3, playerId, 0, 20, -999, 999, ctx);
        if (win > bestScore) { bestScore = win; bestPlay = p; }
        if (ctx.truncated) break;
    }
    return bestPlay;
}

function _endgameStaticEval(state, myId) {
    let isLord = (myId === state.landlord);
    let score = 0;
    for (let i = 0; i < 3; i++) {
        let sign = (i === state.landlord) ? (isLord ? -1 : 1) : (isLord ? 1 : -1);
        let p = state.players[i];
        for (let j = 0; j < p.length; j++) {
            let v = p[j].value;
            score += sign * (1 + (v >= 12 ? 2 : 0));
        }
    }
    return Math.max(-60, Math.min(60, score));
}

function _endgameKey(state, currentPlayer) {
    let k = currentPlayer + '|' + state.lastPlayerId + '|' + state.passCount + '|'
        + (state.lastPlay ? state.lastPlay.type + ':' + state.lastPlay.value + ':' + (state.lastPlay.length || '') : '-') + '|';
    for (let i = 0; i < 3; i++) {
        k += state.players[i].map(c => c.id).sort().join(',') + ';';
    }
    return k;
}

function minimaxEndgame(state, currentPlayer, myId, depth, maxDepth, alpha = -999, beta = 999, ctx) {
    if (!ctx) ctx = { nodes: 0, limit: Infinity, tt: null, truncated: false };
    ctx.nodes++;
    if (ctx.nodes > ctx.limit) { ctx.truncated = true; return _endgameStaticEval(state, myId); }
    if (depth > maxDepth) return _endgameStaticEval(state, myId);

    let mySide = (myId === state.landlord) ? [myId] : [0,1,2].filter(i => i !== state.landlord);
    for (let i = 0; i < 3; i++) {
        if (state.players[i].length === 0) return mySide.includes(i) ? 100 - depth : -100 + depth;
    }
    if (state.passCount >= 2) {
        state.lastPlay = null;
        state.lastPlayerId = -1;
        state.passCount = 0;
    }
    let hand = state.players[currentPlayer];
    if (hand.length === 0) {
        return mySide.includes(currentPlayer) ? 100 - depth : -100 + depth;
    }
    let key = null;
    if (ctx.tt) {
        key = _endgameKey(state, currentPlayer);
        let ttEntry = ctx.tt.get(key);
        if (ttEntry && ttEntry.depth >= maxDepth - depth) {
            if (ttEntry.flag === 'exact') return ttEntry.value;
            if (ttEntry.flag === 'lower' && ttEntry.value >= beta) return ttEntry.value;
            if (ttEntry.flag === 'upper' && ttEntry.value <= alpha) return ttEntry.value;
        }
    }
    let needBeat = state.lastPlay && state.lastPlayerId !== currentPlayer;
    let plays = needBeat ? getAllValidPlays(hand, state.lastPlay) : getAllValidPlays(hand, null);
    if (plays.length === 0) {
        let s2 = JSON.parse(JSON.stringify(state));
        s2.passCount++;
        return minimaxEndgame(s2, (currentPlayer + 1) % 3, myId, depth + 1, maxDepth, alpha, beta, ctx);
    }
    let isMax = mySide.includes(currentPlayer);
    plays.sort((a,b) => isMax ? getPlayPower(b) - getPlayPower(a) : getPlayPower(a) - getPlayPower(b));
    let best = isMax ? -999 : 999;
    let flag = 'exact';
    let nodeTruncated = false;
    for (let p of plays) {
        let s2 = JSON.parse(JSON.stringify(state));
        let pIds = new Set(p.map(c => c.id));
        s2.players[currentPlayer] = s2.players[currentPlayer].filter(c => !pIds.has(c.id));
        let bombDepth = (getCardType(p) && (getCardType(p).type === CardType.BOMB || getCardType(p).type === CardType.ROCKET)) ? 1 : 0;
        s2.lastPlay = getCardType(p);
        s2.lastPlayerId = currentPlayer;
        s2.passCount = 0;
        let val = minimaxEndgame(s2, (currentPlayer + 1) % 3, myId, depth + 1 + bombDepth, maxDepth, alpha, beta, ctx);
        if (isMax) {
            if (val > best) best = val;
            if (best > alpha) alpha = best;
        } else {
            if (val < best) best = val;
            if (best < beta) beta = best;
        }
        if (alpha >= beta) { flag = isMax ? 'lower' : 'upper'; break; }
        if (ctx.truncated) { nodeTruncated = true; break; }
    }
    if (ctx.tt && !ctx.truncated && !nodeTruncated) {
        ctx.tt.set(key, { value: best, depth: maxDepth - depth, flag });
    }
    return best;
}

// ======================== 启发式模拟 ========================
function heuristicPlayoutWithMode(state, startPlayer, myId, memory, deterministic) {
    let s = JSON.parse(JSON.stringify(state));
    let cp = startPlayer;
    let mySide = (myId === s.landlord) ? [myId] : [0,1,2].filter(i => i !== s.landlord);
    let hp = paramGet('heuristicPlayout');
    for (let step = 0; step < hp.stepLimit; step++) {
        for (let i = 0; i < 3; i++) {
            if (s.players[i].length === 0) return mySide.includes(i);
        }
        if (s.passCount >= 2) { s.lastPlay = null; s.lastPlayerId = -1; s.passCount = 0; }
        let hand = s.players[cp];
        if (hand.length === 0) { cp = (cp + 1) % 3; continue; }
        let needBeat = s.lastPlay && s.lastPlayerId !== cp;
        let plays = needBeat ? getAllValidPlays(hand, s.lastPlay) : getAllValidPlays(hand, null);
        if (plays.length === 0) { s.passCount++; cp = (cp + 1) % 3; continue; }
        let role = cp === s.landlord ? 'landlord' : 'farmer';
        let scored = plays.map(p => {
            let feat = extractPlayFeatures(p, hand, s.lastPlay, role, memory, s);
            return { play: p, score: scorePlay(feat, role, memory, s, hand) };
        });
        scored.sort((a,b) => b.score - a.score);
        let chosenPlay = scored[0].play;
        if (!deterministic) {
            let r = Math.random();
            if (r >= hp.bestProb && scored.length > 1) chosenPlay = scored[1].play;
            if (r >= hp.top2Prob && scored.length > 2) chosenPlay = scored[2].play;
        }
        s.players[cp] = s.players[cp].filter(c => !chosenPlay.includes(c));
        s.lastPlay = getCardType(chosenPlay);
        s.lastPlayerId = cp;
        s.passCount = 0;
        if (s.players[cp].length === 0) return mySide.includes(cp);
        cp = (cp + 1) % 3;
    }
    return false;
}

// ======================== MCTS ========================
class MCTSNode {
    constructor(state, play, playerToMove, myId) {
        this.state = state;
        this.play = play;
        this.playerToMove = playerToMove;
        this.myId = myId;
        this.visits = 0;
        this.wins = 0;
        this.parent = null;
        this.children = [];
        this.unexpandedPlays = null;
    }
    get isTerminal() {
        return this.state.phase === 'gameover' ||
            (this.state.players && this.state.players.some((p, i) => p && p.length === 0));
    }
    get isFullyExpanded() {
        if (this.unexpandedPlays === null) return false;
        return this.unexpandedPlays.length === 0;
    }
    getUCB1(child, C) {
        if (C === undefined) C = paramGet('mcts.ucbC');
        if (child.visits === 0) return 1e9;
        return child.wins / child.visits + C * Math.sqrt(Math.log(Math.max(1, this.visits)) / child.visits);
    }
    selectChild() {
        let best = null, bestScore = -1e9;
        for (let child of this.children) {
            let score = this.getUCB1(child);
            if (score > bestScore) { bestScore = score; best = child; }
        }
        return best;
    }
    expand() {
        if (this.unexpandedPlays === null) {
            let hand = this.state.players[this.playerToMove];
            let needBeat = this.state.lastPlay && this.state.lastPlayerId !== this.playerToMove;
            this.unexpandedPlays = needBeat ? getAllValidPlays(hand, this.state.lastPlay) : getAllValidPlays(hand, null);
            if (needBeat) this.unexpandedPlays.push([]);
        }
        let play = this.unexpandedPlays.pop();
        let newState = JSON.parse(JSON.stringify(this.state));
        let nextPlayer = (this.playerToMove + 1) % 3;
        if (!play || play.length === 0) {
            newState.passCount = (newState.passCount || 0) + 1;
        } else {
            let playIds = new Set(play.map(c => c.id));
            newState.players[this.playerToMove] = newState.players[this.playerToMove].filter(c => !playIds.has(c.id));
            newState.lastPlay = getCardType(play);
            newState.lastPlayerId = this.playerToMove;
            newState.passCount = 0;
            if (newState.players[this.playerToMove].length === 0) newState.phase = 'gameover';
        }
        if (newState.passCount >= 2) { newState.lastPlay = null; newState.lastPlayerId = -1; newState.passCount = 0; }
        let child = new MCTSNode(newState, play || [], nextPlayer, this.myId);
        child.parent = this;
        this.children.push(child);
        return child;
    }
    bestChild() {
        let best = null, bestVisits = -1;
        for (let child of this.children) {
            if (child.visits > bestVisits) { bestVisits = child.visits; best = child; }
        }
        return best;
    }
}

function mctsSearch(state, playerId, iterations, memory, timeLimit) {
    if (timeLimit === undefined) timeLimit = paramGet('mcts.timeLimit');
    let hand = state.players[playerId];
    if (!hand || hand.length === 0) return null;
    let root = new MCTSNode(JSON.parse(JSON.stringify(state)), null, state.currentPlayer, playerId);
    let startTime = Date.now();
    for (let i = 0; i < iterations; i++) {
        if (Date.now() - startTime > timeLimit) break;
        let node = root;
        while (!node.isTerminal && node.children.length > 0 && node.isFullyExpanded) node = node.selectChild();
        if (!node.isTerminal && !node.isFullyExpanded) node = node.expand();
        let result;
        if (node.isTerminal) {
            let mySide = (playerId === node.state.landlord) ? [playerId] : [0,1,2].filter(i => i !== node.state.landlord);
            result = node.state.players.some((p, i) => mySide.includes(i) && p && p.length === 0);
        } else {
            result = heuristicPlayoutWithMode(node.state, node.playerToMove, playerId, memory, false);
        }
        while (node) { node.visits++; if (result) node.wins++; node = node.parent; }
    }
    let best = root.bestChild();
    if (best && best.play && best.play.length > 0) return best;
    let needBeat = state.lastPlay && state.lastPlayerId !== playerId;
    let fallbackPlays = needBeat ? getAllValidPlays(hand, state.lastPlay) : getAllValidPlays(hand, null);
    if (fallbackPlays.length > 0) return { play: fallbackPlays[0], visits: 0, wins: 0 };
    return null;
}

// ======================== 迷你 AI 引擎 (纯计算版) ========================
class MiniMasterAI {
    constructor(id, difficulty, memory) { this.id = id; this.difficulty = difficulty; this.memory = memory; }
    think(phase, state) {
        if (phase === 'call') return this.callDecision(state);
        return this.playDecision(state);
    }
    callDecision(state) {
        let curr = state.baseScore;
        let ct = paramGet('callThresholds.' + this.difficulty) || {};
        if (this.difficulty === 'easy') {
            let strength = evaluateHandStrength(state.players[this.id], this.memory, false, this.id);
            return strength > (ct.one || 28) && curr < 1 ? 1 : 0;
        }
        if (this.difficulty === 'medium') {
            let strength = evaluateHandStrength(state.players[this.id], this.memory, false, this.id);
            if (strength > (ct.three || 42) && curr < 3) return 3;
            if (strength > (ct.two || 32) && curr < 2) return 2;
            if (strength > (ct.one || 22) && curr < 1) return 1;
            return 0;
        }
        if (this.difficulty === 'legendary') {
            let bestBid = 0, bestEV = -999;
            for (let bid = 1; bid <= 3; bid++) {
                if (bid <= curr) continue;
                let sim = JSON.parse(JSON.stringify(state));
                sim.players[this.id] = [...sim.players[this.id], ...sim.lordCards];
                sim.landlord = this.id;
                let wins = 0, trials = 200;
                for (let i = 0; i < trials; i++) {
                    let rs = JSON.parse(JSON.stringify(sim));
                    if (heuristicPlayoutWithMode(rs, (this.id + 1) % 3, this.id, this.memory, false)) wins++;
                }
                let winRate = wins / trials;
                let ev = winRate * bid - (1 - winRate) * bid * 2;
                if (ev > bestEV) { bestEV = ev; bestBid = bid; }
            }
            return bestBid;
        }
        let strength = evaluateHandStrength(state.players[this.id], this.memory, false, this.id);
        let bombBonus = 0;
        let values = state.players[this.id].map(c=>c.value);
        let cnt = countValues(values);
        for (let v in cnt) if (cnt[v] === 4) bombBonus += (ct.bombBonus || 20);
        if (cnt[13] === 1 && cnt[14] === 1) bombBonus += (ct.bothJokersBonus || 20);
        strength += bombBonus;
        let singlePenalty = Object.values(cnt).filter(c => c === 1).length * (ct.singlePenaltyFactor || 3);
        strength -= singlePenalty;
        if (this.id === 2) strength += (ct.positionBonus || 8);
        if (strength > (ct.three || 42) && curr < 3) return 3;
        if (strength > (ct.two || 30) && curr < 2) return 2;
        if (strength > (ct.one || 20) && curr < 1) return 1;
        return 0;
    }
    playDecision(state) {
        let hand = [...state.players[this.id]];
        if (hand.length === 0) return [];
        let lastPlay = state.lastPlay;
        let role = (this.id === state.landlord) ? 'landlord' : 'farmer';
        let partnerId = null;
        if (role === 'farmer') {
            for (let i = 0; i < 3; i++) {
                if (i !== this.id && i !== state.landlord) { partnerId = i; break; }
            }
        }
        let endgameLimit = paramGet('endgameThresholds.' + this.difficulty) || 10;
        if (hand.length <= endgameLimit) {
            let egResult = solveEndgame(state, this.id);
            if (egResult) return egResult;
        }
        let mctsLimit = paramGet('mcts.handLimit.' + this.difficulty) || 0;
        let mctsIters = paramGet('mcts.iterations.' + this.difficulty) || 0;
        if ((this.difficulty === 'hard' || this.difficulty === 'grandmaster' || this.difficulty === 'legendary') && hand.length <= mctsLimit) {
            let mctsResult = mctsSearch(state, this.id, mctsIters, this.memory);
            if (mctsResult && mctsResult.play && mctsResult.play.length > 0) return mctsResult.play;
        }
        if (lastPlay && state.lastPlayerId !== this.id) {
            if (lastPlay.type === CardType.ROCKET) return [];
            if (lastPlay.type === CardType.BOMB) {
                let hasBeatingBomb = Object.values(hand.reduce((a,c)=>(a[c.value]=(a[c.value]||0)+1,a),{})).some(v=>v===4);
                if (!hasBeatingBomb && !(hand.some(c=>c.value===13) && hand.some(c=>c.value===14))) return [];
            }
        }
        if (!lastPlay || state.lastPlayerId === this.id) {
            let allPlays = getAllValidPlays(hand, null);
            return this.selectLeadSmart(allPlays, role, hand, state, partnerId);
        }
        let beatable = getAllValidPlays(hand, lastPlay);
        if (beatable.length === 0) return [];
        let scored = beatable.map(play => {
            let features = extractPlayFeatures(play, hand, lastPlay, role, this.memory, state);
            let baseScore = scorePlay(features, role, this.memory, state, hand);
            let simScore = 0;
            let simDepth = paramGet('simulation.depth.' + this.difficulty) || 0;
            let simHandLimit = paramGet('simulation.handLimit.' + this.difficulty) || 0;
            let dpBonusFactor = paramGet('simulation.dpBonusFactor.' + this.difficulty) || 0;
            if (simDepth > 0 && hand.length <= simHandLimit) {
                simScore = simulateOpponentResponseV2(play, hand, state, role, this.memory, simDepth);
                if (dpBonusFactor > 0) {
                    let newHand = hand.filter(c => !play.includes(c));
                    let dpPlan = decomposeHandDP(newHand);
                    simScore += dpPlan.score * dpBonusFactor;
                }
            }
            return { play, score: baseScore + simScore * 0.4 };
        });
        let passScore = computePassScore(role, state);
        scored.push({ play: [], score: passScore });
        scored.sort((a,b)=>b.score - a.score);
        if (scored[0].play.length === 0) return [];
        let isCritical = (hand.length <= 3) || (this.memory.getMaxOutside(hand) <= 12 && hand.length <= 5);
        let roleP = (state.landlord === this.id) ? 'landlord' : 'farmer';
        let oppCloseToWin;
        if (roleP === 'farmer') {
            oppCloseToWin = (state.players[state.landlord]?.length || 20) <= 2;
        } else {
            oppCloseToWin = [0, 1, 2].some(i => i !== state.landlord && (state.players[i]?.length || 20) <= 2);
        }
        let noRandom = isCritical || oppCloseToWin;
        let rf = paramGet('randomFactors');
        let randomFactor = rf[this.difficulty] !== undefined ? rf[this.difficulty] : 0.6;
        if (!noRandom && Math.random() < randomFactor && scored.length > 1 && scored[1].play.length > 0) {
            return scored[1].play;
        }
        return scored[0].play;
    }
    selectLeadSmart(plays, role, hand, state, partnerId) {
        if (plays.length === 0) return [];
        let fullHouse = plays.find(p => p.length === hand.length);
        if (fullHouse) return fullHouse;
        if (role === 'landlord') {
            let _oppMin = Math.min(
                (state.players[(state.currentPlayer + 1) % 3] || {length:20}).length,
                (state.players[(state.currentPlayer + 2) % 3] || {length:20}).length
            );
            let nextId = (state.currentPlayer + 1) % 3;
            let nextClose = ((state.players[nextId] || {length:20}).length) <= 2;
            let dpLimit = paramGet('endgameThresholds.' + this.difficulty) || 12;
            let sl = paramGet('selectLead.landlord');
            if (hand.length <= dpLimit) {
                let plan = decomposeHandDP(hand);
                if (plan.plays.length > 0) {
                    let bestLead = null, bestLeadScore = -Infinity;
                    for (let p of plan.plays) {
                        let score = -getPlayPower(p);
                        let type = getCardType(p);
                        if (type && (type.type === CardType.BOMB || type.type === CardType.ROCKET)) score += sl.bombPenalty;
                        if (p.length >= 5) score += sl.longGte5;
                        else if (p.length >= 3) score += sl.longGte3;
                        else if (p.length === 2) score += sl.pairPlay;
                        if (type && type.type === CardType.STRAIGHT) score += sl.straightBonus;
                        if (type && type.type === CardType.STRAIGHT_PAIR) score += sl.straightPairBonus;
                        if (type && type.type === CardType.PLANE) score += sl.planeBonus;
                        if (type && (type.type === CardType.PLANE_WITH_SINGLE || type.type === CardType.PLANE_WITH_PAIR)) score += sl.planeWithBonus;
                        if (type && (type.type === CardType.TRIPLE_WITH_SINGLE || type.type === CardType.TRIPLE_WITH_PAIR)) score += sl.tripleWithBonus;
                        let val = p[0].value;
                        if (nextClose && p.length === 1 && val < 12) {
                            score = -500 + val * 3;
                        } else {
                            if (val <= 6) score += sl.smallValLe6;
                            if (val >= 12 && p.length <= 2) score += sl.controlValGe12LenLe2;
                            if (_oppMin <= 2 && p.length <= 2 && val < 12) score -= 500;
                        }
                        if (score > bestLeadScore) { bestLeadScore = score; bestLead = p; }
                    }
                    if (bestLead) return bestLead;
                }
            }
            let straightPlays = plays.filter(p => getCardType(p)?.type === CardType.STRAIGHT);
            if (straightPlays.length) return straightPlays.sort((a,b)=>b.length-a.length)[0];
            let planePlays = plays.filter(p => {
                let t = getCardType(p);
                return t && (t.type === CardType.PLANE || t.type === CardType.PLANE_WITH_SINGLE || t.type === CardType.PLANE_WITH_PAIR);
            });
            if (planePlays.length > 0) return planePlays.reduce((a,b) => getCardType(a).value < getCardType(b).value ? a : b);
            let triplePlays = plays.filter(p => {
                let t = getCardType(p);
                return t && (t.type === CardType.TRIPLE_WITH_SINGLE || t.type === CardType.TRIPLE_WITH_PAIR);
            });
            if (triplePlays.length > 0) return triplePlays.reduce((a,b) => getCardType(a).value < getCardType(b).value ? a : b);
            let smallPairs = plays.filter(p => p.length === 2 && getCardType(p).value <= 6);
            if (smallPairs.length > 0) return smallPairs.reduce((a,b) => getCardType(a).value < getCardType(b).value ? a : b);
            if (_oppMin > 2) {
                let twoPlay = plays.find(p => {
                    if (p.length === hand.length) return true;
                    let rest = hand.filter(c => !p.includes(c));
                    let restPlays = getAllValidPlays(rest, null);
                    return rest.length === 0 || restPlays.some(rp => rp.length === rest.length);
                });
                if (twoPlay) return twoPlay;
            }
            if (nextClose) {
                let singles = plays.filter(p => p.length === 1);
                if (singles.length > 0 && plays.every(p => p.length === 1)) {
                    return singles.sort((a,b)=>getPlayPower(b)-getPlayPower(a))[0];
                }
            }
            if (_oppMin <= 2) {
                let safe = plays.filter(p => p.length !== 1 || p[0].value >= 10);
                if (safe.length > 0) return safe.sort((a,b)=>getPlayPower(a)-getPlayPower(b))[0];
            }
            let smallSingles = plays.filter(p => p.length === 1 && p[0].value <= 6);
            if (smallSingles.length > 0) return smallSingles.reduce((a,b) => a[0].value < b[0].value ? a : b);
            return plays.sort((a,b)=>getPlayPower(a)-getPlayPower(b))[0];
        } else {
            let isLordNext = (state.landlord + 1) % 3 === this.id;
            let partnerCount = state.players[partnerId !== null ? partnerId : -1]?.length || 20;
            let lordCards = state.players[state.landlord] ? state.players[state.landlord].length : 20;
            if (partnerCount <= 2 && lordCards > 2) {
                return plays.reduce((a,b) => getPlayPower(a) < getPlayPower(b) ? a : b);
            }
            if (lordCards <= 2) {
                let combos = plays.filter(p => p.length >= 3 && getCardType(p)?.type !== CardType.BOMB && getCardType(p)?.type !== CardType.ROCKET);
                if (combos.length > 0) return combos.reduce((a,b) => getPlayPower(a) > getPlayPower(b) ? a : b);
                return plays.reduce((a,b) => getPlayPower(a) > getPlayPower(b) ? a : b);
            }
            if (isLordNext) {
                let midSingle = plays.find(p => p.length === 1 && p[0].value >= 7 && p[0].value <= 10);
                if (midSingle) return midSingle;
                let smallSingle = plays.find(p => p.length === 1 && p[0].value <= 6);
                if (smallSingle) return smallSingle;
                let smallPair = plays.find(p => p.length === 2 && getCardType(p).value <= 10);
                if (smallPair) return smallPair;
                let midPlay = plays.find(p => p.length >= 3 && getPlayPower(p) <= 60);
                if (midPlay) return midPlay;
            } else {
                let nextLordClose = ((state.players[(state.currentPlayer + 1) % 3] || {length:20}).length) <= 4;
                if (nextLordClose) {
                    let combos = plays.filter(p => {
                        let t = getCardType(p);
                        return p.length >= 3 && t && t.type !== CardType.BOMB && t.type !== CardType.ROCKET;
                    });
                    if (combos.length > 0) return combos.reduce((a,b) => getPlayPower(a) > getPlayPower(b) ? a : b);
                    return plays.reduce((a,b) => getPlayPower(a) > getPlayPower(b) ? a : b);
                }
                let midSingle = plays.find(p => p.length === 1 && p[0].value >= 7 && p[0].value <= 10);
                if (midSingle) return midSingle;
                let midPair = plays.find(p => p.length === 2 && getCardType(p).value >= 7 && getCardType(p).value <= 10);
                if (midPair) return midPair;
                let smallSingle = plays.find(p => p.length === 1 && p[0].value <= 6);
                if (smallSingle) return smallSingle;
                let smallPair = plays.find(p => p.length === 2 && getCardType(p).value <= 8);
                if (smallPair) return smallPair;
            }
            let dpLimit = paramGet('endgameThresholds.' + this.difficulty) || 12;
            let sl = paramGet('selectLead.farmer');
            if (hand.length <= dpLimit) {
                let plan = decomposeHandDP(hand);
                if (plan.plays.length > 0) {
                    let bestLead = null, bestLeadScore = -Infinity;
                    for (let p of plan.plays) {
                        let score = -getPlayPower(p);
                        let type = getCardType(p);
                        if (type && (type.type === CardType.BOMB || type.type === CardType.ROCKET)) score += sl.bombPenalty;
                        if (p.length >= 3) score += sl.comboGte3;
                        if (partnerCount <= 3) score += sl.partnerLow;
                        if (isLordNext) score += sl.lordNext;
                        if (score > bestLeadScore) { bestLeadScore = score; bestLead = p; }
                    }
                    if (bestLead) return bestLead;
                }
            }
            let midSingle2 = plays.find(p => p.length === 1 && p[0].value >= 7 && p[0].value <= 10);
            if (midSingle2) return midSingle2;
            let smallPair2 = plays.find(p => p.length === 2 && getCardType(p).value <= 8);
            if (smallPair2) return smallPair2;
            return plays.sort((a,b)=>getPlayPower(a)-getPlayPower(b))[0];
        }
    }
}

// ======================== Worker 消息处理 ========================
let _pending = {};

function rebuildMemory(data) {
    let m = new MasterMemory();
    if (!data) return m;
    m.remain = data.remain;
    m.seen = new Set(data.seen);
    m.history = data.history.map(arr => [...arr]);
    m.playerHistory = data.playerHistory.map(arr => arr.map(a => [...a]));
    m.totalCardsPlayed = [...data.totalCardsPlayed];
    return m;
}

function reconstructPlays(playsData) {
    if (!playsData) return [];
    return playsData.map(p => p.map(c => ({ ...c })));
}

self.onmessage = function(e) {
    const msg = e.data;
    try {
        switch (msg.cmd) {
            case 'init': {
                if (msg.params) _params = msg.params;
                if (msg.correctionRules) _correctionRules = msg.correctionRules;
                self.postMessage({ status: 'ready' });
                break;
            }
            case 'think': {
                let state = msg.state;
                let memory = rebuildMemory(msg.memory);
                let ai = new MiniMasterAI(msg.playerId, msg.difficulty, memory);
                let result;
                if (msg.phase === 'mcts') {
                    let mctsResult = mctsSearch(state, msg.playerId, msg.iterations, memory);
                    result = mctsResult ? { play: mctsResult.play, visits: mctsResult.visits, wins: mctsResult.wins } : { play: [], visits: 0, wins: 0 };
                } else {
                    result = ai.think(msg.phase, state);
                }
                self.postMessage({
                    taskId: msg.taskId,
                    result: result,
                    memory: {
                        remain: memory.remain,
                        seen: [...memory.seen],
                        history: memory.history.map(arr => [...arr]),
                        playerHistory: memory.playerHistory.map(arr => arr.map(a => [...a])),
                        totalCardsPlayed: [...memory.totalCardsPlayed]
                    }
                });
                break;
            }
            case 'mcts': {
                let state = msg.state;
                let memory = rebuildMemory(msg.memory);
                let mctsResult = mctsSearch(state, msg.playerId, msg.iterations, memory);
                self.postMessage({
                    taskId: msg.taskId,
                    play: mctsResult ? mctsResult.play : [],
                    visits: mctsResult ? mctsResult.visits : 0,
                    wins: mctsResult ? mctsResult.wins : 0
                });
                break;
            }
            case 'simulate': {
                let memory = rebuildMemory(msg.memory);
                let state = msg.state;
                let scores = msg.plays.map(play => {
                    let cards = play.map(c => ({ ...c }));
                    let features = extractPlayFeatures(cards, msg.hand, state.lastPlay, msg.role, memory, state);
                    let baseScore = scorePlay(features, msg.role, memory, state, msg.hand);
                    let simScore = 0;
                    if (msg.depth > 0) {
                        simScore = simulateOpponentResponseV2(cards, msg.hand, state, msg.role, memory, msg.depth);
                    }
                    return baseScore + simScore * 0.4;
                });
                self.postMessage({ taskId: msg.taskId, scores });
                break;
            }
        }
    } catch (err) {
        self.postMessage({ taskId: msg.taskId, error: err.message });
    }
};
self.postMessage({ status: 'ready' });
