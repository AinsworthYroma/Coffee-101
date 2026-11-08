'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import BrandMark from '../../BrandMark';
import './OptionWheel.css';

interface OptionWheelProps {
  items: string[];
  selected: number;
  label: string;
  onChange: (index: number, item: string) => void;
}

const RADIUS = 110;
const ANGLE_STEP = 19 * Math.PI / 180;

const geometry = (root: HTMLDivElement) => {
  return { centerX: 68, centerY: root.clientHeight / 2, radius: RADIUS };
};

const OptionWheel = ({ items, selected, label, onChange }: OptionWheelProps) => {
  const optionId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const positionRef = useRef(selected);
  const targetRef = useRef(selected);
  const selectedRef = useRef(selected);
  const onChangeRef = useRef(onChange);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const dragRef = useRef<{ id: number; x: number; y: number; angle: number; distance: number; start: number; option: number } | null>(null);
  const draggedRef = useRef(false);
  const [selectedIndex, setSelectedIndex] = useState(selected);
  const [dragging, setDragging] = useState(false);

  onChangeRef.current = onChange;

  const layout = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const { centerX, centerY, radius } = geometry(root);
    root.style.setProperty('--ow-pivot-x', `${centerX}px`);
    itemRefs.current.forEach((element, index) => {
      if (!element) return;
      const angle = (index - positionRef.current) * ANGLE_STEP;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      element.style.transform = `translate(${x.toFixed(3)}px, ${y.toFixed(3)}px) translateY(-50%)`;
    });
  }, []);

  const runFrame = useCallback(function animate(now: number) {
    const delta = Math.min((now - lastTimeRef.current) / 1000, 0.05);
    lastTimeRef.current = now;
    const target = targetRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = reduced ? target : positionRef.current + (target - positionRef.current) * (1 - Math.exp(-delta / 0.12));
    const settled = Math.abs(target - next) < 0.001;
    positionRef.current = settled ? target : next;
    layout();
    if (!settled) {
      frameRef.current = requestAnimationFrame(animate);
      return;
    }
    frameRef.current = null;
    if (target !== selectedRef.current) {
      selectedRef.current = target;
      setSelectedIndex(target);
      onChangeRef.current(target, items[target]);
    }
  }, [items, layout]);

  const snapTo = useCallback((index: number) => {
    targetRef.current = Math.max(0, Math.min(items.length - 1, Math.round(index)));
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    lastTimeRef.current = performance.now();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) runFrame(lastTimeRef.current);
    else frameRef.current = requestAnimationFrame(runFrame);
  }, [items.length, runFrame]);

  const pointerAngle = (clientX: number, clientY: number) => {
    const root = rootRef.current!;
    const bounds = root.getBoundingClientRect();
    const { centerX, centerY } = geometry(root);
    return Math.atan2(clientY - (bounds.top + centerY), clientX - (bounds.left + centerX));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || dragRef.current) return;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    const option = itemRefs.current.findIndex(element => element?.contains(event.target as Node));
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, angle: pointerAngle(event.clientX, event.clientY), distance: 0, start: positionRef.current, option };
    draggedRef.current = false;
    rootRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const angle = pointerAngle(event.clientX, event.clientY);
    let delta = angle - drag.angle;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    drag.distance += delta;
    drag.angle = angle;
    if (!draggedRef.current && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) {
      draggedRef.current = true;
      setDragging(true);
    }
    if (draggedRef.current) {
      positionRef.current = Math.max(0, Math.min(items.length - 1, drag.start - drag.distance / ANGLE_STEP));
      layout();
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.id !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (draggedRef.current) snapTo(positionRef.current);
    else if (event.type !== 'pointercancel' && drag.option >= 0) snapTo(drag.option);
    else if (positionRef.current !== targetRef.current) snapTo(targetRef.current);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next = targetRef.current;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next -= 1;
    else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next += 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;
    event.preventDefault();
    snapTo(next);
  };

  useLayoutEffect(() => {
    layout();
    const observer = new ResizeObserver(layout);
    if (rootRef.current) observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [layout]);

  useEffect(() => {
    if (selected === selectedRef.current) return;
    selectedRef.current = selected;
    setSelectedIndex(selected);
    snapTo(selected);
  }, [selected, snapTo]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <div ref={rootRef} role="listbox" tabIndex={0} aria-label={label} aria-activedescendant={`${optionId}-${selectedIndex}`} className={`option-wheel${dragging ? ' option-wheel--dragging' : ''}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} onKeyDown={handleKeyDown}>
      <div className="option-wheel__pivot" aria-hidden="true"><BrandMark /><span className="option-wheel__marker" /></div>
      {items.map((item, index) => (
        <div key={item} ref={element => { itemRefs.current[index] = element; }} role="option" id={`${optionId}-${index}`} aria-selected={selectedIndex === index} className={`option-wheel__item${selectedIndex === index ? ' option-wheel__item--selected' : ''}`} onClick={() => { if (!draggedRef.current) snapTo(index); }}>
          {item}
        </div>
      ))}
    </div>
  );
};

export default OptionWheel;