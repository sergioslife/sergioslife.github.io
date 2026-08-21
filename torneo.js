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
        const is1v1 = ['pioneer', 'modern', 'standard', 'legacy', 'pauper', 'draft', 'sealed', 'other'].includes(format);
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
            matchFormat: is1v1 || is2hg ? 'bo1' : null,
            teamCreation: is2hg ? 'random' : null,
            createdAt: Date.now()
        };

        if (isCommander) {
            const roundsCount = parseInt(document.getElementById('input-t-rounds').value, 10) || 4;
            const roundDuration = parseInt(document.getElementById('input-t-duration').value, 10) || 50;
            const tableSize = document.getElementById('input-t-tablesize').value;
            const distributionModel = document.getElementById('input-t-distribution').value || 'auto';
            const customAllowedSizes = this.getCustomAllowedSizes();

            tournament.roundsCount = roundsCount;
            tournament.roundDuration = roundDuration;
            tournament.tableSize = tableSize;
            tournament.distributionModel = distributionModel;
            tournament.customAllowedSizes = customAllowedSizes;
            tournament.scoring = {
                4: {1: 3, 2: 2, 3: 1, 4: 0},
                3: {1: 3, 2: 2, 3: 1}
            };
        } else if (is1v1 || is2hg) {
            const roundsCount = parseInt(document.getElementById(is2hg ? 'input-t-rounds-2hg' : 'input-t-rounds-1v1').value, 10) || 4;
            const roundDuration = parseInt(document.getElementById(is2hg ? 'input-t-duration-2hg' : 'input-t-duration-1v1').value, 10) || 50;
            const competitionSystem = document.getElementById(is2hg ? 'input-t-competition-2hg' : 'input-t-competition').value;
            const matchFormat = document.getElementById(is2hg ? 'input-t-match-format-2hg' : 'input-t-match-format').value;

            tournament.roundsCount = roundsCount;
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
        const is1v1 = ['pioneer', 'modern', 'standard', 'legacy', 'pauper', 'draft', 'sealed', 'other'].includes(format);
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
        if (!name) return;

        // Check duplicate
        if (t.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            input.value = '';
            return;
        }

        t.players.push({
            id: this.generateId(),
            name
        });

        this.saveTournaments();
        input.value = '';
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
            if (existingNames.has(name.toLowerCase())) {
                duplicates.push(name);
            } else if (name.length > 0) {
                t.players.push({id: this.generateId(), name});
                existingNames.add(name.toLowerCase());
                added.push(name);
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
        if (playerCount <= 6) return 3;
        if (playerCount <= 12) return 4;
        if (playerCount <= 20) return 5;
        return Math.min(7, Math.ceil(playerCount / 6));
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
                            <div class="table-status-name">Mesa ${idx + 1}</div>
                            <div class="table-status-players">${playerNames || 'Bye'}</div>
                        </div>
                    </div>
                    <div class="table-status-actions">
                        <span class="table-status-badge ${statusClass}">${statusLabel}</span>
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

        document.getElementById('btn-start-timer').style.display = 'none';
        document.getElementById('btn-pause-timer').style.display = 'inline-flex';
        document.getElementById('btn-resume-timer').style.display = 'none';

        this.timerInterval = setInterval(() => {
            this.updateTimerDisplay();
            this.checkTimerAlerts();
        }, 1000);

        this.updateTimerDisplay();
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

        document.getElementById('btn-pause-timer').style.display = 'none';
        document.getElementById('btn-resume-timer').style.display = 'inline-flex';
    },

    resumeRoundTimer() {
        const t = this.getCurrentTournament();
        if (!t || this.timerInterval) return;

        const currentRound = t.rounds[t.rounds.length - 1];
        if (currentRound && currentRound.pausedAt) {
            currentRound.pausedDuration += Date.now() - currentRound.pausedAt;
            currentRound.pausedAt = null;
        }

        document.getElementById('btn-resume-timer').style.display = 'none';
        document.getElementById('btn-pause-timer').style.display = 'inline-flex';

        this.timerInterval = setInterval(() => {
            this.updateTimerDisplay();
            this.checkTimerAlerts();
        }, 1000);
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
            4: {},
            3: {}
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

    getPointsForPosition(placement, tableSize) {
        const t = this.getCurrentTournament();
        if (!t || !t.scoring) {
            // Default scoring
            if (tableSize === 4) {
                const defaults = {1: 3, 2: 2, 3: 1, 4: 0};
                return defaults[placement] || 0;
            } else {
                const defaults = {1: 3, 2: 2, 3: 1};
                return defaults[placement] || 0;
            }
        }

        return t.scoring[tableSize]?.[placement] || 0;
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
                    <span class="player-name">${this.escapeHtml(p.name)}</span>
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
        if (!t.scoring) {
            t.scoring = {
                4: {1: 3, 2: 2, 3: 1, 4: 0},
                3: {1: 3, 2: 2, 3: 1}
            };
        }
        this.saveTournaments();
        this.generateRound();
        this.renderTournamentDetail();
    },

    finishTournament() {
        const t = this.getCurrentTournament();
        if (!t) return;
        if (!confirm('¿Estás seguro de finalizar este torneo? No podrás agregar más rondas.')) return;

        t.status = 'finished';
        this.saveTournaments();
        this.renderTournamentDetail();
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
        const activePlayers = [...t.players];
        const tableSizes = this.calculateTableSizes(activePlayers.length);
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
                        results: [{playerId: byed.id, placement: 1, duration: 0}]
                    });
                }
                continue;
            }

            const available = activePlayers.filter(p => !assigned.has(p.id));

            if (t.format === 'two-headed-giant' && size === 4) {
                const teams = this.buildTwoHeadedTeams(available, opponentsHistory, assigned);
                if (teams.length === 2) {
                    teams.forEach(team => {
                        team.forEach(p => assigned.add(p.id));
                    });
                    tables.push({
                        id: this.generateId(),
                        players: teams.flat(),
                        teams,
                        bye: false,
                        results: []
                    });
                }
            } else {
                const tablePlayers = this.pickTablePlayers(available, size, opponentsHistory, assigned, stats);

                if (tablePlayers.length === size) {
                    tablePlayers.forEach(p => assigned.add(p.id));
                    tables.push({
                        id: this.generateId(),
                        players: tablePlayers.map(p => p.id),
                        bye: false,
                        results: []
                    });
                }
            }
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

    calculateTableSizes(playerCount) {
        if (playerCount < 3) return [];

        const t = this.getCurrentTournament();
        if (t && t.format === 'two-headed-giant') {
            if (playerCount < 4) return [];
            const teams = Math.floor(playerCount / 4);
            const remainder = playerCount % 4;
            if (remainder === 0) {
                return Array(teams).fill(4);
            }
            return [...Array(teams).fill(4), remainder];
        }

        const mode = (t && t.distributionModel) || 'auto';
        const allowedSizes = this.getAllowedSizes(t);

        if (mode === 'custom') {
            return this.customDistribution(playerCount, allowedSizes);
        }

        if (mode === 'prefer3') {
            return this.preferSmallTables(playerCount, allowedSizes);
        }
        if (mode === 'prefer5') {
            return this.preferFiveTables(playerCount, allowedSizes);
        }
        if (mode === 'prefer4') {
            return this.preferFourTables(playerCount, allowedSizes);
        }

        return this.autoDistribution(playerCount, allowedSizes);
    },

    getAllowedSizes(t) {
        if (!t) return [3, 4];
        if (t.distributionModel === 'custom' && t.customAllowedSizes && t.customAllowedSizes.length) {
            return t.customAllowedSizes.slice().sort((a, b) => a - b);
        }
        if (t.format === 'commander') return [3, 4, 5];
        return [3, 4];
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
                return selected.every(s => !opponentsHistory[c.id]?.has(s.id));
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
                        <h4>Mesa ${idx + 1}</h4>
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

            const playersHtml = players.map(p => {
                const existingResult = table.results.find(r => r.playerId === p.id);
                const placement = existingResult ? existingResult.placement : 0;
                const duration = existingResult ? existingResult.duration : '';
                const isRepeat = !table.bye && hasRepeats && this.isRepeatInTable(p.id, table, opponentsHistory);

                return `
                    <div class="table-player ${isRepeat ? 'repeat' : ''} ${placement === 1 ? 'winner' : ''}">
                        <span class="p-name">${this.escapeHtml(p.name)}</span>
                        <span class="p-placement">
                            ${canEdit ? `
                                <select class="placement-select" onchange="app.updateResult('${table.id}', '${p.id}', 'placement', this.value)" aria-label="Posición de ${this.escapeHtml(p.name)}">
                                    <option value="0" ${placement === 0 ? 'selected' : ''}>-</option>
                                    <option value="1" ${placement === 1 ? 'selected' : ''}>1°</option>
                                    <option value="2" ${placement === 2 ? 'selected' : ''}>2°</option>
                                    <option value="3" ${placement === 3 ? 'selected' : ''}>3°</option>
                                    <option value="4" ${placement === 4 ? 'selected' : ''}>4°</option>
                                </select>
                                <input type="number" class="duration-input" placeholder="min" value="${duration}" min="0" onchange="app.updateResult('${table.id}', '${p.id}', 'duration', this.value)" aria-label="Duración en minutos">
                            ` : `
                                <span>${placement > 0 ? placement + '°' : '-'}</span>
                                <span style="color: var(--t-text-muted); font-size: 0.85rem;">${duration ? duration + ' min' : ''}</span>
                            `}
                        </span>
                    </div>
                `;
            }).join('');

            return `
                <div class="table-card">
                    <h4>Mesa ${idx + 1} ${hasRepeats ? '<span style="color: var(--t-rosa); font-size: 0.75rem; margin-left: 8px;">CON REPETICIÓN</span>' : ''}</h4>
                    <div class="table-players">${playersHtml}</div>
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
            result = {playerId, placement: 0, duration: 0};
            table.results.push(result);
        }

        if (field === 'placement') {
            result.placement = parseInt(value) || 0;
        } else if (field === 'duration') {
            result.duration = parseInt(value) || 0;
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
        }

        this.renderTournamentDetail();
    },

    // ========================
    // ESTADÍSTICAS Y POSICIONES
    // ========================
    getPlayerStats(tournament) {
        const stats = {};
        tournament.players.forEach(p => {
            stats[p.id] = {
                name: p.name,
                points: 0,
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
                    } else if (result.placement === 3) {
                        s.points += points;
                        s.losses += 1;
                    } else if (result.placement === 4) {
                        s.losses += 1;
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
            .sort((a, b) => b.points - a.points || b.wins - a.wins || (b.avgDuration || 0) - (a.avgDuration || 0));

        container.innerHTML = `
            <div class="standing-row header">
                <div>#</div>
                <div>Jugador</div>
                <div style="text-align: center;">Pts</div>
                <div style="text-align: center;">V</div>
                <div style="text-align: center;">Duración</div>
            </div>
            ${sorted.map((s, i) => `
                <div class="standing-row">
                    <div class="standing-rank">${i + 1}</div>
                    <div class="standing-name">${this.escapeHtml(s.name)}</div>
                    <div class="standing-stat">${s.points}</div>
                    <div class="standing-stat">${s.wins}</div>
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
