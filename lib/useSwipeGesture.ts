import { useRef, useCallback } from 'react';

interface SwipeGestureOptions {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number; // Minimum distance for swipe
  edgeThreshold?: number; // For edge swipes (from left edge)
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
}

export function useSwipeGesture(options: SwipeGestureOptions) {
  const {
    onSwipeRight,
    onSwipeLeft,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    edgeThreshold = 30, // Start swipe from within 30px of left edge
  } = options;

  const touchState = useRef<TouchState | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
    };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchState.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchState.current.startX;
    const deltaY = touch.clientY - touchState.current.startY;
    const deltaTime = Date.now() - touchState.current.startTime;

    // Check for valid swipe (within time limit and minimum distance)
    if (deltaTime > 500) {
      touchState.current = null;
      return;
    }

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Horizontal swipe
    if (absX > absY && absX > threshold) {
      if (deltaX > 0) {
        // Swipe right - check if started from left edge for back navigation
        if (touchState.current.startX < edgeThreshold && onSwipeRight) {
          onSwipeRight();
        }
      } else if (onSwipeLeft) {
        onSwipeLeft();
      }
    }
    // Vertical swipe
    else if (absY > absX && absY > threshold) {
      if (deltaY > 0 && onSwipeDown) {
        onSwipeDown();
      } else if (deltaY < 0 && onSwipeUp) {
        onSwipeUp();
      }
    }

    touchState.current = null;
  }, [onSwipeRight, onSwipeLeft, onSwipeUp, onSwipeDown, threshold, edgeThreshold]);

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  };
}

// Hook for detecting tap gestures
export function useTapGesture(onTap: () => void, onDoubleTap?: () => void) {
  const lastTapTime = useRef<number>(0);
  const tapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTime.current;

    if (onDoubleTap && timeSinceLastTap < 300) {
      // Double tap detected
      if (tapTimeout.current) {
        clearTimeout(tapTimeout.current);
        tapTimeout.current = null;
      }
      onDoubleTap();
    } else {
      // Single tap - wait to see if it becomes a double tap
      if (onDoubleTap) {
        tapTimeout.current = setTimeout(() => {
          onTap();
          tapTimeout.current = null;
        }, 300);
      } else {
        onTap();
      }
    }

    lastTapTime.current = now;
  }, [onTap, onDoubleTap]);

  return { onClick: handleTap };
}
