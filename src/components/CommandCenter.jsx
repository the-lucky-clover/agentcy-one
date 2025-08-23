import React, { useState, useEffect } from 'react';
import { Shield, Activity, Users, Settings, Clock, AlertTriangle } from 'lucide-react';
import MissionInterface from './MissionInterface';

const CommandCenter = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [systemStatus, setSystemStatus] = useState({
    aiProcessing: 'ONLINE',
    secureComms: 'ENCRYPTED',
    database: 'OPERATIONAL',
    activeAgents: 6
  });

  const [activeOperations] = useState([
    {
      id: 'OP-001',
      name: 'Operation Nightfall',
      status: 'ACTIVE',
      progress: 75,
      type: 'TACTICAL'
    },
    {
      id: 'OP-002',
      name: 'Intel Gathering Alpha',
      status: 'PLANNING',
      progress: 25,
      type: 'INTELLIGENCE'
    },
    {
      id: 'OP-003',
      name: 'Tactical Assessment Beta',
      status: 'COMPLETED',
      progress: 100,
      type: 'ASSESSMENT'
    },
    {
      id: 'OP-004',
      name: 'Security Audit Gamma',
      status: 'ACTIVE',
      progress: 60,
      type: 'SECURITY'
    }
  ]);

  const [agentStatus] = useState([
    {
      id: 'INTEL-01',
      name: 'Intelligence Agent Alpha',
      status: 'OPERATIONAL',
      currentMission: 'SIGINT Analysis',
      capabilities: 'OSINT, SIGINT, Data Analysis'
    },
    {
      id: 'TACTICAL-02',
      name: 'Tactical Planning Agent',
      status: 'OPERATIONAL',
      currentMission: 'Route Optimization',
      capabilities: 'Mission Planning, Terrain Analysis, Resource Allocation'
    },
    {
      id: 'LOGISTICS-03',
      name: 'Logistics Coordination Agent',
      status: 'WARNING',
      currentMission: 'Supply Chain Analysis',
      capabilities: 'Supply Management, Transportation, Inventory'
    },
    {
      id: 'COMMS-04',
      name: 'Communications Agent',
      status: 'OPERATIONAL',
      currentMission: 'Secure Channel Maintenance',
      capabilities: 'Secure Communications, Encryption, Signal Processing'
    },
    {
      id: 'ANALYSIS-05',
      name: 'Data Analysis Agent',
      status: 'OPERATIONAL',
      currentMission: 'Pattern Recognition',
      capabilities: 'Data Mining, Pattern Analysis, Predictive Modeling'
    },
    {
      id: 'SECURITY-06',
      name: 'Security Monitoring Agent',
      status: 'CRITICAL',
      currentMission: 'Threat Detection',
      capabilities: 'Threat Detection, Vulnerability Assessment, Incident Response'
    }
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + ' AM UTC';
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'operational':
      case 'active':
      case 'completed':
        return 'text-green-400';
      case 'warning':
      case 'planning':
        return 'text-yellow-400';
      case 'critical':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIndicator = (status) => {
    switch (status.toLowerCase()) {
      case 'operational':
      case 'active':
      case 'completed':
        return 'bg-green-400 shadow-green-400';
      case 'warning':
      case 'planning':
        return 'bg-yellow-400 shadow-yellow-400';
      case 'critical':
        return 'bg-red-400 shadow-red-400';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="military-container min-h-screen">
      {/* Header */}
      <header className="tactical-header p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Shield className="w-8 h-8 text-green-400" />
            <h1 className="tactical-logo">AGENTCY.ONE</h1>
            <span className="command-center-badge">COMMAND CENTER</span>
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-green-400" />
              <span className="text-green-400 font-mono">{formatTime(currentTime)}</span>
            </div>
            <div className="threat-level">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              THREAT LEVEL: MODERATE
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Mission Interface - Full width on mobile, 2 columns on desktop */}
          <div className="lg:col-span-2">
            <MissionInterface />
          </div>

          {/* Status Panels */}
          <div className="space-y-6">
            {/* Active Operations */}
            <div className="status-panel p-4">
              <h3 className="flex items-center mb-4">
                <Activity className="w-5 h-5 mr-2" />
                ACTIVE OPERATIONS
              </h3>
              <div className="space-y-3">
                {activeOperations.map((operation) => (
                  <div key={operation.id} className="operation-item">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-white">{operation.name}</h4>
                      <span className={`operation-status ${operation.status.toLowerCase()}`}>
                        {operation.progress}%
                      </span>
                    </div>
                    <p className={`operation-status ${operation.status.toLowerCase()} mb-2`}>
                      {operation.status}
                    </p>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${operation.progress}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent Status */}
            <div className="status-panel p-4">
              <h3 className="flex items-center mb-4">
                <Users className="w-5 h-5 mr-2" />
                AGENT STATUS
              </h3>
              <div className="space-y-2">
                {agentStatus.map((agent) => (
                  <div key={agent.id} className="agent-item">
                    <div className="flex items-center flex-1">
                      <div className={`agent-status-indicator ${agent.status.toLowerCase()}`}></div>
                      <div className="flex-1">
                        <div className="font-semibold text-white text-sm">{agent.id}</div>
                        <div className="text-xs text-gray-400">{agent.currentMission}</div>
                      </div>
                    </div>
                    <span className={`operation-status ${agent.status.toLowerCase()} text-xs`}>
                      {agent.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="status-panel p-4">
              <h3 className="flex items-center mb-4">
                <Settings className="w-5 h-5 mr-2" />
                QUICK ACTIONS
              </h3>
              <div className="grid grid-cols-1 gap-2">
                <button className="quick-action-button p-2 rounded text-xs">
                  INTEL GATHERING
                </button>
                <button className="quick-action-button p-2 rounded text-xs">
                  MISSION PLANNING
                </button>
                <button className="quick-action-button p-2 rounded text-xs">
                  TACTICAL ANALYSIS
                </button>
                <button className="quick-action-button p-2 rounded text-xs">
                  THREAT ASSESSMENT
                </button>
                <button className="quick-action-button p-2 rounded text-xs">
                  SYSTEM CONFIG
                </button>
              </div>
            </div>

            {/* System Status */}
            <div className="status-panel p-4">
              <h3 className="flex items-center mb-4">
                <Activity className="w-5 h-5 mr-2" />
                SYSTEM STATUS
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">AI Processing</span>
                  <span className="text-green-400 font-semibold text-sm">ONLINE</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Secure Comms</span>
                  <span className="text-green-400 font-semibold text-sm">ENCRYPTED</span>
                }
                <div className="flex justify-between items-center">
                  <span className="text-sm">Database</span>
                  <span className="text-green-400 font-semibold text-sm">OPERATIONAL</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Active Agents</span>
                  <span className="text-green-400 font-semibold text-sm">6</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandCenter;

