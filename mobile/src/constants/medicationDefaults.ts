export interface MedicationTypeDefault {
  defaultStrengthUnit: string;
  allowedStrengthUnits: string[];
  defaultDosageUnit: string; // e.g., "Tablet", "ml", "Puff"
  allowedDosageUnits: string[];
}

export const MEDICINE_TYPE_DEFAULTS: Record<string, MedicationTypeDefault> = {
  tablet: {
    defaultStrengthUnit: 'mg',
    allowedStrengthUnits: ['mg', 'mcg', 'g', 'IU'],
    defaultDosageUnit: 'Tablet',
    allowedDosageUnits: ['Tablet', 'Pill', 'Piece'],
  },
  capsule: {
    defaultStrengthUnit: 'mg',
    allowedStrengthUnits: ['mg', 'mcg', 'g', 'IU'],
    defaultDosageUnit: 'Capsule',
    allowedDosageUnits: ['Capsule', 'Pill'],
  },
  syrup: {
    defaultStrengthUnit: 'mg/5ml',
    allowedStrengthUnits: ['mg/5ml', 'mg/ml', 'g/ml', '%'],
    defaultDosageUnit: 'ml',
    allowedDosageUnits: ['ml', 'Spoon', 'Teaspoon', 'Cup', 'Drop'],
  },
  injection: {
    defaultStrengthUnit: 'mg/ml',
    allowedStrengthUnits: ['mg/ml', 'IU/ml', 'mg'],
    defaultDosageUnit: 'ml',
    allowedDosageUnits: ['ml', 'Vial', 'Ampoule', 'Unit', 'Injection'],
  },
  drops: {
    defaultStrengthUnit: '%',
    allowedStrengthUnits: ['%', 'mg/ml'],
    defaultDosageUnit: 'Drop',
    allowedDosageUnits: ['Drop', 'ml'],
  },
  cream: {
    defaultStrengthUnit: '%',
    allowedStrengthUnits: ['%', 'mg/g'],
    defaultDosageUnit: 'Application',
    allowedDosageUnits: ['Application', 'Finger Tip Unit', 'Pump'],
  },
  ointment: {
    defaultStrengthUnit: '%',
    allowedStrengthUnits: ['%', 'mg/g'],
    defaultDosageUnit: 'Application',
    allowedDosageUnits: ['Application', 'Finger Tip Unit', 'Pump'],
  },
  inhaler: {
    defaultStrengthUnit: 'mcg/puff',
    allowedStrengthUnits: ['mcg/puff', 'mg/puff'],
    defaultDosageUnit: 'Puff',
    allowedDosageUnits: ['Puff', 'Inhalation', 'Spray'],
  },
  nebulizer: {
    defaultStrengthUnit: 'mg/ml',
    allowedStrengthUnits: ['mg/ml', '%'],
    defaultDosageUnit: 'Nebule',
    allowedDosageUnits: ['Nebule', 'ml', 'Vial'],
  },
  sachet: {
    defaultStrengthUnit: 'g',
    allowedStrengthUnits: ['g', 'mg'],
    defaultDosageUnit: 'Sachet',
    allowedDosageUnits: ['Sachet', 'Scoop', 'Packet'],
  },
  default: {
    defaultStrengthUnit: 'mg',
    allowedStrengthUnits: ['mg', 'ml', '%'],
    defaultDosageUnit: 'Unit',
    allowedDosageUnits: ['Unit', 'ml', 'Tablet', 'Puff'],
  },
};
