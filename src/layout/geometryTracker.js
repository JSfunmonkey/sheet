/**
 * Grand Staff Studio - Module: Geometry Tracker
 * Path: src/layout/geometryTracker.js
 * Scope: Storage for runtime coordinate maps and interactive element hit boxes.
 */

window.GSS = window.GSS || {};

window.GSS.GeometryTracker = {
  measureLayoutCoordinates: [],
  noteBoundingBoxes: {},

  updateMeasureCoordinates(newCoords) {
    this.measureLayoutCoordinates = newCoords;
  },

  updateNoteBoundingBox(id, boxCoordinates) {
    this.noteBoundingBoxes[id] = boxCoordinates;
  },

  clearGeometryCache() {
    this.noteBoundingBoxes = {};
  }
};