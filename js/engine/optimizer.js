/**
 * CortePro DIY - Multi-Heuristic 2D Optimizer
 * Orquesta múltiples algoritmos y heurísticas para encontrar la solución con
 * menor desperdicio y menor número de tableros (Soporte Métrico e Imperial).
 */

import { GuillotinePacker, MaxRectsPacker } from './packer.js';

export class CuttingOptimizer {
  constructor(stockSheets = [], pieces = [], settings = {}) {
    this.stockSheets = stockSheets;
    this.pieces = pieces;
    this.unit = settings.unit === 'in' ? 'in' : 'mm';
    this.settings = {
      kerf: settings.kerf !== undefined ? Number(settings.kerf) : (this.unit === 'in' ? 0.125 : 3),
      margin: settings.margin !== undefined ? Number(settings.margin) : (this.unit === 'in' ? 0.5 : 10),
      algorithm: settings.algorithm || 'auto',
      grainDirection: settings.grainDirection || 'horizontal',
      unit: this.unit,
      ...settings
    };
  }

  _expandPieces() {
    const expanded = [];
    let counter = 1;

    for (const piece of this.pieces) {
      const qty = Math.max(1, parseInt(piece.quantity, 10) || 1);
      const w = parseFloat(piece.width) || 0;
      const h = parseFloat(piece.height) || 0;

      if (w <= 0 || h <= 0) continue;

      for (let i = 0; i < qty; i++) {
        expanded.push({
          id: piece.id || `p-${counter}`,
          originalId: piece.id,
          name: piece.name || `Pieza #${counter}`,
          width: w,
          height: h,
          area: w * h,
          allowRotation: piece.allowRotation !== undefined ? Boolean(piece.allowRotation) : true,
          color: piece.color || this._getColorForIndex(counter),
          copyIndex: i + 1,
          totalCopies: qty
        });
        counter++;
      }
    }

    return expanded;
  }

  _getColorForIndex(index) {
    const colors = [
      '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
      '#ec4899', '#06b6d4', '#f97316', '#14b8a6',
      '#6366f1', '#84cc16', '#eab308', '#d97706'
    ];
    return colors[(index - 1) % colors.length];
  }

  _getSortStrategies(pieces) {
    return [
      { name: 'Área Descendente', items: [...pieces].sort((a, b) => b.area - a.area) },
      { name: 'Lado Mayor Descendente', items: [...pieces].sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height)) },
      { name: 'Ancho Descendente', items: [...pieces].sort((a, b) => b.width !== a.width ? b.width - a.width : b.height - a.height) },
      { name: 'Alto Descendente', items: [...pieces].sort((a, b) => b.height !== a.height ? b.height - a.height : b.width - a.width) },
      { name: 'Perímetro Descendente', items: [...pieces].sort((a, b) => (2 * (b.width + b.height)) - (2 * (a.width + a.height))) }
    ];
  }

  _runPackingTrial(strategyName, piecesList, packerType, heuristic, splitRule) {
    const sheetsResult = [];
    const unplacedPieces = [];
    let currentPieceList = [...piecesList];

    const availableStock = [];
    for (const sheet of this.stockSheets) {
      const qty = Math.max(1, parseInt(sheet.quantity, 10) || 1);
      for (let i = 0; i < qty; i++) {
        availableStock.push({
          id: sheet.id || `sheet-${availableStock.length + 1}`,
          name: sheet.name || `Tablero ${sheet.width}×${sheet.height}`,
          width: parseFloat(sheet.width) || (this.unit === 'in' ? 96 : 2440),
          height: parseFloat(sheet.height) || (this.unit === 'in' ? 48 : 1220),
          margin: this.settings.margin,
          price: parseFloat(sheet.price) || 0
        });
      }
    }

    if (availableStock.length === 0) {
      availableStock.push({
        id: 'default-sheet-1',
        name: this.unit === 'in' ? 'Tablero Estándar (96×48 in)' : 'Tablero Estándar (2440×1220 mm)',
        width: this.unit === 'in' ? 96 : 2440,
        height: this.unit === 'in' ? 48 : 1220,
        margin: this.settings.margin,
        price: 0
      });
    }

    const defaultSheetTemplate = availableStock[0];
    let sheetIndex = 0;

    while (currentPieceList.length > 0) {
      let sheetDef;
      if (sheetIndex < availableStock.length) {
        sheetDef = availableStock[sheetIndex];
      } else {
        sheetDef = {
          ...defaultSheetTemplate,
          id: `extra-sheet-${sheetIndex + 1}`,
          name: `${defaultSheetTemplate.name} (Adicional #${sheetIndex - availableStock.length + 1})`
        };
      }

      let packer;
      const options = {
        kerf: this.settings.kerf,
        margin: this.settings.margin,
        heuristic,
        splitRule
      };

      if (packerType === 'maxrects') {
        packer = new MaxRectsPacker(sheetDef.width, sheetDef.height, options);
      } else {
        packer = new GuillotinePacker(sheetDef.width, sheetDef.height, options);
      }

      const remainingPieces = [];
      let placedCount = 0;

      for (const piece of currentPieceList) {
        const placed = packer.insert(piece);
        if (placed) {
          placedCount++;
        } else {
          remainingPieces.push(piece);
        }
      }

      if (placedCount === 0) {
        unplacedPieces.push(...remainingPieces);
        break;
      }

      const minOffcutArea = this.unit === 'in' ? 36 : 10000; // >= 6x6 in = 36 sq in o 100x100 mm = 10000 mm²
      sheetsResult.push({
        sheetIndex: sheetIndex + 1,
        sheetInfo: sheetDef,
        width: sheetDef.width,
        height: sheetDef.height,
        margin: this.settings.margin,
        kerf: this.settings.kerf,
        unit: this.unit,
        placedPieces: packer.placedPieces,
        freeRects: packer.freeRects,
        cutLines: packer.cutLines,
        offcuts: packer.getOffcuts(minOffcutArea)
      });

      currentPieceList = remainingPieces;
      sheetIndex++;

      if (sheetIndex > 50) {
        unplacedPieces.push(...currentPieceList);
        break;
      }
    }

    const totalPiecesArea = piecesList.reduce((acc, p) => acc + p.area, 0);
    const unplacedArea = unplacedPieces.reduce((acc, p) => acc + p.area, 0);
    const placedArea = totalPiecesArea - unplacedArea;

    const totalBoardArea = sheetsResult.reduce((acc, s) => acc + (s.width * s.height), 0);
    const utilization = totalBoardArea > 0 ? (placedArea / totalBoardArea) * 100 : 0;
    const wasteArea = totalBoardArea - placedArea;

    return {
      strategyName,
      packerType,
      heuristic,
      splitRule,
      sheets: sheetsResult,
      unplacedPieces,
      totalSheetsUsed: sheetsResult.length,
      utilization,
      placedArea,
      totalBoardArea,
      wasteArea,
      totalPiecesCount: piecesList.length,
      placedPiecesCount: piecesList.length - unplacedPieces.length
    };
  }

  optimize() {
    const expandedPieces = this._expandPieces();
    if (expandedPieces.length === 0) {
      return {
        success: false,
        message: 'No hay piezas válidas para optimizar.',
        sheets: [],
        stats: null
      };
    }

    const sortStrategies = this._getSortStrategies(expandedPieces);
    const trials = [];

    const packerTypes = this.settings.algorithm === 'auto'
      ? ['guillotine', 'maxrects']
      : [this.settings.algorithm];

    const heuristics = ['BSSF', 'BAF', 'BLSF'];
    const splitRules = ['MINAS', 'SAS', 'LAS'];

    for (const packerType of packerTypes) {
      for (const sort of sortStrategies) {
        if (packerType === 'guillotine') {
          for (const heuristic of heuristics) {
            for (const splitRule of splitRules) {
              trials.push(this._runPackingTrial(sort.name, sort.items, packerType, heuristic, splitRule));
            }
          }
        } else {
          for (const heuristic of heuristics) {
            trials.push(this._runPackingTrial(sort.name, sort.items, packerType, heuristic, 'MINAS'));
          }
        }
      }
    }

    trials.sort((a, b) => {
      if (a.unplacedPieces.length !== b.unplacedPieces.length) {
        return a.unplacedPieces.length - b.unplacedPieces.length;
      }
      if (a.totalSheetsUsed !== b.totalSheetsUsed) {
        return a.totalSheetsUsed - b.totalSheetsUsed;
      }
      return b.utilization - a.utilization;
    });

    const bestTrial = trials[0];
    const stats = this._calculateDetailedStats(bestTrial, expandedPieces);
    const cuttingSequence = this._generateCuttingSequence(bestTrial.sheets);

    return {
      success: true,
      sheets: bestTrial.sheets,
      unplacedPieces: bestTrial.unplacedPieces,
      stats,
      cuttingSequence,
      algorithmUsed: `${bestTrial.packerType === 'guillotine' ? 'Guillotina (Sierra de mesa)' : 'MaxRects (Alta densidad)'} - ${bestTrial.heuristic} (${bestTrial.strategyName})`
    };
  }

  _calculateDetailedStats(trial, allPieces) {
    const isImperial = this.unit === 'in';
    const totalSheets = trial.sheets.length;
    const efficiency = trial.utilization;

    let totalBoardsAreaFormatted, totalPiecesAreaFormatted, wasteAreaFormatted, linearCutFormatted;

    if (isImperial) {
      // Pulgadas cuadradas a pies cuadrados (1 sq ft = 144 sq in)
      const totalBoardsSqFt = trial.totalBoardArea / 144;
      const totalPiecesSqFt = trial.placedArea / 144;
      const wasteSqFt = trial.wasteArea / 144;

      totalBoardsAreaFormatted = `${totalBoardsSqFt.toFixed(2)} sq ft`;
      totalPiecesAreaFormatted = `${totalPiecesSqFt.toFixed(2)} sq ft`;
      wasteAreaFormatted = `${wasteSqFt.toFixed(2)} sq ft`;

      let totalCutLengthIn = 0;
      for (const sheet of trial.sheets) {
        for (const cut of (sheet.cutLines || [])) {
          totalCutLengthIn += cut.length;
        }
        const piecesPerimeter = sheet.placedPieces.reduce((acc, p) => acc + 2 * (p.placedWidth + p.placedHeight), 0);
        totalCutLengthIn = Math.max(totalCutLengthIn, piecesPerimeter / 2);
      }
      linearCutFormatted = `${(totalCutLengthIn / 12).toFixed(1)} ft`;
    } else {
      // mm² a m²
      const totalBoardsAreaM2 = trial.totalBoardArea / 1_000_000;
      const totalPiecesAreaM2 = trial.placedArea / 1_000_000;
      const wasteAreaM2 = trial.wasteArea / 1_000_000;

      totalBoardsAreaFormatted = `${totalBoardsAreaM2.toFixed(3)} m²`;
      totalPiecesAreaFormatted = `${totalPiecesAreaM2.toFixed(3)} m²`;
      wasteAreaFormatted = `${wasteAreaM2.toFixed(3)} m²`;

      let totalCutLengthMm = 0;
      for (const sheet of trial.sheets) {
        for (const cut of (sheet.cutLines || [])) {
          totalCutLengthMm += cut.length;
        }
        const piecesPerimeter = sheet.placedPieces.reduce((acc, p) => acc + 2 * (p.placedWidth + p.placedHeight), 0);
        totalCutLengthMm = Math.max(totalCutLengthMm, piecesPerimeter / 2);
      }
      linearCutFormatted = `${(totalCutLengthMm / 1000).toFixed(2)} m`;
    }

    let totalCost = 0;
    for (const sheet of trial.sheets) {
      totalCost += (sheet.sheetInfo?.price || 0);
    }

    const minDim = isImperial ? 6 : 120; // 6 in o 120 mm
    const reusableOffcuts = [];
    trial.sheets.forEach((sheet, sIdx) => {
      sheet.offcuts.forEach((off) => {
        if (off.width >= minDim && off.height >= minDim) {
          const areaDisplay = isImperial 
            ? `${(off.width * off.height / 144).toFixed(2)} sq ft` 
            : `${(off.width * off.height / 1_000_000).toFixed(3)} m²`;
          reusableOffcuts.push({
            sheetIndex: sIdx + 1,
            sheetName: sheet.sheetInfo.name,
            width: off.width,
            height: off.height,
            areaDisplay,
            x: off.x,
            y: off.y
          });
        }
      });
    });

    return {
      unit: this.unit,
      totalSheets,
      totalBoardsArea: totalBoardsAreaFormatted,
      totalPiecesArea: totalPiecesAreaFormatted,
      wasteArea: wasteAreaFormatted,
      efficiencyPct: efficiency.toFixed(1),
      wastePct: (100 - efficiency).toFixed(1),
      linearCut: linearCutFormatted,
      totalCost: totalCost.toFixed(2),
      reusableOffcutsCount: reusableOffcuts.length,
      reusableOffcuts,
      unplacedCount: trial.unplacedPieces.length,
      totalPiecesRequested: allPieces.length,
      totalPiecesPlaced: trial.placedPiecesCount
    };
  }

  _generateCuttingSequence(sheets) {
    const sequenceBySheet = [];
    const unit = this.unit;

    sheets.forEach((sheet, index) => {
      const steps = [];
      let stepNum = 1;

      if (sheet.margin > 0) {
        steps.push({
          step: stepNum++,
          type: 'trim',
          title: `Saneado de bordes (${sheet.margin} ${unit})`,
          description: `Recortar ${sheet.margin} ${unit} en los 4 bordes del tablero para sanear defectos.`
        });
      }

      const sortedByX = [...sheet.placedPieces].sort((a, b) => a.x - b.x || a.y - b.y);
      const strips = [];
      for (const piece of sortedByX) {
        let strip = strips.find(s => Math.abs(s.x - piece.x) < 2);
        if (!strip) {
          strip = { x: piece.x, width: piece.placedWidth, pieces: [] };
          strips.push(strip);
        }
        strip.pieces.push(piece);
      }

      strips.forEach((strip, sIdx) => {
        const stripWFormatted = unit === 'in' ? strip.width.toFixed(2) : Math.round(strip.width);
        const stripXFormatted = unit === 'in' ? (strip.x + strip.width).toFixed(2) : Math.round(strip.x + strip.width);

        steps.push({
          step: stepNum++,
          type: 'rip',
          title: `Corte Principal #${sIdx + 1}: Franja a X = ${stripXFormatted} ${unit}`,
          description: `Cortar franja longitudinal de ancho ${stripWFormatted} ${unit} (contiene ${strip.pieces.length} pieza(s): ${strip.pieces.map(p => p.name).join(', ')}).`
        });

        strip.pieces.forEach((p) => {
          const pWFormatted = unit === 'in' ? p.placedWidth.toFixed(2) : Math.round(p.placedWidth);
          const pHFormatted = unit === 'in' ? p.placedHeight.toFixed(2) : Math.round(p.placedHeight);

          steps.push({
            step: stepNum++,
            type: 'cross',
            title: `  ↳ Corte Transversal: "${p.name}"`,
            description: `Seccionar pieza de ${pWFormatted} × ${pHFormatted} ${unit} ${p.rotated ? '(Rotada 90° por veta)' : ''}.`
          });
        });
      });

      sequenceBySheet.push({
        sheetIndex: index + 1,
        sheetName: sheet.sheetInfo.name,
        steps
      });
    });

    return sequenceBySheet;
  }
}
