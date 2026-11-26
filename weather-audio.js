/* Weather-dependent natural ambience, sourced from the supplied recordings. */
(function (root) {
  const tracks = {
    day: ['day-birds.mp3', 3.3],
    night: ['night-crickets.mp3', 5.5],
    calm: ['calm-wind.mp3', 0.78],
    breeze: ['wind-leaves.mp3', 1.15],
    autumn: ['autumn-wind.mp3', 0.29],
    winter: ['winter-wind.mp3', 2.8],
    winterGust: ['winter-gust.mp3', 0.23],
  };

  function selectTrack(state) {
    if (state.snow) return 'winter';
    if (state.autumn) return 'autumn';
    if (state.rain > 0.2 || state.wind >= 0.9) return 'breeze';
    if (state.night > 0.5) return 'night';
    if (state.wind >= 0.38) return 'breeze';
    if (state.mist > 0.25 || state.elev < 8 || state.overcast > 0.65) return 'calm';
    return 'day';
  }

  class WeatherAudio {
    constructor(context, master) {
      this.context = context;
      this.master = master;
      this.players = new Map();
      this.selected = null;
      this.pending = null;
      this.pendingTime = 0;
      this.enabled = false;
    }

    player(key) {
      if (this.players.has(key)) return this.players.get(key);
      const [file, volume] = tracks[key];
      const element = new Audio(`assets/ambience/${file}`);
      element.loop = true;
      element.preload = 'auto';
      const source = this.context.createMediaElementSource(element);
      const gain = this.context.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(this.master);
      const player = { element, gain, volume, level: 0, retryAt: 0, starting: false };
      this.players.set(key, player);
      return player;
    }

    play(player) {
      if (!player.element.paused || player.starting || this.context.currentTime < player.retryAt) return;
      player.starting = true;
      player.element.play().then(() => { player.starting = false; }).catch(() => {
        player.starting = false;
        player.retryAt = this.context.currentTime + 4;
      });
    }

    update(dt, state, enabled) {
      const wanted = selectTrack(state);
      if (wanted !== this.pending) {
        this.pending = wanted;
        this.pendingTime = 0;
      } else this.pendingTime += dt;
      // A stable choice avoids audible switching during momentary gusts.
      if (!this.selected || this.pendingTime >= 6) this.selected = wanted;
      this.enabled = enabled;
      if (enabled) {
        this.play(this.player(this.selected));
        if (this.selected === 'winter') this.play(this.player('winterGust'));
      }
      for (const [key, player] of this.players) {
        const active = key === this.selected || (key === 'winterGust' && this.selected === 'winter');
        const target = enabled && active ? player.volume : 0;
        player.level += (target - player.level) * (1 - Math.exp(-dt / 1.8));
        if (!target && player.level < 0.008) {
          player.level = 0;
          if (!player.element.paused) player.element.pause();
        }
        player.gain.gain.value = player.level;
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { selectTrack, WeatherAudio };
  else root.WishingTreeWeatherAudio = WeatherAudio;
})(globalThis);
