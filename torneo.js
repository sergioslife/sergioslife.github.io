// ==================================================
// GESTOR DE TORNEOS COMMANDER
// ==================================================

const STORAGE_KEY = 'commander-tournaments';

const app = {
    tournaments: [],
    currentTournamentId: null,
    timerInterval: null,
    roundStartTime: null,
    roundPausedTime: 0,
    pausedDuration: 0,
    timerAlertsShown: [],
    currentEditTableId: null,
    isEditingRound: false,
    originalRoundTables: null,
    currentEditRoundIndex: null,
    editingTableId: null,

    init() {
        this.loadTournaments();
        this.showTournaments();
        this.updateYear();
    },

    // ========================
    // PERSISTENCIA
    // ========================
    loadTournaments() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            this.tournaments = data ? JSON.parse(data) : [];
        } catch (e) {
            this.tournaments = [];
        }
    },

    saveTournaments() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tournaments));
    },

    getCurrentTournament() {
        return this.tournaments.find(t => t.id === this.currentTournamentId) || null;
    },

    // ========================
    // NAVEGACIÓN
    // ========================
    showView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        window.scrollTo({top: 0, behavior: 'smooth'});
    },

    showTournaments() {
        this.currentTournamentId = null;
        this.renderTournamentsList();
        this.showView('view-tournaments');
    },

    showTournament(id) {
        this.currentTournamentId = id;
        this.renderTournamentDetail();
        this.showView('view-tournament');
    },

    // ========================
    // LISTA DE TORNEOS
    // ========================
    renderTournamentsList() {
        const container = document.getElementById('tournaments-list');
        if (!this.tournaments.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-trophy"></i>
                    <p>No hay torneos creados. Crea uno para comenzar.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.tournaments.map(t => {
            const playerCount = t.players ? t.players.length : 0;
            const roundCount = t.rounds ? t.rounds.length : 0;
            const statusLabel = this.getStatusLabel(t.status);
            const date = new Date(t.date).toLocaleDateString('es-CO', {day: 'numeric', month: 'short', year: 'numeric'});

            return `
                <article class="tournament-card" onclick="app.showTournament('${t.id}')">
                    <h3>${this.escapeHtml(t.name)}</h3>
                    <div class="meta"><i class="far fa-calendar"></i> ${date}</div>
                    <div class="meta"><i class="fas fa-users"></i> ${playerCount} jugadores · ${roundCount} rondas</div>
                    <span class="badge badge-${t.status}">${statusLabel}</span>
                </article>
            `;
        }).join('');
    },

    getStatusLabel(status) {
        const key = `app.status_${status}`;
        if (window.currentLang && window.translations && window.translations[window.currentLang] && window.translations[window.currentLang][key]) {
            return window.translations[window.currentLang][key];
        }
        const labels = {
            setup: 'Configuración',
            active: 'En curso',
            finished: 'Finalizado'
        };
        return labels[status] || status;
    },

    // ========================
    // MODAL CREAR TORNEO
    // ========================
    showCreateModal() {
        document.getElementById('modal-create').style.display = 'flex';
        document.getElementById('input-t-name').focus();
    },

    hideCreateModal() {
        document.getElementById('modal-create').style.display = 'none';
        document.getElementById('form-create-tournament').reset();
        const recBox = document.getElementById('tournament-recommendation');
        if (recBox) recBox.style.display = 'none';
    },

    createTournament(e) {
        e.preventDefault();
        const name = document.getElementById('input-t-name').value.trim();
        const date = document.getElementById('input-t-date').value;
        const format = document.getElementById('input-t-format').value;

        if (!name || !date) return;

        const isCommander = ['commander'].includes(format);
        const is1v1 = ['pioneer', 'modern', 'standard', 'legacy', 'pauper', 'draft', 'sealed', 'other', '1v1'].includes(format);
        const is2hg = format === 'two-headed-giant';

        const tournament = {
            id: this.generateId(),
            name,
            date,
            format,
            status: 'setup',
            players: [],
            rounds: [],
            roundsCount: 0,
            roundDuration: 0,
            tableSize: 'auto',
            distributionModel: 'auto',
            customAllowedSizes: [3, 4, 5],
            scoring: null,
            competitionSystem: is1v1 || is2hg ? 'swiss' : null,
            matchFormat: is1v1 ? 'bo3' : (is2hg ? 'bo1' : null),
            teamCreation: is2hg ? 'random' : null,
            createdAt: Date.now()
        };

        if (isCommander) {
            const roundDuration = parseInt(document.getElementById('input-t-duration').value, 10) || 50;
            const tableSize = document.getElementById('input-t-tablesize').value;
            const distributionModel = document.getElementById('input-t-distribution').value || 'auto';
            const customAllowedSizes = this.getCustomAllowedSizes();

            tournament.roundDuration = roundDuration;
            tournament.tableSize = tableSize;
            tournament.distributionModel = distributionModel;
            tournament.customAllowedSizes = customAllowedSizes;
            tournament.scoring = {
                2: {1: 2, 2: 1},
                3: {1: 3, 2: 2, 3: 1},
                4: {1: 4, 2: 3, 3: 2, 4: 1},
                5: {1: 5, 2: 4, 3: 3, 4: 2, 5: 1}
            };
        } else if (is1v1 || is2hg) {
            const roundDuration = parseInt(document.getElementById(is2hg ? 'input-t-duration-2hg' : 'input-t-duration-1v1').value, 10) || 50;
            const competitionSystem = document.getElementById(is2hg ? 'input-t-competition-2hg' : 'input-t-competition').value;
            const matchFormat = is2hg ? document.getElementById('input-t-match-format-2hg').value : 'bo3';

            tournament.roundDuration = roundDuration;
            tournament.competitionSystem = competitionSystem;
            tournament.matchFormat = matchFormat;

            if (is2hg) {
                tournament.teamCreation = document.getElementById('input-t-team-creation').value;
            }
        }

        this.tournaments.push(tournament);
        this.saveTournaments();
        this.hideCreateModal();
        this.showTournament(tournament.id);
    },

    getCustomAllowedSizes() {
        const checks = document.querySelectorAll('.custom-size-check:checked');
        return Array.from(checks).map(cb => parseInt(cb.value, 10)).filter(v => [3,4,5].includes(v));
    },

    updateTableSizeOptions() {
        const value = document.getElementById('input-t-tablesize').value;
        const customDiv = document.getElementById('custom-table-sizes');
        if (customDiv) {
            customDiv.style.display = value === 'custom' ? 'block' : 'none';
        }
    },

    updateFormatOptions() {
        const format = document.getElementById('input-t-format').value;
        const isCommander = ['commander'].includes(format);
        const is1v1 = ['pioneer', 'modern', 'standard', 'legacy', 'pauper', 'draft', 'sealed', 'other', '1v1'].includes(format);
        const is2hg = format === 'two-headed-giant';

        const sectionCommander = document.getElementById('section-commander');
        const section1v1 = document.getElementById('section-1v1');
        const section2hg = document.getElementById('section-2hg');

        if (sectionCommander) sectionCommander.style.display = isCommander ? 'block' : 'none';
        if (section1v1) section1v1.style.display = is1v1 ? 'block' : 'none';
        if (section2hg) section2hg.style.display = is2hg ? 'block' : 'none';
    },

    // ========================
    // DETALLE DEL TORNEO
    // ========================
    renderTournamentDetail() {
        const t = this.getCurrentTournament();
        if (!t) return this.showTournaments();

        const date = new Date(t.date).toLocaleDateString('es-CO', {day: 'numeric', month: 'long', year: 'numeric'});

        document.getElementById('tournament-info').innerHTML = `
            <h2>${this.escapeHtml(t.name)}</h2>
            <div class="meta"><i class="far fa-calendar"></i> ${date}</div>
            <div class="meta"><i class="fas fa-gamepad"></i> ${this.getFormatLabel(t.format)}</div>
            <div class="meta"><i class="fas fa-users"></i> ${t.players.length} jugadores registrados</div>
            <div class="meta"><i class="fas fa-layer-group"></i> ${t.rounds.length} / ${t.roundsCount} rondas · ${t.roundDuration} min por ronda</div>
            <div class="meta"><i class="fas fa-chair"></i> Mesa ${t.tableSize === 'auto' ? 'automática (3/4)' : t.tableSize + ' jugadores'}</div>
        `;

        // Buttons visibility
        const btnStart = document.getElementById('btn-start');
        const btnNext = document.getElementById('btn-next-round');
        const btnFinish = document.getElementById('btn-finish');
        const btnScoring = document.getElementById('btn-scoring');
        const btnAddExtraRound = document.getElementById('btn-add-extra-round');

        if (t.status === 'setup') {
            btnStart.style.display = t.players.length >= 3 ? 'inline-flex' : 'none';
            btnNext.style.display = 'none';
            btnFinish.style.display = 'none';
            btnScoring.style.display = 'none';
            if (btnAddExtraRound) btnAddExtraRound.style.display = 'none';
        } else if (t.status === 'active') {
            btnStart.style.display = 'none';
            const maxReached = t.roundsCount && t.rounds.length >= t.roundsCount;
            btnNext.style.display = (!maxReached && t.players.length >= 3) ? 'inline-flex' : 'none';
            btnFinish.style.display = 'inline-flex';
            btnScoring.style.display = 'inline-flex';
            if (btnAddExtraRound) btnAddExtraRound.style.display = maxReached ? 'inline-flex' : 'none';
        } else {
            btnStart.style.display = 'none';
            btnNext.style.display = 'none';
            btnFinish.style.display = 'none';
            btnScoring.style.display = 'none';
            if (btnAddExtraRound) btnAddExtraRound.style.display = 'none';
        }

        // Show/hide sections based on status
        const setupDiv = document.getElementById('tournament-setup');
        const dashboardDiv = document.getElementById('tournament-dashboard');
        const roundDiv = document.getElementById('tournament-round');
        const standingsDiv = document.getElementById('tournament-standings');
        const historyDiv = document.getElementById('tournament-history');

        if (t.status === 'setup') {
            setupDiv.style.display = 'block';
            dashboardDiv.style.display = 'none';
            roundDiv.style.display = 'none';
            standingsDiv.style.display = 'none';
            historyDiv.style.display = 'none';
            this.stopTimer();
        } else {
            setupDiv.style.display = 'none';
            dashboardDiv.style.display = 'block';
            roundDiv.style.display = 'block';
            standingsDiv.style.display = 'block';
            historyDiv.style.display = 'block';
        }

        if (t.status === 'active') {
            this.renderDashboard();
        }

        this.renderPlayersList();
        this.renderCurrentRound();
        this.renderStandings();
        this.renderHistory();
    },

    // ========================
    // JUGADORES
    // ========================
    addPlayer(e) {
        e.preventDefault();
        const t = this.getCurrentTournament();
        if (!t || t.status !== 'setup') return;

        const input = document.getElementById('input-player-name');
        const name = input.value.trim();
        const groupInput = document.getElementById('input-player-group');
        const groupId = groupInput ? groupInput.value.trim().toLowerCase().replace(/\s+/g, '_') : '';
        if (!name) return;

        // Check duplicate
        if (t.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            input.value = '';
            return;
        }

        t.players.push({
            id: this.generateId(),
            name,
            group_id: groupId || null
        });

        this.saveTournaments();
        input.value = '';
        if (groupInput) groupInput.value = '';
        this.renderPlayersList();
        this.renderTournamentDetail();
    },

    removePlayer(playerId) {
        const t = this.getCurrentTournament();
        if (!t || t.status !== 'setup') return;

        t.players = t.players.filter(p => p.id !== playerId);
        this.saveTournaments();
        this.renderPlayersList();
        this.renderTournamentDetail();
    },

    toggleImport() {
        const area = document.getElementById('import-area');
        area.style.display = area.style.display === 'none' ? 'block' : 'none';
    },

    importPlayers() {
        const t = this.getCurrentTournament();
        if (!t || t.status !== 'setup') return;

        const textarea = document.getElementById('import-players-text');
        const text = textarea.value.trim();
        if (!text) return;

        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const existingNames = new Set(t.players.map(p => p.name.toLowerCase()));
        const duplicates = [];
        const added = [];

        lines.forEach(name => {
            const parts = name.split('|');
            const playerName = parts[0].trim();
            const groupId = parts.length > 1 ? parts[1].trim().toLowerCase().replace(/\s+/g, '_') : '';
            if (existingNames.has(playerName.toLowerCase())) {
                duplicates.push(playerName);
            } else if (playerName.length > 0) {
                t.players.push({id: this.generateId(), name: playerName, group_id: groupId || null});
                existingNames.add(playerName.toLowerCase());
                added.push(playerName);
            }
        });

        this.saveTournaments();
        textarea.value = '';

        const warningEl = document.getElementById('duplicate-warning');
        if (duplicates.length > 0) {
            warningEl.style.display = 'flex';
            setTimeout(() => { warningEl.style.display = 'none'; }, 5000);
        } else {
            warningEl.style.display = 'none';
        }

        this.renderPlayersList();
        this.renderTournamentDetail();
    },

    getRecommendedRounds(playerCount) {
        if (playerCount < 3) return 0;

        const t = this.getCurrentTournament();

        if (t && t.format === 'commander') {
            if (playerCount <= 12) return 3;
            if (playerCount <= 20) return 4;
            return Math.min(5, Math.ceil(playerCount / 6));
        }

        if (t && t.format === 'two-headed-giant') {
            const teams = Math.floor(playerCount / 2);
            if (teams <= 4) return 2;
            if (teams <= 8) return 3;
            return 4;
        }

        if (playerCount <= 8) return 3;
        if (playerCount <= 16) return 4;
        if (playerCount <= 32) return 5;
        return 6;
    },

    calculateEstimatedDuration(roundsCount, roundDuration, transitionMinutes) {
        const totalMinutes = (roundsCount * roundDuration) + (Math.max(0, roundsCount - 1) * transitionMinutes);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 0) {
            return `${hours} h ${minutes} min`;
        }
        return `${minutes} min`;
    },

    updateSetupStats() {
        const t = this.getCurrentTournament();
        if (!t || t.status !== 'setup') return;

        const playerCount = t.players.length;
        const tables = this.calculateTableSizes(playerCount);
        const tableCount = tables.filter(s => s > 0).length;
        const recommendedRounds = this.getRecommendedRounds(playerCount);
        const estimatedDuration = this.calculateEstimatedDuration(recommendedRounds, t.roundDuration, 5);

        document.getElementById('setup-players-count').textContent = `${playerCount} jugadores`;
        document.getElementById('setup-tables-count').textContent = `${tableCount} mesas`;
        document.getElementById('setup-rounds-recommendation').textContent = `${recommendedRounds} rondas recomendadas · ${estimatedDuration}`;

        // Update recommendation box in modal if visible
        const recBox = document.getElementById('tournament-recommendation');
        const recText = document.getElementById('recommendation-text');
        if (recBox && recText && playerCount >= 3) {
            recBox.style.display = 'block';
            recText.textContent = `${playerCount} jugadores — ${tableCount} mesas — ${recommendedRounds} rondas recomendadas — Duración estimada: ${estimatedDuration}`;
        }
    },

    // ========================
    // DASHBOARD
    // ========================
    renderDashboard() {
        const t = this.getCurrentTournament();
        if (!t || t.status !== 'active') return;

        document.getElementById('dashboard-tournament-name').textContent = t.name;
        document.getElementById('dashboard-format').textContent = this.getFormatLabel(t.format);

        const currentRound = t.rounds[t.rounds.length - 1];
        document.getElementById('dashboard-round-info').textContent = `${t.rounds.length} / ${t.roundsCount}`;

        const totalTables = currentRound ? currentRound.tables.length : 0;
        const finishedTables = currentRound ? currentRound.tables.filter(tb => tb.completed).length : 0;
        document.getElementById('dashboard-tables-count').textContent = totalTables;
        document.getElementById('dashboard-players-count').textContent = t.players.length;
        document.getElementById('dashboard-completed-count').textContent = `${finishedTables} / ${totalTables}`;

        // Timer display
        this.updateTimerDisplay();

        // Tables status
        this.renderTablesStatus();
    },

    renderTablesStatus() {
        const t = this.getCurrentTournament();
        const container = document.getElementById('tables-status');
        if (!t || !t.rounds.length) {
            container.innerHTML = '';
            return;
        }

        const currentRound = t.rounds[t.rounds.length - 1];
        if (!currentRound) return;

        container.innerHTML = currentRound.tables.map((table, idx) => {
            const players = table.players.map(pid => t.players.find(p => p.id === pid)).filter(Boolean);
            const playerNames = players.map(p => this.escapeHtml(p.name)).join(', ');

            let statusClass = 'playing';
            let statusLabel = 'En juego';
            let statusIcon = 'fas fa-circle';

            if (table.completed) {
                statusClass = 'finished';
                statusLabel = 'Finalizada';
                statusIcon = 'fas fa-check-circle';
            } else if (this.isRoundTimeUp(t)) {
                statusClass = 'timeup';
                statusLabel = 'Tiempo terminado';
                statusIcon = 'fas fa-exclamation-circle';
            }

            return `
                <div class="table-status-item">
                    <div class="table-status-info">
                        <div class="table-status-indicator ${statusClass}"></div>
                        <div>
                            <div class="table-status-name">Mesa ${idx + 1} ${table.officialReportAppliedAt ? '<span class="sync-mode sync-mode-firestore" style="margin-left:6px">oficial</span>' : ''}</div>
                            <div class="table-status-players">${playerNames || 'Bye'}</div>
                        </div>
                    </div>
                    <div class="table-status-actions">
                        <span class="table-status-badge ${statusClass}">${statusLabel}</span>
                        ${!table.bye ? `<a class="btn-icon" href="${app.getMesaUrl(table.id, idx + 1)}" target="_blank" rel="noopener" aria-label="Abrir mesa t�ctil ${idx + 1}" title="Abrir mesa t�ctil"><i class="fas fa-mobile-screen-button"></i></a>` : ''}
                        <button class="btn-icon" onclick="app.showEditTableModal('${table.id}')" aria-label="Editar mesa ${idx + 1}">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    isRoundTimeUp(tournament) {
        const currentRound = tournament.rounds[tournament.rounds.length - 1];
        if (!currentRound || !currentRound.startedAt) return false;
        const elapsed = this.getElapsedSeconds();
        return elapsed >= tournament.roundDuration * 60;
    },

    // ========================
    // CRONÓMETRO
    // ========================
    startRoundTimer() {
        const t = this.getCurrentTournament();
        if (!t || t.status !== 'active') return;

        const currentRound = t.rounds[t.rounds.length - 1];
        if (!currentRound) return;

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        currentRound.startedAt = Date.now();
        currentRound.pausedDuration = currentRound.pausedDuration || 0;
        currentRound.pausedAt = null;
        this.timerAlertsShown = [];

        currentRound.tables.forEach(table => {
            if (table.bye) return;
            if (!table.turnState) {
                table.turnState = {
                    activePlayerIndex: 0,
                    playerTimes: new Array(table.players.length).fill(0)
                };
            }
            table.turnState.turnStartTime = Date.now();
        });

        document.getElementById('btn-start-timer').style.display = 'none';
        document.getElementById('btn-pause-timer').style.display = 'inline-flex';
        document.getElementById('btn-resume-timer').style.display = 'none';

        this.timerInterval = setInterval(() => {
            this.updateTimerDisplay();
            this.updateTurnTimers();
            this.checkTimerAlerts();
        }, 1000);

        this.updateTimerDisplay();
        this.updateTurnTimers();
        this.saveTournaments(); // publica tiempo global a mesas/companion
    },

    updateTurnTimers() {
        const t = this.getCurrentTournament();
        if (!t) return;

        const currentRound = t.rounds[t.rounds.length - 1];
        if (!currentRound) return;

        const now = Date.now();

        currentRound.tables.forEach(table => {
            if (table.bye || !table.turnState) return;

            const display = document.getElementById(`turn-timer-${table.id}`);
            if (display) {
                const elapsed = Math.floor((now - (table.turnState.turnStartTime || now)) / 1000);
                const m = Math.floor(elapsed / 60);
                const s = elapsed % 60;
                display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            }
        });
    },

    passTurn(tableId) {
        const t = this.getCurrentTournament();
        if (!t || t.status !== 'active') return;

        const currentRound = t.rounds[t.rounds.length - 1];
        if (!currentRound) return;

        const table = currentRound.tables.find(tb => tb.id === tableId);
        if (!table || table.bye) return;

        const now = Date.now();

        if (!table.turnState) {
            table.turnState = {
                activePlayerIndex: 0,
                playerTimes: new Array(table.players.length).fill(0),
                turnStartTime: now
            };
            this.saveTournaments();
            this.renderCurrentRound();
            this.updateTurnTimers();
            return;
        }

        const elapsedTurn = Math.floor((now - (table.turnState.turnStartTime || now)) / 1000);

        table.turnState.playerTimes[table.turnState.activePlayerIndex] += elapsedTurn;
        table.turnState.activePlayerIndex = (table.turnState.activePlayerIndex + 1) % table.players.length;
        table.turnState.turnStartTime = now;

        this.saveTournaments();
        this.renderCurrentRound();
        this.updateTurnTimers();
    },

    pauseRoundTimer() {
        const t = this.getCurrentTournament();
        if (!t || !this.timerInterval) return;

        clearInterval(this.timerInterval);
        this.timerInterval = null;

        const currentRound = t.rounds[t.rounds.length - 1];
        if (currentRound) {
            currentRound.pausedAt = Date.now();
        }

        var bp = document.getElementById('btn-pause-timer'); if (bp) bp.style.display = 'none';
        var br = document.getElementById('btn-resume-timer'); if (br) br.style.display = 'inline-flex';
        this.saveTournaments(); // sincroniza pausa con mesas
    },

    resumeRoundTimer() {
        const t = this.getCurrentTournament();
        if (!t || this.timerInterval) return;

        const currentRound = t.rounds[t.rounds.length - 1];
        if (currentRound && currentRound.pausedAt) {
            const pauseDelta = Date.now() - currentRound.pausedAt;
            currentRound.pausedDuration = (currentRound.pausedDuration || 0) + pauseDelta;
            currentRound.pausedAt = null;

            currentRound.tables.forEach(table => {
                if (table.turnState && table.turnState.turnStartTime) {
                    table.turnState.turnStartTime += pauseDelta;
                }
            });
        }

        var br2 = document.getElementById('btn-resume-timer'); if (br2) br2.style.display = 'none';
        var bp2 = document.getElementById('btn-pause-timer'); if (bp2) bp2.style.display = 'inline-flex';

        this.timerInterval = setInterval(() => {
            this.updateTimerDisplay();
            this.updateTurnTimers();
            this.checkTimerAlerts();
        }, 1000);

        this.updateTurnTimers();
        this.saveTournaments(); // sincroniza reanudación con mesas
    },

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        const t = this.getCurrentTournament();
        if (t) {
            const currentRound = t.rounds[t.rounds.length - 1];
            if (currentRound) {
                currentRound.pausedAt = null;
            }
        }

        document.getElementById('btn-start-timer').style.display = 'inline-flex';
        document.getElementById('btn-pause-timer').style.display = 'none';
        document.getElementById('btn-resume-timer').style.display = 'none';
        document.getElementById('timer-display').textContent = '00:00';
        document.getElementById('timer-display').className = 'timer-display';
        document.getElementById('timer-alert').style.display = 'none';
    },

    getElapsedSeconds() {
        const t = this.getCurrentTournament();
        if (!t) return 0;

        const currentRound = t.rounds[t.rounds.length - 1];
        if (!currentRound || !currentRound.startedAt) return 0;

        const now = Date.now();
        const elapsed = now - currentRound.startedAt - (currentRound.pausedDuration || 0);
        return Math.max(0, Math.floor(elapsed / 1000));
    },

    updateTimerDisplay() {
        const t = this.getCurrentTournament();
        if (!t) return;

        const elapsed = this.getElapsedSeconds();
        const remaining = Math.max(0, t.roundDuration * 60 - elapsed);
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;

        const display = document.getElementById('timer-display');
        if (display) {
            display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            if (remaining <= 60 && remaining > 0) {
                display.className = 'timer-display danger';
            } else if (remaining <= 300 && remaining > 0) {
                display.className = 'timer-display warning';
            } else {
                display.className = 'timer-display';
            }
        }
    },

    checkTimerAlerts() {
        const t = this.getCurrentTournament();
        if (!t) return;

        const elapsed = this.getElapsedSeconds();
        const remaining = t.roundDuration * 60 - elapsed;

        const alerts = [
            {threshold: 600, key: '10min'},
            {threshold: 300, key: '5min'},
            {threshold: 60, key: '1min'},
            {threshold: 0, key: 'timeup'}
        ];

        alerts.forEach(alert => {
            if (remaining <= alert.threshold && !this.timerAlertsShown.includes(alert.key)) {
                this.timerAlertsShown.push(alert.key);
                this.showTimerAlert(alert.key, remaining);
            }
        });
    },

    playAlertSound(type) {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            if (type === '10min') {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.frequency.setValueAtTime(440, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.6);
            } else if (type === '5min') {
                const osc1 = audioCtx.createOscillator();
                const gain1 = audioCtx.createGain();
                osc1.connect(gain1);
                gain1.connect(audioCtx.destination);
                osc1.frequency.setValueAtTime(587, audioCtx.currentTime);
                gain1.gain.setValueAtTime(0.15, audioCtx.currentTime);
                osc1.start(audioCtx.currentTime);
                osc1.stop(audioCtx.currentTime + 0.3);

                const osc2 = audioCtx.createOscillator();
                const gain2 = audioCtx.createGain();
                osc2.connect(gain2);
                gain2.connect(audioCtx.destination);
                osc2.frequency.setValueAtTime(587, audioCtx.currentTime + 0.4);
                gain2.gain.setValueAtTime(0.15, audioCtx.currentTime + 0.4);
                osc2.start(audioCtx.currentTime + 0.4);
                osc2.stop(audioCtx.currentTime + 0.7);
            } else if (type === 'timeup') {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.frequency.setValueAtTime(880, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 1.5);
            }
        } catch (e) {
            console.warn('Web Audio API no disponible:', e);
        }
    },

    showTimerAlert(key, remaining) {
        const alertEl = document.getElementById('timer-alert');
        const alertText = document.getElementById('timer-alert-text');

        if (!alertEl || !alertText) return;

        const messages = {
            '10min': 'Quedan 10 minutos',
            '5min': 'Quedan 5 minutos',
            '1min': '¡Queda 1 minuto!',
            'timeup': '¡Tiempo terminado!'
        };

        alertText.textContent = messages[key] || '';
        alertEl.style.display = 'flex';

        if (key === '10min' || key === '5min' || key === 'timeup') {
            this.playAlertSound(key);
        }

        if (key === 'timeup') {
            setTimeout(() => {
                alertEl.style.display = 'none';
            }, 5000);
        } else {
            setTimeout(() => {
                alertEl.style.display = 'none';
            }, 3000);
        }
    },

    // ========================
    // CORRECCIONES MANUALES
    // ========================
    showEditTableModal(tableId) {
        const t = this.getCurrentTournament();
        if (!t) return;

        const currentRound = t.rounds[t.rounds.length - 1];
        const table = currentRound.tables.find(tb => tb.id === tableId);
        if (!table) return;

        this.currentEditTableId = tableId;
        const players = table.players.map(pid => t.players.find(p => p.id === pid)).filter(Boolean);
        const container = document.getElementById('edit-table-players');

        container.innerHTML = players.map(p => {
            const currentResult = table.results.find(r => r.playerId === p.id);
            const placement = currentResult ? currentResult.placement : 0;
            return `
                <div class="edit-player-row">
                    <span class="edit-player-name">${this.escapeHtml(p.name)}</span>
                    <select class="edit-player-select" data-player="${p.id}">
                        <option value="0" ${placement === 0 ? 'selected' : ''}>-</option>
                        <option value="1" ${placement === 1 ? 'selected' : ''}>1.º</option>
                        <option value="2" ${placement === 2 ? 'selected' : ''}>2.º</option>
                        <option value="3" ${placement === 3 ? 'selected' : ''}>3.º</option>
                        <option value="4" ${placement === 4 ? 'selected' : ''}>4.º</option>
                    </select>
                </div>
            `;
        }).join('');

        document.getElementById('modal-edit-table').style.display = 'flex';
    },

    hideEditTableModal() {
        document.getElementById('modal-edit-table').style.display = 'none';
        this.currentEditTableId = null;
    },

    saveTableEdit() {
        const t = this.getCurrentTournament();
        if (!t || !this.currentEditTableId) return;

        const currentRound = t.rounds[t.rounds.length - 1];
        const table = currentRound.tables.find(tb => tb.id === this.currentEditTableId);
        if (!table) return;

        const selects = document.querySelectorAll('#edit-table-players .edit-player-select');
        selects.forEach(select => {
            const playerId = select.getAttribute('data-player');
            const placement = parseInt(select.value, 10);

            let result = table.results.find(r => r.playerId === playerId);
            if (!result) {
                result = {playerId, placement: 0, duration: 0};
                table.results.push(result);
            }
            result.placement = placement;
        });

        table.completed = true;
        this.saveTournaments();
        this.hideEditTableModal();
        this.renderTournamentDetail();
    },

    regenerateCurrentRound() {
        const t = this.getCurrentTournament();
        if (!t || t.status !== 'active') return;
        if (!confirm('¿Regenerar la ronda actual? Se perderán los resultados no guardados.')) return;

        t.rounds.pop();
        this.saveTournaments();
        this.generateRound();
        this.renderTournamentDetail();
    },

    editCurrentRound() {
        const t = this.getCurrentTournament();
        if (!t || t.status !== 'active') return;

        const currentRound = t.rounds[t.rounds.length - 1];
        if (!currentRound) return;

        document.getElementById('edit-round-duration').value = t.roundDuration;
        const startInput = document.getElementById('edit-round-start');
        if (currentRound.startedAt) {
            const d = new Date(currentRound.startedAt);
            const pad = n => String(n).padStart(2, '0');
            startInput.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } else {
            startInput.value = '';
        }

        const tablesContainer = document.getElementById('edit-round-tables');
        tablesContainer.innerHTML = currentRound.tables.map((table, idx) => {
            const players = table.players.map(pid => t.players.find(p => p.id === pid)).filter(Boolean);
            const playerNames = players.map(p => this.escapeHtml(p.name)).join(', ');

            return `
                <div class="edit-round-table-row">
                    <div class="edit-round-table-title">Mesa ${idx + 1} ${table.bye ? '· Bye' : ''}</div>
                    <div class="edit-round-table-players">${playerNames || '—'}</div>
                </div>
            `;
        }).join('');

        document.getElementById('modal-edit-round').style.display = 'flex';
    },

    hideEditRoundModal() {
        document.getElementById('modal-edit-round').style.display = 'none';
    },

    saveRoundEdit(e) {
        e.preventDefault();
        const t = this.getCurrentTournament();
        if (!t || t.status !== 'active') return;

        const currentRound = t.rounds[t.rounds.length - 1];
        if (!currentRound) return;

        const newDuration = parseInt(document.getElementById('edit-round-duration').value, 10);
        const startValue = document.getElementById('edit-round-start').value;

        if (!isNaN(newDuration) && newDuration > 0) {
            t.roundDuration = newDuration;
        }

        if (startValue) {
            currentRound.startedAt = new Date(startValue).getTime();
            currentRound.pausedDuration = 0;
            currentRound.pausedAt = null;
        }

        currentRound.edited = true;
        this.saveTournaments();
        this.hideEditRoundModal();
        this.renderTournamentDetail();
        this.updateTimerDisplay();
    },


    // ---- Stubs for UI hooks referenced by torneo.html (safe no-ops) ----
    confirmRound() {
        const t = this.getCurrentTournament();
        if (!t || t.status !== 'active') return;
        const round = t.rounds[t.rounds.length - 1];
        if (!round) return;
        round.confirmed = true;
        this.saveTournaments();
        this.renderTournamentDetail();
    },
    cancelRoundEdit() { this.hideEditRoundModal(); },
    editScoring() { this.showScoringModal(); },
    showAddLatePlayerModal() { const m = document.getElementById('modal-late-player'); if (m) m.style.display = 'flex'; },
    hideLatePlayerModal() { const m = document.getElementById('modal-late-player'); if (m) m.style.display = 'none'; },
    toggleLateOptionFields() {},
    addLatePlayer(e) { if (e) e.preventDefault(); this.hideLatePlayerModal(); },
    showRetirePlayerModal() { const m = document.getElementById('modal-retire-player'); if (m) m.style.display = 'flex'; },
    hideRetirePlayerModal() { const m = document.getElementById('modal-retire-player'); if (m) m.style.display = 'none'; },
    retirePlayer(e) { if (e) e.preventDefault(); this.hideRetirePlayerModal(); },
    showPlayerHistoryModal() { const m = document.getElementById('modal-player-history'); if (m) m.style.display = 'flex'; },
    hidePlayerHistoryModal() { const m = document.getElementById('modal-player-history'); if (m) m.style.display = 'none'; },

    // ========================
    // PUNTUACIÓN CONFIGURABLE
    // ========================
    showScoringModal() {
        document.getElementById('modal-scoring').style.display = 'flex';
    },

    hideScoringModal() {
        document.getElementById('modal-scoring').style.display = 'none';
    },

    saveScoring(e) {
        e.preventDefault();
        const t = this.getCurrentTournament();
        if (!t) return;

        const scoring = {
            5: {},
            4: {},
            3: {},
            2: {}
        };

        document.querySelectorAll('.scoring-input').forEach(input => {
            const tableSize = input.getAttribute('data-table');
            const pos = input.getAttribute('data-pos');
            scoring[tableSize][pos] = parseInt(input.value, 10) || 0;
        });

        t.scoring = scoring;
        this.saveTournaments();
        this.hideScoringModal();
        this.renderStandings();
    },

    getPointsForPosition(placement, tableSize, t) {
        t = t || this.getCurrentTournament();
        if (!t || !t.scoring) return Math.max(0, (tableSize - placement) + 1);
        return t.scoring[tableSize]?.[placement] || 0;
    },

    getMesaUrl(tableId, tableIndex) {
        const t = this.getCurrentTournament();
        const sid = (t && t.syncSessionId) ? t.syncSessionId : (t ? String(t.id || '').replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase() : '');
        var mesa = tableId || '';
        if (typeof tableIndex === 'number' && tableIndex > 0) mesa = 'mesa-' + tableIndex; // ID amigable para invitado
        else if (/^\d+$/.test(String(mesa))) mesa = 'mesa-' + mesa;
        return location.origin + location.pathname.replace(/torneo\.html.*$/i, 'mesa.html') + '?sesion=' + encodeURIComponent(sid) + '&mesa=' + encodeURIComponent(mesa);
    },

    applyLiveTableState(sessionId, tableId, tableData) {
        // Sincronización cosmética/en vivo desde mesa (localStorage/Firebase): refleja eliminaciones y estado sin recargar.
        // No reemplaza resultado oficial enviado (officialReport/submitted) salvo para marcar eliminados en UI.
        try {
            if (!tableData) return false;
            const t = this.tournaments.find(x => x.syncSessionId === sessionId || String(x.id || '').replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase() === sessionId);
            if (!t) return false;
            const normId = String(tableId||'').replace(/^mesa-0*/i,'mesa-');
            const round = (t.rounds || []).slice().reverse().find(r => (r.tables || []).some(tb => tb.id === tableId || tb.publicMesaId === tableId || ('mesa-'+tb.tableNumber)===normId));
            const table = round && (round.tables.find(tb => tb.id === tableId) || round.tables.find(tb => tb.publicMesaId === tableId) || round.tables.find(tb => ('mesa-'+tb.tableNumber)===normId));
            if (!table || table.bye) return false;
            // Si ya hay resultado oficial aplicado, mantenerlo; solo refrescar metadatos vivos.
            table.live = tableData.live || table.live || {};
            table.turn = tableData.turn || table.turn || table.turn;
            if (table.officialReportAppliedAt || (table.officialReport && table.officialReport.status === 'submitted')) {
                if (this.currentTournamentId === t.id) this._liveRenderThrottle(t);
                return true;
            }
            // Derivar estado provisional desde live: marcar tabla/puestos parciales cuando hay eliminaciones confirmadas.
            var live = table.live || {};
            var players = table.players || [];
            var eliminated = players.map(function(pid){ var l=live[pid]||{}; return { playerId: pid, eliminated: !!l.eliminated, order: l.eliminationOrder, elimination: l.elimination }; }).filter(function(x){ return x.eliminated; });
            if (eliminated.length) {
                eliminated.sort(function(a,b){ return (a.order||999)-(b.order||999); });
                var n = players.length;
                var results = [];
                var used = {};
                eliminated.forEach(function(e, idx){
                  var placement = n - (e.order || (idx+1)) + 1; if (placement < 1) placement = n;
                  var l = live[e.playerId] || {};
                  var elim = e.elimination || l.elimination || null;
                  var turnSec = Math.max(0, Math.floor(Number(l.timeUsedSec) || 0));
                  results.push({ playerId:e.playerId, placement: placement, duration: Math.round(turnSec/60), turnTimeSec: turnSec, playerTurnTimeSec: turnSec, playerTurnTime: (elim&&elim.playerTurnTime)||null, timeOfElimination: (elim&&elim.timeOfElimination)||null, timeOfEliminationSec: (elim&&elim.timeOfEliminationSec!=null?elim.timeOfEliminationSec:null), bounties: Math.max(0,Number(l.bounties)||0), elimination:elim, provisional:true, points: (t.scoring && t.scoring[n] && t.scoring[n][placement]) || Math.max(0,(n-placement)+1) });
                  used[e.playerId]=true;
                });
                var alive = players.filter(function(pid){ return !used[pid]; });
                if (alive.length === 1) { var lw=live[alive[0]]||{}; results.push({ playerId: alive[0], placement: 1, duration:0, bounties: Math.max(0,Number(lw.bounties)||0), provisional:true, points: (t.scoring && t.scoring[n] && t.scoring[n][1]) || n }); }
                else alive.forEach(function(pid){ var l2=live[pid]||{}; var ts2=Math.max(0,Math.floor(Number(l2.timeUsedSec)||0)); results.push({ playerId: pid, placement: 0, duration:Math.round(ts2/60), turnTimeSec:ts2, playerTurnTimeSec:ts2, bounties: Math.max(0,Number(l2.bounties)||0), provisional:true, points:0 }); });
                table.results = results;
                table.liveStatus = alive.length <= 1 ? 'decided' : 'in-progress';
                table.completed = false; // oficial sigue pendiente hasta reporte enviado
            }
            if (this.currentTournamentId === t.id) this._liveRenderThrottle(t);
            return true;
        } catch (e) { return false; }
    },
    _liveRenderThrottle: function(t) {
        var self = this;
        if (this._liveRenderTimer) clearTimeout(this._liveRenderTimer);
        this._liveRenderTimer = setTimeout(function(){ try { if (self.currentTournamentId === t.id) self.renderTournamentDetail(); } catch(e){} }, 120);
    },

    applyOfficialTableReport(sessionId, tableId, report) {
        const t = this.tournaments.find(x => x.syncSessionId === sessionId || String(x.id || '').replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase() === sessionId);
        if (!t || !report || report.status !== 'submitted') return false;
        const normId = String(tableId||'').replace(/^mesa-0*/i,'mesa-');
        const round = (t.rounds || []).slice().reverse().find(r => (r.tables || []).some(tb => tb.id === tableId || tb.publicMesaId === tableId || ('mesa-'+tb.tableNumber)===normId));
        const table = round && (round.tables.find(tb => tb.id === tableId) || round.tables.find(tb => tb.publicMesaId === tableId) || round.tables.find(tb => ('mesa-'+tb.tableNumber)===normId));
        if (!table || table.bye) return false;
        if (table.officialReportAppliedAt === report.submittedAt) return false;
        const placements = Array.isArray(report.placements) ? report.placements : [];
        const tableSize = (table.players || []).length;
        table.results = placements.map(p => ({
            playerId: p.playerId,
            placement: Number(p.placement) || 0,
            duration: Math.max(0, Math.round((report.timeConsumedSec && report.timeConsumedSec[p.playerId] ? report.timeConsumedSec[p.playerId] : 0) / 60)),
            turnTimeSec: Math.max(0, Math.round(report.timeConsumedSec && report.timeConsumedSec[p.playerId] ? report.timeConsumedSec[p.playerId] : (p.playerTurnTimeSec || 0))),
            playerTurnTimeSec: Math.max(0, Math.round(p.playerTurnTimeSec || (report.timeConsumedSec && report.timeConsumedSec[p.playerId]) || 0)),
            playerTurnTime: p.playerTurnTime || null,
            timeOfElimination: p.timeOfElimination || (p.elimination && p.elimination.timeOfElimination) || null,
            timeOfEliminationSec: p.timeOfEliminationSec != null ? p.timeOfEliminationSec : (p.elimination && p.elimination.timeOfEliminationSec != null ? p.elimination.timeOfEliminationSec : null),
            bounties: Math.max(0, Number(p.bounties) || 0),
            elimination: p.elimination || null,
            points: this.getPointsForPosition(Number(p.placement) || 0, tableSize, t)
        }));
        table.completed = true;
        table.finishedAt = report.submittedAt || Date.now();
        table.officialReportAppliedAt = report.submittedAt || Date.now();
        table.officialReportReason = report.reason || null;
        table.officialTotalDurationSec = report.totalDurationSec || 0;
        table.officialTimeConsumedSec = report.timeConsumedSec || {};
        if (round && round.tables.every(tb => tb.completed || tb.bye)) { round.completed = true; round.finishedAt = round.finishedAt || Date.now(); }
        this.saveTournaments();
        if (this.currentTournamentId === t.id) this.renderTournamentDetail();
        return true;
    },

    // ========================
    // REPORTES / EXPORTACI�N (EventLink-style)
    // ========================
    _minPct(v) { return v <= 0 ? 0 : Math.max(1/3, v); },
    _fmtPct(v) { return (Math.round((v || 0) * 10000) / 100).toFixed(2) + '%'; },
    buildReportData() {
        const t = this.getCurrentTournament();
        if (!t) return null;
        const players = (t.players || []).slice();
        const rounds = (t.rounds || []).filter(r => r && r.completed);
        const byId = {};
        players.forEach(p => { byId[p.id] = { playerId: p.id, name: p.name, points: 0, wins: 0, losses: 0, draws: 0, gamesPlayed: 0, gamesWon: 0, opponents: [], timeUsedSec: 0, timeSamples: 0, commanderDamageDealt: 0, commanderDamageReceived: 0, eliminations: 0, bounties: 0, firstOutAtSec: null }; });
        rounds.forEach(round => {
            (round.tables || []).forEach(table => {
                if (!table || table.bye) {
                    const r = table && table.results && table.results[0];
                    if (r && byId[r.playerId]) { byId[r.playerId].points += 3; byId[r.playerId].wins += 1; byId[r.playerId].gamesPlayed += 1; byId[r.playerId].gamesWon += 1; }
                    return;
                }
                const ids = (table.players || []).filter(id => byId[id]);
                ids.forEach(a => ids.forEach(b => { if (a !== b) byId[a].opponents.push(b); }));
                const tableSize = ids.length || 1;
                (table.results || []).forEach(res => {
                    const s = byId[res.playerId]; if (!s) return;
                    const placement = Number(res.placement) || 0;
                    const pts = placement > 0 ? this.getPointsForPosition(placement, tableSize, t) : 0;
                    var rb = Math.max(0, Number(res.bounties) || 0); s.bounties = (s.bounties||0) + rb; s.points += pts + rb;
                    s.gamesPlayed += 1;
                    if (placement === 1) { s.wins += 1; s.gamesWon += 1; }
                    else if (placement > 0) { s.losses += 1; if (placement >= tableSize && tableSize > 1) s.eliminations += 1; }
                    const sec = (res.playerTurnTimeSec != null ? Number(res.playerTurnTimeSec) : (res.turnTimeSec != null ? Number(res.turnTimeSec) : (table.officialTimeConsumedSec && table.officialTimeConsumedSec[res.playerId])));
                    if (sec != null) { s.timeUsedSec += Number(sec) || 0; s.timeSamples += 1; }
                    else if (res.duration) { s.timeUsedSec += (Number(res.duration)||0) * 60; s.timeSamples += 1; }
                    const elimSec = res.timeOfEliminationSec != null ? Number(res.timeOfEliminationSec) : (res.elimination && res.elimination.timeOfEliminationSec != null ? Number(res.elimination.timeOfEliminationSec) : null);
                    if (elimSec != null) s.firstOutAtSec = s.firstOutAtSec == null ? elimSec : Math.min(s.firstOutAtSec, elimSec);
                });
                if (table.live) {
                    Object.keys(table.live).forEach(pid => {
                        const s = byId[pid]; if (!s) return;
                        const cd = table.live[pid].commanderDamage || {};
                        Object.values(cd).forEach(v => { s.commanderDamageReceived += Number(v && v.damage) || 0; });
                    });
                    Object.keys(table.live).forEach(src => {
                        const cd = (table.live[src] && table.live[src].commanderDamage) || {};
                        Object.keys(cd).forEach(tgt => { if (byId[tgt]) byId[tgt].commanderDamageReceived += 0; if (byId[src]) byId[src].commanderDamageDealt += Number(cd[tgt] && cd[tgt].damage) || 0; });
                    });
                }
            });
        });
        const mw = {};
        Object.keys(byId).forEach(id => { const s = byId[id]; const raw = s.gamesPlayed > 0 ? (s.gamesWon / s.gamesPlayed) : 0; s.mwRaw = raw; s.mw = s.gamesPlayed > 0 ? this._minPct(raw) : 0; mw[id] = s.mw; });
        Object.keys(byId).forEach(id => {
            const s = byId[id]; const ops = s.opponents.length ? s.opponents : [];
            const avg = (arr) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
            const omwVals = ops.map(oid => mw[oid] != null ? mw[oid] : 0);
            s.omw = ops.length ? this._minPct(avg(omwVals)) : 0;
            s.ogw = ops.length ? this._minPct(avg(ops.map(oid => (byId[oid] && byId[oid].mw) || 0))) : 0; // same base metric in commander table context
            s.avgTurnTimeSec = s.timeSamples > 0 ? Math.round(s.timeUsedSec / s.timeSamples) : null;
        });
        const rows = Object.values(byId).sort((a,b)=> b.points-a.points || b.mw-a.mw || b.omw-a.omw || b.ogw-b.ogw || (a.name||'').localeCompare(b.name||''));
        rows.forEach((r,i)=> r.rank = i+1);
        const totalTables = rounds.reduce((n,r)=> n + (r.tables||[]).filter(tb=>!tb.bye).length, 0);
        const status = t.status === 'finished' ? 'Posiciones Definitivas' : (rounds.length ? `Ronda ${rounds[rounds.length-1].roundNumber}` : 'Sin rondas completadas');
        const finishedAt = new Date();
        const meta = { tournamentName: t.name || 'Torneo', date: finishedAt.toLocaleDateString('es-CO'), time: finishedAt.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'}), status, players: players.length, tables: totalTables, roundsCompleted: rounds.length, format: this.getFormatLabel ? this.getFormatLabel(t.format) : (t.format||'') };
        return { meta, rows, tournament: t };
    },
    showReportModal() { this.refreshReportPreview(); const m=document.getElementById('modal-report'); if(m) m.style.display='flex'; },
    hideReportModal() { const m=document.getElementById('modal-report'); if(m) m.style.display='none'; },
    refreshReportPreview() {
        const data = this.buildReportData(); if (!data) return;
        const meta = document.getElementById('report-preview-meta');
        if (meta) meta.innerHTML = `<div class="report-meta-grid"><div><strong>Evento:</strong> ${this.escapeHtml(data.meta.tournamentName)}</div><div><strong>Formato:</strong> ${this.escapeHtml(data.meta.format)}</div><div><strong>Fecha/Hora:</strong> ${this.escapeHtml(data.meta.date)} ${this.escapeHtml(data.meta.time)}</div><div><strong>Estado:</strong> ${this.escapeHtml(data.meta.status)}</div><div><strong>Jugadores:</strong> ${data.meta.players}</div><div><strong>Mesas completadas:</strong> ${data.meta.tables}</div></div>`;
        const box = document.getElementById('report-preview-table'); if (!box) return;
        const hasCmdr = data.rows.some(r => r.avgTurnTimeSec != null || r.commanderDamageDealt || r.commanderDamageReceived);
        box.innerHTML = `<div class="standing-row header report-row ${hasCmdr?'report-row-cmdr':''}"><div>#</div><div>Jugador</div><div>Pts</div><div>%JG</div><div>%VPO</div><div>%JGO</div>${hasCmdr?'<div>Tiempo medio</div><div>Da�o Cmdr D/R</div>':''}</div>` + data.rows.map(r => `<div class="standing-row report-row ${hasCmdr?'report-row-cmdr':''}"><div class="standing-rank">${r.rank}</div><div class="standing-name">${this.escapeHtml(r.name)}</div><div class="standing-stat">${r.points}</div><div class="standing-stat">${this._fmtPct(r.mw)}</div><div class="standing-stat">${this._fmtPct(r.omw)}</div><div class="standing-stat">${this._fmtPct(r.ogw)}</div>${hasCmdr?`<div class="standing-stat">${r.avgTurnTimeSec!=null?Math.floor(r.avgTurnTimeSec/60)+'m '+(r.avgTurnTimeSec%60)+'s':'-'}</div><div class="standing-stat">${r.commanderDamageDealt||0}/${r.commanderDamageReceived||0}</div>`:''}</div>`).join('');
    },
    downloadReportCSV() {
        var data = this.buildReportData(); if (!data) return;
        var hasCmdr = false;
        for (var i = 0; i < data.rows.length; i++) { var rr = data.rows[i]; if (rr.avgTurnTimeSec != null || rr.commanderDamageDealt || rr.commanderDamageReceived) { hasCmdr = true; break; } }
        var head = ['Puesto','Jugador','Puntos Totales (Match Points)','Bounties','%JG','%VPO','%JGO','Mesas jugadas','Ganadas','Perdidas','Tiempo medio turno (s)','Tiempo medio turno','Eliminado (primer reloj ronda)','Salidas registradas'];
        if (hasCmdr) head = head.concat(['Daño comandante infligido','Daño comandante recibido']);
        var escCsv = function(v){ return '"' + String(v==null?'':v).replace(/"/g,'""') + '"'; };
        var lines = [
          ['Evento', data.meta.tournamentName], ['Formato', data.meta.format], ['Fecha', data.meta.date], ['Hora', data.meta.time],
          ['Estado', data.meta.status], ['Total jugadores', data.meta.players], ['Mesas completadas', data.meta.tables], [], head
        ];
        for (var j = 0; j < data.rows.length; j++) {
          var r = data.rows[j];
          var avgLabel = r.avgTurnTimeSec==null?'':(Math.floor(r.avgTurnTimeSec/60)+':'+String(r.avgTurnTimeSec%60).padStart(2,'0'));
          var elimLabel = r.firstOutAtSec==null?'':(Math.floor(r.firstOutAtSec/60)+':'+String(r.firstOutAtSec%60).padStart(2,'0'));
          var row = [r.rank,r.name,r.points,r.bounties||0,this._fmtPct(r.mw),this._fmtPct(r.omw),this._fmtPct(r.ogw),r.gamesPlayed,r.wins,r.losses,r.avgTurnTimeSec==null?'':r.avgTurnTimeSec,avgLabel,elimLabel,r.eliminations||0];
          if (hasCmdr) row = row.concat([r.commanderDamageDealt||0, r.commanderDamageReceived||0]);
          lines.push(row);
        }
        var csv = '\uFEFF' + lines.map(function(row){ return Array.isArray(row) ? row.map(escCsv).join(',') : escCsv(row); }).join('\r\n');
        var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = (data.meta.tournamentName || 'reporte').replace(/[^\w\-]+/g,'_') + '_posiciones.csv'; a.click();
        setTimeout(function(){ try{ URL.revokeObjectURL(a.href); }catch(e){} }, 500);
    },
    async downloadReportPDF() {
        const data = this.buildReportData(); if (!data) return;
        const load = (src) => new Promise((res, rej)=>{ if (document.querySelector('script[src="'+src+'"]') && ((src.indexOf('jspdf')>-1 && window.jspdf) || (src.indexOf('autotable')>-1 && window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable))) return res(); const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
        try {
            if (!window.jspdf) await load('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
            if (!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable)) await load('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
        } catch(e) { alert('No se pudo cargar el generador PDF. Verifica conexi�n e intenta de nuevo, o usa CSV.'); return; }
        if (!window.jspdf || !window.jspdf.jsPDF) { this.downloadReportCSV(); return; }
        const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        const m = data.meta; const margin = 36; let y = 40;
        doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.text(String(m.tournamentName || 'Reporte de Torneo'), margin, y); y += 18;
        doc.setFont('helvetica','normal'); doc.setFontSize(10);
        [ `Formato: ${m.format}`, `Fecha y hora: ${m.date} ${m.time}`, `Estado: ${m.status}`, `Total jugadores: ${m.players} | Mesas completadas: ${m.tables} | Rondas completadas: ${m.roundsCompleted}` ].forEach(line=>{ doc.text(line, margin, y); y += 14; });
        const hasCmdr = data.rows.some(r => r.avgTurnTimeSec != null || r.commanderDamageDealt || r.commanderDamageReceived);
        const head = [['Puesto','Jugador','Puntos','%JG','%VPO','%JGO','Mesas','G/P'].concat(hasCmdr?[ 'Tiempo medio','Cmdr D/R' ]:[])];
        const body = data.rows.map(r => [r.rank, r.name, r.points, this._fmtPct(r.mw), this._fmtPct(r.omw), this._fmtPct(r.ogw), r.gamesPlayed, `${r.wins}/${r.losses}`].concat(hasCmdr?[ r.avgTurnTimeSec!=null?Math.floor(r.avgTurnTimeSec/60)+'m '+(r.avgTurnTimeSec%60)+'s':'-', `${r.commanderDamageDealt||0}/${r.commanderDamageReceived||0}` ]:[]));
        if (doc.autoTable) {
            doc.autoTable({ startY: y + 6, head, body, styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' }, headStyles: { fillColor: [22,22,22], textColor: 255 }, alternateRowStyles: { fillColor: [246,246,246] }, margin: { left: margin, right: margin } });
        } else {
            let yy = y + 18; doc.setFontSize(8); body.slice(0,40).forEach(row=>{ doc.text(row.join(' | ').slice(0,180), margin, yy); yy += 12; });
        }
        const footerY = doc.internal.pageSize.getHeight() - 24;
        doc.setFontSize(8); doc.setTextColor(100); doc.text('M�tricas: Match Points, %JG, %VPO, %JGO (estilo EventLink). Commander opcional: tiempo medio/da�o comandante.', margin, footerY);
        doc.save((m.tournamentName || 'reporte').replace(/[^\w\-]+/g,'_') + '_posiciones.pdf');
    },

    renderPlayersList() {
        const t = this.getCurrentTournament();
        const list = document.getElementById('players-list');
        const setupDiv = document.getElementById('tournament-setup');

        if (!t || t.status !== 'setup') {
            setupDiv.style.display = 'none';
            return;
        }

        setupDiv.style.display = 'block';
        if (!t.players.length) {
            list.innerHTML = '<li style="color: var(--t-text-muted); justify-content: center;">Sin jugadores registrados</li>';
        } else {
            list.innerHTML = t.players.map(p => `
                <li>
                    <span class="player-name">
                        ${this.escapeHtml(p.name)}
                        ${p.group_id ? `<span class="group-tag" title="Grupo">${this.escapeHtml(p.group_id)}</span>` : ''}
                    </span>
                    <button class="btn-remove" onclick="app.removePlayer('${p.id}')" aria-label="Eliminar ${this.escapeHtml(p.name)}">
                        <i class="fas fa-times"></i>
                    </button>
                </li>
            `).join('');
        }

        this.updateSetupStats();
    },

    // ========================
    // INICIAR / TERMINAR TORNEO
    // ========================
    startTournament() {
        const t = this.getCurrentTournament();
        if (!t || t.players.length < 3) return;

        t.status = 'active';
        t.rounds = [];
        t.roundsCount = this.getRecommendedRounds(t.players.length);
        if (!t.scoring) {
            t.scoring = {
                2: {1: 2, 2: 1},
                3: {1: 3, 2: 2, 3: 1},
                4: {1: 4, 2: 3, 3: 2, 4: 1},
                5: {1: 5, 2: 4, 3: 3, 4: 2, 5: 1}
            };
        }
        this.saveTournaments();
        this.generateRound();
        this.renderTournamentDetail();
    },

    finishTournament() {
        const t = this.getCurrentTournament();
        if (!t) return;
        if (!confirm('�Est�s seguro de finalizar este torneo? No podr�s agregar m�s rondas.')) return;

        t.status = 'finished';
        t.finishedAt = Date.now();
        this.saveTournaments();
        this.renderTournamentDetail();
        setTimeout(() => { try { if (typeof this.showReportModal === "function") this.showReportModal(); } catch (e) {} }, 80);
    },

    deleteTournament() {
        const t = this.getCurrentTournament();
        if (!t) return;
        if (!confirm(`¿Eliminar el torneo "${t.name}"? Esta acción no se puede deshacer.`)) return;

        this.tournaments = this.tournaments.filter(tourn => tourn.id !== t.id);
        this.saveTournaments();
        this.showTournaments();
    },

    // ========================
    // GENERAR RONDA
    // ========================
    generateRound() {
        const t = this.getCurrentTournament();
        if (!t || t.status !== 'active') return;

        const roundNumber = t.rounds.length + 1;
        let activePlayers = [...t.players];
        const tableSizes = this.calculateTableSizes(activePlayers.length);
        if (!tableSizes.length) return;

        // Siempre barajar inscritos antes de distribuir (ronda 1 y siguientes), preservando equidad competitiva por puntos en pick.
        activePlayers = this.shuffleArray(activePlayers);

        const opponentsHistory = this.buildOpponentsHistory(t);
        const stats = this.getPlayerStats(t);

        const tables = [];
        const assigned = new Set();

        for (const size of tableSizes) {
            if (size === 0) {
                const byed = activePlayers
                    .filter(p => !assigned.has(p.id))
                    .sort((a, b) => (stats[b.id]?.points || 0) - (stats[a.id]?.points || 0))[0];

                if (byed) {
                    assigned.add(byed.id);
                    tables.push({
                        id: this.generateId(),
                        players: [byed.id],
                        bye: true,
                        results: [{playerId: byed.id, placement: 1, duration: 0}],
                        completed: true
                    });
                }
                continue;
            }

            const available = activePlayers.filter(p => !assigned.has(p.id));

            if (t.format === 'two-headed-giant' && size === 4) {
                const teams = this.buildTwoHeadedTeams(available, opponentsHistory, assigned);
                if (teams.length === 2) {
                    teams.forEach(team => { team.forEach(pid => assigned.add(pid)); });
                    var all = teams.flat();
                    all = this.shuffleArray(all.map(function(id){ return {id:id}; })).map(function(x){ return x.id; });
                    tables.push({ id: this.generateId(), players: all, teams, bye: false, results: [], completed: false });
                }
            } else {
                const tablePlayers = this.pickTablePlayers(available, size, opponentsHistory, assigned, stats);
                if (tablePlayers.length === size) {
                    tablePlayers.forEach(p => assigned.add(p.id));
                    var seatOrder = this.shuffleArray(tablePlayers).map(function(p){ return p.id; });
                    tables.push({ id: this.generateId(), players: seatOrder, bye: false, results: [], completed: false });
                } else if (tablePlayers.length > 0) {
                    // No dejar jugadores fuera si el solver esperaba cubrirlos: crea mesa parcial con los disponibles.
                    tablePlayers.forEach(p => assigned.add(p.id));
                    var seatOrder2 = this.shuffleArray(tablePlayers).map(function(p){ return p.id; });
                    tables.push({ id: this.generateId(), players: seatOrder2, bye: false, results: [], completed: false, partial: true });
                }
            }
        }

        // Salvaguarda final: asignar cualquier jugador restante (no debería ocurrir con solveTableDistribution).
        var remaining = activePlayers.filter(function(p){ return !assigned.has(p.id); });
        while (remaining.length > 0) {
            var chunk = remaining.splice(0, Math.min(4, remaining.length || 4));
            if (chunk.length === 1) { tables.push({ id: this.generateId(), players:[chunk[0].id], bye:true, results:[{playerId:chunk[0].id, placement:1, duration:0}], completed:true }); }
            else { tables.push({ id: this.generateId(), players: this.shuffleArray(chunk).map(function(p){return p.id;}), bye:false, results:[], completed:false, partial: chunk.length < 3 }); }
        }

        t.rounds.push({
            roundNumber,
            tables,
            completed: false,
            startedAt: null,
            finishedAt: null,
            pausedDuration: 0,
            pausedAt: null,
            edited: false
        });

        this.saveTournaments();
    },

    buildTwoHeadedTeams(available, opponentsHistory, assigned) {
        if (available.length < 4) return [];
        const shuffled = [...available].sort(() => Math.random() - 0.5);
        const teamA = [shuffled[0], shuffled[1]];
        const teamB = [shuffled[2], shuffled[3]];
        return [teamA.map(p => p.id), teamB.map(p => p.id)];
    },

    // Distribución que garantiza 100% de jugadores asignados (sin byes/sobrantes no asignados).
    // Prioriza tamaños permitidos y minimiza desbalance (diferencia <= 1 cuando es posible con 3/4/5).
    solveTableDistribution(playerCount, allowedSizes, preferredSize) {
        var sizes = (allowedSizes || [3,4]).filter(function(s){ return s > 0; }).slice().sort(function(a,b){ return b-a; });
        if (!sizes.length) sizes = [3,4];
        var min = Math.min.apply(null, sizes);
        var max = Math.max.apply(null, sizes);
        if (playerCount <= 0) return [];
        if (playerCount < min) return this.smallTableFallback(playerCount, sizes);
        var pref = sizes.indexOf(preferredSize) >= 0 ? preferredSize : (sizes.indexOf(4)>=0?4:sizes[0]);
        // Búsqueda acotada: pocos tamaños (2,3,4,5), coste trivial.
        var best = null;
        var maxTables = Math.floor(playerCount / min);
        function score(counts) {
            var total = 0, tables = 0, spread = 0, used = {};
            sizes.forEach(function(s,i){ var c=counts[i]||0; total += c*s; tables += c; if(c) used[s]=c; });
            if (total !== playerCount) return 1e15;
            var usedSizes = Object.keys(used).map(Number);
            if (usedSizes.length > 1) spread = Math.max.apply(null, usedSizes) - Math.min.apply(null, usedSizes);
            var nonPref = tables - (counts[sizes.indexOf(pref)]||0);
            return spread * 1000 + nonPref * 10 + Math.abs(tables - Math.round(playerCount/pref));
        }
        function rec(i, remaining, counts) {
            if (i === sizes.length - 1) {
                var s = sizes[i]; if (remaining % s !== 0) return;
                counts[i] = remaining / s; var sc = score(counts); if (!best || sc < best.sc) best = { counts: counts.slice(), sc: sc };
                return;
            }
            var s = sizes[i];
            var maxC = Math.floor(remaining / s);
            for (var c = maxC; c >= 0; c--) { counts[i] = c; rec(i+1, remaining - c*s, counts); }
            counts[i] = 0;
        }
        rec(0, playerCount, sizes.map(function(){ return 0; }));
        if (best) {
            var out = [];
            sizes.forEach(function(s,i){ for(var k=0;k<(best.counts[i]||0);k++) out.push(s); });
            return out.sort(function(a,b){ return b-a; });
        }
        return this.smallTableFallback(playerCount, sizes);
    },
    smallTableFallback(playerCount, sizes) {
        // Último recurso: usa el menor tamaño permitido repetido y agrupa sobrante si cabe.
        var min = Math.min.apply(null, sizes), max = Math.max.apply(null, sizes);
        if (playerCount <= max) return [playerCount];
        var tables = Math.max(1, Math.ceil(playerCount / Math.min(4, max)));
        var base = Math.floor(playerCount / tables), rem = playerCount % tables;
        var out = []; for (var i=0;i<tables;i++) out.push(base + (i < rem ? 1 : 0));
        // Ajuste simple: evita mesas de 1/2 si hay alternativa fusionando hacia vecinos cuando posible.
        return out.sort(function(a,b){ return b-a; });
    },

    calculateTableSizes(playerCount) {
        if (playerCount < 2) return [];
        const t = this.getCurrentTournament();
        if (t && t.format === 'two-headed-giant') {
            // 2HG real son 4 jugadores; para cubrir 100% en emparejamiento suizo simplificado, solo generamos mesas de 4 completas.
            // Excedente < 4 se asigna como bye rotativo (o se omite la ronda completa si no hay mesa). Aquí evitamos dejar jugadores "sin mesa":
            // si hay 13, se crean 3 mesas de 4? (12) y 1 bye — se informa; distribución exacta 4/4/5 no es 2HG estándar.
            if (playerCount < 4) return [];
            const teamsOf4 = Math.floor(playerCount / 4);
            const rem = playerCount % 4;
            var out = Array(teamsOf4).fill(4);
            if (rem > 0) out.push(0); // bye para sobrantes (no inventar mesa 2HG inválida)
            return out;
        }
        if (t && t.format !== 'commander' && t.format !== 'two-headed-giant') {
            if (playerCount < 2) return [];
            const pairs = Math.floor(playerCount / 2);
            if (playerCount % 2 === 0) return Array(pairs).fill(2);
            return [...Array(pairs).fill(2), 0]; // 1v1: impar => bye
        }
        const mode = (t && t.distributionModel) || 'auto';
        const allowedSizes = this.getAllowedSizes(t);
        var pref = 4;
        if (mode === 'prefer3') pref = 3; else if (mode === 'prefer5') pref = 5; else if (mode === 'prefer4') pref = 4;
        return this.solveTableDistribution(playerCount, allowedSizes.length ? allowedSizes : [3,4,5], pref);
    },

    getAllowedSizes(t) {
        if (!t) return [3, 4];
        if (t.distributionModel === 'custom' && t.customAllowedSizes && t.customAllowedSizes.length) {
            return t.customAllowedSizes.slice().sort((a, b) => a - b);
        }
        if (t.format === 'commander') return [3, 4, 5];
        if (t.format === 'two-headed-giant') return [4];
        return [2];
    },

    autoDistribution(playerCount, allowedSizes) {
        if (playerCount < 3) return [];
        const allow5 = allowedSizes.includes(5);
        const allow4 = allowedSizes.includes(4);
        const allow3 = allowedSizes.includes(3);

        if (allow5 && playerCount % 5 === 0) {
            return Array(playerCount / 5).fill(5);
        }
        if (allow5 && playerCount % 5 === 1 && playerCount >= 11) {
            const fives = Math.floor(playerCount / 5) - 1;
            return [...Array(fives).fill(5), 4, 4];
        }
        if (allow5 && playerCount % 5 === 2 && playerCount >= 12) {
            const fives = Math.floor(playerCount / 5) - 1;
            return [...Array(fives).fill(5), 4, 3];
        }
        if (allow5 && playerCount % 5 === 3 && playerCount >= 13) {
            const fives = Math.floor(playerCount / 5) - 1;
            return [...Array(fives).fill(5), 4, 4];
        }
        if (allow5 && playerCount % 5 === 4 && playerCount >= 14) {
            const fives = Math.floor(playerCount / 5) - 1;
            return [...Array(fives).fill(5), 4, 3, 3];
        }

        if (playerCount % 4 === 0) {
            return Array(playerCount / 4).fill(4);
        } else if (playerCount % 4 === 1) {
            const fours = Math.floor(playerCount / 4);
            const result = Array(fours).fill(4);
            if (allow3 && fours > 0) {
                result[fours - 1] = 3;
                result.push(3);
            } else {
                result.push(0);
            }
            return result;
        } else if (playerCount % 4 === 2) {
            if (playerCount === 2) return allow3 ? [0, 0] : [];
            const fours = Math.floor((playerCount - 6) / 4);
            return [...Array(fours).fill(4), 3, 3];
        } else {
            const fours = Math.floor((playerCount - 3) / 4);
            return [...Array(fours).fill(4), 3];
        }
    },

    preferSmallTables(playerCount, allowedSizes) {
        const allow3 = allowedSizes.includes(3);
        const allow4 = allowedSizes.includes(4);
        const allow5 = allowedSizes.includes(5);
        if (!allow3 && !allow4 && !allow5) return [];

        if (allow3 && playerCount % 3 === 0) {
            return Array(playerCount / 3).fill(3);
        }
        if (allow3 && allow4) {
            if (playerCount % 3 === 1 && playerCount >= 4) {
                const threes = Math.floor(playerCount / 3) - 1;
                return [...Array(threes).fill(3), 4];
            }
            if (playerCount % 3 === 2 && playerCount >= 5) {
                const threes = Math.floor(playerCount / 3) - 1;
                return [...Array(threes).fill(3), 4];
            }
        }
        if (allow3 && allow5) {
            if (playerCount % 3 === 1 && playerCount >= 5) {
                const threes = Math.floor(playerCount / 3) - 1;
                return [...Array(threes).fill(3), 5];
            }
            if (playerCount % 3 === 2 && playerCount >= 8) {
                const threes = Math.floor((playerCount - 5) / 3);
                return [...Array(threes).fill(3), 5];
            }
        }
        return this.autoDistribution(playerCount, allowedSizes);
    },

    preferFiveTables(playerCount, allowedSizes) {
        const allow5 = allowedSizes.includes(5);
        if (!allow5) return this.autoDistribution(playerCount, allowedSizes);

        if (playerCount % 5 === 0) {
            return Array(playerCount / 5).fill(5);
        }
        if (playerCount % 5 === 1 && playerCount >= 11) {
            const fives = Math.floor(playerCount / 5) - 1;
            return [...Array(fives).fill(5), 4, 4];
        }
        if (playerCount % 5 === 2 && playerCount >= 12) {
            const fives = Math.floor(playerCount / 5) - 1;
            return [...Array(fives).fill(5), 4, 3];
        }
        if (playerCount % 5 === 3 && playerCount >= 13) {
            const fives = Math.floor(playerCount / 5) - 1;
            return [...Array(fives).fill(5), 4, 4];
        }
        if (playerCount % 5 === 4 && playerCount >= 14) {
            const fives = Math.floor(playerCount / 5) - 1;
            return [...Array(fives).fill(5), 4, 3, 3];
        }
        return this.autoDistribution(playerCount, allowedSizes);
    },

    preferFourTables(playerCount, allowedSizes) {
        const allow4 = allowedSizes.includes(4);
        if (!allow4) return this.autoDistribution(playerCount, allowedSizes);

        if (playerCount % 4 === 0) {
            return Array(playerCount / 4).fill(4);
        }
        if (playerCount % 4 === 1 && playerCount >= 5) {
            const fours = Math.floor(playerCount / 4) - 1;
            return [...Array(fours).fill(4), 3, 3];
        }
        if (playerCount % 4 === 2 && playerCount >= 6) {
            const fours = Math.floor((playerCount - 6) / 4);
            return [...Array(fours).fill(4), 3, 3];
        }
        if (playerCount % 4 === 3 && playerCount >= 7) {
            const fours = Math.floor((playerCount - 3) / 4);
            return [...Array(fours).fill(4), 3];
        }
        return this.autoDistribution(playerCount, allowedSizes);
    },

    customDistribution(playerCount, allowedSizes) {
        const sizes = allowedSizes.filter(s => s > 0 && s <= 5).sort((a, b) => b - a);
        if (!sizes.length) return [];
        return this.preferFourTables(playerCount, sizes);
    },

    getFormatLabel(format) {
        const labels = {
            commander: 'Magic: The Gathering Commander',
            pioneer: 'Magic: The Gathering Pioneer',
            modern: 'Magic: The Gathering Modern',
            standard: 'Magic: The Gathering Standard',
            legacy: 'Magic: The Gathering Legacy',
            pauper: 'Magic: The Gathering Pauper',
            draft: 'Magic: The Gathering Draft',
            sealed: 'Magic: The Gathering Sealed',
            'two-headed-giant': 'Magic: The Gathering Two-Headed Giant',
            other: format
        };
        return labels[format] || format;
    },

    buildOpponentsHistory(tournament) {
        const history = {};
        tournament.players.forEach(p => {
            history[p.id] = new Set();
        });

        tournament.rounds.forEach(round => {
            if (!round.completed) return;
            round.tables.forEach(table => {
                if (table.bye) return;
                table.players.forEach(pid => {
                    table.players.forEach(otherPid => {
                        if (pid !== otherPid) {
                            history[pid].add(otherPid);
                        }
                    });
                });
            });
        });

        return history;
    },

    pickTablePlayers(available, size, opponentsHistory, assigned, stats) {
        if (available.length === 0) return [];

        const sorted = [...available].sort((a, b) => {
            const sa = stats[a.id]?.points || 0;
            const sb = stats[b.id]?.points || 0;
            return sb - sa;
        });

        const selected = [sorted[0]];
        assigned.add(sorted[0].id);

        for (let i = 1; i < size && selected.length < size; i++) {
            const candidates = sorted.filter(p => !assigned.has(p.id));
            const best = candidates.find(c => {
                return selected.every(s =>
                    !opponentsHistory[c.id]?.has(s.id) &&
                    !(c.group_id && s.group_id && c.group_id === s.group_id)
                );
            });

            if (best) {
                selected.push(best);
                assigned.add(best.id);
            } else {
                if (candidates.length > 0) {
                    selected.push(candidates[0]);
                    assigned.add(candidates[0].id);
                }
            }
        }

        return selected;
    },

    shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    nextRound() {
        const t = this.getCurrentTournament();
        if (!t || t.status !== 'active') return;
        if (t.players.length < 3) return;

        if (t.roundsCount && t.rounds.length >= t.roundsCount) {
            alert('Se alcanzó el número máximo de rondas configuradas.');
            return;
        }

        const currentRound = t.rounds[t.rounds.length - 1];
        if (currentRound && !currentRound.completed) {
            const pendingCount = currentRound.tables.filter(table => !table.completed && !table.bye).length;
            if (pendingCount > 0) {
                if (!confirm(`Quedan ${pendingCount} mesa(s) sin resultado. ¿Generar nueva ronda de todas formas?`)) {
                    return;
                }
            }
            currentRound.tables.forEach(table => {
                if (!table.completed) {
                    table.results = table.players.map(pid => ({playerId: pid, placement: 0, duration: 0}));
                    table.completed = true;
                }
            });
            currentRound.completed = true;
            currentRound.finishedAt = Date.now();
        }

        this.stopTimer();
        this.generateRound();
        this.renderTournamentDetail();
    },

    addExtraRound() {
        const t = this.getCurrentTournament();
        if (!t || t.status !== 'active') return;
        if (!confirm('¿Agregar una ronda adicional? El torneo se extenderá más allá de la configuración inicial.')) return;

        t.roundsCount = (t.roundsCount || 0) + 1;
        this.saveTournaments();
        this.generateRound();
        this.renderTournamentDetail();
    },

    // ========================
    // RESULTADOS DE RONDA
    // ========================
    renderCurrentRound() {
        const t = this.getCurrentTournament();
        const roundDiv = document.getElementById('tournament-round');
        const standingsDiv = document.getElementById('tournament-standings');
        const historyDiv = document.getElementById('tournament-history');
        const roundToolbar = document.getElementById('round-toolbar');

        if (!t || !t.rounds.length) {
            roundDiv.style.display = 'none';
            standingsDiv.style.display = 'none';
            historyDiv.style.display = 'none';
            if (roundToolbar) roundToolbar.style.display = 'none';
            return;
        }

        const currentRound = t.rounds[t.rounds.length - 1];
        if (!currentRound) return;

        roundDiv.style.display = 'block';
        standingsDiv.style.display = 'block';
        historyDiv.style.display = 'block';

        document.getElementById('round-title').textContent = `Ronda ${currentRound.roundNumber}`;
        document.getElementById('round-badge').textContent = t.status === 'active' && !currentRound.completed ? 'En curso' : 'Completada';

        const canEdit = t.status === 'active' && !currentRound.completed;
        if (roundToolbar) {
            roundToolbar.style.display = canEdit ? 'flex' : 'none';
        }

        const tablesContainer = document.getElementById('round-tables');
        const opponentsHistory = this.buildOpponentsHistory(t);

        tablesContainer.innerHTML = currentRound.tables.map((table, idx) => {
            const players = table.players.map(pid => t.players.find(p => p.id === pid)).filter(Boolean);
            const hasRepeats = this.tableHasRepeats(table, opponentsHistory);

            if (table.bye) {
                const p = players[0];
                return `
                    <div class="table-card">
                        <h4>Mesa ${idx + 1} · Bye</h4>
                        <div class="table-players">
                            <div class="table-player winner">
                                <span class="p-name">${this.escapeHtml(p.name)}</span>
                                <span style="color: var(--t-amarillo); font-weight: 700;">BYE · +3 pts</span>
                            </div>
                        </div>
                    </div>
                `;
            }

            if (t.format === 'two-headed-giant' && table.teams && table.teams.length === 2) {
                const teamA = table.teams[0].map(pid => t.players.find(p => p.id === pid)).filter(Boolean);
                const teamB = table.teams[1].map(pid => t.players.find(p => p.id === pid)).filter(Boolean);

                const teamAResult = table.results.find(r => r.team === 'A');
                const teamBResult = table.results.find(r => r.team === 'B');
                const teamAPlacement = teamAResult ? teamAResult.placement : 0;
                const teamBPlacement = teamBResult ? teamBResult.placement : 0;

                return `
                    <div class="table-card">
                        <h4>Mesa ${idx + 1} ${table.officialReportAppliedAt ? '<span class="sync-mode sync-mode-firestore" style="margin-left:6px">resultado oficial</span>' : ''}</h4>
                        <div class="table-legend" style="font-size: 0.72rem; color: var(--t-text-muted); margin-top: 2px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                          <a class="btn-secondary btn-sm" href="${app.getMesaUrl(table.id, idx + 1)}" target="_blank" rel="noopener"><i class="fas fa-mobile-screen-button"></i> Abrir mesa t�ctil</a>
                          <code style="font-size:.72rem; opacity:.8;">Mesa: ${idx + 1}</code>
                        </div>
                        <div class="table-players">
                            <div class="table-player ${teamAPlacement === 1 ? 'winner' : ''}">
                                <span class="p-name">Equipo A: ${teamA.map(p => this.escapeHtml(p.name)).join(' + ')}</span>
                                ${canEdit ? `
                                    <select class="placement-select" onchange="app.updateTeamResult('${table.id}', 'A', this.value)" aria-label="Posición Equipo A">
                                        <option value="0" ${teamAPlacement === 0 ? 'selected' : ''}>-</option>
                                        <option value="1" ${teamAPlacement === 1 ? 'selected' : ''}>Victoria</option>
                                        <option value="2" ${teamAPlacement === 2 ? 'selected' : ''}>Derrota</option>
                                    </select>
                                ` : `<span>${teamAPlacement > 0 ? (teamAPlacement === 1 ? 'Victoria' : 'Derrota') : '-'}</span>`}
                            </div>
                            <div class="table-player ${teamBPlacement === 1 ? 'winner' : ''}">
                                <span class="p-name">Equipo B: ${teamB.map(p => this.escapeHtml(p.name)).join(' + ')}</span>
                                ${canEdit ? `
                                    <select class="placement-select" onchange="app.updateTeamResult('${table.id}', 'B', this.value)" aria-label="Posición Equipo B">
                                        <option value="0" ${teamBPlacement === 0 ? 'selected' : ''}>-</option>
                                        <option value="1" ${teamBPlacement === 1 ? 'selected' : ''}>Victoria</option>
                                        <option value="2" ${teamBPlacement === 2 ? 'selected' : ''}>Derrota</option>
                                    </select>
                                ` : `<span>${teamBPlacement > 0 ? (teamBPlacement === 1 ? 'Victoria' : 'Derrota') : '-'}</span>`}
                            </div>
                        </div>
                    </div>
                `;
            }

            const playersHtml = players.map((p, idx) => {
                const existingResult = table.results.find(r => r.playerId === p.id);
                const placement = existingResult ? existingResult.placement : 0;
                const duration = existingResult ? existingResult.duration : '';
                const bounties = existingResult ? (existingResult.bounties || 0) : 0;
                const isRepeat = !table.bye && hasRepeats && this.isRepeatInTable(p.id, table, opponentsHistory);
                const tableSize = players.length;
                const maxBounties = tableSize - 1;
                const positionPts = placement > 0 ? (tableSize - placement) + 1 : 0;
                const turnState = table.turnState;
                const isActiveTurn = turnState && turnState.activePlayerIndex === idx;
                const playerTurnTime = turnState ? (turnState.playerTimes[idx] || 0) : 0;

                let playerBadge = null;
                if (placement > 0 && currentRound.startedAt) {
                    const roundMinutes = t.roundDuration || 60;
                    const elapsedMin = Math.floor((Date.now() - currentRound.startedAt - (currentRound.pausedDuration || 0)) / 60000);
                    if (placement === 1) {
                        const speedThreshold = tableSize <= 4 ? 20 : 35;
                        if (elapsedMin <= speedThreshold) {
                            playerBadge = {type: 'speed', icon: '⚡', title: 'Victoria Rápida'};
                        } else {
                            playerBadge = {type: 'methodical', icon: '🝆', title: 'Victoria Metódica'};
                        }
                    } else if (placement === tableSize && elapsedMin <= 15) {
                        playerBadge = {type: 'early', icon: '⚠︝', title: 'Eliminación Temprana'};
                    }
                }

                const placementButtons = Array.from({length: tableSize}, (_, i) => {
                    const val = i + 1;
                    const colorClass = val === 1 ? 'win' : (val === tableSize ? 'last' : 'mid');
                    return `<button type="button" class="placement-btn placement-btn-${colorClass} ${placement === val ? 'selected' : ''}" onclick="app.updateResult('${table.id}', '${p.id}', 'placement', '${val}')" aria-label="Posición ${val} de ${this.escapeHtml(p.name)}">${val}º</button>`;
                }).join('');

                return `
                    <div class="table-player ${isRepeat ? 'repeat' : ''} ${placement === 1 ? 'winner' : ''} ${isActiveTurn ? 'turn-active' : ''}">
                        <span class="p-name" title="${p.group_id ? 'Grupo: ' + this.escapeHtml(p.group_id) : ''}">${this.escapeHtml(p.name)}${p.group_id && canEdit ? `<span class="group-tag-small">${this.escapeHtml(p.group_id)}</span>` : ''}</span>
                        <span class="p-placement">
                            ${canEdit ? `
                                <div class="placement-btn-group">
                                    <button type="button" class="placement-btn placement-btn-clear ${placement === 0 ? 'selected' : ''}" onclick="app.updateResult('${table.id}', '${p.id}', 'placement', '0')" aria-label="Sin posición">${placement === 0 ? '✕' : '-'}</button>
                                    ${placementButtons}
                                </div>
                                ${t.format === 'commander' ? `<input type="number" class="bounty-input" placeholder="💀" value="${bounties}" min="0" max="${maxBounties}" onchange="app.updateResult('${table.id}', '${p.id}', 'bounties', this.value)" aria-label="Bounties (máx ${maxBounties}) de ${this.escapeHtml(p.name)}">` : ''}
                                <input type="number" class="duration-input" placeholder="min" value="${duration}" min="0" onchange="app.updateResult('${table.id}', '${p.id}', 'duration', this.value)" aria-label="Duración en minutos">
                            ` : `
                                <span title="Posición / Puntos base">${placement > 0 ? placement + '°' : '-'}</span>
                                <span title="+${positionPts || 0} pts de posición" class="position-pts">${positionPts > 0 ? '+' + positionPts + ' pts' : ''}</span>
                                ${placement === 1 ? '<span title="Ganador" style="color: var(--t-amarillo); font-weight: 700;">🥇</span>' : ''}
                                ${t.format === 'commander' ? `<span title="Bounties (máx ${maxBounties})">${bounties > 0 ? '☠ ' + bounties : '-'}</span>` : ''}
                                ${existingResult && existingResult.timeOfElimination ? `<span title="Eliminado (reloj de ronda)" style="color: var(--t-text-muted); font-size: 0.75rem;">⏱ ${this.escapeHtml(existingResult.timeOfElimination)}</span>` : ''}
                                ${existingResult && (existingResult.playerTurnTime || existingResult.playerTurnTimeSec != null) ? `<span title="Tiempo total consumido en turnos" style="color: var(--t-text-muted); font-size: 0.75rem;">⌛ ${this.escapeHtml(existingResult.playerTurnTime || (Math.floor((Number(existingResult.playerTurnTimeSec)||0)/60)+':'+String((Number(existingResult.playerTurnTimeSec)||0)%60).padStart(2,'0')))}</span>` : (playerTurnTime > 0 ? `<span title="Tiempo en turnos" style="color: var(--t-text-muted); font-size: 0.75rem;">⌛ ${Math.floor(playerTurnTime/60)}:${String(playerTurnTime%60).padStart(2,'0')}</span>` : '')}
                                ${playerBadge ? `<span title="${playerBadge.title}" class="badge-${playerBadge.type}">${playerBadge.icon}</span>` : ''}
                                <span style="color: var(--t-text-muted); font-size: 0.85rem;">${duration ? duration + ' min' : ''}</span>
                            `}
                        </span>
                    </div>
                `;
            }).join('');

            const pointsLegend = Array.from({length: players.length}, (_, i) => {
                const pos = i + 1;
                const pts = players.length - i;
                return `${pos}°=${pts}pts`;
            }).join(' · ');

            const turnControls = t.format === 'commander' && canEdit
                ? `<div class="turn-controls">
                    <div class="turn-timer" aria-label="Tiempo de turno actual">
                        <span class="turn-timer-label">Turno:</span>
                        <span id="turn-timer-${table.id}" class="turn-timer-display">00:00</span>
                    </div>
                    <button type="button" class="btn btn-sm btn-turn" onclick="app.passTurn('${table.id}')" aria-label="Pasar turno al siguiente jugador">
                        PASAR TURNO
                    </button>
                </div>`
                : '';

            return `
                                    <div class="table-card">
                        <h4>Mesa ${idx + 1} ${hasRepeats ? '<span style="color: var(--t-rosa); font-size: 0.75rem; margin-left: 8px;">CON REPETICION</span>' : ''} ${table.officialReportAppliedAt ? '<span class="sync-mode sync-mode-firestore" style="margin-left:6px">resultado oficial</span>' : ''}</h4>
                        <div class="table-legend" style="font-size: 0.72rem; color: var(--t-text-muted); margin-top: 2px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                          <span>Puntos base: ${pointsLegend}</span>
                          <a class="btn-secondary btn-sm" href="${app.getMesaUrl(table.id, idx + 1)}" target="_blank" rel="noopener"><i class="fas fa-mobile-screen-button"></i> Abrir mesa tactil</a>
                          <code style="font-size:.72rem; opacity:.8;">Mesa: ${idx + 1}</code>
                        </div>
                    <div class="table-players">${playersHtml}</div>
                    ${turnControls}
                </div>
            `;
        }).join('');

        document.getElementById('round-actions').style.display = canEdit ? 'flex' : 'none';
    },

    tableHasRepeats(table, opponentsHistory) {
        if (table.bye || table.players.length < 2) return false;
        for (let i = 0; i < table.players.length; i++) {
            for (let j = i + 1; j < table.players.length; j++) {
                if (opponentsHistory[table.players[i]]?.has(table.players[j])) {
                    return true;
                }
            }
        }
        return false;
    },

    isRepeatInTable(playerId, table, opponentsHistory) {
        return table.players.some(pid => pid !== playerId && opponentsHistory[playerId]?.has(pid));
    },

    updateResult(tableId, playerId, field, value) {
        const t = this.getCurrentTournament();
        if (!t || t.status !== 'active') return;

        const round = t.rounds[t.rounds.length - 1];
        const table = round.tables.find(tb => tb.id === tableId);
        if (!table) return;

        if (t.format === 'two-headed-giant' && table.teams && table.teams.length === 2) {
            return;
        }

         let result = table.results.find(r => r.playerId === playerId);
        if (!result) {
            result = {playerId, placement: 0, duration: 0, bounties: 0};
            table.results.push(result);
        }

        if (field === 'placement') {
            result.placement = parseInt(value) || 0;
        } else if (field === 'duration') {
            result.duration = parseInt(value) || 0;
        } else if (field === 'bounties') {
            const numVal = parseInt(value) || 0;
            const tableSize = table.players.length;
            const maxBounties = tableSize - 1;

            if (numVal > maxBounties) {
                alert(`Máximo de bounties para este jugador en mesa de ${tableSize}: ${maxBounties}`);
                return;
            }

            const otherBounties = table.results
                .filter(r => r.playerId !== playerId)
                .reduce((sum, r) => sum + (r.bounties || 0), 0);

            if (otherBounties + numVal > maxBounties) {
                const remaining = maxBounties - otherBounties;
                if (remaining < 0) remaining = 0;

                if (!confirm(`Solo quedan ${remaining} bounties disponibles en esta mesa. ¿Asignar ${remaining}?`)) {
                    return;
                }
                result.bounties = remaining;
                this.saveTournaments();
                this.renderCurrentRound();
                this.renderDashboard();
                return;
            }

            result.bounties = numVal;
        }

        // Auto-calculate duration from internal timestamps when placement is set
        if (field === 'placement' && result.placement > 0 && round.startedAt) {
            const now = Date.now();
            const elapsedMs = now - round.startedAt - (round.pausedDuration || 0);
            result.duration = Math.max(1, Math.round(elapsedMs / 60000));
            table.finishedAt = now;
        }

        // Check if all players in table have results
        if (table.bye) {
            table.completed = true;
        } else if (table.players.every(pid => {
            const r = table.results.find(res => res.playerId === pid);
            return r && r.placement > 0;
        })) {
            table.completed = true;
        }

        this.saveTournaments();
        this.renderCurrentRound();
        this.renderDashboard();
    },

    updateTeamResult(tableId, team, value) {
        const t = this.getCurrentTournament();
        if (!t || t.status !== 'active' || t.format !== 'two-headed-giant') return;

        const round = t.rounds[t.rounds.length - 1];
        const table = round.tables.find(tb => tb.id === tableId);
        if (!table || !table.teams || table.teams.length !== 2) return;

        let result = table.results.find(r => r.team === team);
        if (!result) {
            result = {team, placement: 0, duration: 0};
            table.results.push(result);
        }

        result.placement = parseInt(value) || 0;

        if (result.placement > 0 && round.startedAt) {
            const now = Date.now();
            const elapsedMs = now - round.startedAt - (round.pausedDuration || 0);
            result.duration = Math.max(1, Math.round(elapsedMs / 60000));
            table.finishedAt = now;
        }

        const bothTeamsHaveResult = ['A', 'B'].every(teamLetter => {
            const r = table.results.find(res => res.team === teamLetter);
            return r && r.placement > 0;
        });

        if (bothTeamsHaveResult) {
            table.completed = true;
        }

        this.saveTournaments();
        this.renderCurrentRound();
        this.renderDashboard();
    },

    saveRoundResults() {
        const t = this.getCurrentTournament();
        if (!t || t.status !== 'active') return;

        const round = t.rounds[t.rounds.length - 1];
        if (!round) return;

        const allCompleted = round.tables.every(table => table.completed);
        const pendingCount = round.tables.filter(table => !table.completed && !table.bye).length;

        if (!allCompleted) {
            if (!confirm(`Quedan ${pendingCount} mesa(s) sin resultado. ¿Guardar de todas formas?`)) {
                return;
            }
        }

        round.completed = true;
        this.saveTournaments();
        this.stopTimer();

        if (allCompleted) {
            alert(`Ronda ${round.roundNumber} finalizada. ${round.tables.filter(tb => !tb.bye).length} mesas completadas.`);
            setTimeout(() => { if (confirm('�Deseas previsualizar/descargar el reporte de posiciones de esta ronda?')) this.showReportModal(); }, 60);
        }

        this.renderTournamentDetail();
    },

    // ========================
    // ESTADÝSTICAS Y POSICIONES
    // ========================
    getPlayerStats(tournament) {
        const stats = {};
        tournament.players.forEach(p => {
            stats[p.id] = {
                name: p.name,
                points: 0,
                bounties: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                gamesPlayed: 0,
                totalDuration: 0,
                avgDuration: 0,
                opponents: new Set()
            };
        });

        tournament.rounds.forEach(round => {
            if (!round.completed) return;
            round.tables.forEach(table => {
                if (table.bye) {
                    const result = table.results[0];
                    if (result) {
                        const s = stats[result.playerId];
                        s.points += 3;
                        s.wins += 1;
                        s.gamesPlayed += 1;
                    }
                    return;
                }

                if (tournament.format === 'two-headed-giant' && table.teams && table.teams.length === 2) {
                    const teamAResult = table.results.find(r => r.team === 'A');
                    const teamBResult = table.results.find(r => r.team === 'B');

                    table.teams.forEach((team, idx) => {
                        const teamResult = idx === 0 ? teamAResult : teamBResult;
                        const placement = teamResult ? teamResult.placement : 0;
                        const points = placement === 1 ? 3 : 0;

                        team.forEach(pid => {
                            const s = stats[pid];
                            s.gamesPlayed += 1;
                            s.points += points;
                            if (placement === 1) s.wins += 1;
                            else if (placement === 2) s.losses += 1;

                            table.teams[idx].forEach(opid => {
                                if (pid !== opid) s.opponents.add(opid);
                            });
                            table.teams[1 - idx].forEach(opid => {
                                s.opponents.add(opid);
                            });

                            if (teamResult && teamResult.duration > 0) {
                                s.totalDuration += teamResult.duration;
                                s.avgDuration = Math.round(s.totalDuration / s.gamesPlayed);
                            }
                        });
                    });
                    return;
                }

                table.players.forEach(pid => {
                    const s = stats[pid];
                    s.gamesPlayed += 1;
                    table.players.forEach(opid => {
                        if (pid !== opid) s.opponents.add(opid);
                    });
                });

                table.results.forEach(result => {
                    const s = stats[result.playerId];
                    if (!s) return;

                    const tableSize = table.players.length;
                    const points = this.getPointsForPosition(result.placement, tableSize);

                    if (result.placement === 1) {
                        s.points += points;
                        s.wins += 1;
                    } else if (result.placement === 2) {
                        s.points += points;
                        if (tableSize === 2) {
                            s.losses += 1;
                        }
                    } else if (result.placement === 3) {
                        s.points += points;
                        s.losses += 1;
                    } else if (result.placement === 4) {
                        s.losses += 1;
                    } else if (result.placement >= 5) {
                        s.losses += 1;
                    }

                    if (result.bounties > 0) {
                        s.bounties += result.bounties;
                        s.points += result.bounties;
                    }

                    if (result.duration > 0) {
                        s.totalDuration += result.duration;
                        s.avgDuration = Math.round(s.totalDuration / s.gamesPlayed);
                    }
                });
            });
        });

        return stats;
    },

    renderStandings() {
        const t = this.getCurrentTournament();
        const container = document.getElementById('standings-table');
        if (!t || !t.players.length) {
            container.innerHTML = '<div class="empty-state"><p>Sin datos</p></div>';
            return;
        }

        const stats = this.getPlayerStats(t);
        const sorted = Object.entries(stats)
            .map(([id, s]) => ({id, ...s}))
            .sort((a, b) => b.points - a.points || b.wins - a.wins || b.bounties - a.bounties || (b.avgDuration || 0) - (a.avgDuration || 0));

        container.innerHTML = `
            <div class="standing-row header">
                <div>#</div>
                <div>Jugador</div>
                <div title="Puntos totales (base + bounties)" style="text-align: center;">Pts</div>
                <div title="Victorias" style="text-align: center;">V</div>
                <div title="Bounties (puntos por eliminación)" style="text-align: center;">Bs</div>
                <div style="text-align: center;">Duración</div>
            </div>
            ${sorted.map((s, i) => `
                <div class="standing-row">
                    <div class="standing-rank">${i + 1}</div>
                    <div class="standing-name">${this.escapeHtml(s.name)}</div>
                    <div class="standing-stat" title="Base: ${s.points - (s.bounties || 0)} + Bounties: ${s.bounties || 0} = Total: ${s.points}">${s.points}</div>
                    <div class="standing-stat">${s.wins}</div>
                    <div class="standing-stat" style="color: var(--t-rosa);">${s.bounties > 0 ? '💀 ' + s.bounties : '-'}</div>
                    <div class="standing-stat">${s.avgDuration > 0 ? s.avgDuration + ' min' : '-'}</div>
                </div>
            `).join('')}
        `;
    },

    renderHistory() {
        const t = this.getCurrentTournament();
        const container = document.getElementById('history-list');
        if (!t || !t.rounds.length) {
            container.innerHTML = '<div class="empty-state"><p>Sin rondas jugadas</p></div>';
            return;
        }

        container.innerHTML = t.rounds.map(round => {
            const tablesHtml = round.tables.map((table, idx) => {
                const players = table.players.map(pid => t.players.find(p => p.id === pid)).filter(Boolean);
                const results = table.results ? table.results : [];

                if (table.bye) {
                    const p = players[0];
                    return `
                        <div class="history-table">
                            <div class="ht-title">Mesa ${idx + 1} · Bye</div>
                            <div class="ht-players">${this.escapeHtml(p?.name || '?')} · Ganó automáticamente</div>
                        </div>
                    `;
                }

                const sortedResults = [...results].sort((a, b) => a.placement - b.placement);
                const playersResult = players.map(p => {
                    const r = results.find(res => res.playerId === p.id);
                    return `${this.escapeHtml(p.name)}${r && r.placement > 0 ? ' (' + r.placement + '°)' : ''}`;
                }).join(' · ');

                const avgDuration = results.length > 0 ? Math.round(results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length) : 0;

                return `
                    <div class="history-table">
                        <div class="ht-title">Mesa ${idx + 1}</div>
                        <div class="ht-players">${playersResult || 'Sin resultados'}</div>
                        ${avgDuration > 0 ? `<div class="ht-results">Duración promedio: ${avgDuration} min</div>` : ''}
                    </div>
                `;
            }).join('');

            return `
                <div class="history-round">
                    <h4>Ronda ${round.roundNumber}</h4>
                    ${tablesHtml}
                </div>
            `;
        }).join('');
    },

    // ========================
    // UTILIDADES
    // ========================
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    updateYear() {
        const yearEl = document.getElementById('year');
        if (yearEl) yearEl.textContent = new Date().getFullYear();
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
window.app = app;
