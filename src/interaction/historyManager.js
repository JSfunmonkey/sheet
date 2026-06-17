/**
 * Grand Staff Studio - Module: History Manager
 * Path: src/interaction/historyManager.js
 * Scope: Multi-step historical state cache queues, undo loops, and readout tracking.
 */

window.GSS = window.GSS || {};

window.GSS.HistoryManager = {
  notationHistoryQueue: [],

  pushStateToHistory() {
    const stateSnapshot = {
      treblePool: JSON.parse(JSON.stringify(window.GSS.State.trebleMasterPool || [])),
      bassPool: JSON.parse(JSON.stringify(window.GSS.State.bassMasterPool || [])),
      globalCounter: window.GSS.State.noteGlobalCounter || 0,
      selectedId: window.GSS.State.selectedNoteId
    };
    this.notationHistoryQueue.push(stateSnapshot);
    if (this.notationHistoryQueue.length > 4) {
      this.notationHistoryQueue.shift();
    }
  },

  executeUndoAction() {
    if (!this.notationHistoryQueue || this.notationHistoryQueue.length === 0) {
      console.log("Grand Staff Studio: Undo history queue is completely empty.");
      return;
    }
    const previousState = this.notationHistoryQueue.pop();
    window.GSS.State.trebleMasterPool = previousState.treblePool;
    window.GSS.State.bassMasterPool = previousState.bassPool;
    window.GSS.State.noteGlobalCounter = previousState.globalCounter;
    window.GSS.State.selectedNoteId = previousState.selectedId;

    if (window.GSS.State.selectedNoteId) {
      window.GSS.InteractionController.syncControlsToSelection(window.GSS.State.selectedNoteId);
    } else {
      this.updateInspectorReadout(null);
    }
    window.GSS.LayoutEngine.rebuildSystemMeasures();
    window.GSS.LayoutEngine.renderLivePreview();
  },

  updateInspectorReadout(noteObj) {
    const readout = document.getElementById('inspector-readout');
    if (!readout) return;
    if (!noteObj) {
      readout.innerHTML = `<strong>Active Node Token:</strong> No element selected. Click a note head to evaluate composition parameters. (Ctrl+C copies active, Ctrl+V pastes, Ctrl+Z undos up to 4 actions)`;
      return;
    }
    const typeLabel = noteObj.isRest ? "REST BLOCK 🛑" : "ACTIVE NOTE HEAD 🎵";
    const fallbackKeys = noteObj.keys || (noteObj.key ? [noteObj.key] : ["c/4"]);
    const keysLabel = fallbackKeys.join(', ').toUpperCase();
    const dotLabel = noteObj.isDotted ? "Yes (1.5x Multiplier)" : "No";
     
    readout.innerHTML = `<strong>Active Node Token:</strong> [ID: #${noteObj.id}] | Type: ${typeLabel} | Structural Pitch: ${keysLabel} | Duration Flag: "${noteObj.duration}" | Accidental: [${noteObj.accidental || 'none'}] | Dotted: ${dotLabel}`;
  }
};

// Backward-compatibility binds for interaction loops
window.notationHistoryQueue = window.GSS.HistoryManager.notationHistoryQueue;
window.pushStateToHistory = () => window.GSS.HistoryManager.pushStateToHistory();
window.executeUndoAction = () => window.GSS.HistoryManager.executeUndoAction();
window.updateInspectorReadout = (n) => window.GSS.HistoryManager.updateInspectorReadout(n);