import React, { useState }m from 'react';
import { Send, CheckCircle, XCircle, Loader } from 'lucide-react';

const MissionInterface = () => {
  const [missionInput, setMissionInput] = useState('');
  const [missionResult, setMissionResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleMissionExecute = async () => {
    if (!missionInput.trim()) return;

    setIsLoading(true);
    setMissionResult(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/mission/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mission: missionInput }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMissionResult({ success: true, message: data.message, analysis: data.mission.ai_analysis });
      } else {
        setMissionResult({ success: false, message: data.error || 'Unknown error occurred' });
      }
    } catch (error) {
      setMissionResult({ success: false, message: `Network error: ${error.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = async (actionType) => {
    let prompt = '';
    switch (actionType) {
      case 'INTEL':
        prompt = 'Gather intelligence on recent activities in the designated area. Provide a summary of key findings and potential implications.';
        break;
      case 'TACTICAL':
        prompt = 'Develop a tactical plan for a rapid deployment scenario. Include resource allocation, movement strategies, and contingency measures.';
        break;
      case 'THREAT':
        prompt = 'Assess the current threat level in the operational zone. Identify potential hostile elements and recommend immediate countermeasures.';
        break;
      default:
        return;
    }
    setMissionInput(prompt);
    // Optionally, execute immediately
    // handleMissionExecute();
  };

  return (
    <div className="mission-interface p-6">
      <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center">
        <span className="mr-2">MISSION COMMAND INTERFACE</span>
        <span className="text-xs text-gray-400 ml-auto">AI-POWERED</span>
      </h2>
      <textarea
        className="mission-textarea w-full p-4 rounded-md mb-4 h-40"
        placeholder="Enter mission parameters, tactical requirements, or intelligence requests..."
        value={missionInput}
        onChange={(e) => setMissionInput(e.target.value)}
        disabled={isLoading}
      ></textarea>
      <button
        className={`execute-button w-full p-3 rounded-md flex items-center justify-center ${isLoading ? 'processing' : ''}`}
        onClick={handleMissionExecute}
        disabled={isLoading}
      >
        {isLoading ? (
          <><Loader className="animate-spin mr-2" size={20} /> PROCESSING...</>
        ) : (
          <><Send className="mr-2" size={20} /> EXECUTE MISSION</>
        )}
      </button>

      <div className="flex justify-between mt-4 space-x-2">
        <button
          className="quick-action-button intel flex-1 p-3 rounded-md flex items-center justify-center"
          onClick={() => handleQuickAction('INTEL')}
          disabled={isLoading}
        >
          INTEL
        </button>
        <button
          className="quick-action-button tactical flex-1 p-3 rounded-md flex items-center justify-center"
          onClick={() => handleQuickAction('TACTICAL')}
          disabled={isLoading}
        >
          TACTICAL
        </button>
        <button
          className="quick-action-button threat flex-1 p-3 rounded-md flex items-center justify-center"
          onClick={() => handleQuickAction('THREAT')}
          disabled={isLoading}
        >
          THREAT
        </button>
      </div>

      {missionResult && (
        <div className="mission-result mt-6 p-4 rounded-md">
          <h4 className="text-lg font-bold mb-2 flex items-center">
            {missionResult.success ? (
              <CheckCircle className="text-green-400 mr-2" size={24} />
            ) : (
              <XCircle className="text-red-400 mr-2" size={24} />
            )}
            MISSION ANALYSIS COMPLETE
            {missionResult.success ? (
              <span className="success-badge ml-auto">SUCCESS</span>
            ) : (
              <span className="error-badge ml-auto">FAILED</span>
            )}
          </h4>
          <p className="text-gray-300 text-sm mb-2">{missionResult.message}</p>
          {missionResult.analysis && (
            <div className="bg-gray-900 p-3 rounded-md text-xs font-mono whitespace-pre-wrap">
              {missionResult.analysis}
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="ai-processing mt-6">
          <div className="spinner"></div>
          <p className="text-gray-400">Gemini Flash 2.5 analyzing mission parameters...</p>
        </div>
      )}
    </div>
  );
};

export default MissionInterface;

