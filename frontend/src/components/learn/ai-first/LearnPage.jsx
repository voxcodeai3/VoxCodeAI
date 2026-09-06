import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import PathSelector from './PathSelector';
import AssessmentFlow from './AssessmentFlow';
import LearningExperience from './LearningExperience';

export default function LearnPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('loading'); // 'loading' | 'paths' | 'assessment' | 'learning'
  const [activePathId, setActivePathId] = useState(null);
  const [assessmentNeeded, setAssessmentNeeded] = useState(false);

  const checkState = useCallback(async () => {
    setLoading(true);
    try {
      const [roadmapRes, stateRes] = await Promise.all([
        api.get('/learning/roadmap/current'),
        api.get('/learning/current'),
      ]);

      if (roadmapRes.data.hasActivePath) {
        const pathId = roadmapRes.data.path?.id;
        setActivePathId(pathId);

        if (!stateRes.data.assessment?.completed) {
          setAssessmentNeeded(true);
          setView('assessment');
        } else {
          setView('learning');
        }
      } else {
        setView('paths');
      }
    } catch {
      setView('paths');
    }
    setLoading(false);
  }, []);

  useEffect(() => { checkState(); }, [checkState]);

  const handleSelectPath = useCallback((path) => {
    setActivePathId(path._id);
    setAssessmentNeeded(true);
    setView('assessment');
  }, []);

  const handleAssessmentComplete = useCallback(() => {
    setAssessmentNeeded(false);
    setView('learning');
  }, []);

  const handleSwitchPath = useCallback(() => {
    setActivePathId(null);
    setView('paths');
  }, []);

  if (loading || view === 'loading') {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <div className="flex items-center gap-2 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-white">
      {view === 'paths' && (
        <div className="px-4 py-8">
          <PathSelector onSelect={handleSelectPath} />
        </div>
      )}

      {view === 'assessment' && activePathId && (
        <div className="px-4 py-8">
          <AssessmentFlow
            pathId={activePathId}
            onComplete={handleAssessmentComplete}
          />
        </div>
      )}

      {view === 'learning' && activePathId && (
        <LearningExperience
          pathId={activePathId}
          onSwitchPath={handleSwitchPath}
        />
      )}
    </div>
  );
}
