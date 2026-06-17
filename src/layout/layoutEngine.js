/**
 * Grand Staff Studio - Module: Layout Engine (Proportional Metrics Allocation)
 * Path: src/layout/layoutEngine.js
 * Scope: Dynamic, measure-overflow aware notation parser with adaptive line metric structures.
 */

window.GSS = window.GSS || {};

window.GSS.LayoutEngine = {
  songMeasures: [],
  tieTrackingRegistry: [], // Holds matching source/target note mappings for VexFlow ties
  
  // Dynamic layout baselines to allow global scaling
  baseSystemHeight: 240,
  baseStaffOffset: 120,
  baseSpaceBetweenLines: 10, // VexFlow standard line spacing in pixels
  
  // Explicit Axis Multipliers for Focused Workspace Scaling
  horizontalExpansionMultiplier: 2.0, 
  verticalExpansionMultiplier: 1.45,   

  getMaxBeatsForTimeSignature() {
    const sigEl = document.getElementById('time-sig');
    const rawSig = sigEl ? sigEl.value : '4/4';
    if (rawSig === '3/4') return 3.0;
    if (rawSig === '2/4') return 2.0;
    if (rawSig === '6/8') return 3.0; 
    return 4.0;
  },

  calculateBeatDurationInSeconds() {
    const tempoEl = document.getElementById('tempo-bpm');
    const tempoBpm = tempoEl ? (parseFloat(tempoEl.value) || 120) : 120;
    return 60.0 / tempoBpm;
  },

  getTimelineTotalDuration(pool) {
    let sum = 0;
    if (!pool) return sum;
    pool.forEach(n => {
      const base = (window.GSS.PitchMapping && window.GSS.PitchMapping.BASE_DURATION_VALUES)
        ? (window.GSS.PitchMapping.BASE_DURATION_VALUES[n.duration] || 1.0)
        : 1.0;
      sum += base * (n.isDotted ? 1.5 : 1.0);
    });
    return sum;
  },

  getFlattenedNotesList() {
    const flattened = [];
    this.songMeasures.forEach((m, mIdx) => {
      if (m.treble) {
        m.treble.forEach(n => flattened.push({ clef: 'treble', measureIdx: mIdx, note: n }));
      }
      if (m.bass) {
        m.bass.forEach(n => flattened.push({ clef: 'bass', measureIdx: mIdx, note: n }));
      }
    });
    return flattened;
  },

  _decomposeBeatsToNotes(totalBeats) {
    const components = [];
    let rem = totalBeats;

    const values = [
      { name: "w", duration: 4.0, dotted: false },
      { name: "h", duration: 2.0, dotted: true },  
      { name: "h", duration: 2.0, dotted: false }, 
      { name: "q", duration: 1.0, dotted: true },  
      { name: "q", duration: 1.0, dotted: false }, 
      { name: "8", duration: 0.5, dotted: true },  
      { name: "8", duration: 0.5, dotted: false }, 
      { name: "16", duration: 0.25, dotted: false } 
    ];

    while (rem > 0.01) {
      let matched = false;
      for (const val of values) {
        const cost = val.duration * (val.dotted ? 1.5 : 1.0);
        if (rem >= cost - 0.01) {
          components.push({ duration: val.name, isDotted: val.dotted });
          rem -= cost;
          matched = true;
          break;
        }
      }
      if (!matched) break; 
    }
    return components;
  },

  slicePoolIntoMeasures(pool) {
    if (!pool || pool.length === 0) return [];
    
    const maxBeats = this.getMaxBeatsForTimeSignature();
    const measures = [];
    let currentMeasureNotes = [];
    let accumulatedBeats = 0;

    pool.forEach(note => {
      const baseVal = (window.GSS.PitchMapping && window.GSS.PitchMapping.BASE_DURATION_VALUES)
        ? (window.GSS.PitchMapping.BASE_DURATION_VALUES[note.duration] || 1.0)
        : 1.0;
      let noteBeats = baseVal * (note.isDotted ? 1.5 : 1.0);

      if (accumulatedBeats + noteBeats <= maxBeats + 0.01) {
        currentMeasureNotes.push({ ...note, _isFragment: false });
        accumulatedBeats += noteBeats;
      } 
      else {
        let spaceLeft = maxBeats - accumulatedBeats;
        
        if (spaceLeft > 0.01) {
          const leftFragments = this._decomposeBeatsToNotes(spaceLeft);
          leftFragments.forEach((frag) => {
            currentMeasureNotes.push({
              ...note,
              duration: frag.duration,
              isDotted: frag.isDotted,
              _isFragment: true
            });
          });
        }
        
        measures.push(currentMeasureNotes);
        
        let spilloverBeats = noteBeats - spaceLeft;
        currentMeasureNotes = [];
        accumulatedBeats = 0;

        while (spilloverBeats > 0.01) {
          let chunk = Math.min(spilloverBeats, maxBeats);
          const rightFragments = this._decomposeBeatsToNotes(chunk);
          
          rightFragments.forEach((frag) => {
            currentMeasureNotes.push({
              ...note,
              duration: frag.duration,
              isDotted: frag.isDotted,
              _isFragment: true
            });
          });

          accumulatedBeats = chunk;
          spilloverBeats -= chunk;

          if (accumulatedBeats >= maxBeats - 0.01 && spilloverBeats > 0.01) {
            measures.push(currentMeasureNotes);
            currentMeasureNotes = [];
            accumulatedBeats = 0;
          }
        }
      }
    });

    if (currentMeasureNotes.length > 0) {
      measures.push(currentMeasureNotes);
    }
    return measures;
  },

  rebuildSystemMeasures() {
    const treblePool = (window.GSS.State && window.GSS.State.trebleMasterPool) || [];
    const bassPool = (window.GSS.State && window.GSS.State.bassMasterPool) || [];

    const trebleMeasures = this.slicePoolIntoMeasures(treblePool);
    const bassMeasures = this.slicePoolIntoMeasures(bassPool);

    const totalBars = Math.max(trebleMeasures.length, bassMeasures.length, 1);
    this.songMeasures = [];

    for (let i = 0; i < totalBars; i++) {
      this.songMeasures.push({
        treble: trebleMeasures[i] || [],
        bass: bassMeasures[i] || []
      });
    }

    const counterEl = document.getElementById('measure-counter');
    if (counterEl) {
      counterEl.innerText = `Measures: ${totalBars}`;
    }
  },

  _createVfNotes(notesArray, clef, VF, highlightPlaybackIds = null, measureIdx, yLineCoordinate, targetStave = null) {
    if (!notesArray || notesArray.length === 0) return [];
    
    const targetHighlights = Array.isArray(highlightPlaybackIds) 
      ? highlightPlaybackIds 
      : (highlightPlaybackIds ? [highlightPlaybackIds] : []);

    return notesArray.map((n, noteIdx) => {
      try {
        const vfNote = new VF.StaveNote({
          clef: clef,
          keys: n.keys || (clef === 'treble' ? ["b/4"] : ["d/3"]),
          duration: n.duration + (n.isRest ? "r" : "")
        });
        
        if (targetStave) {
          vfNote.setStave(targetStave);
        }

        if (n.isDotted) vfNote.addModifier(new VF.Dot(), 0);
        if (n.accidental && n.accidental !== 'none') vfNote.addModifier(new VF.Accidental(n.accidental), 0);
        
        if (targetHighlights.length > 0 && targetHighlights.includes(n.id)) {
          vfNote.setStyle({ fillStyle: "#0284c7", strokeStyle: "#0284c7" });
        } 
        else if (window.GSS.State && window.GSS.State.selectedNoteId === n.id) {
          vfNote.setStyle({ fillStyle: "#dc2626", strokeStyle: "#dc2626" });
        }

        this.tieTrackingRegistry.push({
          id: n.id,
          isFragment: n._isFragment,
          clef: clef,
          yLine: yLineCoordinate, 
          vfNote: vfNote
        });

        return vfNote;
      } catch (noteErr) {
        console.error(`📊 TELEMETRY | Note Creation Exception [Measure: ${measureIdx}, Clef: ${clef}]:`, noteErr, n);
        return null;
      }
    }).filter(note => note !== null);
  },

  renderLivePreview(highlightPlaybackIds = null) {
    console.log("📡 TELEMETRY | starting layout render cycle...");
    const targetDiv = document.getElementById('paper-preview');
    if (!targetDiv) {
      console.error("🚨 TELEMETRY | Target DOM selector '#paper-preview' completely missing.");
      return;
    }

    targetDiv.innerHTML = '';
    this.tieTrackingRegistry = [];

    const VF = Vex.Flow;
    const canvasWidth = Math.max(targetDiv.clientWidth - 40, 800);
    const renderer = new VF.Renderer(targetDiv, VF.Renderer.Backends.SVG);
    
    const keySig = document.getElementById('key-sig') ? document.getElementById('key-sig').value : 'C';
    const timeSig = document.getElementById('time-sig') ? document.getElementById('time-sig').value : '4/4';
    
    const hasActiveSelection = !!(window.GSS.State && window.GSS.State.selectedNoteId);
    const activeId = hasActiveSelection ? window.GSS.State.selectedNoteId : null;

    console.log(`📡 TELEMETRY | System metrics audit: total song measures = ${this.songMeasures.length}, active selection status = ${hasActiveSelection} (${activeId})`);

    // --- PASS 1: DENSITY & EXPANSION AUDIT ---
    let projectedXCursor = 20;

    const calculatedLayouts = this.songMeasures.map((measure, idx) => {
      const hasSelectedTreble = measure.treble.some(n => n.id === activeId);
      const hasSelectedBass = measure.bass.some(n => n.id === activeId);
      const isCurrentlyEdited = (!hasActiveSelection && idx === 0) || hasSelectedTreble || hasSelectedBass;

      const mockTreble = this._createVfNotes(measure.treble, "treble", VF, highlightPlaybackIds, idx, 0);
      const mockBass = this._createVfNotes(measure.bass, "bass", VF, highlightPlaybackIds, idx, 0);

      let maxMinContentWidth = 80;

      try {
        if (mockTreble.length > 0) {
          const voiceTreble = new VF.Voice({ num_beats: this.getMaxBeatsForTimeSignature(), beat_value: 4 }).setStrict(false).addTickables(mockTreble);
          const formatter = new VF.Formatter().joinVoices([voiceTreble]);
          formatter.preCalculateMinTotalWidth([voiceTreble]);
          maxMinContentWidth = Math.max(maxMinContentWidth, formatter.getMinTotalWidth());
        }
        if (mockBass.length > 0) {
          const voiceBass = new VF.Voice({ num_beats: this.getMaxBeatsForTimeSignature(), beat_value: 4 }).setStrict(false).addTickables(mockBass);
          const formatter = new VF.Formatter().joinVoices([voiceBass]);
          formatter.preCalculateMinTotalWidth([voiceBass]);
          maxMinContentWidth = Math.max(maxMinContentWidth, formatter.getMinTotalWidth());
        }
      } catch (auditErr) {
        console.error(`🚨 TELEMETRY | Density Pre-calculation Failure at measure index [${idx}]:`, auditErr);
      }

      const isFirstOfLine = (projectedXCursor === 20);
      let systemAccidentalPadding = isFirstOfLine ? 110 : 20;
      let baselineSizing = maxMinContentWidth + systemAccidentalPadding; 
      
      let dynamicWidth = isCurrentlyEdited 
        ? Math.floor(baselineSizing * (1.15 * this.horizontalExpansionMultiplier)) 
        : Math.floor(baselineSizing * 1.15);

      const minPossibleWidth = isCurrentlyEdited ? Math.floor(canvasWidth * 0.45) : Math.floor(canvasWidth * 0.15); 
      const maxPossibleWidth = isFirstOfLine ? Math.floor(canvasWidth * 0.90) : Math.floor(canvasWidth * 0.75); 
      dynamicWidth = Math.max(minPossibleWidth, Math.min(maxPossibleWidth, dynamicWidth));

      if (projectedXCursor + dynamicWidth > canvasWidth - 20) {
        projectedXCursor = 20 + dynamicWidth;
      } else {
        projectedXCursor += dynamicWidth;
      }

      return { width: dynamicWidth, isEdited: isCurrentlyEdited };
    });

    this.tieTrackingRegistry = [];

    // --- PASS 2: LINE ASSEMBLY WITH MULTIPLIER ROW HEIGHTS ---
    let currentLineY = 40;
    let currentXCursor = 20;
    const rightMarginLimit = canvasWidth - 20;
    
    let maxRowHeightSeen = this.baseSystemHeight;

    this.songMeasures.forEach((measure, idx) => {
      let geo = calculatedLayouts[idx];
      
      if (currentXCursor + geo.width > rightMarginLimit && currentXCursor > 20) {
        currentXCursor = 20;
        currentLineY += maxRowHeightSeen;
        maxRowHeightSeen = this.baseSystemHeight; 
      }
      
      if (geo.isEdited) {
        const expandedHeightValue = Math.floor(this.baseSystemHeight * this.verticalExpansionMultiplier);
        maxRowHeightSeen = Math.max(maxRowHeightSeen, expandedHeightValue);
      }

      geo.xStart = currentXCursor;
      geo.yStart = currentLineY;
      geo.isFirstOfLine = (currentXCursor === 20);
      currentXCursor += geo.width;
    });

    try {
      renderer.resize(canvasWidth, currentLineY + maxRowHeightSeen + 80);
    } catch (resizeErr) {
      console.error("🚨 TELEMETRY | SVG Context resize setup exception:", resizeErr);
    }
    const context = renderer.getContext();

    if (window.GSS.GeometryTracker) {
      window.GSS.GeometryTracker.measureLayoutCoordinates = [];
      window.GSS.GeometryTracker.noteBoundingBoxes = {};
    }

    // --- PASS 3: FINAL RENDER LAYER GENERATION ---
    this.songMeasures.forEach((measure, idx) => {
      const geo = calculatedLayouts[idx];
      const startX = geo.xStart;
      const startY = geo.yStart;
      const measureWidth = geo.width;

      const currentSpaceBetweenLines = geo.isEdited 
        ? Math.floor(this.baseSpaceBetweenLines * this.verticalExpansionMultiplier)
        : this.baseSpaceBetweenLines;

      // FIXED: When line spacing increases, the grand staff distance must push downwards proportionally 
      // to keep the lower treble spectrum from drifting into the bass clef selection coordinates.
      const bassStaffOffset = geo.isEdited 
        ? Math.floor(this.baseStaffOffset + (currentSpaceBetweenLines - this.baseSpaceBetweenLines) * 4) 
        : this.baseStaffOffset;

      console.log(`📡 TELEMETRY | Processing rendering parameters for Measure #${idx + 1}: xStart=${startX}, yStart=${startY}, measureWidth=${measureWidth}, lineSpacing=${currentSpaceBetweenLines}`);

      if (window.GSS.GeometryTracker) {
        window.GSS.GeometryTracker.measureLayoutCoordinates.push({
          measureIndex: idx, 
          xStart: startX, 
          xEnd: startX + measureWidth,
          trebleTopLineY: startY, 
          bassTopLineY: startY + bassStaffOffset, 
          spaceBetweenLines: currentSpaceBetweenLines, 
          isEdited: geo.isEdited
        });
      }

      try {
        const trebleStave = new VF.Stave(startX, startY, measureWidth);
        const bassStave = new VF.Stave(startX, startY + bassStaffOffset, measureWidth);

        // FIXED: Assign spatial layout configurations directly to the internal options dictionary
        if (geo.isEdited) {
          trebleStave.options.spacing_between_lines_px = currentSpaceBetweenLines;
          bassStave.options.spacing_between_lines_px = currentSpaceBetweenLines;
        }

        if (geo.isFirstOfLine) {
          trebleStave.addClef("treble").addKeySignature(keySig).addTimeSignature(timeSig);
          bassStave.addClef("bass").addKeySignature(keySig).addTimeSignature(timeSig);
          new VF.StaveConnector(trebleStave, bassStave).setType(VF.StaveConnector.type.BRACE).setContext(context).draw();
          new VF.StaveConnector(trebleStave, bassStave).setType(VF.StaveConnector.type.SINGLE).setContext(context).draw();
        } else {
          new VF.StaveConnector(trebleStave, bassStave).setType(VF.StaveConnector.type.SINGLE).setContext(context).draw();
        }

        if (idx === this.songMeasures.length - 1 || calculatedLayouts[idx + 1]?.isFirstOfLine) {
          new VF.StaveConnector(trebleStave, bassStave).setType(VF.StaveConnector.type.SINGLE).setContext(context).draw();
        }

        trebleStave.setContext(context).draw();
        bassStave.setContext(context).draw();

        const vfTrebleNotes = this._createVfNotes(measure.treble, "treble", VF, highlightPlaybackIds, idx, startY, trebleStave);
        const vfBassNotes = this._createVfNotes(measure.bass, "bass", VF, highlightPlaybackIds, idx, startY + bassStaffOffset, bassStave);
        
        const paddingLeftRight = geo.isFirstOfLine ? 90 : 30;
        const internalFormatterWidth = Math.max(40, measureWidth - paddingLeftRight);

        if (vfTrebleNotes.length > 0) {
          const voiceTreble = new VF.Voice({ num_beats: this.getMaxBeatsForTimeSignature(), beat_value: 4 }).setStrict(false).addTickables(vfTrebleNotes);
          new VF.Formatter().joinVoices([voiceTreble]).format([voiceTreble], internalFormatterWidth);
          voiceTreble.draw(context, trebleStave);
        }

        if (vfBassNotes.length > 0) {
          const voiceBass = new VF.Voice({ num_beats: this.getMaxBeatsForTimeSignature(), beat_value: 4 }).setStrict(false).addTickables(vfBassNotes);
          new VF.Formatter().joinVoices([voiceBass]).format([voiceBass], internalFormatterWidth);
          voiceBass.draw(context, bassStave);
        }
      } catch (staveDrawErr) {
        console.error(`🚨 TELEMETRY | Structural Draw Interruption in measure block [${idx}]:`, staveDrawErr);
      }
    });

    // --- PASS 4: SMART CROSS-LINE MARGIN TIE GENERATION ---
    try {
      ['treble', 'bass'].forEach(staffClef => {
        const staffNotes = this.tieTrackingRegistry.filter(t => t.clef === staffClef);
        
        for (let i = 0; i < staffNotes.length - 1; i++) {
          const currentNote = staffNotes[i];
          const nextNote = staffNotes[i + 1];

          if (currentNote.id === nextNote.id) {
            if (Math.abs(currentNote.yLine - nextNote.yLine) > 50) {
              const outboundTie = new VF.StaveTie({ first_note: currentNote.vfNote, last_note: null, first_indices: [0], last_indices: [0] });
              outboundTie.setContext(context).draw();
              
              const inboundTie = new VF.StaveTie({ first_note: null, last_note: nextNote.vfNote, first_indices: [0], last_indices: [0] });
              inboundTie.setContext(context).draw();
            } else {
              const normalTie = new VF.StaveTie({ first_note: currentNote.vfNote, last_note: nextNote.vfNote, first_indices: [0], last_indices: [0] });
              normalTie.setContext(context).draw();
            }
          }
        }
      });
    } catch (tieErr) {
      console.warn("⚠️ TELEMETRY | Tie mapping loop bypass exception:", tieErr);
    }

    // --- PASS 5: DIRECT DOM ELEMENT CLICK BINDING ---
    try {
      const dataNotesList = [];
      this.songMeasures.forEach(m => {
        if (m.treble && m.treble.length > 0) dataNotesList.push(...m.treble);
        if (m.bass && m.bass.length > 0) dataNotesList.push(...m.bass);
      });

      const domStaveNotes = targetDiv.querySelectorAll('.vf-stavenote');
      domStaveNotes.forEach((svgGroup, domIdx) => {
        const correspondingDataNode = dataNotesList[domIdx];
        if (correspondingDataNode && window.GSS.GeometryTracker) {
          svgGroup.classList.add('custom-clickable-note');
          svgGroup.setAttribute('data-music-id', correspondingDataNode.id);
          svgGroup.style.pointerEvents = "auto";

          const rect = svgGroup.getBoundingClientRect();
          window.GSS.GeometryTracker.noteBoundingBoxes[correspondingDataNode.id] = {
            left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom
          };
        }
      });
      console.log(`📡 TELEMETRY | Render cycle complete. Attached ${domStaveNotes.length} interactive note listeners.`);
    } catch (domBindErr) {
      console.error("🚨 TELEMETRY | Post-render DOM connection execution error:", domBindErr);
    }
  }
};

// Global exports alignment
window.getMaxBeatsForTimeSignature = () => window.GSS.LayoutEngine.getMaxBeatsForTimeSignature();
window.calculateBeatDurationInSeconds = () => window.GSS.LayoutEngine.calculateBeatDurationInSeconds();
window.getTimelineTotalDuration = (p) => window.GSS.LayoutEngine.getTimelineTotalDuration(p);
window.getFlattenedNotesList = () => window.GSS.LayoutEngine.getFlattenedNotesList();
window.slicePoolIntoMeasures = (p) => window.GSS.LayoutEngine.slicePoolIntoMeasures(p);
window.rebuildSystemMeasures = () => window.GSS.LayoutEngine.rebuildSystemMeasures();
window.renderLivePreview = (ids) => window.GSS.LayoutEngine.renderLivePreview(ids);