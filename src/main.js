console.log(`⏱️ [12/12] main.js started parsing at +${(performance.now() - window.appStartTimers.start).toFixed(2)}ms`);

/**
 * Grand Staff Studio - Main Application Bootstrapper
 * Path: src/main.js
 */

window.GSS = window.GSS || {};

console.log("🚨 SYSTEM AUDIT: main.js parsing started.");

document.addEventListener('DOMContentLoaded', () => {
  console.log("📡 SYSTEM AUDIT: DOMContentLoaded fired. Reconnecting global application pipeline...");

  let isPlaying = false;

  const safeBindArray = (elementIdVariants, eventType, callback) => {
    let boundCount = 0;
    elementIdVariants.forEach(id => {
      try {
        const el = document.getElementById(id);
        if (!el) return;
        
        el.addEventListener(eventType, (e) => {
          try {
            callback(e);
          } catch (execError) {
            console.error(`❌ RUNTIME CRASH inside [#${id}] event handler:`, execError);
          }
        });
        boundCount++;
      } catch (bindError) {
        console.error(`❌ CRITICAL BINDING FAILURE for '#${id}':`, bindError);
      }
    });
  };

  // --- ATTACH ALL INTERACTIVE CONTROLS WITH FALLBACK PROTECTION ---
  
  safeBindArray(['master-volume'], 'input', (e) => {
    const readout = document.getElementById('volume-readout');
    if (readout) readout.innerText = `${Math.round(e.target.value * 100)}%`;
  });

  safeBindArray(['tempo-bpm'], 'input', (e) => {
    const readout = document.getElementById('tempo-readout');
    if (readout) readout.innerText = `${e.target.value} BPM`;
  });

  // Handle dropdown transformations (Action B: note <-> rest switching)
  ['editor-tool', 'note-duration', 'note-accidental', 'note-dotted'].forEach(id => {
    safeBindArray([id], 'change', () => {
      if (!window.GSS.State || !window.GSS.State.selectedNoteId) return;
      
      const isRestMode = document.getElementById('editor-tool').value === 'rest';
      const chosenDuration = document.getElementById('note-duration').value;
      const chosenAccidental = isRestMode ? 'none' : document.getElementById('note-accidental').value;
      const isDotted = document.getElementById('note-dotted').value === 'true';

      let updatedObj = null;
      [window.GSS.State.trebleMasterPool || [], window.GSS.State.bassMasterPool || []].forEach((pool) => {
        const match = pool.find(n => n.id === window.GSS.State.selectedNoteId);
        if (match) {
          match.isRest = isRestMode;
          match.duration = chosenDuration;
          match.accidental = chosenAccidental;
          match.isDotted = isDotted;
          if (!isRestMode && (!match.keys || match.keys.length === 0)) {
            match.keys = match.clef === 'bass' ? ["d/3"] : ["b/4"];
          }
          updatedObj = match;
        }
      });

      if (updatedObj) {
        if (window.GSS.UiSync) window.GSS.UiSync.updateInspectorReadout(updatedObj);
        window.GSS.LayoutEngine.rebuildSystemMeasures();
        window.GSS.LayoutEngine.renderLivePreview();
      }
    });
  });

  safeBindArray(['music-title'], 'input', () => {
    if (window.GSS.LayoutEngine) window.GSS.LayoutEngine.renderLivePreview();
  });
  
  safeBindArray(['time-sig'], 'change', () => { 
    if (window.GSS.State && typeof window.GSS.State.pushStateToHistory === 'function') window.GSS.State.pushStateToHistory();
    if (window.GSS.LayoutEngine) {
      window.GSS.LayoutEngine.rebuildSystemMeasures();
      window.GSS.LayoutEngine.renderLivePreview();
    }
  });
  
  safeBindArray(['key-sig'], 'change', () => {
    if (window.GSS.LayoutEngine) window.GSS.LayoutEngine.renderLivePreview();
  });

  safeBindArray(['save-btn', 'save-composition-btn'], 'click', () => {
    if (window.GSS.StorageLedger && typeof window.GSS.StorageLedger.saveCurrentComposition === 'function') {
      window.GSS.StorageLedger.saveCurrentComposition();
    }
  });

  safeBindArray(['load-btn'], 'click', () => {
    if (window.GSS.StorageLedger && typeof window.GSS.StorageLedger.loadComposition === 'function') {
      window.GSS.StorageLedger.loadComposition();
    }
  });

  safeBindArray(['rename-btn'], 'click', () => {
    if (window.GSS.StorageLedger && typeof window.GSS.StorageLedger.renameComposition === 'function') {
      window.GSS.StorageLedger.renameComposition();
    }
  });

  safeBindArray(['delete-storage-btn'], 'click', () => {
    if (window.GSS.StorageLedger && typeof window.GSS.StorageLedger.deleteComposition === 'function') {
      window.GSS.StorageLedger.deleteComposition();
    }
  });

  safeBindArray(['export-batch-btn'], 'click', () => {
    if (window.GSS.StorageLedger && typeof window.GSS.StorageLedger.exportSongToFile === 'function') {
      window.GSS.StorageLedger.exportSongToFile();
    }
  });

  safeBindArray(['import-file-input'], 'change', (e) => {
    if (window.GSS.StorageLedger && typeof window.GSS.StorageLedger.importSongFile === 'function') {
      window.GSS.StorageLedger.importSongFile(e);
    }
  });
  
  safeBindArray(['generate-btn', 'pdf-btn'], 'click', () => {
    if (window.GSS.PdfExporter && typeof window.GSS.PdfExporter.generatePdfReport === 'function') {
      window.GSS.PdfExporter.generatePdfReport();
    }
  });
  
  // --- Audio Engine Sequencer ---
  safeBindArray(['play-stop-btn', 'play-start-btn', 'play-btn'], 'click', () => {
    if (!window.GSS.AudioSynth) return;

    if (isPlaying) {
      window.GSS.AudioSynth.stopAllAudioPlayback();
      isPlaying = false;
      console.log("⏹️ Audio signals reset.");
      if (window.GSS.LayoutEngine) window.GSS.LayoutEngine.renderLivePreview(null);
      return;
    }

    isPlaying = true;
    console.log("▶️ Running polyphonic grand staff sequencer engine...");

    const beatDuration = window.GSS.LayoutEngine.calculateBeatDurationInSeconds();
    const treblePool = (window.GSS.State && window.GSS.State.trebleMasterPool) || [];
    const bassPool = (window.GSS.State && window.GSS.State.bassMasterPool) || [];

    const playbackTimelineEvents = [];

    const processPoolIntoTimeline = (pool) => {
      let currentDelayAccumulator = 0;
      pool.forEach((note) => {
        const baseVal = (window.GSS.PitchMapping && window.GSS.PitchMapping.BASE_DURATION_VALUES)
          ? (window.GSS.PitchMapping.BASE_DURATION_VALUES[note.duration] || 1.0)
          : 1.0;
        const durationInSeconds = baseVal * (note.isDotted ? 1.5 : 1.0) * beatDuration;

        playbackTimelineEvents.push({
          timeStart: currentDelayAccumulator,
          duration: durationInSeconds,
          noteRef: note
        });

        currentDelayAccumulator += durationInSeconds;
      });
    };

    processPoolIntoTimeline(treblePool);
    processPoolIntoTimeline(bassPool);

    const timeBuckets = {};
    let maxTotalDuration = 0;

    playbackTimelineEvents.forEach((event) => {
      const key = event.timeStart.toFixed(3); 
      if (!timeBuckets[key]) {
        timeBuckets[key] = {
          timeStartMs: event.timeStart * 1000,
          notesToHighlight: [],
          audioTriggers: []
        };
      }
      
      timeBuckets[key].notesToHighlight.push(event.noteRef.id);
      
      if (event.timeStart + event.duration > maxTotalDuration) {
        maxTotalDuration = event.timeStart + event.duration;
      }

      if (!event.noteRef.isRest && window.GSS.PitchMapping) {
        const frequencies = event.noteRef.keys.map(pitch => 
          window.GSS.PitchMapping.calculateModifiedFrequency(pitch, event.noteRef.accidental || 'none')
        );
        timeBuckets[key].audioTriggers.push({
          frequencies: frequencies,
          duration: event.duration
        });
      }
    });

    Object.keys(timeBuckets).forEach((key) => {
      const bucket = timeBuckets[key];

      const visualTimerId = setTimeout(() => {
        if (!isPlaying) return;
        if (window.GSS.LayoutEngine) {
          window.GSS.LayoutEngine.renderLivePreview(bucket.notesToHighlight);
        }
      }, bucket.timeStartMs);
      window.GSS.AudioSynth.runningPlaybackTimers.push(visualTimerId);

      bucket.audioTriggers.forEach((audioData) => {
        const audioTimerId = setTimeout(() => {
          if (!isPlaying) return;
          window.GSS.AudioSynth.playPolyphonicSynthTone(audioData.frequencies, audioData.duration);
        }, bucket.timeStartMs);
        window.GSS.AudioSynth.runningPlaybackTimers.push(audioTimerId);
      });
    });

    const wrapId = setTimeout(() => { 
      isPlaying = false; 
      if (window.GSS.LayoutEngine) window.GSS.LayoutEngine.renderLivePreview(null);
    }, maxTotalDuration * 1000);
    
    window.GSS.AudioSynth.runningPlaybackTimers.push(wrapId);
  });

  // --- INTERFACE ACTION BUTTON MUTATORS ---

  safeBindArray(['clear-btn'], 'click', () => {
    if (!window.GSS.State) return;
    
    const confirmationGate = confirm("⚠️ Are you sure you want to reset the entire board?\nThis will permanently delete your current composition work.");
    if (!confirmationGate) {
      console.log("🛡️ Board reset operation aborted safely by user selection.");
      return;
    }

    if (typeof window.GSS.State.pushStateToHistory === 'function') window.GSS.State.pushStateToHistory();
    
    window.GSS.State.trebleMasterPool = [];
    window.GSS.State.bassMasterPool = [];
    window.GSS.State.selectedNoteId = null;
    
    if (window.GSS.UiSync) window.GSS.UiSync.updateInspectorReadout(null);
    window.GSS.LayoutEngine.rebuildSystemMeasures();
    window.GSS.LayoutEngine.renderLivePreview();
    console.log("♻️ Board completely reset to baseline empty manuscript.");
  });

  safeBindArray(['action-delete', 'delete-btn'], 'click', () => {
    if (!window.GSS.State || !window.GSS.State.selectedNoteId) return;
    if (typeof window.GSS.State.pushStateToHistory === 'function') window.GSS.State.pushStateToHistory();

    const targetId = window.GSS.State.selectedNoteId;
    window.GSS.State.trebleMasterPool = (window.GSS.State.trebleMasterPool || []).filter(n => n.id !== targetId);
    window.GSS.State.bassMasterPool = (window.GSS.State.bassMasterPool || []).filter(n => n.id !== targetId);
    window.GSS.State.selectedNoteId = null;

    if (window.GSS.UiSync) window.GSS.UiSync.updateInspectorReadout(null);
    window.GSS.LayoutEngine.rebuildSystemMeasures();
    window.GSS.LayoutEngine.renderLivePreview();
  });

  safeBindArray(['nav-prev'], 'click', () => {
    if (!window.GSS.State || !window.GSS.LayoutEngine) return;
    const flatList = window.GSS.LayoutEngine.getFlattenedNotesList() || [];
    if (flatList.length === 0) return;

    let currentIdx = flatList.findIndex(item => item.note.id === window.GSS.State.selectedNoteId);
    let prevIdx = (currentIdx <= 0) ? flatList.length - 1 : currentIdx - 1;
    
    window.GSS.State.selectedNoteId = flatList[prevIdx].note.id;
    window.GSS.LayoutEngine.renderLivePreview();
  });

  safeBindArray(['nav-next'], 'click', () => {
    if (!window.GSS.State || !window.GSS.LayoutEngine) return;
    const flatList = window.GSS.LayoutEngine.getFlattenedNotesList() || [];
    if (flatList.length === 0) return;

    let currentIdx = flatList.findIndex(item => item.note.id === window.GSS.State.selectedNoteId);
    let nextIdx = (currentIdx === -1 || currentIdx >= flatList.length - 1) ? 0 : currentIdx + 1;
    
    window.GSS.State.selectedNoteId = flatList[nextIdx].note.id;
    window.GSS.LayoutEngine.renderLivePreview();
  });

  // --- FLOATING TAB CLASS-BASED TOGGLER ---
  document.querySelectorAll('.menu-tab-btn').forEach((tabButton, index) => {
    tabButton.addEventListener('click', (e) => {
      const panelIds = ['panel-entry', 'panel-setup', 'panel-storage'];
      const targetPanelId = panelIds[index] || panelIds[0];
      
      document.querySelectorAll('.menu-tab-btn').forEach(btn => btn.classList.remove('active'));
      tabButton.classList.add('active');
      
      panelIds.forEach(pId => {
        const panel = document.getElementById(pId);
        if (panel) {
          panel.style.display = (pId === targetPanelId) ? 'block' : 'none';
        }
      });
    });
  });

  // Interactive Document Element Hit Listeners
  try {
    const previewDiv = document.getElementById('paper-preview');
    if (previewDiv) {
      previewDiv.addEventListener('click', (e) => {
        if (window.GSS.ClickHandler && typeof window.GSS.ClickHandler.handleGlobalCanvasClick === 'function') {
          window.GSS.ClickHandler.handleGlobalCanvasClick(e);
        }
      });
    }
  } catch(e) {}

  // --- RUN APPLICATION INITIALIZATION BOOT CODES SAFELY ---
  try { window.GSS.LayoutEngine.rebuildSystemMeasures(); } catch(e) {}
  try { window.GSS.LayoutEngine.renderLivePreview(); } catch(e) {}
  try {
    if (window.GSS.StorageLedger && typeof window.GSS.StorageLedger.populateSavedSongsDropdown === 'function') {
      window.GSS.StorageLedger.populateSavedSongsDropdown();
    }
  } catch(e) {}
});
console.log(`🚀 [12/12] main.js complete. Total app setup time: ${(performance.now() - window.appStartTimers.start).toFixed(2)}ms`);