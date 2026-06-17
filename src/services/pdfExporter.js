/**
 * Grand Staff Studio - Module: PDF Exporter
 * Path: src/services/pdfExporter.js
 * Scope: Ghost viewport duplication, asynchronous canvas captures, and PDF generation.
 */

window.GSS = window.GSS || {};

window.GSS.PdfExporter = {
  /**
   * Generates document images via temporary viewports without modifying active UI nodes.
   */
  generatePdfReport() {
    const titleText = document.getElementById('music-title').value;
    const targetContainer = document.getElementById('paper-preview');
    if (!targetContainer || !targetContainer.querySelector('svg')) { 
      alert("Cannot export an empty notation sheet."); 
      return; 
    }

    // Temporarily clear selection highlights for a clean document export
    const previousSelectionCacheId = window.GSS.State.selectedNoteId;
    window.GSS.State.selectedNoteId = null; 
    window.GSS.LayoutEngine.renderLivePreview(null);

    let renderPassCounter = 0;
    
    function verifyAndCapture() {
      renderPassCounter++;
      const ghostContainer = document.createElement('div');
      ghostContainer.style.position = 'absolute'; 
      ghostContainer.style.top = '-99999px'; 
      ghostContainer.style.left = '-99999px'; 
      ghostContainer.style.width = '1200px'; 
      ghostContainer.style.overflow = 'visible'; 
      ghostContainer.style.backgroundColor = '#ffffff';
      ghostContainer.innerHTML = targetContainer.innerHTML;
      document.body.appendChild(ghostContainer);

      const clonedSvg = ghostContainer.querySelector('svg');
      if (clonedSvg) { 
        clonedSvg.style.overflow = 'visible'; 
        clonedSvg.setAttribute('width', '1200'); 
      }

      html2canvas(ghostContainer, { 
        logging: false, 
        backgroundColor: '#ffffff', 
        scale: 2, 
        width: 1200, 
        windowWidth: 1200 
      }).then(canvas => {
        document.body.removeChild(ghostContainer);
        const staffImageDataUrl = canvas.toDataURL('image/png');
        
        // Restore active UI highlights
        window.GSS.State.selectedNoteId = previousSelectionCacheId; 
        window.GSS.LayoutEngine.renderLivePreview();

        const docDefinition = {
          pageSize: 'A4', 
          pageOrientation: 'portrait', 
          pageMargins: [40, 40, 40, 40],
          content: [
            { text: titleText.toUpperCase(), style: 'mainHeader' }, 
            { text: '', margin: [0, 10] }, 
            { image: staffImageDataUrl, fit: [515, 800] }
          ],
          styles: { 
            mainHeader: { fontSize: 20, bold: true, color: '#1e293b', alignment: 'center', margin: [0, 0, 0, 10] } 
          }
        };
        pdfMake.createPdf(docDefinition).download(`${titleText.toLowerCase().replace(/\s+/g, '-')}-notation.pdf`);
      }).catch(err => {
        if (ghostContainer.parentNode) document.body.removeChild(ghostContainer);
        if (renderPassCounter < 3) {
          setTimeout(verifyAndCapture, 150);
        } else { 
          window.GSS.State.selectedNoteId = previousSelectionCacheId; 
          window.GSS.LayoutEngine.renderLivePreview(); 
        }
      });
    }
    
    setTimeout(verifyAndCapture, 250);
  }
};