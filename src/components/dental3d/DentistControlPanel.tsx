'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  getPatientRecord,
  getAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  addRemovedTooth,
  removeRemovedTooth,
  addCavity,
  removeCavity,
  type Annotation,
  type PatientDentalRecord,
  type CavityData,
} from '@/lib/api';

interface DentistControlPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onPatientLoad: (record: PatientDentalRecord) => void;
  selectedTooth: number | null;
}

export default function DentistControlPanel({
  isOpen,
  onToggle,
  onPatientLoad,
  selectedTooth,
}: DentistControlPanelProps) {
  const router = useRouter();
  const [patientId, setPatientId] = useState('');
  const [currentPatient, setCurrentPatient] = useState<PatientDentalRecord | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [signingOut, setSigningOut] = useState(false);

  // Annotation form state
  const [newAnnotation, setNewAnnotation] = useState('');
  const [annotationIsPublic, setAnnotationIsPublic] = useState(false);

  // Cavity form state
  const [cavitySeverity, setCavitySeverity] = useState<'mild' | 'moderate' | 'severe'>('mild');
  const [cavityPosition, setCavityPosition] = useState<'occlusal' | 'buccal' | 'lingual' | 'mesial' | 'distal'>('occlusal');

  const loadPatientData = async () => {
    if (!patientId.trim()) {
      setError('Please enter a patient ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [recordData, annotationsData] = await Promise.all([
        getPatientRecord(patientId),
        getAnnotations(patientId),
      ]);

      setCurrentPatient(recordData);
      setAnnotations(annotationsData);
      onPatientLoad(recordData);
    } catch (err) {
      console.error('Error loading patient data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load patient data');
      setCurrentPatient(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAnnotation = async () => {
    if (!currentPatient || !selectedTooth || !newAnnotation.trim()) {
      setError('Please select a tooth and enter annotation text');
      return;
    }

    try {
      const annotation = await createAnnotation(
        currentPatient.patient_id,
        selectedTooth,
        newAnnotation,
        annotationIsPublic
      );

      setAnnotations((prev) => [annotation, ...prev]);
      setNewAnnotation('');
      setAnnotationIsPublic(false);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create annotation');
    }
  };

  const handleDeleteAnnotation = async (annotationId: string) => {
    try {
      await deleteAnnotation(annotationId);
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete annotation');
    }
  };

  const handleToggleAnnotationVisibility = async (annotation: Annotation) => {
    try {
      const updated = await updateAnnotation(annotation.id, {
        is_public: !annotation.is_public,
      });

      setAnnotations((prev) =>
        prev.map((a) => (a.id === annotation.id ? updated : a))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update annotation');
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
        alert('Failed to sign out. Please try again.');
        setSigningOut(false);
      } else {
        router.replace('/login');
      }
    } catch (err) {
      console.error('Sign out error:', err);
      alert('Failed to sign out. Please try again.');
      setSigningOut(false);
    }
  };

  const handleRemoveTooth = async (toothNumber: number) => {
    if (!currentPatient) return;

    try {
      const updated = await addRemovedTooth(currentPatient.patient_id, toothNumber);
      setCurrentPatient(updated);
      onPatientLoad(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark tooth as removed');
    }
  };

  const handleRestoreTooth = async (toothNumber: number) => {
    if (!currentPatient) return;

    try {
      const updated = await removeRemovedTooth(currentPatient.patient_id, toothNumber);
      setCurrentPatient(updated);
      onPatientLoad(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore tooth');
    }
  };

  const handleAddCavity = async () => {
    if (!currentPatient || !selectedTooth) {
      setError('Please select a tooth first');
      return;
    }

    try {
      const cavity: CavityData = {
        toothNumber: selectedTooth,
        severity: cavitySeverity,
        position: cavityPosition,
      };

      const updated = await addCavity(currentPatient.patient_id, cavity);
      setCurrentPatient(updated);
      onPatientLoad(updated);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add cavity');
    }
  };

  const handleRemoveCavity = async (toothNumber: number) => {
    if (!currentPatient) return;

    try {
      const updated = await removeCavity(currentPatient.patient_id, toothNumber);
      setCurrentPatient(updated);
      onPatientLoad(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove cavity');
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="fixed top-4 right-4 z-50 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg transition-colors flex items-center gap-2"
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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        Dentist Tools
      </button>

      {/* Sliding Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[28rem] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-40 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-green-500 text-white p-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Dentist Control Panel</h2>
            <button
              onClick={onToggle}
              className="text-white hover:bg-green-600 p-2 rounded-lg transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Patient Check-In */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="font-semibold text-gray-700 mb-3">Check In Patient</h3>
              <div className="space-y-2">
                <input
                  type="text"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  placeholder="Enter Patient ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  onKeyDown={(e) => e.key === 'Enter' && loadPatientData()}
                />
                <button
                  onClick={loadPatientData}
                  disabled={loading}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load Patient'}
                </button>
              </div>
            </div>

            {currentPatient && (
              <>
                {/* Patient Summary */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="font-semibold text-blue-800 mb-2">Current Patient</h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-700">
                      <span className="font-medium">ID:</span> {currentPatient.patient_id.substring(0, 8)}...
                    </p>
                    <p className="text-gray-700">
                      <span className="font-medium">Removed Teeth:</span> {currentPatient.removed_teeth.length}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-medium">Cavities:</span> {currentPatient.cavities.length}
                    </p>
                  </div>
                </div>

                {/* Selected Tooth Actions */}
                {selectedTooth && (
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <h3 className="font-semibold text-purple-800 mb-3">
                      Tooth #{selectedTooth} Actions
                    </h3>

                    <div className="space-y-2">
                      {currentPatient.removed_teeth.includes(selectedTooth) ? (
                        <button
                          onClick={() => handleRestoreTooth(selectedTooth)}
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition-colors text-sm"
                        >
                          Restore Tooth
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRemoveTooth(selectedTooth)}
                          className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 rounded-lg transition-colors text-sm"
                        >
                          Mark as Removed
                        </button>
                      )}

                      {/* Add Cavity */}
                      <div className="border-t border-purple-200 pt-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Add Cavity</p>
                        <div className="space-y-2">
                          <select
                            value={cavitySeverity}
                            onChange={(e) => setCavitySeverity(e.target.value as any)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="mild">Mild</option>
                            <option value="moderate">Moderate</option>
                            <option value="severe">Severe</option>
                          </select>
                          <select
                            value={cavityPosition}
                            onChange={(e) => setCavityPosition(e.target.value as any)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="occlusal">Occlusal (Top)</option>
                            <option value="buccal">Buccal (Cheek side)</option>
                            <option value="lingual">Lingual (Tongue side)</option>
                            <option value="mesial">Mesial (Front)</option>
                            <option value="distal">Distal (Back)</option>
                          </select>
                          <button
                            onClick={handleAddCavity}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 rounded-lg transition-colors text-sm"
                          >
                            Add Cavity
                          </button>
                        </div>
                      </div>

                      {/* Remove Cavity */}
                      {currentPatient.cavities.some((c) => c.toothNumber === selectedTooth) && (
                        <button
                          onClick={() => handleRemoveCavity(selectedTooth)}
                          className="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 rounded-lg transition-colors text-sm"
                        >
                          Remove Cavity
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Add Annotation */}
                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <h3 className="font-semibold text-yellow-800 mb-3">
                    Add Note {selectedTooth && `for Tooth #${selectedTooth}`}
                  </h3>

                  <div className="space-y-2">
                    <textarea
                      value={newAnnotation}
                      onChange={(e) => setNewAnnotation(e.target.value)}
                      placeholder="Enter note..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm"
                      rows={3}
                      disabled={!selectedTooth}
                    />

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={annotationIsPublic}
                        onChange={(e) => setAnnotationIsPublic(e.target.checked)}
                        className="rounded text-yellow-500 focus:ring-yellow-500"
                      />
                      <span className="text-gray-700">Visible to patient</span>
                    </label>

                    <button
                      onClick={handleAddAnnotation}
                      disabled={!selectedTooth || !newAnnotation.trim()}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 text-sm"
                    >
                      Add Note
                    </button>
                  </div>
                </div>

                {/* Annotations List */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-3">
                    Notes ({annotations.length})
                  </h3>

                  {annotations.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">No notes yet</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {annotations.map((annotation) => (
                        <div
                          key={annotation.id}
                          className="bg-white rounded-lg p-3 border border-gray-200"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded">
                              Tooth #{annotation.tooth_number}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleToggleAnnotationVisibility(annotation)}
                                className={`text-xs px-2 py-1 rounded ${
                                  annotation.is_public
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                                title={annotation.is_public ? 'Patient can see' : 'Private note'}
                              >
                                {annotation.is_public ? '👁️ Public' : '🔒 Private'}
                              </button>
                              <button
                                onClick={() => handleDeleteAnnotation(annotation.id)}
                                className="text-red-500 hover:text-red-700 p-1"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-700">{annotation.annotation_text}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(annotation.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

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

      {/* Backdrop */}
      {isOpen && <div className="fixed inset-0 bg-black bg-opacity-30 z-30" onClick={onToggle} />}
    </>
  );
}
