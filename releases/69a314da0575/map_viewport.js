const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
function scaleLimits({minScale = 1, maxScale = 5} = {}) {
  const min = Math.max(1, finite(minScale, 1));
  return {min, max: Math.max(min, finite(maxScale, 5))};
}

/** Scene and viewport have the same untransformed dimensions. */
export function clampMapState(state, size, limits) {
  const {min, max} = scaleLimits(limits);
  const scale = clamp(finite(state.scale, min), min, max);
  const width = Math.max(0, finite(size.width, 0));
  const height = Math.max(0, finite(size.height, 0));
  return {scale, x: clamp(finite(state.x, 0), -width * (scale - 1), 0) || 0,
    y: clamp(finite(state.y, 0), -height * (scale - 1), 0) || 0};
}

/** Keep the map point at `from` under `to`, including a moving pinch midpoint. */
export function transformMapState(state, {scale, from, to = from}, size, limits) {
  const {min, max} = scaleLimits(limits);
  const nextScale = clamp(finite(scale, state.scale), min, max);
  const ratio = nextScale / state.scale;
  return clampMapState({scale: nextScale,
    x: to.x - (from.x - state.x) * ratio,
    y: to.y - (from.y - state.y) * ratio}, size, limits);
}

export function resetMapState(size, limits) {
  const {min} = scaleLimits(limits);
  return clampMapState({scale: min, x: -size.width * (min - 1) / 2,
    y: -size.height * (min - 1) / 2}, size, limits);
}

export function resizeMapState(state, previousSize, size, limits) {
  return clampMapState({...state,
    x: previousSize.width > 0 ? state.x * size.width / previousSize.width : state.x,
    y: previousSize.height > 0 ? state.y * size.height / previousSize.height : state.y}, size, limits);
}

/** Local map navigation. Page-level zoom policy belongs to the application. */
export function createMapViewport(viewport, {
  scene = viewport?.querySelector('.map-viewport-scene'), onChange,
  minScale = 1, maxScale = 5, wheelRequiresModifier = false
} = {}) {
  if (!viewport || !scene || viewport === scene || !viewport.contains(scene)) {
    throw new TypeError('地图缩放需要容器及其内部的独立场景元素');
  }
  const limits = {minScale, maxScale};
  const host = viewport.ownerDocument?.defaultView || globalThis;
  const pointers = new Map();
  const removers = [];
  let size = {width: 0, height: 0};
  let state = resetMapState(size, limits);
  let gesture = null, dragging = false, suppressClickUntil = 0, destroyed = false;
  const hadViewportClass = viewport.classList.contains('map-viewport');
  const hadSceneClass = scene.classList.contains('map-viewport-scene');
  const oldTransform = scene.style.transform;
  const oldTouchAction = viewport.style.touchAction;
  const oldOverscroll = viewport.style.overscrollBehavior;
  const oldUnit = viewport.style.getPropertyValue('--map-unit');
  viewport.classList.add('map-viewport');
  scene.classList.add('map-viewport-scene');

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    removers.push(() => target.removeEventListener(type, handler, options));
  }
  function render() {
    viewport.style.touchAction = state.scale <= 1.001 ? 'pan-y' : 'none';
    viewport.style.overscrollBehavior = state.scale <= 1.001 ? 'auto' : 'contain';
    scene.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
    onChange?.({...state});
  }
  function apply(next) {
    state = next;
    render();
  }
  function local(point) {
    const rect = viewport.getBoundingClientRect();
    return {x: point.x - rect.left - (viewport.clientLeft || 0),
      y: point.y - rect.top - (viewport.clientTop || 0)};
  }
  function midpoint(points) {
    return local({x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2});
  }
  const distance = points => Math.hypot(points[0].x - points[1].x,
    points[0].y - points[1].y);
  function rebase() {
    const points = [...pointers.values()];
    gesture = points.length ? {state: {...state}, point: points[0],
      midpoint: points.length === 2 ? midpoint(points) : null,
      distance: points.length === 2 ? Math.max(1, distance(points)) : 0} : null;
  }
  function captureAll() {
    for (const id of pointers.keys()) {
      try { viewport.setPointerCapture(id); } catch { /* A cancelled pointer may already be gone. */ }
    }
  }
  function markDragging() {
    dragging = true;
    suppressClickUntil = Date.now() + 500;
    viewport.classList.add('map-viewport-dragging');
    captureAll();
  }
  function isControl(target) {
    return Boolean(target?.closest?.('[data-map-control]'));
  }
  function pointerDown(event) {
    if (destroyed || isControl(event.target) ||
        (event.pointerType === 'mouse' && event.button !== 0) || pointers.size >= 2) return;
    if (!pointers.size) {
      dragging = false;
      suppressClickUntil = 0;
    }
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    rebase();
    if (pointers.size === 2) {
      markDragging();
      event.preventDefault();
    }
  }
  function pointerMove(event) {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    const points = [...pointers.values()];
    if (points.length === 2) {
      markDragging();
      apply(transformMapState(gesture.state, {
        scale: gesture.state.scale * distance(points) / gesture.distance,
        from: gesture.midpoint, to: midpoint(points)
      }, size, limits));
    } else {
      if (gesture.state.scale <= 1.001) return;
      const dx = points[0].x - gesture.point.x, dy = points[0].y - gesture.point.y;
      if (!dragging && Math.hypot(dx, dy) < 6) return;
      markDragging();
      apply(clampMapState({...gesture.state, x: gesture.state.x + dx,
        y: gesture.state.y + dy}, size, limits));
    }
    event.preventDefault();
  }
  function pointerEnd(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (dragging) suppressClickUntil = Date.now() + 500;
    try {
      if (viewport.hasPointerCapture?.(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    } catch { /* The browser may release capture before pointercancel. */ }
    rebase();
    if (!pointers.size) {
      dragging = false;
      viewport.classList.remove('map-viewport-dragging');
    }
  }
  function click(event) {
    // Keyboard activation has no pointer gesture and must stay accessible.
    if (event.detail !== 0 && !isControl(event.target) &&
        (dragging || Date.now() < suppressClickUntil)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
  function wheel(event) {
    if (isControl(event.target) || !size.width || !size.height) return;
    if (wheelRequiresModifier && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1;
    const factor = Math.exp(-clamp(event.deltaY * unit, -500, 500) * 0.002);
    apply(transformMapState(state, {scale: state.scale * factor,
      from: local({x: event.clientX, y: event.clientY})}, size, limits));
    rebase();
  }
  function refresh() {
    if (destroyed) return {...state};
    const nextSize = {width: viewport.clientWidth, height: viewport.clientHeight};
    // Hidden views report zero: retain the last geometry until shown again.
    if (!(nextSize.width > 0 && nextSize.height > 0)) return {...state};
    state = size.width > 0 && size.height > 0 ?
      resizeMapState(state, size, nextSize, limits) : resetMapState(nextSize, limits);
    size = nextSize;
    viewport.style.setProperty('--map-unit', `${size.width / 1000}px`);
    rebase();
    render();
    return {...state};
  }
  listen(viewport, 'pointerdown', pointerDown);
  // Window listeners also retain a mouse gesture before it crosses the drag threshold.
  listen(host, 'pointermove', pointerMove, {passive: false});
  listen(host, 'pointerup', pointerEnd);
  listen(host, 'pointercancel', pointerEnd);
  listen(viewport, 'lostpointercapture', event => {
    // Touch points may implicitly capture on a marker before capture moves here.
    if (event.target === viewport) pointerEnd(event);
  });
  listen(viewport, 'click', click, true);
  listen(viewport, 'wheel', wheel, {passive: false});
  listen(viewport, 'dragstart', event => event.preventDefault());
  const observer = typeof host.ResizeObserver === 'function' ? new host.ResizeObserver(refresh) : null;
  observer?.observe(viewport);
  if (!observer) listen(host, 'resize', refresh);
  refresh();

  return {
    zoomBy(factor) {
      if (destroyed || !Number.isFinite(factor) || factor <= 0) return {...state};
      refresh();
      apply(transformMapState(state, {scale: state.scale * factor,
        from: {x: size.width / 2, y: size.height / 2}}, size, limits));
      rebase();
      return {...state};
    },
    reset() {
      if (!destroyed) {
        refresh();
        apply(resetMapState(size, limits));
        rebase();
      }
      return {...state};
    },
    getState() { return {...state}; },
    refresh,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer?.disconnect();
      for (const remove of removers) remove();
      for (const id of pointers.keys()) {
        try { if (viewport.hasPointerCapture?.(id)) viewport.releasePointerCapture(id); } catch { /* Already released. */ }
      }
      pointers.clear();
      viewport.classList.remove('map-viewport-dragging');
      if (!hadViewportClass) viewport.classList.remove('map-viewport');
      if (!hadSceneClass) scene.classList.remove('map-viewport-scene');
      scene.style.transform = oldTransform;
    viewport.style.touchAction = oldTouchAction || '';
    viewport.style.overscrollBehavior = oldOverscroll || '';
      if (oldUnit) viewport.style.setProperty('--map-unit', oldUnit);
      else viewport.style.removeProperty('--map-unit');
    }
  };
}
