'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getIncident, updateIncidentStatus, addComment, Incident, Event } from '@/lib/api';

export default function IncidentDetail() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [comment, setComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  useEffect(() => {
    loadIncident();
  }, [id]);

  const loadIncident = async () => {
    try {
      setLoading(true);
      const data = await getIncident(id);
      setIncident(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load incident');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: 'OPEN' | 'ACK' | 'RESOLVED') => {
    try {
      setUpdating(true);
      const updated = await updateIncidentStatus(id, newStatus);
      setIncident(updated);
      // Reload to get updated events
      await loadIncident();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !incident) return;

    try {
      setAddingComment(true);
      await addComment(id, comment, incident.createdBy);
      setComment('');
      await loadIncident();
    } catch (err: any) {
      alert(err.message || 'Failed to add comment');
    } finally {
      setAddingComment(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'P1':
        return 'bg-red-100 text-red-800';
      case 'P2':
        return 'bg-yellow-100 text-yellow-800';
      case 'P3':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-red-100 text-red-800';
      case 'ACK':
        return 'bg-yellow-100 text-yellow-800';
      case 'RESOLVED':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatEventType = (type: string) => {
    switch (type) {
      case 'CREATED':
        return 'Created';
      case 'STATUS_CHANGED':
        return 'Status Changed';
      case 'COMMENTED':
        return 'Comment Added';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading incident...</p>
        </div>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error || 'Incident not found'}</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            ← Back to Incidents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => router.push('/')}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Back to Incidents
        </button>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-3xl font-bold text-gray-900">{incident.title}</h1>
            <div className="flex gap-2">
              <span
                className={`px-3 py-1 text-sm font-semibold rounded-full ${getSeverityColor(
                  incident.severity
                )}`}
              >
                {incident.severity}
              </span>
              <span
                className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(
                  incident.status
                )}`}
              >
                {incident.status}
              </span>
            </div>
          </div>

          <p className="text-gray-700 mb-6">{incident.description}</p>

          <div className="border-t pt-4 mb-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Created:</span>
                <span className="ml-2 text-gray-900">
                  {new Date(incident.createdAt).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Updated:</span>
                <span className="ml-2 text-gray-900">
                  {new Date(incident.updatedAt).toLocaleString()}
                </span>
              </div>
              {incident.user && (
                <div>
                  <span className="text-gray-500">Created by:</span>
                  <span className="ml-2 text-gray-900">{incident.user.name}</span>
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            <h2 className="text-lg font-semibold mb-3">Update Status</h2>
            <div className="flex gap-2">
              <button
                onClick={() => handleStatusChange('OPEN')}
                disabled={updating || incident.status === 'OPEN'}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Open
              </button>
              <button
                onClick={() => handleStatusChange('ACK')}
                disabled={updating || incident.status === 'ACK'}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Acknowledge
              </button>
              <button
                onClick={() => handleStatusChange('RESOLVED')}
                disabled={updating || incident.status === 'RESOLVED'}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Resolve
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Add Comment</h2>
          <form onSubmit={handleAddComment}>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3"
              rows={3}
              placeholder="Add a comment..."
            />
            <button
              type="submit"
              disabled={addingComment || !comment.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingComment ? 'Adding...' : 'Add Comment'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Activity Timeline</h2>
          {incident.events && incident.events.length > 0 ? (
            <div className="space-y-4">
              {incident.events.map((event: Event) => (
                <div key={event.id} className="border-l-2 border-gray-200 pl-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {formatEventType(event.type)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {new Date(event.createdAt).toLocaleString()}
                      </p>
                      {event.type === 'COMMENTED' && event.payload.comment && (
                        <p className="mt-2 text-gray-700">{event.payload.comment}</p>
                      )}
                      {event.type === 'STATUS_CHANGED' && (
                        <p className="mt-2 text-gray-700">
                          {event.payload.from} → {event.payload.to}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No activity yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
