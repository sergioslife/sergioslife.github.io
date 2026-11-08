(function (global) {
  'use strict';
  function clamp(n, min, max) { n = Number(n); if (isNaN(n)) n = min; return Math.min(max, Math.max(min, n)); }
  function defaultPlayer(p) {
    return {
      id: p.id,
      name: p.name || 'Jugador',
      life: typeof p.life === 'number' ? p.life : 40,
      poison: p.poison || 0,
      energy: p.energy || 0,
      experience: p.experience || 0,
      storm: p.storm || 0,
      commanderDamage: p.commanderDamage || {}
    };
  }
  global.CompanionModel = {
    defaultPlayer: defaultPlayer,
    adjust: function (player, field, delta, opts) {
      opts = opts || {};
      var min = opts.min != null ? opts.min : 0;
      var max = opts.max != null ? opts.max : 999;
      player[field] = clamp((Number(player[field]) || 0) + delta, min, max);
      if (field === 'poison' && player.poison >= 10) player.eliminatedBy = 'poison';
      if (field === 'life' && player.life <= 0) player.eliminatedBy = 'life';
      return player;
    },
    ensureCommander: function (player, opponentId, commanderName) {
      player.commanderDamage = player.commanderDamage || {};
      if (!player.commanderDamage[opponentId]) player.commanderDamage[opponentId] = { commanderName: commanderName || 'Comandante', damage: 0 };
      if (commanderName) player.commanderDamage[opponentId].commanderName = commanderName;
      return player.commanderDamage[opponentId];
    },
    adjustCommanderDamage: function (player, opponentId, delta, commanderName) {
      var entry = this.ensureCommander(player, opponentId, commanderName);
      entry.damage = clamp((Number(entry.damage) || 0) + delta, 0, 99);
      if (entry.damage >= 21) player.eliminatedBy = 'commander:' + (entry.commanderName || opponentId);
      return entry;
    },
    roundRemainingSec: function (session) {
      if (!session || !session.roundDurationSec) return 0;
      if (!session.roundStartedAt) return session.roundDurationSec;
      var paused = session.roundPausedDurationMs || 0;
      if (session.roundPausedAt) paused += Math.max(0, Date.now() - session.roundPausedAt);
      var elapsed = Math.floor((Date.now() - session.roundStartedAt - paused) / 1000);
      return Math.max(0, session.roundDurationSec - elapsed);
    },
    playerBudgetSec: function (session, playerCount) {
      var n = Math.max(1, playerCount || 4);
      return Math.floor(((session && session.roundDurationSec) || 3000) / n);
    }
  };
})(window);
