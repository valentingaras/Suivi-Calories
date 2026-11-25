import { useEffect, useRef, useState } from 'react';
import { BrowserCodeReader, BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Camera, Flashlight, Loader2, X } from 'lucide-react';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

const FOOD_BARCODE_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
];

function createReader(): BrowserMultiFormatReader {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, FOOD_BARCODE_FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints, {
    delayBetweenScanAttempts: 180,
    delayBetweenScanSuccess: 500,
  });
}

export function BarcodeScannerModal({
  open,
  onClose,
  onDetected,
}: BarcodeScannerModalProps) {
  const [cameraError, setCameraError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const detectedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useModalBackHandler(open, onClose);

  const stopCamera = () => {
    try {
      controlsRef.current?.stop();
    } catch {
      // Ignore cleanup errors
    }
    controlsRef.current = null;
    try {
      BrowserCodeReader.releaseAllStreams();
    } catch {
      // Ignore cleanup errors
    }
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }

    let cancelled = false;
    detectedRef.current = false;
    setCameraError('');
    setCameraReady(false);
    setTorchSupported(false);
    setTorchOn(false);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraError(
        'La caméra en direct n’est pas accessible sur ce navigateur. Utilise le bouton « Prendre une photo » ci-dessous.'
      );
      return;
    }

    const startScanner = async () => {
      const videoEl = videoRef.current;
      if (!videoEl) return;

      try {
        const reader = createReader();
        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          },
          videoEl,
          (result) => {
            if (cancelled || detectedRef.current || !result) return;
            const raw = result.getText().trim();
            if (/^\d{8,14}$/.test(raw)) {
              detectedRef.current = true;
              stopCamera();
              onDetectedRef.current(raw);
            }
          }
        );

        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setTorchSupported(Boolean(controls.switchTorch));
        setCameraReady(true);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Accès à la caméra refusé. Autorise la caméra ou utilise le bouton « Prendre une photo ».'
            : 'Impossible de démarrer la caméra en direct. Tu peux prendre une photo du code-barres ci-dessous.';
        setCameraError(msg);
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open]);

  const handleToggleTorch = async () => {
    const ctrl = controlsRef.current;
    if (!ctrl?.switchTorch) return;
    const next = !torchOn;
    try {
      await ctrl.switchTorch(next);
      setTorchOn(next);
    } catch {
      // Ignore if device refuses torch toggle
    }
  };

  const handlePhotoCapture = async (file: File | undefined) => {
    if (!file) return;
    setPhotoLoading(true);
    setCameraError('');
    const objectUrl = URL.createObjectURL(file);
    try {
      const reader = createReader();
      const result = await reader.decodeFromImageUrl(objectUrl);
      const raw = result.getText().trim();
      if (/^\d{8,14}$/.test(raw)) {
        detectedRef.current = true;
        stopCamera();
        onDetectedRef.current(raw);
      } else {
        setCameraError(
          `Code détecté (${raw}) non reconnu comme code-barres alimentaire.`
        );
      }
    } catch {
      setCameraError(
        'Aucun code-barres détecté sur cette photo. Réessaie en cadrant bien le code-barres à plat et net.'
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
      setPhotoLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-scanner-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#25332B] bg-[#101814] text-[#EAF2ED] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#223028] px-4 py-3">
          <h3 id="barcode-scanner-title" className="text-sm font-bold">
            Scanner un code-barres
          </h3>
          <div className="flex items-center gap-1.5">
            {torchSupported && (
              <button
                type="button"
                onClick={() => void handleToggleTorch()}
                aria-label={torchOn ? 'Éteindre la lampe' : 'Allumer la lampe'}
                className={`inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                  torchOn
                    ? 'bg-[#34D399] text-[#072216]'
                    : 'bg-[#1D2B23] text-[#CFE0D6] hover:bg-[#26382E]'
                }`}
              >
                <Flashlight className="h-3.5 w-3.5" aria-hidden="true" />
                Lampe
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer le scanner"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#98ABA0] hover:bg-[#1E2B24] hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative aspect-[4/3] w-full bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
          />

          {/* Targeting Reticle */}
          {!cameraError && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6">
              <div className="relative h-32 w-full max-w-[260px] rounded-xl border-2 border-[#34D399]/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]">
                <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 bg-[#34D399]/80" />
              </div>
              <p className="relative z-10 mt-3 rounded-lg bg-black/60 px-3 py-1 text-xs font-medium text-white">
                {cameraReady
                  ? 'Place le code-barres dans le cadre'
                  : 'Démarrage de la caméra…'}
              </p>
            </div>
          )}

          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#101814]/95 p-6 text-center">
              <p className="text-xs leading-relaxed text-[#FCA5A5]">
                {cameraError}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2.5 p-4">
          <button
            type="button"
            disabled={photoLoading}
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#10B981] px-4 text-sm font-semibold text-[#072216] transition-colors hover:bg-[#34D399] disabled:opacity-60 cursor-pointer"
          >
            {photoLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Camera className="h-4 w-4" aria-hidden="true" />
            )}
            <span>
              {photoLoading
                ? 'Analyse de la photo…'
                : 'Prendre une photo / choisir une image'}
            </span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void handlePhotoCapture(e.target.files?.[0])}
          />

          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[40px] w-full items-center justify-center rounded-xl border border-[#2C3C32] text-xs font-semibold text-[#B9CBC0] transition-colors hover:bg-[#1C2821] cursor-pointer"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
