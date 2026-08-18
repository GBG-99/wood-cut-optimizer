/**
 * CortePro DIY - Main Application Controller
 * Manejo de estado, unidades métricas e imperiales, nuevos proyectos y persistencia.
 */

import { CuttingOptimizer } from './engine/optimizer.js';
import { CanvasRenderer } from './renderer/canvasRenderer.js';
import { STANDARD_SHEETS_MM, STANDARD_SHEETS_IN, PROJECT_PRESETS } from './presets.js';

class AppController {
  constructor() {
    this.STORAGE_KEY = 'cortepro_diy_project_v2';
    this.THEME_KEY = 'cortepro_theme_mode';

    // Estado del proyecto
    this.project = this._loadInitialState();
    this.optimizationResult = null;
    this.currentSheetIndex = 0;
    this.selectedPieceId = null;

    this.canvasRenderer = null;
    this.init();
  }

  _loadInitialState() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.pieces && parsed.stockSheets) {
          if (!parsed.settings) parsed.settings = {};
          if (!parsed.settings.unit) parsed.settings.unit = 'mm';
          return parsed;
        }
      }
    } catch (e) {
      console.warn('No se pudo cargar desde localStorage:', e);
    }

    const defaultPreset = JSON.parse(JSON.stringify(PROJECT_PRESETS[0]));
    if (!defaultPreset.settings) defaultPreset.settings = {};
    defaultPreset.settings.unit = 'mm';
    return defaultPreset;
  }

  _saveState() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.project));
      this._showSaveIndicator();
    } catch (e) {
      console.error('Error al guardar en localStorage:', e);
    }
  }

  _showSaveIndicator() {
    const indicator = document.getElementById('save-indicator');
    if (indicator) {
      indicator.classList.remove('opacity-0');
      indicator.classList.add('opacity-100');
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => {
        indicator.classList.remove('opacity-100');
        indicator.classList.add('opacity-0');
      }, 1800);
    }
  }

  get unit() {
    return this.project.settings?.unit === 'in' ? 'in' : 'mm';
  }

  init() {
    this._initTheme();
    this._initCanvas();
    this._updateUnitUI();
    this._renderStockPresetsDropdown();
    this._renderStockList();
    this._renderPiecesList();
    this._renderSettings();
    this._initEventListeners();

    this.runOptimization();
  }

  _initTheme() {
    const savedTheme = localStorage.getItem(this.THEME_KEY) || 'dark';
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem(this.THEME_KEY, isDark ? 'dark' : 'light');
    if (this.canvasRenderer) {
      this.canvasRenderer.render();
    }
  }

  _initCanvas() {
    const canvas = document.getElementById('cutting-canvas');
    if (!canvas) return;

    this.canvasRenderer = new CanvasRenderer(canvas, {
      theme: 'wood',
      unit: this.unit,
      onHoverPiece: (piece, screenPos) => this._onCanvasHoverPiece(piece, screenPos),
      onClickPiece: (piece) => this._onCanvasClickPiece(piece)
    });
  }

  _onCanvasHoverPiece(piece, screenPos) {
    const tooltip = document.getElementById('canvas-tooltip');
    if (!tooltip) return;

    if (piece && screenPos) {
      const u = this.unit;
      const wFormatted = u === 'in' ? piece.placedWidth.toFixed(2) : Math.round(piece.placedWidth);
      const hFormatted = u === 'in' ? piece.placedHeight.toFixed(2) : Math.round(piece.placedHeight);
      const areaDisplay = u === 'in' 
        ? `${((piece.placedWidth * piece.placedHeight) / 144).toFixed(2)} sq ft` 
        : `${((piece.placedWidth * piece.placedHeight) / 1000000).toFixed(3)} m²`;

      tooltip.innerHTML = `
        <div class="font-bold text-amber-400 text-xs">${piece.name}</div>
        <div class="text-xs text-slate-100 font-mono mt-0.5">${wFormatted} × ${hFormatted} ${u} ${piece.rotated ? '<span class="text-amber-300 font-semibold">(Rotada 90°)</span>' : ''}</div>
        <div class="text-[10px] text-slate-400 mt-1">Área: ${areaDisplay}</div>
      `;
      tooltip.style.left = `${screenPos.x + 15}px`;
      tooltip.style.top = `${screenPos.y + 15}px`;
      tooltip.classList.remove('hidden');
    } else {
      tooltip.classList.add('hidden');
    }
  }

  _onCanvasClickPiece(piece) {
    if (!piece) return;
    this.selectedPieceId = piece.originalId || piece.id;
    this.canvasRenderer.setHighlightPiece(this.selectedPieceId);

    const rows = document.querySelectorAll('.piece-row');
    rows.forEach(r => {
      if (r.dataset.id === this.selectedPieceId) {
        r.classList.add('piece-row-highlight');
        r.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        r.classList.remove('piece-row-highlight');
      }
    });
  }

  /**
   * Cambia el sistema de unidades (mm <-> in) y convierte las medidas existentes
   */
  setUnit(newUnit) {
    if (newUnit !== 'mm' && newUnit !== 'in') return;
    const oldUnit = this.unit;
    if (oldUnit === newUnit) return;

    const toInches = newUnit === 'in';
    const factor = toInches ? (1 / 25.4) : 25.4;

    // Convertir tableros de origen
    this.project.stockSheets.forEach(s => {
      s.width = toInches ? parseFloat((s.width * factor).toFixed(2)) : Math.round(s.width * factor);
      s.height = toInches ? parseFloat((s.height * factor).toFixed(2)) : Math.round(s.height * factor);
    });

    // Convertir lista de piezas
    this.project.pieces.forEach(p => {
      p.width = toInches ? parseFloat((p.width * factor).toFixed(2)) : Math.round(p.width * factor);
      p.height = toInches ? parseFloat((p.height * factor).toFixed(2)) : Math.round(p.height * factor);
    });

    // Convertir parámetros de corte
    if (this.project.settings) {
      this.project.settings.unit = newUnit;
      this.project.settings.kerf = toInches 
        ? parseFloat((this.project.settings.kerf * factor).toFixed(3)) 
        : parseFloat((this.project.settings.kerf * factor).toFixed(1));
      this.project.settings.margin = toInches 
        ? parseFloat((this.project.settings.margin * factor).toFixed(2)) 
        : Math.round(this.project.settings.margin * factor);
    }

    if (this.canvasRenderer) {
      this.canvasRenderer.setUnit(newUnit);
    }

    this._saveState();
    this._updateUnitUI();
    this._renderStockPresetsDropdown();
    this._renderStockList();
    this._renderPiecesList();
    this._renderSettings();
    this.runOptimization();
  }

  _updateUnitUI() {
    const isMetric = this.unit === 'mm';
    const btnMetric = document.getElementById('unit-btn-metric');
    const btnImperial = document.getElementById('unit-btn-imperial');

    if (btnMetric && btnImperial) {
      if (isMetric) {
        btnMetric.className = "flex-1 py-1.5 px-3 rounded-lg font-extrabold text-xs bg-amber-500 text-white shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer";
        btnImperial.className = "flex-1 py-1.5 px-3 rounded-lg font-medium text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer";
      } else {
        btnMetric.className = "flex-1 py-1.5 px-3 rounded-lg font-medium text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer";
        btnImperial.className = "flex-1 py-1.5 px-3 rounded-lg font-extrabold text-xs bg-amber-500 text-white shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer";
      }
    }

    // Actualizar etiquetas de unidades en inputs
    document.querySelectorAll('.unit-label-text').forEach(el => {
      el.textContent = this.unit;
    });
  }

  /**
   * Crea un nuevo proyecto desde cero
   */
  createNewProject() {
    if (this.project.pieces && this.project.pieces.length > 0) {
      if (!confirm('¿Deseas crear un nuevo proyecto en blanco? Se iniciará una lista de piezas vacía.')) {
        return;
      }
    }

    const isImperial = this.unit === 'in';
    this.project = {
      id: `proj-${Date.now()}`,
      name: 'Nuevo Proyecto de Corte',
      description: 'Proyecto creado desde cero.',
      stockSheets: [
        {
          id: `s-${Date.now()}`,
          name: isImperial ? 'Tablero Estándar 4x8 ft (96×48 in)' : 'Tablero Estándar (2440×1220 mm)',
          width: isImperial ? 96 : 2440,
          height: isImperial ? 48 : 1220,
          quantity: 1,
          price: isImperial ? 45 : 45
        }
      ],
      pieces: [],
      settings: {
        kerf: isImperial ? 0.125 : 3,
        margin: isImperial ? 0.5 : 10,
        algorithm: 'auto',
        unit: this.unit
      }
    };

    this._saveState();
    this._renderStockList();
    this._renderPiecesList();
    this._renderSettings();
    this.runOptimization();
  }

  _renderStockPresetsDropdown() {
    const select = document.getElementById('stock-presets-select');
    if (!select) return;

    const list = this.unit === 'in' ? STANDARD_SHEETS_IN : STANDARD_SHEETS_MM;
    select.innerHTML = '<option value="">Añadir medida estándar comercial rápida...</option>';

    list.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.name;
      opt.textContent = item.name;
      select.appendChild(opt);
    });
  }

  _renderStockList() {
    const container = document.getElementById('stock-list-container');
    if (!container) return;

    container.innerHTML = '';
    const u = this.unit;

    this.project.stockSheets.forEach((sheet, idx) => {
      const card = document.createElement('div');
      card.className = 'p-3 bg-slate-100 dark:bg-slate-800/90 rounded-lg border border-slate-200 dark:border-slate-700/80 flex flex-col gap-2 relative';
      card.innerHTML = `
        <div class="flex items-center justify-between">
          <input type="text" value="${sheet.name || `Tablero #${idx + 1}`}" data-field="name" data-idx="${idx}"
            class="stock-input font-semibold text-xs bg-transparent border-b border-dashed border-slate-400 focus:border-amber-500 focus:outline-none text-slate-800 dark:text-slate-200 w-3/4" />
          <button type="button" data-action="delete-stock" data-idx="${idx}" class="text-rose-500 hover:text-rose-700 text-xs p-1" title="Eliminar tablero">
            ✕ Eliminar
          </button>
        </div>
        <div class="grid grid-cols-4 gap-2 text-xs">
          <div>
            <label class="text-[10px] text-slate-500 block">Largo (${u})</label>
            <input type="number" value="${sheet.width}" min="0.1" step="${u === 'in' ? '0.125' : '1'}" data-field="width" data-idx="${idx}"
              class="stock-input w-full p-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs text-center" />
          </div>
          <div>
            <label class="text-[10px] text-slate-500 block">Ancho (${u})</label>
            <input type="number" value="${sheet.height}" min="0.1" step="${u === 'in' ? '0.125' : '1'}" data-field="height" data-idx="${idx}"
              class="stock-input w-full p-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs text-center" />
          </div>
          <div>
            <label class="text-[10px] text-slate-500 block">Cant.</label>
            <input type="number" value="${sheet.quantity || 1}" min="1" max="100" data-field="quantity" data-idx="${idx}"
              class="stock-input w-full p-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs font-bold text-center" />
          </div>
          <div>
            <label class="text-[10px] text-slate-500 block">Precio</label>
            <input type="number" value="${sheet.price || 0}" min="0" step="0.5" data-field="price" data-idx="${idx}"
              class="stock-input w-full p-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs text-center" />
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('.stock-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        const field = e.target.dataset.field;
        let val = e.target.value;
        if (field === 'width' || field === 'height' || field === 'quantity' || field === 'price') {
          val = parseFloat(val) || 0;
        }
        this.project.stockSheets[idx][field] = val;
        this._saveState();
        this.runOptimization();
      });
    });

    container.querySelectorAll('[data-action="delete-stock"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        if (this.project.stockSheets.length <= 1) {
          alert('Debes mantener al menos un tablero en el inventario.');
          return;
        }
        this.project.stockSheets.splice(idx, 1);
        this._saveState();
        this._renderStockList();
        this.runOptimization();
      });
    });
  }

  _renderPiecesList() {
    const container = document.getElementById('pieces-list-container');
    const countBadge = document.getElementById('pieces-count-badge');
    if (!container) return;

    const totalCount = this.project.pieces.reduce((acc, p) => acc + (parseInt(p.quantity, 10) || 1), 0);
    if (countBadge) countBadge.textContent = `${totalCount} piezas`;

    container.innerHTML = '';
    const u = this.unit;

    if (this.project.pieces.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" class="p-6 text-center text-slate-400 dark:text-slate-500 text-xs italic">
            No hay piezas en el proyecto. Pulsa <strong class="text-amber-500">+ Añadir</strong> o <strong class="text-slate-600 dark:text-slate-300">📋 Pegar Lote</strong> para empezar.
          </td>
        </tr>
      `;
      return;
    }

    this.project.pieces.forEach((piece, idx) => {
      const row = document.createElement('tr');
      row.className = 'piece-row hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors border-b border-slate-200 dark:border-slate-700/60 text-xs';
      row.dataset.id = piece.id;

      row.innerHTML = `
        <td class="p-1.5 text-center">
          <input type="color" value="${piece.color || '#3b82f6'}" data-field="color" data-idx="${idx}"
            class="piece-input w-4 h-4 rounded cursor-pointer border-0 p-0 bg-transparent inline-block" title="Cambiar color de pieza" />
        </td>
        <td class="p-1.5">
          <input type="text" value="${piece.name}" data-field="name" data-idx="${idx}"
            class="piece-input w-full p-1 rounded bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-900 focus:border-amber-500 font-medium text-slate-800 dark:text-slate-200" />
        </td>
        <td class="p-1.5 text-center">
          <input type="number" value="${piece.width}" min="0.1" step="${u === 'in' ? '0.125' : '1'}" data-field="width" data-idx="${idx}"
            class="piece-input w-14 p-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-center font-mono text-xs" />
        </td>
        <td class="p-1.5 text-center">
          <input type="number" value="${piece.height}" min="0.1" step="${u === 'in' ? '0.125' : '1'}" data-field="height" data-idx="${idx}"
            class="piece-input w-14 p-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-center font-mono text-xs" />
        </td>
        <td class="p-1.5 text-center">
          <input type="number" value="${piece.quantity || 1}" min="1" max="500" data-field="quantity" data-idx="${idx}"
            class="piece-input w-10 p-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-center font-mono font-bold text-xs" />
        </td>
        <td class="p-1.5 text-center">
          <input type="checkbox" ${piece.allowRotation ? 'checked' : ''} data-field="allowRotation" data-idx="${idx}"
            class="piece-input rounded text-amber-500 focus:ring-amber-500 dark:bg-slate-900 border-slate-400 w-4 h-4 cursor-pointer"
            title="Marcar para permitir girar 90°. Desmarcar si la pieza debe respetar la veta de la madera" />
        </td>
        <td class="p-1.5 text-right whitespace-nowrap">
          <button type="button" data-action="duplicate-piece" data-idx="${idx}" class="text-slate-400 hover:text-amber-500 mr-1 p-0.5" title="Duplicar pieza">⧉</button>
          <button type="button" data-action="delete-piece" data-idx="${idx}" class="text-slate-400 hover:text-rose-500 p-0.5" title="Eliminar pieza">✕</button>
        </td>
      `;

      row.addEventListener('mouseenter', () => {
        if (this.canvasRenderer) {
          this.canvasRenderer.setHighlightPiece(piece.id);
        }
      });
      row.addEventListener('mouseleave', () => {
        if (this.canvasRenderer && !this.selectedPieceId) {
          this.canvasRenderer.setHighlightPiece(null);
        }
      });

      container.appendChild(row);
    });

    container.querySelectorAll('.piece-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        const field = e.target.dataset.field;
        let val;

        if (e.target.type === 'checkbox') {
          val = e.target.checked;
        } else if (field === 'width' || field === 'height' || field === 'quantity') {
          val = parseFloat(e.target.value) || 0;
        } else {
          val = e.target.value;
        }

        this.project.pieces[idx][field] = val;
        this._saveState();
        this.runOptimization();
      });
    });

    container.querySelectorAll('[data-action="delete-piece"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        this.project.pieces.splice(idx, 1);
        this._saveState();
        this._renderPiecesList();
        this.runOptimization();
      });
    });

    container.querySelectorAll('[data-action="duplicate-piece"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        const p = this.project.pieces[idx];
        const copy = {
          ...p,
          id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: `${p.name} (copia)`
        };
        this.project.pieces.splice(idx + 1, 0, copy);
        this._saveState();
        this._renderPiecesList();
        this.runOptimization();
      });
    });
  }

  _renderSettings() {
    const kerfInput = document.getElementById('setting-kerf');
    const marginInput = document.getElementById('setting-margin');
    const algoSelect = document.getElementById('setting-algorithm');
    const projectNameInput = document.getElementById('project-name-input');

    const isImperial = this.unit === 'in';

    if (kerfInput) {
      kerfInput.value = this.project.settings?.kerf ?? (isImperial ? 0.125 : 3);
      kerfInput.step = isImperial ? '0.03125' : '0.1';
    }
    if (marginInput) {
      marginInput.value = this.project.settings?.margin ?? (isImperial ? 0.5 : 10);
      marginInput.step = isImperial ? '0.125' : '1';
    }
    if (algoSelect) algoSelect.value = this.project.settings?.algorithm ?? 'auto';
    if (projectNameInput) projectNameInput.value = this.project.name || 'Mi Proyecto de Corte';
  }

  _initEventListeners() {
    // Toggle de unidades Métrico / Imperial
    document.getElementById('unit-btn-metric')?.addEventListener('click', () => this.setUnit('mm'));
    document.getElementById('unit-btn-imperial')?.addEventListener('click', () => this.setUnit('in'));

    // Botón Nuevo Proyecto
    document.getElementById('btn-new-project')?.addEventListener('click', () => this.createNewProject());

    document.getElementById('project-name-input')?.addEventListener('change', (e) => {
      this.project.name = e.target.value;
      this._saveState();
    });

    document.getElementById('setting-kerf')?.addEventListener('change', (e) => {
      this.project.settings.kerf = parseFloat(e.target.value) || 0;
      this._saveState();
      this.runOptimization();
    });

    document.getElementById('setting-margin')?.addEventListener('change', (e) => {
      this.project.settings.margin = parseFloat(e.target.value) || 0;
      this._saveState();
      this.runOptimization();
    });

    document.getElementById('setting-algorithm')?.addEventListener('change', (e) => {
      this.project.settings.algorithm = e.target.value;
      this._saveState();
      this.runOptimization();
    });

    document.getElementById('btn-add-stock')?.addEventListener('click', () => {
      const isImperial = this.unit === 'in';
      this.project.stockSheets.push({
        id: `s-${Date.now()}`,
        name: isImperial ? 'Tablero Estándar (96×48 in)' : 'Tablero Estándar (2440×1220 mm)',
        width: isImperial ? 96 : 2440,
        height: isImperial ? 48 : 1220,
        quantity: 1,
        price: 45
      });
      this._saveState();
      this._renderStockList();
      this.runOptimization();
    });

    document.getElementById('stock-presets-select')?.addEventListener('change', (e) => {
      const val = e.target.value;
      if (!val) return;
      const list = this.unit === 'in' ? STANDARD_SHEETS_IN : STANDARD_SHEETS_MM;
      const preset = list.find(s => s.name === val);
      if (preset) {
        this.project.stockSheets.push({
          id: `s-${Date.now()}`,
          name: preset.name,
          width: preset.width,
          height: preset.height,
          quantity: 1,
          price: preset.price
        });
        this._saveState();
        this._renderStockList();
        this.runOptimization();
      }
      e.target.value = '';
    });

    document.getElementById('btn-add-piece')?.addEventListener('click', () => {
      const count = this.project.pieces.length + 1;
      const isImperial = this.unit === 'in';
      this.project.pieces.push({
        id: `p-${Date.now()}`,
        name: `Pieza #${count}`,
        width: isImperial ? 24 : 600,
        height: isImperial ? 16 : 400,
        quantity: 1,
        allowRotation: true,
        color: '#3b82f6'
      });
      this._saveState();
      this._renderPiecesList();
      this.runOptimization();
    });

    document.getElementById('btn-optimize')?.addEventListener('click', () => {
      this.runOptimization();
    });

    document.getElementById('btn-prev-sheet')?.addEventListener('click', () => {
      if (this.currentSheetIndex > 0) {
        this.currentSheetIndex--;
        this._updateSheetView();
      }
    });

    document.getElementById('btn-next-sheet')?.addEventListener('click', () => {
      if (this.optimizationResult && this.currentSheetIndex < this.optimizationResult.sheets.length - 1) {
        this.currentSheetIndex++;
        this._updateSheetView();
      }
    });

    document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.canvasRenderer?.zoomIn());
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.canvasRenderer?.zoomOut());
    document.getElementById('btn-fit-screen')?.addEventListener('click', () => this.canvasRenderer?.fitToScreen());

    document.getElementById('canvas-theme-select')?.addEventListener('change', (e) => {
      this.canvasRenderer?.setTheme(e.target.value);
    });

    document.getElementById('btn-toggle-theme')?.addEventListener('click', () => this.toggleTheme());
    document.getElementById('btn-export-png')?.addEventListener('click', () => this.exportCurrentSheetPNG());
    document.getElementById('btn-print')?.addEventListener('click', () => this.printProject());

    this._initPresetsModal();
    this._initImportExportModal();
    this._initBulkAddModal();
  }

  _initPresetsModal() {
    const modal = document.getElementById('modal-presets');
    const openBtn = document.getElementById('btn-open-presets');
    const closeBtn = document.getElementById('btn-close-presets');
    const container = document.getElementById('presets-list-container');

    if (!modal || !openBtn) return;

    openBtn.addEventListener('click', () => {
      container.innerHTML = '';
      PROJECT_PRESETS.forEach(preset => {
        const card = document.createElement('div');
        card.className = 'p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between';
        card.innerHTML = `
          <div>
            <div class="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1">${preset.name}</div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">${preset.description}</p>
            <div class="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
              <div>📦 <strong>${preset.pieces.length}</strong> tipos de piezas</div>
              <div>🪵 Tablero: <strong>${preset.stockSheets[0]?.name || 'Estándar'}</strong></div>
            </div>
          </div>
          <button type="button" class="mt-4 w-full py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg text-xs transition-colors">
            Cargar este Proyecto
          </button>
        `;
        card.addEventListener('click', () => {
          if (confirm(`¿Deseas cargar el proyecto "${preset.name}"? Se sustituirán los datos actuales.`)) {
            const copy = JSON.parse(JSON.stringify(preset));
            copy.settings.unit = 'mm'; // Presets base están en mm
            this.project = copy;
            if (this.canvasRenderer) this.canvasRenderer.setUnit('mm');
            this._saveState();
            this._updateUnitUI();
            this._renderStockPresetsDropdown();
            this._renderStockList();
            this._renderPiecesList();
            this._renderSettings();
            this.runOptimization();
            modal.classList.add('hidden');
          }
        });
        container.appendChild(card);
      });
      modal.classList.remove('hidden');
    });

    closeBtn?.addEventListener('click', () => modal.classList.add('hidden'));
  }

  _initImportExportModal() {
    const modal = document.getElementById('modal-import-export');
    const openBtn = document.getElementById('btn-open-import-export');
    const closeBtn = document.getElementById('btn-close-import-export');

    if (!modal || !openBtn) return;

    openBtn.addEventListener('click', () => {
      const jsonArea = document.getElementById('export-json-area');
      if (jsonArea) {
        jsonArea.value = JSON.stringify(this.project, null, 2);
      }
      modal.classList.remove('hidden');
    });

    closeBtn?.addEventListener('click', () => modal.classList.add('hidden'));

    document.getElementById('btn-download-json')?.addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.project, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${(this.project.name || 'proyecto_corte').replace(/\s+/g, '_')}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });

    document.getElementById('btn-apply-import-json')?.addEventListener('click', () => {
      const jsonArea = document.getElementById('export-json-area');
      try {
        const parsed = JSON.parse(jsonArea.value);
        if (parsed.pieces && parsed.stockSheets) {
          if (!parsed.settings) parsed.settings = {};
          if (!parsed.settings.unit) parsed.settings.unit = 'mm';
          this.project = parsed;
          if (this.canvasRenderer) this.canvasRenderer.setUnit(this.unit);
          this._saveState();
          this._updateUnitUI();
          this._renderStockPresetsDropdown();
          this._renderStockList();
          this._renderPiecesList();
          this._renderSettings();
          this.runOptimization();
          modal.classList.add('hidden');
          alert('Proyecto importado con éxito.');
        } else {
          alert('El formato JSON no contiene piezas o tableros válidos.');
        }
      } catch (err) {
        alert('Error al procesar el JSON: ' + err.message);
      }
    });

    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      const u = this.unit;
      let csv = `Nombre,Largo_${u},Ancho_${u},Cantidad,Permitir_Rotacion\n`;
      this.project.pieces.forEach(p => {
        csv += `"${p.name.replace(/"/g, '""')}",${p.width},${p.height},${p.quantity || 1},${p.allowRotation ? 1 : 0}\n`;
      });
      const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `despiece_${(this.project.name || 'proyecto').replace(/\s+/g, '_')}_${u}.csv`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  }

  _initBulkAddModal() {
    const modal = document.getElementById('modal-bulk-add');
    const openBtn = document.getElementById('btn-open-bulk-add');
    const closeBtn = document.getElementById('btn-close-bulk-add');
    const processBtn = document.getElementById('btn-process-bulk-add');

    if (!modal || !openBtn) return;

    openBtn.addEventListener('click', () => modal.classList.remove('hidden'));
    closeBtn?.addEventListener('click', () => modal.classList.add('hidden'));

    processBtn?.addEventListener('click', () => {
      const text = document.getElementById('bulk-add-textarea')?.value || '';
      const lines = text.split('\n');
      const newPieces = [];

      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        const parts = trimmed.split(/[\t,;]+/).map(p => p.trim());

        if (parts.length >= 3) {
          const name = parts[0] || `Pieza ${idx + 1}`;
          const width = parseFloat(parts[1]) || 0;
          const height = parseFloat(parts[2]) || 0;
          const qty = parts[3] ? parseInt(parts[3], 10) || 1 : 1;
          const rot = parts[4] !== undefined ? !['0', 'false', 'no', 'f'].includes(parts[4].toLowerCase()) : true;

          if (width > 0 && height > 0) {
            newPieces.push({
              id: `p-bulk-${Date.now()}-${idx}`,
              name,
              width,
              height,
              quantity: qty,
              allowRotation: rot,
              color: '#3b82f6'
            });
          }
        }
      });

      if (newPieces.length > 0) {
        const mode = document.querySelector('input[name="bulk-mode"]:checked')?.value || 'append';
        if (mode === 'replace') {
          this.project.pieces = newPieces;
        } else {
          this.project.pieces.push(...newPieces);
        }
        this._saveState();
        this._renderPiecesList();
        this.runOptimization();
        modal.classList.add('hidden');
      } else {
        alert('No se detectaron líneas válidas con formato: Nombre, Largo, Ancho, Cantidad');
      }
    });
  }

  runOptimization() {
    const optimizer = new CuttingOptimizer(
      this.project.stockSheets,
      this.project.pieces,
      this.project.settings
    );

    const result = optimizer.optimize();
    this.optimizationResult = result;
    this.currentSheetIndex = 0;

    this._renderStats(result);
    this._updateSheetView();
    this._renderOffcutsAndSequence(result);
  }

  _renderStats(result) {
    if (!result || !result.success) {
      document.getElementById('stat-efficiency').textContent = '0%';
      document.getElementById('stat-sheets-count').textContent = '0';
      document.getElementById('stat-waste-area').textContent = `0 ${this.unit === 'in' ? 'sq ft' : 'm²'}`;
      document.getElementById('stat-linear-meters').textContent = `0 ${this.unit === 'in' ? 'ft' : 'm'}`;
      return;
    }

    const stats = result.stats;
    document.getElementById('stat-efficiency').textContent = `${stats.efficiencyPct}%`;
    document.getElementById('stat-sheets-count').textContent = `${stats.totalSheets}`;
    document.getElementById('stat-waste-area').textContent = `${stats.wasteArea} (${stats.wastePct}%)`;
    document.getElementById('stat-linear-meters').textContent = `${stats.linearCut}`;

    const algoBadge = document.getElementById('stat-algorithm-used');
    if (algoBadge) {
      algoBadge.textContent = result.algorithmUsed;
    }

    const unplacedContainer = document.getElementById('unplaced-warning-container');
    if (unplacedContainer) {
      if (result.unplacedPieces && result.unplacedPieces.length > 0) {
        unplacedContainer.classList.remove('hidden');
        unplacedContainer.innerHTML = `
          <div class="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-lg text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
            <span class="text-base">⚠️</span>
            <span><strong>${result.unplacedPieces.length} pieza(s) no caben</strong> en los tableros disponibles: ${result.unplacedPieces.map(p => `${p.name} (${p.width}×${p.height} ${this.unit})`).join(', ')}. Aumenta el tamaño del tablero o reduce las piezas.</span>
          </div>
        `;
      } else {
        unplacedContainer.classList.add('hidden');
      }
    }
  }

  _updateSheetView() {
    if (!this.optimizationResult || !this.optimizationResult.sheets || this.optimizationResult.sheets.length === 0) {
      this.canvasRenderer?.setSheet(null);
      document.getElementById('sheet-counter-badge').textContent = '0 de 0';
      document.getElementById('sheet-title-display').textContent = 'Sin tableros activos';
      return;
    }

    const sheets = this.optimizationResult.sheets;
    if (this.currentSheetIndex >= sheets.length) {
      this.currentSheetIndex = 0;
    }

    const currentSheet = sheets[this.currentSheetIndex];
    const u = this.unit;
    const wFormatted = u === 'in' ? currentSheet.width.toFixed(2) : Math.round(currentSheet.width);
    const hFormatted = u === 'in' ? currentSheet.height.toFixed(2) : Math.round(currentSheet.height);

    document.getElementById('sheet-counter-badge').textContent = `Tablero ${this.currentSheetIndex + 1} de ${sheets.length}`;
    document.getElementById('sheet-title-display').textContent = `${currentSheet.sheetInfo.name} (${wFormatted} × ${hFormatted} ${u})`;

    const prevBtn = document.getElementById('btn-prev-sheet');
    const nextBtn = document.getElementById('btn-next-sheet');
    if (prevBtn) prevBtn.disabled = this.currentSheetIndex === 0;
    if (nextBtn) nextBtn.disabled = this.currentSheetIndex === sheets.length - 1;

    this.canvasRenderer?.setSheet(currentSheet);
    this._renderSheetPiecesTable(currentSheet);
  }

  _renderSheetPiecesTable(sheet) {
    const tbody = document.getElementById('sheet-pieces-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const u = this.unit;

    sheet.placedPieces.forEach((piece, idx) => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700/50 text-xs transition-colors cursor-pointer';
      
      const wFormatted = u === 'in' ? piece.placedWidth.toFixed(2) : Math.round(piece.placedWidth);
      const hFormatted = u === 'in' ? piece.placedHeight.toFixed(2) : Math.round(piece.placedHeight);
      const xFormatted = u === 'in' ? piece.x.toFixed(1) : Math.round(piece.x);
      const yFormatted = u === 'in' ? piece.y.toFixed(1) : Math.round(piece.y);

      row.innerHTML = `
        <td class="p-1.5 text-center font-bold text-slate-400">${idx + 1}</td>
        <td class="p-1.5">
          <span class="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style="background-color: ${piece.color}"></span>
          <span class="font-semibold text-slate-800 dark:text-slate-200">${piece.name}</span>
        </td>
        <td class="p-1.5 font-mono text-center">${wFormatted} × ${hFormatted}</td>
        <td class="p-1.5 text-center font-mono text-slate-500">${xFormatted}, ${yFormatted}</td>
        <td class="p-1.5 text-center">
          ${piece.rotated ? '<span class="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold">Rotada 90°</span>' : '<span class="text-slate-400 text-[10px]">Normal</span>'}
        </td>
      `;

      row.addEventListener('mouseenter', () => {
        this.canvasRenderer?.setHighlightPiece(piece.id);
      });
      row.addEventListener('mouseleave', () => {
        this.canvasRenderer?.setHighlightPiece(null);
      });

      tbody.appendChild(row);
    });
  }

  _renderOffcutsAndSequence(result) {
    const offcutsContainer = document.getElementById('offcuts-cards-container');
    const sequenceContainer = document.getElementById('sequence-steps-container');
    const u = this.unit;

    if (offcutsContainer) {
      offcutsContainer.innerHTML = '';
      if (!result.stats || result.stats.reusableOffcuts.length === 0) {
        offcutsContainer.innerHTML = `<p class="text-xs text-slate-500 italic p-3">No hay retales grandes reutilizables en este corte.</p>`;
      } else {
        result.stats.reusableOffcuts.forEach((off, idx) => {
          const card = document.createElement('div');
          card.className = 'p-2.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg text-xs';
          const wF = u === 'in' ? off.width.toFixed(2) : Math.round(off.width);
          const hF = u === 'in' ? off.height.toFixed(2) : Math.round(off.height);
          const xF = u === 'in' ? off.x.toFixed(1) : Math.round(off.x);
          const yF = u === 'in' ? off.y.toFixed(1) : Math.round(off.y);

          card.innerHTML = `
            <div class="flex items-center justify-between font-bold text-amber-800 dark:text-amber-300 mb-1">
              <span>Retal #${idx + 1} (Tablero ${off.sheetIndex})</span>
              <span class="text-[10px] font-mono">${off.areaDisplay}</span>
            </div>
            <div class="font-mono text-slate-700 dark:text-slate-300 font-semibold text-xs">
              ${wF} × ${hF} ${u}
            </div>
            <div class="text-[10px] text-slate-500 mt-0.5">Ubicación X: ${xF}, Y: ${yF} ${u}</div>
          `;
          offcutsContainer.appendChild(card);
        });
      }
    }

    if (sequenceContainer) {
      sequenceContainer.innerHTML = '';
      if (!result.cuttingSequence || result.cuttingSequence.length === 0) {
        sequenceContainer.innerHTML = '<p class="text-xs text-slate-500 italic p-3">Añade piezas y optimiza para ver la guía de corte.</p>';
      } else {
        result.cuttingSequence.forEach(sheetSeq => {
          const block = document.createElement('div');
          block.className = 'mb-4';
          block.innerHTML = `
            <h4 class="font-bold text-xs text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <span>🪚</span>
              <span>Tablero #${sheetSeq.sheetIndex}: ${sheetSeq.sheetName}</span>
            </h4>
            <div class="space-y-1.5 pl-2 border-l-2 border-amber-500/50">
              ${sheetSeq.steps.map(s => `
                <div class="text-xs ${s.type === 'rip' ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400 pl-2'}">
                  <span>${s.step}.</span> <span>${s.title}</span>
                  <div class="text-[11px] text-slate-500 dark:text-slate-400">${s.description}</div>
                </div>
              `).join('')}
            </div>
          `;
          sequenceContainer.appendChild(block);
        });
      }
    }
  }

  exportCurrentSheetPNG() {
    if (!this.canvasRenderer) return;
    const dataUrl = this.canvasRenderer.exportToPNG();
    if (!dataUrl) return;

    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataUrl);
    downloadAnchor.setAttribute("download", `plano_corte_tablero_${this.currentSheetIndex + 1}.png`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  printProject() {
    if (!this.optimizationResult || !this.optimizationResult.sheets || this.optimizationResult.sheets.length === 0) {
      alert('Optimiza primero el despiece antes de imprimir.');
      return;
    }

    const printContainer = document.getElementById('print-section');
    if (!printContainer) return;
    const u = this.unit;

    let printHTML = `
      <div class="print-page">
        <div class="print-header">
          <div>
            <h1 style="font-size: 20pt; font-weight: bold; margin: 0;">Plan de Corte - ${this.project.name || 'CortePro DIY'}</h1>
            <p style="margin: 4px 0 0 0; color: #555; font-size: 10pt;">Generado por CortePro DIY • Fecha: ${new Date().toLocaleDateString('es-ES')} • Sistema: ${u === 'in' ? 'Imperial (Pulgadas / in)' : 'Métrico Internacional (mm)'}</p>
          </div>
          <div style="text-align: right; font-size: 10pt;">
            <strong>Aprovechamiento: ${this.optimizationResult.stats.efficiencyPct}%</strong><br>
            Tableros: ${this.optimizationResult.stats.totalSheets} | Corte total: ${this.optimizationResult.stats.linearCut}
          </div>
        </div>

        <h3 style="font-size: 13pt; font-weight: bold; margin-top: 16px;">1. Lista de Despiece y Control de Taller</h3>
        <table class="print-table">
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">✓</th>
              <th>Pieza / Etiqueta</th>
              <th style="text-align: center;">Largo (${u})</th>
              <th style="text-align: center;">Ancho (${u})</th>
              <th style="text-align: center;">Cant.</th>
              <th style="text-align: center;">Veta / Rotar</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            ${this.project.pieces.map(p => `
              <tr>
                <td style="text-align: center;"><div class="print-checkbox"></div></td>
                <td><strong>${p.name}</strong></td>
                <td style="text-align: center; font-family: monospace;">${p.width}</td>
                <td style="text-align: center; font-family: monospace;">${p.height}</td>
                <td style="text-align: center; font-weight: bold;">${p.quantity || 1}</td>
                <td style="text-align: center;">${p.allowRotation ? 'Permite giro' : 'Veta estricta'}</td>
                <td></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 20px; font-size: 9pt; color: #666;">
          <strong>Parámetros de corte:</strong> Grosor de sierra (Kerf): ${this.project.settings.kerf} ${u} | Saneado perimetral: ${this.project.settings.margin} ${u}
        </div>
      </div>
    `;

    this.optimizationResult.sheets.forEach((sheet, sIdx) => {
      this.canvasRenderer.setSheet(sheet);
      const imgData = this.canvasRenderer.exportToPNG();

      printHTML += `
        <div class="print-page">
          <div class="print-header">
            <div>
              <h2 style="font-size: 16pt; font-weight: bold; margin: 0;">Plano de Corte - Tablero #${sIdx + 1}</h2>
              <p style="margin: 4px 0 0 0; color: #555; font-size: 10pt;">${sheet.sheetInfo.name} (${sheet.width} × ${sheet.height} ${u})</p>
            </div>
            <div style="text-align: right; font-size: 10pt;">
              Piezas en tablero: ${sheet.placedPieces.length}
            </div>
          </div>

          <img src="${imgData}" class="print-sheet-image" style="width: 100%; border: 1px solid #000;" />

          <h4 style="font-size: 11pt; font-weight: bold; margin-top: 12px; margin-bottom: 4px;">Piezas colocadas en este tablero:</h4>
          <table class="print-table" style="font-size: 9pt;">
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">✓</th>
                <th>Nombre</th>
                <th style="text-align: center;">Medidas (${u})</th>
                <th style="text-align: center;">Posición X, Y</th>
                <th style="text-align: center;">Orientación</th>
              </tr>
            </thead>
            <tbody>
              ${sheet.placedPieces.map(p => `
                <tr>
                  <td style="text-align: center;"><div class="print-checkbox"></div></td>
                  <td>${p.name}</td>
                  <td style="text-align: center; font-family: monospace;">${p.placedWidth} × ${p.placedHeight}</td>
                  <td style="text-align: center; font-family: monospace;">${p.x}, ${p.y}</td>
                  <td style="text-align: center;">${p.rotated ? 'Rotada 90°' : 'Normal'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    });

    printContainer.innerHTML = printHTML;

    const currentSheet = this.optimizationResult.sheets[this.currentSheetIndex];
    this.canvasRenderer.setSheet(currentSheet);

    setTimeout(() => {
      window.print();
    }, 200);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});
