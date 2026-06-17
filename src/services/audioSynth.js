/**
 * Grand Staff Studio - Module: Audio Synthesizer
 * Path: src/services/audioSynth.js
 * Scope: Web Audio API integration and dynamic polyphonic note playback.
 */

window.GSS = window.GSS || {};

window.GSS.AudioSynth = {
  audioCtx: null,
  runningPlaybackTimers: [],

  /**
   * Safe getter to initialize or wake the local hardware sound context.
   */
  getAudioContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  },

  /**
   * Stops all scheduled playback timers and silences audio loops.
   */
  stopAllAudioPlayback() {
    this.runningPlaybackTimers.forEach(clearTimeout);
    this.runningPlaybackTimers = [];
  },

  /**
   * Instantiates a dynamic polyphonic synth note combination.
   */
  playPolyphonicSynthTone(frequencyArray, durationInSeconds) {
    try {
      const context = this.getAudioContext();
      const masterVolumeControl = document.getElementById('master-volume');
      const volumeScale = masterVolumeControl ? parseFloat(masterVolumeControl.value) : 0.4;
      
      if (frequencyArray.length === 0 || volumeScale <= 0) return;

      const mixNode = context.createGain();
      mixNode.gain.setValueAtTime(volumeScale / frequencyArray.length, context.currentTime);
      mixNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + durationInSeconds);
      mixNode.connect(context.destination);

      frequencyArray.forEach(frequency => {
        const osc = context.createOscillator();
        osc.type = 'triangle'; // Smooth, organic classical musical wave profile
        osc.frequency.setValueAtTime(frequency, context.currentTime);
        osc.connect(mixNode);
        osc.start();
        osc.stop(context.currentTime + durationInSeconds);
      });
    } catch (e) {
      console.warn("Grand Staff Studio Audio Engine Encountered standard buffer init warnings: ", e);
    }
  }
};