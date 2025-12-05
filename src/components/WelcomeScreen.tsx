import Logo from './Logo';

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export default function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  return (
    <div className="h-full bg-gradient-to-b from-white to-blue-50/30 flex flex-col items-center justify-between px-8 py-20">
      <div className="flex-1 flex flex-col items-center justify-center space-y-6">
        {/* Logo */}
        <div className="mb-4">
          <Logo />
        </div>

        {/* Subtitle */}
        <p className="text-[18pt] text-gray-600 text-center max-w-[340px] leading-relaxed">
          Your family's health records in one secure place
        </p>
      </div>

      {/* Get Started Button */}
      <button
        onClick={onGetStarted}
        className="px-16 py-4 bg-[#4A90E2] text-white rounded-full hover:bg-[#3A80D2] hover:shadow-lg transition-all mx-auto block shadow-md"
        style={{ minHeight: '52px' }}
      >
        Get Started
      </button>
    </div>
  );
}