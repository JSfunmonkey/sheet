/**
 * Grand Staff Studio - Module: Global State
 * Path: src/core/globalState.js
 * Scope: Global Shared Memory state buckets and core audio context instance selectors.
 */

window.GSS = window.GSS || {};

window.GSS.State = {
  trebleMasterPool: [],
  bassMasterPool: [],
  noteGlobalCounter: 0,
  selectedNoteId: null,
  runningPlaybackTimers: [],
  audioCtx: null,

  getAudioContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioCtx;
  }
};

// Map original legacy variables to point securely into the state manager
Object.defineProperty(window, 'trebleMasterPool', {
  get() { return window.GSS.State.trebleMasterPool; },
  set(val) { window.GSS.State.trebleMasterPool = val; }
});
Object.defineProperty(window, 'bassMasterPool', {
  get() { return window.GSS.State.bassMasterPool; },
  set(val) { window.GSS.State.bassMasterPool = val; }
});
Object.defineProperty(window, 'noteGlobalCounter', {
  get() { return window.GSS.State.noteGlobalCounter; },
  set(val) { window.GSS.State.noteGlobalCounter = val; }
});
Object.defineProperty(window, 'selectedNoteId', {
  get() { return window.GSS.State.selectedNoteId; },
  set(val) { window.GSS.State.selectedNoteId = val; }
});
Object.defineProperty(window, 'runningPlaybackTimers', {
  get() { return window.GSS.State.runningPlaybackTimers; },
  set(val) { window.GSS.State.runningPlaybackTimers = val; }
});
window.getAudioContext = () => window.GSS.State.getAudioContext();