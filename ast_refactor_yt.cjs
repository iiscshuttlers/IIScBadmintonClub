const ts = require('typescript');
const fs = require('fs');

const fileName = 'client/src/components/YoutubePlayer.tsx';
let sourceText = fs.readFileSync(fileName, 'utf8');

const sourceFile = ts.createSourceFile(
  fileName,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

const replacements = [];

function findGestureHandlers(node) {
  let nodes = [];
  function visit(n) {
    if (ts.isVariableDeclaration(n)) {
      const name = n.name.getText();
      if (['handleTouchStart', 'handleTouchMove', 'handleTouchEnd', 'handleClick'].includes(name)) {
        nodes.push(n.parent.parent); 
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(node);
  return nodes;
}

const handlerNodes = findGestureHandlers(sourceFile);
handlerNodes.forEach(n => {
  replacements.push({ start: n.getFullStart(), end: n.getEnd(), text: '' });
});

// Also remove the old refs that were moved to the hook:
// touchStartRef, clickTimerRef, holdTimerRef, isHoldingRef, holdPrevSpeedRef, preventClickRef, lastTapRef, lastTwoFingerTapRef, initialVolRef, initialBrightRef
function findRefs(node) {
  let nodes = [];
  function visit(n) {
    if (ts.isVariableDeclaration(n)) {
      const name = n.name.getText();
      if (['touchStartRef', 'clickTimerRef', 'holdTimerRef', 'isHoldingRef', 'holdPrevSpeedRef', 'preventClickRef', 'lastTapRef', 'lastTwoFingerTapRef', 'initialVolRef', 'initialBrightRef'].includes(name)) {
        nodes.push(n.parent.parent); 
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(node);
  return nodes;
}

const refNodes = findRefs(sourceFile);
refNodes.forEach(n => {
  replacements.push({ start: n.getFullStart(), end: n.getEnd(), text: '' });
});

replacements.sort((a, b) => b.start - a.start);

let newSource = sourceText;
for (const r of replacements) {
  newSource = newSource.substring(0, r.start) + r.text + newSource.substring(r.end);
}

const hookCall = `
    const {
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      handleClick,
    } = useVideoGestures({
      isLocked,
      isDrawMode,
      setIsDrawMode,
      playing,
      muted,
      speed,
      duration,
      currentTime,
      chapters,
      brightness,
      abLoop,
      setAbLoop,
      toggleMute,
      setBrightness,
      showHint,
      setZoomParams,
      setPlaybackRate: setSpeed,
      setScrubDelta,
      setCurrentLine,
      currentLine,
      setDrawLines,
      skip,
      seekTo,
      togglePlay,
      playerRef,
      setShowGestureHint,
      scrubDelta,
      zoomParams
    });
`;

newSource = newSource.replace(/const revealControls = useCallback/, hookCall + '\n    const revealControls = useCallback');
newSource = newSource.replace(/import \{[\s\S]*?\} from \"lucide-react\";/, 
`$&
import { useVideoGestures } from "@/hooks/useVideoGestures";`);

fs.writeFileSync(fileName, newSource);
console.log('Successfully refactored YoutubePlayer.tsx');
