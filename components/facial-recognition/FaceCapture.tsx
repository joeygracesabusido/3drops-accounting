'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface FaceCaptureProps {
  onCapture?: (descriptor: Float32Array) => void;
  mode?: 'enroll' | 'verify';
  storedDescriptor?: number[];
  onVerify?: (isMatch: boolean, distance: number) => void;
}

type LoadingStep = 'idle' | 'loading-models' | 'starting-camera' | 'ready' | 'processing' | 'error';

export default function FaceCapture({
  onCapture,
  mode = 'enroll',
  storedDescriptor,
  onVerify,
}: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceapiRef = useRef<any>(null);
  const [step, setStep] = useState<LoadingStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [captureResult, setCaptureResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Stop webcam stream helper
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        setStep('loading-models');
        setError(null);

        // Dynamically import face-api.js so it only runs on the client
        const faceapi = await import('face-api.js');
        faceapiRef.current = faceapi;

        const MODEL_URL = '/models';

        // Load all three required nets
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        if (cancelled) return;

        setStep('starting-camera');

        // navigator.mediaDevices is only available in secure contexts (HTTPS or localhost)
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          if (!isLocalhost) {
            throw new Error(
              'Camera access requires a secure connection (HTTPS). ' +
              'You are accessing this page over HTTP. Please use https:// or open the page on localhost.'
            );
          }
          throw new Error('Camera is not available on this device or browser.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStep('ready');
      } catch (err: unknown) {
        if (cancelled) return;
        console.error('[FaceCapture] Init error:', err);

        const msg = err instanceof Error ? err.message : String(err);

        if (msg.includes('NotAllowedError') || msg.includes('Permission denied')) {
          setError('Camera permission denied. Please allow camera access and try again.');
        } else if (msg.includes('fetch') || msg.includes('404') || msg.includes('Failed to fetch')) {
          setError(
            'AI model files not found in /public/models. Please ensure the face-api.js model files are downloaded.'
          );
        } else {
          setError(`Initialization failed: ${msg}`);
        }
        setStep('error');
      }
    };

    init();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [stopStream]);

  const handleCapture = async () => {
    const faceapi = faceapiRef.current;
    if (!faceapi || !videoRef.current || step !== 'ready') return;

    setStep('processing');
    setCaptureResult(null);
    setError(null);

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setError('No face detected. Please center your face in the camera and ensure good lighting.');
        setStep('ready');
        return;
      }

      const descriptor = detection.descriptor;

      if (mode === 'enroll' && onCapture) {
        onCapture(descriptor);
        setCaptureResult({ success: true, message: '✓ Face captured successfully!' });
      } else if (mode === 'verify' && storedDescriptor && onVerify) {
        const distance = faceapi.euclideanDistance(storedDescriptor, descriptor);
        const isMatch = distance < 0.6;
        onVerify(isMatch, distance);
        setCaptureResult({
          success: isMatch,
          message: isMatch
            ? `✓ Identity verified! (confidence: ${((1 - distance) * 100).toFixed(0)}%)`
            : `✗ Face not recognized (distance: ${distance.toFixed(2)})`,
        });
      }
    } catch (err: unknown) {
      console.error('[FaceCapture] Capture error:', err);
      setError('An error occurred during face processing. Please try again.');
    } finally {
      setStep('ready');
    }
  };

  const handleRetry = () => {
    setError(null);
    setCaptureResult(null);
    setStep('idle');
    stopStream();
    // Re-trigger init by remounting — parent should handle this,
    // but we can force a reload for the retry pattern
    window.location.reload();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
      {/* Status banner */}
      {step === 'loading-models' && (
        <div className="w-full flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
          <span>Loading AI facial recognition models… (first load may take a moment)</span>
        </div>
      )}

      {step === 'starting-camera' && (
        <div className="w-full flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
          <span>Starting camera…</span>
        </div>
      )}

      {error && (
        <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm font-medium">{error}</p>
          {step === 'error' && (
            <button
              onClick={handleRetry}
              className="mt-2 text-xs text-red-600 underline hover:text-red-800"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {captureResult && (
        <div
          className={`w-full p-3 rounded-lg border text-sm font-medium ${
            captureResult.success
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {captureResult.message}
        </div>
      )}

      {/* Video feed */}
      <div className="relative overflow-hidden rounded-lg border-4 border-white shadow-lg bg-black w-full max-w-md aspect-video">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />
        {/* Overlay guide when ready */}
        {step === 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-40 h-48 border-2 border-dashed border-white/60 rounded-full" />
          </div>
        )}
      </div>

      {/* Capture button */}
      <button
        onClick={handleCapture}
        disabled={step !== 'ready'}
        className={`w-full max-w-xs px-6 py-3 rounded-full font-semibold text-sm transition-all ${
          step === 'ready'
            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {step === 'processing'
          ? 'Processing…'
          : step === 'loading-models'
          ? 'Loading models…'
          : step === 'starting-camera'
          ? 'Starting camera…'
          : mode === 'enroll'
          ? 'Capture Face'
          : 'Verify Identity'}
      </button>

      {step === 'ready' && (
        <p className="text-xs text-slate-400 text-center">
          Center your face in the oval guide, then click Capture Face.
        </p>
      )}
    </div>
  );
}
