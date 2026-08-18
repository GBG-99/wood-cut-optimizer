/**
 * CortePro DIY - Canvas Interactive Renderer
 * Visualizador 2D interactivo con soporte Retina, zoom, paneo, acotación de cotas,
 * texturas de madera y soporte perfecto de unidades Métrico (mm) e Imperial (in).
 */

export class CanvasRenderer {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.options = {
      theme: options.theme || 'wood', // 'wood', 'blueprint', 'contrast'
      showDimensions: options.showDimensions !== undefined ? options.showDimensions : true,
      showCutLines: options.showCutLines !== undefined ? options.showCutLines : true,
      showOffcuts: options.showOffcuts !== undefined ? options.showOffcuts : true,
      unit: options.unit || 'mm',
      onHoverPiece: options.onHoverPiece || null,
      onClickPiece: options.onClickPiece || null,
      ...options
    };

    this.currentSheet = null;
    this.hoveredPiece = null;
    this.selectedPieceId = null;

    // Estado de transformación (Zoom & Pan)
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    this._initEvents();
    this._handleResize();
  }

  _initEvents() {
    window.addEventListener('resize', () => this._handleResize());

    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX - this.panX;
      this.dragStartY = e.clientY - this.panY;
      this.canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.panX = e.clientX - this.dragStartX;
        this.panY = e.clientY - this.dragStartY;
        this.render();
      } else {
        this._checkHover(e);
      }
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newScale = Math.min(Math.max(0.001, this.scale * zoomFactor), 50);

      this.panX = mouseX - (mouseX - this.panX) * (newScale / this.scale);
      this.panY = mouseY - (mouseY - this.panY) * (newScale / this.scale);
      this.scale = newScale;

      this.render();
    }, { passive: false });

    this.canvas.addEventListener('click', () => {
      if (this.hoveredPiece && this.options.onClickPiece) {
        this.options.onClickPiece(this.hoveredPiece);
      }
    });

    let initialTouchDistance = null;

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.dragStartX = e.touches[0].clientX - this.panX;
        this.dragStartY = e.touches[0].clientY - this.panY;
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        initialTouchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        this.panX = e.touches[0].clientX - this.dragStartX;
        this.panY = e.touches[0].clientY - this.dragStartY;
        this.render();
      } else if (e.touches.length === 2 && initialTouchDistance) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const factor = dist / initialTouchDistance;
        initialTouchDistance = dist;

        const newScale = Math.min(Math.max(0.001, this.scale * factor), 50);
        this.scale = newScale;
        this.render();
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', () => {
      this.isDragging = false;
      initialTouchDistance = null;
    });
  }

  _handleResize() {
    const container = this.canvas.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 460;
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.resetTransform?.() || this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    if (this.currentSheet) {
      this.fitToScreen();
    } else {
      this.render();
    }
  }

  setSheet(sheetData) {
    this.currentSheet = sheetData;
    this.hoveredPiece = null;
    this.fitToScreen();
  }

  setUnit(unit) {
    this.options.unit = unit;
    this.fitToScreen();
  }

  setTheme(theme) {
    this.options.theme = theme;
    this.render();
  }

  setHighlightPiece(pieceId) {
    this.selectedPieceId = pieceId;
    this.render();
  }

  fitToScreen() {
    if (!this.currentSheet || this.currentSheet.width <= 0 || this.currentSheet.height <= 0) {
      this.render();
      return;
    }

    const container = this.canvas.parentElement;
    const displayWidth = container.clientWidth || 800;
    const displayHeight = container.clientHeight || 460;

    const paddingX = 70;
    const paddingY = 60;
    const availW = Math.max(50, displayWidth - paddingX * 2);
    const availH = Math.max(50, displayHeight - paddingY * 2);

    const scaleX = availW / this.currentSheet.width;
    const scaleY = availH / this.currentSheet.height;

    this.scale = Math.min(scaleX, scaleY);
    this.panX = (displayWidth - this.currentSheet.width * this.scale) / 2;
    this.panY = (displayHeight - this.currentSheet.height * this.scale) / 2;

    this.render();
  }

  zoomIn() {
    this.scale = Math.min(50, this.scale * 1.25);
    this.render();
  }

  zoomOut() {
    this.scale = Math.max(0.001, this.scale * 0.8);
    this.render();
  }

  _screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    return {
      x: (mouseX - this.panX) / this.scale,
      y: (mouseY - this.panY) / this.scale,
      screenX: mouseX,
      screenY: mouseY
    };
  }

  _checkHover(e) {
    if (!this.currentSheet || !this.currentSheet.placedPieces) return;

    const { x, y, screenX, screenY } = this._screenToWorld(e.clientX, e.clientY);
    let found = null;

    for (let i = this.currentSheet.placedPieces.length - 1; i >= 0; i--) {
      const p = this.currentSheet.placedPieces[i];
      if (x >= p.x && x <= p.x + p.placedWidth && y >= p.y && y <= p.y + p.placedHeight) {
        found = p;
        break;
      }
    }

    if (found !== this.hoveredPiece) {
      this.hoveredPiece = found;
      this.render();
      if (this.options.onHoverPiece) {
        this.options.onHoverPiece(found, found ? { x: screenX, y: screenY } : null);
      }
    }
  }

  _formatDim(val) {
    const unit = this.options.unit || 'mm';
    if (unit === 'in') {
      return Number(val.toFixed(2)).toString();
    }
    return Math.round(val).toString();
  }

  render() {
    const ctx = this.ctx;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);

    this._drawBackground(width, height);

    if (!this.currentSheet || this.currentSheet.width <= 0) {
      this._drawPlaceholder(width, height);
      ctx.restore();
      return;
    }

    ctx.translate(this.panX, this.panY);
    ctx.scale(this.scale, this.scale);

    const sheet = this.currentSheet;

    // 1. Tablero comercial base
    this._drawSheetBase(sheet);

    // 2. Margen de saneado perimetral
    if (sheet.margin > 0) {
      this._drawMargin(sheet);
    }

    // 3. Retales / zonas de sobrante
    if (this.options.showOffcuts && sheet.freeRects) {
      this._drawOffcuts(sheet);
    }

    // 4. Piezas colocadas
    if (sheet.placedPieces) {
      this._drawPlacedPieces(sheet);
    }

    // 5. Líneas de corte de sierra / Kerf
    if (this.options.showCutLines && sheet.cutLines) {
      this._drawCutLines(sheet);
    }

    // 6. Cotas de dimensión
    if (this.options.showDimensions) {
      this._drawDimensions(sheet);
    }

    ctx.restore();
  }

  _drawBackground(width, height) {
    const ctx = this.ctx;
    const theme = this.options.theme;

    if (theme === 'blueprint') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else if (theme === 'wood') {
      ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#090d16' : '#f1f5f9';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, width, height);
    }
  }

  _drawPlaceholder(width, height) {
    const ctx = this.ctx;
    ctx.fillStyle = '#9ca3af';
    ctx.font = '500 15px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Añade piezas y pulsa "Calcular Distribución Óptima" para ver el plano.', width / 2, height / 2);
  }

  _drawSheetBase(sheet) {
    const ctx = this.ctx;
    const theme = this.options.theme;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 14 / this.scale;
    ctx.shadowOffsetY = 6 / this.scale;

    if (theme === 'wood') {
      ctx.fillStyle = '#b88352';
    } else if (theme === 'blueprint') {
      ctx.fillStyle = '#1e293b';
    } else {
      ctx.fillStyle = '#27272a';
    }

    ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.restore();

    ctx.strokeStyle = theme === 'blueprint' ? '#38bdf8' : '#78350f';
    ctx.lineWidth = 2 / this.scale;
    ctx.strokeRect(0, 0, sheet.width, sheet.height);
  }

  _drawMargin(sheet) {
    const ctx = this.ctx;
    const m = sheet.margin;

    ctx.save();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5 / this.scale;
    ctx.setLineDash([6 / this.scale, 4 / this.scale]);
    ctx.strokeRect(m, m, sheet.width - m * 2, sheet.height - m * 2);
    ctx.restore();
  }

  _drawOffcuts(sheet) {
    const ctx = this.ctx;
    const unit = this.options.unit || 'mm';

    ctx.save();

    for (const rect of sheet.freeRects || []) {
      if (rect.width <= 0 || rect.height <= 0) continue;

      ctx.fillStyle = 'rgba(100, 116, 139, 0.28)';
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

      ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
      ctx.lineWidth = 1 / this.scale;
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

      // Evaluar si cabe el texto en píxeles de pantalla
      const screenW = rect.width * this.scale;
      const screenH = rect.height * this.scale;

      if (screenW >= 70 && screenH >= 30) {
        const screenFontSize = Math.min(13, Math.max(9, screenH / 3.5));
        const worldFontSize = screenFontSize / this.scale;

        ctx.font = `600 ${worldFontSize}px system-ui, sans-serif`;
        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const label = `Retal: ${this._formatDim(rect.width)} × ${this._formatDim(rect.height)} ${unit}`;
        ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2);
      }
    }
    ctx.restore();
  }

  _drawPlacedPieces(sheet) {
    const ctx = this.ctx;

    sheet.placedPieces.forEach((piece) => {
      const isHovered = this.hoveredPiece && this.hoveredPiece.id === piece.id && this.hoveredPiece.x === piece.x && this.hoveredPiece.y === piece.y;
      const isSelected = this.selectedPieceId && (this.selectedPieceId === piece.id || this.selectedPieceId === piece.originalId);

      ctx.save();

      const fillColor = piece.color || '#3b82f6';
      ctx.fillStyle = fillColor;
      ctx.fillRect(piece.x, piece.y, piece.placedWidth, piece.placedHeight);

      if (this.options.theme === 'wood') {
        this._drawWoodGrain(piece);
      }

      if (isHovered || isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.5 / this.scale;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 10 / this.scale;
      } else {
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.lineWidth = 1.5 / this.scale;
      }
      ctx.strokeRect(piece.x, piece.y, piece.placedWidth, piece.placedHeight);

      this._drawPieceLabel(piece, isHovered || isSelected);

      ctx.restore();
    });
  }

  _drawWoodGrain(piece) {
    const ctx = this.ctx;
    const unit = this.options.unit || 'mm';
    const step = unit === 'in' ? (15 / this.scale) : 22;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1 / this.scale;

    if (!piece.rotated) {
      for (let y = piece.y + step / 2; y < piece.y + piece.placedHeight - step / 4; y += step) {
        ctx.beginPath();
        ctx.moveTo(piece.x + 2 / this.scale, y);
        ctx.lineTo(piece.x + piece.placedWidth - 2 / this.scale, y);
        ctx.stroke();
      }
    } else {
      for (let x = piece.x + step / 2; x < piece.x + piece.placedWidth - step / 4; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, piece.y + 2 / this.scale);
        ctx.lineTo(x, piece.y + piece.placedHeight - 2 / this.scale);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  _drawPieceLabel(piece, highlight) {
    const ctx = this.ctx;
    const unit = this.options.unit || 'mm';
    const centerX = piece.x + piece.placedWidth / 2;
    const centerY = piece.y + piece.placedHeight / 2;

    // Dimensiones en píxeles de pantalla reales
    const screenW = piece.placedWidth * this.scale;
    const screenH = piece.placedHeight * this.scale;
    const minScreenDim = Math.min(screenW, screenH);

    if (minScreenDim < 18) return; // Demasiado pequeña en pantalla para texto

    // Calcular tamaño de fuente deseado en píxeles de pantalla (10px a 14px)
    const screenNameFontSize = Math.min(14, Math.max(9, minScreenDim / 4.5));
    const screenDimFontSize = Math.min(12, Math.max(8, minScreenDim / 6));

    // Convertir a unidades del lienzo (mundo)
    const worldNameFontSize = screenNameFontSize / this.scale;
    const worldDimFontSize = screenDimFontSize / this.scale;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text1 = piece.name;
    const text2 = `${this._formatDim(piece.placedWidth)} × ${this._formatDim(piece.placedHeight)} ${unit} ${piece.rotated ? '🔄' : ''}`;

    ctx.font = `bold ${worldNameFontSize}px system-ui, -apple-system, sans-serif`;
    const text1Width = ctx.measureText(text1).width;

    ctx.font = `600 ${worldDimFontSize}px system-ui, -apple-system, sans-serif`;
    const text2Width = ctx.measureText(text2).width;

    const maxTextWidth = Math.max(text1Width, text2Width);
    const badgePaddingX = 8 / this.scale;
    const badgePaddingY = 5 / this.scale;

    // Comprobar si cabe en horizontal
    if (maxTextWidth + badgePaddingX * 2 < piece.placedWidth) {
      const badgeH = worldNameFontSize + worldDimFontSize + badgePaddingY * 2;
      const badgeW = maxTextWidth + badgePaddingX * 2;

      ctx.fillStyle = highlight ? 'rgba(0, 0, 0, 0.92)' : 'rgba(0, 0, 0, 0.75)';
      ctx.beginPath();
      ctx.roundRect?.(centerX - badgeW / 2, centerY - badgeH / 2, badgeW, badgeH, 4 / this.scale) ||
        ctx.rect(centerX - badgeW / 2, centerY - badgeH / 2, badgeW, badgeH);
      ctx.fill();

      ctx.fillStyle = highlight ? '#fbbf24' : '#ffffff';
      ctx.font = `bold ${worldNameFontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(text1, centerX, centerY - worldDimFontSize / 2);

      ctx.fillStyle = '#f1f5f9';
      ctx.font = `500 ${worldDimFontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(text2, centerX, centerY + worldNameFontSize / 2);
    } else if (piece.placedHeight > piece.placedWidth && maxTextWidth + badgePaddingX * 2 < piece.placedHeight) {
      // Rotar texto en vertical si la pieza es esbelta
      ctx.translate(centerX, centerY);
      ctx.rotate(-Math.PI / 2);

      const badgeH = worldNameFontSize + worldDimFontSize + badgePaddingY * 2;
      const badgeW = maxTextWidth + badgePaddingX * 2;

      ctx.fillStyle = highlight ? 'rgba(0, 0, 0, 0.92)' : 'rgba(0, 0, 0, 0.75)';
      ctx.beginPath();
      ctx.roundRect?.(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 4 / this.scale) ||
        ctx.rect(-badgeW / 2, -badgeH / 2, badgeW, badgeH);
      ctx.fill();

      ctx.fillStyle = highlight ? '#fbbf24' : '#ffffff';
      ctx.font = `bold ${worldNameFontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(text1, 0, -worldDimFontSize / 2);

      ctx.fillStyle = '#f1f5f9';
      ctx.font = `500 ${worldDimFontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(text2, 0, worldNameFontSize / 2);
    } else {
      // Nombre corto si es muy ajustado
      const shortFontSize = Math.min(10 / this.scale, minScreenDim / (2 * this.scale));
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${shortFontSize}px system-ui, sans-serif`;
      ctx.fillText(piece.name.substring(0, 6), centerX, centerY);
    }

    ctx.restore();
  }

  _drawCutLines(sheet) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = Math.max(1 / this.scale, (sheet.kerf || 3));
    ctx.setLineDash([4 / this.scale, 3 / this.scale]);

    for (const cut of sheet.cutLines || []) {
      ctx.beginPath();
      if (cut.type === 'vertical') {
        ctx.moveTo(cut.x, cut.y);
        ctx.lineTo(cut.x, cut.y + cut.length);
      } else {
        ctx.moveTo(cut.x, cut.y);
        ctx.lineTo(cut.x + cut.length, cut.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawDimensions(sheet) {
    const ctx = this.ctx;
    const unit = this.options.unit || 'mm';
    const margin = 24 / this.scale;
    const tick = 6 / this.scale;
    const worldFontSize = 12 / this.scale;

    ctx.save();
    ctx.strokeStyle = this.options.theme === 'blueprint' ? '#38bdf8' : '#64748b';
    ctx.fillStyle = this.options.theme === 'blueprint' ? '#38bdf8' : '#e2e8f0';
    ctx.lineWidth = 1.5 / this.scale;
    ctx.font = `bold ${worldFontSize}px system-ui, sans-serif`;

    // Cota horizontal superior (Ancho)
    const yTop = -margin;
    ctx.beginPath();
    ctx.moveTo(0, yTop);
    ctx.lineTo(sheet.width, yTop);
    ctx.moveTo(0, yTop - tick);
    ctx.lineTo(0, yTop + tick);
    ctx.moveTo(sheet.width, yTop - tick);
    ctx.lineTo(sheet.width, yTop + tick);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${this._formatDim(sheet.width)} ${unit} (Ancho)`, sheet.width / 2, yTop - 3 / this.scale);

    // Cota vertical izquierda (Alto)
    const xLeft = -margin;
    ctx.beginPath();
    ctx.moveTo(xLeft, 0);
    ctx.lineTo(xLeft, sheet.height);
    ctx.moveTo(xLeft - tick, 0);
    ctx.lineTo(xLeft + tick, 0);
    ctx.moveTo(xLeft - tick, sheet.height);
    ctx.lineTo(xLeft + tick, sheet.height);
    ctx.stroke();

    ctx.save();
    ctx.translate(xLeft - 5 / this.scale, sheet.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${this._formatDim(sheet.height)} ${unit} (Alto)`, 0, 0);
    ctx.restore();

    ctx.restore();
  }

  exportToPNG() {
    if (!this.currentSheet) return null;

    const exportCanvas = document.createElement('canvas');
    const expCtx = exportCanvas.getContext('2d');

    const sheet = this.currentSheet;
    const padding = 80;
    const scale = 2;

    exportCanvas.width = (sheet.width + padding * 2) * scale;
    exportCanvas.height = (sheet.height + padding * 2) * scale;

    expCtx.scale(scale, scale);
    expCtx.translate(padding, padding);

    expCtx.fillStyle = '#ffffff';
    expCtx.fillRect(-padding, -padding, sheet.width + padding * 2, sheet.height + padding * 2);

    const prevScale = this.scale;
    const prevPanX = this.panX;
    const prevPanY = this.panY;
    const prevCtx = this.ctx;
    const prevCanvas = this.canvas;

    this.ctx = expCtx;
    this.canvas = exportCanvas;
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;

    this._drawSheetBase(sheet);
    if (sheet.margin > 0) this._drawMargin(sheet);
    if (this.options.showOffcuts && sheet.freeRects) this._drawOffcuts(sheet);
    if (sheet.placedPieces) this._drawPlacedPieces(sheet);
    if (this.options.showCutLines && sheet.cutLines) this._drawCutLines(sheet);
    this._drawDimensions(sheet);

    expCtx.fillStyle = '#111827';
    expCtx.font = 'bold 24px system-ui, sans-serif';
    expCtx.textAlign = 'left';
    expCtx.fillText(`Plano de Corte: ${sheet.sheetInfo.name} (#${sheet.sheetIndex})`, 0, -45);

    const dataUrl = exportCanvas.toDataURL('image/png');

    this.ctx = prevCtx;
    this.canvas = prevCanvas;
    this.scale = prevScale;
    this.panX = prevPanX;
    this.panY = prevPanY;

    return dataUrl;
  }
}
