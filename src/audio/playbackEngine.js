/**
 * Grand Staff Studio - Module: Playback Engine
 * Path: src/audio/playbackEngine.js
 * Scope: Polyphonic oscillators generation and linked tied node lookahead audio schedulers.
 */

window.GSS = window.GSS || {};

window.GSS.PlaybackEngine = {
  playPolyphonicSynthTone(frequenciesArray, durationSecs) {
    if (!frequenciesArray || frequenciesArray.length === 0) return;
    try {
      const context = window.GSS.State.getAudioContext();
      const masterGainLevel = parseFloat(document.getElementById('master-volume').value);
      const allocation = (masterGainLevel * 0.4) / frequenciesArray.length;

      frequenciesArray.forEach(hz => {
        if (!hz || isNaN(hz) || hz <= 0) return;
        const osc = context.createOscillator();
        const gainNode = context.createGain();
        osc.type = 'sine';
        osc.frequency.value = hz;
        gainNode.gain.setValueAtTime(allocation, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + durationSecs);
        osc.connect(gainNode);
        gainNode.connect(context.destination);
        osc.start();
        osc.stop(context.currentTime + durationSecs);
      });
    } catch (e) { console.error(e); }
  },

  stopAllAudioPlayback() {
    window.GSS.State.runningPlaybackTimers.forEach(clearTimeout);
    window.GSS.State.runningPlaybackTimers = [];
    window.GSS.LayoutEngine.renderLivePreview(); 
  },

  startSequencePlayback() {
    this.stopAllAudioPlayback();
    window.GSS.State.getAudioContext(); 
    const routingMode = document.getElementById('audio-track-filter').value;
    const activeBeatDurationScalar = window.GSS.LayoutEngine.calculateBeatDurationInSeconds();

    const scheduleStaffSequence = (pool) => {
      let accumTime = 0;
      const startingOffset = pool === window.GSS.State.trebleMasterPool ? 50000 : 80000;
      const visualMeasureTrackSlices = window.GSS.LayoutEngine.slicePoolIntoMeasures(pool, startingOffset).flat();
      const processedTiedSegments = new Set();

      visualMeasureTrackSlices.forEach((n, index) => {
        let currentSegmentWeight = window.GSS.PitchMapping.BASE_DURATION_VALUES[n.duration] * (n.isDotted ? 1.5 : 1.0);
        let stepDurationSecs = currentSegmentWeight * activeBeatDurationScalar;
        const isSegmentSilencedByTie = processedTiedSegments.has(n.id);
        let continuousPlaybackDurationSecs = stepDurationSecs;

        if (!isSegmentSilencedByTie && !n.isRest && n.tieForward && n.nextLinkedId) {
          let lookAheadTargetId = n.nextLinkedId; let chainScanIndex = index + 1;
          while (lookAheadTargetId && chainScanIndex < visualMeasureTrackSlices.length) {
            const nextSegment = visualMeasureTrackSlices[chainScanIndex];
            if (nextSegment && nextSegment.id === lookAheadTargetId) {
              let nextSegmentWeight = window.GSS.PitchMapping.BASE_DURATION_VALUES[nextSegment.duration] * (nextSegment.isDotted ? 1.5 : 1.0);
              continuousPlaybackDurationSecs += (nextSegmentWeight * activeBeatDurationScalar);
              processedTiedSegments.add(nextSegment.id);
              lookAheadTargetId = nextSegment.tieForward ? nextSegment.nextLinkedId : null;
            }
            chainScanIndex++;
          }
        }

        let playbackTimer = setTimeout(() => {
          window.GSS.LayoutEngine.renderLivePreview(n.id);
          if (!n.isRest && !isSegmentSilencedByTie) {
            const activeKeys = n.keys || (n.key ? [n.key] : ["c/4"]);
            this.playPolyphonicSynthTone(activeKeys.map(k => window.GSS.PitchMapping.calculateModifiedFrequency(k, n.accidental || 'none')), continuousPlaybackDurationSecs);
          }
        }, accumTime * 1000);
        window.GSS.State.runningPlaybackTimers.push(playbackTimer);
        accumTime += stepDurationSecs;
      });
      let clearVisualTimer = setTimeout(() => { window.GSS.LayoutEngine.renderLivePreview(null); }, accumTime * 1000);
      window.GSS.State.runningPlaybackTimers.push(clearVisualTimer);
    };

    if (routingMode === 'both' || routingMode === 'treble') scheduleStaffSequence(window.GSS.State.trebleMasterPool);
    if (routingMode === 'both' || routingMode === 'bass') scheduleStaffSequence(window.GSS.State.bassMasterPool);
  }
};

// Legacy environment audio connectors
window.playPolyphonicSynthTone = (f, d) => window.GSS.PlaybackEngine.playPolyphonicSynthTone(f, d);
window.stopAllAudioPlayback = () => window.GSS.PlaybackEngine.stopAllAudioPlayback();