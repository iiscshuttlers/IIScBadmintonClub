const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/src/hooks/useUmpireState.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `    const breakIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
      if (breakIntervalRef.current) clearInterval(breakIntervalRef.current);
      breakIntervalRef.current = null;
      setBreakSecondsLeft(null);
      setBreakLabel("");
      setShowFullTimer(false);
    };`;

const replacementStr = `    const breakIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const startBreak = (seconds: number, label = "") => {
      if (breakIntervalRef.current) clearInterval(breakIntervalRef.current);
      setBreakLabel(label);
      setBreakSecondsLeft(seconds);
      setShowFullTimer(true);
      breakIntervalRef.current = setInterval(() => {
        const prev = useUmpireStore.getState().breakSecondsLeft;
        if (prev === null || prev <= 1) {
          clearInterval(breakIntervalRef.current!);
          breakIntervalRef.current = null;
          playTimerEndEffect();
          setBreakSecondsLeft(null);
        } else {
          setBreakSecondsLeft(prev - 1);
        }
      }, 1000);
    };

    const endBreak = () => {
      if (breakIntervalRef.current) clearInterval(breakIntervalRef.current);
      breakIntervalRef.current = null;
      setBreakSecondsLeft(null);
      setBreakLabel("");
      setShowFullTimer(false);
    };`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed timers');
