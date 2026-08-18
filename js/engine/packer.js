/**
 * CortePro DIY - 2D Cutting Stock Packing Engine
 * Implementa algoritmos de empaquetado 2D (Guillotina y MaxRects) adaptados a corte de tableros
 * con soporte para Kerf (grosor de disco), Saneado perimetral y Orientación de Veta.
 */

export class GuillotinePacker {
  constructor(boardWidth, boardHeight, options = {}) {
    this.boardWidth = boardWidth;
    this.boardHeight = boardHeight;
    this.kerf = options.kerf !== undefined ? options.kerf : 3;
    this.margin = options.margin !== undefined ? options.margin : 0;
    this.heuristic = options.heuristic || 'BSSF'; // BSSF, BLSF, BAF
    this.splitRule = options.splitRule || 'MINAS'; // SAS, LAS, MINAS, MAXAS

    // Área útil después del saneado
    this.usableX = this.margin;
    this.usableY = this.margin;
    this.usableWidth = Math.max(0, boardWidth - this.margin * 2);
    this.usableHeight = Math.max(0, boardHeight - this.margin * 2);

    this.freeRects = [];
    if (this.usableWidth > 0 && this.usableHeight > 0) {
      this.freeRects.push({
        x: this.usableX,
        y: this.usableY,
        width: this.usableWidth,
        height: this.usableHeight
      });
    }

    this.placedPieces = [];
    this.cutLines = []; // Líneas de corte para visualización y secuencia
  }

  /**
   * Intenta colocar una pieza en el tablero
   * @param {Object} piece { id, name, width, height, allowRotation, color }
   * @returns {Object|null} Información de la pieza colocada o null si no cabe
   */
  insert(piece) {
    let bestRectIndex = -1;
    let bestScore1 = Infinity;
    let bestScore2 = Infinity;
    let bestRotated = false;

    for (let i = 0; i < this.freeRects.length; i++) {
      const rect = this.freeRects[i];

      // Orientación normal
      if (piece.width <= rect.width && piece.height <= rect.height) {
        const { score1, score2 } = this._scorePlacement(rect, piece.width, piece.height);
        if (score1 < bestScore1 || (score1 === bestScore1 && score2 < bestScore2)) {
          bestScore1 = score1;
          bestScore2 = score2;
          bestRectIndex = i;
          bestRotated = false;
        }
      }

      // Orientación rotada (si se permite rotación para la veta)
      if (piece.allowRotation && piece.height <= rect.width && piece.width <= rect.height) {
        const { score1, score2 } = this._scorePlacement(rect, piece.height, piece.width);
        if (score1 < bestScore1 || (score1 === bestScore1 && score2 < bestScore2)) {
          bestScore1 = score1;
          bestScore2 = score2;
          bestRectIndex = i;
          bestRotated = true;
        }
      }
    }

    if (bestRectIndex === -1) {
      return null;
    }

    const targetRect = this.freeRects[bestRectIndex];
    const placedW = bestRotated ? piece.height : piece.width;
    const placedH = bestRotated ? piece.width : piece.height;

    const placedPiece = {
      id: piece.id,
      name: piece.name,
      originalWidth: piece.width,
      originalHeight: piece.height,
      placedWidth: placedW,
      placedHeight: placedH,
      x: targetRect.x,
      y: targetRect.y,
      rotated: bestRotated,
      color: piece.color || '#3b82f6',
      label: piece.label || piece.name
    };

    this.placedPieces.push(placedPiece);

    // Dividir el rectángulo libre según la regla de guillotina seleccionada
    this._splitFreeRect(bestRectIndex, placedPiece);

    // Fusionar retales adyacentes si es posible para reducir fragmentación
    this._mergeFreeRects();

    return placedPiece;
  }

  _scorePlacement(rect, pW, pH) {
    const leftoverW = rect.width - pW;
    const leftoverH = rect.height - pH;

    switch (this.heuristic) {
      case 'BSSF': // Best Short Side Fit
        return {
          score1: Math.min(leftoverW, leftoverH),
          score2: Math.max(leftoverW, leftoverH)
        };
      case 'BLSF': // Best Long Side Fit
        return {
          score1: Math.max(leftoverW, leftoverH),
          score2: Math.min(leftoverW, leftoverH)
        };
      case 'BAF': // Best Area Fit
      default:
        return {
          score1: rect.width * rect.height - pW * pH,
          score2: Math.min(leftoverW, leftoverH)
        };
    }
  }

  _splitFreeRect(rectIndex, placed) {
    const rect = this.freeRects.splice(rectIndex, 1)[0];
    const pW = placed.placedWidth;
    const pH = placed.placedHeight;
    const kerf = this.kerf;

    const rightW = rect.width - pW - kerf;
    const rightH = pH;
    const rightFullH = rect.height;

    const topW = pW;
    const topFullW = rect.width;
    const topH = rect.height - pH - kerf;

    let splitHorizontal = true;

    switch (this.splitRule) {
      case 'SAS': // Shorter Axis Split
        splitHorizontal = rect.width <= rect.height;
        break;
      case 'LAS': // Longer Axis Split
        splitHorizontal = rect.width > rect.height;
        break;
      case 'MAXAS': // Maximize Area Split
        splitHorizontal = (topFullW * topH) >= (rightW * rightFullH);
        break;
      case 'MINAS': // Minimize Area Split (maximiza el mayor bloque contiguo)
      default:
        splitHorizontal = (topW * topH + rightW * rightFullH) >= (topFullW * topH + rightW * rightH);
        break;
    }

    // Registrar líneas de corte
    if (rect.x + pW < this.boardWidth - this.margin) {
      this.cutLines.push({
        type: 'vertical',
        x: rect.x + pW,
        y: rect.y,
        length: splitHorizontal ? pH : rect.height,
        kerf: this.kerf
      });
    }
    if (rect.y + pH < this.boardHeight - this.margin) {
      this.cutLines.push({
        type: 'horizontal',
        x: rect.x,
        y: rect.y + pH,
        length: splitHorizontal ? rect.width : pW,
        kerf: this.kerf
      });
    }

    if (splitHorizontal) {
      // Corte horizontal a lo ancho de todo el rectángulo
      if (rightW > 0 && pH > 0) {
        this.freeRects.push({
          x: rect.x + pW + kerf,
          y: rect.y,
          width: rightW,
          height: pH
        });
      }
      if (rect.width > 0 && topH > 0) {
        this.freeRects.push({
          x: rect.x,
          y: rect.y + pH + kerf,
          width: rect.width,
          height: topH
        });
      }
    } else {
      // Corte vertical a lo alto de todo el rectángulo
      if (pW > 0 && topH > 0) {
        this.freeRects.push({
          x: rect.x,
          y: rect.y + pH + kerf,
          width: pW,
          height: topH
        });
      }
      if (rightW > 0 && rect.height > 0) {
        this.freeRects.push({
          x: rect.x + pW + kerf,
          y: rect.y,
          width: rightW,
          height: rect.height
        });
      }
    }
  }

  _mergeFreeRects() {
    for (let i = 0; i < this.freeRects.length; i++) {
      for (let j = i + 1; j < this.freeRects.length; j++) {
        const r1 = this.freeRects[i];
        const r2 = this.freeRects[j];

        // Misma X y ancho -> adyacentes verticalmente
        if (r1.x === r2.x && r1.width === r2.width) {
          if (r1.y + r1.height === r2.y) {
            r1.height += r2.height;
            this.freeRects.splice(j, 1);
            j--;
            continue;
          }
          if (r2.y + r2.height === r1.y) {
            r1.y = r2.y;
            r1.height += r2.height;
            this.freeRects.splice(j, 1);
            j--;
            continue;
          }
        }

        // Misma Y y alto -> adyacentes horizontalmente
        if (r1.y === r2.y && r1.height === r2.height) {
          if (r1.x + r1.width === r2.x) {
            r1.width += r2.width;
            this.freeRects.splice(j, 1);
            j--;
            continue;
          }
          if (r2.x + r2.width === r1.x) {
            r1.x = r2.x;
            r1.width += r2.width;
            this.freeRects.splice(j, 1);
            j--;
            continue;
          }
        }
      }
    }
  }

  getOffcuts(minArea = 10000) {
    return this.freeRects.map(r => ({
      ...r,
      area: r.width * r.height,
      isReusable: (r.width >= 100 && r.height >= 100 && (r.width * r.height) >= minArea)
    })).sort((a, b) => b.area - a.area);
  }
}

/**
 * Algoritmo MaxRects (Maximal Rectangles) para empaquetado 2D de alta densidad
 */
export class MaxRectsPacker {
  constructor(boardWidth, boardHeight, options = {}) {
    this.boardWidth = boardWidth;
    this.boardHeight = boardHeight;
    this.kerf = options.kerf !== undefined ? options.kerf : 3;
    this.margin = options.margin !== undefined ? options.margin : 0;
    this.heuristic = options.heuristic || 'BSSF';

    this.usableX = this.margin;
    this.usableY = this.margin;
    this.usableWidth = Math.max(0, boardWidth - this.margin * 2);
    this.usableHeight = Math.max(0, boardHeight - this.margin * 2);

    this.freeRects = [];
    if (this.usableWidth > 0 && this.usableHeight > 0) {
      this.freeRects.push({
        x: this.usableX,
        y: this.usableY,
        width: this.usableWidth,
        height: this.usableHeight
      });
    }

    this.placedPieces = [];
    this.cutLines = [];
  }

  insert(piece) {
    let bestNode = null;
    let bestScore1 = Infinity;
    let bestScore2 = Infinity;

    for (let i = 0; i < this.freeRects.length; i++) {
      const rect = this.freeRects[i];

      // Orientación normal
      if (piece.width <= rect.width && piece.height <= rect.height) {
        const score1 = Math.min(rect.width - piece.width, rect.height - piece.height);
        const score2 = Math.max(rect.width - piece.width, rect.height - piece.height);

        if (score1 < bestScore1 || (score1 === bestScore1 && score2 < bestScore2)) {
          bestScore1 = score1;
          bestScore2 = score2;
          bestNode = {
            x: rect.x,
            y: rect.y,
            width: piece.width,
            height: piece.height,
            rotated: false
          };
        }
      }

      // Orientación rotada
      if (piece.allowRotation && piece.height <= rect.width && piece.width <= rect.height) {
        const score1 = Math.min(rect.width - piece.height, rect.height - piece.width);
        const score2 = Math.max(rect.width - piece.height, rect.height - piece.width);

        if (score1 < bestScore1 || (score1 === bestScore1 && score2 < bestScore2)) {
          bestScore1 = score1;
          bestScore2 = score2;
          bestNode = {
            x: rect.x,
            y: rect.y,
            width: piece.height,
            height: piece.width,
            rotated: true
          };
        }
      }
    }

    if (!bestNode) return null;

    const placedPiece = {
      id: piece.id,
      name: piece.name,
      originalWidth: piece.width,
      originalHeight: piece.height,
      placedWidth: bestNode.width,
      placedHeight: bestNode.height,
      x: bestNode.x,
      y: bestNode.y,
      rotated: bestNode.rotated,
      color: piece.color || '#3b82f6',
      label: piece.label || piece.name
    };

    const occupiedX = bestNode.x;
    const occupiedY = bestNode.y;
    const occupiedW = bestNode.width + this.kerf;
    const occupiedH = bestNode.height + this.kerf;

    const newFreeRects = [];
    for (let i = 0; i < this.freeRects.length; i++) {
      const free = this.freeRects[i];
      if (!this._isOverlapping(free, { x: occupiedX, y: occupiedY, width: occupiedW, height: occupiedH })) {
        newFreeRects.push(free);
        continue;
      }

      if (occupiedX > free.x && occupiedX < free.x + free.width) {
        newFreeRects.push({
          x: free.x,
          y: free.y,
          width: occupiedX - free.x,
          height: free.height
        });
      }
      if (occupiedX + occupiedW < free.x + free.width) {
        newFreeRects.push({
          x: occupiedX + occupiedW,
          y: free.y,
          width: (free.x + free.width) - (occupiedX + occupiedW),
          height: free.height
        });
      }
      if (occupiedY > free.y && occupiedY < free.y + free.height) {
        newFreeRects.push({
          x: free.x,
          y: free.y,
          width: free.width,
          height: occupiedY - free.y
        });
      }
      if (occupiedY + occupiedH < free.y + free.height) {
        newFreeRects.push({
          x: free.x,
          y: occupiedY + occupiedH,
          width: free.width,
          height: (free.y + free.height) - (occupiedY + occupiedH)
        });
      }
    }

    this.freeRects = this._pruneFreeList(newFreeRects);
    this.placedPieces.push(placedPiece);
    return placedPiece;
  }

  _isOverlapping(r1, r2) {
    return !(r1.x >= r2.x + r2.width ||
             r1.x + r1.width <= r2.x ||
             r1.y >= r2.y + r2.height ||
             r1.y + r1.height <= r2.y);
  }

  _pruneFreeList(rects) {
    const pruned = [];
    for (let i = 0; i < rects.length; i++) {
      const r1 = rects[i];
      if (r1.width <= 0 || r1.height <= 0) continue;
      let contained = false;
      for (let j = 0; j < rects.length; j++) {
        if (i === j) continue;
        const r2 = rects[j];
        if (r1.x >= r2.x && r1.y >= r2.y &&
            r1.x + r1.width <= r2.x + r2.width &&
            r1.y + r1.height <= r2.y + r2.height) {
          contained = true;
          break;
        }
      }
      if (!contained) {
        pruned.push(r1);
      }
    }
    return pruned;
  }

  getOffcuts(minArea = 10000) {
    return this.freeRects.map(r => ({
      ...r,
      area: r.width * r.height,
      isReusable: (r.width >= 100 && r.height >= 100 && (r.width * r.height) >= minArea)
    })).sort((a, b) => b.area - a.area);
  }
}
