// import * as tf from "@tensorflow/tfjs"; // Uncomment when npm cache is fixed

export type StrokeType = "Smash" | "Drop" | "Clear" | "Drive" | "Unknown";

export interface StrokeClassification {
  type: StrokeType;
  confidence: number;
  peakAcceleration: number;
}

/**
 * Given a window of accelerometer (and gyroscope) data for a single rally,
 * attempts to classify the predominant stroke type using a local TF.js model.
 * If the model is not loaded/available, falls back to a heuristic peak-acceleration algorithm.
 */
export async function classifyStroke(sensorSamples: { time: number; ax: number; ay: number; az: number }[]): Promise<StrokeClassification> {
  if (!sensorSamples || sensorSamples.length === 0) {
    return { type: "Unknown", confidence: 0, peakAcceleration: 0 };
  }

  // Calculate magnitude of acceleration per sample
  const magnitudes = sensorSamples.map(s => Math.sqrt(s.ax * s.ax + s.ay * s.ay + s.az * s.az));
  const peakAcceleration = Math.max(...magnitudes);

  try {
    // Scaffold for actual TF.js model loading
    // const model = await tf.loadLayersModel('/models/stroke_classifier/model.json');
    // const inputTensor = tf.tensor([magnitudes]);
    // const prediction = model.predict(inputTensor) as tf.Tensor;
    // ...
    throw new Error("No model loaded"); 
  } catch (err) {
    // Heuristic fallback for V1
    let type: StrokeType = "Unknown";
    let confidence = 0.5;

    // Assuming gravity is ~9.8 m/s^2. A smash is typically > 4G (39.2 m/s^2)
    if (peakAcceleration > 40) {
      type = "Smash";
      confidence = 0.85 + Math.min(0.1, (peakAcceleration - 40) / 200);
    } else if (peakAcceleration > 25) {
      type = "Clear";
      confidence = 0.7;
    } else if (peakAcceleration > 15) {
      type = "Drive";
      confidence = 0.6;
    } else {
      type = "Drop";
      confidence = 0.5;
    }

    return {
      type,
      confidence,
      peakAcceleration
    };
  }
}
