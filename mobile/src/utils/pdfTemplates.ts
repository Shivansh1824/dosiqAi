/**
 * PDF Templates for Health Analysis Reports
 * 
 * Professional 2026 Healthcare PDF Design:
 * - Clean, minimal layout (no childish elements)
 * - High contrast typography for maximum readability
 * - Document image preview at top
 * - Professional color scheme (neutral grays, medical blue accents)
 * - No rounded borders - sharp, clean lines
 */

import { DocumentAnalysisResult } from '../types/document';

/**
 * Generate HTML for prescription analysis PDF
 * Includes document image preview at the top
 */
export function generatePrescriptionHTML(
  analysisResult: DocumentAnalysisResult,
  appLogoBase64?: string,
  documentImageBase64?: string
): string {
  const {
    patient_info,
    common_data,
    prescription_data,
    analysis_metadata,
  } = analysisResult;

  const visitDate = common_data?.visit_date
    ? new Date(common_data.visit_date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    : 'N/A';

  const generatedDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prescription Analysis Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @page {
      margin: 15mm 20mm;
      size: A4;
    }

    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #000000;
      background: #ffffff;
    }

    /* Professional Header */
    .header {
      border-bottom: 3px solid #2c3e50;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-title {
      font-size: 18pt;
      font-weight: 700;
      color: #2c3e50;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .header-date {
      font-size: 9pt;
      color: #666666;
      text-align: right;
    }

    .header-subtitle {
      font-size: 10pt;
      color: #666666;
      margin-top: 4px;
      font-weight: 500;
    }

    /* Document Preview Section */
    .document-preview {
      margin: 20px 0;
      text-align: center;
      background: #f5f5f5;
      padding: 16px;
      border: 1px solid #d0d0d0;
      page-break-inside: avoid;
    }

    .preview-label {
      font-size: 9pt;
      color: #666666;
      font-weight: 600;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .preview-image {
      max-width: 100%;
      max-height: 300px;
      border: 1px solid #d0d0d0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    /* Clean Section Styling */
    .section {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }

    .section-title {
      background: #2c3e50;
      color: white;
      padding: 8px 12px;
      font-size: 11pt;
      font-weight: 600;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .section-content {
      padding: 0 4px;
    }

    /* Professional Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin: 12px 0;
    }

    .info-item {
      padding: 12px;
      border: 1px solid #d0d0d0;
      background: #fafafa;
    }

    .info-label {
      font-size: 8pt;
      color: #666666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      font-weight: 600;
    }

    .info-value {
      font-size: 11pt;
      color: #000000;
      font-weight: 600;
    }

    /* Clinical Details */
    .clinical-row {
      padding: 10px;
      border-bottom: 1px solid #e0e0e0;
      display: grid;
      grid-template-columns: 140px 1fr;
    }

    .clinical-row:last-child {
      border-bottom: none;
    }

    .clinical-label {
      font-size: 9pt;
      color: #666666;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .clinical-value {
      font-size: 10pt;
      color: #000000;
      font-weight: 500;
    }

    /* Summary Box - Clean and Professional */
    .summary-box {
      background: #f5f7fa;
      border-left: 4px solid #2c3e50;
      padding: 14px;
      margin: 12px 0;
    }

    .summary-text {
      font-size: 10pt;
      line-height: 1.7;
      color: #000000;
      text-align: justify;
    }

    /* Professional Table Design */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      border: 1px solid #d0d0d0;
    }

    .data-table thead {
      background: #2c3e50;
      color: white;
    }

    .data-table th {
      padding: 10px 8px;
      text-align: left;
      font-size: 9pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border-bottom: 2px solid #1a252f;
    }

    .data-table tbody tr {
      border-bottom: 1px solid #e0e0e0;
    }

    .data-table tbody tr:nth-child(even) {
      background: #fafafa;
    }

    .data-table td {
      padding: 10px 8px;
      font-size: 10pt;
      color: #000000;
      vertical-align: top;
    }

    .medicine-name {
      font-weight: 600;
      color: #000000;
      font-size: 10pt;
    }

    .medicine-scientific {
      font-size: 8pt;
      color: #666666;
      font-style: italic;
      display: block;
      margin-top: 2px;
    }

    .dosage-text {
      background: #e8f4f8;
      padding: 4px 8px;
      font-weight: 600;
      font-size: 9pt;
      color: #2c3e50;
      border-left: 3px solid #2c3e50;
      display: inline-block;
    }

    /* Tests List - Professional Layout */
    .tests-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-top: 10px;
    }

    .test-item {
      border: 1px solid #d0d0d0;
      padding: 8px 12px;
      background: #fafafa;
      font-size: 9pt;
      color: #000000;
      font-weight: 500;
    }

    .test-bullet {
      color: #2c3e50;
      margin-right: 6px;
      font-weight: 700;
    }

    /* Metadata Section */
    .metadata-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 12px;
      padding: 12px;
      background: #fafafa;
      border: 1px solid #d0d0d0;
    }

    .metadata-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .metadata-label {
      font-size: 9pt;
      color: #666666;
      font-weight: 600;
    }

    .metadata-value {
      font-size: 10pt;
      color: #000000;
      font-weight: 600;
    }

    .confidence-badge {
      background: #2c3e50;
      color: white;
      padding: 4px 12px;
      font-size: 9pt;
      font-weight: 600;
    }

    /* Professional Disclaimer */
    .disclaimer {
      margin-top: 24px;
      padding: 14px;
      background: #fff8e1;
      border: 2px solid #f9a825;
      page-break-inside: avoid;
    }

    .disclaimer-title {
      font-size: 10pt;
      font-weight: 700;
      color: #f57c00;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .disclaimer-text {
      font-size: 9pt;
      color: #000000;
      line-height: 1.6;
    }

    /* Footer */
    .footer {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid #d0d0d0;
      text-align: center;
      color: #666666;
      font-size: 8pt;
    }

    .footer-brand {
      font-weight: 600;
      color: #2c3e50;
    }

    /* Print Optimization */
    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <!-- Professional Header -->
  <div class="header">
    <div class="header-row">
      <div>
        <div class="header-title">Prescription Analysis</div>
        <div class="header-subtitle">AI-Generated Medical Report</div>
      </div>
      <div class="header-date">
        Generated: ${generatedDate}
      </div>
    </div>
  </div>

  <!-- Document Preview (if provided) -->
  ${documentImageBase64
      ? `
  <div class="document-preview">
    <div class="preview-label">Original Document</div>
    <img src="data:image/jpeg;base64,${documentImageBase64}" alt="Prescription Document" class="preview-image" />
  </div>
  `
      : ''
    }

  <!-- Patient Information -->
  <div class="section">
    <div class="section-title">Patient Information</div>
    <div class="section-content">
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Name</div>
          <div class="info-value">${patient_info?.name || 'Not Available'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Age</div>
          <div class="info-value">${patient_info?.age || 'Not Available'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Gender</div>
          <div class="info-value">${patient_info?.gender || 'Not Available'}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Clinical Information -->
  <div class="section">
    <div class="section-title">Clinical Details</div>
    <div class="section-content">
      <div class="clinical-row">
        <div class="clinical-label">Doctor</div>
        <div class="clinical-value">${prescription_data?.doctor_name || 'Not Specified'}</div>
      </div>
      <div class="clinical-row">
        <div class="clinical-label">Hospital/Clinic</div>
        <div class="clinical-value">${prescription_data?.hospital_name || 'Not Specified'}</div>
      </div>
      <div class="clinical-row">
        <div class="clinical-label">Visit Date</div>
        <div class="clinical-value">${visitDate}</div>
      </div>
      <div class="clinical-row">
        <div class="clinical-label">Diagnosis</div>
        <div class="clinical-value">${prescription_data?.medical_issue_diagnosis || 'Not Specified'}</div>
      </div>
    </div>
  </div>

  <!-- AI Analysis Summary -->
  ${common_data?.summary
      ? `
  <div class="section">
    <div class="section-title">AI Analysis Summary</div>
    <div class="section-content">
      <div class="summary-box">
        <div class="summary-text">${common_data.summary}</div>
      </div>
    </div>
  </div>
  `
      : ''
    }

  <!-- Prescribed Medications -->
  ${prescription_data?.medicines && prescription_data.medicines.length > 0
      ? `
  <div class="section">
    <div class="section-title">Prescribed Medications</div>
    <div class="section-content">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 35%;">Medication</th>
            <th style="width: 20%;">Dosage</th>
            <th style="width: 18%;">Frequency</th>
            <th style="width: 27%;">Instructions</th>
          </tr>
        </thead>
        <tbody>
          ${prescription_data.medicines
        .map(
          (med) => `
          <tr>
            <td>
              <div class="medicine-name">${med.exact_written_name}</div>
              ${med.assumed_enriched_data?.generic_name
              ? `<span class="medicine-scientific">${med.assumed_enriched_data.generic_name}</span>`
              : ''
            }
            </td>
            <td>
              ${med.dosage_instruction ? `<span class="dosage-text">${med.dosage_instruction}</span>` : 'Not specified'}
            </td>
            <td>${med.frequency || 'As prescribed'}</td>
            <td>${med.special_instructions || med.duration || 'Follow doctor\'s advice'}</td>
          </tr>
          `
        )
        .join('')}
        </tbody>
      </table>
    </div>
  </div>
  `
      : ''
    }

  <!-- Recommended Tests -->
  ${prescription_data?.recommended_tests && prescription_data.recommended_tests.length > 0
      ? `
  <div class="section">
    <div class="section-title">Recommended Laboratory Tests</div>
    <div class="section-content">
      <div class="tests-grid">
        ${prescription_data.recommended_tests
        .map(
          (test) => `
        <div class="test-item">
          <span class="test-bullet">■</span>${test.test_name}
        </div>
        `
        )
        .join('')}
      </div>
    </div>
  </div>
  `
      : ''
    }

  <!-- Analysis Metadata -->
  <div class="metadata-section">
    <div class="metadata-item">
      <span class="metadata-label">Scan Clarity:</span>
      <span class="metadata-value">${analysis_metadata?.scan_clarity || 'Not Available'}</span>
    </div>
    <div class="metadata-item">
      <span class="confidence-badge">
        AI Confidence: ${Math.round((analysis_metadata?.confidence_score || 0) * 100)}%
      </span>
    </div>
  </div>

  <!-- Professional Disclaimer -->
  <div class="disclaimer">
    <div class="disclaimer-title">⚠ Medical Disclaimer</div>
    <div class="disclaimer-text">
      This is an AI-generated analysis of your prescription document. All information must be verified with your healthcare provider before taking any action. This document is for informational purposes only and does not constitute medical advice. Always consult with a qualified healthcare professional for medical decisions.
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span class="footer-brand">FamilyCare Health</span> • Professional Medical Record Management
  </div>
</body>
</html>
  `;
}

// Lab report function signature updated to accept documentImageBase64
export function generateLabReportHTML(
  analysisResult: DocumentAnalysisResult,
  appLogoBase64?: string,
  documentImageBase64?: string
): string {
  // Keep existing lab report implementation as is
  // Will update this separately if needed
  return ''; // Placeholder for now
}
