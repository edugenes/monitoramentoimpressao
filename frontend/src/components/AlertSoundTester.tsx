'use client';

import { useEffect } from 'react';
import { playAlertSound, unlockAudio, isAudioSupported } from '@/lib/sound';
import { Volume2, AlertOctagon, AlertTriangle, Info } from 'lucide-react';

export default function AlertSoundTester() {
  const supported = isAudioSupported();

  useEffect(() => {
    // Desbloqueia o audio na primeira interacao do usuario com a pagina
    function onClick() {
      unlockAudio();
      window.removeEventListener('click', onClick);
    }
    window.addEventListener('click', onClick, { once: true });
    return () => window.removeEventListener('click', onClick);
  }, []);

  if (!supported) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        Este navegador não suporta áudio programado. Tente no Chrome ou Edge.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Volume2 className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-800">Testar sons dos alertas</h3>
        <span className="text-xs text-slate-500 ml-auto">
          Clique nos botões para ouvir cada tipo
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <button
          onClick={() => playAlertSound('critical')}
          className="flex items-center gap-2 px-3 py-2.5 text-sm text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors"
        >
          <AlertOctagon className="h-4 w-4 flex-shrink-0" />
          <div className="text-left">
            <div className="font-medium">Crítico</div>
            <div className="text-[10px] text-red-600/80">3 beeps agudos</div>
          </div>
        </button>

        <button
          onClick={() => playAlertSound('warning')}
          className="flex items-center gap-2 px-3 py-2.5 text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <div className="text-left">
            <div className="font-medium">Aviso</div>
            <div className="text-[10px] text-amber-600/80">2 beeps médios</div>
          </div>
        </button>

        <button
          onClick={() => playAlertSound('info')}
          className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
        >
          <Info className="h-4 w-4 flex-shrink-0" />
          <div className="text-left">
            <div className="font-medium">Info</div>
            <div className="text-[10px] text-slate-500">1 beep curto</div>
          </div>
        </button>
      </div>

      <p className="text-xs text-slate-500 mt-3">
        Quando chega um alerta novo, o sistema toca automaticamente o som correspondente à gravidade. Use o botão de <strong>silenciar</strong> no sino do menu se não quiser ouvir.
      </p>
    </div>
  );
}
