'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getAnnotations, getPatientRecord, type Annotation, type PatientDentalRecord } from '@/lib/api';

interface PatientInfoPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function PatientInfoPanel({ isOpen, onToggle }: PatientInfoPanelProps) {
  const router = useRouter();
  const [userId, setUserId] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [dentalRecord, setDentalRecord] = useState<PatientDentalRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [signingOut, setSigningOut] = useState(false);

  // Get user info on mount
  useEffect(() => {
    const getUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email || '');
      }
    };
    getUserInfo();
  }, []);

  // Load data when panel opens
  useEffect(() => {
    if (isOpen && userId) {
      loadPatientData();
    }
  }, [isOpen, userId]);

  const loadPatientData = async () => {
    setLoading(true);
    setError('');

    try {
      // Fetch annotations and dental record in parallel
      const [annotationsData, recordData] = await Promise.all([
        getAnnotations(),
        getPatientRecord(),
      ]);

      setAnnotations(annotationsData);
      setDentalRecord(recordData);
    } catch (err) {
      console.error('Error loading patient data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(userId);
    alert('Patient ID copied to clipboard!');
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
        // Redirect will be handled by the auth listener in page.tsx
        router.replace('/login');
      }
    } catch (err) {
      console.error('Sign out error:', err);
      alert('Failed to sign out. Please try again.');
      setSigningOut(false);
    }
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

      {/* Sliding Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-40 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-blue-500 text-white p-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Patient Information</h2>
            <button
              onClick={onToggle}
              className="text-white hover:bg-blue-600 p-2 rounded-lg transition-colors"
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
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}

                {/* Patient ID Section */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">Your Patient ID</h3>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white px-3 py-2 rounded border border-gray-300 text-sm font-mono text-gray-800 break-all">
                      {userId || 'Loading...'}
                    </code>
                    <button
                      onClick={copyToClipboard}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded transition-colors shrink-0"
                      disabled={!userId}
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Share this ID with your dentist to view your records
                  </p>
                </div>

                {/* Email Section */}
                {userEmail && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h3 className="font-semibold text-gray-700 mb-2">Email</h3>
                    <p className="text-gray-800">{userEmail}</p>
                  </div>
                )}

                {/* Dental Record Summary */}
                {dentalRecord && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h3 className="font-semibold text-gray-700 mb-3">Dental Record Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Last Updated:</span>
                        <span className="font-medium">
                          {new Date(dentalRecord.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Removed Teeth:</span>
                        <span className="font-medium">{dentalRecord.removed_teeth.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cavities:</span>
                        <span className="font-medium">{dentalRecord.cavities.length}</span>
                      </div>
                      {dentalRecord.scan_id && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Scan ID:</span>
                          <span className="font-medium text-xs">{dentalRecord.scan_id}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Annotations Section */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-3">
                    Dentist Notes ({annotations.length})
                  </h3>

                  {annotations.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">No notes from your dentist yet</p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {annotations.map((annotation) => (
                        <div
                          key={annotation.id}
                          className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded">
                                Tooth #{annotation.tooth_number}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(annotation.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {annotation.annotation_text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Refresh Button */}
                <button
                  onClick={loadPatientData}
                  disabled={loading}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                >
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-30"
          onClick={onToggle}
        />
      )}
    </>
  );
}
