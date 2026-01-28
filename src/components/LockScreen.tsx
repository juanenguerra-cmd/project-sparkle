import { useState, useEffect, useRef } from 'react';
import { Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const LOCK_PIN_KEY = 'icn_hub_lock_pin';
const LOCK_STATE_KEY = 'icn_hub_locked';

interface LockScreenProps {
  children: React.ReactNode;
}

const LockScreen = ({ children }: LockScreenProps) => {
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check lock state on mount
  useEffect(() => {
    const wasLocked = localStorage.getItem(LOCK_STATE_KEY) === 'true';
    if (wasLocked) {
      setIsLocked(true);
    }
  }, []);

  // Focus input when locked
  useEffect(() => {
    if (isLocked && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isLocked]);

  const hasPin = () => !!localStorage.getItem(LOCK_PIN_KEY);

  const handleLock = () => {
    if (!hasPin()) {
      setShowSetupDialog(true);
      setIsSettingPin(true);
      return;
    }
    setIsLocked(true);
    localStorage.setItem(LOCK_STATE_KEY, 'true');
    setPin('');
    setError('');
  };

  const handleUnlock = () => {
    const storedPin = localStorage.getItem(LOCK_PIN_KEY);
    if (pin === storedPin) {
      setIsLocked(false);
      localStorage.removeItem(LOCK_STATE_KEY);
      setPin('');
      setError('');
    } else {
      setError('Incorrect PIN');
      setPin('');
    }
  };

  const handleSetPin = () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }
    localStorage.setItem(LOCK_PIN_KEY, pin);
    setIsSettingPin(false);
    setShowSetupDialog(false);
    setPin('');
    setConfirmPin('');
    setError('');
    // Now lock it
    setIsLocked(true);
    localStorage.setItem(LOCK_STATE_KEY, 'true');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (isSettingPin) {
        handleSetPin();
      } else {
        handleUnlock();
      }
    }
  };

  return (
    <>
      {/* Lock Button - always visible in header area */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleLock}
        className="fixed top-3 right-16 z-50 hover:bg-muted"
        title={isLocked ? "Locked" : "Lock Screen"}
      >
        {isLocked ? (
          <Lock className="h-5 w-5 text-destructive" />
        ) : (
          <Lock className="h-5 w-5 text-muted-foreground" />
        )}
      </Button>

      {/* Lock Overlay */}
      {isLocked && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          {/* Blurred background */}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-lg" />
          
          {/* Lock Card */}
          <div className="relative z-50 bg-card border rounded-xl shadow-2xl p-8 w-full max-w-sm mx-4">
            <div className="flex flex-col items-center space-y-6">
              {/* Lock Icon */}
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-10 w-10 text-primary" />
              </div>
              
              <div className="text-center">
                <h2 className="text-xl font-semibold">Screen Locked</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter your PIN to unlock
                </p>
              </div>

              {/* PIN Input */}
              <div className="w-full space-y-3">
                <div className="relative">
                  <Input
                    ref={inputRef}
                    type={showPin ? "text" : "password"}
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value.replace(/\D/g, ''));
                      setError('');
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter PIN"
                    className="text-center text-2xl tracking-[0.5em] pr-10"
                    maxLength={8}
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowPin(!showPin)}
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>

                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}

                <Button 
                  onClick={handleUnlock} 
                  className="w-full"
                  disabled={pin.length < 4}
                >
                  <Unlock className="h-4 w-4 mr-2" />
                  Unlock
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PIN Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="max-w-sm z-[100]">
          <DialogHeader>
            <DialogTitle>Set Up Screen Lock PIN</DialogTitle>
            <DialogDescription>
              Create a PIN to protect your screen from unauthorized viewing
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Enter PIN (4-8 digits)</label>
              <Input
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, ''));
                  setError('');
                }}
                placeholder="Enter PIN"
                className="text-center text-xl tracking-widest"
                maxLength={8}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm PIN</label>
              <Input
                type={showPin ? "text" : "password"}
                value={confirmPin}
                onChange={(e) => {
                  setConfirmPin(e.target.value.replace(/\D/g, ''));
                  setError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder="Confirm PIN"
                className="text-center text-xl tracking-widest"
                maxLength={8}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showPin"
                checked={showPin}
                onChange={(e) => setShowPin(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="showPin" className="text-sm">Show PIN</label>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button onClick={handleSetPin} className="w-full" disabled={pin.length < 4}>
              Set PIN & Lock
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <div className={isLocked ? 'invisible' : ''}>
        {children}
      </div>
    </>
  );
};

export default LockScreen;
