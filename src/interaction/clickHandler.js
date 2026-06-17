/**
 * Grand Staff Studio - Module: Click Handler
 * Path: src/interaction/clickHandler.js
 * Scope: Canvas coordinate lookup evaluation, note insertion, and proximity gating.
 */

window.GSS = window.GSS || {};

window.GSS.ClickHandler = {
  /**
   * Evaluates relative click dimensions to route tokens or modify active chords.
   */
  handleGlobalCanvasClick(e) {
    const previewDiv = document.getElementById('paper-preview');
    const svgElement = previewDiv ? previewDiv.querySelector('svg') : null;
    if (!svgElement) return;

    // Check if the user is clicking directly on a rendered VexFlow note head element
    const noteGroup = e.target.closest('[data-music-id]') || e.target.closest('.custom-clickable-note');

    // --- TRUE SVG MATRIX TRANSFORM ENGINE ---
    // This converts e.clientX/Y directly into the exact coordinate system used by VexFlow
    const svgPoint = svgElement.createSVGPoint();
    svgPoint.x = e.clientX;
    svgPoint.y = e.clientY;
    
    const invertedMatrix = svgElement.getScreenCTM().inverse();
    const transformedCoordinates = svgPoint.matrixTransform(invertedMatrix);

    const clickX = transformedCoordinates.x;
    const clickY = transformedCoordinates.y;

    const coords = window.GSS.GeometryTracker.measureLayoutCoordinates || [];
    let matchingMeasureFrame = coords.find(frame => {
      const heightLimit = frame.isEdited ? 320 : 160;
      return clickX >= frame.xStart && clickX <= frame.xEnd && 
             clickY >= (frame.trebleTopLineY - 60) && clickY <= (frame.bassTopLineY + heightLimit);
    });

    if (!matchingMeasureFrame && coords.length > 0) {
      const closeRows = coords.filter(frame => {
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
        let absoluteLastMeasure = coords[coords.length - 1];
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

    // --- ABSOLUTE MATHEMATICAL PITCH EVALUATION ---
    const trebleBottomLineY = matchingMeasureFrame.trebleTopLineY + (matchingMeasureFrame.spaceBetweenLines * 4); // Exactly 96px
    const bassTopLineY = matchingMeasureFrame.bassTopLineY; // Exactly 176px
    
    // Split the threshold perfectly down the middle of the staves (136px)
    const middleSplitThreshold = trebleBottomLineY + ((bassTopLineY - trebleBottomLineY) / 2);
    
    // Assign clef based on the true matrix boundary line
    let computedClef = (clickY < middleSplitThreshold) ? 'treble' : 'bass';
    
    let computedPitch = 'c/4';
    const LINE_STEP_SPACING = matchingMeasureFrame.spaceBetweenLines / 2; 

    if (computedClef === 'treble') {
      const stepsFromTop = Math.round((clickY - matchingMeasureFrame.trebleTopLineY) / LINE_STEP_SPACING);
      const trebleOrder = window.GSS.PitchMapping.TREBLE_PITCH_ORDER;
      computedPitch = trebleOrder[Math.max(0, Math.min(stepsFromTop, trebleOrder.length - 1))];
    } else {
      const stepsFromTop = Math.round((clickY - matchingMeasureFrame.bassTopLineY) / LINE_STEP_SPACING);
      const bassOrder = window.GSS.PitchMapping.BASS_PITCH_ORDER;
      computedPitch = bassOrder[Math.max(0, Math.min(stepsFromTop, bassOrder.length - 1))];
    }

    // --- VIEWPORT-ALIGNED PROXIMITY GATING ENGINE ---
    let isWithinChordZone = false;
    if (window.GSS.State.selectedNoteId) {
      const box = window.GSS.GeometryTracker.noteBoundingBoxes[window.GSS.State.selectedNoteId];
      if (box) {
        const svgRect = svgElement.getBoundingClientRect();
        const relativeNoteX = (box.left + box.right) / 2 - svgRect.left;
        
        // Convert clickX back to client relative check style to compare bounding boxes correctly
        const clientRelativeClickX = e.clientX - svgRect.left;
        const deltaX = Math.abs(clientRelativeClickX - relativeNoteX);
        
        const activeUiDuration = document.getElementById('note-duration').value; 
        const chordProximityThreshold = (activeUiDuration === '8' || activeUiDuration === '16') ? 16 : 32;

        if (deltaX <= chordProximityThreshold) {
          isWithinChordZone = true;
        }
      }
    }

    // --- INTERACTIVE NOTE SELECTION / CHORD ARCHITECTURE ---
    if (noteGroup) {
      const rawId = parseInt(noteGroup.getAttribute('data-music-id'), 10);
      if (rawId) {
        const flatList = window.GSS.LayoutEngine.getFlattenedNotesList();
        const foundItem = flatList.find(f => f.note.id === rawId);
        const parsedId = foundItem ? foundItem.note.id : rawId;
        
        if (window.GSS.State.selectedNoteId === parsedId) {
          this.modifyChordStack(window.GSS.State.selectedNoteId, computedPitch);
          window.GSS.LayoutEngine.renderLivePreview();
          return;
        } else {
          window.GSS.State.selectedNoteId = parsedId;
          const match = flatList.find(f => f.note.id === parsedId);
          if (match && window.GSS.UiSync) window.GSS.UiSync.syncControlsToSelection(match.note);
          window.GSS.LayoutEngine.renderLivePreview();
          return;
        }
      }
    }

    if (window.GSS.State.selectedNoteId && isWithinChordZone && !noteGroup) {
      this.modifyChordStack(window.GSS.State.selectedNoteId, computedPitch);
      window.GSS.LayoutEngine.renderLivePreview();
      return;
    }

    if (window.GSS.State.selectedNoteId && !noteGroup) {
      window.GSS.State.selectedNoteId = null;
      if (window.GSS.UiSync) window.GSS.UiSync.updateInspectorReadout(null);
    }

    // --- LINEAR NOTE CREATION ENTRY POINT ---
    if (window.GSS.State.pushStateToHistory) window.GSS.State.pushStateToHistory();

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
          id: window.GSS.State.incrementGlobalCounter(),
          keys: [(computedClef === 'treble' ? 'b/4' : 'd/3')],
          duration: padCode,
          accidental: 'none',
          isDotted: false,
          isRest: true
        });
        paddingDeficit -= window.GSS.PitchMapping.BASE_DURATION_VALUES[padCode];
      }
    }

    const targetId = window.GSS.State.incrementGlobalCounter();
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
    if (window.GSS.UiSync) window.GSS.UiSync.updateInspectorReadout(freshNote);

    if (!isRestMode && window.GSS.AudioSynth) {
      const hz = window.GSS.PitchMapping.calculateModifiedFrequency(computedPitch, chosenAccidental);
      window.GSS.AudioSynth.playPolyphonicSynthTone([hz], 0.3);
    }

    window.GSS.LayoutEngine.rebuildSystemMeasures();
    window.GSS.LayoutEngine.renderLivePreview();
  },

  /**
   * Appends or filters structural steps inside chord pitch stacks.
   */
  modifyChordStack(id, pitch) {
    if (window.GSS.State.pushStateToHistory) window.GSS.State.pushStateToHistory();
    let targetedNode = null;
    
    [window.GSS.State.trebleMasterPool, window.GSS.State.bassMasterPool].forEach(pool => {
      const match = pool.find(n => n.id === id);
      if (match && !match.isRest) {
        if (!match.keys) match.keys = ["c/4"];
           
        if (match.keys.includes(pitch)) {
          if (match.keys.length > 1) match.keys = match.keys.filter(k => k !== pitch);
        } else {
          match.keys.push(pitch);
        }
           
        match.keys.sort((a,b) => {
          const getRank = (k) => (parseInt(k.split('/')[1], 10) * 12) + "cdefgab".indexOf(k[0]);
          return getRank(a) - getRank(b);
        });
           
        targetedNode = match;

        if (window.GSS.AudioSynth && window.GSS.PitchMapping) {
          const freqs = match.keys.map(k => window.GSS.PitchMapping.calculateModifiedFrequency(k, match.accidental || 'none'));
          window.GSS.AudioSynth.playPolyphonicSynthTone(freqs, 0.3);
        }
      }
    });
    
    if (targetedNode && window.GSS.UiSync) window.GSS.UiSync.updateInspectorReadout(targetedNode);
    if (window.GSS.LayoutEngine) window.GSS.LayoutEngine.rebuildSystemMeasures();
  }
};