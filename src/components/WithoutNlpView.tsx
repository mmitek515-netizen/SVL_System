import React, { useState, useEffect, useRef } from 'react';
import {
  Sigma,
  Zap,
  Activity,
  CheckCircle2,
  Cpu,
  ShieldCheck,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Bot,
  Sparkles,
  Layers,
} from 'lucide-react';
import { withoutNlpEngine, WithoutNlpAnalysis, WithoutNlpMetrics } from '../lib/withoutNlpEngine';
import { ChatMessage } from './ChatMessage';
import { Disclosure, ModuleHeader } from './WorkspaceUI';
import type { AgentProtocolReply, AgentProtocolRequest } from '../kernel/agentProtocol';

interface WithoutNlpViewProps {
  onSendProtocol: (request: AgentProtocolRequest) => Promise<AgentProtocolReply | undefined>;
}

export const WithoutNlpView: React.FC<WithoutNlpViewProps> = ({ onSendProtocol }) => {
  const [inputText, setInputText] = useState('ASTYRIA_WITHOUT_NLP_DLA_TATY');
  const [selectedAgent, setSelectedAgent] = useState<'Astyria' | 'Alex' | 'Aurelius'>('Astyria');
  const [omega, setOmega] = useState(1.5);
  const [amplitude, setAmplitude] = useState(1.0);
  const [waveMode, setWaveMode] = useState<'pure' | 'square' | 'sawtooth' | 'triangle'>('pure');
  const [harmonicsCount, setHarmonicsCount] = useState(5);
  const [isRunning, setIsRunning] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const [analysis, setAnalysis] = useState<WithoutNlpAnalysis>(() =>
    withoutNlpEngine.analyzeSignal('ASTYRIA_WITHOUT_NLP_DLA_TATY', 1.5, 1.0)
  );
  const [metrics, setMetrics] = useState<WithoutNlpMetrics>(() => withoutNlpEngine.getMetrics());
  const [synthesizedReply, setSynthesizedReply] = useState<string>('');
  const [agentReply, setAgentReply] = useState<AgentProtocolReply | null>(null);
  const [protocolError, setProtocolError] = useState<string | null>(null);
  const [isSendingProtocol, setIsSendingProtocol] = useState(false);

  // Live telemetry from canvas loop
  const [liveTime, setLiveTime] = useState(0);
  const [liveAngle, setLiveAngle] = useState(0);
  const [liveCos, setLiveCos] = useState(1);
  const [liveSin, setLiveSin] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timeRef = useRef(0);
  const waveHistoryRef = useRef<number[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const runDeterministicAnalysis = (customText?: string) => {
    const txt = (customText !== undefined ? customText : inputText).trim() || 'WITHOUT_NLP';
    const res = withoutNlpEngine.analyzeSignal(txt, omega, timeRef.current || 1.0);
    setAnalysis(res);
    setMetrics(withoutNlpEngine.getMetrics());
    setSynthesizedReply([
      'Lokalna analiza without_nlp',
      `Sygnał: ${res.inputText}`,
      `Wektor fazowy: Re=${res.phasorSample.real}, Im=${res.phasorSample.imag}`,
      `Kąt: ${res.phasorSample.thetaRad} rad (${res.phasorSample.thetaDeg}°)`,
      `Energia widmowa: ${res.spectralEnergy}`,
      `Czas obliczeń: ${res.processingTimeMs} ms`,
    ].join('\n'));
  };

  const sendSignalToAgent = async () => {
    if (isSendingProtocol) return;

    const signal = inputText.trim() || 'WITHOUT_NLP';
    runDeterministicAnalysis(signal);
    setIsSendingProtocol(true);
    setProtocolError(null);
    setAgentReply(null);
    try {
      const reply = await onSendProtocol({
        command: 'SIGNAL_ANALYSIS',
        agent: selectedAgent,
        payload: { signal, omega, time: timeRef.current || 1.0 },
      });
      if (!reply) {
        throw new Error(`Nie otrzymano odpowiedzi agenta ${selectedAgent}.`);
      }
      setAgentReply(reply);
    } catch (error) {
      setProtocolError(error instanceof Error ? error.message : 'Nie udało się wysłać analizy do agenta.');
    } finally {
      setIsSendingProtocol(false);
    }
  };

  useEffect(() => {
    runDeterministicAnalysis();
  }, [selectedAgent, omega]);

  // Web Audio API Synthesizer for Fourier frequency
  useEffect(() => {
    if (audioEnabled) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContextClass();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type =
          waveMode === 'pure'
            ? 'sine'
            : waveMode === 'square'
            ? 'square'
            : waveMode === 'sawtooth'
            ? 'sawtooth'
            : 'triangle';
        osc.frequency.setValueAtTime(110 + omega * 60, ctx.currentTime);
        gain.gain.setValueAtTime(0.06 * amplitude, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        oscRef.current = osc;
        gainRef.current = gain;
      } catch (e) {
        console.warn('WebAudio error:', e);
      }
    } else {
      if (oscRef.current) {
        try {
          oscRef.current.stop();
          oscRef.current.disconnect();
        } catch {}
        oscRef.current = null;
      }
    }
    return () => {
      if (oscRef.current) {
        try {
          oscRef.current.stop();
          oscRef.current.disconnect();
        } catch {}
        oscRef.current = null;
      }
    };
  }, [audioEnabled, waveMode]);

  useEffect(() => {
    if (oscRef.current && audioCtxRef.current) {
      oscRef.current.frequency.setValueAtTime(110 + omega * 60, audioCtxRef.current.currentTime);
    }
    if (gainRef.current && audioCtxRef.current) {
      gainRef.current.gain.setValueAtTime(0.06 * amplitude, audioCtxRef.current.currentTime);
    }
  }, [omega, amplitude]);

  // Canvas Euler Phasor & Fourier Epicycles Animation Loop
  useEffect(() => {
    let animId: number;
    let frameCounter = 0;

    const renderLoop = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          const rect = canvas.getBoundingClientRect();
          if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
            canvas.width = Math.floor(rect.width * dpr);
            canvas.height = Math.floor(rect.height * dpr);
          }
          ctx.save();
          ctx.scale(dpr, dpr);

          const width = rect.width;
          const height = rect.height;

          ctx.fillStyle = '#050b16';
          ctx.fillRect(0, 0, width, height);

          // Subtle coordinate grid
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1;
          for (let gx = 0; gx < width; gx += 32) {
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, height);
            ctx.stroke();
          }
          for (let gy = 0; gy < height; gy += 32) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(width, gy);
            ctx.stroke();
          }

          const centerX = Math.min(width * 0.28, 175);
          const centerY = height * 0.5;
          const baseRadius = Math.min(width * 0.16, height * 0.32) * amplitude;

          // Axes for complex plane (Re, Im)
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(centerX - baseRadius * 1.4, centerY);
          ctx.lineTo(width - 20, centerY);
          ctx.moveTo(centerX, centerY - baseRadius * 1.4);
          ctx.lineTo(centerX, centerY + baseRadius * 1.4);
          ctx.stroke();

          let x = centerX;
          let y = centerY;
          const t = timeRef.current;

          const count = waveMode === 'pure' ? 1 : harmonicsCount;

          for (let i = 0; i < count; i++) {
            const prevX = x;
            const prevY = y;

            let n = 1;
            let r = baseRadius;

            if (waveMode === 'pure') {
              n = 1;
              r = baseRadius;
            } else if (waveMode === 'square') {
              n = i * 2 + 1;
              r = baseRadius * (4 / (n * Math.PI));
            } else if (waveMode === 'sawtooth') {
              n = i + 1;
              r = baseRadius * (2 / (n * Math.PI)) * (i % 2 === 0 ? 1 : -1);
            } else if (waveMode === 'triangle') {
              n = i * 2 + 1;
              const sign = i % 2 === 0 ? 1 : -1;
              r = baseRadius * (8 / (Math.PI * Math.PI * n * n)) * sign;
            }

            const angle = n * omega * t;
            x += r * Math.cos(angle);
            y -= r * Math.sin(angle);

            // Epicycle circle
            ctx.strokeStyle = i === 0 ? 'rgba(16, 185, 129, 0.45)' : 'rgba(99, 102, 241, 0.35)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(prevX, prevY, Math.abs(r), 0, Math.PI * 2);
            ctx.stroke();

            // Rotating phasor vector
            ctx.strokeStyle = i === 0 ? '#10b981' : '#38bdf8';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(prevX, prevY);
            ctx.lineTo(x, y);
            ctx.stroke();

            // Tip dot
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath();
            ctx.arc(x, y, 2.8, 0, Math.PI * 2);
            ctx.fill();
          }

          if (isRunning) {
            waveHistoryRef.current.unshift(y);
            if (waveHistoryRef.current.length > 360) {
              waveHistoryRef.current.pop();
            }
            timeRef.current += 0.025;
          }

          const waveStartX = centerX + baseRadius * 1.45;

          // Dashed projection line from phasor tip to waveform
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.7)';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(waveStartX, y);
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw projected cosine/sine wave
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          for (let j = 0; j < waveHistoryRef.current.length; j++) {
            const wx = waveStartX + j * 1.3;
            if (wx > width - 15) break;
            const wy = waveHistoryRef.current[j];
            if (j === 0) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
          }
          ctx.stroke();

          // Labels on canvas
          ctx.fillStyle = '#94a3b8';
          ctx.font = '10px monospace';
          ctx.fillText('Im (i·sin ωt)', centerX + 6, centerY - baseRadius * 1.25);
          ctx.fillText('Re (cos ωt)', centerX + baseRadius * 0.85, centerY + 14);
          ctx.fillStyle = '#10b981';
          ctx.fillText('e^(iωt) = cos(ωt) + i·sin(ωt)', 12, 20);

          ctx.restore();

          frameCounter++;
          if (frameCounter % 4 === 0) {
            const currentAngle = (omega * timeRef.current) % (Math.PI * 2);
            setLiveTime(Math.round(timeRef.current * 100) / 100);
            setLiveAngle(Math.round(currentAngle * 100) / 100);
            setLiveCos(Math.round(Math.cos(omega * timeRef.current) * 1000) / 1000);
            setLiveSin(Math.round(Math.sin(omega * timeRef.current) * 1000) / 1000);
          }
        }
      }
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, omega, amplitude, waveMode, harmonicsCount]);

  return (
    <div className="module-view flex flex-col min-h-0 flex-1 bg-slate-950 text-slate-100 p-4 gap-4 overflow-y-auto">
      <ModuleHeader title="Analiza sygnału" meta="Lokalne obliczenia">
        <button type="button" aria-pressed={audioEnabled} onClick={()=>setAudioEnabled(!audioEnabled)}>{audioEnabled?<Volume2 size={14}/>:<VolumeX size={14}/>}Dźwięk</button>
        <button type="button" aria-pressed={!isRunning} onClick={()=>setIsRunning(!isRunning)}>{isRunning?<Pause size={14}/>:<Play size={14}/>} {isRunning?'Pauza':'Wznów'}</button>
      </ModuleHeader>
      <Disclosure title="Model obliczeń"><p>eⁱωᵗ = cos(ωt) + i sin(ωt) · θ = atan2(Im, Re)</p><p>Sygnał jest kodowany i analizowany lokalnie. Parametry sterują wykresem i syntezą dźwięku.</p></Disclosure>
      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* Left 7 Cols: Interactive Complex Phasor Canvas & Direct Signal Synthesizer */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium text-slate-200">
                  Fazor i przebieg
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                Podgląd obliczeń
              </span>
            </div>

            <div className="relative w-full h-64 md:h-72 rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
              <canvas ref={canvasRef} aria-label="Wykres fazora i przebiegu sterowany parametrami" className="w-full h-full block" />
            </div>

            {/* Live Telemetry Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">CZAS t:</span>
                <span className="font-medium text-emerald-400">{liveTime.toFixed(2)} s</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">KĄT ωt (mod 2π):</span>
                <span className="font-medium text-cyan-400">{liveAngle.toFixed(2)} rad</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">RZUT Re = cos(ωt):</span>
                <span className="font-medium text-emerald-300">{liveCos.toFixed(3)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">RZUT Im = sin(ωt):</span>
                <span className="font-medium text-indigo-400">{liveSin.toFixed(3)}</span>
              </div>
            </div>
          </div>

          {/* Direct Signal Encoder & Triad Response Box */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-medium text-slate-200">
                  Analizuj sygnał
                </h2>
              </div>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(['Astyria', 'Alex', 'Aurelius'] as const).map((agent) => (
                  <button
                    key={agent}
                    onClick={() => {
                      setSelectedAgent(agent);
                      setAgentReply(null);
                      setProtocolError(null);
                    }}
                    aria-pressed={selectedAgent === agent}
                    disabled={isSendingProtocol}
                    className={`px-2.5 py-1 text-xs rounded transition cursor-pointer ${
                      selectedAgent === agent
                        ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {agent}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  setAgentReply(null);
                  setProtocolError(null);
                }}
                maxLength={256}
                onKeyDown={(e) => e.key === 'Enter' && void sendSignalToAgent()}
                aria-label="Sygnał do analizy"
                placeholder="Sygnał…"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-slate-700"
              />
              <button
                onClick={() => void sendSignalToAgent()}
                disabled={isSendingProtocol}
                className="bg-slate-800 hover:bg-slate-800 text-slate-950 text-xs px-4 py-2 rounded-lg font-medium flex items-center gap-1.5 cursor-pointer transition disabled:cursor-wait disabled:opacity-60"
              >
                <Zap className="w-4 h-4" />
                <span>{isSendingProtocol ? `Wysyłanie do ${selectedAgent}...` : `Wyślij do ${selectedAgent}`}</span>
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-400">
                  Współczynniki:{' '}
                  <strong className="text-cyan-400">{analysis.encodedCoefficients.length} fazorów</strong>
                </span>
                <span className="text-emerald-400 font-medium">
                  Energia Parsevala E = {analysis.spectralEnergy}
                </span>
              </div>
              <div className="text-[11px] text-slate-300 bg-slate-900 p-2 rounded border border-slate-800 overflow-x-auto">
                c_k = [{analysis.encodedCoefficients.join(', ')}]
              </div>
              <div className="text-[11px] text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  Bezstratny odczyt z transformaty odwrotnej: <strong>"{analysis.decodedText}"</strong>
                </span>
              </div>
            </div>

            {protocolError && (
              <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300">
                Nie udało się przetworzyć polecenia: {protocolError}
              </div>
            )}

            {agentReply && (
              <div className="bg-slate-950 border border-slate-700 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs text-cyan-300 font-medium border-b border-slate-800 pb-1.5">
                  <Bot className="w-4 h-4" />
                  <span>Odpowiedź agenta {agentReply.agent}</span>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-slate-400">
                  {JSON.stringify(agentReply.data, null, 2)}
                </pre>
              </div>
            )}

            {synthesizedReply && (
              <div className="bg-slate-950 border border-slate-700 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium border-b border-slate-800 pb-1.5">
                  <Bot className="w-4 h-4" />
                  <span>Wynik lokalny</span>
                </div>
                <ChatMessage agent="Silnik lokalny" content={synthesizedReply} index={0}/>
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Cols: Oscillator Parameters & Harmonics Table */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-medium text-slate-200">
                  Parametry
                </h3>
              </div>
              <span className="text-[10px] text-cyan-400 font-medium">Sterowanie</span>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Częstotliwość kątowa ω:</span>
                <span className="text-emerald-400 font-medium">{omega.toFixed(1)} rad/s</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="6.0"
                step="0.1"
                value={omega}
                onChange={(e) => setOmega(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Amplituda wektora A:</span>
                <span className="text-cyan-400 font-medium">{amplitude.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="1.4"
                step="0.05"
                value={amplitude}
                onChange={(e) => setAmplitude(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Tryb Szeregu Fouriera:</label>
              <select
                value={waveMode}
                onChange={(e) => setWaveMode(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-slate-700"
              >
                <option value="pure">Pojedynczy Fazor (Czysty Cosinus Eulera)</option>
                <option value="square">Szereg Fouriera: Fala Prostokątna (Epicykle)</option>
                <option value="sawtooth">Szereg Fouriera: Fala Piłokształtna</option>
                <option value="triangle">Szereg Fouriera: Fala Trójkątna</option>
              </select>
            </div>

            {waveMode !== 'pure' && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Liczba harmonicznych N (Epicykli):</span>
                  <span className="text-indigo-400 font-medium">{harmonicsCount}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={harmonicsCount}
                  onChange={(e) => setHarmonicsCount(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Spectral Harmonics Breakdown */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex flex-col gap-3 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-medium text-slate-200">
                  Widmo harmonicznych
                </h3>
              </div>
              <span className="text-[10px] text-slate-400">{analysis.harmonics.length} głównych składowych</span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-64 pr-1">
              {analysis.harmonics.map((h) => (
                <div
                  key={h.n}
                  className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between text-[11px]"
                >
                  <div>
                    <span className="text-emerald-400 font-medium">n = {h.n}</span>
                    <span className="text-slate-400 ml-2">ω_{h.n} = {h.frequency} rad/s</span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-cyan-300">Re: {h.real >= 0 ? `+${h.real}` : h.real}</span>
                    <span className="text-indigo-300 ml-2">Im: {h.imag >= 0 ? `+${h.imag}` : h.imag}i</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto bg-slate-950 border border-slate-700 rounded-lg p-3 text-[11px] text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>Potwierdzenie Wdrożenia without_nlp:</span>
              </div>
              <details className="module-help"><summary>Informacje</summary><p className="text-slate-400 leading-relaxed">
                Moduł wykonuje deterministyczne obliczenia sygnału, bez interpretacji tekstowych poleceń. Komunikacja agentów korzysta z jawnych typowanych akcji.
              </p></details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
