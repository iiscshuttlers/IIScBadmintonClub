export class StringTuner {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private animationFrameId: number = 0;

  private onTensionDetected: (tension: number, frequency: number) => void;
  private isListening: boolean = false;

  constructor(onTensionDetected: (tension: number, frequency: number) => void) {
    this.onTensionDetected = onTensionDetected;
  }

  public async startListening() {
    if (this.isListening) return;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("SECURE_CONTEXT_REQUIRED");
      }

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 4096; // High resolution for frequency accuracy
      this.analyser.smoothingTimeConstant = 0.2; // Quick response for percussive hits
      
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);
      
      this.isListening = true;
      this.processAudio();
    } catch (error) {
      console.error("Microphone access denied or error:", error);
      throw error;
    }
  }

  public stopListening() {
    this.isListening = false;
    cancelAnimationFrame(this.animationFrameId);

    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  private processAudio = () => {
    if (!this.isListening || !this.analyser || !this.audioContext) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    const sampleRate = this.audioContext.sampleRate;
    
    // Find peak frequency
    let maxVolume = -1;
    let peakIndex = -1;

    // Badminton ping usually between 800Hz and 1500Hz
    const minFreqIndex = Math.floor(800 * bufferLength / (sampleRate / 2));
    const maxFreqIndex = Math.floor(1500 * bufferLength / (sampleRate / 2));

    for (let i = minFreqIndex; i <= maxFreqIndex; i++) {
      if (dataArray[i] > maxVolume) {
        maxVolume = dataArray[i];
        peakIndex = i;
      }
    }

    // Threshold volume to consider it a string "ping" (e.g., racket tapped against palm)
    if (maxVolume > 200 && peakIndex !== -1) {
      const frequency = peakIndex * (sampleRate / 2) / bufferLength;
      
      // Calculate tension
      // Baseline approximation: 1000 Hz = 22 lbs, slope = 3 lbs / 100 Hz
      let tensionLbs = (frequency - 1000) * 0.03 + 22;
      
      // Clamp values to realistic ranges
      if (tensionLbs >= 15 && tensionLbs <= 40) {
        this.onTensionDetected(Number(tensionLbs.toFixed(1)), Math.round(frequency));
      }
    }

    this.animationFrameId = requestAnimationFrame(this.processAudio);
  }
}
