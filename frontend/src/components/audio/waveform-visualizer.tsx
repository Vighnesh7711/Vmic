"use client";

import { useEffect, useRef, useState } from "react";

interface WaveformVisualizerProps {
  analyser: AnalyserNode | null;
  height?: number;
  showFeedbackWarning?: boolean;
  onPatternDetected?: (hasPattern: boolean, delayMs: number) => void;
}

export function WaveformVisualizer({
  analyser,
  height = 120,
  showFeedbackWarning = true,
  onPatternDetected,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [feedbackDetected, setFeedbackDetected] = useState(false);
  const [detectedDelayMs, setDetectedDelayMs] = useState(0);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const bufferLength = analyser.frequencyBinCount;
    const timeData = new Uint8Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);

    // Buffer for auto-correlation pattern detection
    const historyBuffer: number[] = [];
    const maxHistory = 48000 * 0.4; // 400ms at 48kHz

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(timeData);
      analyser.getByteFrequencyData(freqData);

      const width = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, width, h);

      // --- Draw Grid Background ---
      ctx.strokeStyle = "rgba(30, 41, 59, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(width, h / 2);
      ctx.stroke();

      // --- Draw Frequency Bars (Background) ---
      const barWidth = (width / bufferLength) * 2.5;
      let xBar = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (freqData[i] / 255) * (h * 0.6);
        ctx.fillStyle = `rgba(16, 185, 129, ${0.1 + (freqData[i] / 255) * 0.3})`;
        ctx.fillRect(xBar, h - barHeight, barWidth, barHeight);
        xBar += barWidth + 1;
      }

      // --- Draw Time-Domain Waveform ---
      ctx.lineWidth = 2;
      ctx.strokeStyle = feedbackDetected ? "#ef4444" : "#10b981"; // Red if feedback loop detected
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      // Auto-correlation calculation to find repeated delay patterns
      let peakCorrelation = 0;
      let detectedLag = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = timeData[i] / 128.0;
        const y = (v * h) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;

        // Push normalized sample (-1 to +1) to history
        historyBuffer.push(v - 1.0);
        if (historyBuffer.length > maxHistory) {
          historyBuffer.shift();
        }
      }

      ctx.stroke();

      // --- Auto-Correlation Pattern Detection ---
      // Scans for repeated audio frame lag between 30ms and 350ms
      if (historyBuffer.length >= 2000) {
        const sampleRate = 48000;
        const minLag = Math.floor(sampleRate * 0.03); // 30ms
        const maxLag = Math.floor(sampleRate * 0.35); // 350ms
        const step = 64; // skip steps for performance

        let maxCorr = 0;
        let bestLag = 0;

        for (let lag = minLag; lag < maxLag; lag += step) {
          let dotProduct = 0;
          let normA = 0;
          let normB = 0;
          const count = 512;
          const endIdx = historyBuffer.length - 1;

          for (let k = 0; k < count; k++) {
            const a = historyBuffer[endIdx - k] || 0;
            const b = historyBuffer[endIdx - k - lag] || 0;
            dotProduct += a * b;
            normA += a * a;
            normB += b * b;
          }

          if (normA > 0.001 && normB > 0.001) {
            const corr = dotProduct / (Math.sqrt(normA * normB) + 1e-6);
            if (corr > maxCorr) {
              maxCorr = corr;
              bestLag = lag;
            }
          }
        }

        const isLooping = maxCorr > 0.72; // High correlation threshold indicating repeated echo loop
        const delayMs = Math.round((bestLag / sampleRate) * 1000);

        setFeedbackDetected(isLooping);
        setDetectedDelayMs(delayMs);

        if (onPatternDetected) {
          onPatternDetected(isLooping, delayMs);
        }
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [analyser, onPatternDetected]);

  return (
    <div className="relative w-full rounded-xl border border-gray-800 bg-gray-950 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          🌊 Live Waveform & Pattern Spectrum
        </span>

        {showFeedbackWarning && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase transition ${
              feedbackDetected
                ? "animate-pulse border border-red-500/50 bg-red-500/20 text-red-400"
                : "border border-green-500/30 bg-green-500/10 text-green-400"
            }`}
          >
            {feedbackDetected
              ? `⚠️ Echo Loop Pattern (${detectedDelayMs}ms)`
              : "✓ Clear Pattern"}
          </span>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={500}
        height={height}
        className="w-full rounded-lg bg-gray-950"
      />
    </div>
  );
}
