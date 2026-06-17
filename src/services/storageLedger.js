/**
 * Grand Staff Studio - Module: Storage Ledger
 * Path: src/services/storageLedger.js
 * Scope: Local storage file management, deletion gates, renaming, and JSON export/import data engines.
 */

window.GSS = window.GSS || {};

window.GSS.StorageLedger = {
  // Production prefix configuration
  STORAGE_PREFIX: "studio_ledger_",

  /**
   * Helper to scan local storage and return all clean song keys
   */
  getAllSavedSongNames() {
    const names = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.STORAGE_PREFIX)) {
        names.push(key.replace(this.STORAGE_PREFIX, ""));
      }
    }
    return names.sort();
  },

  /**
   * Rebuild drop-down UI list options based on current storage contents
   */
  populateSavedSongsDropdown() {
    const dropdown = document.getElementById('song-ledger-select');
    if (!dropdown) return;

    dropdown.innerHTML = '';
    const songs = this.getAllSavedSongNames();

    if (songs.length === 0) {
      const opt = document.createElement('option');
      opt.value = "";
      opt.innerText = "-- No Scores Found --";
      dropdown.appendChild(opt);
      return;
    }

    songs.forEach(songName => {
      const opt = document.createElement('option');
      opt.value = songName;
      opt.innerText = songName;
      dropdown.appendChild(opt);
    });
  },

  /**
   * Save active workspace state under the standardized schema format
   */
  saveCurrentComposition() {
    const inputEl = document.getElementById('song-name-input');
    let filename = inputEl ? inputEl.value.trim() : "";
    
    filename = filename.replace(/[^a-zA-Z0-9\-_ ]/g, "");
    if (!filename) {
      alert("Please enter a valid file name before saving.");
      return;
    }

    if (!window.GSS.State) return;

    const compositionPayload = {
      title: document.getElementById('music-title')?.value || "Untitled Score",
      timeSignature: document.getElementById('time-sig')?.value || "4/4",
      keySignature: document.getElementById('key-sig')?.value || "C",
      tempo: document.getElementById('tempo-bpm')?.value || "120",
      trebleMasterPool: window.GSS.State.trebleMasterPool || [],
      bassMasterPool: window.GSS.State.bassMasterPool || []
    };

    localStorage.setItem(this.STORAGE_PREFIX + filename, JSON.stringify(compositionPayload));
    console.log(`💾 Saved successfully to ledger slot: ${filename}`);
    
    this.populateSavedSongsDropdown();
    
    const dropdown = document.getElementById('song-ledger-select');
    if (dropdown) dropdown.value = filename;
  },

  /**
   * Load targeted item configurations strictly using native standard keys
   */
  loadComposition() {
    const dropdown = document.getElementById('song-ledger-select');
    const selectedFilename = dropdown ? dropdown.value : "";

    if (!selectedFilename) {
      alert("Please select a valid saved song from the pool first.");
      return;
    }

    const rawData = localStorage.getItem(this.STORAGE_PREFIX + selectedFilename);
    if (!rawData) return;

    try {
      const score = JSON.parse(rawData);

      if (!window.GSS.State) {
        console.error("❌ CRITICAL: 'window.GSS.State' object is missing.");
        return;
      }

      // Streamlined native assignment logic
      window.GSS.State.trebleMasterPool = score.trebleMasterPool || [];
      window.GSS.State.bassMasterPool = score.bassMasterPool || [];
      window.GSS.State.selectedNoteId = null;

      // Sync user interface form inputs natively
      if (document.getElementById('music-title')) {
        document.getElementById('music-title').value = score.title || "Untitled";
      }
      if (document.getElementById('time-sig')) {
        document.getElementById('time-sig').value = score.timeSignature || "4/4";
      }
      if (document.getElementById('key-sig')) {
        document.getElementById('key-sig').value = score.keySignature || "C";
      }
      if (document.getElementById('tempo-bpm')) {
        document.getElementById('tempo-bpm').value = score.tempo || "120";
        const readout = document.getElementById('tempo-readout');
        if (readout) readout.innerText = `${score.tempo || "120"} BPM`;
      }

      const inputEl = document.getElementById('song-name-input');
      if (inputEl) inputEl.value = selectedFilename;

      if (window.GSS.UiSync) window.GSS.UiSync.updateInspectorReadout(null);
      
      // Update graphics rendering map pipelines
      if (window.GSS.LayoutEngine && typeof window.GSS.LayoutEngine.rebuildSystemMeasures === 'function') {
        window.GSS.LayoutEngine.rebuildSystemMeasures();
        window.GSS.LayoutEngine.renderLivePreview();
      }
      
      console.log(`📂 Loaded file successfully: ${selectedFilename}`);

    } catch (err) {
      console.error("❌ Failed parsing file data core:", err);
      alert("Error: Selected song payload data appears corrupted.");
    }
  },

  /**
   * Rename an item's storage key without mutating note tracking data blocks
   */
  renameComposition() {
    const dropdown = document.getElementById('song-ledger-select');
    const targetFilename = dropdown ? dropdown.value : "";

    if (!targetFilename) {
      alert("Please select a file from the dropdown pool to rename.");
      return;
    }

    const newNameRaw = prompt(`Enter a new name for "${targetFilename}":`, targetFilename);
    if (!newNameRaw) return; 

    const newName = newNameRaw.replace(/[^a-zA-Z0-9\-_ ]/g, "").trim();
    if (!newName) {
      alert("Invalid file name provided.");
      return;
    }

    const existingData = localStorage.getItem(this.STORAGE_PREFIX + targetFilename);
    if (!existingData) return;

    localStorage.setItem(this.STORAGE_PREFIX + newName, existingData);
    localStorage.removeItem(this.STORAGE_PREFIX + targetFilename);

    const inputEl = document.getElementById('song-name-input');
    if (inputEl && inputEl.value === targetFilename) {
      inputEl.value = newName;
    }

    this.populateSavedSongsDropdown();
    const newDropdown = document.getElementById('song-ledger-select');
    if (newDropdown) newDropdown.value = newName;
  },

  /**
   * Deletes a targeted composition file completely from browser storage
   */
  deleteComposition() {
    const dropdown = document.getElementById('song-ledger-select');
    const targetFilename = dropdown ? dropdown.value : "";

    if (!targetFilename) {
      alert("Please select a composition file to delete from the ledger.");
      return;
    }

    const verify = confirm(`🗑️ Crucial Check: Are you sure you want to permanently delete "${targetFilename}"?\nThis action cannot be undone.`);
    if (!verify) return;

    localStorage.removeItem(this.STORAGE_PREFIX + targetFilename);
    this.populateSavedSongsDropdown();
    
    const inputEl = document.getElementById('song-name-input');
    if (inputEl && inputEl.value === targetFilename) {
      inputEl.value = "my-studio-score";
    }
  },

  /**
   * Export targeted database string values to a download file package
   */
  exportSongToFile() {
    const dropdown = document.getElementById('song-ledger-select');
    const targetFilename = dropdown ? dropdown.value : "";

    if (!targetFilename) {
      alert("Please select a song from the dropdown list to export.");
      return;
    }

    const rawData = localStorage.getItem(this.STORAGE_PREFIX + targetFilename);
    if (!rawData) return;

    const dataBlob = new Blob([rawData], { type: "application/json" });
    const downloadUrl = URL.createObjectURL(dataBlob);
    
    const virtualLink = document.createElement('a');
    virtualLink.href = downloadUrl;
    virtualLink.download = `${targetFilename.replace(/\s+/g, '-').toLowerCase()}-gss.json`;
    
    document.body.appendChild(virtualLink);
    virtualLink.click();
    
    document.body.removeChild(virtualLink);
    URL.revokeObjectURL(downloadUrl);
  },

  /**
   * Reads an uploaded share file object and imports it into the local ledger pool setup
   */
  importSongFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const payloadText = e.target.result;
        const parsedData = JSON.parse(payloadText);

        if (!parsedData.trebleMasterPool || !parsedData.bassMasterPool) {
          throw new Error("File contents missing core score composition tracking data arrays.");
        }

        let importedName = file.name.replace("-gss.json", "").replace(".json", "").trim();
        importedName = prompt("📥 File verified successfully! Confirm ledger storage item save name:", importedName);
        
        if (!importedName) return;

        importedName = importedName.replace(/[^a-zA-Z0-9\-_ ]/g, "");
        localStorage.setItem(this.STORAGE_PREFIX + importedName, payloadText);
        
        this.populateSavedSongsDropdown();
        const dropdown = document.getElementById('song-ledger-select');
        if (dropdown) dropdown.value = importedName;
        
        alert(`📥 Success! Imported "${importedName}" into your storage vault ledger layout.`);
        this.loadComposition(); 

      } catch (err) {
        console.error("❌ Import processing sequence engine failure:", err);
        alert(`Failed to import file. Verification trace: ${err.message}`);
      }
    };
    reader.readAsText(file);
    event.target.value = ""; 
  }
};