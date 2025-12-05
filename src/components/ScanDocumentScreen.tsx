import { ArrowLeft, Check, Camera, Image, Zap } from 'lucide-react';

interface ScanDocumentScreenProps {
  onBack: () => void;
}

export default function ScanDocumentScreen({ onBack }: ScanDocumentScreenProps) {
  return (
    <div className="h-full bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between" style={{ minHeight: '56px' }}>
        <button onClick={onBack} className="p-2 hover:bg-gray-800 rounded-lg">
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <span className="text-white">Scan Document</span>
        <button className="p-2 hover:bg-gray-800 rounded-lg">
          <Check className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Camera Viewfinder */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="relative w-full max-w-sm aspect-[3/4] bg-gray-800 rounded-2xl overflow-hidden">
          {/* Simulated Camera View */}
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
            <Camera className="w-20 h-20 text-gray-600" />
          </div>
          
          {/* Dashed Border Overlay Guide */}
          <div className="absolute inset-4 border-4 border-dashed border-white/50 rounded-xl"></div>
        </div>

        {/* Helper Text */}
        <p className="text-white/80 text-center mt-6">
          Position document within the frame
        </p>
      </div>

      {/* Bottom Controls */}
      <div className="px-6 pb-12 space-y-6">
        {/* Capture Button */}
        <div className="flex justify-center">
          <button
            className="w-20 h-20 bg-white rounded-full flex items-center justify-center border-4 border-gray-700 hover:bg-gray-100 transition-colors"
            style={{ minWidth: '56px', minHeight: '56px' }}
          >
            <div className="w-16 h-16 bg-white rounded-full border-2 border-gray-300"></div>
          </button>
        </div>

        {/* Gallery and Flash Buttons */}
        <div className="flex items-center justify-center gap-12">
          <button className="flex flex-col items-center gap-2 p-2" style={{ minHeight: '56px', minWidth: '56px' }}>
            <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors">
              <Image className="w-6 h-6 text-white" />
            </div>
            <span className="text-white">Gallery</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-2" style={{ minHeight: '56px', minWidth: '56px' }}>
            <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-white">Flash</span>
          </button>
        </div>
      </div>
    </div>
  );
}
