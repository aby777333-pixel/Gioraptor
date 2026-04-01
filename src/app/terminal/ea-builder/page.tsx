'use client';

import { useState, useCallback } from 'react';
import {
  ArrowLeft,
  Save,
  Play,
  Rocket,
  Code2,
  Blocks,
  Bot,
} from 'lucide-react';
import Link from 'next/link';
import CodeEditor, { DEFAULT_CODE } from '@/components/ea/CodeEditor';
import StrategyConfig from '@/components/ea/StrategyConfig';
import BacktestResults from '@/components/ea/BacktestResults';
import DragDropBuilder from '@/components/ea/DragDropBuilder';

type EditorTab = 'code' | 'visual';
type RightTab = 'config' | 'results';

export default function EABuilderPage() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [strategyName, setStrategyName] = useState('EMA Crossover v1');
  const [editorTab, setEditorTab] = useState<EditorTab>('code');
  const [rightTab, setRightTab] = useState<RightTab>('config');
  const [hasResults, setHasResults] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleRunBacktest = useCallback(() => {
    setIsRunning(true);
    setRightTab('results');
    // Simulate backtest delay
    setTimeout(() => {
      setHasResults(true);
      setIsRunning(false);
    }, 2000);
  }, []);

  const handleSave = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  return (
    <div
      className="h-screen w-screen overflow-hidden flex flex-col"
      style={{ backgroundColor: '#0A0A0F', color: '#E0E0E0' }}
    >
      {/* Top Toolbar */}
      <div
        className="flex items-center justify-between px-3 border-b shrink-0"
        style={{
          height: 44,
          backgroundColor: '#111118',
          borderColor: '#1E1E2E',
        }}
      >
        {/* Left section */}
        <div className="flex items-center gap-3">
          <Link
            href="/terminal"
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-all hover:bg-white/5"
            style={{ color: '#888' }}
          >
            <ArrowLeft size={14} />
            Terminal
          </Link>

          <div
            style={{ width: 1, height: 20, backgroundColor: '#1E1E2E' }}
          />

          <div className="flex items-center gap-2">
            <Bot size={16} style={{ color: '#29ABE2' }} />
            <span
              className="text-[13px] font-bold"
              style={{ color: '#29ABE2' }}
            >
              EA Strategy Builder
            </span>
          </div>

          <div
            style={{ width: 1, height: 20, backgroundColor: '#1E1E2E' }}
          />

          {/* Strategy name inline edit */}
          <input
            type="text"
            value={strategyName}
            onChange={(e) => setStrategyName(e.target.value)}
            className="px-2 py-1 rounded text-[12px] font-mono outline-none bg-transparent border border-transparent hover:border-[#1E1E2E] focus:border-[#29ABE2] transition-colors"
            style={{ color: '#CCC', width: 200 }}
          />
        </div>

        {/* Right section - action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-all hover:brightness-125"
            style={{
              backgroundColor: saved ? '#00C85320' : '#1E1E2E',
              color: saved ? '#00C853' : '#888',
              border: `1px solid ${saved ? '#00C85340' : '#2A2A3A'}`,
            }}
          >
            <Save size={12} />
            {saved ? 'Saved' : 'Save'}
          </button>

          <button
            onClick={handleRunBacktest}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold transition-all"
            style={{
              backgroundColor: isRunning ? '#1A5A72' : '#29ABE2',
              color: isRunning ? '#888' : '#000',
              cursor: isRunning ? 'not-allowed' : 'pointer',
            }}
          >
            {isRunning ? (
              <>
                <div
                  className="w-3 h-3 border-2 rounded-full animate-spin"
                  style={{
                    borderColor: '#666',
                    borderTopColor: '#29ABE2',
                  }}
                />
                Running...
              </>
            ) : (
              <>
                <Play size={12} />
                Run Backtest
              </>
            )}
          </button>

          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold transition-all hover:brightness-125"
            style={{
              backgroundColor: '#00C85320',
              color: '#00C853',
              border: '1px solid #00C85340',
            }}
          >
            <Rocket size={12} />
            Deploy to Live
          </button>
        </div>
      </div>

      {/* Main Content - split layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Code Editor / Visual Builder (60%) */}
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: '60%', borderRight: '1px solid #1E1E2E' }}
        >
          {/* Editor tabs */}
          <div
            className="flex items-center gap-0 border-b shrink-0"
            style={{
              backgroundColor: '#0D0D14',
              borderColor: '#1E1E2E',
            }}
          >
            <EditorTabButton
              active={editorTab === 'code'}
              onClick={() => setEditorTab('code')}
              icon={<Code2 size={13} />}
              label="Code Editor"
            />
            <EditorTabButton
              active={editorTab === 'visual'}
              onClick={() => setEditorTab('visual')}
              icon={<Blocks size={13} />}
              label="Visual Builder"
            />
          </div>

          {/* Editor content */}
          <div className="flex-1 overflow-hidden">
            {editorTab === 'code' ? (
              <CodeEditor code={code} onChange={setCode} />
            ) : (
              <DragDropBuilder />
            )}
          </div>
        </div>

        {/* Right Panel - Config + Results (40%) */}
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: '40%' }}
        >
          {/* Right panel tabs */}
          <div
            className="flex items-center gap-0 border-b shrink-0"
            style={{
              backgroundColor: '#0D0D14',
              borderColor: '#1E1E2E',
            }}
          >
            <EditorTabButton
              active={rightTab === 'config'}
              onClick={() => setRightTab('config')}
              icon={<Bot size={13} />}
              label="Configuration"
            />
            <EditorTabButton
              active={rightTab === 'results'}
              onClick={() => setRightTab('results')}
              icon={<Play size={13} />}
              label="Backtest Results"
              badge={hasResults}
            />
          </div>

          {/* Right panel content */}
          <div className="flex-1 overflow-hidden">
            {rightTab === 'config' ? (
              <StrategyConfig
                strategyName={strategyName}
                onStrategyNameChange={setStrategyName}
                onRunBacktest={handleRunBacktest}
                isRunning={isRunning}
              />
            ) : (
              <BacktestResults hasResults={hasResults} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditorTabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium transition-all relative"
      style={{
        color: active ? '#E0E0E0' : '#555',
        backgroundColor: active ? '#111118' : 'transparent',
        borderBottom: active ? '2px solid #29ABE2' : '2px solid transparent',
      }}
    >
      {icon}
      {label}
      {badge && (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: '#00C853' }}
        />
      )}
    </button>
  );
}
