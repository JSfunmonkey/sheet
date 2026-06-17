/**
 * Grand Staff Studio - Module: Pitch Mapping
 * Path: src/core/pitchMapping.js
 * Scope: Fixed pitch ordering tables and physical synth frequency formulas.
 */

window.GSS = window.GSS || {};

window.GSS.PitchMapping = {
  TREBLE_PITCH_ORDER: [
    'g/6', 'f/6', 'e/6', 'd/6', 'c/6', 'b/5', 'a/5', 'g/5', 'f/5', 'e/5', 'd/5', 'c/5', 'b/4', 'a/4', 'g/4', 'f/4', 'e/4', 'd/4', 'c/4', 'b/3', 'a/3', 'g/3'
  ],

  BASS_PITCH_ORDER: [
    'b/4', 'a/4', 'g/4', 'f/4', 'e/4', 'd/4', 'c/4', 'b/3', 'a/3', 'g/3', 'f/3', 'e/3', 'd/3', 'c/3', 'b/2', 'a/2', 'g/2', 'f/2', 'e/2', 'd/2', 'c/2', 'b/1'
  ],

  BASE_DURATION_VALUES: {
    'w': 4.0,
    'h': 2.0,
    'q': 1.0,
    '8': 0.5,
    '16': 0.25
  },

  VALUE_TO_DURATION_MAP: [
    { value: 4.0, code: 'w' },
    { value: 2.0, code: 'h' },
    { value: 1.0, code: 'q' },
    { value: 0.5, code: '8' },
    { value: 0.25, code: '16' }
  ],

  /**
   * Translates a string pitch representation and an accidental modifier flag into raw Hz.
   */
  calculateModifiedFrequency(pitchString, accidental) {
    const parts = pitchString.split('/');
    const noteName = parts[0].toLowerCase();
    const octave = parseInt(parts[1]);
    
    const noteBaseOffsets = { 'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11 };
    let semitones = noteBaseOffsets[noteName[0]] + (octave * 12);
    
    if (accidental === 'sharp' || accidental === '#') semitones += 1;
    if (accidental === 'flat' || accidental === 'b') semitones -= 1;
    
    const semitonesFromAnchor = semitones - 48; // Standardized alignment around C4 tuning
    return 440 * Math.pow(2, (semitonesFromAnchor - 22) / 12);
  }
};