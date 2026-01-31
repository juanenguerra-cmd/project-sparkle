import { useState, useRef, useCallback, ReactNode, forwardRef } from 'react';
import { Check, RotateCcw, Edit, BookOpen, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeAction {
  id: string;
  icon: ReactNode;
  label: string;
  bgColor: string;
  textColor: string;
  onClick: () => void;
}

interface SwipeableVaxRowProps {
  children: ReactNode;
  onMarkGiven: () => void;
  onClearReoffer: () => void;
  onEdit: () => void;
  onEducation: () => void;
  className?: string;
}

const SWIPE_THRESHOLD = 60;
const MAX_SWIPE = 180;

const SwipeableVaxRow = ({
  children,
  onMarkGiven,
  onClearReoffer,
  onEdit,
  onEducation,
  className
}: SwipeableVaxRowProps) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);

  const leftActions: SwipeAction[] = [
    {
      id: 'given',
      icon: <Check className="w-5 h-5" />,
      label: 'Given',
      bgColor: 'bg-success',
      textColor: 'text-white',
      onClick: onMarkGiven
    },
    {
      id: 'education',
      icon: <BookOpen className="w-5 h-5" />,
      label: 'Educate',
      bgColor: 'bg-primary',
      textColor: 'text-primary-foreground',
      onClick: onEducation
    }
  ];

  const rightActions: SwipeAction[] = [
    {
      id: 'clear',
      icon: <RotateCcw className="w-5 h-5" />,
      label: 'Clear',
      bgColor: 'bg-muted',
      textColor: 'text-foreground',
      onClick: onClearReoffer
    },
    {
      id: 'edit',
      icon: <Edit className="w-5 h-5" />,
      label: 'Edit',
      bgColor: 'bg-secondary',
      textColor: 'text-secondary-foreground',
      onClick: onEdit
    }
  ];

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = translateX;
    setIsDragging(true);
  }, [translateX]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const diff = e.touches[0].clientX - startX.current;
    const newTranslate = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, currentX.current + diff));
    setTranslateX(newTranslate);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    
    // Snap to action zones or reset
    if (translateX > SWIPE_THRESHOLD) {
      setTranslateX(MAX_SWIPE / 2);
    } else if (translateX < -SWIPE_THRESHOLD) {
      setTranslateX(-MAX_SWIPE / 2);
    } else {
      setTranslateX(0);
    }
  }, [translateX]);

  const handleActionClick = (action: SwipeAction) => {
    action.onClick();
    setTranslateX(0);
  };

  const resetSwipe = () => setTranslateX(0);

  return (
    <div className={cn("relative overflow-hidden touch-pan-y", className)}>
      {/* Left actions (swipe right to reveal) */}
      <div 
        className="absolute inset-y-0 left-0 flex items-stretch"
        style={{ width: MAX_SWIPE }}
      >
        {leftActions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleActionClick(action)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 transition-opacity",
              action.bgColor,
              action.textColor,
              translateX > 20 ? 'opacity-100' : 'opacity-50'
            )}
          >
            {action.icon}
            <span className="text-xs font-medium">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Right actions (swipe left to reveal) */}
      <div 
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ width: MAX_SWIPE }}
      >
        {rightActions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleActionClick(action)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 transition-opacity",
              action.bgColor,
              action.textColor,
              translateX < -20 ? 'opacity-100' : 'opacity-50'
            )}
          >
            {action.icon}
            <span className="text-xs font-medium">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Main content */}
      <div
        className={cn(
          "relative bg-background transition-transform",
          isDragging ? 'transition-none' : 'duration-200'
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
        
        {/* Swipe hints */}
        {translateX === 0 && (
          <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none md:hidden">
            <ChevronLeft className="w-4 h-4 text-muted-foreground/40 animate-pulse" />
          </div>
        )}
      </div>

      {/* Tap to close overlay when swiped */}
      {translateX !== 0 && (
        <div 
          className="absolute inset-0 z-10"
          onClick={resetSwipe}
          onTouchEnd={resetSwipe}
        />
      )}
    </div>
  );
};

export default SwipeableVaxRow;
