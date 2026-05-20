// src/components/CameraCapture.jsx
// Caméra native via getUserMedia — fiable sur Android Chrome PWA
import { useEffect, useRef, useState } from 'react';

export default function CameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setReady(true);
        }
      } catch (err) {
        setError('Accès caméra refusé. Autorise la caméra dans les paramètres Chrome.');
      }
    }
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    // Flash visuel
    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], 'repas.jpg', { type: 'image/jpeg' });
      // Arrêter la caméra
      streamRef.current?.getTracks().forEach(t => t.stop());
      onCapture(file);
    }, 'image/jpeg', 0.92);
  }

  function handleCancel() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    onCancel();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Flash */}
      {flash && <div className="absolute inset-0 bg-white z-10 pointer-events-none" />}

      {/* Flux vidéo */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full flex-1 object-cover"
        style={{ transform: 'scaleX(1)' }}
      />
      <canvas ref={canvasRef} className="hidden" />

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 bg-black">
          <span className="text-4xl">📷</span>
          <p className="text-white text-center text-sm">{error}</p>
          <button onClick={handleCancel}
            className="px-6 py-3 rounded-2xl bg-violet-600 text-white font-semibold text-sm">
            Retour
          </button>
        </div>
      )}

      {/* Contrôles */}
      {ready && !error && (
        <div className="bg-black/80 px-6 pt-8 pb-24 flex items-center justify-between">
          {/* Annuler */}
          <button onClick={handleCancel}
            className="w-14 h-14 rounded-full border-2 border-white/30 text-white
                       flex items-center justify-center text-sm font-medium
                       active:scale-90 transition-all">
            ✕
          </button>

          {/* Déclencheur photo */}
          <button onClick={capturePhoto}
            className="w-20 h-20 rounded-full bg-white border-4 border-white/50
                       shadow-2xl active:scale-90 transition-transform duration-100
                       flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white border-2 border-gray-300" />
          </button>

          {/* Placeholder symétrie */}
          <div className="w-14" />
        </div>
      )}

      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="w-10 h-10 rounded-full border-2 border-white border-t-transparent animate-spin" />
        </div>
      )}
    </div>
  );
}
