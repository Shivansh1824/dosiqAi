import { useState } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import Onboarding1Screen from './components/Onboarding1Screen';
import Onboarding2Screen from './components/Onboarding2Screen';
import Onboarding3Screen from './components/Onboarding3Screen';
import HomeScreen from './components/HomeScreen';
import ScanDocumentScreen from './components/ScanDocumentScreen';
import DocumentDetailScreen from './components/DocumentDetailScreen';
import ProfileSwitcherModal from './components/ProfileSwitcherModal';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('welcome');
  const [showProfileModal, setShowProfileModal] = useState(false);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'welcome':
        return <WelcomeScreen onGetStarted={() => setCurrentScreen('onboarding1')} />;
      case 'onboarding1':
        return <Onboarding1Screen onContinue={() => setCurrentScreen('onboarding2')} />;
      case 'onboarding2':
        return <Onboarding2Screen onContinue={() => setCurrentScreen('onboarding3')} />;
      case 'onboarding3':
        return <Onboarding3Screen onGetStarted={() => setCurrentScreen('home')} />;
      case 'home':
        return (
          <HomeScreen
            onNavigate={setCurrentScreen}
            onProfileSwitch={() => setShowProfileModal(true)}
          />
        );
      case 'scan':
        return <ScanDocumentScreen onBack={() => setCurrentScreen('home')} />;
      case 'document':
        return <DocumentDetailScreen onBack={() => setCurrentScreen('home')} />;
      default:
        return <WelcomeScreen onGetStarted={() => setCurrentScreen('onboarding1')} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="w-full max-w-[428px] h-screen bg-white shadow-2xl overflow-hidden relative">
        {renderScreen()}
        {showProfileModal && (
          <ProfileSwitcherModal onClose={() => setShowProfileModal(false)} />
        )}
      </div>
    </div>
  );
}
