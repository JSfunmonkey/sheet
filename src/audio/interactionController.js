/**
 * Grand Staff Studio - Module: Interaction Controller (ISOLATION EDITION)
 * Path: src/interaction/interactionController.js
 */

window.GSS = window.GSS || {};

console.log("📊 GSS LOG ENGINE: interactionController.js loaded.");

window.TREBLE_PITCH_ORDER = [
  'g/6', 'f/6', 'e/6', 'd/6', 'c/6', 'b/5', 'a/5', 'g/5', 'f/5', 'e/5', 'd/5', 'c/5', 'b/4', 'a/4', 'g/4', 'f/4', 'e/4', 'd/4', 'c/4', 'b/3', 'a/3', 'g/3'
];
window.BASS_PITCH_ORDER = [
  'b/4', 'a/4', 'g/4', 'f/4', 'e/4', 'd/4', 'c/4', 'b/3', 'a/3', 'g/3', 'f/3', 'e/3', 'd/3', 'c/3', 'b/2', 'a/2', 'g/2', 'f/2', 'e/2', 'd/2', 'c/2', 'b/1'
];

window.GSS.InteractionController = {
  syncControlsToSelection(id) {
    try {
      const flat = window.GSS.LayoutEngine.getFlattenedNotesList();
      const match = flat.find(f => f.note.id === id);
      if (match) {
        document.getElementById('editor-tool').value = match.note.isRest ? 'rest' : 'note';
        document.getElementById('note-duration').value = match.note.duration;
        document.getElementById('note-accidental').value = match.note.accidental || 'none';
        document.getElementById('note-dotted').value = match.note.isDotted ? 'true' : 'false';
        window.GSS.HistoryManager.updateInspectorReadout(match.note);
        const activeKeys = match.note.keys || (match.note.key ? [match.note.key] : ["c/4"]);
        window.GSS.PlaybackEngine.playPolyphonicSynthTone(activeKeys.map(k => window.GSS.PitchMapping.calculateModifiedFrequency(k, match.note.accidental || 'none')), 0.3);
      }
    } catch (err) {
      console.error("❌ GSS Error in syncControlsToSelection:", err);
    }
  },

  executeAutomaticNoteAlteration() {
    try {
      if (!window.GSS.State.selectedNoteId) return;
      window.GSS.HistoryManager.pushStateToHistory();

      const isRestMode = document.getElementById('editor-tool').value === 'rest';
      const chosenDuration = document.getElementById('note-duration').value;
      const chosenAccidental = isRestMode ? 'none' : document.getElementById('note-accidental').value;
      const isDotted = document.getElementById('note-dotted').value === 'true';

      let updatedObj = null;
      [window.GSS.State.trebleMasterPool, window.GSS.State.bassMasterPool].forEach(pool => {
        const match = pool.find(n => n.id === window.GSS.State.selectedNoteId);
        if (match) {
          match.isRest = isRestMode;
          match.duration = chosenDuration;
          match.accidental = chosenAccidental;
          match.isDotted = isDotted;
          if (isRestMode) {
            const poolRef = pool === window.GSS.State.trebleMasterPool ? 'treble' : 'bass';
            match.keys = [poolRef === 'treble' ? 'b/4' : 'd/3'];
          }
          updatedObj = match;
        }
      });

      if (updatedObj) {
        window.GSS.HistoryManager.updateInspectorReadout(updatedObj);
        window.GSS.LayoutEngine.rebuildSystemMeasures();
        window.GSS.LayoutEngine.renderLivePreview();
      }
    } catch (err) {
      console.error("❌ GSS Error in executeAutomaticNoteAlteration:", err);
    }
  },

  modifyChordStack(id, pitch) {
    try {
      window.GSS.HistoryManager.pushStateToHistory();
      let targetedNode = null;
      [window.GSS.State.trebleMasterPool, window.GSS.State.bassMasterPool].forEach(pool => {
        const match = pool.find(n => n.id === id);
        if (match && !match.isRest) {
          if (!match.keys) match.keys = match.key ? [match.key] : ["c/4"];
          if (match.keys.includes(pitch)) {
            if (match.keys.length > 1) match.keys = match.keys.filter(k => k !== pitch);
          } else {
            match.keys.push(pitch);
          }
          match.keys.sort((a,b) => {
            const getRank = (k) => (parseInt(k.split('/')[1]) * 12) + "cdefgab".indexOf(k[0]);
            return getRank(a) - getRank(b);
          });
          targetedNode = match;
          window.GSS.PlaybackEngine.playPolyphonicSynthTone(match.keys.map(k => window.GSS.PitchMapping.calculateModifiedFrequency(k, match.accidental || 'none')), 0.3);
        }
      });
      if (targetedNode) window.GSS.HistoryManager.updateInspectorReadout(targetedNode);
      window.GSS.LayoutEngine.rebuildSystemMeasures();
    } catch (err) {
      console.error("❌ GSS Error in modifyChordStack:", err);
    }
  },

  handleGlobalCanvasClick(e) {
    try {
      const previewDiv = document.getElementById('paper-preview');
      if (!previewDiv) return;
      const svgElement = previewDiv.querySelector('svg');
      if (!svgElement) return;

      const noteGroup = e.target.closest('[data-music-id]') || e.target.closest('.custom-clickable-note');
      const svgRect = svgElement.getBoundingClientRect();

      // Screen positions vs local positions
      const clickX = e.clientX - svgRect.left;
      const clickY = e.clientY - svgRect.top;

      if (!window.GSS.GeometryTracker || !window.GSS.GeometryTracker.measureLayoutCoordinates) return;

      let matchingMeasureFrame = window.GSS.GeometryTracker.measureLayoutCoordinates.find(frame => {
        const heightLimit = frame.isEdited ? 320 : 160;
        return clickX >= frame.xStart && clickX <= frame.xEnd && clickY >= (frame.trebleTopLineY - 60) && clickY <= (frame.bassTopLineY + heightLimit);
      });

      if (!matchingMeasureFrame && window.GSS.GeometryTracker.measureLayoutCoordinates.length > 0) {
        const closeRows = window.GSS.GeometryTracker.measureLayoutCoordinates.filter(frame => {
          const heightLimit = frame.isEdited ? 320 : 160;
          return clickY >= (frame.trebleTopLineY - 60) && clickY <= (frame.bassTopLineY + heightLimit);
        });

        if (closeRows.length > 0) {
          let maxRowX = -1;
          closeRows.forEach(frame => {
            if (frame.xEnd > maxRowX) {
              maxRowX = frame.xEnd;
              matchingMeasureFrame = frame;
            }
          });
        } else {
          let absoluteLastMeasure = window.GSS.GeometryTracker.measureLayoutCoordinates[window.GSS.GeometryTracker.measureLayoutCoordinates.length - 1];
          const heightLimit = absoluteLastMeasure.isEdited ? 320 : 160;
          if (clickY > (absoluteLastMeasure.bassTopLineY + heightLimit)) {
            matchingMeasureFrame = absoluteLastMeasure;
          }
        }
      }

      if (!matchingMeasureFrame) return;

      let targetMeasureIndex = matchingMeasureFrame.measureIndex;
      if (clickX > matchingMeasureFrame.xEnd && !noteGroup) {
        targetMeasureIndex += 1; 
      }

      // --- CRITICAL ISOLATION LOGGING ENGINE ---
      const trebleBottomLineY = matchingMeasureFrame.trebleTopLineY + (matchingMeasureFrame.spaceBetweenLines * 4);
      const middleSplitThreshold = trebleBottomLineY + ((matchingMeasureFrame.bassTopLineY - trebleBottomLineY) / 2);
      let computedClef = (clickY < middleSplitThreshold) ? 'treble' : 'bass';

      console.log("%c========================================", "color: #ff007f; font-weight: bold;");
      console.log(`🎯 CLICK EVENT DETECTED: ScreenY: ${e.clientY} | Local SVG ClickY: ${clickY.toFixed(2)}px`);
      console.log(`📏 MEASURE FRAME [${matchingMeasureFrame.measureIndex}]:`);
      console.log(`   -> Treble Top Line Y:    ${matchingMeasureFrame.trebleTopLineY}px`);
      console.log(`   -> Treble Bottom Line Y: ${trebleBottomLineY}px`);
      console.log(`   -> Bass Top Line Y:      ${matchingMeasureFrame.bassTopLineY}px`);
      console.log(`   -> CALCULATED BOUNDARY:  ${middleSplitThreshold}px`);
      console.log(`🔮 CLEF DECISION: ${clickY.toFixed(2)} < ${middleSplitThreshold} = ${clickY < middleSplitThreshold ? 'TRUE' : 'FALSE'} -> ASSIGNED TO: ${computedClef.toUpperCase()}`);
      console.log("%c========================================", "color: #ff007f; font-weight: bold;");

      let computedPitch = 'c/4';
      const LINE_STEP_SPACING = matchingMeasureFrame.spaceBetweenLines / 2; 

      if (computedClef === 'treble') {
        const rawSteps = (clickY - matchingMeasureFrame.trebleTopLineY) / LINE_STEP_SPACING;
        const stepsFromTop = Math.round(rawSteps) + 8;
        const clampedSteps = Math.max(0, Math.min(stepsFromTop, window.TREBLE_PITCH_ORDER.length - 1));
        computedPitch = window.TREBLE_PITCH_ORDER[clampedSteps];
        console.log(`🎼 TREBLE STEP RESOLUTION: Distance from Top Line: ${(clickY - matchingMeasureFrame.trebleTopLineY).toFixed(2)}px | Raw Steps: ${rawSteps.toFixed(2)} | Lookup Index: ${stepsFromTop} -> PITCH: ${computedPitch}`);
      } else {
        const rawSteps = (clickY - matchingMeasureFrame.bassTopLineY) / LINE_STEP_SPACING;
        const stepsFromTop = Math.round(rawSteps) + 8;
        const clampedSteps = Math.max(0, Math.min(stepsFromTop, window.BASS_PITCH_ORDER.length - 1));
        computedPitch = window.BASS_PITCH_ORDER[clampedSteps];
        console.log(`🎼 BASS STEP RESOLUTION: Distance from Top Line: ${(clickY - matchingMeasureFrame.bassTopLineY).toFixed(2)}px | Raw Steps: ${rawSteps.toFixed(2)} | Lookup Index: ${stepsFromTop} -> PITCH: ${computedPitch}`);
      }

      if (window.GSS.State.selectedNoteId) {
        const box = window.GSS.GeometryTracker.noteBoundingBoxes[window.GSS.State.selectedNoteId];
        if (box) {
          const relativeNoteX = (box.left + box.right) / 2 - svgRect.left;
          const deltaX = Math.abs(clickX - relativeNoteX);
          const activeUiDuration = document.getElementById('note-duration').value; 
          const chordProximityThreshold = (activeUiDuration === '8' || activeUiDuration === '16') ? 12 : 28;

          if (deltaX > chordProximityThreshold && !noteGroup) {
            window.GSS.State.selectedNoteId = null;
            window.GSS.HistoryManager.updateInspectorReadout(null);
          }
        }
      }

      if (noteGroup) {
        const rawId = parseInt(noteGroup.getAttribute('data-music-id'));
        if (rawId) {
          const parsedId = rawId > 40000 ? window.GSS.LayoutEngine.getFlattenedNotesList().find(f => f.note.id === rawId).note.id : rawId;
          if (window.GSS.State.selectedNoteId === parsedId) {
            this.modifyChordStack(window.GSS.State.selectedNoteId, computedPitch);
            window.GSS.LayoutEngine.renderLivePreview();
            return;
          } else {
            window.GSS.State.selectedNoteId = parsedId;
            this.syncControlsToSelection(window.GSS.State.selectedNoteId);
            window.GSS.LayoutEngine.renderLivePreview();
            return;
          }
        }
      }

      if (window.GSS.State.selectedNoteId) {
        this.modifyChordStack(window.GSS.State.selectedNoteId, computedPitch);
        window.GSS.LayoutEngine.renderLivePreview();
        return;
      }

      window.GSS.HistoryManager.pushStateToHistory();

      const isRestMode = document.getElementById('editor-tool').value === 'rest';
      const chosenDuration = document.getElementById('note-duration').value;
      const chosenAccidental = isRestMode ? 'none' : document.getElementById('note-accidental').value;
      const isDotted = document.getElementById('note-dotted').value === 'true';
       
      const maxBeats = window.GSS.LayoutEngine.getMaxBeatsForTimeSignature();
      const poolReference = (computedClef === 'treble') ? window.GSS.State.trebleMasterPool : window.GSS.State.bassMasterPool;
      const currentTrackDuration = window.GSS.LayoutEngine.getTimelineTotalDuration(poolReference);
      const targetStartTimeWindow = targetMeasureIndex * maxBeats;

      if (currentTrackDuration < targetStartTimeWindow) {
        let paddingDeficit = targetStartTimeWindow - currentTrackDuration;
        while (paddingDeficit > 0.001) {
          let slice = Math.min(paddingDeficit, maxBeats);
          let padCode = 'w';
          for (let mapping of window.GSS.PitchMapping.VALUE_TO_DURATION_MAP) {
            if (mapping.value <= slice + 0.001) { padCode = mapping.code; break; }
          }
          poolReference.push({
            id: ++window.GSS.State.noteGlobalCounter,
            keys: [(computedClef === 'treble' ? 'b/4' : 'd/3')],
            duration: padCode,
            accidental: 'none',
            isDotted: false,
            isRest: true
          });
          paddingDeficit -= window.GSS.PitchMapping.BASE_DURATION_VALUES[padCode];
        }
      }

      const targetId = ++window.GSS.State.noteGlobalCounter;
      const freshNote = {
        id: targetId,
        keys: isRestMode ? [(computedClef === 'treble' ? 'b/4' : 'd/3')] : [computedPitch],
        duration: chosenDuration,
        accidental: chosenAccidental,
        isDotted: isDotted,
        isRest: isRestMode
      };

      poolReference.push(freshNote);
      window.GSS.State.selectedNoteId = targetId;
      window.GSS.HistoryManager.updateInspectorReadout(freshNote);

      if (!isRestMode) window.GSS.PlaybackEngine.playPolyphonicSynthTone([window.GSS.PitchMapping.calculateModifiedFrequency(computedPitch, chosenAccidental)], 0.3);

      window.GSS.LayoutEngine.rebuildSystemMeasures();
      window.GSS.LayoutEngine.renderLivePreview();
    } catch (err) {
      console.error("❌ GSS Error inside handleGlobalCanvasClick:", err);
    }
  },

  shiftCursor(direction) {
    try {
      const flat = window.GSS.LayoutEngine.getFlattenedNotesList();
      if (flat.length === 0) return;
      if (!window.GSS.State.selectedNoteId) {
        window.GSS.State.selectedNoteId = flat[0].note.id;
      } else {
        const idx = flat.findIndex(f => f.note.id === window.GSS.State.selectedNoteId);
        if (idx !== -1) {
          let nextIdx = idx + direction;
          if (nextIdx >= 0 && nextIdx < flat.length) {
            window.GSS.State.selectedNoteId = flat[nextIdx].note.id;
            this.syncControlsToSelection(window.GSS.State.selectedNoteId);
          }
        }
      }
      window.GSS.LayoutEngine.renderLivePreview();
    } catch (err) {
      console.error("❌ GSS Error in shiftCursor:", err);
    }
  },

  populateSavedSongsDropdown(highlightLabel = null) {
    try {
      const selectionMenu = document.getElementById('song-ledger-select');
      if (!selectionMenu) return;
      const activeSelection = highlightLabel || selectionMenu.value;
      selectionMenu.innerHTML = '';
      let foundMatchCount = 0;

      for (let keyIdx = 0; keyIdx < localStorage.length; keyIdx++) {
        const activeKey = localStorage.key(keyIdx);
        if (activeKey && activeKey.startsWith('studio_ledger_')) {
          const parsedLabel = activeKey.replace('studio_ledger_', '');
          const optionElement = document.createElement('option');
          optionElement.value = parsedLabel;
          optionElement.textContent = `🎼 ${parsedLabel}`;
          selectionMenu.appendChild(optionElement);
          foundMatchCount++;
        }
      }

      if (foundMatchCount === 0) {
        const defaultOption = document.createElement('option');
        defaultOption.value = ''; defaultOption.textContent = '-- No Saved Scores Found --';
        selectionMenu.appendChild(defaultOption);
      } else if (activeSelection) {
        selectionMenu.value = activeSelection;
      }
    } catch (err) {
      console.error("❌ GSS Error in populateSavedSongsDropdown:", err);
    }
  },

  bindDiagnosticListener(elementId, eventType, callback) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.addEventListener(eventType, (e) => {
      try {
        callback(e);
      } catch (err) {
        console.error(`❌ Handler failure for '#${elementId}':`, err);
      }
    });
  },

  initializeOperationalEvents() {
    this.bindDiagnosticListener('master-volume', 'input', (e) => {
      document.getElementById('volume-readout').innerText = `${Math.round(e.target.value * 100)}%`;
    });

    this.bindDiagnosticListener('tempo-bpm', 'input', (e) => {
      document.getElementById('tempo-readout').innerText = `${e.target.value} BPM`;
    });

    ['editor-tool', 'note-duration', 'note-accidental', 'note-dotted'].forEach(id => {
      this.bindDiagnosticListener(id, 'change', () => this.executeAutomaticNoteAlteration());
    });

    this.bindDiagnosticListener('music-title', 'input', () => window.GSS.LayoutEngine.renderLivePreview());
    this.bindDiagnosticListener('time-sig', 'change', () => { 
      window.GSS.HistoryManager.pushStateToHistory(); window.GSS.LayoutEngine.rebuildSystemMeasures(); window.GSS.LayoutEngine.renderLivePreview(); 
    });
    this.bindDiagnosticListener('key-sig', 'change', () => window.GSS.LayoutEngine.renderLivePreview());

    document.querySelectorAll('.menu-tab-btn').forEach((btn) => {
      if (!btn) return;
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.menu-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.section-panel').forEach(p => p.classList.remove('visible'));
        e.target.classList.add('active');
        const targetId = e.target.getAttribute('data-target');
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) targetPanel.classList.add('visible');
        if (targetId === 'panel-storage') this.populateSavedSongsDropdown();
      });
    });

    this.bindDiagnosticListener('save-btn', 'click', () => {
      const label = document.getElementById('song-name-input').value.trim() || 'untitled-score';
      const payload = {
        title: document.getElementById('music-title').value,
        timeSig: document.getElementById('time-sig').value,
        keySig: document.getElementById('key-sig').value, 
        tempoBPM: document.getElementById('tempo-bpm').value, 
        globalCounter: window.GSS.State.noteGlobalCounter,
        treblePool: window.GSS.State.trebleMasterPool,
        bassPool: window.GSS.State.bassMasterPool
      };
      localStorage.setItem(`studio_ledger_${label}`, JSON.stringify(payload));
      this.populateSavedSongsDropdown(label); 
      alert(`Composition successfully saved to key: [${label}]`);
    });

    this.bindDiagnosticListener('load-btn', 'click', () => {
      const selectedLabel = document.getElementById('song-ledger-select').value;
      if (!selectedLabel) return;
      const rawData = localStorage.getItem(`studio_ledger_${selectedLabel}`);
      if (!rawData) return;
      try {
        const parsed = JSON.parse(rawData);
        document.getElementById('music-title').value = parsed.title || "Restored Score";
        document.getElementById('time-sig').value = parsed.timeSig || "4/4";
        document.getElementById('key-sig').value = parsed.keySig || "C";
        document.getElementById('tempo-bpm').value = parsed.tempoBPM || "120";
        document.getElementById('tempo-readout').innerText = `${parsed.tempoBPM || "120"} BPM`;
        document.getElementById('song-name-input').value = selectedLabel;
        
        window.GSS.State.noteGlobalCounter = parsed.globalCounter || 0;
        window.GSS.State.trebleMasterPool = parsed.treblePool || [];
        window.GSS.State.bassMasterPool = parsed.bassPool || [];
        window.GSS.State.selectedNoteId = null;
        
        window.GSS.HistoryManager.updateInspectorReadout(null); window.GSS.LayoutEngine.rebuildSystemMeasures(); window.GSS.LayoutEngine.renderLivePreview();
      } catch(e) { console.error(e); }
    });

    this.bindDiagnosticListener('play-start-btn', 'click', () => window.GSS.PlaybackEngine.startSequencePlayback());
    this.bindDiagnosticListener('play-stop-btn', 'click', () => window.GSS.PlaybackEngine.stopAllAudioPlayback());
    this.bindDiagnosticListener('nav-prev', 'click', () => this.shiftCursor(-1));
    this.bindDiagnosticListener('nav-next', 'click', () => this.shiftCursor(1));
    this.bindDiagnosticListener('nav-clear', 'click', () => { 
      window.GSS.State.selectedNoteId = null; window.GSS.HistoryManager.updateInspectorReadout(null); window.GSS.LayoutEngine.renderLivePreview(); 
    });

    this.bindDiagnosticListener('action-delete', 'click', () => {
      if (!window.GSS.State.selectedNoteId) return;
      window.GSS.HistoryManager.pushStateToHistory();
      [window.GSS.State.trebleMasterPool, window.GSS.State.bassMasterPool].forEach(pool => {
        const match = pool.find(n => n.id === window.GSS.State.selectedNoteId);
        if (match) {
          match.isRest = true; match.accidental = 'none';
          const poolRef = pool === window.GSS.State.trebleMasterPool ? 'treble' : 'bass';
          match.keys = [poolRef === 'treble' ? 'b/4' : 'd/3']; 
        }
      });
      window.GSS.State.selectedNoteId = null; window.GSS.HistoryManager.updateInspectorReadout(null); window.GSS.LayoutEngine.rebuildSystemMeasures(); window.GSS.LayoutEngine.renderLivePreview();
    });

    this.bindDiagnosticListener('clear-btn', 'click', () => {
      window.GSS.HistoryManager.pushStateToHistory(); window.GSS.State.trebleMasterPool = []; window.GSS.State.bassMasterPool = []; window.GSS.State.selectedNoteId = null;
      window.GSS.HistoryManager.updateInspectorReadout(null); window.GSS.LayoutEngine.rebuildSystemMeasures(); window.GSS.LayoutEngine.renderLivePreview();
    });

    window.addEventListener('keydown', (e) => {
      const isModifierPressed = e.ctrlKey || e.metaKey; if (!isModifierPressed) return;
      const activeKey = e.key.toLowerCase();
      if (activeKey === 'z') { e.preventDefault(); window.GSS.HistoryManager.executeUndoAction(); }
    });

    const previewDiv = document.getElementById('paper-preview');
    if (previewDiv) {
      previewDiv.addEventListener('click', (e) => this.handleGlobalCanvasClick(e));
      console.log("🔌 Connected click canvas delegator to #paper-preview.");
    }
  }
};

window.GSS.InteractionController.bootStudioEngine = function() {
  try {
    this.initializeOperationalEvents();
    this.populateSavedSongsDropdown();
    if (window.GSS.LayoutEngine && typeof window.GSS.LayoutEngine.rebuildSystemMeasures === 'function') {
      window.GSS.LayoutEngine.rebuildSystemMeasures();
      window.GSS.LayoutEngine.renderLivePreview();
    }
  } catch (err) {
    console.error(err);
  }
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  window.GSS.InteractionController.bootStudioEngine();
} else {
  document.addEventListener('DOMContentLoaded', () => window.GSS.InteractionController.bootStudioEngine());
}