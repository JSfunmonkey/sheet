
console.log(`⏱️ [01/12] state.js started parsing at +${(performance.now() - window.appStartTimers.start).toFixed(2)}ms`);

/**
 * Grand Staff Studio - Module: State Management
 * Path: src/core/state.js
 * Scope: Safe storage of master notation pools and structural history tracking.
 */

window.GSS = window.GSS || {};

window.GSS.State = {
  trebleMasterPool: [],
  bassMasterPool: [],
  noteGlobalCounter: 0,
  selectedNoteId: null,
  notationHistoryQueue: [],
  
  notationClipboard: {
    type: null, 
    trebleData: [],
    bassData: []
  },

  /**
   * Increments the global note tracking counter and returns a clean unique integer identifier.
   */
  incrementGlobalCounter() {
    this.noteGlobalCounter += 1;
    return this.noteGlobalCounter;
  },

  /**
   * Pushes a deep structural snapshot of the current canvas state into the history tracking queue.
   */
  pushStateToHistory() {
    const stateSnapshot = {
      treblePool: JSON.parse(JSON.stringify(this.trebleMasterPool)),
      bassPool: JSON.parse(JSON.stringify(this.bassMasterPool)),
      globalCounter: this.noteGlobalCounter,
      selectedId: this.selectedNoteId
    };
    this.notationHistoryQueue.push(stateSnapshot);
    if (this.notationHistoryQueue.length > 4) {
      this.notationHistoryQueue.shift();
    }
  },

  /**
   * Reverts back to the previous chronological history snapshot state block.
   */
  executeUndoAction() {
    if (this.notationHistoryQueue.length === 0) {
      console.log("Grand Staff Studio: Undo history queue is completely empty.");
      return null;
    }
    const previousState = this.notationHistoryQueue.pop();
    this.trebleMasterPool = previousState.treblePool;
    this.bassMasterPool = previousState.bassPool;
    this.noteGlobalCounter = previousState.globalCounter;
    this.selectedId = previousState.selectedId; // Internal data reference
    this.selectedNoteId = previousState.selectedId; // Global consumer sync
    
    return previousState;
  }
};

console.log(`✅ [01/12] state.js finished initializing at +${(performance.now() - window.appStartTimers.start).toFixed(2)}ms`);