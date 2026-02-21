'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getPatientRecord,
  getAnnotations,
  type Annotation,
  type PatientDentalRecord,
} from '@/lib/api';

interface PatientControlPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  patientId: string;
  onPatientLoad: (record: PatientDentalRecord) => void;
}

export default function PatientControlPanel({
  isOpen,
  onToggle,
  patientId,
  onPatientLoad,
}: PatientControlPanelProps) {
  const router = useRouter();
  const [patientRecord, setPatientRecord] = useState<PatientDentalRecord | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [copied, setCopied] = useState(false);

  // Helper function to get tooth name from tooth number
  const getToothName = (toothNumber: number): string => {
    if (toothNumber === 0) return 'General Note';

    const toothMap: Record<number, { name: string; quadrant: string }> = {
      // Upper Right
      8: { name: 'Central Incisor', quadrant: 'Upper Right' },
      7: { name: 'Lateral Incisor', quadrant: 'Upper Right' },
      6: { name: 'Canine', quadrant: 'Upper Right' },
      5: { name: 'First Premolar', quadrant: 'Upper Right' },
      4: { name: 'Second Premolar', quadrant: 'Upper Right' },
      3: { name: 'First Molar', quadrant: 'Upper Right' },
      2: { name: 'Second Molar', quadrant: 'Upper Right' },
      // Upper Left
      9: { name: 'Central Incisor', quadrant: 'Upper Left' },
      10: { name: 'Lateral Incisor', quadrant: 'Upper Left' },
      11: { name: 'Canine', quadrant: 'Upper Left' },
      12: { name: 'First Premolar', quadrant: 'Upper Left' },
      13: { name: 'Second Premolar', quadrant: 'Upper Left' },
      14: { name: 'First Molar', quadrant: 'Upper Left' },
      15: { name: 'Second Molar', quadrant: 'Upper Left' },
      // Lower Right
      25: { name: 'Central Incisor', quadrant: 'Lower Right' },
      26: { name: 'Lateral Incisor', quadrant: 'Lower Right' },
      27: { name: 'Canine', quadrant: 'Lower Right' },
      28: { name: 'First Premolar', quadrant: 'Lower Right' },
      29: { name: 'Second Premolar', quadrant: 'Lower Right' },
      30: { name: 'First Molar', quadrant: 'Lower Right' },
      31: { name: 'Second Molar', quadrant: 'Lower Right' },
      // Lower Left
      24: { name: 'Central Incisor', quadrant: 'Lower Left' },
      23: { name: 'Lateral Incisor', quadrant: 'Lower Left' },
      22: { name: 'Canine', quadrant: 'Lower Left' },
      21: { name: 'First Premolar', quadrant: 'Lower Left' },
      20: { name: 'Second Premolar', quadrant: 'Lower Left' },
      19: { name: 'First Molar', quadrant: 'Lower Left' },
      18: { name: 'Second Molar', quadrant: 'Lower Left' },
    };
    const tooth = toothMap[toothNumber];
    return tooth ? `${tooth.name} (${tooth.quadrant})` : `Tooth #${toothNumber}`;
  };

  // Load patient's own data on mount
  useEffect(() => {
    if (patientId) {
      loadPatientData();
    }
  }, [patientId]);

  const loadPatientData = async () => {
    setLoading(true);

    try {
      // First, try to get the patient record
      let recordData = await getPatientRecord(patientId);

      // If the record doesn't have an ID, it means it doesn't exist in the database yet
      // Create it so dentists can add data later
      if (!recordData.id) {
        const { savePatientRecord } = await import('@/lib/api');
        recordData = await savePatientRecord(patientId, {
          removed_teeth: [],
          cavities: [],
          scan_date: new Date().toISOString().split('T')[0],
        });
      }

      const annotationsData = await getAnnotations(patientId);

      setPatientRecord(recordData);
      // Only show public annotations to the patient
      setAnnotations(annotationsData.filter(a => a.is_public));
      onPatientLoad(recordData);
    } catch (err) {
      console.error('Error loading patient data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      localStorage.removeItem('current_user');
      router.replace('/login');
    } catch (err) {
      console.error('Sign out error:', err);
      alert('Failed to sign out. Please try again.');
      setSigningOut(false);
    }
  };

  const handleCopyPatientId = () => {
    navigator.clipboard.writeText(patientId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="fixed top-4 right-4 z-50 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg transition-colors flex items-center gap-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        My Info
      </button>

      {/* Fullscreen Panel */}
      <div
        className={`fixed inset-0 bg-white transform transition-transform duration-300 ease-in-out z-40 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col items-center justify-center">
          <div className="w-[28rem] h-full max-h-[90vh] flex flex-col">
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Patient ID Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border-2 border-blue-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
                  />
                </svg>
                <h3 className="font-bold text-gray-800 text-lg">Your Patient ID</h3>
              </div>
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <p className="text-xs text-gray-500 mb-1 font-medium">Share this ID with your dentist</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-sm font-mono text-gray-800 bg-gray-50 px-3 py-2 rounded flex-1 break-all">
                    {patientId}
                  </code>
                  <button
                    onClick={handleCopyPatientId}
                    className={`px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap ${
                      copied
                        ? 'bg-green-500 text-white'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                  >
                    {copied ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-3 italic">
                💡 Your dentist can use this ID to access your dental records and add notes.
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <>
                {patientRecord && (
                  <>
                    {/* Dental Summary */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        Your Dental Summary
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center p-2 bg-white rounded">
                          <span className="text-gray-600">Removed Teeth:</span>
                          <span className="font-medium text-gray-800">
                            {patientRecord.removed_teeth.length}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white rounded">
                          <span className="text-gray-600">Cavities:</span>
                          <span className="font-medium text-gray-800">
                            {patientRecord.cavities.length}
                          </span>
                        </div>
                        {patientRecord.scan_date && (
                          <div className="flex justify-between items-center p-2 bg-white rounded">
                            <span className="text-gray-600">Last Scan:</span>
                            <span className="font-medium text-gray-800">
                              {new Date(patientRecord.scan_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Notes from Dentist */}
                    <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                      <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                        Notes from Your Dentist ({annotations.length})
                      </h3>

                      {annotations.length === 0 ? (
                        <p className="text-gray-500 text-sm italic">No notes yet</p>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {annotations.map((annotation) => (
                            <div
                              key={annotation.id}
                              className="bg-white rounded-lg p-3 border border-yellow-200"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <span className="font-medium text-gray-800 py-1 rounded">
                                  {getToothName(annotation.tooth_number)}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {new Date(annotation.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700">{annotation.annotation_text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Cavities Detail */}
                    {patientRecord.cavities.length > 0 && (
                      <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                        <h3 className="font-semibold text-orange-800 mb-3">Cavity Details</h3>
                        <div className="space-y-2">
                          {(() => {
                            // Helper function to get tooth name from tooth number
                            const getToothName = (toothNumber: number): string => {
                              const toothMap: Record<number, { name: string; quadrant: string }> = {
                                // Upper Right
                                8: { name: 'Central Incisor', quadrant: 'Upper Right' },
                                7: { name: 'Lateral Incisor', quadrant: 'Upper Right' },
                                6: { name: 'Canine', quadrant: 'Upper Right' },
                                5: { name: 'First Premolar', quadrant: 'Upper Right' },
                                4: { name: 'Second Premolar', quadrant: 'Upper Right' },
                                3: { name: 'First Molar', quadrant: 'Upper Right' },
                                2: { name: 'Second Molar', quadrant: 'Upper Right' },
                                // Upper Left
                                9: { name: 'Central Incisor', quadrant: 'Upper Left' },
                                10: { name: 'Lateral Incisor', quadrant: 'Upper Left' },
                                11: { name: 'Canine', quadrant: 'Upper Left' },
                                12: { name: 'First Premolar', quadrant: 'Upper Left' },
                                13: { name: 'Second Premolar', quadrant: 'Upper Left' },
                                14: { name: 'First Molar', quadrant: 'Upper Left' },
                                15: { name: 'Second Molar', quadrant: 'Upper Left' },
                                // Lower Right
                                25: { name: 'Central Incisor', quadrant: 'Lower Right' },
                                26: { name: 'Lateral Incisor', quadrant: 'Lower Right' },
                                27: { name: 'Canine', quadrant: 'Lower Right' },
                                28: { name: 'First Premolar', quadrant: 'Lower Right' },
                                29: { name: 'Second Premolar', quadrant: 'Lower Right' },
                                30: { name: 'First Molar', quadrant: 'Lower Right' },
                                31: { name: 'Second Molar', quadrant: 'Lower Right' },
                                // Lower Left
                                24: { name: 'Central Incisor', quadrant: 'Lower Left' },
                                23: { name: 'Lateral Incisor', quadrant: 'Lower Left' },
                                22: { name: 'Canine', quadrant: 'Lower Left' },
                                21: { name: 'First Premolar', quadrant: 'Lower Left' },
                                20: { name: 'Second Premolar', quadrant: 'Lower Left' },
                                19: { name: 'First Molar', quadrant: 'Lower Left' },
                                18: { name: 'Second Molar', quadrant: 'Lower Left' },
                              };
                              const tooth = toothMap[toothNumber];
                              return tooth ? `${tooth.name} (${tooth.quadrant})` : `Tooth #${toothNumber}`;
                            };

                            // Group cavities by tooth number
                            const cavitiesByTooth = patientRecord.cavities.reduce((acc, cavity) => {
                              if (!acc[cavity.toothNumber]) {
                                acc[cavity.toothNumber] = [];
                              }
                              acc[cavity.toothNumber].push(cavity);
                              return acc;
                            }, {} as Record<number, typeof patientRecord.cavities>);

                            // Calculate aggregated severity based on cavity count
                            const getAggregatedSeverity = (count: number): 'mild' | 'moderate' | 'severe' | 'critical' => {
                              if (count === 1) return 'mild';
                              if (count === 2) return 'moderate';
                              if (count === 3) return 'severe';
                              return 'critical';
                            };

                            return Object.entries(cavitiesByTooth).map(([toothNumber, toothCavities]) => {
                              const count = toothCavities.length;
                              const severity = getAggregatedSeverity(count);
                              const positions = toothCavities.map(c => c.position).join(', ');
                              const toothName = getToothName(Number(toothNumber));

                              return (
                                <div
                                  key={toothNumber}
                                  className="bg-white rounded-lg p-3 border border-orange-200 text-sm"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-gray-800">
                                      {toothName}
                                    </span>
                                    <span
                                      className={`text-xs font-semibold px-2 py-1 rounded ${
                                        severity === 'critical'
                                          ? 'bg-red-200 text-red-900'
                                          : severity === 'severe'
                                          ? 'bg-red-100 text-red-800'
                                          : severity === 'moderate'
                                          ? 'bg-orange-100 text-orange-800'
                                          : 'bg-yellow-100 text-yellow-800'
                                      }`}
                                    >
                                      {severity.toUpperCase()}
                                    </span>
                                  </div>
                                  <p className="text-gray-600 text-xs">
                                    {count} {count === 1 ? 'cavity' : 'cavities'} - Position: {positions}
                                  </p>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Refresh Data Button */}
            <button
              onClick={loadPatientData}
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {loading ? 'Refreshing...' : 'Refresh Data'}
            </button>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {signingOut ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Signing Out...
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Sign Out
                </>
              )}
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && <div className="fixed inset-0 bg-black bg-opacity-30 z-30" onClick={onToggle} />}
    </>
  );
}
