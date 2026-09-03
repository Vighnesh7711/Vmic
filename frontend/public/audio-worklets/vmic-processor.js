class VMICProcessor extends AudioWorkletProcessor {

  process(
    inputs,
    outputs
  ) {

    const input =
      inputs[0];

    const output =
      outputs[0];


    if (
      !input ||
      input.length === 0
    ) {

      return true;

    }


    /*
     * Process each channel.
     */

    for (
      let channel = 0;
      channel < output.length;
      channel++
    ) {

      const inputChannel =
        input[channel];

      const outputChannel =
        output[channel];


      if (!inputChannel || !outputChannel) {
        continue;
      }


      for (
        let i = 0;
        i < inputChannel.length;
        i++
      ) {

        outputChannel[i] =
          inputChannel[i];

      }

    }


    /*
     * Calculate RMS.
     */

    let sum = 0;

    let count = 0;


    for (
      const channel of input
    ) {

      for (
        const sample of channel
      ) {

        sum +=
          sample * sample;

        count++;

      }

    }


    const rms =
      count > 0
        ? Math.sqrt(
            sum / count
          )
        : 0;


    this.port.postMessage({
      type: "audio_level",
      level: rms,
    });


    return true;

  }

}


registerProcessor(
  "vmic-processor",
  VMICProcessor
);
