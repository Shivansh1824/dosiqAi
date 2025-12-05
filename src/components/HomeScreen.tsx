import { Menu, User, ChevronDown, FileText, Pill, Calendar, Camera, Home, Folder, Settings } from 'lucide-react';

interface HomeScreenProps {
  onNavigate: (screen: string) => void;
  onProfileSwitch: () => void;
}

export default function HomeScreen({ onNavigate, onProfileSwitch }: HomeScreenProps) {
  const documents = [
    { id: 1, title: 'Blood Test Results', date: 'Nov 10, 2025', type: 'Lab Report' },
    { id: 2, title: 'X-Ray Chest', date: 'Nov 5, 2025', type: 'Imaging' },
    { id: 3, title: 'Prescription - Dr. Smith', date: 'Nov 1, 2025', type: 'Prescription' },
  ];

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between" style={{ minHeight: '56px' }}>
        <button className="p-2 hover:bg-gray-100 rounded-lg">
          <Menu className="w-6 h-6 text-gray-700" />
        </button>
        <span className="text-gray-900">FamilyCare Health</span>
        <button className="p-2 hover:bg-gray-100 rounded-lg">
          <User className="w-6 h-6 text-gray-700" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="px-6 py-6 space-y-6">
          {/* Profile Switcher Card */}
          <button
            onClick={onProfileSwitch}
            className="w-full bg-gradient-to-br from-[#4A90E2] to-[#66BB6A] rounded-2xl p-6 flex items-center justify-between text-white hover:opacity-90 transition-opacity"
            style={{ minHeight: '56px' }}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <span className="text-lg">Shivansh Rana</span>
            </div>
            <ChevronDown className="w-6 h-6 text-white" />
          </button>

          {/* Quick Stats Card */}
          <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-[#4A90E2]" />
                <span className="text-gray-600">12 Documents</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Pill className="w-5 h-5 text-[#66BB6A]" />
                <span className="text-gray-600">3 Medications</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-orange-500" />
                <div>
                  <span className="text-gray-600">Next appointment</span>
                  <p className="text-gray-900">Tomorrow 9AM</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Documents Section */}
          <div>
            <h3 className="text-gray-900 mb-4">Recent Documents</h3>
            <div className="space-y-3">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => onNavigate('document')}
                  className="w-full bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                  style={{ minHeight: '56px' }}
                >
                  <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-[#4A90E2]" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-gray-900">{doc.title}</p>
                    <p className="text-gray-500">{doc.date}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => onNavigate('scan')}
        className="absolute bottom-24 right-6 w-16 h-16 bg-[#4A90E2] rounded-full flex items-center justify-center shadow-lg hover:bg-[#3A80D2] transition-colors"
        style={{ minWidth: '56px', minHeight: '56px' }}
      >
        <Camera className="w-7 h-7 text-white" />
      </button>

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3">
        <div className="flex items-center justify-around">
          <button className="flex flex-col items-center gap-1 p-2" style={{ minHeight: '56px', minWidth: '56px' }}>
            <Home className="w-6 h-6 text-[#4A90E2]" />
            <span className="text-[#4A90E2]">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-2" style={{ minHeight: '56px', minWidth: '56px' }}>
            <Folder className="w-6 h-6 text-gray-400" />
            <span className="text-gray-400">Documents</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-2" style={{ minHeight: '56px', minWidth: '56px' }}>
            <User className="w-6 h-6 text-gray-400" />
            <span className="text-gray-400">Profile</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-2" style={{ minHeight: '56px', minWidth: '56px' }}>
            <Settings className="w-6 h-6 text-gray-400" />
            <span className="text-gray-400">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
