import { X, User, Check, Plus } from 'lucide-react';

interface ProfileSwitcherModalProps {
  onClose: () => void;
}

export default function ProfileSwitcherModal({ onClose }: ProfileSwitcherModalProps) {
  const familyMembers = [
    { id: 1, name: 'Shivansh Rana', role: 'Admin', documents: 12, active: true },
    { id: 2, name: 'Priya Rana', role: 'Member', documents: 8, active: false },
    { id: 3, name: 'Arjun Rana', role: 'Member', documents: 5, active: false },
    { id: 4, name: 'Grandma Lakshmi', role: 'Member', documents: 15, active: false },
  ];

  return (
    <div className="absolute inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="w-full bg-white rounded-t-3xl max-h-[80vh] overflow-hidden flex flex-col animate-slide-up">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between" style={{ minHeight: '56px' }}>
          <h2 className="text-gray-900">Select Family Member</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-6 h-6 text-gray-700" />
          </button>
        </div>

        {/* Family Members List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {familyMembers.map((member) => (
            <button
              key={member.id}
              className={`w-full p-4 rounded-xl flex items-center justify-between transition-colors ${
                member.active
                  ? 'bg-[#4A90E2]/10 border-2 border-[#4A90E2]'
                  : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
              }`}
              style={{ minHeight: '56px' }}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    member.active ? 'bg-[#4A90E2]' : 'bg-gray-300'
                  }`}
                >
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-gray-900">{member.name}</p>
                  <p className="text-gray-500">
                    {member.role} • {member.documents} documents
                  </p>
                </div>
              </div>
              {member.active && (
                <Check className="w-6 h-6 text-[#4A90E2]" strokeWidth={3} />
              )}
            </button>
          ))}
        </div>

        {/* Add Family Member Button */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-center">
          <button
            className="px-8 py-3 bg-transparent border-2 border-[#66BB6A] text-[#66BB6A] rounded-full hover:bg-[#66BB6A] hover:text-white transition-all flex items-center justify-center gap-2"
            style={{ minHeight: '48px' }}
          >
            <Plus className="w-5 h-5" />
            Add Family Member
          </button>
        </div>
      </div>
    </div>
  );
}