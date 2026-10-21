import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MousePointerClick,
  Trash2,
  RotateCcw,
  Save,
  X,
  Maximize2,
  Type,
  Palette,
  Layers,
  Eye,
  ArrowUp,
  CheckCircle2,
  Code,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Hand,
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  Minus,
  Plus,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  db,
  isUserAdmin,
  handleFirestoreError,
  OperationType,
} from '../firebase';

export interface ElementUiOverride {
  selector: string;
  label: string;
  tagName: string;
  hidden?: boolean;
  customText?: string;
  widthPx?: number | null;
  heightPx?: number | null;
  scale?: number;
  translateX?: number;
  translateY?: number;
  fontSizePx?: number | null;
  paddingXPx?: number | null;
  paddingYPx?: number | null;
  backgroundColor?: string;
  textColor?: string;
  borderRadiusPx?: number | null;
  borderColor?: string;
  borderWidthPx?: number | null;
  opacity?: number;
  customCss?: string;
}

export type UiOverridesMap = Record<string, ElementUiOverride>;

const LOCAL_UI_OVERRIDES_KEY = 'zappy_visual_ui_overrides_v1';

/**
 * Generates a deterministic CSS selector path for any DOM element outside the Visual Editor UI.
 */
export function getStableElementSelector(el: HTMLElement): string {
  if (el.id && !el.id.startsWith('headlessui')) {
    return `#${CSS.escape(el.id)}`;
  }

  const parts: string[] = [];
  let current: HTMLElement | null = el;
  let depth = 0;

  while (
    current &&
    current !== document.body &&
    current.id !== 'root' &&
    depth < 7
  ) {
    const tag = current.tagName.toLowerCase();
    const ariaLabel = current.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.length <= 48 && depth === 0) {
      parts.unshift(`${tag}[aria-label="${CSS.escape(ariaLabel)}"]`);
      break;
    }

    const parent: HTMLElement | null = current.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }

    const siblings = Array.from(parent.children).filter(
      (child) =>
        child.tagName === current!.tagName &&
        !child.hasAttribute('data-zappy-editor')
    );

    if (siblings.length <= 1) {
      parts.unshift(tag);
    } else {
      const idx = Array.from(parent.children).indexOf(current) + 1;
      parts.unshift(`${tag}:nth-child(${idx})`);
    }

    current = parent;
    depth++;
  }

  return `#root ${parts.join(' > ')}`;
}

export function getElementReadableLabel(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const aria = el.getAttribute('aria-label');
  if (aria) return `${tag.toUpperCase()} (${aria.slice(0, 22)})`;
  const text = (el.innerText || el.textContent || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (text) return `${tag.toUpperCase()} "${text.slice(0, 20)}"`;
  return `${tag.toUpperCase()} Element`;
}

/**
 * Builds the global <style> sheet for all active ElementUiOverrides
 */
function buildOverridesCss(overrides: UiOverridesMap): string {
  const rules: string[] = [];

  for (const item of Object.values(overrides)) {
    if (!item || !item.selector) continue;
    const decls: string[] = [];

    if (item.hidden) {
      decls.push('display: none !important;');
    }
    if (typeof item.widthPx === 'number' && item.widthPx > 0) {
      decls.push(`width: ${item.widthPx}px !important;`);
      decls.push(`max-width: none !important;`);
    }
    if (typeof item.heightPx === 'number' && item.heightPx > 0) {
      decls.push(`height: ${item.heightPx}px !important;`);
      decls.push(`min-height: ${item.heightPx}px !important;`);
    }

    const tx = item.translateX || 0;
    const ty = item.translateY || 0;
    const sc = item.scale ?? 1;
    if (tx !== 0 || ty !== 0 || sc !== 1) {
      decls.push(
        `transform: translate(${tx}px, ${ty}px) scale(${sc}) !important;`
      );
    }

    if (typeof item.fontSizePx === 'number' && item.fontSizePx > 0) {
      decls.push(`font-size: ${item.fontSizePx}px !important;`);
    }
    if (typeof item.paddingXPx === 'number' && item.paddingXPx >= 0) {
      decls.push(`padding-left: ${item.paddingXPx}px !important;`);
      decls.push(`padding-right: ${item.paddingXPx}px !important;`);
    }
    if (typeof item.paddingYPx === 'number' && item.paddingYPx >= 0) {
      decls.push(`padding-top: ${item.paddingYPx}px !important;`);
      decls.push(`padding-bottom: ${item.paddingYPx}px !important;`);
    }
    if (item.backgroundColor) {
      decls.push(`background: ${item.backgroundColor} !important;`);
      decls.push(`background-color: ${item.backgroundColor} !important;`);
    }
    if (item.textColor) {
      decls.push(`color: ${item.textColor} !important;`);
    }
    if (typeof item.borderRadiusPx === 'number' && item.borderRadiusPx >= 0) {
      decls.push(`border-radius: ${item.borderRadiusPx}px !important;`);
    }
    if (item.borderColor) {
      decls.push(`border-color: ${item.borderColor} !important;`);
      decls.push(`border-style: solid !important;`);
    }
    if (typeof item.borderWidthPx === 'number' && item.borderWidthPx >= 0) {
      decls.push(`border-width: ${item.borderWidthPx}px !important;`);
      decls.push(`border-style: solid !important;`);
    }
    if (
      typeof item.opacity === 'number' &&
      item.opacity >= 0 &&
      item.opacity <= 1
    ) {
      decls.push(`opacity: ${item.opacity} !important;`);
    }
    if (item.customCss && item.customCss.trim()) {
      decls.push(item.customCss.trim());
    }

    if (decls.length > 0) {
      rules.push(`${item.selector} { ${decls.join(' ')} }`);
    }
  }

  return rules.join('\n');
}

/**
 * Applies customText overrides directly to matching DOM nodes
 */
function applyDomTextOverrides(overrides: UiOverridesMap) {
  for (const item of Object.values(overrides)) {
    if (!item?.selector || item.customText === undefined) continue;
    try {
      const nodes = document.querySelectorAll<HTMLElement>(item.selector);
      nodes.forEach((node) => {
        if (node.hasAttribute('data-zappy-editor')) return;
        const textSpan = node.querySelector('span');
        if (textSpan && textSpan.children.length === 0) {
          if (textSpan.textContent !== item.customText) {
            textSpan.textContent = item.customText!;
          }
        } else if (node.children.length === 0) {
          if (node.textContent !== item.customText) {
            node.textContent = item.customText!;
          }
        } else {
          const textNode = Array.from(node.childNodes).find(
            (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()
          );
          if (textNode) {
            textNode.textContent = item.customText!;
          } else if (node.innerText !== item.customText) {
            node.innerText = item.customText!;
          }
        }
      });
    } catch {
      // Ignore invalid selector
    }
  }
}

interface VisualUiEditorProps {
  isActive: boolean;
  currentUser: User | null;
  onCloseEditor: () => void;
}

const COLOR_PRESETS = [
  '#B892FF',
  '#FF8A3D',
  '#10B981',
  '#EF4444',
  '#3B82F6',
  '#F59E0B',
  '#EC4899',
  '#FFFFFF',
  '#1A1625',
  '#0F0C18',
  'transparent',
];

export const VisualUiEditor: React.FC<VisualUiEditorProps> = ({
  isActive,
  currentUser,
  onCloseEditor,
}) => {
  const isAdmin = isUserAdmin(currentUser?.email, currentUser?.emailVerified);

  const [overrides, setOverrides] = useState<UiOverridesMap>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_UI_OVERRIDES_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Single unified panel states (no two overlapping panels!)
  const [inspectEnabled, setInspectEnabled] = useState<boolean>(true);
  const [panelMinimized, setPanelMinimized] = useState<boolean>(false);
  const [dockPosition, setDockPosition] = useState<'bottom' | 'top'>('bottom');

  const [selectedSelector, setSelectedSelector] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(
    null
  );
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(
    null
  );
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const [selectedRect, setSelectedRect] = useState<DOMRect | null>(null);
  const [activeTab, setActiveTab] = useState<
    'size' | 'style' | 'text' | 'manage'
  >('size');
  const [isSavingCloud, setIsSavingCloud] = useState<boolean>(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  // Unified pointer/touch drag-resize & move state
  const dragStateRef = useRef<{
    mode: 'width' | 'height' | 'both' | 'move';
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startTx: number;
    startTy: number;
    selector: string;
    label: string;
    tagName: string;
  } | null>(null);

  // 1. Subscribe to Cloud Firestore /ui_config/global
  useEffect(() => {
    const docRef = doc(db, 'ui_config', 'global');
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.overridesJson === 'string') {
            try {
              const parsed = JSON.parse(data.overridesJson);
              if (parsed && typeof parsed === 'object') {
                setOverrides(parsed);
                localStorage.setItem(
                  LOCAL_UI_OVERRIDES_KEY,
                  JSON.stringify(parsed)
                );
              }
            } catch {
              // Ignore parse error
            }
          }
        }
      },
      () => {
        // Ignore read error if offline
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Apply CSS stylesheet and DOM text overrides whenever `overrides` changes
  useEffect(() => {
    let styleEl = document.getElementById(
      'zappy-live-ui-overrides'
    ) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'zappy-live-ui-overrides';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = buildOverridesCss(overrides);
    applyDomTextOverrides(overrides);

    try {
      localStorage.setItem(LOCAL_UI_OVERRIDES_KEY, JSON.stringify(overrides));
    } catch {
      // Ignore storage error
    }

    const hasCustomText = Object.values(overrides).some(
      (item) => item && item.customText !== undefined
    );
    if (!hasCustomText) {
      return;
    }

    const observer = new MutationObserver(() => {
      applyDomTextOverrides(overrides);
    });
    const rootEl = document.getElementById('root');
    if (rootEl) {
      observer.observe(rootEl, { childList: true, subtree: false });
    }
    return () => observer.disconnect();
  }, [overrides]);

  // 3. Keep bounding boxes synced when scrolling or resizing
  const refreshRects = useCallback(() => {
    if (hoveredElement && document.body.contains(hoveredElement)) {
      setHoverRect(hoveredElement.getBoundingClientRect());
    } else {
      setHoverRect(null);
    }
    if (selectedElement && document.body.contains(selectedElement)) {
      setSelectedRect(selectedElement.getBoundingClientRect());
    } else if (selectedSelector) {
      try {
        const found = document.querySelector<HTMLElement>(selectedSelector);
        if (found) {
          setSelectedElement(found);
          setSelectedRect(found.getBoundingClientRect());
        } else {
          setSelectedRect(null);
        }
      } catch {
        setSelectedRect(null);
      }
    } else {
      setSelectedRect(null);
    }
  }, [hoveredElement, selectedElement, selectedSelector]);

  useEffect(() => {
    if (!isActive) return;
    refreshRects();
    window.addEventListener('scroll', refreshRects, true);
    window.addEventListener('resize', refreshRects);
    return () => {
      window.removeEventListener('scroll', refreshRects, true);
      window.removeEventListener('resize', refreshRects);
    };
  }, [isActive, overrides, refreshRects]);

  // 4. Point-and-Click / Tap Element Inspector Listeners
  useEffect(() => {
    if (!isActive || !isAdmin || !inspectEnabled) {
      setHoveredElement(null);
      setHoverRect(null);
      return;
    }

    const isInsideEditorUi = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return true;
      return Boolean(target.closest('[data-zappy-editor="true"]'));
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (dragStateRef.current) return;
      if (isInsideEditorUi(e.target)) {
        setHoveredElement(null);
        setHoverRect(null);
        return;
      }
      const target = e.target as HTMLElement;
      if (target === document.body || target === document.documentElement) {
        return;
      }
      setHoveredElement(target);
      setHoverRect(target.getBoundingClientRect());
    };

    const handleClickCapture = (e: MouseEvent) => {
      if (isInsideEditorUi(e.target)) return;
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as HTMLElement;
      const selector = getStableElementSelector(target);
      const rect = target.getBoundingClientRect();
      setSelectedElement(target);
      setSelectedSelector(selector);
      setSelectedRect(rect);
      setPanelMinimized(false);

      // Auto-flip dock to top if user tapped an element in the bottom 45% of the screen on mobile!
      if (window.innerWidth < 768) {
        if (rect.top > window.innerHeight * 0.52) {
          setDockPosition('top');
        } else {
          setDockPosition('bottom');
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClickCapture, true);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClickCapture, true);
    };
  }, [isActive, isAdmin, inspectEnabled]);

  // 5. Handle Both Mouse AND Touch Drag-to-Resize & Drag-to-Move
  useEffect(() => {
    if (!isActive) return;

    const applyDragDelta = (clientX: number, clientY: number) => {
      const drag = dragStateRef.current;
      if (!drag) return;

      const dx = clientX - drag.startX;
      const dy = clientY - drag.startY;

      setOverrides((prev) => {
        const existing: ElementUiOverride = prev[drag.selector] || {
          selector: drag.selector,
          label: drag.label,
          tagName: drag.tagName,
        };

        const updated: ElementUiOverride = { ...existing };
        if (drag.mode === 'width' || drag.mode === 'both') {
          updated.widthPx = Math.max(24, Math.round(drag.startWidth + dx));
        }
        if (drag.mode === 'height' || drag.mode === 'both') {
          updated.heightPx = Math.max(20, Math.round(drag.startHeight + dy));
        }
        if (drag.mode === 'move') {
          updated.translateX = Math.round(drag.startTx + dx);
          updated.translateY = Math.round(drag.startTy + dy);
        }

        return {
          ...prev,
          [drag.selector]: updated,
        };
      });
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current) return;
      applyDragDelta(e.clientX, e.clientY);
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (!dragStateRef.current || e.touches.length === 0) return;
      e.preventDefault();
      applyDragDelta(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handleEndDrag = () => {
      if (dragStateRef.current) {
        dragStateRef.current = null;
        refreshRects();
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleEndDrag);
    window.addEventListener('touchmove', handleWindowTouchMove, {
      passive: false,
    });
    window.addEventListener('touchend', handleEndDrag);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleEndDrag);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleEndDrag);
    };
  }, [isActive, refreshRects]);

  const updateSelectedOverride = (patch: Partial<ElementUiOverride>) => {
    if (!selectedSelector) return;
    const label = selectedElement
      ? getElementReadableLabel(selectedElement)
      : selectedSelector;
    const tagName = selectedElement
      ? selectedElement.tagName.toLowerCase()
      : 'element';

    setOverrides((prev) => {
      const current: ElementUiOverride = prev[selectedSelector] || {
        selector: selectedSelector,
        label,
        tagName,
      };
      return {
        ...prev,
        [selectedSelector]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const handleSelectParentElement = () => {
    if (!selectedElement || !selectedElement.parentElement) return;
    const parent = selectedElement.parentElement;
    if (parent === document.body || parent.id === 'root') return;
    const selector = getStableElementSelector(parent);
    setSelectedElement(parent);
    setSelectedSelector(selector);
    setSelectedRect(parent.getBoundingClientRect());
  };

  const handleDeleteSelectedElement = () => {
    if (!selectedSelector) return;
    updateSelectedOverride({ hidden: true });
    setSaveBanner('Hidden! Tap "Save" to persist.');
    setTimeout(() => setSaveBanner(null), 3000);
  };

  const handleResetElement = (selectorToReset: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[selectorToReset];
      return next;
    });
  };

  const handleResetAllOverrides = () => {
    setOverrides({});
    setSaveBanner('All UI components reset to default.');
    setTimeout(() => setSaveBanner(null), 3000);
  };

  const handleSaveToFirestore = async () => {
    if (!currentUser || !isAdmin) return;
    setIsSavingCloud(true);
    setSaveBanner(null);

    try {
      const serialized = JSON.stringify(overrides);
      await setDoc(doc(db, 'ui_config', 'global'), {
        id: 'global',
        overridesJson: serialized.slice(0, 49500),
        authorUid: currentUser.uid,
        updatedAt: serverTimestamp(),
      });
      setSaveBanner('Saved to Cloud Firestore!');
      setTimeout(() => setSaveBanner(null), 3500);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'ui_config/global');
    } finally {
      setIsSavingCloud(false);
    }
  };

  if (!isActive || !isAdmin) return null;

  const activeOverride: ElementUiOverride | null = selectedSelector
    ? overrides[selectedSelector] || {
        selector: selectedSelector,
        label: selectedElement
          ? getElementReadableLabel(selectedElement)
          : selectedSelector,
        tagName: selectedElement
          ? selectedElement.tagName.toLowerCase()
          : 'div',
      }
    : null;

  const modifiedEntries = Object.values(overrides);

  const beginDrag = (
    clientX: number,
    clientY: number,
    mode: 'width' | 'height' | 'both' | 'move'
  ) => {
    if (!selectedSelector || !selectedRect) return;
    dragStateRef.current = {
      mode,
      startX: clientX,
      startY: clientY,
      startWidth: activeOverride?.widthPx || Math.round(selectedRect.width),
      startHeight: activeOverride?.heightPx || Math.round(selectedRect.height),
      startTx: activeOverride?.translateX || 0,
      startTy: activeOverride?.translateY || 0,
      selector: selectedSelector,
      label: activeOverride?.label || selectedSelector,
      tagName: activeOverride?.tagName || 'div',
    };
  };

  const currentWidthVal =
    activeOverride?.widthPx ??
    (selectedRect ? Math.round(selectedRect.width) : 120);
  const currentHeightVal =
    activeOverride?.heightPx ??
    (selectedRect ? Math.round(selectedRect.height) : 44);

  return (
    <div
      data-zappy-editor="true"
      className="fixed inset-0 pointer-events-none z-[90]"
    >
      {/* 1. Desktop Hover Highlight Box */}
      {inspectEnabled &&
        hoverRect &&
        hoveredElement !== selectedElement && (
          <div
            data-zappy-editor="true"
            style={{
              top: hoverRect.top,
              left: hoverRect.left,
              width: hoverRect.width,
              height: hoverRect.height,
            }}
            className="fixed pointer-events-none border-2 border-dashed border-[#B892FF] bg-[#B892FF]/10 rounded-lg z-[91]"
          />
        )}

      {/* 2. Clean Selected Element Outline + Touch/Mouse Resize Handles (No overlapping toolbar!) */}
      {selectedRect && !activeOverride?.hidden && (
        <div
          data-zappy-editor="true"
          style={{
            top: selectedRect.top,
            left: selectedRect.left,
            width: selectedRect.width,
            height: selectedRect.height,
          }}
          className="fixed pointer-events-none border-2 border-[#FF8A3D] bg-[#FF8A3D]/10 rounded-lg z-[92] shadow-[0_0_20px_rgba(255,138,61,0.35)]"
        >
          {/* Compact Dimension Badge Clamped Inside Screen */}
          <div
            data-zappy-editor="true"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              beginDrag(e.clientX, e.clientY, 'move');
            }}
            onTouchStart={(e) => {
              if (e.touches.length > 0) {
                e.stopPropagation();
                beginDrag(e.touches[0].clientX, e.touches[0].clientY, 'move');
              }
            }}
            className="pointer-events-auto absolute -top-6 left-0 px-2 py-0.5 rounded bg-[#FF8A3D] text-[#110E17] text-[10px] font-bold font-mono-tabular whitespace-nowrap shadow-md cursor-move"
            title="Drag to move element"
          >
            {Math.round(selectedRect.width)}×{Math.round(selectedRect.height)}px · Drag Move
          </div>

          {/* Right Edge Handle (Touch & Mouse Width Resize) */}
          <div
            data-zappy-editor="true"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              beginDrag(e.clientX, e.clientY, 'width');
            }}
            onTouchStart={(e) => {
              if (e.touches.length > 0) {
                e.stopPropagation();
                beginDrag(e.touches[0].clientX, e.touches[0].clientY, 'width');
              }
            }}
            className="pointer-events-auto absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-10 rounded-full bg-[#FF8A3D] border-2 border-[#110E17] cursor-ew-resize shadow-lg flex items-center justify-center touch-none"
          >
            <div className="w-0.5 h-4 bg-[#110E17] rounded-full" />
          </div>

          {/* Bottom Edge Handle (Touch & Mouse Height Resize) */}
          <div
            data-zappy-editor="true"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              beginDrag(e.clientX, e.clientY, 'height');
            }}
            onTouchStart={(e) => {
              if (e.touches.length > 0) {
                e.stopPropagation();
                beginDrag(e.touches[0].clientX, e.touches[0].clientY, 'height');
              }
            }}
            className="pointer-events-auto absolute -bottom-3 left-1/2 -translate-x-1/2 w-10 h-6 rounded-full bg-[#FF8A3D] border-2 border-[#110E17] cursor-ns-resize shadow-lg flex items-center justify-center touch-none"
          >
            <div className="w-4 h-0.5 bg-[#110E17] rounded-full" />
          </div>

          {/* Bottom-Right Corner Handle (Touch & Mouse Both Width & Height Resize) */}
          <div
            data-zappy-editor="true"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              beginDrag(e.clientX, e.clientY, 'both');
            }}
            onTouchStart={(e) => {
              if (e.touches.length > 0) {
                e.stopPropagation();
                beginDrag(e.touches[0].clientX, e.touches[0].clientY, 'both');
              }
            }}
            className="pointer-events-auto absolute -bottom-3.5 -right-3.5 w-7 h-7 rounded-full bg-[#B892FF] border-2 border-[#110E17] cursor-nwse-resize shadow-lg touch-none"
          />
        </div>
      )}

      {/* 3. SINGLE UNIFIED MOBILE-FRIENDLY DOCK (Can be docked Top or Bottom, or Minimized to a 1-line bar!) */}
      <motion.aside
        data-zappy-editor="true"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`pointer-events-auto fixed z-[95] left-2 right-2 md:left-auto md:right-4 md:w-[380px] rounded-2xl bg-[#14101F]/95 backdrop-blur-2xl border border-[#B892FF]/40 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          dockPosition === 'top' ? 'top-2' : 'bottom-2'
        }`}
      >
        {/* Unified Compact Top Control Bar (Always Visible) */}
        <div className="px-3 py-2 bg-[#1D172C] border-b border-white/10 flex items-center justify-between gap-1.5">
          {/* Left: Pick vs Scroll Mode Toggle */}
          <button
            type="button"
            onClick={() => setInspectEnabled((prev) => !prev)}
            className={`min-h-[36px] px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              inspectEnabled
                ? 'bg-[#B892FF] text-[#110E17]'
                : 'bg-white/10 text-zinc-200'
            }`}
            title="Switch between tapping elements to edit vs scrolling/using the app normally"
          >
            {inspectEnabled ? (
              <>
                <MousePointerClick className="w-3.5 h-3.5 shrink-0" />
                <span>Tap to Pick</span>
              </>
            ) : (
              <>
                <Hand className="w-3.5 h-3.5 shrink-0 text-[#FF8A3D]" />
                <span>Scroll Mode</span>
              </>
            )}
          </button>

          {/* Center: Selected Element Name or Status */}
          <button
            type="button"
            onClick={() => setPanelMinimized((prev) => !prev)}
            className="flex-1 min-w-0 px-1.5 text-left cursor-pointer"
          >
            <p className="text-[11px] font-bold text-white truncate">
              {saveBanner ? (
                <span className="text-emerald-400">{saveBanner}</span>
              ) : activeOverride ? (
                activeOverride.label
              ) : (
                'Tap any button/item on screen'
              )}
            </p>
          </button>

          {/* Right: Flip Top/Bottom + Save + Minimize + Exit */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() =>
                setDockPosition((prev) => (prev === 'bottom' ? 'top' : 'bottom'))
              }
              className="min-h-[34px] min-w-[34px] rounded-xl bg-white/10 hover:bg-white/20 text-zinc-200 flex items-center justify-center cursor-pointer"
              title="Move Editor Bar to Top or Bottom of Screen"
              aria-label="Move Editor Bar to Top or Bottom"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              disabled={isSavingCloud}
              onClick={handleSaveToFirestore}
              className="min-h-[34px] px-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#07150D] text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-60"
              title="Save UI changes to Cloud Firestore"
            >
              {isSavingCloud ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span className="hidden xs:inline">Save</span>
            </button>

            <button
              type="button"
              onClick={() => setPanelMinimized((prev) => !prev)}
              className="min-h-[34px] min-w-[34px] rounded-xl bg-white/10 hover:bg-white/20 text-zinc-200 flex items-center justify-center cursor-pointer"
              title={panelMinimized ? 'Expand Editor Tools' : 'Minimize Editor Panel'}
              aria-label={panelMinimized ? 'Expand Editor Tools' : 'Minimize Editor Panel'}
            >
              {panelMinimized ? (
                <ChevronUp className="w-4 h-4 text-[#B892FF]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#B892FF]" />
              )}
            </button>

            <button
              type="button"
              onClick={onCloseEditor}
              className="min-h-[34px] min-w-[34px] rounded-xl bg-red-500/20 hover:bg-red-500/35 text-red-300 flex items-center justify-center cursor-pointer"
              title="Exit UI Editor"
              aria-label="Exit UI Editor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapsible Editor Body (Only shown when not minimized!) */}
        {!panelMinimized && (
          <div className="flex flex-col max-h-[38vh] sm:max-h-[46vh]">
            {/* Action Sub-bar: Select Parent, Delete, Reset + 4 Mode Tabs */}
            <div className="px-3 py-1.5 bg-[#110D1A] border-b border-white/10 flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'size', label: 'Size/Move', icon: Maximize2 },
                    { id: 'style', label: 'Color', icon: Palette },
                    { id: 'text', label: 'Text', icon: Type },
                    {
                      id: 'manage',
                      label: `Edited (${modifiedEntries.length})`,
                      icon: Layers,
                    },
                  ] as const
                ).map((t) => {
                  const Icon = t.icon;
                  const active = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTab(t.id)}
                      className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                        active
                          ? 'bg-[#B892FF] text-[#110E17]'
                          : 'text-zinc-400 hover:text-white bg-white/[0.04]'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {selectedSelector && activeOverride && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleSelectParentElement}
                    className="min-h-[32px] px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] text-zinc-200 flex items-center gap-1 cursor-pointer"
                    title="Select Parent Container"
                  >
                    <ArrowUp className="w-3 h-3 text-[#B892FF]" />
                    <span>Parent</span>
                  </button>

                  {activeOverride.hidden ? (
                    <button
                      type="button"
                      onClick={() => updateSelectedOverride({ hidden: false })}
                      className="min-h-[32px] px-2.5 py-1 rounded-lg bg-emerald-500 text-[#07150D] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Restore</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleDeleteSelectedElement}
                      className="min-h-[32px] px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/35 border border-red-500/40 text-red-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                      <span>Delete</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleResetElement(selectedSelector)}
                    className="min-h-[32px] min-w-[32px] rounded-lg bg-white/10 hover:bg-white/20 text-zinc-300 flex items-center justify-center cursor-pointer"
                    title="Reset this element"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Scrollable Compact Controls Area */}
            <div className="p-3 overflow-y-auto space-y-3 text-xs">
              {activeTab === 'manage' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">
                      Modified & Deleted Items ({modifiedEntries.length})
                    </span>
                    {modifiedEntries.length > 0 && (
                      <button
                        type="button"
                        onClick={handleResetAllOverrides}
                        className="text-[11px] text-red-400 hover:underline cursor-pointer"
                      >
                        Reset All to Default
                      </button>
                    )}
                  </div>

                  {modifiedEntries.length === 0 ? (
                    <p className="text-zinc-400 py-3 text-center">
                      No components edited or deleted yet. Tap any button or section on screen to customize it.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {modifiedEntries.map((item) => (
                        <div
                          key={item.selector}
                          className="rounded-xl bg-[#1D182B] border border-white/10 p-2 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-white truncate block">
                              {item.label}{' '}
                              {item.hidden ? '(Deleted/Hidden)' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {item.hidden && (
                              <button
                                type="button"
                                onClick={() =>
                                  setOverrides((prev) => ({
                                    ...prev,
                                    [item.selector]: {
                                      ...prev[item.selector],
                                      hidden: false,
                                    },
                                  }))
                                }
                                className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-bold cursor-pointer"
                              >
                                Restore
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSelector(item.selector);
                                setActiveTab('size');
                              }}
                              className="px-2 py-1 rounded-lg bg-white/10 text-zinc-200 text-[10px] cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResetElement(item.selector)}
                              className="p-1 rounded-lg bg-red-500/15 text-red-300 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : !activeOverride ? (
                <div className="py-3 text-center text-zinc-300 flex items-center justify-center gap-2">
                  <MousePointerClick className="w-4 h-4 text-[#B892FF] shrink-0" />
                  <span>
                    Tap any button, card, or section on the screen to resize, move, recolor, or delete it. (Tap the arrow above to minimize this bar!)
                  </span>
                </div>
              ) : (
                <>
                  {activeTab === 'size' && (
                    <div className="space-y-3">
                      {/* Touch-Friendly Width & Height Steppers */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="p-2 rounded-xl bg-[#1A1527] border border-white/10 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-zinc-400">Width</span>
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedOverride({ widthPx: null })
                              }
                              className="text-[#B892FF] text-[10px] underline cursor-pointer"
                            >
                              Auto
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedOverride({
                                  widthPx: Math.max(24, currentWidthVal - 10),
                                })
                              }
                              className="min-h-[34px] min-w-[34px] rounded-lg bg-white/10 text-white flex items-center justify-center cursor-pointer active:scale-95"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              value={activeOverride.widthPx ?? currentWidthVal}
                              onChange={(e) =>
                                updateSelectedOverride({
                                  widthPx: e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                })
                              }
                              className="w-full min-h-[34px] text-center rounded-lg bg-[#110E17] border border-white/15 text-white font-mono-tabular text-xs"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedOverride({
                                  widthPx: currentWidthVal + 10,
                                })
                              }
                              className="min-h-[34px] min-w-[34px] rounded-lg bg-white/10 text-white flex items-center justify-center cursor-pointer active:scale-95"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="p-2 rounded-xl bg-[#1A1527] border border-white/10 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-zinc-400">Height</span>
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedOverride({ heightPx: null })
                              }
                              className="text-[#B892FF] text-[10px] underline cursor-pointer"
                            >
                              Auto
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedOverride({
                                  heightPx: Math.max(20, currentHeightVal - 8),
                                })
                              }
                              className="min-h-[34px] min-w-[34px] rounded-lg bg-white/10 text-white flex items-center justify-center cursor-pointer active:scale-95"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              value={
                                activeOverride.heightPx ?? currentHeightVal
                              }
                              onChange={(e) =>
                                updateSelectedOverride({
                                  heightPx: e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                })
                              }
                              className="w-full min-h-[34px] text-center rounded-lg bg-[#110E17] border border-white/15 text-white font-mono-tabular text-xs"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedOverride({
                                  heightPx: currentHeightVal + 8,
                                })
                              }
                              className="min-h-[34px] min-w-[34px] rounded-lg bg-white/10 text-white flex items-center justify-center cursor-pointer active:scale-95"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Touch D-Pad Nudge Controls + Scale Slider */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                        <div className="p-2 rounded-xl bg-[#1A1527] border border-white/10 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-zinc-400">
                            Move Position:
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedOverride({
                                  translateX:
                                    (activeOverride.translateX || 0) - 8,
                                })
                              }
                              className="min-h-[34px] min-w-[34px] rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer active:scale-95"
                              title="Move Left"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedOverride({
                                  translateY:
                                    (activeOverride.translateY || 0) - 8,
                                })
                              }
                              className="min-h-[34px] min-w-[34px] rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer active:scale-95"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedOverride({
                                  translateY:
                                    (activeOverride.translateY || 0) + 8,
                                })
                              }
                              className="min-h-[34px] min-w-[34px] rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer active:scale-95"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedOverride({
                                  translateX:
                                    (activeOverride.translateX || 0) + 8,
                                })
                              }
                              className="min-h-[34px] min-w-[34px] rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer active:scale-95"
                              title="Move Right"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="p-2 rounded-xl bg-[#1A1527] border border-white/10 space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-400">Scale</span>
                            <span className="text-[#B892FF] font-mono-tabular">
                              {Math.round((activeOverride.scale ?? 1) * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.5}
                            max={1.8}
                            step={0.05}
                            value={activeOverride.scale ?? 1}
                            onChange={(e) =>
                              updateSelectedOverride({
                                scale: Number(e.target.value),
                              })
                            }
                            className="w-full accent-[#B892FF]"
                          />
                        </div>
                      </div>

                      {/* Font Size & Corner Radius */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">
                            Font Size (px)
                          </label>
                          <input
                            type="number"
                            min={8}
                            max={72}
                            placeholder="Auto"
                            value={activeOverride.fontSizePx ?? ''}
                            onChange={(e) =>
                              updateSelectedOverride({
                                fontSizePx: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                            className="w-full min-h-[34px] px-2.5 rounded-xl bg-[#110E17] border border-white/15 text-white font-mono-tabular"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">
                            Corner Radius (px)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={50}
                            placeholder="Default"
                            value={activeOverride.borderRadiusPx ?? ''}
                            onChange={(e) =>
                              updateSelectedOverride({
                                borderRadiusPx: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                            className="w-full min-h-[34px] px-2.5 rounded-xl bg-[#110E17] border border-white/15 text-white font-mono-tabular"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'style' && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-300 font-medium">
                            Background Color
                          </span>
                          <input
                            type="color"
                            value={
                              activeOverride.backgroundColor &&
                              activeOverride.backgroundColor.startsWith('#')
                                ? activeOverride.backgroundColor
                                : '#B892FF'
                            }
                            onChange={(e) =>
                              updateSelectedOverride({
                                backgroundColor: e.target.value,
                              })
                            }
                            className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                          />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {COLOR_PRESETS.map((c) => (
                            <button
                              key={`bg-${c}`}
                              type="button"
                              onClick={() =>
                                updateSelectedOverride({ backgroundColor: c })
                              }
                              style={{
                                backgroundColor:
                                  c === 'transparent' ? '#110E17' : c,
                              }}
                              className="w-7 h-7 rounded-lg border border-white/25 cursor-pointer flex items-center justify-center text-[8px] text-white"
                            >
                              {c === 'transparent' ? 'CLR' : ''}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-300 font-medium">
                            Text Color
                          </span>
                          <input
                            type="color"
                            value={
                              activeOverride.textColor &&
                              activeOverride.textColor.startsWith('#')
                                ? activeOverride.textColor
                                : '#FFFFFF'
                            }
                            onChange={(e) =>
                              updateSelectedOverride({
                                textColor: e.target.value,
                              })
                            }
                            className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                          />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {COLOR_PRESETS.filter((c) => c !== 'transparent').map(
                            (c) => (
                              <button
                                key={`txt-${c}`}
                                type="button"
                                onClick={() =>
                                  updateSelectedOverride({ textColor: c })
                                }
                                style={{ backgroundColor: c }}
                                className="w-7 h-7 rounded-lg border border-white/25 cursor-pointer"
                              />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'text' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] text-zinc-300 font-medium mb-1">
                          Change Button / Element Text Label
                        </label>
                        <input
                          type="text"
                          value={activeOverride.customText ?? ''}
                          onChange={(e) =>
                            updateSelectedOverride({
                              customText: e.target.value,
                            })
                          }
                          placeholder="Type new button or heading text..."
                          className="w-full min-h-[38px] px-3 rounded-xl bg-[#110E17] border border-white/15 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-zinc-300 font-medium mb-1 flex items-center gap-1.5">
                          <Code className="w-3.5 h-3.5 text-[#B892FF]" />
                          <span>Custom CSS</span>
                        </label>
                        <input
                          type="text"
                          value={activeOverride.customCss ?? ''}
                          onChange={(e) =>
                            updateSelectedOverride({
                              customCss: e.target.value,
                            })
                          }
                          placeholder="e.g. box-shadow: 0 0 20px #B892FF;"
                          className="w-full min-h-[36px] px-3 rounded-xl bg-[#110E17] border border-white/15 text-white font-mono-tabular text-[11px]"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </motion.aside>
    </div>
  );
};
