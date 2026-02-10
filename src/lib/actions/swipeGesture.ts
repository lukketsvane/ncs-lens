interface SwipeGestureOptions {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  edgeThreshold?: number;
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
}

export function swipeGesture(node: HTMLElement, options: SwipeGestureOptions) {
  const {
    onSwipeRight,
    onSwipeLeft,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    edgeThreshold = 30,
  } = options;

  let touchState: TouchState | null = null;

  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    touchState = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
    };
  }

  function handleTouchEnd(e: TouchEvent) {
    if (!touchState) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchState.startX;
    const deltaY = touch.clientY - touchState.startY;
    const deltaTime = Date.now() - touchState.startTime;

    if (deltaTime > 500) {
      touchState = null;
      return;
    }

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX > absY && absX > threshold) {
      if (deltaX > 0) {
        if (touchState.startX < edgeThreshold && onSwipeRight) {
          onSwipeRight();
        }
      } else if (onSwipeLeft) {
        onSwipeLeft();
      }
    } else if (absY > absX && absY > threshold) {
      if (deltaY > 0 && onSwipeDown) {
        onSwipeDown();
      } else if (deltaY < 0 && onSwipeUp) {
        onSwipeUp();
      }
    }

    touchState = null;
  }

  node.addEventListener('touchstart', handleTouchStart);
  node.addEventListener('touchend', handleTouchEnd);

  return {
    destroy() {
      node.removeEventListener('touchstart', handleTouchStart);
      node.removeEventListener('touchend', handleTouchEnd);
    },
    update(newOptions: SwipeGestureOptions) {
      Object.assign(options, newOptions);
    }
  };
}
