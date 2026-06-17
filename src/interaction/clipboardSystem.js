/**
 * Grand Staff Studio - Module: Clipboard System
 * Path: src/interaction/clipboardSystem.js
 * Scope: Unabridged node and measure structure clip duplications.
 */

window.GSS = window.GSS || {};

window.GSS.ClipboardSystem = {
  notationClipboard: {
    type: null, 
    trebleData: [],
    bassData: []
  },

  copySelectedEntityToClipboard(isShiftKeyPressed = false) {
    if (!window.GSS.State.selectedNoteId) return;
    const flatList = window.GSS.LayoutEngine.getFlattenedNotesList();
    const foundNodeMeta = flatList.find(f => f.note.id === window.GSS.State.selectedNoteId);
    if (!foundNodeMeta) return;

    this.notationClipboard.trebleData = [];
    this.notationClipboard.bassData = [];

    if (isShiftKeyPressed) {
      const targetMeasureData = window.GSS.LayoutEngine.songMeasures[foundNodeMeta.measureIdx];
      if (targetMeasureData) {
        this.notationClipboard.type = 'measure';
        this.notationClipboard.trebleData = JSON.parse(JSON.stringify(targetMeasureData.treble));
        this.notationClipboard.bassData = JSON.parse(JSON.stringify(targetMeasureData.bass));
      }
    } else {
      this.notationClipboard.type = 'note';
      const activeNoteDeepClone = JSON.parse(JSON.stringify(foundNodeMeta.note));
      if (foundNodeMeta.clef === 'treble') {
        this.notationClipboard.trebleData.push(activeNoteDeepClone);
      } else {
        this.notationClipboard.bassData.push(activeNoteDeepClone);
      }
    }
  },

  pasteClipboardContent() {
    if (!this.notationClipboard.type) return;
    window.GSS.HistoryManager.pushStateToHistory();

    let lastSpawnedId = null;
    const flatList = window.GSS.LayoutEngine.getFlattenedNotesList();
    const targetAnchorMeta = window.GSS.State.selectedNoteId ? flatList.find(f => f.note.id === window.GSS.State.selectedNoteId) : null;

    if (this.notationClipboard.type === 'note') {
      if (this.notationClipboard.trebleData.length > 0) {
        this.notationClipboard.trebleData.forEach(item => {
          const freshCopy = JSON.parse(JSON.stringify(item));
          freshCopy.id = ++window.GSS.State.noteGlobalCounter;
          delete freshCopy.measureIdx; delete freshCopy.parentNoteId; delete freshCopy.tieForward; delete freshCopy.nextLinkedId; delete freshCopy.isOverflowSegment;

          if (targetAnchorMeta && targetAnchorMeta.clef === 'treble') {
            const underlyingIndex = window.GSS.State.trebleMasterPool.findIndex(n => n.id === targetAnchorMeta.note.id);
            if (underlyingIndex !== -1) window.GSS.State.trebleMasterPool.splice(underlyingIndex + 1, 0, freshCopy);
            else window.GSS.State.trebleMasterPool.push(freshCopy);
          } else {
            window.GSS.State.trebleMasterPool.push(freshCopy);
          }
          lastSpawnedId = freshCopy.id;
        });
      }
      if (this.notationClipboard.bassData.length > 0) {
        this.notationClipboard.bassData.forEach(item => {
          const freshCopy = JSON.parse(JSON.stringify(item));
          freshCopy.id = ++window.GSS.State.noteGlobalCounter;
          delete freshCopy.measureIdx; delete freshCopy.parentNoteId; delete freshCopy.tieForward; delete freshCopy.nextLinkedId; delete freshCopy.isOverflowSegment;

          if (targetAnchorMeta && targetAnchorMeta.clef === 'bass') {
            const underlyingIndex = window.GSS.State.bassMasterPool.findIndex(n => n.id === targetAnchorMeta.note.id);
            if (underlyingIndex !== -1) window.GSS.State.bassMasterPool.splice(underlyingIndex + 1, 0, freshCopy);
            else window.GSS.State.bassMasterPool.push(freshCopy);
          } else {
            window.GSS.State.bassMasterPool.push(freshCopy);
          }
          lastSpawnedId = freshCopy.id;
        });
      }
    } else if (this.notationClipboard.type === 'measure') {
      if (targetAnchorMeta) {
        const currentTargetMeasureIdx = targetAnchorMeta.measureIdx;
        const targetMeasureData = window.GSS.LayoutEngine.songMeasures[currentTargetMeasureIdx];
        let trebleInsertMarkerIndex = window.GSS.State.trebleMasterPool.length;
        let bassInsertMarkerIndex = window.GSS.State.bassMasterPool.length;

        if (targetMeasureData && targetMeasureData.treble && targetMeasureData.treble.length > 0) {
          const lastNoteIdInMeasure = targetMeasureData.treble[targetMeasureData.treble.length - 1].parentNoteId || targetMeasureData.treble[targetMeasureData.treble.length - 1].id;
          const foundIndex = window.GSS.State.trebleMasterPool.findIndex(n => n.id === lastNoteIdInMeasure);
          if (foundIndex !== -1) trebleInsertMarkerIndex = foundIndex + 1;
        }
        if (targetMeasureData && targetMeasureData.bass && targetMeasureData.bass.length > 0) {
          const lastNoteIdInMeasure = targetMeasureData.bass[targetMeasureData.bass.length - 1].parentNoteId || targetMeasureData.bass[targetMeasureData.bass.length - 1].id;
          const foundIndex = window.GSS.State.bassMasterPool.findIndex(n => n.id === lastNoteIdInMeasure);
          if (foundIndex !== -1) bassInsertMarkerIndex = foundIndex + 1;
        }

        this.notationClipboard.trebleData.forEach((item, offsetIdx) => {
          const freshCopy = JSON.parse(JSON.stringify(item));
          freshCopy.id = ++window.GSS.State.noteGlobalCounter;
          delete freshCopy.measureIdx; delete freshCopy.parentNoteId; delete freshCopy.tieForward; delete freshCopy.nextLinkedId; delete freshCopy.isOverflowSegment;
          window.GSS.State.trebleMasterPool.splice(trebleInsertMarkerIndex + offsetIdx, 0, freshCopy);
        });
        this.notationClipboard.bassData.forEach((item, offsetIdx) => {
          const freshCopy = JSON.parse(JSON.stringify(item));
          freshCopy.id = ++window.GSS.State.noteGlobalCounter;
          delete freshCopy.measureIdx; delete freshCopy.parentNoteId; delete freshCopy.tieForward; delete freshCopy.nextLinkedId; delete freshCopy.isOverflowSegment;
          window.GSS.State.bassMasterPool.splice(bassInsertMarkerIndex + offsetIdx, 0, freshCopy);
          lastSpawnedId = freshCopy.id;
        });
      } else {
        [this.notationClipboard.trebleData, this.notationClipboard.bassData].forEach((data, i) => {
          const pool = i === 0 ? window.GSS.State.trebleMasterPool : window.GSS.State.bassMasterPool;
          data.forEach(item => {
            const freshCopy = JSON.parse(JSON.stringify(item));
            freshCopy.id = ++window.GSS.State.noteGlobalCounter;
            delete freshCopy.measureIdx; delete freshCopy.parentNoteId; delete freshCopy.tieForward; delete freshCopy.nextLinkedId; delete freshCopy.isOverflowSegment;
            pool.push(freshCopy);
            if (i === 1) lastSpawnedId = freshCopy.id;
          });
        });
      }
    }

    if (lastSpawnedId) {
      window.GSS.State.selectedNoteId = lastSpawnedId;
      window.GSS.InteractionController.syncControlsToSelection(lastSpawnedId);
    }
    window.GSS.LayoutEngine.rebuildSystemMeasures();
    window.GSS.LayoutEngine.renderLivePreview();
  }
};

// Legacy object fallback matching
window.notationClipboard = window.GSS.ClipboardSystem.notationClipboard;
window.copySelectedEntityToClipboard = (s) => window.GSS.ClipboardSystem.copySelectedEntityToClipboard(s);
window.pasteClipboardContent = () => window.GSS.ClipboardSystem.pasteClipboardContent();