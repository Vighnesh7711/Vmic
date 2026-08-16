/**
 * Vmic — AudioWorklet Mixer Processor.
 *
 * Runs on the dedicated Web Audio rendering thread to perform sample-accurate
 * multichannel summing of all participant audio inputs into a clean stereo mix.
 */

class VmicMixerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const outLeft = output[0];
    const outRight = output[1] || output[0];
    const numSamples = outLeft.length;

    // Zero out the output buffers
    for (let i = 0; i < numSamples; i++) {
      outLeft[i] = 0.0;
      outRight[i] = 0.0;
    }

    // Accumulate all active input channels
    for (let inputIdx = 0; inputIdx < inputs.length; inputIdx++) {
      const input = inputs[inputIdx];
      if (input && input.length > 0) {
        const inLeft = input[0];
        const inRight = input[1] || inLeft;

        for (let i = 0; i < numSamples; i++) {
          outLeft[i] += inLeft[i] || 0.0;
          outRight[i] += inRight[i] || 0.0;
        }
      }
    }

    return true;
  }
}

registerProcessor("vmic-mixer-processor", VmicMixerProcessor);
