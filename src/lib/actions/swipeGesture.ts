interface SwipeGestureOptions {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onProgress?: (progress: number) => void;
  onCancel?: () => void;
  threshold?: number;
  edgeThreshold?: number;
  velocityThreshold?: number;
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  lastX: number;
  lastTime: number;
  direction: 'horizontal' | 'vertical' | null;
  active: boolean;
}

export function swipeGesture(node: HTMLElement, options: SwipeGestureOptions) {
  let opts = { ...options };
  const {
    threshold = 50,
    edgeThreshold = 30,
    velocityThreshold = 0.5,
  } = opts;

  let touchState: TouchState | null = null;
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 375;
  const completionThreshold = screenWidth * 0.35;

  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    touchState = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      lastX: touch.clientX,
      lastTime: Date.now(),
      direction: null,
      active: false,
    };
  }

  function handleTouchMove(e: TouchEvent) {
    if (!touchState) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchState.startX;
    const deltaY = touch.clientY - touchState.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Lock direction after 10px of movement
    if (!touchState.direction && (absX > 10 || absY > 10)) {
      touchState.direction = absX > absY ? 'horizontal' : 'vertical';
    }

    if (touchState.direction !== 'horizontal') return;

    // Only track swipe-right from left edge
    if (deltaX > 0 && touchState.startX < edgeThreshold && opts.onSwipeRight) {
      touchState.active = true;
      touchState.lastX = touch.clientX;
      touchState.lastTime = Date.now();

      const progress = Math.min(1, deltaX / completionThreshold);
      if (opts.onProgress) {
        opts.onProgress(progress);
      }
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (!touchState) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchState.startX;
    const deltaY = touch.clientY - touchState.startY;
    const deltaTime = Date.now() - touchState.startTime;

    // If we were actively tracking a horizontal swipe with progress
    if (touchState.active && touchState.direction === 'horizontal' && deltaX > 0) {
      const velocity = deltaX / deltaTime; // px/ms
      const shouldComplete = deltaX >= completionThreshold || velocity > velocityThreshold;

      if (shouldComplete && opts.onSwipeRight) {
        opts.onSwipeRight();
      } else if (opts.onCancel) {
        opts.onCancel();
      }
      touchState = null;
      return;
    }

    // Fallback: standard swipe detection for non-edge swipes
    if (deltaTime > 500) {
      if (opts.onCancel) opts.onCancel();
      touchState = null;
      return;
    }

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX > absY && absX > threshold) {
      if (deltaX > 0) {
        if (touchState.startX < edgeThreshold && opts.onSwipeRight) {
          opts.onSwipeRight();
        }
      } else if (opts.onSwipeLeft) {
        opts.onSwipeLeft();
      }
    } else if (absY > absX && absY > threshold) {
      if (deltaY > 0 && opts.onSwipeDown) {
        opts.onSwipeDown();
      } else if (deltaY < 0 && opts.onSwipeUp) {
        opts.onSwipeUp();
      }
    } else if (opts.onCancel) {
      opts.onCancel();
    }

    touchState = null;
  }

  function handleTouchCancel() {
    if (touchState?.active && opts.onCancel) {
      opts.onCancel();
    }
    touchState = null;
  }

  node.addEventListener('touchstart', handleTouchStart, { passive: true });
  node.addEventListener('touchmove', handleTouchMove, { passive: true });
  node.addEventListener('touchend', handleTouchEnd, { passive: true });
  node.addEventListener('touchcancel', handleTouchCancel, { passive: true });

  return {
    destroy() {
      node.removeEventListener('touchstart', handleTouchStart);
      node.removeEventListener('touchmove', handleTouchMove);
      node.removeEventListener('touchend', handleTouchEnd);
      node.removeEventListener('touchcancel', handleTouchCancel);
    },
    update(newOptions: SwipeGestureOptions) {
      opts = { ...newOptions };
    }
  };
}
