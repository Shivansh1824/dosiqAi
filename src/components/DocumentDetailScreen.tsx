import { ArrowLeft, Trash2, FileText, Share2, Download } from 'lucide-react';

interface DocumentDetailScreenProps {
  onBack: () => void;
}

export default function DocumentDetailScreen({ onBack }: DocumentDetailScreenProps) {
  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between" style={{ minHeight: '56px' }}>
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <span className="text-gray-900">Lab Report</span>
        <button className="p-2 hover:bg-gray-100 rounded-lg">
          <Trash2 className="w-6 h-6 text-red-500" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6 space-y-6">
          {/* Document Preview Card */}
          <div className="bg-gray-50 rounded-2xl p-8 flex items-center justify-center aspect-[3/4]">
            <div className="text-center">
              <FileText className="w-24 h-24 text-[#4A90E2] mx-auto mb-4" />
              <p className="text-gray-600">Document Preview</p>
            </div>
          </div>

          {/* Metadata Section */}
          <div className="space-y-4">
            <h3 className="text-gray-900">Details</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Date</span>
                <span className="text-gray-900">Nov 10, 2025</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Type</span>
                <span className="text-gray-900">Lab Report</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Patient</span>
                <span className="text-gray-900">Shivansh Rana</span>
              </div>
            </div>
          </div>

          {/* Tags Section */}
          <div className="space-y-3">
            <h3 className="text-gray-900">Tags</h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-4 py-2 bg-blue-100 text-[#4A90E2] rounded-full">
                Blood Test
              </span>
              <span className="px-4 py-2 bg-green-100 text-[#66BB6A] rounded-full">
                Annual Checkup
              </span>
              <span className="px-4 py-2 bg-purple-100 text-purple-600 rounded-full">
                Important
              </span>
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-3">
            <h3 className="text-gray-900">Notes</h3>
            <textarea
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
              rows={4}
              placeholder="Add notes about this document..."
              defaultValue="All results are within normal range. Follow up in 6 months."
            />
          </div>
        </div>
      </div>

      {/* Bottom Buttons */}
      <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-center">
        <button
          className="px-8 py-3 bg-transparent border-2 border-gray-300 text-gray-700 rounded-full hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
          style={{ minHeight: '48px' }}
        >
          <Download className="w-5 h-5" />
          Export
        </button>
        <button
          className="px-8 py-3 bg-transparent border-2 border-[#4A90E2] text-[#4A90E2] rounded-full hover:bg-[#4A90E2] hover:text-white transition-all flex items-center justify-center gap-2"
          style={{ minHeight: '48px' }}
        >
          <Share2 className="w-5 h-5" />
          Share
        </button>
      </div>
    </div>
  );
}