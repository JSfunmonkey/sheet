/**
 * Grand Staff Studio - Module: UI Synchronization
 * Path: src/interaction/uiSync.js
 * Scope: Direct DOM feedback rendering for parameters and the Inspector block.
 */

window.GSS = window.GSS || {};

window.GSS.UiSync = {
  /**
   * Evaluates parameters to render detailed textual representations inside the readout.
   */
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
  },

  /**
   * Evaluates parameters to synchronize drop-down inputs dynamically with current item selections.
   */
  syncControlsToSelection(noteObj) {
    if (!noteObj) return;
    
    document.getElementById('editor-tool').value = noteObj.isRest ? 'rest' : 'note';
    document.getElementById('note-duration').value = noteObj.duration;
    document.getElementById('note-accidental').value = noteObj.accidental || 'none';
    document.getElementById('note-dotted').value = noteObj.isDotted ? 'true' : 'false';
    this.updateInspectorReadout(noteObj);
  }
};