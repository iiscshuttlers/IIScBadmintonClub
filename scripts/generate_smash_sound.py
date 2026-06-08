import numpy as np
import scipy.io.wavfile as wavfile
import os

sample_rate = 44100
duration = 0.3 # 300ms
t = np.linspace(0, duration, int(sample_rate * duration), False)

# Generate white noise
noise = np.random.normal(0, 1, len(t))

# Create an exponential decay envelope (very sharp decay for a "smack" sound)
envelope = np.exp(-t * 20)

# Add some low frequency thump
thump = np.sin(2 * np.pi * 100 * t) * np.exp(-t * 15)

# Combine and apply envelope
audio = (noise * 0.5 + thump * 0.8) * envelope

# Normalize to 16-bit PCM
audio_normalized = np.int16((audio / np.max(np.abs(audio))) * 32767)

# Save to the android raw folder
output_path = r"e:\Github\iiscshuttlers\android\app\src\main\res\raw\smash.wav"
wavfile.write(output_path, sample_rate, audio_normalized)
print(f"Generated {output_path}")
