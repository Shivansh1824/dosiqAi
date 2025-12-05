import { Plus, Users } from 'lucide-react';

interface Onboarding2ScreenProps {
  onContinue: () => void;
}

export default function Onboarding2Screen({ onContinue }: Onboarding2ScreenProps) {
  return (
    <div className="h-full bg-white flex flex-col items-center justify-between px-8 py-12">
      <div className="flex-1 flex flex-col items-center">
        {/* Small Logo */}
        <div
          className="w-[60px] h-[60px] rounded-full flex items-center justify-center mb-12"
          style={{
            background: 'linear-gradient(135deg, #4A90E2 0%, #66BB6A 100%)',
          }}
        >
          <Plus className="w-8 h-8 text-white" strokeWidth={3} />
        </div>

        {/* Large Icon */}
        <div className="flex-1 flex items-center justify-center">
          <Users className="w-[200px] h-[200px] text-[#66BB6A]" strokeWidth={1.5} />
        </div>

        {/* Title */}
        <h2 className="text-[24pt] text-center mb-4" style={{ fontWeight: 'bold' }}>
          Multiple Profiles
        </h2>

        {/* Description */}
        <p className="text-[16pt] text-gray-500 text-center max-w-[320px] mb-8">
          Create profiles for each family member and manage their health separately
        </p>

        {/* Pagination Dots */}
        <div className="flex gap-2 mb-8">
          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
          <div className="w-3 h-3 rounded-full bg-[#4A90E2]"></div>
          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
        </div>
      </div>

      {/* Continue Button */}
      <button
        onClick={onContinue}
        className="px-12 py-3 bg-transparent border-2 border-[#4A90E2] text-[#4A90E2] rounded-full hover:bg-[#4A90E2] hover:text-white transition-all mx-auto block"
        style={{ minHeight: '48px' }}
      >
        Continue
      </button>
    </div>
  );
}